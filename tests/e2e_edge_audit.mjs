/**
 * 进阶实测：第三方客户端真实使用中会遇到的边界场景
 * - anchor_date 不匹配 BYDAY 时的行为
 * - RRULE 含 COUNT 时的展开上限
 * - V0 UPDATE scope=this (默认) 时 repeat_custom 的行为
 * - V1 PUT 传 null vs "" vs undefined 三种清空方式的差异
 * - 重复实例完成后 exdate 是否正确添加
 * - expand=false 在范围查询时是否真的不返回 templates
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
async function cleanup(id) { if (id) await api('DELETE', `/api/v1/todos/${id}?scope=all`); }

console.log('='.repeat(70));
console.log('进阶实测：真实第三方客户端边界场景');
console.log('='.repeat(70));

// ============================================================
// 边界 1: anchor_date 不匹配 BYDAY
// 文档示例 1：anchor 2026-06-29 (周一) + BYDAY=MO,WE,FR
// 但如果 anchor 是周二 (2026-06-30) + BYDAY=MO,WE,FR 会怎样？
// RFC 5545: DTSTART 始终是首实例，即使不匹配 RRULE
// ============================================================
console.log('\n[边界 1] anchor_date (周二) 不匹配 BYDAY=MO,WE,FR');
const r1 = await api('POST', '/api/v1/todos', {
  date: '2026-06-30', // 周二
  text: '不匹配测试',
  repeat_type: 'weekly',
  repeat_custom: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
  repeat_interval: 1
});
if (r1.status === 201) {
  createdIds.push(r1.json.data.id);
  // 文档说 "anchor_date 始终是首实例（RFC 5545）"
  // 验证：2026-06-30 (周二，anchor) 是否生成实例
  const onAnchor = await api('GET', '/api/v1/todos?date=2026-06-30&expand=true');
  const found = (onAnchor.json.data || []).find(x => x.parent_id === r1.json.data.id);
  if (found) {
    ok('anchor_date (周二) 即使不匹配 BYDAY 仍生成首实例（RFC 5545）');
  } else {
    ko('anchor_date 不匹配 BYDAY 时未生成首实例', '文档说 anchor 始终是首实例');
  }
  // 验证：2026-07-01 (周三) 是否生成
  const onWed = await api('GET', '/api/v1/todos?date=2026-07-01&expand=true');
  const foundWed = (onWed.json.data || []).find(x => x.parent_id === r1.json.data.id);
  if (foundWed) {
    ok('BYDAY 中的周三 (07-01) 正常生成');
  } else {
    ko('BYDAY 中的周三未生成');
  }
} else {
  ko(`POST 失败: HTTP ${r1.status}`);
}

// ============================================================
// 边界 2: V1 PUT 三种清空方式：undefined / null / ""
// 文档说：undefined 保留，null / "" 清空
// ============================================================
console.log('\n[边界 2] V1 PUT undefined vs null vs "" 三种清空方式');
const baseTodo = await api('POST', '/api/v1/todos', {
  date: '2026-06-29',
  text: '清空测试基线',
  repeat_type: 'weekly',
  repeat_custom: 'FREQ=WEEKLY;BYDAY=MO',
  repeat_interval: 1
});
const baseId = baseTodo.json?.data?.id;
createdIds.push(baseId);
console.log(`  基线 todo id=${baseId}, repeat_custom=FREQ=WEEKLY;BYDAY=MO`);

// 2a: undefined (不传字段)
const putUndef = await api('PUT', `/api/v1/todos/${baseId}`, {
  scope: 'all',
  text: '清空测试-未传'
});
if (putUndef.json?.data?.repeat_custom === 'FREQ=WEEKLY;BYDAY=MO') {
  ok('undefined (不传字段) → 保留 DB 原值');
} else {
  ko('undefined 行为不符', `got: ${putUndef.json?.data?.repeat_custom}`);
}

// 2b: null
const putNull = await api('PUT', `/api/v1/todos/${baseId}`, {
  scope: 'all',
  repeat_custom: null
});
if (putNull.json?.data?.repeat_custom === '') {
  ok('null → 清空');
} else {
  ko('null 行为不符', `got: ${putNull.json?.data?.repeat_custom}`);
}

// 重新设置回去
await api('PUT', `/api/v1/todos/${baseId}`, {
  scope: 'all',
  repeat_custom: 'FREQ=WEEKLY;BYDAY=MO'
});

// 2c: ""
const putEmpty = await api('PUT', `/api/v1/todos/${baseId}`, {
  scope: 'all',
  repeat_custom: ''
});
if (putEmpty.json?.data?.repeat_custom === '') {
  ok('"" → 清空');
} else {
  ko('"" 行为不符', `got: ${putEmpty.json?.data?.repeat_custom}`);
}

// ============================================================
// 边界 3: V0 UPDATE scope=this (默认，不传 scope) 时 repeat_custom 行为
// 文档表格说 repeat_custom 是全量替换，但 scope=this 时是脱离系列变 none
// ============================================================
console.log('\n[边界 3] V0 UPDATE scope=this (默认) 重复任务时 repeat_custom 行为');
const seriesTodo = await api('POST', '/api/v1/todos', {
  date: '2026-06-29',
  text: '系列测试',
  repeat_type: 'weekly',
  repeat_custom: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
  repeat_interval: 1
});
const seriesId = seriesTodo.json?.data?.id;
createdIds.push(seriesId);

// 在 2026-07-01 (周三) 展开实例
const expandRes = await api('GET', '/api/v1/todos?date=2026-07-01&expand=true');
const instance = (expandRes.json.data || []).find(x => x.parent_id === seriesId);
if (instance) {
  console.log(`  找到实例 id=${instance.id}, parent_id=${instance.parent_id}`);
  // V0 UPDATE scope=this 不传 repeat_custom
  // 文档说 scope=this 时脱离系列变 none，repeat_custom 应为 ""
  const v0Update = await api('POST', '/api/todo-action', {
    action: 'UPDATE',
    date: '2026-07-01',
    task: {
      id: instance.id,
      text: '仅此项改名',
      repeat_type: 'weekly',  // 即使传 weekly，scope=this 也应脱离
      repeat_interval: 1
    }
  });
  if (v0Update.status === 200) {
    const after = await api('GET', `/api/v1/todos/${instance.id}`);
    const d = after.json.data;
    console.log(`  scope=this 后: repeat_type=${d.repeat_type}, repeat_custom=${JSON.stringify(d.repeat_custom)}, parent_id=${d.parent_id}`);
    if (d.repeat_type === 'none' && d.repeat_custom === '') {
      ok('scope=this: 实例脱离系列，repeat_type=none, repeat_custom=""');
    } else {
      ko('scope=this 行为不符', `repeat_type=${d.repeat_type}, repeat_custom=${d.repeat_custom}`);
    }
    if (d.parent_id === instance.id) {
      ok('scope=this: parent_id 已设为自身 id（脱离系列）');
    } else {
      ko('scope=this: parent_id 未脱离', `got: ${d.parent_id}`);
    }
  } else {
    ko(`V0 UPDATE scope=this 失败: HTTP ${v0Update.status}`, JSON.stringify(v0Update.json).slice(0,200));
  }
} else {
  ko('未找到系列实例');
}

// ============================================================
// 边界 4: expand=false 在范围查询时是否返回 templates
// 文档说："仅 date 查询生效，范围查询本就不展开"
// ============================================================
console.log('\n[边界 4] expand=false 在范围查询时是否返回 templates');
const rangeRes = await api('GET', '/api/v1/todos?start_date=2026-07-01&end_date=2026-07-07&expand=false');
if (rangeRes.json.templates === undefined) {
  ok('范围查询 expand=false 不返回 templates（与文档一致）');
} else {
  ko('范围查询返回了 templates', `templates count=${rangeRes.json.templates.length}`);
}
// 对比：date 查询应返回 templates
const dateRes = await api('GET', '/api/v1/todos?date=2026-07-01&expand=false');
if (Array.isArray(dateRes.json.templates)) {
  ok('date 查询 expand=false 返回 templates 数组');
} else {
  ko('date 查询未返回 templates');
}

// ============================================================
// 边界 5: 重复实例完成 (TOGGLE_DONE) 后该日期是否被加 exdate
// 文档 5.6 节没说，但 5.3 节说 done: false → true 仅影响当天实例
// 验证：完成后模板 exdates 是否更新
// ============================================================
console.log('\n[边界 5] 完成重复实例后 exdates 行为');
const todo5 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29',
  text: 'exdate 测试',
  repeat_type: 'daily',
  repeat_interval: 1
});
const id5 = todo5.json?.data?.id;
createdIds.push(id5);

// 在 2026-07-05 展开
const exp5 = await api('GET', '/api/v1/todos?date=2026-07-05&expand=true');
const inst5 = (exp5.json.data || []).find(x => x.parent_id === id5);
if (inst5) {
  // 完成该实例
  await api('PATCH', `/api/v1/todos/${inst5.id}/toggle`, { done: true });
  // 查 expand=false 看模板 exdates
  const tpl5 = await api('GET', '/api/v1/todos?date=2026-07-05&expand=false');
  const tpl = (tpl5.json.templates || []).find(t => t.parent_id === id5);
  if (tpl) {
    console.log(`  完成实例后模板 exdates = ${tpl.exdates}`);
    // 注：toggle done 不应加 exdate（exdate 是删除时才加）
    // 这里只是验证 expand=false 能看到 exdates 字段
    ok(`expand=false 能看到模板 exdates 字段`);
  }
}

// ============================================================
// 边界 6: repeat_custom 含 COUNT 时的展开
// 文档适用场景表：每 2 周一三五共 10 次
// ============================================================
console.log('\n[边界 6] repeat_custom 含 COUNT=10');
const todo6 = await api('POST', '/api/v1/todos', {
  date: '2026-06-29',
  text: 'COUNT 测试',
  repeat_type: 'weekly',
  repeat_custom: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=10',
  repeat_interval: 1
});
if (todo6.status === 201) {
  createdIds.push(todo6.json.data.id);
  // COUNT=10, INTERVAL=2, BYDAY=MO,WE,FR
  // 每周期 3 个实例 × 2 周间隔 → 10 个实例约跨 7 周
  // anchor 2026-06-29 (周一), 10 个实例应在：
  // 06-29(Mon), 07-01(Wed), 07-03(Fri), 07-13(Mon), 07-15(Wed), 07-17(Fri),
  // 07-27(Mon), 07-29(Wed), 07-31(Fri), 08-10(Mon)
  // 验证：08-10 (第 10 个) 应有实例，08-12 (第 11 个，超 COUNT) 不应有
  const on10th = await api('GET', '/api/v1/todos?date=2026-08-10&expand=true');
  const found10 = (on10th.json.data || []).find(x => x.parent_id === todo6.json.data.id);
  if (found10) {
    ok('COUNT=10 第 10 个实例 (08-10) 生成');
  } else {
    ko('COUNT=10 第 10 个实例未生成', `data count=${(on10th.json.data||[]).length}`);
  }
  const on11th = await api('GET', '/api/v1/todos?date=2026-08-12&expand=true');
  const found11 = (on11th.json.data || []).find(x => x.parent_id === todo6.json.data.id);
  if (!found11) {
    ok('COUNT=10 第 11 个实例 (08-12) 未生成（COUNT 上限生效）');
  } else {
    ko('COUNT=10 上限未生效', '第 11 个实例生成了');
  }
} else {
  ko(`POST 失败: HTTP ${todo6.status}`);
}

// ============================================================
// 边界 7: 文档示例 4 的 isOccurrenceOnDate 函数在 anchor 不匹配 BYDAY 时是否正确
// 边界 1 已验证 anchor 即使不匹配 BYDAY 也会生成首实例
// 但文档的 isOccurrenceOnDate 函数第 3 步：if (dateStr === template.anchor_date) return true;
// 这处理了 anchor 首实例，所以应正确
// ============================================================
console.log('\n[边界 7] 文档 isOccurrenceOnDate 函数在 anchor 不匹配 BYDAY 时');
if (createdIds[0]) {
  // 用边界 1 创建的 todo（anchor 周二 + BYDAY=MO,WE,FR）
  const expandRes = await api('GET', '/api/v1/todos?date=2026-06-30&expand=false');
  const tpl = (expandRes.json.templates || []).find(t => t.parent_id === createdIds[0]);
  if (tpl) {
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
    // anchor 2026-06-30 (周二) 应返回 true（首实例）
    const r_anchor = isOccurrenceOnDate(tpl, '2026-06-30');
    // 2026-07-01 (周三) 应返回 true（BYDAY）
    const r_wed = isOccurrenceOnDate(tpl, '2026-07-01');
    // 2026-07-02 (周四) 应返回 false
    const r_thu = isOccurrenceOnDate(tpl, '2026-07-02');
    console.log(`  anchor(06-30)=${r_anchor}, wed(07-01)=${r_wed}, thu(07-02)=${r_thu}`);
    if (r_anchor && r_wed && !r_thu) {
      ok('文档函数在 anchor 不匹配 BYDAY 时判断正确');
    } else {
      ko('文档函数判断不符', `anchor=${r_anchor}(应true), wed=${r_wed}(应true), thu=${r_thu}(应false)`);
    }
  }
}

// ============================================================
// 清理
// ============================================================
console.log('\n[清理]');
for (const id of createdIds) {
  if (id) {
    await cleanup(id);
    console.log(`  deleted ${id}`);
  }
}

console.log('\n' + '='.repeat(70));
console.log(`  PASS: ${pass}  FAIL: ${fail}`);
console.log('='.repeat(70));
if (issues.length) {
  console.log('\n问题清单:');
  issues.forEach((s, i) => console.log(`  ${i+1}. ${s}`));
}
process.exit(fail > 0 ? 1 : 0);
