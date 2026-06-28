# 风险 6：D1 单库单线程写串行

## 状态

**已优化**（fragment/plain 并发，commit `95ea91d`）

## 问题描述

D1 单库单线程，写操作必须串行。文档说明：

**D1 FAQ**（[Limits](https://developers.cloudflare.com/d1/platform/limits/)）：
> Each individual D1 database is inherently single-threaded, and processes queries one at a time.
>
> Your maximum throughput is directly related to the duration of your queries.
> - If your average query takes 1 ms, you can run approximately 1,000 queries per second.
> - If your average query takes 100 ms, you can run 10 queries per second.
>
> A database that receives too many concurrent requests will first attempt to queue them. If the queue becomes full, the database will return an "overloaded" error.

**底层**（[D1 read replication blog](https://blog.cloudflare.com/d1-read-replication-beta)）：
> Each individual D1 database is backed by a single Durable Object.

当前 `BATCH_TOGGLE_DONE` 4 个串行 for 循环（fragment 完成 + plain 完成），每个 chunk 顺序 await，总 SQL time 累加。

## 调研发现

### D1 Sessions API + read replica（Free 可用）

**官方**（[D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing)）：
> Read replication does not charge extra for read.

**官方**（[Global read replication](https://developers.cloudflare.com/d1/best-practices/read-replication)）：
> D1 read replication can lower latency for read queries and scale read throughput by adding read-only database copies, called read replicas, across regions.
>
> To use read replication, you must use the D1 Sessions API, otherwise all queries will continue to be executed only by the primary database.

**实战案例**（[Jack Pearce: 95.7% Faster](https://www.jackpearce.co.uk/posts/improving-api-response-times-using-d1-global-read-replication)）：
> Enabling Cloudflare D1 global read replication reduced cumulative D1 read latency from 1800ms to 78ms for users in Australia - a 95.7% improvement.

**重要限制**：
- 只对**读**有帮助，**写仍走 primary 单线程**
- 必须用 Sessions API，否则不路由到 replica

#### 配置

**wrangler.toml**：
```toml
[[d1_databases]]
binding = "DB"
database_name = "cf-todo"
database_id = "xxx"
read_replication = true
```

**代码**：
```js
// 读查询用 session（路由到副本）
const session = env.DB.withSession('first-primary');
const result = await session.prepare('SELECT ...').all();

// 写查询用原 binding（走 primary）
await env.DB.prepare('UPDATE ...').run();
```

#### Session 策略

| 策略 | 行为 |
|---|---|
| `first-primary` | 第一个查询走 primary，后续走 replica（适合读多写少） |
| `replica-only` | 全走 replica（适合纯读） |
| `primary-only` | 全走 primary（强一致） |

### Durable Objects Free 已开放

**2025-04-07 Changelog**（[Durable Objects Free Tier](https://developers.cloudflare.com/changelog/post/2025-04-07-durable-objects-free-tier)）：
> Durable Objects can now be used with zero commitment on the Workers Free plan.

**Pricing**（[Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing)）：
- Free: 100,000 requests/day + 400,000 GB-s memory
- 与 Workers 100k requests 共享配额

#### 可用于写串行化队列

**思路**：所有写操作发到 DO，DO 内排队执行。

```js
// DO class
export class D1WriteQueue {
  async fetch(request) {
    const op = await request.json();
    // 串行执行
    const result = await this.env.DB.prepare(op.sql).bind(...op.params).run();
    return Response.json(result);
  }
}
```

**问题**：
- DO 单实例 1000 QPS 软限（[Limits](https://developers.cloudflare.com/durable-objects/platform/limits)）
- 复杂度极高，需要 DO class 定义 + binding 配置
- DO 请求消耗 Workers 配额
- 个人项目过度设计

### Workers KV 读写分离

**思路**：读走 KV（缓存），写走 D1。

**问题**：
- KV 1,000 writes/day 限制（Free）
- 不适合频繁变更的数据
- 一致性问题（KV 全球传播 ~60s）

### D1 batch 是真事务

**Reddit**（[Does Cloudflare support transactions](https://www.reddit.com/r/CloudFlare/comments/1nzxdro/)）：
> Yes, you can do that with batch(). If one statement fails, the entire transaction is rolled back. What you can't do inside the batch is execute a statement, take a result value...

**event-driven.io**（[D1 transactions tradeoffs](https://event-driven.io/en/cloudflare_d1_transactions_and_tradeoffs)）：
> D1 does not support SQL transactions (BEGIN/COMMIT/ROLLBACK/SAVEPOINT). Use { mode: "session_based" } to opt-in to session+batch semantics.

**结论**：
- `DB.batch([...])` 是原子的（全成功或全回滚）
- 但 batch 内不能拿上一条结果做下一条条件
- 适合「全或无」操作（如导入、批量更新）

## 已实现修复（commit `95ea91d`）

### fragment/plain 并发

**原**：4 个串行 for 循环
```js
for (chunk of fragmentIds) await DB.prepare(...).run();  // 等完
for (chunk of plainIds) await DB.prepare(...).run();      // 再等
```

**改后**：`Promise.all` 并发
```js
const runFragment = async () => { for (chunk of fragmentIds) await DB.prepare(...).run(); };
const runPlain = async () => { for (chunk of plainIds) await DB.prepare(...).run(); };
await Promise.all([runFragment(), runPlain()]);
```

### 收益

- D1 单库单线程，并发只是减少 Worker 端 await 等待
- 总耗时从 `fragment_time + plain_time` 降到 `max(fragment_time, plain_time)`
- 6 simultaneous connections 限内，2 个并发安全

## 推荐方案（如要进一步优化）

### 方案 A：启用 D1 read replica + Sessions API

**改动量**：小
1. `wrangler.toml` 加 `read_replication = true`
2. 读查询改用 `env.DB.withSession('first-primary')`

**收益**：
- 读延迟降 95%+（澳洲案例 1800ms→78ms）
- 写吞吐不变（仍 primary 单线程）
- Free 可用，无额外费用

### 方案 B：Durable Objects 写队列（不推荐）

**改动量**：大
- 新增 DO class
- 所有写操作改走 DO
- DO 内串行化

**收益**：写吞吐可控，避免 D1 overloaded 错误

**问题**：过度设计，个人项目用不上

## 为什么不进一步修改

已实现 fragment/plain 并发（方案 A 的一部分）。未启用 read replica 的原因可能：
- 当前读延迟可接受
- 增加 Sessions API 调用复杂度
- 个人群体撞不到 D1 overloaded

## 参考链接

- [D1 Limits - Concurrency](https://developers.cloudflare.com/d1/platform/limits/#concurrency-and-throughput)
- [D1 Read Replication Blog](https://blog.cloudflare.com/d1-read-replication-beta)
- [D1 Read Replication Docs](https://developers.cloudflare.com/d1/best-practices/read-replication)
- [Jack Pearce: 95.7% Faster with read replication](https://www.jackpearce.co.uk/posts/improving-api-response-times-using-d1-global-read-replication)
- [Durable Objects Free Tier Changelog](https://developers.cloudflare.com/changelog/post/2025-04-07-durable-objects-free-tier)
- [Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing)
- [Durable Objects Limits](https://developers.cloudflare.com/durable-objects/platform/limits)
- [D1 batch transactions](https://www.reddit.com/r/CloudFlare/comments/1nzxdro/)
- [event-driven.io: D1 transactions tradeoffs](https://event-driven.io/en/cloudflare_d1_transactions_and_tradeoffs)
- [Workers KV Limits](https://developers.cloudflare.com/kv/platform/limits/)
