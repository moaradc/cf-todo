# 风险 5：requests/day 100k

## 状态

**不修改**（用户决定，个人群体够用）

## 问题描述

Workers Free 限制 100,000 requests/day。看似很多，但潜在浪费：

1. **每次切日期** → 1 次 `GET /api/todos?date=X`
2. **每次勾选/取消** → 1 次 `POST /api/todo-action`
3. **详情面板打开** → 可能触发 `reloadDetailTimeRecords`
4. **version check** → `core.js:235` 每次打开页面打 `https://raw.githubusercontent.com/moaradc/cf-todo/main/version.json`
5. **hot-search** → 每次打开添加 modal 打 `/api/hot-search`

假设 10 个活跃用户每人每天 100 次操作 = 1000 requests，离 100k 还远。但脚本高频轮询会撞限。

用户目标：个人群体（不是团队），100k/day 足够。

## 调研发现

### Cloudflare 原生 Rate Limiting

**官方**（[Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit)）：
> The Rate Limiting API lets you define rate limits and write code around them in your Worker.

**特性**：
- Free 可用
- 可按 IP / API key / 自定义 key 限流
- 支持 token bucket / sliding window / fixed window

**用法**（wrangler.toml）：
```toml
[[unsafe.bindings]]
name = "RATE_LIMITER"
type = "ratelimit"
namespace_id = "1001"

[unsafe.bindings.simple]
limit = 100
period = 60
```

**Worker 内**：
```js
const { success } = await env.RATE_LIMITER.limit({ key: request.headers.get('X-API-Key') });
if (!success) return new Response('Rate limit exceeded', { status: 429 });
```

### Rate Limiting 算法对比

**Arcjet Blog**（[Token Bucket vs Sliding Window vs Fixed Window](https://blog.arcjet.com/rate-limiting-algorithms-token-bucket-vs-sliding-window-vs-fixed-window)）：

| 算法 | 优点 | 缺点 |
|---|---|---|
| Fixed Window | 简单 | 边界突发 |
| Sliding Window | 平滑 | 复杂 |
| Token Bucket | 灵活突发 | 内存 |

### Version check 优化

#### 方案 F：localStorage 24h 缓存

**思路**：前端 localStorage 记录 `last_version_check`，24h 内不请求。

**改动**（`core.js:235`）：
```js
const last = parseInt(localStorage.getItem('last_version_check') || '0');
if (Date.now() - last < 24 * 60 * 60 * 1000) {
  // 用 localStorage 缓存的 version
  return JSON.parse(localStorage.getItem('cached_version'));
}
const res = await fetch('https://raw.githubusercontent.com/.../version.json');
const data = await res.json();
localStorage.setItem('cached_version', JSON.stringify(data));
localStorage.setItem('last_version_check', String(Date.now()));
```

**收益**：version check 请求降 95%+。

#### 方案 E：ETag + Conditional Request

GitHub raw 返回 ETag/Last-Modified。Worker 缓存 ETag 到 KV，下次带 `If-None-Match`，GitHub 返回 304 时不计入配额。

```js
const etag = await env.KV.get('version_etag');
const res = await fetch(url, etag ? { headers: { 'If-None-Match': etag } } : {});
if (res.status === 304) return cached;
if (res.headers.get('etag')) await env.KV.put('version_etag', res.headers.get('etag'));
```

**收益**：即使 24h 到了，ETag 304 也很轻。

#### 方案 G：Periodic Background Sync API

**MDN**（[Web Periodic Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API)）：
> Allows web applications to alert their service worker to make any updates, at a periodic time interval.

**Chrome 文档**（[Periodic Background Sync](https://developer.chrome.com/docs/capabilities/periodic-background-sync)）：
> When your service worker wakes up to handle a periodicsync event, you have the opportunity to request data.

**问题**：
- 仅 Chrome/Edge 支持，Safari/Firefox 不支持
- 需要安装 PWA
- 间隔由浏览器决定（不能精确控制）
- 用户必须访问过站点

**结论**：不适合通用场景，仅作 PWA 增强备选。

### Workers Cache API 替代 KV

**官方**（[Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache)）：
> Fine grained control of reading and writing from the Cloudflare global network cache.

**优势**（vs KV）：
- 不消耗 KV 1000 writes/day 配额
- Free 完全可用
- 适合幂等请求（如 version check）

**坑**（[社区](https://community.cloudflare.com/t/cache-put-without-cache-control-header-does-not-cache/447376)）：
> Anything with a 200 status that has no cache headers will be cached for 120 minutes. That's not happening, it's not cached at all unless at least one cache header is present.

必须设置 `Cache-Control` header 才会缓存。

### 监控 request count

**官方**：CF Dashboard → Workers → Metrics 可看每日 request 数。

可用 `ctx.waitUntil` 异步写 D1 settings 表记录请求计数（每日清零），但消耗 D1 配额，不推荐。

## 推荐方案（如要修改）

### 方案 F + Cache API 组合

1. **前端**：localStorage 24h 缓存 version check（方案 F）
2. **后端**：`/api/version-check` 用 `caches.default` 命中直接返回（Cache API）

```js
// 后端 /api/version-check
const cacheKey = new Request('https://internal/version-check', request);
let cached = await caches.default.match(cacheKey);
if (cached) return cached;
const res = await fetch('https://raw.githubusercontent.com/moaradc/cf-todo/main/version.json');
const wrapped = new Response(res.body, { headers: { 'Cache-Control': 'max-age=3600' }});
ctx.waitUntil(caches.default.put(cacheKey, wrapped.clone()));
return wrapped;
```

### 收益估算

| 指标 | 当前 | 改后 |
|---|---|---|
| version check 请求 | 每次打开页面 1 次 | 24h 内 1 次（前端） |
| 后端 GitHub fetch | 每次 version check 1 次 | 1 小时内 1 次（Cache API） |
| 总外部 fetch | ~10-50 次/天/用户 | ~1-2 次/天/用户 |

## 为什么不修改

用户目标：个人群体，100k/day 够用。可能的修改触发条件：
- 用户数增长到团队规模（10+ 活跃用户）
- 引入脚本化高频调用
- 想要更精确的 request 监控

## 参考链接

- [Workers Limits - Daily requests](https://developers.cloudflare.com/workers/platform/limits/#daily-requests)
- [Workers Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit)
- [Rate Limiting Algorithms](https://blog.arcjet.com/rate-limiting-algorithms-token-bucket-vs-sliding-window-vs-fixed-window)
- [MDN: Periodic Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API)
- [Chrome: Periodic Background Sync](https://developer.chrome.com/docs/capabilities/periodic-background-sync)
- [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache)
- [Cache API header requirement](https://community.cloudflare.com/t/cache-put-without-cache-control-header-does-not-cache/447376)
- [Workers KV Limits](https://developers.cloudflare.com/kv/platform/limits/)
