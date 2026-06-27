# 风险 2：D1 queries/invocation 限制

## 状态

**已优化**（批量预取，commit `95ea91d`）

## 问题描述

D1 限制页写「Queries per Worker invocation = 50 (Free)」。原批量接口有逐行查询循环：

- `BATCH_RESTORE`：每个 todo 2 个 query（SELECT existing + SELECT template）
- `BATCH_DELETE`：每个 parent_id 1 个 query（SELECT exdates）
- `BATCH_TOGGLE_DONE + timerRecords`：每个 record 2-4 个 query

N=25 个带循环属性的 todo 就会撞 50 queries 上限。

## 调研发现

### 关键认知更新：实际限制是 1000 不是 50

**D1 文档**（[Limits](https://developers.cloudflare.com/d1/platform/limits/)）：
> Queries per Worker invocation (read subrequest limits): 1000 (Workers Paid) / 50 (Free)

链接指向 Workers subrequest 限制页。

**Workers 文档**（[Limits](https://developers.cloudflare.com/workers/platform/limits/#subrequests)，2026-02-11 更新）：
> Workers on the free plan remain limited to **50 external subrequests and 1000 subrequests to Cloudflare services** per invocation.

**2026-02-11 Changelog**（[Workers are no longer limited to 1000 subrequests](https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/)）：
> Workers no longer have a limit of 1000 subrequests per invocation... Workers on the free plan remain limited to 50 external subrequests and 1000 subrequests to Cloudflare services per invocation.

### D1 batch() 只算 1 个 subrequest

**Reddit 实战案例**（[Using D1 for high-volume text scoring pipeline](https://www.reddit.com/r/CloudFlare/comments/1u5iv7k/)）：
> Because `batch()` only counts as 1 subrequest per chunk, I can sync...

**D1 文档**（[D1Database.batch()](https://developers.cloudflare.com/d1/worker-api/d1-database/)）：
> Sends multiple SQL statements inside a **single call** to the database.

### D1 batch 是真事务

**Reddit/官方确认**：
> If one statement fails, the entire transaction is rolled back.

**限制**（[event-driven.io](https://event-driven.io/en/cloudflare_d1_transactions_and_tradeoffs)）：
> Can't do inside the batch: execute a statement, take a result value, and use it in the next statement.

## 已实现修复（commit `95ea91d`）

### BATCH_RESTORE 批量预取

**原**：逐行 `SELECT existing + SELECT template` = 2N queries

**改后**：
1. 批量 `SELECT templates WHERE parent_id IN (...)`（1 query/分片）
2. `UNION ALL` 一次性查所有 (parent_id, date) 对的 existing（1 query/分片）
3. queries 从 2N+2 降到 ~4

### BATCH_DELETE 批量预取 exdates

**原**：逐 parent `SELECT exdates` = P queries

**改后**：批量 `SELECT exdates WHERE parent_id IN (...)`，queries 从 P 降到 1

### BATCH_TOGGLE_DONE timerRecords 批量预取

**原**：逐条 `SELECT time_records + UPDATE` = 2-4 queries/record

**改后**：
1. 批量预取实例级 + 模板级 time_records
2. Worker 内 merge
3. 分片 UPDATE
4. queries 从 2N+2 降到 ~4

## 评估

### 修复是否必要？

**保守角度**：D1 文档仍挂「50 queries」，可能 D1 层有独立限制。批量预取是防御性优化，值得保留。

**实际角度**：1000 internal subrequests 个人群体根本撞不到。批量预取主要价值是**性能优化**（减少 D1 往返），不是防撞限。

### 性能收益

- D1 query 往返延迟 ~5-50ms/次（看 region）
- N=25 时原方案 ~25 次往返 = 125-1250ms
- 改后 ~4 次往返 = 20-200ms
- **延迟降 80%+**

## 未来改进方向

### 方向 1：进一步用 batch 减少 subrequest

当前批量预取仍用多个 `DB.prepare().all()`。可改为：
```js
const results = await DB.batch([
  DB.prepare('SELECT ... WHERE parent_id IN (...)'),
  DB.prepare('SELECT ... WHERE id IN (...)'),
]);
```
2 个查询合并成 1 个 subrequest。

### 方向 2：D1 Sessions API 读副本

[read replication](https://developers.cloudflare.com/d1/best-practices/read-replication) 在 Free 可用，读查询可路由到副本。详见 [06-d1-single-thread-writes.md](./06-d1-single-thread-writes.md)。

## 参考链接

- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Workers Limits - Subrequests](https://developers.cloudflare.com/workers/platform/limits/#subrequests)
- [2026-02-11 Changelog](https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/)
- [D1 Database API - batch()](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Reddit: D1 high-volume pipeline](https://www.reddit.com/r/CloudFlare/comments/1u5iv7k/)
- [event-driven.io: D1 transactions tradeoffs](https://event-driven.io/en/cloudflare_d1_transactions_and_tradeoffs)
