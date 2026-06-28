/**
 * Test: repeat_custom 入口开放后的引擎行为 + sanitize 校验
 *
 * 运行: node tests/test_repeat_custom.mjs
 *
 * 测试范围：
 *   1. sanitizeRepeatCustom 各种输入的接受/拒绝
 *   2. processRepeatCustom 与 repeat_type 兼容性矩阵
 *   3. buildRRuleString：custom 非空时优先 + INTERVAL/UNTIL 注入
 *   4. isOccurrenceOnDate：custom RRULE 实际展开行为
 *   5. computeUpdateActions：split-series 模板透传 repeat_custom + recurrence_changed 检测
 */

import {
  sanitizeRepeatCustom,
  processRepeatCustom,
  isOccurrenceOnDate,
  computeUpdateActions,
} from '../src/recurring-engine.js';

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}\n    expected: ${e}\n    actual:   ${a}`); }
}
function truthy(v, label) {
  if (v) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label} (expected truthy, got ${JSON.stringify(v)})`); }
}
function falsy(v, label) {
  if (!v) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label} (expected falsy, got ${JSON.stringify(v)})`); }
}

// ============================================================
// 1. sanitizeRepeatCustom
// ============================================================
console.log('\n[1] sanitizeRepeatCustom');

// 接受值
eq(sanitizeRepeatCustom(''), '', '空串 → ""');
eq(sanitizeRepeatCustom(null), '', 'null → ""');
eq(sanitizeRepeatCustom(undefined), '', 'undefined → ""');
eq(sanitizeRepeatCustom('   '), '', '纯空白 → ""');
eq(sanitizeRepeatCustom('FREQ=DAILY'), 'FREQ=DAILY', '基本 DAILY');
eq(sanitizeRepeatCustom('FREQ=WEEKLY;BYDAY=MO,WE,FR'), 'FREQ=WEEKLY;BYDAY=MO,WE,FR', 'WEEKLY + BYDAY');
eq(sanitizeRepeatCustom('FREQ=MONTHLY;BYMONTHDAY=15'), 'FREQ=MONTHLY;BYMONTHDAY=15', 'MONTHLY + BYMONTHDAY');
eq(sanitizeRepeatCustom('FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=15'), 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=15', 'YEARLY + BYMONTH + BYMONTHDAY');
eq(sanitizeRepeatCustom('FREQ=DAILY;INTERVAL=2;COUNT=10'), 'FREQ=DAILY;INTERVAL=2;COUNT=10', 'INTERVAL + COUNT');
eq(sanitizeRepeatCustom('FREQ=DAILY;UNTIL=20251231T235959Z'), 'FREQ=DAILY;UNTIL=20251231T235959Z', 'UNTIL');
eq(sanitizeRepeatCustom('RRULE:FREQ=DAILY'), 'FREQ=DAILY', 'RRULE: 前缀剥离');
eq(sanitizeRepeatCustom('RRULE:FREQ=WEEKLY;BYDAY=MO'), 'FREQ=WEEKLY;BYDAY=MO', 'RRULE: 前缀剥离 + 内容保留');
eq(sanitizeRepeatCustom('freq=weekly;byday=mo'), 'FREQ=WEEKLY;BYDAY=MO', '全大写规范化（FREQ + 其他 token）');
eq(sanitizeRepeatCustom('  FREQ=DAILY;BYDAY=MO  '), 'FREQ=DAILY;BYDAY=MO', '首尾空白 trim');

// 拒绝值
eq(sanitizeRepeatCustom('FREQ=SECONDLY'), '', '拒绝 SECONDLY');
eq(sanitizeRepeatCustom('FREQ=MINUTELY'), '', '拒绝 MINUTELY');
eq(sanitizeRepeatCustom('FREQ=HOURLY'), '', '拒绝 HOURLY');
eq(sanitizeRepeatCustom('FREQ=INVALID'), '', '拒绝未知 FREQ');
eq(sanitizeRepeatCustom('BYDAY=MO'), '', '拒绝缺 FREQ');
eq(sanitizeRepeatCustom('INTERVAL=2;FREQ=DAILY'), '', '拒绝 FREQ 不在首位');
eq(sanitizeRepeatCustom('FREQ=DAILY\n;BYDAY=MO'), '', '拒绝含换行');
eq(sanitizeRepeatCustom('FREQ=DAILY\t;BYDAY=MO'), '', '拒绝含 TAB');
eq(sanitizeRepeatCustom('FREQ=DAILY\0'), '', '拒绝含 NUL');
eq(sanitizeRepeatCustom('FREQ=DAILY;RRULE:FREQ=WEEKLY'), '', '拒绝多 RRULE: 注入');
eq(sanitizeRepeatCustom('FREQ=' + 'X'.repeat(600)), '', '拒绝超长');
eq(sanitizeRepeatCustom(123), '', '拒绝非字符串');
eq(sanitizeRepeatCustom({}), '', '拒绝对象');

// ============================================================
// 2. processRepeatCustom
// ============================================================
console.log('\n[2] processRepeatCustom');

// 与 repeat_type 兼容性
eq(processRepeatCustom('FREQ=DAILY', 'daily'), { value: 'FREQ=DAILY', error: null }, 'daily + valid custom OK');
eq(processRepeatCustom('FREQ=DAILY', 'weekly'), { value: 'FREQ=DAILY', error: null }, 'weekly + valid custom OK（不强制 FREQ 与 type 匹配）');
eq(processRepeatCustom('FREQ=DAILY', 'none'), { value: '', error: null }, 'none → 静默清空');
eq(processRepeatCustom('FREQ=DAILY', 'fragment'), { value: '', error: null }, 'fragment → 静默清空');
eq(processRepeatCustom('', 'daily'), { value: '', error: null }, '空串 OK');
eq(processRepeatCustom(null, 'daily'), { value: '', error: null }, 'null OK');
eq(processRepeatCustom(undefined, 'daily'), { value: '', error: null }, 'undefined OK');
eq(processRepeatCustom('FREQ=SECONDLY', 'daily').error !== null, true, 'SECONDLY → error');
eq(processRepeatCustom('INVALID', 'daily').error !== null, true, '非法串 → error');
eq(processRepeatCustom(123, 'daily').error !== null, true, '非字符串 → error');

// ============================================================
// 3. buildRRuleString（通过 isOccurrenceOnDate 间接验证）
// ============================================================
console.log('\n[3] buildRRuleString 行为（通过 isOccurrenceOnDate 验证）');

// 模板：周一/三/五
const tpl_mwf = {
  repeat_type: 'weekly',
  repeat_custom: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
  anchor_date: '2026-01-05', // 周一
  repeat_end: '',
  repeat_interval: 1,
  exdates: '[]',
};
// 2026-01-05 周一, 01-06 周二, 01-07 周三, 01-08 周四, 01-09 周五
truthy(isOccurrenceOnDate(tpl_mwf, '2026-01-05'), 'MWF 模板：周一 (anchor) 命中');
falsy(isOccurrenceOnDate(tpl_mwf, '2026-01-06'), 'MWF 模板：周二不命中');
truthy(isOccurrenceOnDate(tpl_mwf, '2026-01-07'), 'MWF 模板：周三命中');
falsy(isOccurrenceOnDate(tpl_mwf, '2026-01-08'), 'MWF 模板：周四不命中');
truthy(isOccurrenceOnDate(tpl_mwf, '2026-01-09'), 'MWF 模板：周五命中');

// 模板：每 2 周（INTERVAL=2）
const tpl_biweekly = {
  repeat_type: 'weekly',
  repeat_custom: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=2',
  anchor_date: '2026-01-05', // 周一
  repeat_end: '',
  repeat_interval: 1,
  exdates: '[]',
};
truthy(isOccurrenceOnDate(tpl_biweekly, '2026-01-05'), 'biweekly：第 0 周一命中');
falsy(isOccurrenceOnDate(tpl_biweekly, '2026-01-12'), 'biweekly：第 1 周一不命中');
truthy(isOccurrenceOnDate(tpl_biweekly, '2026-01-19'), 'biweekly：第 2 周一命中');

// 模板：repeat_interval 参数覆盖 custom 中的 INTERVAL
const tpl_override = {
  repeat_type: 'weekly',
  repeat_custom: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=3',
  anchor_date: '2026-01-05',
  repeat_end: '',
  repeat_interval: 2, // 应覆盖 custom 里的 INTERVAL=3
  exdates: '[]',
};
truthy(isOccurrenceOnDate(tpl_override, '2026-01-05'), 'override：第 0 周一命中');
falsy(isOccurrenceOnDate(tpl_override, '2026-01-12'), 'override：第 1 周一不命中');
truthy(isOccurrenceOnDate(tpl_override, '2026-01-19'), 'override：第 2 周一命中（INTERVAL=2 生效，覆盖了 custom 的 3）');
falsy(isOccurrenceOnDate(tpl_override, '2026-01-26'), 'override：第 3 周一不命中');

// 模板：repeat_end 与 custom UNTIL 共存（custom 已有 UNTIL 时不覆盖）
const tpl_until = {
  repeat_type: 'daily',
  repeat_custom: 'FREQ=DAILY;UNTIL=20260110T235959Z',
  anchor_date: '2026-01-05',
  repeat_end: '2026-01-15', // 因 custom 已含 UNTIL，引擎不再追加
  repeat_interval: 1,
  exdates: '[]',
};
truthy(isOccurrenceOnDate(tpl_until, '2026-01-09'), 'until：UNTIL 前命中');
falsy(isOccurrenceOnDate(tpl_until, '2026-01-11'), 'until：UNTIL 后不命中（custom 的 UNTIL 优先）');

// 模板：repeat_end 与 custom 无 UNTIL 共存
const tpl_until2 = {
  repeat_type: 'daily',
  repeat_custom: 'FREQ=DAILY',
  anchor_date: '2026-01-05',
  repeat_end: '2026-01-08', // 引擎追加 UNTIL=20260108T235959Z
  repeat_interval: 1,
  exdates: '[]',
};
truthy(isOccurrenceOnDate(tpl_until2, '2026-01-08'), 'until2：repeat_end 当天命中');
falsy(isOccurrenceOnDate(tpl_until2, '2026-01-09'), 'until2：repeat_end 之后不命中');

// 模板：EXDATE 仍然生效
const tpl_exdate = {
  repeat_type: 'daily',
  repeat_custom: 'FREQ=DAILY',
  anchor_date: '2026-01-05',
  repeat_end: '',
  repeat_interval: 1,
  exdates: '["2026-01-06"]',
};
truthy(isOccurrenceOnDate(tpl_exdate, '2026-01-05'), 'exdate：anchor 命中');
falsy(isOccurrenceOnDate(tpl_exdate, '2026-01-06'), 'exdate：被 EXDATE 排除');
truthy(isOccurrenceOnDate(tpl_exdate, '2026-01-07'), 'exdate：次日命中');

// ============================================================
// 4. computeUpdateActions: split-series 透传 repeat_custom
// ============================================================
console.log('\n[4] computeUpdateActions: split-series 透传');

const task = {
  parent_id: 'p1',
  repeat_type: 'weekly',
  repeat_custom: '',
  repeat_interval: 1,
  is_series: true,
};
const new_values_split = {
  text: 'test',
  time: '',
  priority: 'low',
  desc: '',
  url: '',
  copy_text: '',
  subtasks: '[]',
  search_terms: '[]',
  repeat_type: 'weekly',
  repeat_custom: 'FREQ=WEEKLY;BYDAY=TU,TH',
  repeat_end: '',
  end_time: '',
  category_id: '',
  date: '2026-01-06',
  repeat_interval: 1,
};
const actions_split = computeUpdateActions({
  task,
  date: '2026-01-06',
  scope: 'thisAndFuture',
  new_values: new_values_split,
  new_date: '2026-01-06',
});
truthy(actions_split.insertTemplate, 'split：insertTemplate 存在');
eq(actions_split.insertTemplate.repeat_custom, 'FREQ=WEEKLY;BYDAY=TU,TH', 'split：insertTemplate.repeat_custom 已透传');

// ============================================================
// 5. computeUpdateActions: recurrence_changed 包含 repeat_custom 变更
// ============================================================
console.log('\n[5] computeUpdateActions: recurrence_changed 检测');

// case A: 仅 custom 变更 → recurrence_changed=true
const task_a = { parent_id: 'p1', repeat_type: 'weekly', repeat_custom: 'FREQ=WEEKLY;BYDAY=MO', repeat_interval: 1, is_series: true };
const new_a = { ...new_values_split, repeat_type: 'weekly', repeat_custom: 'FREQ=WEEKLY;BYDAY=TU,TH', repeat_interval: 1, date: '2026-01-06' };
const actions_a = computeUpdateActions({ task: task_a, date: '2026-01-06', scope: 'all', new_values: new_a, new_date: '2026-01-06' });
truthy(actions_a.template?.recurrence_changed, 'all：仅 custom 变更 → recurrence_changed=true');

// case B: 完全相同 → recurrence_changed=false
const task_b = { parent_id: 'p1', repeat_type: 'weekly', repeat_custom: 'FREQ=WEEKLY;BYDAY=MO', repeat_interval: 1, is_series: true };
const new_b = { ...new_values_split, repeat_type: 'weekly', repeat_custom: 'FREQ=WEEKLY;BYDAY=MO', repeat_interval: 1, date: '2026-01-06' };
const actions_b = computeUpdateActions({ task: task_b, date: '2026-01-06', scope: 'all', new_values: new_b, new_date: '2026-01-06' });
falsy(actions_b.template?.recurrence_changed, 'all：完全相同 → recurrence_changed=false');

// case C: scope=this → currentTodo 清空 repeat_custom
const task_c = { parent_id: 'p1', repeat_type: 'weekly', repeat_custom: 'FREQ=WEEKLY;BYDAY=MO', repeat_interval: 1, is_series: true };
const new_c = { ...new_values_split, repeat_type: 'weekly', repeat_custom: 'FREQ=WEEKLY;BYDAY=MO', repeat_interval: 1, date: '2026-01-06' };
const actions_c = computeUpdateActions({ task: task_c, date: '2026-01-06', scope: 'this', new_values: new_c, new_date: '2026-01-06' });
eq(actions_c.currentTodo.repeat_custom, '', 'this：currentTodo.repeat_custom 强制清空');
eq(actions_c.currentTodo.repeat_type, 'none', 'this：currentTodo.repeat_type 强制为 none');

// case D: scope=thisAndFuture + 改为不重复 → currentTodo 清空 repeat_custom
const task_d = { parent_id: 'p1', repeat_type: 'weekly', repeat_custom: 'FREQ=WEEKLY;BYDAY=MO', repeat_interval: 1, is_series: true };
const new_d = { ...new_values_split, repeat_type: 'none', repeat_custom: '', repeat_interval: 1, date: '2026-01-06' };
const actions_d = computeUpdateActions({ task: task_d, date: '2026-01-06', scope: 'thisAndFuture', new_values: new_d, new_date: '2026-01-06' });
eq(actions_d.currentTodo.repeat_custom, '', 'thisAndFuture→none：currentTodo.repeat_custom 强制清空');
eq(actions_d.currentTodo.repeat_type, 'none', 'thisAndFuture→none：currentTodo.repeat_type 强制为 none');

// case E: scope=all + 改为不重复 → currentTodo 清空 repeat_custom
const task_e = { parent_id: 'p1', repeat_type: 'weekly', repeat_custom: 'FREQ=WEEKLY;BYDAY=MO', repeat_interval: 1, is_series: true };
const new_e = { ...new_values_split, repeat_type: 'none', repeat_custom: '', repeat_interval: 1, date: '2026-01-06' };
const actions_e = computeUpdateActions({ task: task_e, date: '2026-01-06', scope: 'all', new_values: new_e, new_date: '2026-01-06' });
eq(actions_e.currentTodo.repeat_custom, '', 'all→none：currentTodo.repeat_custom 强制清空');
eq(actions_e.currentTodo.repeat_type, 'none', 'all→none：currentTodo.repeat_type 强制为 none');
truthy(actions_e.template?.type === 'delete', 'all→none：template.type=delete');

// ============================================================
// Summary
// ============================================================
console.log(`\n========================================`);
console.log(`  PASS: ${pass}  FAIL: ${fail}`);
console.log(`========================================`);
process.exit(fail > 0 ? 1 : 0);
