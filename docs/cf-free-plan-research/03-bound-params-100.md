# 风险 3：Bound parameters 100

## 状态

**已修复**（`BATCH_CHUNK_SIZE` 100 → 99，commit `95ea91d`）

## 问题描述

D1 Free 限制「Maximum bound parameters per query = 100」。

当前部分 SQL 含额外参数：
- `UPDATE todos SET done = 1, date = ? WHERE id IN (${ph}) AND done = 0` → 1 + 100 = 101 参数 ❌
- `UPDATE todos SET done = 0, date = fragment_anchor, time_records = ? WHERE id IN (${ph})` → 1 + 100 = 101 ❌
- `UPDATE todos SET done = 0, time_records = ? WHERE id IN (${ph})` → 1 + 100 = 101 ❌

`BATCH_CHUNK_SIZE = 100` 刚好等于限制，但带额外参数的 SQL 在 chunk 满时会触发 D1 "too many parameters" 错误。

## 调研发现

### 官方限制

**D1 Limits**（[来源](https://developers.cloudflare.com/d1/platform/limits/)）：
> Maximum bound parameters per query: 100

### 不能绕过

**Stack Overflow**（[Cloudflare D1 Bulk Insert](https://stackoverflow.com/questions/78337901/cloudflare-d1-sql-lite-bulk-insert)）：
> Cloudflare limits the params size (Maximum bound parameters per query) to 100. So we have to split values into chunks.

**rxliuli.com**（[Journey to Optimize D1](https://rxliuli.com/blog/journey-to-optimize-cloudflare-d1-database-queries)）：
> SQLite and D1 limit the number of bound parameters to 100 per query. With 10 columns, we can insert at most 10 rows per SQL statement.

### multi-row VALUES 也受限

`INSERT INTO t VALUES (?,?,?),(?,?,?)` 的占位符总数仍计入 100 限制。10 列时 1 个 INSERT 最多 10 行。

## 已实现修复

### 改动

`api-v1.js:27` 和 `api.js:36`：
```js
// D1 Free 限制 bound parameters/query = 100，部分 SQL 含额外参数（date/time_records），
// 留 1 个余量，chunk size 设为 99 防止 100+1=101 溢出。
const BATCH_CHUNK_SIZE = 99;
```

### 验证

- chunk 满 99 时，带 1 个额外参数的 SQL = 99+1=100，正好到限
- 不带额外参数的 SQL = 99，留 1 余量
- 实测 105 条批量操作分 2 片（99+6），第 1 片 99 条 + 1 额外参数 = 100，通过

## 未来改进方向

### 方向 1：multi-row VALUES INSERT（性能优化）

虽不能绕过 100 params 限，但比 `DB.batch([N 个单行 INSERT])` 快很多。

**SQLite 论坛实测**（[Fast way to insert rows in SQLite](https://sqlite.org/forum/info/f832398c19d30a4a)）：
> First I inserted each row one after another, it took about 60s. Then I did a batch insert (of 100 rows) with prepared... [much faster]

**Stack Overflow**（[multiple single INSERTs vs one multiple-row INSERT](https://stackoverflow.com/questions/1793169/)）：
> Use INSERT statements with multiple VALUES lists to insert several rows at a time. This is considerably faster (many times faster in some cases).

**做法**：
- 10 列 × 10 行 = 100 params，正好到限
- `DB.batch([50 个 multi-row INSERT])` 只算 1 subrequest
- 性能提升 5-10x

详见 [07-import-chunking.md](./07-import-chunking.md)。

### 方向 2：保守降低 chunk size

如担心 D1 未来收紧限制，可改 `BATCH_CHUNK_SIZE = 95` 留 5 个余量。但当前 99 已验证可用，不必调整。

## 参考链接

- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Stack Overflow: D1 Bulk Insert](https://stackoverflow.com/questions/78337901/cloudflare-d1-sql-lite-bulk-insert)
- [Journey to Optimize D1 Queries](https://rxliuli.com/blog/journey-to-optimize-cloudflare-d1-database-queries)
- [SQLite Forum: Fast insert](https://sqlite.org/forum/info/f832398c19d30a4a)
- [Stack Overflow: multi-row INSERT performance](https://stackoverflow.com/questions/1793169/)
