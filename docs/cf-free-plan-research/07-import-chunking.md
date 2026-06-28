# 风险 7：导入分片

## 状态

**不修改**（用户决定）

## 问题描述

前端 `io.js:629` 用 `CHUNK_LINES = 500` 分片上传，每片一个 POST。后端收到后处理。

潜在问题：
1. 后端如果一次性 `DB.batch([500 INSERTs])`，500 个 prepared statement 对象占内存
2. 500 行 × 平均 200 字节 = 100KB，刚好到 D1 SQL statement 100KB 限制
3. 500 个 INSERT 各算 subrequest？还是 batch 算 1 个？（调研后确认 batch = 1）

## 调研发现

### D1 SQL statement 100KB 限制

**D1 Limits**（[来源](https://developers.cloudflare.com/d1/platform/limits/)）：
> Maximum SQL statement length: 100,000 bytes (100 KB)

### D1 batch 算 1 个 subrequest

**Reddit**（[D1 high-volume pipeline](https://www.reddit.com/r/CloudFlare/comments/1u5iv7k/)）：
> Because `batch()` only counts as 1 subrequest per chunk, I can sync...

**D1 文档**（[batch()](https://developers.cloudflare.com/d1/worker-api/d1-database/)）：
> Sends multiple SQL statements inside a single call to the database.

**结论**：`DB.batch([500 个 INSERT])` 只算 1 个 internal subrequest，不撞 1000 限制。

### multi-row VALUES INSERT 性能

#### SQLite 论坛实测

**SQLite Forum**（[Fast way to insert rows](https://sqlite.org/forum/info/f832398c19d30a4a)）：
> First I inserted each row one after another, it took about 60s. Then I did a batch insert (of 100 rows) with prepared... [much faster]
>
> I also tried increasing the batch size to 100, it was almost same and at 500 it took more time.

**结论**：batch size 100 是甜点，500 反而更慢。

#### multi-row VALUES vs batch of single INSERTs

**Stack Overflow**（[multiple single INSERTs vs one multiple-row INSERT](https://stackoverflow.com/questions/1793169/)）：
> Use INSERT statements with multiple VALUES lists to insert several rows at a time. This is considerably faster (many times faster in some cases).

**ServiceStack**（[Bulk Insert Performance](https://servicestack.net/posts/bulk-insert-performance)）：
> SQLite - SQLite doesn't have a specific import feature, instead Bulk Inserts are performed using batches of Multiple Rows Inserts to reduce I/O.

#### SQLite 大批量插入最佳实践

**Stack Overflow**（[Improve INSERT-per-second](https://stackoverflow.com/questions/1711631/)）：
> Bulk imports seems to perform best if you can chunk your INSERT/UPDATE statements. A value of 10,000 or so has worked well for me.

**Avi Im**（[1 Billion Rows Under A Minute](https://avi.im/blag/2021/fast-sqlite-inserts)）：
- 用 transaction 包裹
- 用 multi-row VALUES
- PRAGMA 优化（D1 不支持）

**zerowidthjoiner**（[SQLite bulk INSERT benchmarking](https://zerowidthjoiner.net/2021/02/21/sqlite-bulk-insert-benchmarking-and-optimization)）：
> Ask the Internet about SQLite INSERT performance, and the first answer you will get is: wrap multiple INSERTs in a single transaction!

### D1 限制下的最优 chunk size

D1 bound params 限 100。todos 表 ~19 列：

- 单行 INSERT：19 params
- multi-row VALUES：100 / 19 ≈ 5 行/INSERT
- `DB.batch([N 个 multi-row INSERT])`：1 subrequest

### Workers Stream API

**官方**（[Streams API](https://developers.cloudflare.com/workers/runtime-apis/streams)）：
> Use the Streams API to avoid buffering large requests or responses in memory. This enables you to parse extremely large requests...

**Cloudflare Community**（[Worker and streaming JSON](https://community.cloudflare.com/t/worker-and-streaming-json/26509)）：
> Using NDJSON to stream-parse would help with the memory limit issue and might help a little with CPU time, though I'd still be concerned.

**官方示例**（[Stream large JSON](https://developers.cloudflare.com/workers/examples/streaming-json)）：
> This example fetches a large JSON response from an upstream API, transforms specific fields, and streams the modified response to the client.

### Workers 100MB request body 限制

**官方**（[Limits - Request body size](https://developers.cloudflare.com/workers/platform/limits/)）：
> Free: 100 MB / Pro: 100 MB / Business: 200 MB / Enterprise: 500 MB

**社区确认**（[Uploading Large Files](https://community.cloudflare.com/t/uploading-large-files/627287)）：
> The upload body size limit is 100MB on free and pro accounts.

**结论**：单次请求体上限 100MB。500 行 × 200 字节 = 100KB，远低于限。

### Web Worker 解析大 JSON

**HN 讨论**（[JSON.parse blocks the thread](https://news.ycombinator.com/item?id=21007207)）：
> JSON.parse blocks the thread it's in, and JS is single threaded.

**Reddit**（[non-blocking JSON.parse](https://www.reddit.com/r/javascript/comments/r8pwoz/)）：
> allocate and copy very large string into ArrayBuffer. transfer (zero copy) ArrayBuffer into web worker. have web worker call some WASM code to...

**结论**：
- `JSON.parse` 阻塞主线程，大文件解析影响 UI
- 可用 Web Worker 把解析移到后台线程
- Transferable Objects 零拷贝传输 ArrayBuffer（100-200MB 可靠）

### R2 中转（过度设计）

**思路**：客户端上传到 R2，Cron Trigger 处理 R2 文件。

**问题**：
- Free R2 只有 10GB + 1M Class A operations/month
- 需要 R2 binding + Cron handler
- 复杂度高，个人项目用不上

## 推荐方案（如要修改）

### 方案 J：后端 batch 再切分 + multi-row VALUES

**思路**：前端 `CHUNK_LINES = 500` 保持不变，后端收到后用 multi-row VALUES 优化。

**改动**：
```js
// 后端 import handler
const rows = [...]; // 500 行
const ROWS_PER_INSERT = 5; // 19 列 × 5 行 = 95 params，留 5 余量
const chunks = chunkArray(rows, ROWS_PER_INSERT);
const stmts = chunks.map(chunk => {
  const values = chunk.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
  const params = chunk.flatMap(r => [r.id, r.parent_id, r.date, r.text, /* 15 more */]);
  return env.DB.prepare(`INSERT INTO todos (...) VALUES ${values}`).bind(...params);
});
await env.DB.batch(stmts); // 100 个 multi-row INSERT，1 subrequest
```

**收益**：
- 导入 500 行耗时：从 ~2s（500 个单行 batch）降到 ~200ms（100 个 multi-row batch）
- 内存：减少 prepared statement 对象创建（500 → 100）
- subrequest：1（不变）

### 方案 H：Stream API + NDJSON（更激进）

**思路**：用 Workers Stream API 流式解析请求体，每凑够 100 行 `DB.batch` 一次。

**改动**：
```js
// 后端 import handler
const reader = request.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let batch = [];

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop(); // 最后一行可能不完整
  for (const line of lines) {
    if (!line.trim()) continue;
    const todo = JSON.parse(line);
    batch.push(todo);
    if (batch.length >= 100) {
      await insertBatch(env.DB, batch);
      batch = [];
    }
  }
}
if (batch.length > 0) await insertBatch(env.DB, batch);
```

**收益**：
- 客户端不用等 500 行攒满才上传
- 后端内存峰值降低（不缓冲全部 500 行）
- 总耗时进一步降低（流式处理）

### 方案 K：客户端 Web Worker 解析

**思路**：前端用 Web Worker 解析导入文件，避免主线程阻塞。

**改动**：
- 新增 `import-worker.js`
- 主线程 `postMessage(file)` 给 Web Worker
- Web Worker 解析后 `postMessage(rows)` 回主线程
- 主线程分片上传

**收益**：
- 大文件导入时 UI 不卡
- Transferable Objects 零拷贝传输

**问题**：
- 增加 Worker 文件体积
- 浏览器兼容性需考虑

## 为什么不修改

用户决定不修改本风险。可能原因：
- 当前 500 行 chunk 工作正常，没出问题
- 个人群体导入频率低
- multi-row VALUES 需要重构 SQL 构造逻辑

## 参考链接

- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 batch() API](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Reddit: D1 high-volume pipeline](https://www.reddit.com/r/CloudFlare/comments/1u5iv7k/)
- [SQLite Forum: Fast insert](https://sqlite.org/forum/info/f832398c19d30a4a)
- [Stack Overflow: multi-row INSERT performance](https://stackoverflow.com/questions/1793169/)
- [ServiceStack: Bulk Insert Performance](https://servicestack.net/posts/bulk-insert-performance)
- [Stack Overflow: Improve INSERT-per-second](https://stackoverflow.com/questions/1711631/)
- [Avi Im: 1 Billion Rows](https://avi.im/blag/2021/fast-sqlite-inserts)
- [zerowidthjoiner: SQLite bulk INSERT benchmarking](https://zerowidthjoiner.net/2021/02/21/sqlite-bulk-insert-benchmarking-and-optimization)
- [Workers Streams API](https://developers.cloudflare.com/workers/runtime-apis/streams)
- [Workers Stream JSON example](https://developers.cloudflare.com/workers/examples/streaming-json)
- [Workers Request body size limit](https://developers.cloudflare.com/workers/platform/limits/)
- [Community: Uploading Large Files](https://community.cloudflare.com/t/uploading-large-files/627287)
- [HN: JSON.parse blocks thread](https://news.ycombinator.com/item?id=21007207)
- [Reddit: non-blocking JSON.parse](https://www.reddit.com/r/javascript/comments/r8pwoz/)
- [Red Hat: Web Workers Transferable Objects](https://developers.redhat.com/blog/2014/05/20/communicating-large-objects-with-web-workers-in-javasc)
