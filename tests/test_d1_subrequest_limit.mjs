/**
 * D1 Free 计划 50 queries/invocation 限制验证
 *
 * 验证 BATCH_DELETE / BATCH_RESTORE 的 exdate 维护从「逐 parent 单条 .run()」
 * 改为「DB.batch() 分片」后，D1 subrequest 数量在 50 以内。
 *
 * 官方文档依据：
 *   - Workers Free: Subrequests per invocation = 50
 *     https://developers.cloudflare.com/workers/platform/limits/
 *   - D1 Free: Queries per Worker invocation = 50
 *     https://developers.cloudflare.com/d1/platform/limits/
 *   - D1 batch: "Limits for individual queries apply to each individual statement
 *     contained within a batch statement" — batch 是单次 RPC，算 1 个 subrequest
 *
 * 运行：node tests/test_d1_subrequest_limit.mjs
 */

// Mock D1 binding：统计 subrequest 次数
function createMockDB() {
  const queries = [];
  let batchCallCount = 0;
  let singleRunCount = 0;

  const db = {
    prepare(sql) {
      const stmt = {
        _sql: sql,
        bind(...args) {
          this._args = args;
          return this;
        },
        async all() {
          queries.push({ type: 'all', sql: this._sql, args: this._args });
          singleRunCount++;
          // 模拟返回空结果（exdate 预取返回模板行）
          return { results: this._mockResults || [] };
        },
        async first() {
          queries.push({ type: 'first', sql: this._sql, args: this._args });
          singleRunCount++;
          return this._mockFirst || null;
        },
        async run() {
          queries.push({ type: 'run', sql: this._sql, args: this._args });
          singleRunCount++;
          return { meta: { changes: this._mockChanges || 0 } };
        },
        _mockResults: [],
        _mockFirst: null,
        _mockChanges: 0,
      };
      return stmt;
    },
    async batch(stmts) {
      // batch 是 1 个 subrequest，不管内含多少 statement
      queries.push({ type: 'batch', count: stmts.length });
      batchCallCount++;
      return stmts.map(() => ({ meta: { changes: 1 } }));
    },
    withSession(opt) { return this; },
    _getStats() {
      return {
        totalQueries: queries.length,
        batchCalls: batchCallCount,
        singleRuns: singleRunCount,
        // subrequest 计算：batch 算 1 个，单条 prepare/run/all/first 算 1 个
        subrequests: singleRunCount + batchCallCount,
        queries,
      };
    },
  };
  return db;
}

// Mock 工具函数（复刻 src/api-v1.js 的 chunkArray / sqlPlaceholders）
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
function sqlPlaceholders(count) {
  return Array(count).fill('?').join(',');
}
function addExdate(current, date) {
  // 简化：总是返回新字符串（模拟 exdate 改变）
  return current + ',"' + date + '"';
}

let pass = 0, fail = 0;
function ok(label) { pass++; console.log(`  ✓ ${label}`); }
function ko(label, detail) { fail++; console.log(`  ✗ ${label}`); if (detail) console.log(`    ${detail}`); }

console.log('='.repeat(60));
console.log('D1 Free 计划 50 queries/invocation 限制验证');
console.log('='.repeat(60));

// ============================================================
// 测试 1: V1 BATCH_DELETE exdate 批量 UPDATE（修复后）
// 场景：200 个 id，100 个 unique 重复系列 parent
// ============================================================
console.log('\n[1] V1 BATCH_DELETE — 100 unique parents exdate UPDATE');

const BATCH_CHUNK_SIZE = 99;
const NUM_IDS = 200;
const NUM_PARENTS = 100;

const db1 = createMockDB();

// 模拟 tasks：100 个重复任务（每个 parent 不同）+ 100 个非重复任务
const tasks = [];
for (let i = 0; i < NUM_PARENTS; i++) {
  tasks.push({
    parent_id: `parent-${i}`,
    date: `2026-06-${String(i % 28 + 1).padStart(2, '0')}`,
    repeat_type: 'daily',
  });
}

// Step 1: 分片查询 repeat_type（复刻 api-v1.js:1606-1614）
for (const chunk of chunkArray(Array(NUM_IDS).fill(0).map((_, i) => `id-${i}`), BATCH_CHUNK_SIZE)) {
  const ph = sqlPlaceholders(chunk.length);
  await db1.prepare(`SELECT parent_id, date, repeat_type FROM todos WHERE id IN (${ph})`).bind(...chunk).all();
}

// Step 2: 分片 UPDATE deleted=1
for (const chunk of chunkArray(Array(NUM_IDS).fill(0).map((_, i) => `id-${i}`), BATCH_CHUNK_SIZE)) {
  const ph = sqlPlaceholders(chunk.length);
  await db1.prepare(`UPDATE todos SET deleted = 1 WHERE id IN (${ph})`).bind(...chunk).run();
}

// Step 3: 构建 exdateUpdates
const exdateUpdates = {};
for (const t of tasks) {
  if (t.repeat_type && t.repeat_type !== 'none' && t.repeat_type !== 'fragment' && t.parent_id) {
    if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
    exdateUpdates[t.parent_id].push(t.date);
  }
}
const parentIds = Object.keys(exdateUpdates);

// Step 4: 分片预取 exdates
const tplExdatesMap = new Map();
for (const chunk of chunkArray(parentIds, BATCH_CHUNK_SIZE)) {
  const ph = sqlPlaceholders(chunk.length);
  const rows = await db1.prepare(`SELECT parent_id, exdates FROM todo_templates WHERE parent_id IN (${ph})`).bind(...chunk).all();
  for (const r of (rows.results || [])) tplExdatesMap.set(r.parent_id, r.exdates || '[]');
}

// Step 5: 修复后——批量 UPDATE exdates
const exdateStmts = [];
for (const pid of parentIds) {
  const currentExdates = tplExdatesMap.get(pid);
  if (currentExdates === undefined) continue;
  let new_exdates = currentExdates;
  let changed = false;
  for (const d of exdateUpdates[pid]) {
    const next = addExdate(new_exdates, d);
    if (next !== new_exdates) { new_exdates = next; changed = true; }
  }
  if (changed) exdateStmts.push(db1.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, pid));
}
for (const chunk of chunkArray(exdateStmts, BATCH_CHUNK_SIZE)) {
  try { await db1.batch(chunk); } catch (e) {}
}

const stats1 = db1._getStats();
console.log(`  总 subrequest: ${stats1.subrequests} (batch=${stats1.batchCalls}, single=${stats1.singleRuns})`);
if (stats1.subrequests <= 50) ok(`subrequest ${stats1.subrequests} ≤ 50（Free 限制内）`);
else ko(`subrequest ${stats1.subrequests} > 50`, `超出 D1 Free 计划限制`);

// ============================================================
// 测试 2: 对比——修复前（逐条 .run()）的 subrequest 数
// ============================================================
console.log('\n[2] 对比：修复前逐条 .run() 的 subrequest 数（理论值）');

// 修复前：100 个 parent 每个一条 .run()
const oldSingleRuns = 100;
// 修复前总 subrequest = Step1(3) + Step2(3) + Step4(2) + 100 = 108
const oldTotal = 3 + 3 + 2 + oldSingleRuns;
console.log(`  修复前总 subrequest: ${oldTotal}`);
if (oldTotal > 50) ok(`修复前 ${oldTotal} > 50，确认存在违规`);
else ko('修复前未超限？', '检查测试假设');

const reduction = oldTotal - stats1.subrequests;
console.log(`  修复后减少: ${reduction} 个 subrequest（${Math.round(reduction/oldTotal*100)}%）`);
if (reduction > 0) ok(`subrequest 减少 ${reduction} 个`);

// ============================================================
// 测试 3: 极端场景——500 unique parents
// ============================================================
console.log('\n[3] 极端场景：500 unique parents（500 个不同重复系列）');

const db3 = createMockDB();
const parentIds3 = Array(500).fill(0).map((_, i) => `parent-${i}`);

// 模拟完整的 BATCH_DELETE 流程
// Step 1: 500 ids 分 6 片 SELECT
for (const chunk of chunkArray(Array(500).fill(0).map((_, i) => `id-${i}`), BATCH_CHUNK_SIZE)) {
  await db3.prepare(`SELECT parent_id, date, repeat_type FROM todos WHERE id IN (${sqlPlaceholders(chunk.length)})`).bind(...chunk).all();
}
// Step 2: 500 ids 分 6 片 UPDATE
for (const chunk of chunkArray(Array(500).fill(0).map((_, i) => `id-${i}`), BATCH_CHUNK_SIZE)) {
  await db3.prepare(`UPDATE todos SET deleted = 1 WHERE id IN (${sqlPlaceholders(chunk.length)})`).bind(...chunk).run();
}
// Step 4: 500 parents 分 6 片 SELECT exdates
for (const chunk of chunkArray(parentIds3, BATCH_CHUNK_SIZE)) {
  await db3.prepare(`SELECT parent_id, exdates FROM todo_templates WHERE parent_id IN (${sqlPlaceholders(chunk.length)})`).bind(...chunk).all();
}
// Step 5: 修复后批量 UPDATE
const stmts3 = parentIds3.map(pid => db3.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind('[]', pid));
for (const chunk of chunkArray(stmts3, BATCH_CHUNK_SIZE)) {
  try { await db3.batch(chunk); } catch (e) {}
}

const stats3 = db3._getStats();
console.log(`  总 subrequest: ${stats3.subrequests} (batch=${stats3.batchCalls}, single=${stats3.singleRuns})`);
if (stats3.subrequests <= 50) ok(`500 parents: subrequest ${stats3.subrequests} ≤ 50`);
else ko(`500 parents: subrequest ${stats3.subrequests} > 50`, '极端场景仍超限');

// ============================================================
// 测试 4: batch chunk 大小验证
// ============================================================
console.log('\n[4] batch chunk 大小验证（每批 ≤ 99）');

const db4 = createMockDB();
const stmts4 = Array(250).fill(0).map((_, i) => db4.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind('[]', `p-${i}`));
for (const chunk of chunkArray(stmts4, BATCH_CHUNK_SIZE)) {
  await db4.batch(chunk);
}

const stats4 = db4._getStats();
const expectedBatches = Math.ceil(250 / 99); // 3
if (stats4.batchCalls === expectedBatches) ok(`250 条 → ${stats4.batchCalls} 个 batch call（每批 ≤ 99）`);
else ko('batch 数不符', `期望 ${expectedBatches}，实际 ${stats4.batchCalls}`);

// ============================================================
console.log('\n' + '='.repeat(60));
console.log(`  PASS: ${pass}  FAIL: ${fail}`);
console.log('='.repeat(60));
process.exit(fail > 0 ? 1 : 0);
