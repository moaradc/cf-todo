/**
 * 提醒服务逻辑烟雾测试 —— 不依赖真实 D1/Resend，仅验证 normalizeConfig
 * 与多模式配置的正确性。完整集成测试需要 wrangler dev + miniflare。
 */
import { describe, it, expect } from 'vitest';
import { normalizeConfig, parseWeeklyDays, getLocalIsoWeekday } from '../../src/services/reminder-service';
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
