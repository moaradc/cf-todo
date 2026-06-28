/**
 * 以第三方调用方视角，照抄 API_Wiki.md 5.6 节每个示例一字不差地跑
 * 目的：找出文档与实际行为的所有偏差
 */
import ICAL from 'ical.js';

const BASE = 'https://your-app.workers.dev';
const API_KEY = 'cfk_your_key_here';

let pass = 0, fail = 0;
const issues = [];
function ok(label) { pass++; console.log(`  ✓ ${label}`); }
function ko(label, detail) { fail++; console.log(`  ✗ ${label}`); if (detail) console.log(`    ${detail}`); issues.push(`${label}: ${detail||''}`); }

async function api(method, path, body) {
  const opts = { method, headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (e) { json = { _raw: text }; }
  return { status: res.status, json };
}

const createdIds = [];
async function cleanup(id) {
  if (!id) return;
  await api('DELETE', `/api/v1/todos/${id}?scope=all`);
}

console.log('='.repeat(70));
console.log('以调用方视角照抄 5.6 节示例实测');
console.log('='.repeat(70));

// ============================================================
// 示例 1: V1 POST 创建「周一/三/五」重复任务
// 文档声明响应包含字段：id/parent_id/date/text/time/priority/
//   repeat_type/repeat_custom/category_id/repeat_interval/fragment_anchor
// ============================================================
console.log('\n[示例 1] V1 POST MWF');
const r1 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29',
  text: '晨会',
  repeat_type: 'weekly',
  repeat_custom: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
  repeat_interval: 1
});
console.log('  实际响应:', JSON.stringify(r1.json, null, 2));
if (r1.status === 201 && r1.json.success) {
  const d = r1.json.data;
  const expectedFields = ['id','parent_id','date','text','time','priority','repeat_type','repeat_custom','category_id','repeat_interval','fragment_anchor'];
  const actualFields = Object.keys(d);
  const missing = expectedFields.filter(f => !(f in d));
  if (missing.length === 0) {
    ok(`POST 201, 响应字段与文档一致 (${actualFields.length} 个字段)`);
  } else {
    ko(`POST 响应字段与文档不符`, `文档列: ${expectedFields.join(',')}\n    实际: ${actualFields.join(',')}\n    缺失: ${missing.join(',')}`);
  }
  if (d.repeat_custom === 'FREQ=WEEKLY;BYDAY=MO,WE,FR') {
    ok('repeat_custom 值正确');
  } else {
    ko('repeat_custom 值不符', `got: ${d.repeat_custom}`);
  }
  createdIds.push(d.id);
} else {
  ko(`POST 失败: HTTP ${r1.status}`, JSON.stringify(r1.json));
}

// ============================================================
// 示例 2: V1 POST 工作日 + repeat_end
// 文档声明：引擎实际展开 RRULE = FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261231T235959Z
// 验证：expand=false 拿 template，看 repeat_end 是否透传
// ============================================================
console.log('\n[示例 2] V1 POST 工作日 + repeat_end=2026-12-31');
const r2 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29',
  text: '打卡',
  repeat_type: 'weekly',
  repeat_custom: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  repeat_end: '2026-12-31'
});
if (r2.status === 201) {
  const id2 = r2.json.data.id;
  createdIds.push(id2);
  // 文档说引擎展开 RRULE 含 UNTIL=20261231T235959Z
  // 验证：在 2026-12-31 应有实例，在 2027-01-01 不应有
  const onEnd = await api('GET', '/api/v1/todos?date=2026-12-31&expand=true');
  const afterEnd = await api('GET', '/api/v1/todos?date=2027-01-04&expand=true');
  const foundEnd = (onEnd.json.data || []).find(x => x.id === id2 || (x.parent_id === id2 && x.text === '打卡'));
  const foundAfter = (afterEnd.json.data || []).find(x => x.id === id2 || (x.parent_id === id2 && x.text === '打卡'));
  if (foundEnd && !foundAfter) {
    ok('repeat_end 作为 UNTIL 生效：2026-12-31 有实例，2027-01-04 无');
  } else {
    ko('repeat_end UNTIL 行为不符', `2026-12-31 found=${!!foundEnd}, 2027-01-04 found=${!!foundAfter}`);
  }
} else {
  ko(`POST 失败: HTTP ${r2.status}`);
}

// ============================================================
// 示例 3: V1 POST 月末工作日 BYSETPOS=-1
// 文档说 anchor 2026-06-30
// 验证：ical.js 能否真的解析 FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1
//   并在 2026-06-30 生成实例
// ============================================================
console.log('\n[示例 3] V1 POST 月末工作日 BYSETPOS=-1');
// 先本地验证 ical.js 能否解析
try {
  const recur = ICAL.Recur.fromString('FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1');
  const vcalendar = new ICAL.Component(['vcalendar', [], []]);
  const vevent = new ICAL.Component('vevent');
  vevent.addPropertyWithValue('dtstart', new ICAL.Time({ year: 2026, month: 6, day: 30, isDate: true }));
  const rruleProp = new ICAL.Property('rrule', vevent);
  rruleProp.setValue(recur);
  vevent.addProperty(rruleProp);
  vcalendar.addSubcomponent(vevent);
  const event = new ICAL.Event(vevent);
  const iter = event.iterator();
  const first = iter.next();
  const firstStr = `${first.year}-${String(first.month).padStart(2,'0')}-${String(first.day).padStart(2,'0')}`;
  console.log(`  ical.js 本地解析：BYSETPOS=-1 首实例 = ${firstStr}`);
  // 2026-06-30 是周二，是 6 月最后一个工作日吗？
  // 6 月 30 日是周二，30 是最后一天，所以是最后一个工作日
  if (firstStr === '2026-06-30') {
    ok('ical.js BYSETPOS=-1 首实例正确 (2026-06-30)');
  } else {
    ko('ical.js BYSETPOS=-1 首实例不符', `expected 2026-06-30, got ${firstStr}`);
  }
} catch (e) {
  ko('ical.js 解析 BYSETPOS 失败', e.message);
}

const r3 = await api('POST', '/api/v1/todos', {
  date: '2026-06-30',
  text: '月度复盘',
  repeat_type: 'monthly',
  repeat_custom: 'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1'
});
if (r3.status === 201) {
  createdIds.push(r3.json.data.id);
  ok('服务端接受 BYSETPOS=-1');
  // 验证 7 月最后一个工作日（7 月 31 日是周五）是否生成实例
  const julEnd = await api('GET', '/api/v1/todos?date=2026-07-31&expand=true');
  const foundJul = (julEnd.json.data || []).find(x => x.parent_id === r3.json.data.id && x.text === '月度复盘');
  if (foundJul) {
    ok('7 月最后工作日 (07-31 周五) 生成实例 ✓');
  } else {
    ko('7 月最后工作日未生成实例', `data count=${(julEnd.json.data||[]).length}`);
  }
} else {
  ko(`POST 失败: HTTP ${r3.status}`, JSON.stringify(r3.json));
}

// ============================================================
// 示例 4: expand=false + 文档提供的 isOccurrenceOnDate 函数
// 把文档里的函数原样复制，看能否正确判断
// ============================================================
console.log('\n[示例 4] expand=false + 文档 isOccurrenceOnDate 函数');

// 文档原样复制的函数（来自 API_Wiki.md 5.6 节示例 4）
function isOccurrenceOnDate(template, dateStr) {
  if (!template.repeat_type || template.repeat_type === 'none' || template.repeat_type === 'fragment') return false;
  if (!template.anchor_date || template.anchor_date > dateStr) return false;
  let exdates = [];
  try { exdates = JSON.parse(template.exdates || '[]'); } catch (e) {}
  if (exdates.includes(dateStr)) return false;
  if (template.repeat_end && dateStr > template.repeat_end) return false;
  if (dateStr === template.anchor_date) return true;
  let rruleStr = template.repeat_custom;
  if (!rruleStr) {
    const FREQ = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };
    const f = FREQ[template.repeat_type];
    if (!f) return false;
    const parts = [`FREQ=${f}`];
    if (template.repeat_interval && template.repeat_interval > 1) parts.push(`INTERVAL=${template.repeat_interval}`);
    if (template.repeat_end) parts.push(`UNTIL=${template.repeat_end.replace(/-/g, '')}T235959Z`);
    rruleStr = parts.join(';');
  } else if (template.repeat_end && !rruleStr.includes('UNTIL')) {
    rruleStr += `;UNTIL=${template.repeat_end.replace(/-/g, '')}T235959Z`;
  }
  const vcalendar = new ICAL.Component(['vcalendar', [], []]);
  const vevent = new ICAL.Component('vevent');
  const [y, m, d] = template.anchor_date.split('-').map(Number);
  vevent.addPropertyWithValue('dtstart', new ICAL.Time({ year: y, month: m, day: d, isDate: true }));
  const rruleProp = new ICAL.Property('rrule', vevent);
  rruleProp.setValue(ICAL.Recur.fromString(rruleStr));
  vevent.addProperty(rruleProp);
  vcalendar.addSubcomponent(vevent);
  const event = new ICAL.Event(vevent);
  const iter = event.iterator();
  let next, count = 0;
  while ((next = iter.next()) && count < 1000) {
    const ns = `${next.year}-${String(next.month).padStart(2,'0')}-${String(next.day).padStart(2,'0')}`;
    if (ns === dateStr) return true;
    if (ns > dateStr) return false;
    count++;
  }
  return false;
}

// 用示例 1 创建的 MWF todo
if (createdIds[0]) {
  const expandRes = await api('GET', '/api/v1/todos?date=2026-06-29&expand=false');
  const tpl = (expandRes.json.templates || []).find(t => t.parent_id === createdIds[0]);
  if (tpl) {
    // 文档示例说：isOccurrenceOnDate(template, '2026-07-01') 应返回 true (周三)
    // 文档示例说：isOccurrenceOnDate(template, '2026-07-02') 应返回 false (周四)
    const r_wed = isOccurrenceOnDate(tpl, '2026-07-01');
    const r_thu = isOccurrenceOnDate(tpl, '2026-07-02');
    const r_mon = isOccurrenceOnDate(tpl, '2026-07-06'); // 周一
    const r_fri = isOccurrenceOnDate(tpl, '2026-07-03'); // 周五
    if (r_wed === true && r_thu === false && r_mon === true && r_fri === true) {
      ok('文档 isOccurrenceOnDate 函数判断正确 (MWF: 周一/三/五 ✓, 周四 ✗)');
    } else {
      ko('文档 isOccurrenceOnDate 判断不符', `wed=${r_wed}(应true), thu=${r_thu}(应false), mon=${r_mon}(应true), fri=${r_fri}(应true)`);
    }
  } else {
    ko('expand=false 未找到 template', `templates count=${(expandRes.json.templates||[]).length}`);
  }
}

// ============================================================
// 示例 5: V1 PUT PATCH 语义——不传 repeat_custom 保留 DB 原值
// ============================================================
console.log('\n[示例 5] V1 PUT PATCH 语义');
if (createdIds[0]) {
  const before = await api('GET', `/api/v1/todos/${createdIds[0]}`);
  const rcBefore = before.json.data.repeat_custom;
  // 文档示例：仅传 text，不传 repeat_custom
  const putRes = await api('PUT', `/api/v1/todos/${createdIds[0]}`, {
    scope: 'all',
    text: '晨会（改名）'
  });
  if (putRes.status === 200) {
    const rcAfter = putRes.json.data.repeat_custom;
    if (rcAfter === rcBefore) {
      ok(`PATCH 语义生效：repeat_custom 保留 (${rcBefore})`);
    } else {
      ko('PATCH 语义失败', `before=${rcBefore}, after=${rcAfter}`);
    }
    // 文档说：响应 data.repeat_custom 保持原值不变
    // 还要检查 text 是否真的改了
    if (putRes.json.data.text === '晨会（改名）') {
      ok('text 已更新');
    } else {
      ko('text 未更新', `got: ${putRes.json.data.text}`);
    }
  } else {
    ko(`PUT 失败: HTTP ${putRes.status}`, JSON.stringify(putRes.json));
  }
}

// ============================================================
// 示例 6: 转 fragment 强制清空
// 文档说：即使 body 显式传入 repeat_custom，响应中 repeat_custom 必为 ""
// ============================================================
console.log('\n[示例 6] 转 fragment 强制清空');
if (createdIds[0]) {
  const putRes = await api('PUT', `/api/v1/todos/${createdIds[0]}`, {
    scope: 'all',
    repeat_type: 'fragment',
    repeat_custom: 'FREQ=DAILY'
  });
  if (putRes.status === 200) {
    if (putRes.json.data.repeat_custom === '') {
      ok('转 fragment 后 repeat_custom 被清空');
    } else {
      ko('转 fragment 后 repeat_custom 未清空', `got: ${putRes.json.data.repeat_custom}`);
    }
    if (putRes.json.data.repeat_type === 'fragment') {
      ok('repeat_type 已改为 fragment');
    } else {
      ko('repeat_type 未改为 fragment', `got: ${putRes.json.data.repeat_type}`);
    }
  } else {
    ko(`PUT 失败: HTTP ${putRes.status}`, JSON.stringify(putRes.json));
  }
}

// ============================================================
// V0 示例: CREATE + UPDATE
// 文档说 V0 UPDATE 必须传完整 task 对象
// 实测：只传 text + repeat_type + repeat_interval，看哪些字段被清空
// ============================================================
console.log('\n[V0 实测] CREATE 然后 UPDATE 只传部分字段');
const v0Id = `e2e-v0-${Date.now()}`;
const v0Create = await api('POST', '/api/todo-action', {
  action: 'CREATE',
  date: '2026-06-29',
  task: {
    id: v0Id,
    text: 'V0 测试',
    repeat_type: 'weekly',
    repeat_custom: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
    repeat_interval: 1,
    desc: '原始描述',
    category_id: '',
    subtasks: [{ text: '子任务1', done: false }]
  }
});
if (v0Create.status === 200 && v0Create.json.success) {
  createdIds.push(v0Id);
  // 文档说 V0 CREATE 响应为 {"success":true}（无 data 字段）
  if (!v0Create.json.data) {
    ok('V0 CREATE 响应无 data 字段（与文档一致）');
  } else {
    ko('V0 CREATE 响应含 data 字段（与文档不符）', JSON.stringify(v0Create.json.data).slice(0,200));
  }
  // 用 V1 GET 读回
  const afterCreate = await api('GET', `/api/v1/todos/${v0Id}`);
  const d = afterCreate.json.data;
  console.log(`  创建后 DB 状态: desc=${JSON.stringify(d.desc)}, subtasks=${JSON.stringify(d.subtasks)}, repeat_custom=${JSON.stringify(d.repeat_custom)}`);
  
  // V0 UPDATE 只传 text + repeat_type + repeat_interval
  const v0Update = await api('POST', '/api/todo-action', {
    action: 'UPDATE',
    date: '2026-06-29',
    scope: 'all',
    task: {
      id: v0Id,
      text: 'V0 改名',
      repeat_type: 'weekly',
      repeat_interval: 1
    }
  });
  if (v0Update.status === 200) {
    const afterUpdate = await api('GET', `/api/v1/todos/${v0Id}`);
    const d2 = afterUpdate.json.data;
    console.log(`  更新后 DB 状态: desc=${JSON.stringify(d2.desc)}, subtasks=${JSON.stringify(d2.subtasks)}, repeat_custom=${JSON.stringify(d2.repeat_custom)}, text=${JSON.stringify(d2.text)}`);
    
    // 文档表格说：desc 是 PATCH（应保留），subtasks 是全量替换（应清空），repeat_custom 是全量替换（应清空）
    if (d2.desc === '原始描述') ok('desc PATCH 生效（保留）');
    else ko('desc 未保留', `got: ${d2.desc}`);
    
    if (Array.isArray(d2.subtasks) && d2.subtasks.length === 0) ok('subtasks 全量替换生效（清空）');
    else ko('subtasks 未清空', `got: ${JSON.stringify(d2.subtasks)}`);
    
    if (d2.repeat_custom === '') ok('repeat_custom 全量替换生效（清空）');
    else ko('repeat_custom 未清空', `got: ${d2.repeat_custom}`);
    
    if (d2.text === 'V0 改名') ok('text 已更新');
    else ko('text 未更新', `got: ${d2.text}`);
  } else {
    ko(`V0 UPDATE 失败: HTTP ${v0Update.status}`, JSON.stringify(v0Update.json));
  }
} else {
  ko(`V0 CREATE 失败: HTTP ${v0Create.status}`, JSON.stringify(v0Create.json));
}

// ============================================================
// 清理
// ============================================================
console.log('\n[清理]');
for (const id of createdIds) {
  await cleanup(id);
  console.log(`  deleted ${id}`);
}

console.log('\n' + '='.repeat(70));
console.log(`  PASS: ${pass}  FAIL: ${fail}`);
console.log('='.repeat(70));
if (issues.length) {
  console.log('\n问题清单:');
  issues.forEach((s, i) => console.log(`  ${i+1}. ${s}`));
}
process.exit(fail > 0 ? 1 : 0);
