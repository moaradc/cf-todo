/**
 * stats 优化方案验证：UNION ALL vs OR 子句
 *
 * 假设：3 个 OR 子句（fragment 特殊处理）破坏 idx_todos_stats 索引使用，
 * 改成 UNION ALL 让每个子句独立走索引，性能应显著提升。
 *
 * 运行：node tests/bench_stats_union_optimization.mjs
 */

import Database from '/tmp/node_modules/better-sqlite3/lib/index.js';
import path from 'path';
import os from 'os';
import fs from 'fs';

// 原版：3 个 OR 子句
const baseWhereOR = `FROM todos WHERE deleted = 0 AND (
  (repeat_type != 'fragment' AND date >= ? AND date <= ?)
  OR (repeat_type = 'fragment' AND done = 1 AND date >= ? AND date <= ?)
  OR (repeat_type = 'fragment' AND done = 0 AND (date = '' OR (date >= ? AND date <= ?)))
)`;

// 优化版：用 UNION ALL 合并 3 个子查询，每个子查询独立走索引
// 注意：fragment 未完成 (date='') 的子句单独处理
const baseWhereUNION = `FROM (
  SELECT * FROM todos WHERE deleted = 0 AND repeat_type != 'fragment' AND date >= ? AND date <= ?
  UNION ALL
  SELECT * FROM todos WHERE deleted = 0 AND repeat_type = 'fragment' AND done = 1 AND date >= ? AND date <= ?
  UNION ALL
  SELECT * FROM todos WHERE deleted = 0 AND repeat_type = 'fragment' AND done = 0 AND (date = '' OR (date >= ? AND date <= ?))
)`;

const queriesOR = [
  `SELECT COALESCE(NULLIF(date, ''), ?) AS date, COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done ${baseWhereOR} GROUP BY COALESCE(NULLIF(date, ''), ?)`,
  `SELECT priority, done, COUNT(*) AS cnt ${baseWhereOR} GROUP BY priority, done`,
];

const queriesUNION = [
  `SELECT COALESCE(NULLIF(date, ''), ?) AS date, COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done ${baseWhereUNION} GROUP BY COALESCE(NULLIF(date, ''), ?)`,
  `SELECT priority, done, COUNT(*) AS cnt ${baseWhereUNION} GROUP BY priority, done`,
];

function createDB(numRows) {
  const dbPath = path.join(os.tmpdir(), `cf-todo-bench-${Date.now()}.db`);
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE todos (
      id TEXT PRIMARY KEY, parent_id TEXT, date TEXT, text TEXT, time TEXT,
      priority TEXT, desc TEXT, url TEXT, copy_text TEXT, subtasks TEXT,
      search_terms TEXT, done INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0,
      repeat_type TEXT DEFAULT 'none', repeat_custom TEXT, repeat_end TEXT, end_time TEXT,
      category_id TEXT, recurrence_id TEXT, is_exception INTEGER, repeat_interval INTEGER,
      time_records TEXT, fragment_anchor TEXT
    );
    CREATE INDEX idx_todos_cursor ON todos(date, deleted, id);
    CREATE INDEX idx_todos_stats ON todos(date, deleted, priority, done, category_id, time);
  `);
  const insert = db.prepare(`INSERT INTO todos (id, parent_id, date, text, time, priority, done, deleted, repeat_type, category_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`);
  const insertMany = db.transaction((rows) => { for (const r of rows) insert.run(...r); });
  const categories = ['cat-a', 'cat-b', 'cat-c', 'cat-d', ''];
  const priorities = ['low', 'med', 'high'];
  const now = Date.now();
  const rows = [];
  for (let i = 0; i < numRows; i++) {
    const daysAgo = Math.floor(Math.random() * 1095);
    const d = new Date(now - daysAgo * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const hour = Math.floor(Math.random() * 24);
    const minute = Math.floor(Math.random() * 60);
    const timeStr = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
    const isFragment = Math.random() < 0.1;
    const repeatType = isFragment ? 'fragment' : 'none';
    rows.push([
      `id-${i}`, `id-${i}`, dateStr, `task ${i}`, timeStr,
      priorities[Math.floor(Math.random() * 3)],
      Math.random() < 0.6 ? 1 : 0, repeatType, categories[Math.floor(Math.random() * categories.length)]
    ]);
  }
  insertMany(rows);
  return { db, dbPath };
}

function bench(db, queries, paramCounts, start, end) {
  // 预热
  for (let i = 0; i < queries.length; i++) {
    const params = [];
    for (let j = 0; j < paramCounts[i]; j++) params.push(j % 2 === 0 ? start : end);
    db.prepare(queries[i]).bind(...params).all();
  }
  // 测
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < queries.length; i++) {
    const params = [];
    for (let j = 0; j < paramCounts[i]; j++) params.push(j % 2 === 0 ? start : end);
    db.prepare(queries[i]).bind(...params).all();
  }
  const t1 = process.hrtime.bigint();
  return Number(t1 - t0) / 1e6;
}

console.log('='.repeat(70));
console.log('UNION ALL vs OR 子句性能对比');
console.log('='.repeat(70));

const sizes = [1000, 5000, 10000, 50000];
const yearStart = '2026-01-01';
const yearEnd = '2026-12-31';

console.log('\n数据规模  |  OR 版 (ms)  |  UNION 版 (ms)  |  提升');
console.log('-'.repeat(70));

for (const size of sizes) {
  const { db, dbPath } = createDB(size);
  // byDate + byPriority 两查询
  const orMs = bench(db, queriesOR, [8, 6], yearStart, yearEnd);
  const unionMs = bench(db, queriesUNION, [8, 6], yearStart, yearEnd);
  const improvement = orMs > 0 ? ((orMs - unionMs) / orMs * 100).toFixed(1) : 'N/A';
  console.log(`${String(size).padStart(8)}  |  ${orMs.toFixed(2).padStart(10)}  |  ${unionMs.toFixed(2).padStart(13)}  |  ${improvement}%`);
  db.close();
  try { fs.unlinkSync(dbPath); } catch (e) {}
}

console.log('\n注意：UNION ALL 版本对每个子查询独立走 idx_todos_stats(date, deleted, ...) 索引，');
console.log('理论上应显著优于 OR 版本。如果 UNION 版本仍慢，说明瓶颈在 GROUP BY 列不在索引前缀。');
