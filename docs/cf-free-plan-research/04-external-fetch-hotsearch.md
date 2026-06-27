# 风险 4：外部 fetch hot-search

## 状态

**不修改**（用户决定）

## 问题描述

`utils.js:100-143` `fetchHotSearchData` 调用外部 API：
```js
const res = await fetch('https://uapis.cn/api/v1/misc/hotboard?type=bilibili');
```

问题：
1. 每次 hot-search 请求消耗 1 个 external subrequest（Free 限 50/invocation）
2. `providers.sort(() => Math.random() - 0.5)` 后可能顺序尝试 4 个 provider，最坏 4 个 subrequest
3. **没有超时**——uapis.cn 慢或挂了，Worker 会一直等
4. 没有 `response.body.cancel()` 释放内存
5. uapis.cn 是第三方非官方 API，稳定性无保障

## 调研发现

### CF Workers fetch 超时

**官方**（[Fetch API](https://developers.cloudflare.com/workers/runtime-apis/fetch)）：
- `AbortController` 和 `AbortSignal` 已支持
- subrequest fetch 90 秒硬超时（[社区确认](https://community.cloudflare.com/t/worker-subrequest-fetch-90-sec-timeout/763362/)）

**用法**：
```js
const ctrl = new AbortController();
const timeoutId = setTimeout(() => ctrl.abort(), 5000);
try {
  const res = await fetch(url, { signal: ctrl.signal });
  // ...
} catch (e) {
  if (e.name === 'AbortError') {
    // 超时降级
  }
} finally {
  clearTimeout(timeoutId);
}
```

### 热搜 API 替代方案

#### RSSHub（推荐，开源稳定）

**GitHub**（[RSSHub](https://github.com/DIYgod/RSSHub)）：
> Everything is RSSible.

提供 bilibili/weibo/zhihu/baidu 等热搜的 RSS 接口，自部署或用公共实例。

**bilibili 热搜路由**（[RSSHub routes](https://github.com/DIYgod/RSSHub/blob/master/lib/routes/bilibili/hot-search.ts)）：
```
https://rsshub.app/bilibili/hot-search
```

**优势**：
- 开源，可自部署
- RSS 格式标准化，解析简单
- 公共实例多，可容灾

**劣势**：
- 公共实例有速率限制
- 需要额外依赖 RSS 解析

#### TikHub.io（商业 API）

**文档**（[TikHub API](https://docs.tikhub.io)）：
> Multi-social media data analysis platform

提供 bilibili/weibo 等热搜的 JSON API，有免费配额。

**劣势**：商业服务，有 API key 依赖。

#### MCP Hot News Server

**Glama**（[mcp-hot-news-server](https://glama.ai/mcp/servers/wudalu/mcp-hot-news-server)）：
> Provides real-time access to Baidu's hot search topics... API connection is noted as potentially unstable.

**劣势**：明确标注「unstable」，不推荐。

### 释放 response.body

**官方建议**（[Simultaneous open connections](https://developers.cloudflare.com/workers/platform/limits/#simultaneous-open-connections)）：
> If you use `fetch()` but do not need the response body, calling `response.body.cancel()` is still good practice to free memory.

```js
const response = await fetch(url);
if (response.status <= 299) {
  const data = await response.json();
} else {
  response.body.cancel();
}
```

### 缓存策略

#### Workers Cache API（Free 可用）

**官方**（[Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache)）：
> The Cache API allows fine grained control of reading and writing from the Cloudflare global network cache.

**注意**（[社区](https://community.cloudflare.com/t/use-a-cf-worker-and-the-cache-api-to-guarantee-cache-hit/488217)）：
> The Cache API does not use Tiered Cache or Cache Reserve, it merely interacts with the local cache.

**用法**：
```js
const cacheKey = new Request('https://internal/hot-search/bilibili', request);
let cached = await caches.default.match(cacheKey);
if (cached) return cached;
const res = await fetch(url);
const wrapped = new Response(res.body, { headers: { 'Cache-Control': 'max-age=3600' }});
ctx.waitUntil(caches.default.put(cacheKey, wrapped.clone()));
return wrapped;
```

**坑**（[社区](https://community.cloudflare.com/t/cant-purge-cloudflare-workers-cache-using-api/39967)）：
> The only way to purge files created by the Workers Cache API is to purge everything in your zone.

适合热搜这种**幂等且能容忍 1 小时延迟**的场景。

#### D1 缓存表

用 D1 settings 表存最近一次热搜结果 + 时间戳，1 小时内不重新拉取。

**优势**：精确失效，跨 isolate 共享。
**劣势**：消耗 D1 配额（虽 Free internal 1000 subrequest 够用）。

## 推荐方案（如要修改）

### 方案 A：AbortController + Cache API + RSSHub（综合）

```js
async function fetchHotSearchData(providerName = 'auto') {
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
      const words = parseRSS(xml); // 解析 RSS 提取标题
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
```

### 收益估算

| 指标 | 当前 | 改后 |
|---|---|---|
| 外部 fetch 次数 | 每次请求 1-4 次 | 1 小时内 1 次（Cache API 命中） |
| 超时风险 | 90s Worker 等待 | 5s 超时降级 |
| 内存泄漏 | response.body 未 cancel | 显式 cancel |
| API 稳定性 | 依赖 uapis.cn | RSSHub 公共实例多 |

## 为什么不修改

用户决定不修改本风险。可能原因：
- hot-search 是辅助功能，挂了不影响核心
- uapis.cn 当前可用，没出问题
- 改用 RSSHub 需要增加 RSS 解析依赖

## 参考链接

- [Workers Fetch API](https://developers.cloudflare.com/workers/runtime-apis/fetch)
- [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache)
- [Worker subrequest 90s timeout](https://community.cloudflare.com/t/worker-subrequest-fetch-90-sec-timeout/763362)
- [AbortController usage](https://community.cloudflare.com/t/timeout-with-fetch/25249)
- [RSSHub](https://github.com/DIYgod/RSSHub)
- [RSSHub bilibili hot-search](https://github.com/DIYgod/RSSHub/blob/master/lib/routes/bilibili/hot-search.ts)
- [TikHub API](https://docs.tikhub.io)
- [Cache API purge limitation](https://community.cloudflare.com/t/cant-purge-cloudflare-workers-cache-using-api/39967)
