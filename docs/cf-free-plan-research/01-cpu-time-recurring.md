# 风险 1：CPU time 10ms vs 重复任务展开

## 状态

**不修改**（用户决定）

## 问题描述

`GET /api/v1/todos?date=X` 和 `GET /api/todos?date=X`（v0）在 Worker 内做：

1. `SELECT * FROM todos WHERE date = X`（~1ms SQL + ~0.5ms CPU 序列化）
2. `SELECT * FROM todo_templates WHERE repeat_type IN (...) AND anchor_date <= X`（~1ms）
3. **对每个模板在 Worker 内跑 `isOccurrenceOnDate()`（RRULE 计算）**——CPU 大户
4. 批量 `DB.batch([INSERT...])` 写入新实例

模板数量大时（用户有 50+ 重复规则），第 3 步 CPU time 容易超 10ms，触发 1102 错误。

## Free 计划 CPU time 限制

- **HTTP request**: 10 ms CPU time
- **Cron Trigger**: 10 ms CPU time（< 1h interval）/ 15 min（>= 1h interval）
- CPU time 不含 I/O 等待（fetch/D1 query 等待不计）
- 超限直接 1102 错误，**无法 catch**

来源：[Workers Limits - CPU time](https://developers.cloudflare.com/workers/platform/limits/#cpu-time)

## 调研的方案

### 方案 A：客户端算 RRULE（v1 API）

**思路**：v1 API 是程序化接口，调用方本来就有计算能力。让 API 只返回模板 + 当前实例，调用方自己算。

**改动**：
- v1 GET 新增 `?expand=false`（默认）参数
- 只返回当前 date 的 todos + 所有 active templates
- 调用方拿 templates 后自己用 ical.js / rrule.js 算
- 旧 `?expand=true` 保留但加 `CPU time warning` header

**收益**：
- Worker CPU ≈ 0（只 2 个 SELECT）
- 10ms 永远够
- 与 Google Tasks API 行为一致

**适合**：v1 API（程序调用方）
**不适合**：v0 前端（前端 ical.js 计算量大可能卡 UI）

### 方案 B：Cron Trigger 预生成

**思路**：用 Cron Trigger 每天 00:05 UTC 预生成当天所有重复实例，写入 D1。GET 接口只查 date=X 一次 SELECT。

**改动**：
- 新增 `scheduled()` handler，每天跑一次
- Cron 内循环所有模板，计算当天是否需要实例，批量 INSERT
- Cron CPU 限 10ms（Free），但可以分批跑（用 `ctx.waitUntil` 延续）

**问题**：
- Cron 也是 10ms CPU（Free），大量模板时一样撞限
- 需要「断点续跑」机制（记录上次处理到哪个模板）
- 时区问题（UTC 00:05 ≠ 用户本地 00:00）

**调研来源**：
- [Graphile Worker crontab 模式](https://worker.graphile.org/docs/cron)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

### 方案 C：Materialized View 模式（Google Calendar 架构）

**思路**：分离「事件存储」（模板 + RRULE）和「事件索引」（预计算的实例表）。每次创建/修改模板时同步生成未来 N 天的实例。

**改动**：
- 新表 `todo_instances(id, template_id, date, ...)`
- 创建模板时 INSERT 未来 90 天的实例
- 修改/删除模板时 UPDATE/DELETE 对应实例
- GET 只查 `todo_instances WHERE date = X`（单次 SELECT，无 RRULE 计算）

**收益**：GET 接口 O(1)，CPU ≈ 0

**问题**：
- 数据冗余（一个模板 → 90 个实例）
- 修改模板时要级联更新（复杂）
- 90 天外的实例看不到（边界问题）

**调研来源**：
- [Google Calendar 架构分析](https://snowan.gitbook.io/study-notes/ai-blogs/design-google-calendar)：「Separate event storage from event indexing」

### 方案 D：3 层缓存（KV + 内存 + D1）

**思路**：GET /api/todos?date=X 的结果缓存到 KV（TTL 60s），同 date 的请求直接走 KV 不查 D1。

**改动**：
- KV key: `todos:{date}:{userId}`，value: JSON，TTL 60s
- 写操作（CREATE/UPDATE/DELETE）后 `ctx.waitUntil(KV.delete(key))` 异步失效
- Free KV：100,000 reads/day + 1,000 writes/day

**收益**：
- GET 接口 90%+ 不查 D1（命中缓存）
- CPU time 降到接近 0（KV 读 ~5ms wall，几乎 0 CPU）
- 60s TTL 在个人/小团队场景下用户感知不明显

**问题**：
- 1,000 writes/day 限制——每次写操作都要失效缓存，1k 写/天对个人够用
- 多用户并发写时短暂不一致（60s 内）

**调研来源**：
- [3-tier cache with KV](https://zenn.dev/jphfa/articles/cloudflare-d1-three-tier-cache?locale=en)（87% D1 row read 减少）
- [Workers KV Limits](https://developers.cloudflare.com/kv/platform/limits/)

### 方案 E：rrule.js cache 选项（增量优化）

**思路**：rrule.js 支持 `cache: true`，复用同一 rrule 实例可缓存计算结果。

**改动**：
- Worker 全局缓存 rrule 实例（按 parent_id）
- 同 date 多次请求复用计算结果

**问题**：
- Worker isolate 可能随时被回收，缓存命中率不稳
- 仍是 Worker 内计算，CPU time 不降

**调研来源**：
- [rrule.js GitHub](https://github.com/jkbrzt/rrule)：「RRuleSet default noCache argument」
- [dateutil rrule](https://dateutil.readthedocs.io/en/stable/rrule.html)：「support for caching the results」

### 方案 F：WebAssembly 计算 RRULE

**思路**：用 Rust/C++ 编译 WASM 跑 RRULE，比 JS 快。

**问题**：
- CF Workers 支持 WASM，但启动开销大
- 实测：「2.5-3s extra time per request」（moderate sized wasm）
- 反而更慢，且 Free 10ms CPU 不够 WASM 启动

**调研来源**：
- [Cloudflare Workers WASM slow](https://community.cloudflare.com/t/fixed-cloudflare-workers-slow-with-moderate-sized-webassembly-bin/)：「2.5 to 3s extra time per request」
- [Reality check for Wasm Workers](https://nickb.dev/blog/reality-check-for-cloudflare-wasm-workers-and-rust)
- [HN: WebAssembly on Workers](https://news.ycombinator.com/item?id=18113129)：「introducing WebAssembly paradoxically creates more demand to increase CPU time limits」

## 推荐方案

**A + D 组合**：
- v1 API 加 `?expand=false` 默认参数（方案 A）
- v0 前端加 KV 缓存 60s（方案 D）
- 不用 Cron（Free 也是 10ms CPU）和 Materialized View（改动太大）
- 不用 WASM（启动开销反而更慢）

## 收益估算

| 指标 | 当前 | 改后 |
|---|---|---|
| v1 GET CPU time | 5-8ms（含 RRULE） | ~1ms（纯 SELECT） |
| v0 GET D1 查询 | 每次都查 | 90%+ 命中 KV |
| KV 配额消耗 | - | 100k reads + 1k writes/day（Free 够用） |

## 为什么不修改

用户决定不修改本风险。可能原因：
- 个人群体模板数量少，当前 CPU time 在限内
- 修改涉及 v1 API 行为变更，影响调用方
- KV 缓存引入一致性问题，增加复杂度
