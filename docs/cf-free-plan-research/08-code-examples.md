# 未实现方案代码示例

本文档汇总 7 个风险推荐方案的代码示例，供日后参考实施。

## 风险 1：v1 API 不展开 + v0 KV 缓存

### v1 加 `?expand=false` 默认参数

```js
// src/api-v1.js handleV1Todos
export async function handleV1Todos(request, env, url) {
  const expand = url.searchParams.get('expand') !== 'false'; // 默认 true

  const { results } = await DB.prepare(`SELECT * FROM todos WHERE date = ? AND deleted = 0`).bind(date).all();

  if (!expand) {
    // 只返回当前 date 的 todos + 所有 active templates，调用方自己算 RRULE
    const templates = await DB.prepare(`
      SELECT * FROM todo_templates
      WHERE repeat_type IN ('daily','weekly','monthly','yearly')
      AND anchor_date <= ?
      AND (repeat_end = '' OR repeat_end IS NULL OR repeat_end >= ?)
    `).bind(date, date).all();
    return jsonResponse({ success: true, data: { todos: results, templates: templates.results, expand: false } });
  }

  // 旧逻辑：服务端展开（保留向后兼容）
  // ...
}
```

### v0 KV 缓存 60s

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "CACHE"
id = "xxx"
```

```js
// src/api.js GET /api/todos
if (url.pathname === '/api/todos' && request.method === 'GET') {
  const date = url.searchParams.get('date');
  const cacheKey = `todos:${date}`;

  // 命中缓存直接返回
  const cached = await env.CACHE.get(cacheKey, 'json');
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });
  }

  // 未命中，查 D1
  const result = await _withTodosDateLock(date, async () => { /* 原逻辑 */ });
  const data = await result.json();

  // 写入 KV，TTL 60s
  ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 60 }));

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
  });
}

// 写操作后失效缓存
async function invalidateTodosCache(env, date) {
  await env.CACHE.delete(`todos:${date}`);
}
// 在 CREATE/UPDATE/DELETE/BATCH_TOGGLE_DONE/BATCH_DELETE 后调用
```

## 风险 4：hot-search AbortController + Cache API + RSSHub

```js
// src/utils.js fetchHotSearchData
export async function fetchHotSearchData(providerName = 'auto', ctx, caches) {
  const cacheKey = new Request(`https://internal/hot-search/${providerName}`);
  let cached = await caches.default.match(cacheKey);
  if (cached) return await cached.json();

  const providers = {
    bilibili: 'https://rsshub.app/bilibili/hot-search',
    weibo: 'https://rsshub.app/weibo/hot',
    zhihu: 'https://rsshub.app/zhihu/hotlist',
    baidu: 'https://rsshub.app/baidu/hot',
  };

  const urls = providerName && providers[providerName]
    ? [providers[providerName]]
    : Object.values(providers).sort(() => Math.random() - 0.5);

  for (const url of urls) {
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) { res.body.cancel(); continue; }
      const xml = await res.text();
      const words = parseRSS(xml);
      if (words.length >= 10) {
        const wrapped = new Response(JSON.stringify(words), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' },
        });
        ctx.waitUntil(caches.default.put(cacheKey, wrapped.clone()));
        return words;
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Fetch error:', e);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return [];
}

function parseRSS(xml) {
  // 简易 RSS 解析，提取 <title>
  const matches = xml.match(/<title>([^<]+)<\/title>/g) || [];
  return matches.map(m => m.replace(/<\/?title>/g, '')).filter(Boolean);
}
```

## 风险 5：version check localStorage + Cache API

### 前端 localStorage 24h

```js
// src/html/js/core.js checkForUpdates
async function checkForUpdates() {
  const last = parseInt(localStorage.getItem('last_version_check') || '0');
  const cached = localStorage.getItem('cached_version');

  // 24h 内用缓存
  if (cached && Date.now() - last < 24 * 60 * 60 * 1000) {
    return JSON.parse(cached);
  }

  try {
    const res = await fetch('/api/version-check');
    const data = await res.json();
    localStorage.setItem('cached_version', JSON.stringify(data));
    localStorage.setItem('last_version_check', String(Date.now()));
    return data;
  } catch (e) {
    return cached ? JSON.parse(cached) : null;
  }
}
```

### 后端 Cache API

```js
// src/api.js /api/version-check
if (url.pathname === '/api/version-check' && request.method === 'GET') {
  const cacheKey = new Request('https://internal/version-check', request);
  let cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const res = await fetch('https://raw.githubusercontent.com/moaradc/cf-todo/main/version.json');
  const wrapped = new Response(res.body, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' },
  });
  ctx.waitUntil(caches.default.put(cacheKey, wrapped.clone()));
  return wrapped;
}
```

## 风险 6：D1 read replica + Sessions API

```toml
# wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "cf-todo"
database_id = "xxx"
read_replication = true  # 新增
```

```js
// 读查询用 session（路由到副本）
async function getTodos(env, date) {
  const session = env.DB.withSession('first-primary');
  const { results } = await session.prepare('SELECT * FROM todos WHERE date = ? AND deleted = 0').bind(date).all();
  return results;
}

// 写查询用原 binding（走 primary）
async function updateTodo(env, id, data) {
  await env.DB.prepare('UPDATE todos SET ... WHERE id = ?').bind(..., id).run();
}
```

## 风险 7：导入 multi-row VALUES

```js
// src/api.js import handler
async function handleImport(env, rows) {
  const ROWS_PER_INSERT = 5; // 19 列 × 5 行 = 95 params，留 5 余量
  const chunks = chunkArray(rows, ROWS_PER_INSERT);
  const stmts = chunks.map(chunk => {
    const values = chunk.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
    const params = chunk.flatMap(r => [
      r.id, r.parent_id, r.date, r.text, r.time, r.priority, r.desc,
      r.url, r.copy_text, JSON.stringify(r.subtasks || []),
      JSON.stringify(r.search_terms || []), r.done ? 1 : 0, 0,
      r.repeat_type || 'none', r.repeat_custom || '', r.repeat_end || '',
      r.end_time || '', r.category_id || '', r.repeat_interval || 1,
    ]);
    return env.DB.prepare(
      `INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id, repeat_interval) VALUES ${values}`
    ).bind(...params);
  });

  // 100 个 multi-row INSERT 组成 1 个 batch，只算 1 subrequest
  await env.DB.batch(stmts);
}
```

## 风险 1 备选：rrule.js cache 选项

```js
// Worker 全局缓存 rrule 实例（按 parent_id）
const rruleCache = new Map();

function getRrule(template) {
  if (rruleCache.has(template.parent_id)) {
    return rruleCache.get(template.parent_id);
  }
  const rrule = new rrule.RRule({
    freq: rrule.Frequency[template.repeat_type.toUpperCase()],
    dtstart: new Date(template.anchor_date),
    interval: template.repeat_interval || 1,
    until: template.repeat_end ? new Date(template.repeat_end) : null,
  }, { cache: true });  // 启用 rrule 内部缓存
  rruleCache.set(template.parent_id, rrule);
  return rrule;
}
```

**注意**：Worker isolate 可能随时被回收，缓存命中率不稳。仍是 Worker 内计算，CPU time 不降。

## 风险 1 备选：Cron 预生成（不推荐 Free 用）

```toml
# wrangler.toml
[triggers]
crons = ["5 0 * * *"]  # 每天 00:05 UTC
```

```js
// src/index.js
export default {
  async fetch(request, env, ctx) { /* HTTP handler */ },
  async scheduled(event, env, ctx) {
    // 预生成今天的重复实例
    const today = new Date().toISOString().split('T')[0];
    const templates = await env.DB.prepare(`
      SELECT * FROM todo_templates
      WHERE repeat_type IN ('daily','weekly','monthly','yearly')
      AND anchor_date <= ?
    `).bind(today).all();

    const stmts = [];
    for (const tpl of templates.results) {
      if (!isOccurrenceOnDate(tpl, today)) continue;
      const newId = crypto.randomUUID();
      stmts.push(env.DB.prepare(
        'INSERT INTO todos (...) VALUES (...)'
      ).bind(newId, tpl.parent_id, today, /* ... */));
    }

    // 分批 batch，每批 99 个
    for (let i = 0; i < stmts.length; i += 99) {
      await env.DB.batch(stmts.slice(i, i + 99));
    }
  },
};
```

**问题**：
- Cron 也是 10ms CPU（Free），大量模板时一样撞限
- 需要「断点续跑」机制（记录上次处理到哪个模板）
- 时区问题（UTC 00:05 ≠ 用户本地 00:00）

## 总结

| 方案 | 改动量 | 收益 | 优先级 |
|---|---|---|---|
| 风险 1 v1 不展开 | 中 | v1 CPU 降 90% | ★★★★★ |
| 风险 1 v0 KV 缓存 | 中 | v0 D1 调用降 90% | ★★★★★ |
| 风险 4 hot-search 优化 | 中 | 外部 fetch 降 99% | ★★★ |
| 风险 5 version check | 小 | 请求降 99% | ★★★★ |
| 风险 6 read replica | 小 | 读延迟降 95% | ★★★★ |
| 风险 7 multi-row VALUES | 中 | 导入 5-10x 加速 | ★★★ |
