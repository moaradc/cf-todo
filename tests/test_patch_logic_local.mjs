/**
 * 本地联动逻辑验证（不依赖部署）
 * 直接测试 V1/V0 处理器中提取的联动逻辑核心
 *
 * 模拟 DB existing 记录 + 构建 PATCH 请求体 → 验证 new_values 推导结果
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
 * 模拟 V1 PUT / V0 UPDATE 的联动推导核心逻辑
 * 提取自 api-v1.js / api.js 的 patch 语义 + 联动推导 + 校验
 */
function simulatePatchUpdate(existing, body) {
  const errors = [];

  // 1. PATCH 语义：未传字段从 existing 回退
  let rpt_type = body.repeat_type !== undefined ? body.repeat_type : (existing.repeat_type || 'none');

  // 2. repeat_custom 处理（PATCH 语义，allowDerive=true）
  let effective_repeat_custom;
  if (body.repeat_custom !== undefined) {
    const customResult = processRepeatCustom(body.repeat_custom, rpt_type, { allowDerive: true });
    if (customResult.error) errors.push(customResult.error);
    else effective_repeat_custom = customResult.value;
  } else {
    if (rpt_type === 'none' || rpt_type === 'fragment') {
      effective_repeat_custom = '';
    } else {
      effective_repeat_custom = sanitizeRepeatCustom(existing.repeat_custom);
    }
  }

  // 3. 联动推导：repeat_custom 非空时反推 repeat_type
  if (effective_repeat_custom && (rpt_type === 'none' || rpt_type === 'fragment')) {
    const derived = deriveRepeatTypeFromCustom(effective_repeat_custom);
    if (derived) rpt_type = derived;
  }

  // 4. 构建 new_values（PATCH 语义）
  const new_values = {
    text: body.text !== undefined ? body.text : existing.text,
    time: body.time !== undefined ? body.time : (existing.time || ''),
    repeat_type: rpt_type,
    repeat_custom: effective_repeat_custom,
    repeat_end: body.repeat_end !== undefined ? body.repeat_end : (existing.repeat_end || ''),
    end_time: body.end_time !== undefined ? body.end_time : (existing.end_time || ''),
    repeat_interval: body.repeat_interval !== undefined ? body.repeat_interval : (existing.repeat_interval || 1),
  };

  // 5. fragment/none 强制清空
  if (new_values.repeat_type === 'fragment') {
    new_values.time = '';
    new_values.end_time = '';
    new_values.repeat_end = '';
    new_values.repeat_interval = 1;
    new_values.repeat_custom = '';
  }
  if (new_values.repeat_type === 'none') {
    new_values.repeat_custom = '';
  }

  // 6. 原子组校验
  const repeatEndErr = validateRepeatEndCompat(new_values.repeat_end, new_values.repeat_type);
  if (repeatEndErr) errors.push(repeatEndErr);
  const intervalErr = validateRepeatIntervalCompat(new_values.repeat_interval, new_values.repeat_type);
  if (intervalErr) errors.push(intervalErr);

  return { new_values, errors };
}

console.log('='.repeat(70));
console.log('本地联动逻辑验证（模拟 V1 PUT / V0 UPDATE 核心）');
console.log('='.repeat(70));

// ============================================================
// 1. 独立字段 PATCH：只传 text，其他保留
// ============================================================
console.log('\n[1] 独立字段 PATCH（只传 text）');
const existing1 = {
  text: '原始', desc: '原始描述', url: 'https://orig.com', priority: 'high',
  repeat_type: 'weekly', repeat_interval: 2, repeat_end: '2026-12-31',
  time: '09:00', end_time: '10:00', repeat_custom: 'FREQ=WEEKLY;BYDAY=MO'
};
const r1 = simulatePatchUpdate(existing1, { text: '改名' });
if (r1.errors.length === 0) {
  const d = r1.new_values;
  if (d.text === '改名') ok('text 已更新'); else ko('text 未更新');
  if (d.repeat_type === 'weekly') ok('repeat_type 保留'); else ko('repeat_type 未保留', d.repeat_type);
  if (d.repeat_interval === 2) ok('repeat_interval 保留'); else ko('repeat_interval 未保留', d.repeat_interval);
  if (d.repeat_end === '2026-12-31') ok('repeat_end 保留'); else ko('repeat_end 未保留', d.repeat_end);
  if (d.repeat_custom === 'FREQ=WEEKLY;BYDAY=MO') ok('repeat_custom 保留'); else ko('repeat_custom 未保留', d.repeat_custom);
  if (d.time === '09:00') ok('time 保留'); else ko('time 未保留', d.time);
} else {
  ko('不应有错误', JSON.stringify(r1.errors));
}

// ============================================================
// 2. 联动推导：repeat_custom 反推 repeat_type（none → weekly）
// ============================================================
console.log('\n[2] 联动推导（repeat_custom 反推 repeat_type）');
const existing2 = { text: '测试', repeat_type: 'none', repeat_interval: 1 };
const r2 = simulatePatchUpdate(existing2, { repeat_custom: 'FREQ=WEEKLY;BYDAY=MO,WE,FR' });
if (r2.errors.length === 0) {
  if (r2.new_values.repeat_type === 'weekly') ok('repeat_type 反推为 weekly');
  else ko('repeat_type 未反推', r2.new_values.repeat_type);
  if (r2.new_values.repeat_custom === 'FREQ=WEEKLY;BYDAY=MO,WE,FR') ok('repeat_custom 已写入');
  else ko('repeat_custom 未写入', r2.new_values.repeat_custom);
} else {
  ko('不应有错误', JSON.stringify(r2.errors));
}

// ============================================================
// 3. fragment 强制清空
// ============================================================
console.log('\n[3] fragment 强制清空联动字段');
const existing3 = {
  text: '转fragment', repeat_type: 'weekly',
  time: '09:00', end_time: '10:00', repeat_end: '2026-12-31', repeat_interval: 2
};
const r3 = simulatePatchUpdate(existing3, { repeat_type: 'fragment' });
if (r3.errors.length === 0) {
  const d = r3.new_values;
  if (d.repeat_type === 'fragment') ok('repeat_type=fragment'); else ko('repeat_type 未改', d.repeat_type);
  if (d.time === '') ok('time 清空'); else ko('time 未清空', d.time);
  if (d.end_time === '') ok('end_time 清空'); else ko('end_time 未清空', d.end_time);
  if (d.repeat_end === '') ok('repeat_end 清空'); else ko('repeat_end 未清空', d.repeat_end);
  if (d.repeat_interval === 1) ok('repeat_interval=1'); else ko('repeat_interval 未重置', d.repeat_interval);
} else {
  ko('不应有错误', JSON.stringify(r3.errors));
}

// ============================================================
// 4. 原子组冲突：repeat_end + repeat_type=none
// ============================================================
console.log('\n[4] 原子组冲突：repeat_end + repeat_type=none');
const existing4 = { text: '冲突', repeat_type: 'none' };
const r4 = simulatePatchUpdate(existing4, { repeat_end: '2026-12-31' });
if (r4.errors.length > 0 && r4.errors.some(e => e.includes('repeat_end'))) {
  ok('repeat_end + none → 400');
} else {
  ko('应报错 repeat_end 冲突', JSON.stringify(r4.errors));
}

// ============================================================
// 5. repeat_type=fragment + repeat_end：fragment 联动清空 repeat_end，无冲突
// ============================================================
console.log('\n[5] repeat_type=fragment + repeat_end（fragment 联动清空，无冲突）');
const r5 = simulatePatchUpdate(existing4, { repeat_type: 'fragment', repeat_end: '2026-12-31' });
if (r5.errors.length === 0) {
  if (r5.new_values.repeat_type === 'fragment') ok('repeat_type=fragment');
  else ko('repeat_type 未改', r5.new_values.repeat_type);
  if (r5.new_values.repeat_end === '') ok('repeat_end 被 fragment 联动清空（无冲突）');
  else ko('repeat_end 未清空', r5.new_values.repeat_end);
} else {
  ko('不应有错误（fragment 联动清空 repeat_end）', JSON.stringify(r5.errors));
}

// ============================================================
// 6. time/end_time 解耦——跨日/反序不再被拒
// ============================================================
console.log('\n[6] time=18:00, end_time=09:00（展示型字段解耦，允许）');
const existing6 = { text: '时间冲突', repeat_type: 'none' };
const r6 = simulatePatchUpdate(existing6, { time: '18:00', end_time: '09:00' });
if (r6.errors.length === 0) {
  ok('跨日/反序组合不再被拒');
} else {
  ko('不应报错', JSON.stringify(r6.errors));
}

// ============================================================
// 7. 原子组冲突：repeat_interval=2 + repeat_type=none
// ============================================================
console.log('\n[7] 原子组冲突：repeat_interval=2 + repeat_type=none');
const r7 = simulatePatchUpdate(existing6, { repeat_interval: 2 });
if (r7.errors.length > 0 && r7.errors.some(e => e.includes('repeat_interval'))) {
  ok('repeat_interval=2 + none → 400');
} else {
  ko('应报错 repeat_interval 冲突', JSON.stringify(r7.errors));
}

// ============================================================
// 8. 联动推导 + 校验组合：custom 反推 + repeat_end 兼容
// ============================================================
console.log('\n[8] 组合场景：custom 反推 + repeat_end 兼容');
const existing8 = { text: '组合', repeat_type: 'none' };
const r8 = simulatePatchUpdate(existing8, {
  repeat_custom: 'FREQ=DAILY',
  repeat_end: '2026-12-31'  // 应通过，因 custom 反推后 repeat_type=daily
});
if (r8.errors.length === 0) {
  if (r8.new_values.repeat_type === 'daily') ok('custom 反推 daily');
  else ko('反推失败', r8.new_values.repeat_type);
  if (r8.new_values.repeat_end === '2026-12-31') ok('repeat_end 通过校验');
  else ko('repeat_end 被错误清空', r8.new_values.repeat_end);
} else {
  ko('不应有错误', JSON.stringify(r8.errors));
}

// ============================================================
// 9. 显式清空：repeat_custom=null
// ============================================================
console.log('\n[9] 显式清空 repeat_custom=null');
const existing9 = { text: '清空', repeat_type: 'weekly', repeat_custom: 'FREQ=WEEKLY;BYDAY=MO' };
const r9 = simulatePatchUpdate(existing9, { repeat_custom: null });
if (r9.errors.length === 0) {
  if (r9.new_values.repeat_custom === '') ok('repeat_custom 已清空');
  else ko('repeat_custom 未清空', r9.new_values.repeat_custom);
  if (r9.new_values.repeat_type === 'weekly') ok('repeat_type 保留');
  else ko('repeat_type 未保留', r9.new_values.repeat_type);
} else {
  ko('不应有错误', JSON.stringify(r9.errors));
}

// ============================================================
// 10. 显式清空：repeat_custom=""
// ============================================================
console.log('\n[10] 显式清空 repeat_custom=""');
const r10 = simulatePatchUpdate(existing9, { repeat_custom: '' });
if (r10.errors.length === 0) {
  if (r10.new_values.repeat_custom === '') ok('repeat_custom 已清空');
  else ko('repeat_custom 未清空', r10.new_values.repeat_custom);
} else {
  ko('不应有错误', JSON.stringify(r10.errors));
}

console.log('\n' + '='.repeat(70));
console.log(`  PASS: ${pass}  FAIL: ${fail}`);
console.log('='.repeat(70));
if (issues.length) {
  console.log('\n问题清单:');
  issues.forEach((s, i) => console.log(`  ${i+1}. ${s}`));
}
process.exit(fail > 0 ? 1 : 0);
