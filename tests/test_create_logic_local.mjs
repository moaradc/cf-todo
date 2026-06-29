/**
 * 本地 CREATE 场景联动逻辑验证
 * 模拟 V1 POST / V0 CREATE 的联动推导 + 原子组校验
 */
import {
  sanitizeRepeatCustom,
  processRepeatCustom,
  deriveRepeatTypeFromCustom,
  validateRepeatEndCompat,
  validateRepeatIntervalCompat,
} from '../src/recurring-engine.js';

let pass = 0, fail = 0;
const issues = [];
function ok(label) { pass++; console.log(`  ✓ ${label}`); }
function ko(label, detail) { fail++; console.log(`  ✗ ${label}`); if (detail) console.log(`    ${detail}`); issues.push(`${label}: ${detail||''}`); }

/**
 * 模拟 V1 POST / V0 CREATE 的联动推导 + 校验核心
 */
function simulateCreate(body) {
  const errors = [];

  let rpt_type = body.repeat_type || 'none';
  const customResult = processRepeatCustom(body.repeat_custom, rpt_type, { allowDerive: true });
  if (customResult.error) errors.push(customResult.error);
  const effective_repeat_custom = customResult.value;

  // 联动推导
  if (effective_repeat_custom && (rpt_type === 'none' || rpt_type === 'fragment')) {
    const derived = deriveRepeatTypeFromCustom(effective_repeat_custom);
    if (derived) rpt_type = derived;
  }

  const is_fragment = (rpt_type === 'fragment');
  // 注意：V1 POST 实际代码用 `repeat_interval || 1`，0 会被吞为 1
  // 但 validateRepeatIntervalCompat 仍会校验非正整数（如 -1, 1.5, "2"）
  const rawInterval = body.repeat_interval;
  if (rawInterval !== undefined && (typeof rawInterval !== 'number' || !Number.isInteger(rawInterval) || rawInterval < 1)) {
    errors.push('repeat_interval 必须为正整数');
  }
  const rEnd = is_fragment ? '' : (body.repeat_end || '');
  const eTime = is_fragment ? '' : (body.end_time || '');
  const rInterval = is_fragment ? 1 : (rawInterval || 1);
  const effectiveTime = is_fragment ? '' : (body.time || '');
  const final_repeat_custom = (rpt_type === 'none' || rpt_type === 'fragment') ? '' : effective_repeat_custom;

  // 原子组校验
  const repeatEndErr = validateRepeatEndCompat(rEnd, rpt_type);
  if (repeatEndErr) errors.push(repeatEndErr);
  const intervalErr = validateRepeatIntervalCompat(rInterval, rpt_type);
  if (intervalErr) errors.push(intervalErr);

  return {
    rpt_type,
    repeat_custom: final_repeat_custom,
    repeat_end: rEnd,
    end_time: eTime,
    repeat_interval: rInterval,
    time: effectiveTime,
    errors,
  };
}

console.log('='.repeat(70));
console.log('CREATE 场景联动逻辑验证');
console.log('='.repeat(70));

// 1. 只传 repeat_custom（不传 repeat_type）→ 反推
console.log('\n[1] 只传 repeat_custom，不传 repeat_type');
const r1 = simulateCreate({ date: '2026-06-29', text: 'test', repeat_custom: 'FREQ=WEEKLY;BYDAY=MO,WE,FR' });
if (r1.errors.length === 0) {
  if (r1.rpt_type === 'weekly') ok('repeat_type 反推为 weekly');
  else ko('反推失败', r1.rpt_type);
  if (r1.repeat_custom === 'FREQ=WEEKLY;BYDAY=MO,WE,FR') ok('repeat_custom 保留');
  else ko('repeat_custom 丢失', r1.repeat_custom);
} else ko('不应有错误', JSON.stringify(r1.errors));

// 2. repeat_type=none + repeat_custom → 反推
console.log('\n[2] repeat_type=none + repeat_custom → 反推');
const r2 = simulateCreate({ date: '2026-06-29', text: 'test', repeat_type: 'none', repeat_custom: 'FREQ=DAILY' });
if (r2.errors.length === 0) {
  if (r2.rpt_type === 'daily') ok('反推为 daily');
  else ko('反推失败', r2.rpt_type);
} else ko('不应有错误', JSON.stringify(r2.errors));

// 3. repeat_type=none + repeat_end → 400
console.log('\n[3] repeat_type=none + repeat_end → 400');
const r3 = simulateCreate({ date: '2026-06-29', text: 'test', repeat_type: 'none', repeat_end: '2026-12-31' });
if (r3.errors.some(e => e.includes('repeat_end'))) ok('repeat_end + none → 400');
else ko('应报错', JSON.stringify(r3.errors));

// 4. repeat_type=none + repeat_interval=2 → 400
console.log('\n[4] repeat_type=none + repeat_interval=2 → 400');
const r4 = simulateCreate({ date: '2026-06-29', text: 'test', repeat_type: 'none', repeat_interval: 2 });
if (r4.errors.some(e => e.includes('repeat_interval'))) ok('repeat_interval=2 + none → 400');
else ko('应报错', JSON.stringify(r4.errors));

// 5. time/end_time 解耦——跨日/反序不再被拒
console.log('\n[5] time=18:00, end_time=09:00（展示型字段解耦，允许）');
const r5 = simulateCreate({ date: '2026-06-29', text: 'test', time: '18:00', end_time: '09:00' });
if (r5.errors.length === 0) ok('跨日/反序组合不再被拒');
else ko('不应报错', JSON.stringify(r5.errors));

// 6. repeat_type=fragment + 各种字段 → 联动清空
console.log('\n[6] repeat_type=fragment + time/end_time/repeat_end → 联动清空');
const r6 = simulateCreate({
  date: '', text: 'fragment test', repeat_type: 'fragment',
  time: '09:00', end_time: '10:00', repeat_end: '2026-12-31', repeat_interval: 3
});
if (r6.errors.length === 0) {
  if (r6.time === '') ok('time 清空'); else ko('time 未清空', r6.time);
  if (r6.end_time === '') ok('end_time 清空'); else ko('end_time 未清空', r6.end_time);
  if (r6.repeat_end === '') ok('repeat_end 清空'); else ko('repeat_end 未清空', r6.repeat_end);
  if (r6.repeat_interval === 1) ok('repeat_interval=1'); else ko('repeat_interval 未重置', r6.repeat_interval);
} else ko('不应有错误', JSON.stringify(r6.errors));

// 7. repeat_interval=-1 → 400（0 在实际代码里被 `|| 1` 吞掉，但 -1 会被拦截）
console.log('\n[7] repeat_interval=-1 → 400');
const r7 = simulateCreate({ date: '2026-06-29', text: 'test', repeat_type: 'weekly', repeat_interval: -1 });
if (r7.errors.some(e => e.includes('repeat_interval'))) ok('repeat_interval=-1 → 400');
else ko('应报错', JSON.stringify(r7.errors));

// 7b. repeat_interval=1.5 → 400（非整数）
console.log('\n[7b] repeat_interval=1.5 → 400');
const r7b = simulateCreate({ date: '2026-06-29', text: 'test', repeat_type: 'weekly', repeat_interval: 1.5 });
if (r7b.errors.some(e => e.includes('repeat_interval'))) ok('repeat_interval=1.5 → 400');
else ko('应报错', JSON.stringify(r7b.errors));

// 8. 正常创建 weekly + repeat_end → 通过
console.log('\n[8] 正常 weekly + repeat_end → 通过');
const r8 = simulateCreate({ date: '2026-06-29', text: 'test', repeat_type: 'weekly', repeat_end: '2026-12-31', repeat_interval: 2 });
if (r8.errors.length === 0) {
  if (r8.rpt_type === 'weekly') ok('weekly');
  if (r8.repeat_end === '2026-12-31') ok('repeat_end 保留');
  if (r8.repeat_interval === 2) ok('repeat_interval=2');
} else ko('不应有错误', JSON.stringify(r8.errors));

// 9. repeat_custom + repeat_end 组合（custom 反推后 repeat_end 兼容）
console.log('\n[9] repeat_custom + repeat_end 组合（反推后兼容）');
const r9 = simulateCreate({
  date: '2026-06-29', text: 'test',
  repeat_custom: 'FREQ=DAILY',  // 反推 daily
  repeat_end: '2026-12-31'      // daily + repeat_end 兼容
});
if (r9.errors.length === 0) {
  if (r9.rpt_type === 'daily') ok('反推 daily');
  if (r9.repeat_end === '2026-12-31') ok('repeat_end 通过');
} else ko('不应有错误', JSON.stringify(r9.errors));

// 10. repeat_custom + repeat_interval=2 组合
console.log('\n[10] repeat_custom + repeat_interval=2 组合');
const r10 = simulateCreate({
  date: '2026-06-29', text: 'test',
  repeat_custom: 'FREQ=WEEKLY;BYDAY=MO',
  repeat_interval: 2
});
if (r10.errors.length === 0) {
  if (r10.rpt_type === 'weekly') ok('反推 weekly');
  if (r10.repeat_interval === 2) ok('repeat_interval=2 保留');
} else ko('不应有错误', JSON.stringify(r10.errors));

console.log('\n' + '='.repeat(70));
console.log(`  PASS: ${pass}  FAIL: ${fail}`);
console.log('='.repeat(70));
if (issues.length) {
  console.log('\n问题清单:');
  issues.forEach((s, i) => console.log(`  ${i+1}. ${s}`));
}
process.exit(fail > 0 ? 1 : 0);
