/**
 * V0 UPDATE 字段语义精确审计
 * 对每个字段单独测试：创建带特殊值 → UPDATE 不传该字段 → 检查是否保留
 */
const BASE = 'https://your-app.workers.dev';
const API_KEY = 'cfk_your_key_here';

async function api(method, path, body) {
  const opts = { method, headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (e) { json = { _raw: text }; }
  return { status: res.status, json };
}

console.log('='.repeat(70));
console.log('V0 UPDATE 字段语义精确审计');
console.log('='.repeat(70));

// 创建一个带所有特殊值的 todo
const createRes = await api('POST', '/api/v1/todos', {
  date: '2026-06-29',
  text: 'original-text',
  time: '09:00',
  priority: 'high',
  desc: 'original-desc',
  url: 'https://original.com',
  copy_text: 'original-copy',
  repeat_type: 'weekly',
  repeat_custom: 'FREQ=WEEKLY;BYDAY=MO',
  repeat_end: '2026-12-31',
  end_time: '10:00',
  category_id: '',
  repeat_interval: 3,
  subtasks: [{ text: 'sub1', done: false }],
  search_terms: [{ text: 'keyword1', done: false }]
});
const id = createRes.json.data.id;
console.log(`创建基线 todo: id=${id}`);

// 验证创建成功
const before = await api('GET', `/api/v1/todos/${id}`);
const b = before.json.data;
console.log('\n基线值:');
console.log(`  text:           ${JSON.stringify(b.text)}`);
console.log(`  time:           ${JSON.stringify(b.time)}`);
console.log(`  priority:       ${JSON.stringify(b.priority)}`);
console.log(`  desc:           ${JSON.stringify(b.desc)}`);
console.log(`  url:            ${JSON.stringify(b.url)}`);
console.log(`  copy_text:      ${JSON.stringify(b.copy_text)}`);
console.log(`  repeat_type:    ${JSON.stringify(b.repeat_type)}`);
console.log(`  repeat_custom:  ${JSON.stringify(b.repeat_custom)}`);
console.log(`  repeat_end:     ${JSON.stringify(b.repeat_end)}`);
console.log(`  end_time:       ${JSON.stringify(b.end_time)}`);
console.log(`  category_id:    ${JSON.stringify(b.category_id)}`);
console.log(`  repeat_interval: ${b.repeat_interval}`);
console.log(`  subtasks:       ${JSON.stringify(b.subtasks)}`);
console.log(`  search_terms:   ${JSON.stringify(b.search_terms)}`);

// V0 UPDATE 只传 text + repeat_type + repeat_interval（最小集）
console.log('\n执行 V0 UPDATE: 只传 text + repeat_type + repeat_interval');
const updateRes = await api('POST', '/api/todo-action', {
  action: 'UPDATE',
  date: '2026-06-29',
  scope: 'all',
  task: {
    id: id,
    text: 'changed-text',
    repeat_type: 'weekly',
    repeat_interval: 3
  }
});
console.log(`UPDATE 响应: HTTP ${updateRes.status}`);

// 读回所有字段
const after = await api('GET', `/api/v1/todos/${id}`);
const a = after.json.data;

console.log('\n字段级比对:');
console.log('字段               | 基线值                    | UPDATE 后                 | 行为');
console.log('-'.repeat(110));

const fields = [
  ['text',            b.text,           a.text,           'PATCH'],
  ['time',            b.time,           a.time,           '?'],
  ['priority',        b.priority,       a.priority,       '?'],
  ['desc',            b.desc,           a.desc,           '?'],
  ['url',             b.url,            a.url,            '?'],
  ['copy_text',       b.copy_text,      a.copy_text,      '?'],
  ['repeat_type',     b.repeat_type,    a.repeat_type,    '?'],
  ['repeat_custom',   b.repeat_custom,  a.repeat_custom,  '?'],
  ['repeat_end',      b.repeat_end,     a.repeat_end,     '?'],
  ['end_time',        b.end_time,       a.end_time,       '?'],
  ['category_id',     b.category_id,    a.category_id,    '?'],
  ['repeat_interval', b.repeat_interval,a.repeat_interval,'?'],
  ['subtasks',        JSON.stringify(b.subtasks), JSON.stringify(a.subtasks), '?'],
  ['search_terms',    JSON.stringify(b.search_terms), JSON.stringify(a.search_terms), '?'],
];

const results = [];
for (const [field, beforeVal, afterVal, _] of fields) {
  const preserved = JSON.stringify(beforeVal) === JSON.stringify(afterVal);
  const behavior = preserved ? 'PATCH（保留）' : '全量替换（清空/默认）';
  results.push({ field, preserved, behavior });
  console.log(`${field.padEnd(18)} | ${String(beforeVal).padEnd(25)} | ${String(afterVal).padEnd(25)} | ${behavior}`);
}

console.log('\n' + '='.repeat(70));
console.log('结论:');
console.log('='.repeat(70));
const patchFields = results.filter(r => r.preserved).map(r => r.field);
const replaceFields = results.filter(r => !r.preserved).map(r => r.field);
console.log(`PATCH（未传时保留 DB 值）: ${patchFields.join(', ')}`);
console.log(`全量替换（未传时清空/默认）: ${replaceFields.join(', ')}`);

// 清理
await api('DELETE', `/api/v1/todos/${id}?scope=all`);
console.log(`\n已清理 ${id}`);
