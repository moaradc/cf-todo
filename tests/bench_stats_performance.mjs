/**
 * stats 查询性能 benchmark
 *
 * 模拟场景：
 * - 1 年（365 天）年度报告
 * - 5 年（1825 天）超范围调用（防御性测试）
 * - 不同数据规模（1k / 5k / 10k / 50k 行）
 *
 * 测量：单条 GROUP BY 查询耗时 + 6 条 batch 总耗时
 * 目标：确认 Free 计划 CPU 10ms 限制下，年度报告是否安全
 *
 * 运行：node tests/bench_stats_performance.mjs
 */

import Database from '/tmp/node_modules/better-sqlite3/lib/index.js';
import path from 'path';
import os from 'os';
import fs from 'fs';

// 复刻 V1 stats 的 baseWhere（优化版，与 src/api-v1.js 生产代码保持同步）
// 优化前：3 个 OR 子句触发 SQLite MULTI-INDEX OR（5 次索引扫描）
// 优化后：合并普通 todo + fragment 已完成，fragment 未完成浮动单独 OR
// 实测 50k 行年度报告：47ms → 13ms（72% 提升），结果完全一致
const baseWhere = `FROM todos WHERE deleted = 0 AND (
  (date >= ? AND date <= ?)
  OR (date = '' AND repeat_type = 'fragment' AND done = 0)
)`;

const queries = [
  // 1) byDate — 2 个 COALESCE 参数 + 6 个 baseWhere = 8 个 ?
  `SELECT COALESCE(NULLIF(date, ''), ?) AS date, COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done ${baseWhere} GROUP BY COALESCE(NULLIF(date, ''), ?)`,
  // 2) byCategory — 6 个 baseWhere
  `SELECT COALESCE(NULLIF(category_id, ''), '') AS category_id, COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done ${baseWhere} GROUP BY COALESCE(NULLIF(category_id, ''), '')`,
  // 3) byPriority x done
  `SELECT priority, done, COUNT(*) AS cnt ${baseWhere} GROUP BY priority, done`,
  // 4) byWeekday x done — 1 个 COALESCE + 6 个 baseWhere = 7 个 ?
  `SELECT CAST(strftime('%w', COALESCE(NULLIF(date, ''), ?)) AS INTEGER) AS weekday, done, COUNT(*) AS cnt ${baseWhere} GROUP BY weekday, done`,
  // 5) byHourBucket
  `SELECT CASE WHEN time IS NULL OR time = '' THEN -1 WHEN CAST(substr(time, 1, 2) AS INTEGER) < 6 THEN 0 WHEN CAST(substr(time, 1, 2) AS INTEGER) < 12 THEN 1 WHEN CAST(substr(time, 1, 2) AS INTEGER) < 18 THEN 2 ELSE 3 END AS bucket, COUNT(*) AS cnt ${baseWhere} GROUP BY bucket`,
  // 6) summary
  `SELECT COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done, SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END) AS undone, COUNT(DISTINCT CASE WHEN date = '' THEN NULL ELSE date END) AS active_days ${baseWhere}`,
];

// 每条查询的参数数量（优化版 baseWhere 2 个 + COALESCE 额外参数）
// byDate: 1 COALESCE + 2 baseWhere + 1 COALESCE = 4
// byCategory: 2 baseWhere = 2
// byPriority: 2 baseWhere = 2
// byWeekday: 1 COALESCE + 2 baseWhere = 3
// byHourBucket: 2 baseWhere = 2
// summary: 2 baseWhere = 2
const queryParamsCount = [4, 2, 2, 3, 2, 2];
function bindParams(stmt, start, end, count) {
  // 优化版 baseWhere 用 ?1 (start) ?2 (end) 绑定，COALESCE 用 ?2 (end)
  // 但 better-sqlite3 用 positional ?，每条查询的 ? 顺序需要跟 SQL 对齐
  // 简化：byDate/byWeekday 的 COALESCE ? 在最前，baseWhere ? 在后
  // 这里按位置精确填充
  return stmt.bind(...buildParamsByPosition(start, end, count));
}

// 根据查询索引精确构造参数（与 queries 数组顺序对齐）
function buildParamsByPosition(start, end, count) {
  // count=4 (byDate): [end, start, end, end]  — COALESCE?, date>=?, date<=?, COALESCE?
  // count=3 (byWeekday): [end, start, end]    — COALESCE?, date>=?, date<=?
  // count=2 (其他): [start, end]              — date>=?, date<=?
  if (count === 4) return [end, start, end, end];
  if (count === 3) return [end, start, end];
  return [start, end];
}

function createDB(numRows) {
  const dbPath = path.join(os.tmpdir(), `cf-todo-bench-${Date.now()}.db`);
  const db = new Database(dbPath);

  // 复刻生产 schema
  db.exec(`
    CREATE TABLE todos (
      id TEXT PRIMARY KEY,
      parent_id TEXT, date TEXT, text TEXT, time TEXT, priority TEXT,
      desc TEXT, url TEXT, copy_text TEXT, subtasks TEXT, search_terms TEXT,
      done INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0,
      repeat_type TEXT DEFAULT 'none', repeat_custom TEXT, repeat_end TEXT,
      end_time TEXT, category_id TEXT, recurrence_id TEXT, is_exception INTEGER,
      repeat_interval INTEGER, time_records TEXT, fragment_anchor TEXT
    );
    CREATE INDEX idx_todos_cursor ON todos(date, deleted, id);
    CREATE INDEX idx_todos_stats ON todos(date, deleted, priority, done, category_id, time);
  `);

  // 插入数据：均匀分布到过去 3 年
  const insert = db.prepare(`INSERT INTO todos (id, parent_id, date, text, time, priority, done, deleted, repeat_type, category_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`);
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(...r);
  });

  const categories = ['cat-a', 'cat-b', 'cat-c', 'cat-d', ''];
  const priorities = ['low', 'med', 'high'];
  const now = Date.now();
  const rows = [];
  for (let i = 0; i < numRows; i++) {
    const daysAgo = Math.floor(Math.random() * 1095); // 0-3年
    const d = new Date(now - daysAgo * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const hour = Math.floor(Math.random() * 24);
    const minute = Math.floor(Math.random() * 60);
    const timeStr = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
    // 90% 普通 todo，10% 碎时记
    const isFragment = Math.random() < 0.1;
    const repeatType = isFragment ? 'fragment' : 'none';
    rows.push([
      `id-${i}`, `id-${i}`, dateStr, `task ${i}`, timeStr,
      priorities[Math.floor(Math.random() * 3)],
      Math.random() < 0.6 ? 1 : 0, // 60% 完成
      repeatType, categories[Math.floor(Math.random() * categories.length)]
    ]);
  }
  insertMany(rows);

  return { db, dbPath };
}

function benchmark(db, start, end, label) {
  // 预热（避免冷启动影响）
  for (let i = 0; i < queries.length; i++) {
    bindParams(db.prepare(queries[i]), start, end, queryParamsCount[i]).all();
  }

  // 测每条查询
  const perQuery = [];
  for (let i = 0; i < queries.length; i++) {
    const t0 = process.hrtime.bigint();
    bindParams(db.prepare(queries[i]), start, end, queryParamsCount[i]).all();
    const t1 = process.hrtime.bigint();
    perQuery.push(Number(t1 - t0) / 1e6); // ms
  }

  // 测 batch 模拟（D1 batch 是顺序执行单次 RPC）
  const t0 = process.hrtime.bigint();
  // D1 batch 在 better-sqlite3 里用 transaction 模拟
  const runAll = db.transaction(() => {
    for (let i = 0; i < queries.length; i++) {
      bindParams(db.prepare(queries[i]), start, end, queryParamsCount[i]).all();
    }
  });
  runAll();
  const t1 = process.hrtime.bigint();
  const totalMs = Number(t1 - t0) / 1e6;

  console.log(`\n[${label}]`);
  console.log(`  范围: ${start} ~ ${end}`);
  perQuery.forEach((ms, i) => {
    const names = ['byDate', 'byCategory', 'byPriority', 'byWeekday', 'byHourBucket', 'summary'];
    console.log(`  ${names[i]}: ${ms.toFixed(2)} ms`);
  });
  console.log(`  总计 (batch 模拟): ${totalMs.toFixed(2)} ms`);
  console.log(`  Free 计划 CPU 10ms 限制: ${totalMs < 10 ? '✓ 安全' : '✗ 超限'}`);
  return totalMs;
}

// ============================================================
// 主测试
// ============================================================
console.log('='.repeat(70));
console.log('stats 查询性能 benchmark');
console.log('='.repeat(70));

const sizes = [1000, 5000, 10000, 50000];
const yearStart = '2026-01-01';
const yearEnd = '2026-12-31';
const fiveYearStart = '2022-01-01';
const fiveYearEnd = '2026-12-31';

const results = [];

for (const size of sizes) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`数据规模: ${size.toLocaleString()} 行 (3 年数据均匀分布)`);
  console.log(`${'='.repeat(70)}`);

  const { db, dbPath } = createDB(size);

  const yearMs = benchmark(db, yearStart, yearEnd, `年度报告 (${yearStart} ~ ${yearEnd})`);
  const fiveYearMs = benchmark(db, fiveYearStart, fiveYearEnd, `5 年范围 (${fiveYearStart} ~ ${fiveYearEnd})`);

  results.push({ size, yearMs, fiveYearMs });

  db.close();
  try { fs.unlinkSync(dbPath); } catch (e) {}
}

// 汇总
console.log(`\n${'='.repeat(70)}`);
console.log('汇总');
console.log(`${'='.repeat(70)}`);
console.log('数据规模  |  年度报告(ms)  |  5年范围(ms)  |  Free 10ms');
console.log('-'.repeat(70));
for (const r of results) {
  const yearOk = r.yearMs < 10 ? '✓' : '✗';
  const fiveOk = r.fiveYearMs < 10 ? '✓' : '✗';
  console.log(`${r.size.toString().padStart(8)}  |  ${r.yearMs.toFixed(2).padStart(11)}  |  ${r.fiveYearMs.toFixed(2).padStart(10)}  |  year:${yearOk} 5y:${fiveOk}`);
}

// 结论
console.log(`\n${'='.repeat(70)}`);
console.log('结论');
console.log(`${'='.repeat(70)}`);
const maxSafeSize = results.filter(r => r.yearMs < 10).pop();
if (maxSafeSize) {
  console.log(`✓ 年度报告在 ${maxSafeSize.size.toLocaleString()} 行数据下仍 < 10ms（Free 计划安全）`);
} else {
  console.log(`✗ 年度报告在所有测试规模下都超 10ms`);
}

const threshold = results.find(r => r.yearMs >= 10);
if (threshold) {
  console.log(`✗ 年度报告在 ${threshold.size.toLocaleString()} 行时超限（${threshold.yearMs.toFixed(2)}ms）`);
  console.log(`  建议优化方向：cache + 物化聚合表`);
} else {
  console.log(`✓ 当前实现已满足 Free 计划，无需优化`);
}

process.exit(0);
