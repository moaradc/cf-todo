import { describe, it, expect } from 'vitest';
import { validateExdates, processRRule } from '../../src/recurring-engine.js';

describe('BUG-001: type=none/fragment 应强制清空 exdates', () => {
  function computeFinalExdates(type: string, bodyExdates: unknown) {
    const exdatesResult = validateExdates(bodyExdates as string);
    if (exdatesResult.error) return { ok: false, error: exdatesResult.error };
    const final_exdates = (type === 'none' || type === 'fragment') ? '[]' : exdatesResult.value;
    return { ok: true, value: final_exdates };
  }

  it('type=none + exdates=["2026-07-09"] → "[]"', () => {
    expect(computeFinalExdates('none', '["2026-07-09"]')).toEqual({ ok: true, value: '[]' });
  });

  it('type=fragment + exdates=["2026-07-09"] → "[]"', () => {
    expect(computeFinalExdates('fragment', '["2026-07-09"]')).toEqual({ ok: true, value: '[]' });
  });

  it('type=recurring + exdates=["2026-07-09"] → 保留用户值', () => {
    expect(computeFinalExdates('recurring', '["2026-07-09"]')).toEqual({ ok: true, value: '["2026-07-09"]' });
  });

  it('type=none + exdates=null → "[]"', () => {
    expect(computeFinalExdates('none', null)).toEqual({ ok: true, value: '[]' });
  });

  it('type=none + exdates="" → "[]"', () => {
    expect(computeFinalExdates('none', '')).toEqual({ ok: true, value: '[]' });
  });

  it('type=fragment + 多个日期 → "[]"', () => {
    expect(computeFinalExdates('fragment', '["2026-07-09","2026-07-10"]')).toEqual({ ok: true, value: '[]' });
  });

  it('type=none + exdates 数组形式 → "[]"', () => {
    expect(computeFinalExdates('none', ['2026-07-09'])).toEqual({ ok: true, value: '[]' });
  });

  it('非法 exdates 仍返回错误（不被 type=none 跳过校验）', () => {
    const r = computeFinalExdates('none', 'not-json');
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toBe('exdates 必须是 JSON 数组字符串');
  });

  it('非法 exdates 元素仍返回错误', () => {
    const r = computeFinalExdates('fragment', '[1, 2]');
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toContain('YYYY-MM-DD');
  });
});

describe('processRRule 与 type 联动', () => {
  it('type=none + rrule 非空 → processRRule 不报错', () => {
    const r = processRRule('FREQ=DAILY', 'none', { allowDerive: true });
    expect(r.error).toBeNull();
    expect(typeof r.value).toBe('string');
  });

  it('type=recurring + rrule=FREQ=DAILY → 规范化值', () => {
    const r = processRRule('FREQ=DAILY', 'recurring', { allowDerive: true });
    expect(r.error).toBeNull();
    expect(r.value).toBe('FREQ=DAILY');
  });

  it('type=recurring + rrule 空 → 返回空串（由调用方检查）', () => {
    const r = processRRule('', 'recurring', { allowDerive: true });
    expect(r.value).toBe('');
  });
});

describe('final_exdates 映射矩阵', () => {
  const cases: Array<{ type: string; exdates: unknown; expected: string; desc: string }> = [
    { type: 'none', exdates: '["2026-07-09"]', expected: '[]', desc: 'none 强制清空' },
    { type: 'fragment', exdates: '["2026-07-09"]', expected: '[]', desc: 'fragment 强制清空' },
    { type: 'none', exdates: null, expected: '[]', desc: 'none 无入参' },
    { type: 'none', exdates: '', expected: '[]', desc: 'none 空串' },
    { type: 'none', exdates: '[]', expected: '[]', desc: 'none 空数组' },
    { type: 'recurring', exdates: '["2026-07-09"]', expected: '["2026-07-09"]', desc: 'recurring 保留' },
    { type: 'recurring', exdates: null, expected: '[]', desc: 'recurring 无入参默认 []' },
    { type: 'recurring', exdates: '[]', expected: '[]', desc: 'recurring 空数组' },
  ];

  for (const c of cases) {
    it(`${c.desc}: type=${c.type}, exdates=${JSON.stringify(c.exdates)} → ${c.expected}`, () => {
      const r = validateExdates(c.exdates as string);
      expect(r.error).toBeNull();
      const final_exdates = (c.type === 'none' || c.type === 'fragment') ? '[]' : r.value;
      expect(final_exdates).toBe(c.expected);
    });
  }
});
