/**
 * 提醒服务逻辑烟雾测试 —— 不依赖真实 D1/Resend，仅验证 normalizeConfig
 * 与多模式配置的正确性。完整集成测试需要 wrangler dev + miniflare。
 */
import { describe, it, expect } from 'vitest';
import { normalizeConfig } from '../../src/services/reminder-service';
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
    expect(cfg.daily_time).toBe('08:00');
    expect(cfg.daily_include_uncompleted).toBe(true);
    expect(cfg.daily_include_completed).toBe(false);
    expect(cfg.priority_enabled).toBe(false);
    expect(cfg.priority_min_level).toBe('high');
    expect(cfg.hot_search_enabled).toBe(false);
    expect(cfg.hot_search_time).toBe('08:30');
  });

  it('clamps timed_lead_minutes to [1, 1440] range', () => {
    expect(normalizeConfig({ timed_lead_minutes: -5 }).timed_lead_minutes).toBe(1);
    expect(normalizeConfig({ timed_lead_minutes: 0 }).timed_lead_minutes).toBe(1);
    expect(normalizeConfig({ timed_lead_minutes: 30 }).timed_lead_minutes).toBe(30);
    expect(normalizeConfig({ timed_lead_minutes: 99999 }).timed_lead_minutes).toBe(1440);
    expect(normalizeConfig({ timed_lead_minutes: 'abc' }).timed_lead_minutes).toBe(15);
    expect(normalizeConfig({ timed_lead_minutes: undefined }).timed_lead_minutes).toBe(15);
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

  it('parses time strings with validation', () => {
    expect(normalizeConfig({ daily_time: '09:30' }).daily_time).toBe('09:30');
    expect(normalizeConfig({ daily_time: '25:00' }).daily_time).toBe('08:00');
    expect(normalizeConfig({ daily_time: '08:99' }).daily_time).toBe('08:00');
    expect(normalizeConfig({ daily_time: 'invalid' }).daily_time).toBe('08:00');
  });

  it('parses priority level', () => {
    expect(normalizeConfig({ priority_min_level: 'high' }).priority_min_level).toBe('high');
    expect(normalizeConfig({ priority_min_level: 'med' }).priority_min_level).toBe('med');
    expect(normalizeConfig({ priority_min_level: 'low' }).priority_min_level).toBe('low');
    expect(normalizeConfig({ priority_min_level: 'invalid' }).priority_min_level).toBe('high');
  });

  it('handles daily include flags', () => {
    const cfg = normalizeConfig({
      daily_include_completed: true,
      daily_include_uncompleted: false,
    });
    expect(cfg.daily_include_completed).toBe(true);
    expect(cfg.daily_include_uncompleted).toBe(false);
    // default: uncompleted true, completed false
    const cfg2 = normalizeConfig({});
    expect(cfg2.daily_include_uncompleted).toBe(true);
    expect(cfg2.daily_include_completed).toBe(false);
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
