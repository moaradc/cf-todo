/**
 * 定时提醒服务 —— 多模式 Cron 编排层。
 *
 * 模式：
 *   - timed       每 5 分钟扫描未来 N 分钟内到期的待办（应用层 state.sent 去重）
 *   - daily       每次 Cron 触发时发送今日待办汇总（可选附加搜索词 section）
 *                 Resend Idempotency-Key cf-todo:daily:YYYY-MM-DD 保证每天只发一封
 *   - priority    每次 Cron 触发时发送指定优先级及以上的未完成待办
 *                 Resend Idempotency-Key cf-todo:priority:YYYY-MM-DD 保证每天只发一封
 *
 * 去重策略：
 *   - timed     应用层 state.sent[] 按 todo_id@due_at 去重（24h TTL）
 *   - daily/priority  每次 Cron 都尝试发送，由 Resend 服务端幂等去重；
 *                     body 变化导致幂等冲突时视为"今天已发"跳过
 *
 * 时区：用 tzOffsetMs 把「现在」位移到目标时区后用 UTC getter 读取年月日。
 */

import { and, eq, inArray } from 'drizzle-orm';
import type { Env } from '../env';
import { createDb } from '../db/client';
import type { Db } from '../db/client';
import { todos, categories } from '../db/schema';
import { getSettingJson, setSettingJson } from './settings-service';
import { sendEmail } from './resend';
import { renderModeEmail } from './reminder-template';
import type { EmailItem, EmailSection } from './reminder-template';

// ==================== 类型 ====================

export type PriorityLevel = 'high' | 'med' | 'low';
export type SearchIncludeMode = 'off' | 'uncompleted' | 'all';

export interface ReminderConfig {
  enabled: boolean;
  recipient: string;
  from: string;
  timezone_offset: number;
  app_url?: string;
  // timed 模式
  timed_enabled: boolean;
  timed_lead_minutes: number;
  // daily 模式
  daily_enabled: boolean;
  daily_include_completed: boolean;
  daily_include_uncompleted: boolean;
  daily_include_search: SearchIncludeMode;
  // priority 模式
  priority_enabled: boolean;
  priority_min_level: PriorityLevel;
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
  done: number;
  desc: string;
  url: string;
  categoryName: string;
  categoryColor: string;
  search_terms: string;
}

export interface ModeResult {
  mode: string;
  skipped: boolean;
  reason?: string;
  checked: number;
  sent: number;
  failed: number;
  resendId?: string;
  error?: string;
}

export interface ReminderRunResult {
  skipped: boolean;
  reason?: string;
  modes: ModeResult[];
}

// ==================== 常量 ====================

const CONFIG_KEY = 'reminder_config';
const STATE_KEY = 'reminder_state';
const SENT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TZ_OFFSET = 480;
const DEFAULT_LEAD_MINUTES = 15;
const LOOKBACK_MINUTES = 1;
const PRIORITY_RANK: Record<string, number> = { high: 3, med: 2, low: 1 };

const DEFAULT_CONFIG: ReminderConfig = {
  enabled: false,
  recipient: '',
  from: '',
  timezone_offset: DEFAULT_TZ_OFFSET,
  timed_enabled: false,
  timed_lead_minutes: DEFAULT_LEAD_MINUTES,
  daily_enabled: false,
  daily_include_completed: false,
  daily_include_uncompleted: true,
  daily_include_search: 'off',
  priority_enabled: false,
  priority_min_level: 'high',
};

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parsePriorityLevel(v: unknown): PriorityLevel {
  return v === 'high' || v === 'med' || v === 'low' ? v : 'high';
}

function parseSearchIncludeMode(v: unknown): SearchIncludeMode {
  return v === 'all' || v === 'uncompleted' ? v : 'off';
}

export function normalizeConfig(input: unknown): ReminderConfig {
  if (!input || typeof input !== 'object') return { ...DEFAULT_CONFIG };
  const r = input as Record<string, unknown>;
  // 旧配置迁移：hot_search_enabled + hot_search_time → daily_include_search
  let migratedSearch: SearchIncludeMode = 'off';
  if (r.daily_include_search !== undefined) {
    migratedSearch = parseSearchIncludeMode(r.daily_include_search);
  } else if (r.hot_search_enabled === true) {
    migratedSearch = 'all';
  }
  return {
    enabled: r.enabled === true,
    recipient: typeof r.recipient === 'string' ? r.recipient.trim() : '',
    from: typeof r.from === 'string' ? r.from.trim() : '',
    timezone_offset: clamp(r.timezone_offset, -720, 720, DEFAULT_TZ_OFFSET),
    app_url: typeof r.app_url === 'string' ? r.app_url.trim() : undefined,
    timed_enabled: r.timed_enabled === true || (r.lead_minutes !== undefined && r.enabled === true && r.timed_enabled === undefined),
    timed_lead_minutes: clamp(r.timed_lead_minutes ?? r.lead_minutes, 1, 1440, DEFAULT_LEAD_MINUTES),
    daily_enabled: r.daily_enabled === true,
    daily_include_completed: r.daily_include_completed === true,
    daily_include_uncompleted: r.daily_include_uncompleted !== false,
    daily_include_search: migratedSearch,
    priority_enabled: r.priority_enabled === true,
    priority_min_level: parsePriorityLevel(r.priority_min_level),
  };
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

// ==================== 时间工具 ====================

function pad2(n: number): string { return String(n).padStart(2, '0'); }

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

function dueUtcMsFor(todoTime: string, localNow: Date, tzOffsetMs: number): number | null {
  const [hh, mm] = todoTime.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return Date.UTC(
    localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate(),
    hh, mm, 0, 0,
  ) - tzOffsetMs;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ==================== 查询 ====================

async function fetchTodayTodos(
  db: Db,
  todayStr: string,
  opts: { includeDone?: boolean; minPriority?: PriorityLevel } = {},
): Promise<DueTodo[]> {
  const conditions = [eq(todos.date, todayStr), eq(todos.deleted, 0)];
  if (opts.includeDone === false) conditions.push(eq(todos.done, 0));

  const rows = await db
    .select({
      id: todos.id, text: todos.text, time: todos.time, priority: todos.priority,
      done: todos.done, desc: todos.desc, url: todos.url, category_id: todos.category_id,
      search_terms: todos.search_terms,
    })
    .from(todos)
    .where(and(...conditions))
    .all();

  let filtered = rows;
  if (opts.minPriority) {
    const minRank = PRIORITY_RANK[opts.minPriority] ?? 0;
    filtered = rows.filter((r) => (PRIORITY_RANK[r.priority ?? 'low'] ?? 0) >= minRank);
  }

  if (filtered.length === 0) return [];

  const categoryIds = Array.from(
    new Set(filtered.map((r) => r.category_id).filter((id): id is string => !!id)),
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

  return filtered.map((r) => {
    const cat = r.category_id ? categoryMap.get(r.category_id) : undefined;
    return {
      id: r.id, text: r.text, time: r.time ?? '', priority: r.priority ?? 'low',
      done: r.done, desc: r.desc ?? '', url: r.url ?? '',
      categoryName: cat?.name ?? '', categoryColor: cat?.color ?? '',
      search_terms: r.search_terms ?? '[]',
    };
  });
}

function dueTodoToItem(t: DueTodo): EmailItem {
  return {
    text: t.text, time: t.time || undefined, priority: t.priority,
    desc: t.desc || undefined, url: t.url || undefined,
    categoryName: t.categoryName || undefined, categoryColor: t.categoryColor || undefined,
    done: t.done === 1,
  };
}

// ==================== search_terms 解析（供 daily 模式附加 section 用） ====================

interface SearchTermEntry {
  text: string;
  done: boolean;
  todoText: string;
}

function parseSearchTerms(raw: string): Array<{ text: string; done: boolean }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((w) => {
        if (typeof w === 'string' && w.trim()) return { text: w.trim(), done: false };
        if (w && typeof w === 'object' && typeof (w as { text?: string }).text === 'string') {
          return { text: (w as { text: string }).text, done: !!(w as { done?: boolean }).done };
        }
        return null;
      })
      .filter((w): w is { text: string; done: boolean } => w !== null);
  } catch {
    return [];
  }
}

/**
 * 聚合今日所有 todo 的 search_terms。
 * mode: 'all' 全部 / 'uncompleted' 仅未完成 / 'off' 不附加
 * 返回的 sections 直接拼到 daily 邮件里。
 */
function buildSearchSections(allTodos: DueTodo[], mode: SearchIncludeMode): EmailSection[] {
  if (mode === 'off') return [];
  const allTerms: SearchTermEntry[] = [];
  for (const t of allTodos) {
    const terms = parseSearchTerms(t.search_terms);
    for (const term of terms) {
      allTerms.push({ text: term.text, done: term.done, todoText: t.text });
    }
  }
  if (allTerms.length === 0) return [];

  const showTerms = mode === 'uncompleted' ? allTerms.filter((t) => !t.done) : allTerms;
  if (showTerms.length === 0) return [];

  const uncompleted = showTerms.filter((t) => !t.done);
  const completed = showTerms.filter((t) => t.done);
  const sections: EmailSection[] = [];
  if (uncompleted.length > 0) {
    sections.push({
      title: `未完成搜索词 (${uncompleted.length})`,
      items: uncompleted.map((t) => ({ text: t.text, desc: `来源：${t.todoText}` })),
      listStyle: 'keywords',
    });
  }
  if (completed.length > 0) {
    sections.push({
      title: `已完成搜索词 (${completed.length})`,
      items: completed.map((t) => ({ text: t.text, desc: `来源：${t.todoText}`, done: true })),
      listStyle: 'keywords',
    });
  }
  return sections;
}

// ==================== 模式: timed ====================

async function runTimedMode(
  env: Env, cfg: ReminderConfig, state: ReminderState,
  localNow: Date, todayStr: string, tzOffsetMs: number, nowUtcMs: number,
): Promise<ModeResult> {
  if (!cfg.timed_enabled) return { mode: 'timed', skipped: true, reason: 'disabled', checked: 0, sent: 0, failed: 0 };

  const allTodos = await fetchTodayTodos(createDb(env.DB), todayStr, { includeDone: false });
  const timed = allTodos.filter((t) => t.time && /^\d{1,2}:\d{2}$/.test(t.time));
  if (timed.length === 0) return { mode: 'timed', skipped: false, checked: 0, sent: 0, failed: 0 };

  const windowStartMs = nowUtcMs - LOOKBACK_MINUTES * 60 * 1000;
  const windowEndMs = nowUtcMs + cfg.timed_lead_minutes * 60 * 1000;
  const sentKey = (todoId: string, dueAt: number) => `${todoId}@${dueAt}`;
  const sentSet = new Set(state.sent.map((e) => sentKey(e.todo_id, e.due_at)));

  const dueTodos: DueTodo[] = [];
  for (const t of timed) {
    const dueUtcMs = dueUtcMsFor(t.time, localNow, tzOffsetMs);
    if (dueUtcMs === null) continue;
    if (dueUtcMs > windowStartMs && dueUtcMs <= windowEndMs) {
      if (sentSet.has(sentKey(t.id, dueUtcMs))) continue;
      dueTodos.push(t);
    }
  }

  if (dueTodos.length === 0) return { mode: 'timed', skipped: false, checked: timed.length, sent: 0, failed: 0 };

  const tzLbl = timezoneLabel(cfg.timezone_offset);
  const section: EmailSection = {
    title: `未来 ${cfg.timed_lead_minutes} 分钟内到期`,
    items: dueTodos.map(dueTodoToItem),
    listStyle: 'cards',
  };
  const { html, text, subject } = renderModeEmail({
    title: `【待办提醒】${dueTodos.length} 项任务即将到期`,
    subtitle: `未来 ${cfg.timed_lead_minutes} 分钟内到期的待办事项`,
    sections: [section], runAt: localNow, timezoneLabel: tzLbl, appUrl: cfg.app_url,
  });

  const idemParts = dueTodos.map((t) => `${t.id}@${dueUtcMsFor(t.time, localNow, tzOffsetMs) ?? 0}`).sort();
  const idempotencyKey = `cf-todo:timed:${(await sha256Hex(idemParts.join('|'))).slice(0, 32)}`;
  const result = await sendEmail(env.RESEND_API_KEY, { from: cfg.from, to: cfg.recipient, subject, html, text, idempotencyKey });

  if (result.ok) {
    for (const t of dueTodos) {
      const dueUtcMs = dueUtcMsFor(t.time, localNow, tzOffsetMs);
      if (dueUtcMs !== null) state.sent.push({ todo_id: t.id, due_at: dueUtcMs });
    }
  }

  return {
    mode: 'timed', skipped: false, checked: timed.length,
    sent: result.ok ? dueTodos.length : 0, failed: result.ok ? 0 : dueTodos.length,
    resendId: result.id, error: result.error,
  };
}

// ==================== 模式: daily（含可选搜索词 section） ====================

/** 检测 Resend 幂等冲突：同 key 已发过（body 相同或不同均算）。 */
function isIdempotencyConflict(result: { ok: boolean; error?: string; status?: number }): boolean {
  if (result.ok) return false;
  const err = result.error || '';
  return err.includes('idempotency') || err.includes('invalid_idempotent_request');
}

async function runDailyMode(
  env: Env, cfg: ReminderConfig,
  localNow: Date, todayStr: string,
): Promise<ModeResult> {
  if (!cfg.daily_enabled) return { mode: 'daily', skipped: true, reason: 'disabled', checked: 0, sent: 0, failed: 0 };

  const db = createDb(env.DB);
  const allTodos = await fetchTodayTodos(db, todayStr, {});
  const uncompleted = allTodos.filter((t) => t.done === 0);
  const completed = allTodos.filter((t) => t.done === 1);

  const sections: EmailSection[] = [];
  if (cfg.daily_include_uncompleted) {
    sections.push({
      title: '未完成',
      items: uncompleted.map(dueTodoToItem),
      emptyMessage: '今日无未完成待办',
      listStyle: 'cards',
    });
  }
  if (cfg.daily_include_completed) {
    sections.push({
      title: '已完成',
      items: completed.map(dueTodoToItem),
      emptyMessage: '今日无已完成待办',
      listStyle: 'cards',
    });
  }
  const searchSections = buildSearchSections(allTodos, cfg.daily_include_search);
  sections.push(...searchSections);

  if (sections.length === 0) {
    sections.push({ title: '今日待办', items: allTodos.map(dueTodoToItem), emptyMessage: '今日无待办', listStyle: 'cards' });
  }

  const tzLbl = timezoneLabel(cfg.timezone_offset);
  const searchLabel = cfg.daily_include_search === 'all' ? '，含搜索词' : cfg.daily_include_search === 'uncompleted' ? '，含未完成搜索词' : '';
  const { html, text, subject } = renderModeEmail({
    title: `【今日汇总】${todayStr} 待办一览`,
    subtitle: `今日共 ${allTodos.length} 项待办（未完成 ${uncompleted.length} / 已完成 ${completed.length}）${searchLabel}`,
    sections, runAt: localNow, timezoneLabel: tzLbl, appUrl: cfg.app_url,
  });

  // 每次 Cron 都尝试发送；Resend 用 cf-todo:daily:YYYY-MM-DD 幂等键去重，
  // 同一天重复调用不会产生新邮件。body 变化时 Resend 返回幂等冲突，视为"今天已发"。
  const idempotencyKey = `cf-todo:daily:${todayStr}`;
  const result = await sendEmail(env.RESEND_API_KEY, { from: cfg.from, to: cfg.recipient, subject, html, text, idempotencyKey });

  if (isIdempotencyConflict(result)) {
    return { mode: 'daily', skipped: true, reason: 'already_sent_today (idempotency)', checked: allTodos.length, sent: 0, failed: 0 };
  }

  return {
    mode: 'daily', skipped: false, checked: allTodos.length,
    sent: result.ok ? 1 : 0, failed: result.ok ? 0 : 1,
    resendId: result.id, error: result.error,
  };
}

// ==================== 模式: priority ====================

async function runPriorityMode(
  env: Env, cfg: ReminderConfig,
  localNow: Date, todayStr: string,
): Promise<ModeResult> {
  if (!cfg.priority_enabled) return { mode: 'priority', skipped: true, reason: 'disabled', checked: 0, sent: 0, failed: 0 };

  const db = createDb(env.DB);
  const allTodos = await fetchTodayTodos(db, todayStr, { includeDone: false, minPriority: cfg.priority_min_level });
  if (allTodos.length === 0) {
    return { mode: 'priority', skipped: false, reason: 'no_matching_todos', checked: 0, sent: 0, failed: 0 };
  }

  const levelLabel = cfg.priority_min_level === 'high' ? '高' : cfg.priority_min_level === 'med' ? '中及以上' : '低及以上（全部）';
  const tzLbl = timezoneLabel(cfg.timezone_offset);
  const section: EmailSection = {
    title: `${levelLabel}优先级未完成`,
    items: allTodos.map(dueTodoToItem),
    listStyle: 'cards',
  };
  const { html, text, subject } = renderModeEmail({
    title: `【优先级提醒】${allTodos.length} 项待办需关注`,
    subtitle: `${levelLabel}优先级的未完成待办`,
    sections: [section], runAt: localNow, timezoneLabel: tzLbl, appUrl: cfg.app_url,
  });

  const idempotencyKey = `cf-todo:priority:${todayStr}`;
  const result = await sendEmail(env.RESEND_API_KEY, { from: cfg.from, to: cfg.recipient, subject, html, text, idempotencyKey });

  if (isIdempotencyConflict(result)) {
    return { mode: 'priority', skipped: true, reason: 'already_sent_today (idempotency)', checked: allTodos.length, sent: 0, failed: 0 };
  }

  return {
    mode: 'priority', skipped: false, checked: allTodos.length,
    sent: result.ok ? 1 : 0, failed: result.ok ? 0 : 1,
    resendId: result.id, error: result.error,
  };
}

// ==================== 主入口 ====================

export async function runScheduledReminders(env: Env): Promise<ReminderRunResult> {
  const db = createDb(env.DB);
  const cfg = await getReminderConfig(db);

  if (!cfg.enabled) return { skipped: true, reason: 'disabled', modes: [] };
  if (!cfg.recipient || !cfg.from) return { skipped: true, reason: 'missing recipient or from', modes: [] };
  if (!env.RESEND_API_KEY) return { skipped: true, reason: 'RESEND_API_KEY not set', modes: [] };

  const tzOffsetMs = cfg.timezone_offset * 60 * 1000;
  const nowUtcMs = Date.now();
  const localNow = new Date(nowUtcMs + tzOffsetMs);
  const todayStr = getLocalDateStr(localNow);

  const state = await getState(db);
  state.last_run = nowUtcMs;

  const results: ModeResult[] = [];
  results.push(await runTimedMode(env, cfg, state, localNow, todayStr, tzOffsetMs, nowUtcMs));
  results.push(await runDailyMode(env, cfg, localNow, todayStr));
  results.push(await runPriorityMode(env, cfg, localNow, todayStr));

  await saveState(db, pruneState(state, nowUtcMs));

  return { skipped: false, modes: results };
}

function pruneState(state: ReminderState, nowUtcMs: number): ReminderState {
  const cutoff = nowUtcMs - SENT_TTL_MS;
  const sent = state.sent.filter((e) => e.due_at >= cutoff);
  return { last_run: state.last_run, sent };
}

// ==================== 测试邮件 ====================

export async function sendTestEmail(env: Env, cfg: ReminderConfig): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY not set' };
  if (!cfg.recipient || !cfg.from) return { ok: false, error: 'recipient or from not configured' };

  const now = new Date(Date.now() + cfg.timezone_offset * 60 * 1000);
  const tzLbl = timezoneLabel(cfg.timezone_offset);
  const testItem: EmailItem = {
    text: '【测试】这是一封来自 cf-todo 的提醒测试邮件',
    time: `${pad2(now.getUTCHours())}:${pad2(now.getUTCMinutes())}`,
    priority: 'med',
    desc: '如果你收到这封邮件，说明 Resend API 集成正常工作。',
  };
  const section: EmailSection = {
    title: '测试邮件',
    items: [testItem],
    listStyle: 'cards',
  };
  const { html, text, subject } = renderModeEmail({
    title: `[测试] cf-todo 提醒测试`,
    subtitle: '这是一封测试邮件，验证 Resend API 集成是否正常',
    sections: [section], runAt: now, timezoneLabel: tzLbl, appUrl: cfg.app_url,
  });

  const result = await sendEmail(env.RESEND_API_KEY, {
    from: cfg.from, to: cfg.recipient, subject, html, text,
    idempotencyKey: `cf-todo:test:${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}T${pad2(now.getUTCHours())}`,
  });
  return { ok: result.ok, id: result.id, error: result.error };
}
