/**
 * 定时提醒服务 —— Cron 触发器入口的业务编排层。
 *
 * 流程：
 *   1. 读取 reminder_config（settings 表 key-value）
 *   2. 校验启用状态 + 收件人 + RESEND_API_KEY
 *   3. 计算目标时区下的「今天」与「当前时刻」
 *   4. 查询今日 + 有 time + 未完成 + 未删除的 todos（含分类信息）
 *   5. 过滤出窗口内 (now-1min, now+leadMinutes] 且未发送过的 todos
 *   6. 渲染 HTML 邮件，调用 Resend API 发送
 *   7. 更新 reminder_state：追加已发送 ID，裁剪 24h 前的记录
 *
 * 幂等性：reminder_state.sent 按 todo_id+due_at 去重，即使 Cron 重复触发
 * 同一窗口也不会重复发送。
 *
 * 时区处理：date 字段在 utils.js 中按 UTC 格式化存储；为对齐用户壁钟时间，
 * 这里用 tzOffsetMs 把「现在」位移到目标时区后用 UTC getter 读取年月日。
 */

import { and, eq, inArray } from 'drizzle-orm';
import type { Env } from '../env';
import { createDb } from '../db/client';
import type { Db } from '../db/client';
import { todos, categories } from '../db/schema';
import { getSettingJson, setSettingJson } from './settings-service';
import { sendEmail } from './resend';
import { renderReminderEmail } from './reminder-template';

// ==================== 类型 ====================

export interface ReminderConfig {
  enabled: boolean;
  recipient: string;
  from: string;
  lead_minutes: number;
  timezone_offset: number;
  app_url?: string;
}

interface ReminderSentEntry {
  todo_id: string;
  due_at: number;
}

interface ReminderState {
  last_run: number;
  sent: ReminderSentEntry[];
}

export interface DueTodo {
  id: string;
  text: string;
  time: string;
  priority: string;
  desc: string;
  url: string;
  categoryName: string;
  categoryColor: string;
}

export interface ReminderRunResult {
  skipped: boolean;
  reason?: string;
  checked: number;
  due: number;
  sent: number;
  failed: number;
  resendId?: string;
  error?: string;
}

// ==================== 常量 ====================

const CONFIG_KEY = 'reminder_config';
const STATE_KEY = 'reminder_state';
const SENT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TZ_OFFSET = 480; // UTC+8（Asia/Shanghai）
const DEFAULT_LEAD_MINUTES = 15;
const LOOKBACK_MINUTES = 1; // 容忍 Cron 抖动，回看 1 分钟补漏（去重靠 state.sent）

const DEFAULT_CONFIG: ReminderConfig = {
  enabled: false,
  recipient: '',
  from: '',
  lead_minutes: DEFAULT_LEAD_MINUTES,
  timezone_offset: DEFAULT_TZ_OFFSET,
};

export function normalizeConfig(input: unknown): ReminderConfig {
  if (!input || typeof input !== 'object') return { ...DEFAULT_CONFIG };
  const r = input as Record<string, unknown>;
  const cfg: ReminderConfig = {
    enabled: r.enabled === true,
    recipient: typeof r.recipient === 'string' ? r.recipient.trim() : '',
    from: typeof r.from === 'string' ? r.from.trim() : '',
    lead_minutes: Number.isFinite(r.lead_minutes) && (r.lead_minutes as number) > 0
      ? Math.min(Math.floor(r.lead_minutes as number), 1440)
      : DEFAULT_LEAD_MINUTES,
    timezone_offset: Number.isFinite(r.timezone_offset)
      ? Math.max(-720, Math.min(720, r.timezone_offset as number))
      : DEFAULT_TZ_OFFSET,
    app_url: typeof r.app_url === 'string' ? r.app_url.trim() : undefined,
  };
  return cfg;
}

export async function getReminderConfig(db: Db): Promise<ReminderConfig> {
  const raw = await getSettingJson<unknown>(db, CONFIG_KEY, null);
  return normalizeConfig(raw);
}

export async function setReminderConfig(db: Db, cfg: ReminderConfig): Promise<void> {
  await setSettingJson(db, CONFIG_KEY, cfg);
}

async function getState(db: Db): Promise<ReminderState> {
  const fallback: ReminderState = { last_run: 0, sent: [] };
  const raw = await getSettingJson<unknown>(db, STATE_KEY, fallback);
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, unknown>;
  const sent = Array.isArray(r.sent) ? r.sent.filter(isSentEntry) : [];
  return {
    last_run: typeof r.last_run === 'number' ? r.last_run : 0,
    sent,
  };
}

function isSentEntry(v: unknown): v is ReminderSentEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return typeof e.todo_id === 'string' && typeof e.due_at === 'number';
}

async function saveState(db: Db, state: ReminderState): Promise<void> {
  await setSettingJson(db, STATE_KEY, state);
}

// ==================== 时区 / 时间工具 ====================

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function getLocalDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function timezoneLabel(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${pad2(h)}${m > 0 ? ':' + pad2(m) : ''}`;
}

/**
 * 计算单个 todo 在「目标时区当天」对应的 UTC ms 时间戳。
 *
 * 实现思路：把「目标时区的壁钟时间」当作 UTC 解析，再减去 tzOffset
 * 得到真实 UTC ms。这样无论 Worker 跑在哪个 region，都能对齐用户壁钟。
 */
function dueUtcMsFor(todoTime: string, localNow: Date, tzOffsetMs: number): number | null {
  const [hh, mm] = todoTime.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return (
    Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate(),
      hh,
      mm,
      0,
      0,
    ) - tzOffsetMs
  );
}

/**
 * 生成 Resend 幂等键：对一批 dueTodos 的 `todo_id@due_at` 排序后做 SHA-256，
 * 取 hex 前 32 字符（128-bit），稳定且不会超过 Resend 256 字符上限。
 *
 * 设计：
 *   - 排序保证不同顺序的同一批 todos 得到相同 key
 *   - SHA-256 hex 是 URL/ASCII 安全字符，符合 Resend Idempotency-Key 要求
 *   - 32 字符远低于 256 上限，留足前缀空间
 *   - 前缀 `cf-todo:` 便于在 Resend 后台日志辨识来源
 */
async function buildIdempotencyKey(
  dueTodos: DueTodo[],
  localNow: Date,
  tzOffsetMs: number,
): Promise<string> {
  const parts = dueTodos
    .map((t) => {
      const dueMs = dueUtcMsFor(t.time, localNow, tzOffsetMs);
      return `${t.id}@${dueMs ?? 0}`;
    })
    .sort();
  const input = parts.join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `cf-todo:${hex.slice(0, 32)}`;
}

// ==================== 查询 ====================

async function fetchTodayTimedTodos(
  db: Db,
  todayStr: string,
): Promise<DueTodo[]> {
  const rows = await db
    .select({
      id: todos.id,
      text: todos.text,
      time: todos.time,
      priority: todos.priority,
      desc: todos.desc,
      url: todos.url,
      category_id: todos.category_id,
    })
    .from(todos)
    .where(and(eq(todos.date, todayStr), eq(todos.done, 0), eq(todos.deleted, 0)))
    .all();

  const timed = rows.filter((r) => r.time && /^\d{1,2}:\d{2}$/.test(r.time));
  if (timed.length === 0) return [];

  const categoryIds = Array.from(
    new Set(timed.map((r) => r.category_id).filter((id): id is string => !!id)),
  );
  let categoryMap = new Map<string, { name: string; color: string }>();
  if (categoryIds.length > 0) {
    const cats = await db
      .select({ id: categories.id, name: categories.name, color: categories.color })
      .from(categories)
      .where(inArray(categories.id, categoryIds))
      .all();
    categoryMap = new Map(cats.map((c) => [c.id, { name: c.name, color: c.color }]));
  }

  return timed.map((r) => {
    const cat = r.category_id ? categoryMap.get(r.category_id) : undefined;
    return {
      id: r.id,
      text: r.text,
      time: r.time!,
      priority: r.priority ?? 'low',
      desc: r.desc ?? '',
      url: r.url ?? '',
      categoryName: cat?.name ?? '',
      categoryColor: cat?.color ?? '',
    };
  });
}

// ==================== 主入口 ====================

export async function runScheduledReminders(env: Env): Promise<ReminderRunResult> {
  const db = createDb(env.DB);
  const cfg = await getReminderConfig(db);

  if (!cfg.enabled) {
    return { skipped: true, reason: 'disabled', checked: 0, due: 0, sent: 0, failed: 0 };
  }
  if (!cfg.recipient || !cfg.from) {
    return { skipped: true, reason: 'missing recipient or from', checked: 0, due: 0, sent: 0, failed: 0 };
  }
  if (!env.RESEND_API_KEY) {
    return { skipped: true, reason: 'RESEND_API_KEY not set', checked: 0, due: 0, sent: 0, failed: 0 };
  }

  const tzOffsetMs = cfg.timezone_offset * 60 * 1000;
  const nowUtcMs = Date.now();
  const localNow = new Date(nowUtcMs + tzOffsetMs);
  const todayStr = getLocalDateStr(localNow);

  const allTodos = await fetchTodayTimedTodos(db, todayStr);
  if (allTodos.length === 0) {
    return { skipped: false, checked: 0, due: 0, sent: 0, failed: 0 };
  }

  // 计算 window：(now - LOOKBACK, now + lead]
  const windowStartMs = nowUtcMs - LOOKBACK_MINUTES * 60 * 1000;
  const windowEndMs = nowUtcMs + cfg.lead_minutes * 60 * 1000;

  const state = await getState(db);
  const sentKey = (todoId: string, dueAt: number) => `${todoId}@${dueAt}`;
  const sentSet = new Set(state.sent.map((e) => sentKey(e.todo_id, e.due_at)));

  const dueTodos: DueTodo[] = [];
  for (const t of allTodos) {
    const dueUtcMs = dueUtcMsFor(t.time, localNow, tzOffsetMs);
    if (dueUtcMs === null) continue;
    if (dueUtcMs > windowStartMs && dueUtcMs <= windowEndMs) {
      if (sentSet.has(sentKey(t.id, dueUtcMs))) continue;
      dueTodos.push(t);
    }
  }

  if (dueTodos.length === 0) {
    // 仍更新 last_run，便于观测调度是否在跑
    state.last_run = nowUtcMs;
    await saveState(db, pruneState(state, nowUtcMs));
    return { skipped: false, checked: allTodos.length, due: 0, sent: 0, failed: 0 };
  }

  const { html, text, subject } = renderReminderEmail({
    todos: dueTodos,
    runAt: localNow,
    timezoneLabel: timezoneLabel(cfg.timezone_offset),
    leadMinutes: cfg.lead_minutes,
    appUrl: cfg.app_url,
  });

  const idempotencyKey = await buildIdempotencyKey(dueTodos, localNow, tzOffsetMs);
  const result = await sendEmail(env.RESEND_API_KEY, {
    from: cfg.from,
    to: cfg.recipient,
    subject,
    html,
    text,
    idempotencyKey,
  });

  // 无论成功失败都更新 last_run；成功才追加 sent
  state.last_run = nowUtcMs;
  if (result.ok) {
    for (const t of dueTodos) {
      const dueUtcMs = dueUtcMsFor(t.time, localNow, tzOffsetMs);
      if (dueUtcMs !== null) {
        state.sent.push({ todo_id: t.id, due_at: dueUtcMs });
      }
    }
  }
  await saveState(db, pruneState(state, nowUtcMs));

  return {
    skipped: false,
    checked: allTodos.length,
    due: dueTodos.length,
    sent: result.ok ? dueTodos.length : 0,
    failed: result.ok ? 0 : dueTodos.length,
    resendId: result.id,
    error: result.error,
  };
}

function pruneState(state: ReminderState, nowUtcMs: number): ReminderState {
  const cutoff = nowUtcMs - SENT_TTL_MS;
  const sent = state.sent.filter((e) => e.due_at >= cutoff);
  return { last_run: state.last_run, sent };
}

// ==================== 测试邮件（供 /api/reminder/test 调用） ====================

export async function sendTestEmail(env: Env, cfg: ReminderConfig): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY not set' };
  if (!cfg.recipient || !cfg.from) return { ok: false, error: 'recipient or from not configured' };

  const now = new Date(Date.now() + cfg.timezone_offset * 60 * 1000);
  const { html, text, subject } = renderReminderEmail({
    todos: [
      {
        id: 'test-1',
        text: '【测试】这是一封来自 cf-todo 的提醒测试邮件',
        time: `${pad2(now.getUTCHours())}:${pad2(now.getUTCMinutes())}`,
        priority: 'med',
        desc: '如果你收到这封邮件，说明 Resend API 集成正常工作。',
        url: cfg.app_url || '',
        categoryName: '',
        categoryColor: '',
      },
    ],
    runAt: now,
    timezoneLabel: timezoneLabel(cfg.timezone_offset),
    leadMinutes: cfg.lead_minutes,
    appUrl: cfg.app_url,
  });

  const result = await sendEmail(env.RESEND_API_KEY, {
    from: cfg.from,
    to: cfg.recipient,
    subject: `[测试] ${subject}`,
    html,
    text,
    // 测试邮件用固定前缀 + 当前小时做幂等键，避免用户连点测试按钮刷屏。
    // 同一小时内重复点击只会发一封（Resend 24h 幂等窗口内）。
    idempotencyKey: `cf-todo:test:${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}T${pad2(now.getUTCHours())}`,
  });
  return { ok: result.ok, id: result.id, error: result.error };
}
