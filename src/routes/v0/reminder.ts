/**
 * V0 提醒路由：digest 配置 + 精确提醒调度（DO Alarm）。
 *
 * 路由（v0 authedApp 下，前缀 /api）：
 *   digest 配置（保持不变）：
 *     - GET  /api/reminder/config   读取当前 digest 配置
 *     - POST /api/reminder/config   更新配置（含 precise_* 字段）
 *     - POST /api/reminder/test     发送一封 digest 测试邮件
 *
 *   精确提醒调度（新增，与 digest 完全独立）：
 *     - POST /api/reminder/precise/schedule   调度单条待办的精确提醒
 *     - POST /api/reminder/precise/cancel     取消某待办的所有精确提醒
 *     - GET  /api/reminder/precise/alarms     查看当前调度的 alarm（调试用）
 *
 * 鉴权：cookie / API Key（挂载在 v0 authedApp 下）。
 *
 * 设计：
 *   - 路由层不读 todos 表 —— 调用方传入快照数据（text / time / end_time / 优先级 等）
 *   - 路由层计算 runAt = dueUtcMs - leadMinutes（开始 / 到期两种事件）
 *   - DO 内部不回头读 todos，仅读 reminder_config（settings 单行）
 */

import { Hono } from 'hono';
import { apiError } from '../../utils.js';
import { createDb, createReadDb } from '../../db/client';
import {
  getReminderConfig,
  setReminderConfig,
  normalizeConfig,
  sendTestEmail,
  dueUtcMsFor,
} from '../../services/reminder-service';
import type { V0AppEnv } from './index';
import type { ScheduleEventData } from '../../do/reminder-do';

export const reminderApp = new Hono<V0AppEnv>();

// ==================== DO 单例获取 ====================

/**
 * 获取 ReminderDO 单例 stub（RPC 模式）。
 * 单实例 DO：id = 'reminder'。个人应用无需按用户分片。
 */
function getReminderDO(env: V0AppEnv['Bindings']) {
  const id = env.REMINDER_DO.idFromName('reminder');
  return env.REMINDER_DO.get(id);
}

// ==================== JSON 响应工具 ====================

function jsonBody(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ==================== digest 配置路由（保持不变） ====================

reminderApp.get('/reminder/config', async (c) => {
  const db = createReadDb(c.env.DB);
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

// ==================== 精确提醒调度路由（新增） ====================

/**
 * 校验 hh:mm 格式（与 utils 中的 validateTimeFormat 保持一致）。
 */
function isValidTimeFormat(v: unknown): boolean {
  return typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v);
}

/**
 * 校验 YYYY-MM-DD 格式。
 */
function isValidDateFormat(v: unknown): boolean {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * 从 YYYY-MM-DD + hh:mm + timezoneOffset 构造「本地」Date（UTC 视角）。
 * 用于 dueUtcMsFor：把 (date, time, tzOffset) → UTC ms。
 *
 * 思路：把 date + time 拼成 UTC 时间戳，再减去 tzOffsetMs，得到该本地时刻对应的 UTC ms。
 * 与 reminder-service.ts 中 dueUtcMsFor 的用法一致：
 *   localNow 是 tzOffsetMs 位移后的「本地」Date（用 UTC getter 读年月日）
 */
function parseLocalDateAtTime(dateStr: string, timeStr: string, tzOffsetMinutes: number): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  // tzOffsetMs 位移后的「本地」Date —— 用 UTC getter 读 = 用户视角的年月日时分
  return new Date(Date.UTC(y, mo - 1, d, h, mi, 0, 0));
}

interface ScheduleBody {
  todoId?: string;
  date?: string;          // YYYY-MM-DD
  time?: string;          // hh:mm（开始时间，可空）
  endTime?: string;       // hh:mm（结束时间，可空）
  leadMinutes?: number;   // 提前量（分钟），1..1440
  timezoneOffset?: number; // 分钟，-720..720
  // 待办快照
  text?: string;
  priority?: string;
  desc?: string;
  url?: string;
  categoryName?: string;
  categoryColor?: string;
}

/**
 * POST /api/reminder/precise/schedule
 *
 * 调度单条待办的精确提醒。会同时调度 start 和 end 两种事件（如果时间有效）。
 * 已存在的同 todoId+type 事件会被覆盖（编辑场景的刷新）。
 *
 * body 字段：
 *   - todoId (必填) 待办 ID
 *   - date   (必填) YYYY-MM-DD，待办所属日期
 *   - time   (可选) hh:mm，开始时间。为空则不调度 start 事件
 *   - endTime (可选) hh:mm，结束时间。为空则不调度 end 事件
 *   - leadMinutes (可选) 提前量分钟，1..1440，缺省时读 reminder_config.precise_lead_minutes
 *   - timezoneOffset (可选) 分钟，缺省时读 reminder_config.timezone_offset
 *   - text / priority / desc / url / categoryName / categoryColor (快照字段)
 */
reminderApp.post('/reminder/precise/schedule', async (c) => {
  let body: ScheduleBody;
  try {
    body = await c.req.raw.json() as ScheduleBody;
  } catch {
    return apiError('请求体不是有效的 JSON', 400);
  }

  if (!body || typeof body !== 'object') {
    return apiError('请求体必须为 JSON 对象', 400);
  }
  if (!body.todoId || typeof body.todoId !== 'string') {
    return apiError('todoId 为必填字段', 400);
  }
  if (!body.date || !isValidDateFormat(body.date)) {
    return apiError('date 为必填字段，格式 YYYY-MM-DD', 400);
  }
  if (body.time && !isValidTimeFormat(body.time)) {
    return apiError('time 格式应为 hh:mm', 400);
  }
  if (body.endTime && !isValidTimeFormat(body.endTime)) {
    return apiError('endTime 格式应为 hh:mm', 400);
  }
  if (!body.time && !body.endTime) {
    return apiError('time 和 endTime 至少有一个非空', 400);
  }

  // 读配置：拿 leadMinutes / timezoneOffset 缺省值，并校验 precise_enabled
  const db = createReadDb(c.env.DB);
  const cfg = await getReminderConfig(db);

  if (!cfg.precise_enabled) {
    return jsonBody({
      success: false,
      skipped: true,
      reason: 'precise_enabled is false',
    }, 200);
  }

  const leadMinutes = typeof body.leadMinutes === 'number' && Number.isFinite(body.leadMinutes)
    ? Math.max(1, Math.min(1440, Math.trunc(body.leadMinutes)))
    : cfg.precise_lead_minutes;
  const tzOffsetMinutes = typeof body.timezoneOffset === 'number' && Number.isFinite(body.timezoneOffset)
    ? Math.max(-720, Math.min(720, Math.trunc(body.timezoneOffset)))
    : cfg.timezone_offset;
  const tzOffsetMs = tzOffsetMinutes * 60 * 1000;
  const leadMs = leadMinutes * 60 * 1000;

  const snapshot: ScheduleEventData = {
    text: typeof body.text === 'string' ? body.text : '',
    time: body.time || '',
    end_time: body.endTime || '',
    priority: typeof body.priority === 'string' ? body.priority : 'low',
    desc: typeof body.desc === 'string' ? body.desc : '',
    url: typeof body.url === 'string' ? body.url : '',
    categoryName: typeof body.categoryName === 'string' ? body.categoryName : '',
    categoryColor: typeof body.categoryColor === 'string' ? body.categoryColor : '',
  };

  const stub = getReminderDO(c.env);
  const scheduled: Array<{ type: 'start' | 'end'; runAt: number }> = [];
  const now = Date.now();
  const skippedPast: Array<{ type: 'start' | 'end'; runAt: number }> = [];
  const immediateFallback: Array<{ type: 'start' | 'end'; originalRunAt: number; newRunAt: number }> = [];

  /**
   * 计算最终 runAt：
   *   - 默认 runAt = dueMs - leadMs
   *   - 若 runAt 已过期但 todo 实际到期时间仍在未来 → 兜底为 now + 1s 立即触发
   *     （场景：lead 配置增大后原 runAt 落在过去，但 todo 还没到点）
   *   - 若 todo 实际到期时间也已过去 → 跳过（避免发"已过期"邮件）
   */
  function computeRunAt(dueMs: number): { runAt: number; fallback: boolean } | null {
    const rawRunAt = dueMs - leadMs;
    if (rawRunAt > now) return { runAt: rawRunAt, fallback: false };
    // runAt 已过期；检查 todo 实际到期时间是否仍在未来
    if (dueMs > now) return { runAt: now + 1000, fallback: true };
    return null; // todo 已过期，跳过
  }

  // 调度 start 事件
  if (body.time) {
    const localDate = parseLocalDateAtTime(body.date, body.time, tzOffsetMinutes);
    const dueMs = dueUtcMsFor(body.time, localDate, tzOffsetMs);
    if (dueMs !== null) {
      const result = computeRunAt(dueMs);
      if (result) {
        await stub.scheduleEvent({ todoId: body.todoId, runAt: result.runAt, type: 'start', data: snapshot });
        scheduled.push({ type: 'start', runAt: result.runAt });
        if (result.fallback) {
          immediateFallback.push({ type: 'start', originalRunAt: dueMs - leadMs, newRunAt: result.runAt });
        }
      } else {
        skippedPast.push({ type: 'start', runAt: dueMs - leadMs });
      }
    }
  }

  // 调度 end 事件
  if (body.endTime) {
    const localDate = parseLocalDateAtTime(body.date, body.endTime, tzOffsetMinutes);
    const dueMs = dueUtcMsFor(body.endTime, localDate, tzOffsetMs);
    if (dueMs !== null) {
      const result = computeRunAt(dueMs);
      if (result) {
        await stub.scheduleEvent({ todoId: body.todoId, runAt: result.runAt, type: 'end', data: snapshot });
        scheduled.push({ type: 'end', runAt: result.runAt });
        if (result.fallback) {
          immediateFallback.push({ type: 'end', originalRunAt: dueMs - leadMs, newRunAt: result.runAt });
        }
      } else {
        skippedPast.push({ type: 'end', runAt: dueMs - leadMs });
      }
    }
  }

  return jsonBody({
    success: true,
    scheduled,
    skippedPast,
    immediateFallback,
    leadMinutes,
    timezoneOffset: tzOffsetMinutes,
  });
});

/**
 * POST /api/reminder/precise/cancel
 *
 * 取消某待办的所有精确提醒事件（start + end）。
 * 编辑 / 删除 / 完成时调用。
 *
 * body: { todoId: string }
 */
reminderApp.post('/reminder/precise/cancel', async (c) => {
  let body: { todoId?: string };
  try {
    body = await c.req.raw.json() as { todoId?: string };
  } catch {
    return apiError('请求体不是有效的 JSON', 400);
  }

  if (!body || typeof body !== 'object') {
    return apiError('请求体必须为 JSON 对象', 400);
  }
  if (!body.todoId || typeof body.todoId !== 'string') {
    return apiError('todoId 为必填字段', 400);
  }

  const stub = getReminderDO(c.env);
  const result = await stub.cancelEvent(body.todoId);
  return jsonBody({ success: true, todoId: body.todoId, remaining: result.remaining, alarm: result.alarm });
});

/**
 * GET /api/reminder/precise/alarms
 *
 * 调试用：列出当前 DO 中所有调度的精确提醒事件 + 当前 alarm 时刻。
 */
reminderApp.get('/reminder/precise/alarms', async (c) => {
  const stub = getReminderDO(c.env);
  const [events, alarm] = await Promise.all([
    stub.listEvents(),
    stub.getCurrentAlarm(),
  ]);
  return jsonBody({
    events,
    alarm,
    count: events.length,
    now: Date.now(),
  });
});

/**
 * POST /api/reminder/precise/clear-past
 *
 * 清理死事件：删除所有 runAt 已过期但仍在 storage 中的事件。
 * 死事件来源：alarm() 失败 6 次后停止重试、手动测试残留等。
 * 安全：只删 runAt <= now 的事件，不影响未来事件。
 *
 * 也会在 Cron digest 每 4 小时自动调用一次，此路由用于手动触发。
 */
reminderApp.post('/reminder/precise/clear-past', async (c) => {
  const stub = getReminderDO(c.env);
  const result = await stub.clearPast();
  return jsonBody({
    success: true,
    cleared: result.cleared,
    remaining: result.remaining,
    alarm: result.alarm,
    now: Date.now(),
  });
});

/**
 * POST /api/reminder/precise/clear-all
 *
 * 清空所有事件 + 取消 alarm（调试用，谨慎调用）。
 * 用于完全重置 DO 状态。会删除所有未来事件，包括尚未触发的有效提醒。
 */
reminderApp.post('/reminder/precise/clear-all', async (c) => {
  const stub = getReminderDO(c.env);
  const result = await stub.clearAll();
  return jsonBody({
    success: true,
    cleared: result.cleared,
    now: Date.now(),
  });
});
