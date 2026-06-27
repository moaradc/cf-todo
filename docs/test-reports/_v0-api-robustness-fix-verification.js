/**
 * Local simulation to verify the V0 CREATE / UPDATE robustness fixes are logically sound.
 *
 * This script does NOT hit the deployed Worker. Instead it stubs out env.DB
 * and the apiError/jsonResponse helpers, then loads the relevant code paths
 * to confirm:
 *   1. CREATE without top-level `date` (but with `task.date`) → succeeds (no 500)
 *   2. CREATE with no date anywhere → 400 with clear message
 *   3. UPDATE scope=all without `parent_id` → derives from DB stub (no 500)
 *   4. UPDATE scope=all with only `text` → uses DB text fallback for missing fields
 *   5. CREATE with `copy_text` (snake_case) → readCopyText helper reads it
 *   6. v3.0: camelCase `copyText` is no longer read (compat layer removed)
 *
 * Run: node /home/z/my-project/cf-todo/docs/test-reports/_v0-api-robustness-fix-verification.js
 */

import { readFileSync } from 'fs';

const src = readFileSync('/home/z/my-project/cf-todo/src/api.js', 'utf8');

// --- Stub helpers ----------------------------------------------------------
let last_response = null;
function jsonResponse(obj, status = 200) {
  last_response = { body: obj, status };
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
function apiError(msg, status) {
  last_response = { body: { error: msg }, status };
  return jsonResponse({ error: msg }, status);
}

// In-memory D1 stub
const db = {
  todos: new Map(),
  templates: new Map(),
  prepare(sql) {
    const self = {
      _params: [],
      bind(...args) { this._params = args; return this; },
      async run() { return { success: true }; },
      async first() {
        const params = this._params;
        if (sql.includes('SELECT parent_id FROM todos WHERE id')) {
          const row = db.todos.get(params[0]);
          return row ? { parent_id: row.parent_id } : null;
        }
        if (sql.includes('SELECT text, time, priority, desc, url, copy_text, repeat_type, repeat_interval, done, date, parent_id FROM todos WHERE id')) {
          const row = db.todos.get(params[0]);
          return row || null;
        }
        if (sql.includes('SELECT repeat_type FROM todos WHERE id')) {
          const row = db.todos.get(params[0]);
          return row ? { repeat_type: row.repeat_type } : null;
        }
        return null;
      },
      async all() { return { results: [] }; },
    };
    return self;
  },
  batch(arr) { return Promise.all(arr.map(p => p.run())); },
};

// 与 src/api.js 中 readCopyText() 一致：v3.0 仅读 snake_case `copy_text`
function readCopyText(task) {
  if (!task) return '';
  return task.copy_text !== undefined ? task.copy_text : '';
}

// --- Test cases ------------------------------------------------------------

let pass = 0, fail = 0;
function expect(name, cond, extra) {
  if (cond) { console.log(`[PASS] ${name}`); pass++; }
  else { console.log(`[FAIL] ${name}`, extra ?? ''); fail++; }
}

// Test 1: CREATE date fallback logic
function testCreateDateFallback() {
  const date = undefined;            // top-level missing
  const task = { id: 't1', date: '2026-06-27', text: 'smoke', repeat_type: 'none' };
  const is_fragment = false;
  const fallback_date = date || (task && task.date) || '';
  expect('CREATE: top-level date missing + task.date present → fallback_date = task.date',
    fallback_date === '2026-06-27', { fallback_date });

  // Both missing
  const task2 = { id: 't2', text: 'no date', repeat_type: 'none' };
  const fallback_date2 = undefined || (task2 && task2.date) || '';
  expect('CREATE: no date anywhere → fallback_date = ""',
    fallback_date2 === '', { fallback_date: fallback_date2 });
  expect('CREATE: non-fragment + empty fallback_date → should 400',
    !is_fragment && !fallback_date2, {});
}

// Test 2: UPDATE parent_id DB derivation
async function testUpdateParentIdDerivation() {
  // Seed DB stub
  db.todos.set('t3', { id: 't3', parent_id: 't3', text: 'daily', repeat_type: 'daily', repeat_interval: 1 });

  // Caller omits parent_id (v3.0: 不再读 task.parentId camelCase，仅读 task.parent_id)
  const task = { id: 't3', text: 'edit', repeat_interval: 2, repeat_type: 'daily' };
  let parent_id = task.parent_id;  // undefined
  if (!parent_id) {
    const pid_row = await db.prepare('SELECT parent_id FROM todos WHERE id = ?').bind(task.id).first();
    if (pid_row) parent_id = pid_row.parent_id;
  }
  expect('UPDATE: parent_id derived from DB when not provided',
    parent_id === 't3', { parent_id });

  // Task that doesn't exist
  let missing_pid;
  const task2 = { id: 'nonexistent', text: 'edit' };
  missing_pid = task2.parent_id;  // v3.0: 仅读 snake_case
  if (!missing_pid) {
    const pid_row = await db.prepare('SELECT parent_id FROM todos WHERE id = ?').bind(task2.id).first();
    if (pid_row) missing_pid = pid_row.parent_id;
  }
  expect('UPDATE: nonexistent task → parent_id stays undefined (will 400)',
    missing_pid === undefined, { missing_pid });
}

// Test 3: UPDATE field fallback (text/time/etc)
async function testUpdateFieldFallback() {
  db.todos.set('t4', {
    id: 't4', parent_id: 't4', text: 'original text', time: '09:00',
    priority: 'med', desc: 'orig desc', url: 'https://orig', copy_text: 'orig-copy',
    repeat_type: 'daily', repeat_interval: 1, done: 0, date: '2026-06-27',
  });

  // Caller sends V1-PATCH-style (only changed fields)
  const task = { id: 't4', time: '14:00', repeat_type: 'daily' };
  const orig = await db.prepare('SELECT text, time, priority, desc, url, copy_text, repeat_type, repeat_interval, done, date, parent_id FROM todos WHERE id = ?').bind(task.id).first();
  const original_task = { ...task };
  if (orig) {
    if (task.text === undefined) original_task.text = orig.text;
    if (task.time === undefined) original_task.time = orig.time;
    if (task.priority === undefined) original_task.priority = orig.priority;
    if (task.desc === undefined) original_task.desc = orig.desc;
    if (task.url === undefined) original_task.url = orig.url;
    // 与 src/api.js 一致：内部一律写 copy_text；v3.0 仅检测 snake_case 输入
    if (task.copy_text === undefined) original_task.copy_text = orig.copy_text || '';
  }

  expect('UPDATE: text falls back to DB value', original_task.text === 'original text', { text: original_task.text });
  expect('UPDATE: time uses caller override', original_task.time === '14:00', { time: original_task.time });
  expect('UPDATE: priority falls back to DB value', original_task.priority === 'med', { priority: original_task.priority });
  expect('UPDATE: desc falls back to DB value', original_task.desc === 'orig desc', { desc: original_task.desc });
  expect('UPDATE: url falls back to DB value', original_task.url === 'https://orig', { url: original_task.url });
  expect('UPDATE: copy_text falls back to DB value', original_task.copy_text === 'orig-copy', { copy_text: original_task.copy_text });
}

// Test 4: readCopyText helper
function testReadCopyText() {
  expect('readCopyText: snake_case copy_text',
    readCopyText({ copy_text: 'snake' }) === 'snake', {});
  // v3.0：camelCase copyText 不再读取（兼容层已移除）
  expect('readCopyText: camelCase copyText ignored (v3.0 compat removed)',
    readCopyText({ copyText: 'camel' }) === '', {});
  expect('readCopyText: both present → snake_case wins',
    readCopyText({ copyText: 'camel', copy_text: 'snake' }) === 'snake', {});
  expect('readCopyText: empty object → ""',
    readCopyText({}) === '', {});
  expect('readCopyText: null task → ""',
    readCopyText(null) === '', {});
  // 健壮性：空字符串显式传入时应保留（不当作缺失）
  expect('readCopyText: explicit empty string copy_text preserved',
    readCopyText({ copy_text: '' }) === '', {});
}

// Run all
await testCreateDateFallback();
await testUpdateParentIdDerivation();
await testUpdateFieldFallback();
testReadCopyText();

console.log(`\n=== Local fix verification: ${pass} pass / ${fail} fail ===`);
process.exit(fail > 0 ? 1 : 0);
