/**
 * V0 提醒配置路由：管理定时提醒的收件人 / 发件人 / 提前量等设置。
 *
 * 路由：
 *   - GET  /api/reminder/config  读取当前配置
 *   - POST /api/reminder/config  更新配置
 *   - POST /api/reminder/test    发送一封测试邮件
 *
 * 鉴权：cookie / API Key（挂载在 v0 authedApp 下）。
 */

import { Hono } from 'hono';
import { apiError } from '../../utils.js';
import { createDb } from '../../db/client';
import {
  getReminderConfig,
  setReminderConfig,
  normalizeConfig,
  sendTestEmail,
} from '../../services/reminder-service';
import type { V0AppEnv } from './index';

export const reminderApp = new Hono<V0AppEnv>();

function jsonBody(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

reminderApp.get('/reminder/config', async (c) => {
  const db = createDb(c.env.DB);
  const cfg = await getReminderConfig(db);
  return jsonBody(cfg);
});

reminderApp.post('/reminder/config', async (c) => {
  let payload: unknown;
  try {
    payload = await c.req.raw.json();
  } catch {
    return apiError('请求体不是有效的 JSON', 400);
  }
  if (!payload || typeof payload !== 'object') {
    return apiError('配置必须为 JSON 对象', 400);
  }

  const cfg = normalizeConfig(payload);

  // 启用时强制校验收件人 / 发件人，避免保存后无法实际发信
  if (cfg.enabled) {
    if (!cfg.recipient) return apiError('启用提醒时 recipient 不能为空', 400);
    if (!cfg.from) return apiError('启用提醒时 from 不能为空', 400);
    if (!c.env.RESEND_API_KEY) {
      return apiError('未配置 RESEND_API_KEY 环境变量，无法启用提醒', 400);
    }
  }

  const db = createDb(c.env.DB);
  await setReminderConfig(db, cfg);
  return jsonBody({ success: true, config: cfg });
});

reminderApp.post('/reminder/test', async (c) => {
  const db = createDb(c.env.DB);
  const cfg = await getReminderConfig(db);
  if (!cfg.recipient || !cfg.from) {
    return apiError('请先配置 recipient 和 from', 400);
  }
  const result = await sendTestEmail(c.env, cfg);
  if (!result.ok) {
    return jsonBody({ success: false, error: result.error }, 502);
  }
  return jsonBody({ success: true, id: result.id });
});
