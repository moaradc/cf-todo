/**
 * 联动场景测试：PATCH 语义 + 服务端推导 + 原子组校验
 *
 * 覆盖：
 * 1. 独立字段 PATCH（未传保留）
 * 2. 服务端联动推导（repeat_custom 反推 repeat_type）
 * 3. fragment/none 强制清空
 * 4. 原子组冲突 400（repeat_end + repeat_type / time > end_time / repeat_interval + repeat_type）
 * 5. V0 vs V1 行为一致性
 */
const BASE = 'https://your-app.workers.dev';
const API_KEY = 'cfk_your_key_here';

let pass = 0, fail = 0;
const issues = [];
function ok(label) { pass++; console.log(`  ✓ ${label}`); }
function ko(label, detail) { fail++; console.log(`  ✗ ${label}`); if (detail) console.log(`    ${detail}`); issues.push(`${label}: ${detail||''}`); }

async function api(method, path, body, useV0 = false) {
  const opts = { method, headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (e) { json = { _raw: text }; }
  return { status: res.status, json };
}

const createdIds = [];
async function cleanup(id) { if (id) await api('DELETE', `/api/v1/todos/${id}?scope=all`); }

console.log('='.repeat(70));
console.log('联动场景测试：PATCH 语义 + 服务端推导 + 原子组校验');
console.log('='.repeat(70));

// ============================================================
// 1. 独立字段 PATCH：V1 PUT 只传 text，其他字段保留
// ============================================================
console.log('\n[1] V1 PUT 独立字段 PATCH（只传 text）');
const r1 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: '原始', desc: '原始描述', url: 'https://orig.com',
  priority: 'high', repeat_type: 'weekly', repeat_interval: 2, repeat_end: '2026-12-31',
  subtasks: [{ text: '子任务', done: false }], category_id: ''
});
const id1 = r1.json?.data?.id;
createdIds.push(id1);

const u1 = await api('PUT', `/api/v1/todos/${id1}`, { scope: 'all', text: '改名' });
if (u1.status === 200) {
  const d = u1.json.data;
  if (d.text === '改名') ok('text 已更新');
  else ko('text 未更新', `got: ${d.text}`);
  if (d.desc === '原始描述') ok('desc PATCH 保留');
  else ko('desc 未保留', `got: ${d.desc}`);
  if (d.url === 'https://orig.com') ok('url PATCH 保留');
  else ko('url 未保留', `got: ${d.url}`);
  if (d.priority === 'high') ok('priority PATCH 保留');
  else ko('priority 未保留', `got: ${d.priority}`);
  if (d.repeat_interval === 2) ok('repeat_interval PATCH 保留');
  else ko('repeat_interval 未保留', `got: ${d.repeat_interval}`);
  if (d.repeat_end === '2026-12-31') ok('repeat_end PATCH 保留');
  else ko('repeat_end 未保留', `got: ${d.repeat_end}`);
  if (d.subtasks.length === 1 && d.subtasks[0].text === '子任务') ok('subtasks PATCH 保留');
  else ko('subtasks 未保留', `got: ${JSON.stringify(d.subtasks)}`);
} else {
  ko(`PUT 失败: HTTP ${u1.status}`, JSON.stringify(u1.json).slice(0,200));
}

// ============================================================
// 2. 服务端联动推导：repeat_custom 反推 repeat_type
// 创建 repeat_type=none 的 todo，PUT 只传 repeat_custom，应自动反推 repeat_type=weekly
// ============================================================
console.log('\n[2] V1 PUT 联动推导（repeat_custom 反推 repeat_type）');
const r2 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: '反推测试', repeat_type: 'none'
});
const id2 = r2.json?.data?.id;
createdIds.push(id2);

const u2 = await api('PUT', `/api/v1/todos/${id2}`, {
  scope: 'all',
  repeat_custom: 'FREQ=WEEKLY;BYDAY=MO,WE,FR'
});
if (u2.status === 200) {
  const d = u2.json.data;
  if (d.repeat_type === 'weekly') ok('repeat_type 反推为 weekly（从 custom FREQ=WEEKLY）');
  else ko('repeat_type 未反推', `got: ${d.repeat_type}`);
  if (d.repeat_custom === 'FREQ=WEEKLY;BYDAY=MO,WE,FR') ok('repeat_custom 已写入');
  else ko('repeat_custom 未写入', `got: ${d.repeat_custom}`);
} else {
  ko(`PUT 失败: HTTP ${u2.status}`, JSON.stringify(u2.json).slice(0,200));
}

// ============================================================
// 3. fragment 强制清空（服务端联动）
// 创建 weekly todo，PUT 改 repeat_type=fragment，time/end_time/repeat_end/repeat_interval/repeat_custom 应被清空
// ============================================================
console.log('\n[3] V1 PUT 转 fragment 强制清空联动字段');
const r3 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: '转fragment', repeat_type: 'weekly',
  time: '09:00', end_time: '10:00', repeat_end: '2026-12-31', repeat_interval: 2
});
const id3 = r3.json?.data?.id;
createdIds.push(id3);

const u3 = await api('PUT', `/api/v1/todos/${id3}`, {
  scope: 'all', repeat_type: 'fragment'
});
if (u3.status === 200) {
  const d = u3.json.data;
  if (d.repeat_type === 'fragment') ok('repeat_type=fragment');
  else ko('repeat_type 未改为 fragment', `got: ${d.repeat_type}`);
  if (d.time === '') ok('time 联动清空');
  else ko('time 未清空', `got: ${d.time}`);
  if (d.end_time === '') ok('end_time 联动清空');
  else ko('end_time 未清空', `got: ${d.end_time}`);
  if (d.repeat_end === '') ok('repeat_end 联动清空');
  else ko('repeat_end 未清空', `got: ${d.repeat_end}`);
  if (d.repeat_interval === 1) ok('repeat_interval 联动为 1');
  else ko('repeat_interval 未联动', `got: ${d.repeat_interval}`);
} else {
  ko(`PUT 失败: HTTP ${u3.status}`, JSON.stringify(u3.json).slice(0,200));
}

// ============================================================
// 4. 原子组冲突 400：repeat_end + repeat_type=none
// ============================================================
console.log('\n[4] 原子组冲突 400：repeat_end + repeat_type=none');
const r4 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: '冲突测试', repeat_type: 'none'
});
const id4 = r4.json?.data?.id;
createdIds.push(id4);

const u4 = await api('PUT', `/api/v1/todos/${id4}`, {
  scope: 'all', repeat_end: '2026-12-31'  // repeat_type 仍为 none
});
if (u4.status === 400) {
  ok('repeat_end + repeat_type=none → 400');
} else {
  ko(`期望 400，实际 ${u4.status}`, JSON.stringify(u4.json).slice(0,200));
}

// ============================================================
// 5. 原子组冲突 400：repeat_end + repeat_type=fragment
// ============================================================
console.log('\n[5] 原子组冲突 400：repeat_end + repeat_type=fragment');
const u5 = await api('PUT', `/api/v1/todos/${id4}`, {
  scope: 'all', repeat_type: 'fragment', repeat_end: '2026-12-31'
});
if (u5.status === 400) {
  ok('repeat_end + repeat_type=fragment → 400');
} else {
  ko(`期望 400，实际 ${u5.status}`, JSON.stringify(u5.json).slice(0,200));
}

// ============================================================
// 6. 原子组冲突 400：time > end_time
// ============================================================
console.log('\n[6] 原子组冲突 400：time > end_time');
const r6 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: '时间冲突', repeat_type: 'none'
});
const id6 = r6.json?.data?.id;
createdIds.push(id6);

const u6 = await api('PUT', `/api/v1/todos/${id6}`, {
  scope: 'all', time: '18:00', end_time: '09:00'  // time > end_time
});
if (u6.status === 400) {
  ok('time(18:00) > end_time(09:00) → 400');
} else {
  ko(`期望 400，实际 ${u6.status}`, JSON.stringify(u6.json).slice(0,200));
}

// ============================================================
// 7. 原子组冲突 400：repeat_interval > 1 + repeat_type=none
// ============================================================
console.log('\n[7] 原子组冲突 400：repeat_interval=2 + repeat_type=none');
const u7 = await api('PUT', `/api/v1/todos/${id6}`, {
  scope: 'all', repeat_interval: 2  // repeat_type 仍为 none
});
if (u7.status === 400) {
  ok('repeat_interval=2 + repeat_type=none → 400');
} else {
  ko(`期望 400，实际 ${u7.status}`, JSON.stringify(u7.json).slice(0,200));
}

// ============================================================
// 8. V0 UPDATE PATCH 语义：只传 text，其他字段保留
// ============================================================
console.log('\n[8] V0 UPDATE PATCH 语义（只传 id + text）');
const r8 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: 'V0原始', desc: 'V0描述', priority: 'high',
  repeat_type: 'weekly', repeat_interval: 2, repeat_end: '2026-12-31',
  subtasks: [{ text: 'V0子任务', done: false }]
});
const id8 = r8.json?.data?.id;
createdIds.push(id8);

const u8 = await api('POST', '/api/todo-action', {
  action: 'UPDATE', date: '2026-06-29', scope: 'all',
  task: { id: id8, text: 'V0改名' }
});
if (u8.status === 200) {
  const d8 = await api('GET', `/api/v1/todos/${id8}`);
  const d = d8.json.data;
  if (d.text === 'V0改名') ok('V0 text 已更新');
  else ko('V0 text 未更新', `got: ${d.text}`);
  if (d.desc === 'V0描述') ok('V0 desc PATCH 保留');
  else ko('V0 desc 未保留', `got: ${d.desc}`);
  if (d.priority === 'high') ok('V0 priority PATCH 保留');
  else ko('V0 priority 未保留', `got: ${d.priority}`);
  if (d.repeat_interval === 2) ok('V0 repeat_interval PATCH 保留');
  else ko('V0 repeat_interval 未保留', `got: ${d.repeat_interval}`);
  if (d.repeat_end === '2026-12-31') ok('V0 repeat_end PATCH 保留');
  else ko('V0 repeat_end 未保留', `got: ${d.repeat_end}`);
  if (d.subtasks.length === 1 && d.subtasks[0].text === 'V0子任务') ok('V0 subtasks PATCH 保留');
  else ko('V0 subtasks 未保留', `got: ${JSON.stringify(d.subtasks)}`);
} else {
  ko(`V0 UPDATE 失败: HTTP ${u8.status}`, JSON.stringify(u8.json).slice(0,200));
}

// ============================================================
// 9. V0 UPDATE 联动推导：repeat_custom 反推 repeat_type
// ============================================================
console.log('\n[9] V0 UPDATE 联动推导（repeat_custom 反推 repeat_type）');
const r9 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29', text: 'V0反推', repeat_type: 'none'
});
const id9 = r9.json?.data?.id;
createdIds.push(id9);

const u9 = await api('POST', '/api/todo-action', {
  action: 'UPDATE', date: '2026-06-29', scope: 'all',
  task: { id: id9, repeat_custom: 'FREQ=DAILY;INTERVAL=3' }
});
if (u9.status === 200) {
  const d9 = await api('GET', `/api/v1/todos/${id9}`);
  const d = d9.json.data;
  if (d.repeat_type === 'daily') ok('V0 repeat_type 反推为 daily');
  else ko('V0 repeat_type 未反推', `got: ${d.repeat_type}`);
  if (d.repeat_custom === 'FREQ=DAILY;INTERVAL=3') ok('V0 repeat_custom 已写入');
  else ko('V0 repeat_custom 未写入', `got: ${d.repeat_custom}`);
} else {
  ko(`V0 UPDATE 失败: HTTP ${u9.status}`, JSON.stringify(u9.json).slice(0,200));
}

// ============================================================
// 10. V0 UPDATE 原子组冲突 400
// ============================================================
console.log('\n[10] V0 UPDATE 原子组冲突 400：repeat_end + repeat_type=none');
const u10 = await api('POST', '/api/todo-action', {
  action: 'UPDATE', date: '2026-06-29', scope: 'all',
  task: { id: id9, repeat_end: '2026-12-31' }  // repeat_type 仍为 none（或 daily from #9）
});
// 注：id9 在 #9 后 repeat_type=daily，所以这里不会冲突。用 id6（none）测试
const u10b = await api('POST', '/api/todo-action', {
  action: 'UPDATE', date: '2026-06-29', scope: 'all',
  task: { id: id6, repeat_end: '2026-12-31' }  // id6 repeat_type=none
});
if (u10b.status === 400) {
  ok('V0 repeat_end + repeat_type=none → 400');
} else {
  ko(`V0 期望 400，实际 ${u10b.status}`, JSON.stringify(u10b.json).slice(0,200));
}

// ============================================================
// 清理
// ============================================================
console.log('\n[清理]');
for (const id of createdIds) {
  if (id) { await cleanup(id); console.log(`  deleted ${id}`); }
}

console.log('\n' + '='.repeat(70));
console.log(`  PASS: ${pass}  FAIL: ${fail}`);
console.log('='.repeat(70));
if (issues.length) {
  console.log('\n问题清单:');
  issues.forEach((s, i) => console.log(`  ${i+1}. ${s}`));
}
process.exit(fail > 0 ? 1 : 0);
