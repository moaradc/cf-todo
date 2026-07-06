/**
 * 提醒服务逻辑烟雾测试 —— 不依赖真实 D1/Resend，仅验证 normalizeConfig
 * 与时间窗口计算的正确性。完整集成测试需要 wrangler dev + miniflare。
 */
import { describe, it, expect } from 'vitest';
import { normalizeConfig } from '../../src/services/reminder-service';
import { validatePayload } from '../../src/services/resend';

describe('normalizeConfig', () => {
  it('returns defaults for empty input', () => {
    const cfg = normalizeConfig(null);
    expect(cfg.enabled).toBe(false);
    expect(cfg.lead_minutes).toBe(15);
    expect(cfg.timezone_offset).toBe(480);
    expect(cfg.recipient).toBe('');
  });

  it('clamps lead_minutes to positive range', () => {
    expect(normalizeConfig({ lead_minutes: -5 }).lead_minutes).toBe(15);
    expect(normalizeConfig({ lead_minutes: 0 }).lead_minutes).toBe(15);
    expect(normalizeConfig({ lead_minutes: 30 }).lead_minutes).toBe(30);
    expect(normalizeConfig({ lead_minutes: 99999 }).lead_minutes).toBe(1440);
  });

  it('clamps timezone_offset to [-720, 720]', () => {
    expect(normalizeConfig({ timezone_offset: 1000 }).timezone_offset).toBe(720);
    expect(normalizeConfig({ timezone_offset: -1000 }).timezone_offset).toBe(-720);
    expect(normalizeConfig({ timezone_offset: 0 }).timezone_offset).toBe(0);
    expect(normalizeConfig({ timezone_offset: -300 }).timezone_offset).toBe(-300);
  });

  it('trims string fields and validates types', () => {
    const cfg = normalizeConfig({
      enabled: true,
      recipient: '  user@example.com  ',
      from: '  cf-todo <noreply@example.com>  ',
      app_url: '  https://example.com  ',
    });
    expect(cfg.recipient).toBe('user@example.com');
    expect(cfg.from).toBe('cf-todo <noreply@example.com>');
    expect(cfg.app_url).toBe('https://example.com');
    expect(cfg.enabled).toBe(true);
  });

  it('ignores invalid enabled flag', () => {
    expect(normalizeConfig({ enabled: 'yes' }).enabled).toBe(false);
    expect(normalizeConfig({ enabled: 1 }).enabled).toBe(false);
    expect(normalizeConfig({ enabled: true }).enabled).toBe(true);
  });
});

describe('validatePayload with idempotencyKey', () => {
  it('accepts a payload with idempotencyKey without treating it as body error', () => {
    const err = validatePayload({
      from: 'cf-todo <noreply@example.com>',
      to: 'user@example.com',
      subject: 'test',
      html: '<p>hi</p>',
      idempotencyKey: 'cf-todo:abc123',
    });
    expect(err).toBeNull();
  });

  it('still rejects payload missing required fields when idempotencyKey is present', () => {
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
