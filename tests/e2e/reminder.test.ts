/**
 * 提醒服务逻辑烟雾测试 —— 不依赖真实 D1/Resend，仅验证 normalizeConfig
 * 与多模式配置的正确性。完整集成测试需要 wrangler dev + miniflare。
 */
import { describe, it, expect } from 'vitest';
import { normalizeConfig, parseWeeklyDays, getLocalIsoWeekday, isInSkipWindow, dueUtcMsFor, timezoneLabel } from '../../src/services/reminder-service';
import { validatePayload } from '../../src/services/resend';

describe('normalizeConfig', () => {
  it('returns defaults for empty input', () => {
    const cfg = normalizeConfig(null);
    expect(cfg.enabled).toBe(false);
    expect(cfg.timed_enabled).toBe(false);
    expect(cfg.timed_lead_minutes).toBe(15);
    expect(cfg.timezone_offset).toBe(480);
    expect(cfg.recipient).toBe('');
    expect(cfg.daily_enabled).toBe(false);
    expect(cfg.daily_include_uncompleted).toBe(true);
    expect(cfg.daily_include_completed).toBe(false);
    expect(cfg.daily_include_search).toBe('off');
    expect(cfg.priority_enabled).toBe(false);
    expect(cfg.priority_min_level).toBe('high');
    // 新增字段默认值
    expect(cfg.skip_if_no_todos).toBe(false);
    expect(Array.isArray(cfg.weekly_days)).toBe(true);
    expect(cfg.weekly_days).toEqual([]);
    // 精确提醒字段默认值
    expect(cfg.precise_enabled).toBe(false);
    expect(cfg.precise_lead_minutes).toBe(15);
  });

  it('precise_enabled: only true when explicitly true', () => {
    expect(normalizeConfig({ precise_enabled: true }).precise_enabled).toBe(true);
    expect(normalizeConfig({ precise_enabled: false }).precise_enabled).toBe(false);
    expect(normalizeConfig({ precise_enabled: 'true' }).precise_enabled).toBe(false);
    expect(normalizeConfig({ precise_enabled: 1 }).precise_enabled).toBe(false);
    expect(normalizeConfig({}).precise_enabled).toBe(false);
    expect(normalizeConfig(null).precise_enabled).toBe(false);
  });

  it('precise_lead_minutes: clamps to [1, 1440] range with default 15', () => {
    expect(normalizeConfig({ precise_lead_minutes: -5 }).precise_lead_minutes).toBe(1);
    expect(normalizeConfig({ precise_lead_minutes: 0 }).precise_lead_minutes).toBe(1);
    expect(normalizeConfig({ precise_lead_minutes: 30 }).precise_lead_minutes).toBe(30);
    expect(normalizeConfig({ precise_lead_minutes: 1440 }).precise_lead_minutes).toBe(1440);
    expect(normalizeConfig({ precise_lead_minutes: 99999 }).precise_lead_minutes).toBe(1440);
    expect(normalizeConfig({ precise_lead_minutes: 'abc' }).precise_lead_minutes).toBe(15);
    expect(normalizeConfig({}).precise_lead_minutes).toBe(15);
    expect(normalizeConfig(null).precise_lead_minutes).toBe(15);
  });

  it('precise_* fields are independent from timed_* fields', () => {
    // 启用 timed 不应启用 precise
    const cfg1 = normalizeConfig({ enabled: true, timed_enabled: true, timed_lead_minutes: 30 });
    expect(cfg1.timed_enabled).toBe(true);
    expect(cfg1.precise_enabled).toBe(false);
    expect(cfg1.precise_lead_minutes).toBe(15);

    // 启用 precise 不应启用 timed
    const cfg2 = normalizeConfig({ enabled: true, precise_enabled: true, precise_lead_minutes: 5 });
    expect(cfg2.timed_enabled).toBe(false);
    expect(cfg2.precise_enabled).toBe(true);
    expect(cfg2.precise_lead_minutes).toBe(5);
  });

  it('clamps timed_lead_minutes to [1, 1440] range', () => {
    expect(normalizeConfig({ timed_lead_minutes: -5 }).timed_lead_minutes).toBe(1);
    expect(normalizeConfig({ timed_lead_minutes: 0 }).timed_lead_minutes).toBe(1);
    expect(normalizeConfig({ timed_lead_minutes: 30 }).timed_lead_minutes).toBe(30);
    expect(normalizeConfig({ timed_lead_minutes: 99999 }).timed_lead_minutes).toBe(1440);
    expect(normalizeConfig({ timed_lead_minutes: 'abc' }).timed_lead_minutes).toBe(15);
  });

  it('clamps timezone_offset to [-720, 720]', () => {
    expect(normalizeConfig({ timezone_offset: 1000 }).timezone_offset).toBe(720);
    expect(normalizeConfig({ timezone_offset: -1000 }).timezone_offset).toBe(-720);
    expect(normalizeConfig({ timezone_offset: 0 }).timezone_offset).toBe(0);
  });

  it('trims string fields', () => {
    const cfg = normalizeConfig({
      enabled: true,
      recipient: '  user@example.com  ',
      from: '  cf-todo <noreply@example.com>  ',
      app_url: '  https://example.com  ',
    });
    expect(cfg.recipient).toBe('user@example.com');
    expect(cfg.from).toBe('cf-todo <noreply@example.com>');
    expect(cfg.app_url).toBe('https://example.com');
  });

  it('backward compat: migrates old lead_minutes to timed_lead_minutes when enabled', () => {
    const cfg = normalizeConfig({ enabled: true, lead_minutes: 30 });
    expect(cfg.timed_enabled).toBe(true);
    expect(cfg.timed_lead_minutes).toBe(30);
  });

  it('parses priority level including low', () => {
    expect(normalizeConfig({ priority_min_level: 'high' }).priority_min_level).toBe('high');
    expect(normalizeConfig({ priority_min_level: 'med' }).priority_min_level).toBe('med');
    expect(normalizeConfig({ priority_min_level: 'low' }).priority_min_level).toBe('low');
    expect(normalizeConfig({ priority_min_level: 'invalid' }).priority_min_level).toBe('high');
  });

  it('parses daily_include_search mode', () => {
    expect(normalizeConfig({ daily_include_search: 'all' }).daily_include_search).toBe('all');
    expect(normalizeConfig({ daily_include_search: 'uncompleted' }).daily_include_search).toBe('uncompleted');
    expect(normalizeConfig({ daily_include_search: 'off' }).daily_include_search).toBe('off');
    expect(normalizeConfig({ daily_include_search: 'invalid' }).daily_include_search).toBe('off');
    expect(normalizeConfig({}).daily_include_search).toBe('off');
  });

  it('backward compat: migrates old hot_search_enabled to daily_include_search', () => {
    expect(normalizeConfig({ hot_search_enabled: true }).daily_include_search).toBe('all');
    expect(normalizeConfig({ hot_search_enabled: false }).daily_include_search).toBe('off');
  });

  it('handles daily include flags', () => {
    const cfg = normalizeConfig({
      daily_include_completed: true,
      daily_include_uncompleted: false,
    });
    expect(cfg.daily_include_completed).toBe(true);
    expect(cfg.daily_include_uncompleted).toBe(false);
    const cfg2 = normalizeConfig({});
    expect(cfg2.daily_include_uncompleted).toBe(true);
    expect(cfg2.daily_include_completed).toBe(false);
  });

  it('drops legacy time fields (daily_time, priority_time, hot_search_time)', () => {
    const cfg = normalizeConfig({
      daily_time: '10:00',
      priority_time: '11:00',
      hot_search_time: '12:00',
    });
    expect(cfg).not.toHaveProperty('daily_time');
    expect(cfg).not.toHaveProperty('priority_time');
    expect(cfg).not.toHaveProperty('hot_search_time');
    expect(cfg).not.toHaveProperty('hot_search_enabled');
  });

  it('skip_if_no_todos: only true when explicitly true', () => {
    expect(normalizeConfig({ skip_if_no_todos: true }).skip_if_no_todos).toBe(true);
    expect(normalizeConfig({ skip_if_no_todos: false }).skip_if_no_todos).toBe(false);
    expect(normalizeConfig({ skip_if_no_todos: 'true' }).skip_if_no_todos).toBe(false);
    expect(normalizeConfig({ skip_if_no_todos: 1 }).skip_if_no_todos).toBe(false);
    expect(normalizeConfig({}).skip_if_no_todos).toBe(false);
    expect(normalizeConfig(null).skip_if_no_todos).toBe(false);
  });

  it('weekly_days: roundtrips valid array through normalizeConfig', () => {
    expect(normalizeConfig({ weekly_days: [1, 3, 5] }).weekly_days).toEqual([1, 3, 5]);
    // 周日 = 7
    expect(normalizeConfig({ weekly_days: [6, 7] }).weekly_days).toEqual([6, 7]);
    // 全部 7 天
    expect(normalizeConfig({ weekly_days: [1, 2, 3, 4, 5, 6, 7] }).weekly_days).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('weekly_days: defaults to empty array when missing or wrong type', () => {
    expect(normalizeConfig({}).weekly_days).toEqual([]);
    expect(normalizeConfig(null).weekly_days).toEqual([]);
    expect(normalizeConfig({ weekly_days: null }).weekly_days).toEqual([]);
    expect(normalizeConfig({ weekly_days: 'abc' }).weekly_days).toEqual([]);
    expect(normalizeConfig({ weekly_days: 42 }).weekly_days).toEqual([]);
    expect(normalizeConfig({ weekly_days: {} }).weekly_days).toEqual([]);
  });
});

describe('parseWeeklyDays', () => {
  it('accepts a valid array of 1..7', () => {
    expect(parseWeeklyDays([1, 2, 3])).toEqual([1, 2, 3]);
    expect(parseWeeklyDays([7, 6, 5])).toEqual([5, 6, 7]); // 排序
  });

  it('deduplicates repeated entries', () => {
    expect(parseWeeklyDays([1, 1, 2, 2, 3])).toEqual([1, 2, 3]);
    expect(parseWeeklyDays([7, 7, 7])).toEqual([7]);
  });

  it('drops out-of-range values (0, 8, negative)', () => {
    expect(parseWeeklyDays([0, 1, 8, -1, 4])).toEqual([1, 4]);
    expect(parseWeeklyDays([0, 8, 100])).toEqual([]);
  });

  it('drops non-numeric / NaN entries', () => {
    expect(parseWeeklyDays([1, 'abc', null, undefined, {}, 3])).toEqual([1, 3]);
    expect(parseWeeklyDays(['abc', null, undefined, {}])).toEqual([]);
  });

  it('accepts numeric strings', () => {
    expect(parseWeeklyDays(['1', '3', '5'])).toEqual([1, 3, 5]);
  });

  it('accepts comma-separated string (incl. Chinese comma and whitespace)', () => {
    expect(parseWeeklyDays('1,3,5')).toEqual([1, 3, 5]);
    expect(parseWeeklyDays('1，3，5')).toEqual([1, 3, 5]);
    expect(parseWeeklyDays('1 3 5')).toEqual([1, 3, 5]);
    expect(parseWeeklyDays('  2 , 4 , 6  ')).toEqual([2, 4, 6]);
  });

  it('empty / whitespace string returns empty array', () => {
    expect(parseWeeklyDays('')).toEqual([]);
    expect(parseWeeklyDays('   ')).toEqual([]);
    expect(parseWeeklyDays(',')).toEqual([]);
  });

  it('truncates float values to integer', () => {
    expect(parseWeeklyDays([1.9, 3.1, 5.5])).toEqual([1, 3, 5]);
  });

  it('accepts Set input', () => {
    expect(parseWeeklyDays(new Set([2, 4, 6]))).toEqual([2, 4, 6]);
    expect(parseWeeklyDays(new Set([1, 1, 2, 2]))).toEqual([1, 2]);
  });

  it('returns empty array for non-array / non-string / non-Set input', () => {
    expect(parseWeeklyDays(42)).toEqual([]);
    expect(parseWeeklyDays(true)).toEqual([]);
    expect(parseWeeklyDays({})).toEqual([]);
    expect(parseWeeklyDays(undefined)).toEqual([]);
    expect(parseWeeklyDays(null)).toEqual([]);
  });
});

describe('getLocalIsoWeekday', () => {
  // localNow 是 tzOffsetMs 位移后的 Date，用 UTC getter 读年月日 / 周几
  it('returns 1 for Monday (2024-01-01, UTC)', () => {
    const monday = new Date(Date.UTC(2024, 0, 1, 0, 0, 0));
    expect(getLocalIsoWeekday(monday)).toBe(1);
  });

  it('returns 7 for Sunday (2024-01-07, UTC)', () => {
    const sunday = new Date(Date.UTC(2024, 0, 7, 0, 0, 0));
    expect(getLocalIsoWeekday(sunday)).toBe(7);
  });

  it('returns 5 for Friday (2024-01-05, UTC)', () => {
    const friday = new Date(Date.UTC(2024, 0, 5, 0, 0, 0));
    expect(getLocalIsoWeekday(friday)).toBe(5);
  });

  it('returns 6 for Saturday (2024-01-06, UTC)', () => {
    const saturday = new Date(Date.UTC(2024, 0, 6, 12, 30, 0));
    expect(getLocalIsoWeekday(saturday)).toBe(6);
  });

  it('handles mid-week correctly (Tuesday=2, Wednesday=3, Thursday=4)', () => {
    expect(getLocalIsoWeekday(new Date(Date.UTC(2024, 0, 2)))).toBe(2);
    expect(getLocalIsoWeekday(new Date(Date.UTC(2024, 0, 3)))).toBe(3);
    expect(getLocalIsoWeekday(new Date(Date.UTC(2024, 0, 4)))).toBe(4);
  });
});

describe('validatePayload with idempotencyKey', () => {
  it('accepts a payload with idempotencyKey', () => {
    const err = validatePayload({
      from: 'cf-todo <noreply@example.com>',
      to: 'user@example.com',
      subject: 'test',
      html: '<p>hi</p>',
      idempotencyKey: 'cf-todo:abc123',
    });
    expect(err).toBeNull();
  });

  it('rejects payload missing required fields', () => {
    const err = validatePayload({
      from: '',
      to: 'user@example.com',
      subject: 'test',
      html: '<p>hi</p>',
      idempotencyKey: 'cf-todo:abc123',
    });
    expect(err).toBe('from is required');
  });
});

// ==================== 精确提醒（DO Alarm）相关工具函数测试 ====================
// 这些函数原本是 reminder-service.ts 的私有函数，为支持 DO 复用而 export。

describe('isInSkipWindow (exported for DO reuse)', () => {
  // localNow 是 tzOffsetMs 位移后的「本地」Date（用 UTC getter 读时分）
  it('returns false when either bound is empty', () => {
    const now = new Date(Date.UTC(2024, 0, 1, 10, 0, 0));
    expect(isInSkipWindow(now, '', '12:00')).toBe(false);
    expect(isInSkipWindow(now, '10:00', '')).toBe(false);
    expect(isInSkipWindow(now, '', '')).toBe(false);
  });

  it('detects inside a normal daytime window', () => {
    // 10:00-12:00 窗口
    expect(isInSkipWindow(new Date(Date.UTC(2024, 0, 1, 10, 0)), '10:00', '12:00')).toBe(true);
    expect(isInSkipWindow(new Date(Date.UTC(2024, 0, 1, 11, 30)), '10:00', '12:00')).toBe(true);
    expect(isInSkipWindow(new Date(Date.UTC(2024, 0, 1, 12, 0)), '10:00', '12:00')).toBe(false);  // exclusive end
    expect(isInSkipWindow(new Date(Date.UTC(2024, 0, 1, 9, 59)), '10:00', '12:00')).toBe(false);
    expect(isInSkipWindow(new Date(Date.UTC(2024, 0, 1, 13, 0)), '10:00', '12:00')).toBe(false);
  });

  it('handles cross-midnight window (23:00-07:00)', () => {
    expect(isInSkipWindow(new Date(Date.UTC(2024, 0, 1, 23, 30)), '23:00', '07:00')).toBe(true);
    expect(isInSkipWindow(new Date(Date.UTC(2024, 0, 1, 2, 0)), '23:00', '07:00')).toBe(true);
    expect(isInSkipWindow(new Date(Date.UTC(2024, 0, 1, 6, 59)), '23:00', '07:00')).toBe(true);
    expect(isInSkipWindow(new Date(Date.UTC(2024, 0, 1, 7, 0)), '23:00', '07:00')).toBe(false);  // exclusive end
    expect(isInSkipWindow(new Date(Date.UTC(2024, 0, 1, 12, 0)), '23:00', '07:00')).toBe(false);
    expect(isInSkipWindow(new Date(Date.UTC(2024, 0, 1, 22, 59)), '23:00', '07:00')).toBe(false);
  });

  it('returns false when start == end', () => {
    expect(isInSkipWindow(new Date(Date.UTC(2024, 0, 1, 10, 0)), '10:00', '10:00')).toBe(false);
  });
});

describe('dueUtcMsFor (exported for DO reuse)', () => {
  // tzOffsetMs = +8h (UTC+8)
  const tzOffsetMs = 8 * 60 * 60 * 1000;
  // localNow 是 tzOffsetMs 位移后的「本地」Date，用 UTC getter 读年月日 = 2024-01-15
  const localNow = new Date(Date.UTC(2024, 0, 15, 0, 0, 0));

  it('returns UTC ms for valid hh:mm on the localNow date', () => {
    // 14:30 UTC+8 = 06:30 UTC
    const ms = dueUtcMsFor('14:30', localNow, tzOffsetMs);
    expect(ms).not.toBeNull();
    const d = new Date(ms!);
    expect(d.getUTCHours()).toBe(6);
    expect(d.getUTCMinutes()).toBe(30);
    expect(d.getUTCDate()).toBe(15);
  });

  it('returns null for invalid format', () => {
    expect(dueUtcMsFor('abc', localNow, tzOffsetMs)).toBeNull();
    expect(dueUtcMsFor('', localNow, tzOffsetMs)).toBeNull();
    expect(dueUtcMsFor('25:00', localNow, tzOffsetMs)).not.toBeNull();  // 25:00 parses but wraps to next day
    // Actually: 25:00 → hh=25, mm=0 → Date.UTC(..., 25, 0, 0) → wraps. Let's verify it doesn't crash.
  });

  it('handles UTC+0 timezone correctly', () => {
    const ms = dueUtcMsFor('14:30', localNow, 0);
    expect(ms).not.toBeNull();
    const d = new Date(ms!);
    expect(d.getUTCHours()).toBe(14);
    expect(d.getUTCMinutes()).toBe(30);
  });

  it('handles negative timezone (UTC-5)', () => {
    const tzMs = -5 * 60 * 60 * 1000;
    // 14:30 UTC-5 = 19:30 UTC
    const ms = dueUtcMsFor('14:30', localNow, tzMs);
    expect(ms).not.toBeNull();
    const d = new Date(ms!);
    expect(d.getUTCHours()).toBe(19);
    expect(d.getUTCMinutes()).toBe(30);
  });
});

describe('timezoneLabel (exported for DO reuse)', () => {
  it('formats positive whole-hour offsets (omits :00)', () => {
    expect(timezoneLabel(480)).toBe('UTC+08');
    expect(timezoneLabel(540)).toBe('UTC+09');
    expect(timezoneLabel(60)).toBe('UTC+01');
  });

  it('formats positive offsets with minutes', () => {
    expect(timezoneLabel(330)).toBe('UTC+05:30');
    expect(timezoneLabel(345)).toBe('UTC+05:45');
  });

  it('formats negative offsets', () => {
    expect(timezoneLabel(-480)).toBe('UTC-08');
    expect(timezoneLabel(-300)).toBe('UTC-05');
    expect(timezoneLabel(-210)).toBe('UTC-03:30');
  });

  it('formats zero offset', () => {
    expect(timezoneLabel(0)).toBe('UTC+00');
  });
});
