# Cloudflare Free 计划优化调研总览

## 背景

cf-todo 部署在 Cloudflare Workers Free + D1 Free 上。Free 计划有多项硬限制，需要审视当前实现并寻找更好的解决方案。

本文档汇总 7 个风险的完整调研结果，包括已实现修复和未实现方案。

## Free 计划硬限制速查

### Workers Free

| 限制 | 阈值 | 来源 |
|---|---|---|
| Requests / day | 100,000 | [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/) |
| **CPU time / HTTP request** | **10 ms** | 同上 |
| Memory / isolate | 128 MB | 同上 |
| External subrequests / invocation | 50 | [2026-02-11 Changelog](https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/) |
| **Internal subrequests / invocation** | **1000** | 同上（重大变更） |
| Simultaneous open connections | 6 | Workers Limits |
| Worker size (gzip) | 3 MB | 同上 |
| Worker startup time | 1 秒 | 同上 |
| Env variables / Worker | 64 | 同上 |

### D1 Free

| 限制 | 阈值 | 来源 |
|---|---|---|
| **Queries / Worker invocation** | **50（文档）/ 1000（实际）** | [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/) |
| Database size | 500 MB | 同上 |
| Storage / account | 5 GB | 同上 |
| **Bound parameters / query** | **100** | 同上 |
| SQL statement length | 100 KB | 同上 |
| Row size (string/BLOB) | 2 MB | 同上 |
| SQL query duration | 30 秒 | 同上 |
| Databases / account | 10 | 同上 |
| Time Travel 保留 | 7 天 | 同上 |
| Concurrent connections / invocation | 6 | 同上 |

### 关键认知更新（2026-02-11）

1. **Internal subrequest 限制从 50 提升到 1000**——D1/KV/R2 等 Cloudflare 内部服务调用算 internal
2. **D1 `DB.batch([N statements])` 只算 1 个 internal subrequest**——不是 N 个
3. **D1 限制页的「50 queries/invocation」可能过时**——链接指向 Workers subrequest 限制页，而该页已更新为 1000 internal
4. 保守起见，仍假设 D1 层可能独立限制 50 queries/invocation

## 7 个风险概览

| # | 风险 | 严重度 | 状态 | 详细文档 |
|---|---|---|---|---|
| 1 | CPU time 10ms vs 重复任务展开 | 🔴 高 | 不修改（用户决定） | [01-cpu-time-recurring.md](./01-cpu-time-recurring.md) |
| 2 | D1 queries/invocation 限制 | 🟠 中 | 已优化（批量预取） | [02-d1-queries-limit.md](./02-d1-queries-limit.md) |
| 3 | Bound parameters 100 | 🔴 高 | 已修复（chunk 99） | [03-bound-params-100.md](./03-bound-params-100.md) |
| 4 | 外部 fetch hot-search | 🟠 中 | 不修改（用户决定） | [04-external-fetch-hotsearch.md](./04-external-fetch-hotsearch.md) |
| 5 | requests/day 100k | 🟡 低 | 不修改（用户决定，个人群体够用） | [05-requests-per-day.md](./05-requests-per-day.md) |
| 6 | D1 单库单线程写串行 | 🟠 中 | 已优化（fragment/plain 并发） | [06-d1-single-thread-writes.md](./06-d1-single-thread-writes.md) |
| 7 | 导入分片 | 🟡 低 | 不修改（用户决定） | [07-import-chunking.md](./07-import-chunking.md) |

## 已实现修复（fix/robustness-validation 分支）

| Commit | 内容 |
|---|---|
| `523f4d2` | v1 批量接口自动分片 + 修复 fragmentIdSet 拼写 bug |
| `9c36974` | v0 批量接口同步自动分片 |
| `7727e82` | 前端 XSS 防护 + 批量操作错误处理 |
| `47720f6` | 修复 template literal 转义导致正则解析失败 |
| `bcb861e` | v1 批量接口 affected/deleted/restored 返回真实改动行数 |
| `95ea91d` | 批量接口适配 CF Free 计划限制（chunk 99 / 批量预取 / 并发） |

## 未实现方案（按 ROI 排序）

| 优先级 | 风险 | 方案 | 改动量 | 预期收益 |
|---|---|---|---|---|
| ★★★★★ | 1 | A（v1 不展开）+ D（v0 KV 缓存 60s） | 中 | v1 CPU 降 90%；v0 D1 调用降 90% |
| ★★★★ | 6 | D1 read replica + Sessions API | 小 | 读延迟降 95% |
| ★★★★ | 5 | F（localStorage 24h）+ Cache API | 小 | version check 请求降 99% |
| ★★★ | 7 | J + multi-row VALUES | 中 | 导入 5-10x 加速 |
| ★★ | 1 | B（Cron 预生成） | 大 | 完全消除 RRULE 计算 |
| ★ | 1 | C（Materialized View） | 极大 | 架构改造 |

## 调研方法

- 阅读 CF 官方文档（Workers Limits / D1 Limits / 2026-02-11 Changelog）
- 网络搜索实战案例（Reddit / Stack Overflow / Cloudflare Community）
- 交叉验证限制数值（D1 文档 vs Workers 文档 vs Changelog）
- 评估每个方案的 Free 计划可用性、改动量、收益

## 调研时间

2026-06-27

## 参考链接

- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [2026-02-11 Subrequests Limit Changelog](https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/)
- [D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [D1 Read Replication](https://developers.cloudflare.com/d1/best-practices/read-replication)
- [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache)
- [Durable Objects Free Tier (2025-04-07)](https://developers.cloudflare.com/changelog/post/2025-04-07-durable-objects-free-tier)
