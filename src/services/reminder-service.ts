/**
 * 定时提醒服务 —— digest 模式：所有启用的模式合并为一封邮件发送。
 * 时区：用 tzOffsetMs 把「现在」位移到目标时区后用 UTC getter 读取年月日。
 */

import { and, eq, inArray, count } from 'drizzle-orm';
import type { Env } from '../env';
import { createDb, createReadDb } from '../db/client';
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
  timed_enabled: boolean;
  timed_lead_minutes: number;
  daily_enabled: boolean;
  daily_include_completed: boolean;
  daily_include_uncompleted: boolean;
  daily_include_search: SearchIncludeMode;
  priority_enabled: boolean;
  priority_min_level: PriorityLevel;
  /** hh:mm 格式，空表示不跳过；同时设置时在该时段内不发邮件 */
  skip_start: string;
  skip_end: string;
  skip_if_no_todos: boolean;
  /** ISO 周几 1=周一..7=周日；空数组=不限制 */
  weekly_days: number[];
  // —— 新增：精确提醒（DO Alarm），与 digest 完全并行独立 ——
  /** 是否启用 DO Alarm 精确提醒（每条待办到点单独发邮件） */
  precise_enabled: boolean;
  /** 精确提醒提前量（分钟），0..1440，默认 15；0 表示到点准时触发 */
  precise_lead_minutes: number;
}

interface ReminderState {
  last_run: number;
}

export interface DueTodo {
  id: string;
  text: string;
  time: string;
  end_time: string;
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
  enabled: boolean;
  sections: EmailSection[];
  /** 用于拼邮件主题，如「即将到期2」「汇总(9/10)」 */
  summary?: string;
  /** 本模式展示的 todo id（供后续模式去重） */
  displayedIds: string[];
  checked: number;
  skipped: boolean;
  reason?: string;
}

export interface ReminderRunResult {
  skipped: boolean;
  reason?: string;
  sent: number;
  failed: number;
  resendId?: string;
  error?: string;
  modes: ModeResult[];
}

// ==================== 常量 ====================

const CONFIG_KEY = 'reminder_config';
const STATE_KEY = 'reminder_state';
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
  skip_start: '',
  skip_end: '',
  skip_if_no_todos: false,
  weekly_days: [],
  // 新增字段默认值：精确提醒默认关闭
  precise_enabled: false,
  precise_lead_minutes: DEFAULT_LEAD_MINUTES,
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

/** 解析 hh:mm 格式时间，非法返回空串 */
function parseHHMM(v: unknown): string {
  if (typeof v !== 'string') return '';
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** 接收数组/逗号分隔字符串/Set，输出严格 1..7 的去重升序数组；非法输入返回空数组 */
export function parseWeeklyDays(v: unknown): number[] {
  let arr: unknown[] | null = null;
  if (Array.isArray(v)) arr = v;
  else if (typeof v === 'string') {
    const parts = v.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return [];
    arr = parts;
  } else if (v instanceof Set) arr = Array.from(v);

  if (!arr) return [];

  const seen = new Set<number>();
  for (const item of arr) {
    let n: number;
    if (typeof item === 'number') n = item;
    else if (typeof item === 'string') n = parseInt(item, 10);
    else continue;
    if (!Number.isFinite(n)) continue;
    n = Math.trunc(n);
    if (n < 1 || n > 7) continue;
    seen.add(n);
  }
  return Array.from(seen).sort((a, b) => a - b);
}

/** 输入应为 tzOffsetMs 位移后的「本地」Date（用 UTC getter 读取） */
export function getLocalIsoWeekday(localNow: Date): number {
  const jsDay = localNow.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function normalizeConfig(input: unknown): ReminderConfig {
  if (!input || typeof input !== 'object') return { ...DEFAULT_CONFIG };
  const r = input as Record<string, unknown>;
  // 兼容旧字段 hot_search_enabled
  let migratedSearch: SearchIncludeMode = 'off';
  if (r.daily_include_search !== undefined) {
    migratedSearch = parseSearchIncludeMode(r.daily_include_search);
  } else if (r.hot_search_enabled === true) {
    migratedSearch = 'all';
  }
  const dailyIncludeCompleted = r.daily_include_completed === true;
  const dailyIncludeUncompleted = r.daily_include_uncompleted !== false;
  return {
    enabled: r.enabled === true,
    recipient: typeof r.recipient === 'string' ? r.recipient.trim() : '',
    from: typeof r.from === 'string' ? r.from.trim() : '',
    timezone_offset: clamp(r.timezone_offset, -720, 720, DEFAULT_TZ_OFFSET),
    app_url: typeof r.app_url === 'string' ? r.app_url.trim() : undefined,
    timed_enabled: r.timed_enabled === true || (r.lead_minutes !== undefined && r.enabled === true && r.timed_enabled === undefined),
    timed_lead_minutes: clamp(r.timed_lead_minutes ?? r.lead_minutes, 1, 1440, DEFAULT_LEAD_MINUTES),
    daily_enabled: r.daily_enabled === true && (dailyIncludeUncompleted || dailyIncludeCompleted),
    daily_include_completed: dailyIncludeCompleted,
    daily_include_uncompleted: dailyIncludeUncompleted,
    daily_include_search: migratedSearch,
    priority_enabled: r.priority_enabled === true,
    priority_min_level: parsePriorityLevel(r.priority_min_level),
    skip_start: parseHHMM(r.skip_start),
    skip_end: parseHHMM(r.skip_end),
    skip_if_no_todos: r.skip_if_no_todos === true,
    weekly_days: parseWeeklyDays(r.weekly_days),
    // 新增：精确提醒字段，旧 reminder_config 经 normalizeConfig 后默认 false / 15
    // precise_lead_minutes 下限为 0（到点准时触发），上限 1440（24h）
    precise_enabled: r.precise_enabled === true,
    precise_lead_minutes: clamp(r.precise_lead_minutes, 0, 1440, DEFAULT_LEAD_MINUTES),
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
  const fallback: ReminderState = { last_run: 0 };
  const raw = await getSettingJson<unknown>(db, STATE_KEY, fallback);
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, unknown>;
  return {
    last_run: typeof r.last_run === 'number' ? r.last_run : 0,
  };
}

async function saveState(db: Db, state: ReminderState): Promise<void> {
  await setSettingJson(db, STATE_KEY, state);
}

// ==================== 时间工具 ====================

/** 两位补零。导出供 DO 共享。 */
export function pad2(n: number): string { return String(n).padStart(2, '0'); }

function getLocalDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** 时区标签（如 UTC+08:00）。导出供 DO 共享。 */
export function timezoneLabel(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${pad2(h)}${m > 0 ? ':' + pad2(m) : ''}`;
}

/**
 * 计算某日某时刻对应的 UTC 毫秒时间戳。
 * localNow 是 tzOffsetMs 位移后的「本地」Date（用 UTC getter 读年月日）。
 * 返回 UTC ms，或解析失败时 null。导出供 DO 计算 runAt 复用。
 */
export function dueUtcMsFor(todoTime: string, localNow: Date, tzOffsetMs: number): number | null {
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

/** 15s 时间桶，用于 Resend Idempotency-Key 去重 */
function idemBucket(): number {
  return Math.floor(Date.now() / 15000);
}

/**
 * 判断 localNow 是否在 skip 窗口内（支持跨午夜，如 23:00-07:00）。
 * localNow 应为 tzOffsetMs 位移后的「本地」Date（用 UTC getter 读时分）。
 * 导出供 DO 触发时共享时区跳过逻辑。
 */
export function isInSkipWindow(localNow: Date, skipStart: string, skipEnd: string): boolean {
  if (!skipStart || !skipEnd) return false;
  const [sh, sm] = skipStart.split(':').map(Number);
  const [eh, em] = skipEnd.split(':').map(Number);
  const cur = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start < end) return cur >= start && cur < end;
  if (start > end) return cur >= start || cur < end;
  return false;
}

// ==================== 查询 ====================

async function countTodayTodos(db: Db, todayStr: string): Promise<number> {
  try {
    const row = await db
      .select({ c: count() })
      .from(todos)
      .where(and(eq(todos.date, todayStr), eq(todos.deleted, 0)))
      .get();
    return row?.c ?? 0;
  } catch {
    // 查询失败按「有待办」处理，避免误跳过
    return 1;
  }
}

async function fetchTodayTodos(
  db: Db,
  todayStr: string,
  opts: { includeDone?: boolean; minPriority?: PriorityLevel } = {},
): Promise<DueTodo[]> {
  const conditions = [eq(todos.date, todayStr), eq(todos.deleted, 0)];
  if (opts.includeDone === false) conditions.push(eq(todos.done, 0));

  const rows = await db
    .select({
      id: todos.id, text: todos.text, time: todos.time, end_time: todos.end_time, priority: todos.priority,
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
      id: r.id, text: r.text, time: r.time ?? '', end_time: r.end_time ?? '', priority: r.priority ?? 'low',
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

/** 排序：优先级降序（高→中→低），同优先级按时间升序（早的在前） */
function sortTodos(todos: DueTodo[]): DueTodo[] {
  return [...todos].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority ?? 'low'] ?? 0;
    const pb = PRIORITY_RANK[b.priority ?? 'low'] ?? 0;
    if (pa !== pb) return pb - pa;
    return (a.time || '99:99').localeCompare(b.time || '99:99');
  });
}

// ==================== search_terms 解析 ====================

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
 * 聚合今日所有 todo 的 search_terms，按来源 todo 分组。
 * mode: 'all' 全部 / 'uncompleted' 仅未完成搜索词 / 'off' 不附加
 * 每个 todo 一个 section，section 内按搜索词 done 状态排序（未完成在前）。
 */
function buildSearchSections(allTodos: DueTodo[], mode: SearchIncludeMode): EmailSection[] {
  if (mode === 'off') return [];
  const sections: EmailSection[] = [];
  for (const todo of allTodos) {
    const terms = parseSearchTerms(todo.search_terms);
    if (terms.length === 0) continue;
    const showTerms = mode === 'uncompleted' ? terms.filter((t) => !t.done) : terms;
    if (showTerms.length === 0) continue;
    sections.push({
      title: `${todo.text} 的搜索词`,
      items: showTerms.map((t) => ({ text: t.text, done: t.done })),
      listStyle: 'keywords',
    });
  }
  return sections;
}

// ==================== 模式: timed ====================

async function runTimedMode(
  db: Db, cfg: ReminderConfig,
  localNow: Date, todayStr: string, tzOffsetMs: number, nowUtcMs: number,
  excludeIds: Set<string>,
): Promise<ModeResult> {
  if (!cfg.timed_enabled) return { mode: 'timed', enabled: false, sections: [], displayedIds: [], checked: 0, skipped: true, reason: 'disabled' };

  const allTodos = await fetchTodayTodos(db, todayStr, { includeDone: false });
  const timed = allTodos.filter((t) => !excludeIds.has(t.id));
  if (timed.length === 0) return { mode: 'timed', enabled: true, sections: [], displayedIds: [], checked: 0, skipped: false, reason: 'no_timed_todos' };

  const windowStartMs = nowUtcMs - LOOKBACK_MINUTES * 60 * 1000;
  const windowEndMs = nowUtcMs + cfg.timed_lead_minutes * 60 * 1000;

  const dueTodos: DueTodo[] = [];
  const startingTodos: DueTodo[] = [];
  const dueIds = new Set<string>();

  for (const t of timed) {
    if (t.end_time && /^\d{1,2}:\d{2}$/.test(t.end_time)) {
      const dueUtcMs = dueUtcMsFor(t.end_time, localNow, tzOffsetMs);
      if (dueUtcMs !== null && dueUtcMs > windowStartMs && dueUtcMs <= windowEndMs) {
        dueTodos.push(t);
        dueIds.add(t.id);
      }
    }
  }
  for (const t of timed) {
    if (dueIds.has(t.id)) continue;
    if (t.time && /^\d{1,2}:\d{2}$/.test(t.time)) {
      const startUtcMs = dueUtcMsFor(t.time, localNow, tzOffsetMs);
      if (startUtcMs !== null && startUtcMs > windowStartMs && startUtcMs <= windowEndMs) {
        startingTodos.push(t);
      }
    }
  }

  const allDue = [...dueTodos, ...startingTodos];
  if (allDue.length === 0) {
    return { mode: 'timed', enabled: true, sections: [], displayedIds: [], checked: timed.length, skipped: false, reason: 'no_due_in_window' };
  }

  const sections: EmailSection[] = [];
  if (dueTodos.length > 0) {
    sections.push({
      title: `未来 ${cfg.timed_lead_minutes} 分钟内即将到期`,
      items: sortTodos(dueTodos).map(dueTodoToItem),
      listStyle: 'cards',
    });
  }
  if (startingTodos.length > 0) {
    sections.push({
      title: `未来 ${cfg.timed_lead_minutes} 分钟内即将开始`,
      items: sortTodos(startingTodos).map(dueTodoToItem),
      listStyle: 'cards',
    });
  }

  return {
    mode: 'timed', enabled: true, sections, checked: timed.length, skipped: false,
    summary: `即将${dueTodos.length + startingTodos.length}`,
    displayedIds: allDue.map((t) => t.id),
  };
}

// ==================== 模式: daily ====================

async function runDailyMode(
  db: Db, cfg: ReminderConfig, todayStr: string,
  excludeIds: Set<string>,
): Promise<ModeResult> {
  if (!cfg.daily_enabled) return { mode: 'daily', enabled: false, sections: [], displayedIds: [], checked: 0, skipped: true, reason: 'disabled' };

  const allTodos = await fetchTodayTodos(db, todayStr, {});
  const totalUncompleted = allTodos.filter((t) => t.done === 0).length;
  const totalCount = allTodos.length;

  const showUncompleted = cfg.daily_include_uncompleted
    ? allTodos.filter((t) => t.done === 0 && !excludeIds.has(t.id))
    : [];
  const showCompleted = cfg.daily_include_completed
    ? allTodos.filter((t) => t.done === 1)
    : [];

  const sections: EmailSection[] = [];
  const displayedIds: string[] = [];
  const uncompletedTitle = excludeIds.size > 0 ? '其余未完成' : '今日未完成';

  if (cfg.daily_include_uncompleted) {
    sections.push({
      title: uncompletedTitle,
      items: sortTodos(showUncompleted).map(dueTodoToItem),
      emptyMessage: '无其余未完成待办',
      listStyle: 'cards',
    });
    showUncompleted.forEach((t) => displayedIds.push(t.id));
  }
  if (cfg.daily_include_completed) {
    sections.push({
      title: '今日已完成',
      items: sortTodos(showCompleted).map(dueTodoToItem),
      emptyMessage: '今日无已完成待办',
      listStyle: 'cards',
    });
    showCompleted.forEach((t) => displayedIds.push(t.id));
  }

  const summary = `汇总(${totalUncompleted}/${totalCount})`;
  return {
    mode: 'daily', enabled: true, sections, displayedIds, checked: totalCount, skipped: false,
    summary,
  };
}

// ==================== 模式: priority ====================

async function runPriorityMode(
  db: Db, cfg: ReminderConfig, todayStr: string,
  excludeIds: Set<string>,
): Promise<ModeResult> {
  if (!cfg.priority_enabled) return { mode: 'priority', enabled: false, sections: [], displayedIds: [], checked: 0, skipped: true, reason: 'disabled' };

  const allTodos = await fetchTodayTodos(db, todayStr, { includeDone: false, minPriority: cfg.priority_min_level });
  const showTodos = allTodos.filter((t) => !excludeIds.has(t.id));
  if (showTodos.length === 0) {
    return { mode: 'priority', enabled: true, sections: [], displayedIds: [], checked: 0, skipped: false, reason: 'no_matching_todos' };
  }

  const levelLabel = cfg.priority_min_level === 'high' ? '高' : cfg.priority_min_level === 'med' ? '中及以上' : '全部';
  const sections: EmailSection[] = [{
    title: `${levelLabel}优先级未完成`,
    items: sortTodos(showTodos).map(dueTodoToItem),
    listStyle: 'cards',
  }];
  const shortLevel = cfg.priority_min_level === 'high' ? '高优' : cfg.priority_min_level === 'med' ? '中优' : '全优';
  return {
    mode: 'priority', enabled: true, sections, checked: allTodos.length, skipped: false,
    summary: `${shortLevel}${showTodos.length}`,
    displayedIds: showTodos.map((t) => t.id),
  };
}

// ==================== 主入口：合并为一封 digest 邮件 ====================

export async function runScheduledReminders(env: Env): Promise<ReminderRunResult> {
  const db = createDb(env.DB);
  const cfg = await getReminderConfig(db);

  if (!cfg.enabled) return { skipped: true, reason: 'disabled', sent: 0, failed: 0, modes: [] };
  if (!cfg.recipient || !cfg.from) return { skipped: true, reason: 'missing recipient or from', sent: 0, failed: 0, modes: [] };
  if (!env.RESEND_API_KEY) return { skipped: true, reason: 'RESEND_API_KEY not set', sent: 0, failed: 0, modes: [] };

  const tzOffsetMs = cfg.timezone_offset * 60 * 1000;
  const nowUtcMs = Date.now();
  const localNow = new Date(nowUtcMs + tzOffsetMs);
  const todayStr = getLocalDateStr(localNow);

  if (cfg.weekly_days.length > 0) {
    const isoDay = getLocalIsoWeekday(localNow);
    if (!cfg.weekly_days.includes(isoDay)) {
      return { skipped: true, reason: `weekly_day ${isoDay} not in [${cfg.weekly_days.join(',')}]`, sent: 0, failed: 0, modes: [] };
    }
  }

  if (isInSkipWindow(localNow, cfg.skip_start, cfg.skip_end)) {
    return { skipped: true, reason: `skip_window ${cfg.skip_start}-${cfg.skip_end}`, sent: 0, failed: 0, modes: [] };
  }

  if (cfg.skip_if_no_todos) {
    const todayCount = await countTodayTodos(db, todayStr);
    if (todayCount === 0) {
      return { skipped: true, reason: 'no_todos_today', sent: 0, failed: 0, modes: [] };
    }
  }

  const state = await getState(db);
  state.last_run = nowUtcMs;

  const displayedIds = new Set<string>();
  const results: ModeResult[] = [];

  const timedResult = await runTimedMode(db, cfg, localNow, todayStr, tzOffsetMs, nowUtcMs, displayedIds);
  results.push(timedResult);
  timedResult.displayedIds.forEach((id) => displayedIds.add(id));

  const priorityResult = await runPriorityMode(db, cfg, todayStr, displayedIds);
  results.push(priorityResult);
  priorityResult.displayedIds.forEach((id) => displayedIds.add(id));

  const dailyResult = await runDailyMode(db, cfg, todayStr, displayedIds);
  results.push(dailyResult);
  dailyResult.displayedIds.forEach((id) => displayedIds.add(id));

  const mergedSections: EmailSection[] = [];
  for (const r of results) {
    mergedSections.push(...r.sections);
  }

  if (mergedSections.length > 0 && cfg.daily_include_search !== 'off') {
    const allTodosForSearch = await fetchTodayTodos(db, todayStr, {});
    const searchSections = buildSearchSections(allTodosForSearch, cfg.daily_include_search);
    mergedSections.push(...searchSections);
  }

  if (mergedSections.length === 0) {
    await saveState(db, state);
    return { skipped: false, sent: 0, failed: 0, modes: results };
  }

  const summaries = results.filter((r) => r.summary).map((r) => r.summary!);
  const subject = summaries.join(' · ');
  const modeSectionCount = results.reduce((acc, r) => acc + r.sections.length, 0);
  const subtitle = `${modeSectionCount} 个板块 · ${getLocalDateStr(localNow)} ${pad2(localNow.getUTCHours())}:${pad2(localNow.getUTCMinutes())}:${pad2(localNow.getUTCSeconds())} ${timezoneLabel(cfg.timezone_offset)}`;
  const tzLbl = timezoneLabel(cfg.timezone_offset);

  const { html, text } = renderModeEmail({
    title: subject,
    subtitle,
    sections: mergedSections,
    runAt: localNow,
    timezoneLabel: tzLbl,
    appUrl: cfg.app_url,
  });

  const idemParts = mergedSections.map((s) => `${s.title}|${s.items.length}`).join('|');
  const idempotencyKey = `cf-todo:digest:${idemBucket()}:${(await sha256Hex(idemParts)).slice(0, 16)}`;
  const result = await sendEmail(env.RESEND_API_KEY, {
    from: cfg.from, to: cfg.recipient, subject, html, text, idempotencyKey,
  });

  await saveState(db, state);

  return {
    skipped: false,
    sent: result.ok ? 1 : 0,
    failed: result.ok ? 0 : 1,
    resendId: result.id,
    error: result.error,
    modes: results,
  };
}

// ==================== 连通测试 ====================

export async function sendTestEmail(env: Env, cfg: ReminderConfig): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY not set' };
  if (!cfg.recipient || !cfg.from) return { ok: false, error: 'recipient or from not configured' };

  const db = createReadDb(env.DB);
  const tzOffsetMs = cfg.timezone_offset * 60 * 1000;
  const nowUtcMs = Date.now();
  const localNow = new Date(nowUtcMs + tzOffsetMs);
  const todayStr = getLocalDateStr(localNow);

  const displayedIds = new Set<string>();
  const results: ModeResult[] = [];

  const timedResult = await runTimedMode(db, cfg, localNow, todayStr, tzOffsetMs, nowUtcMs, displayedIds);
  results.push(timedResult);
  timedResult.displayedIds.forEach((id) => displayedIds.add(id));

  const priorityResult = await runPriorityMode(db, cfg, todayStr, displayedIds);
  results.push(priorityResult);
  priorityResult.displayedIds.forEach((id) => displayedIds.add(id));

  const dailyResult = await runDailyMode(db, cfg, todayStr, displayedIds);
  results.push(dailyResult);
  dailyResult.displayedIds.forEach((id) => displayedIds.add(id));

  const mergedSections: EmailSection[] = [];
  for (const r of results) mergedSections.push(...r.sections);

  if (mergedSections.length === 0 && cfg.daily_include_search === 'off') {
    return { ok: false, error: '当前无符合条件的数据可发送（今日无待办或模式都未启用）' };
  }

  if (mergedSections.length > 0 && cfg.daily_include_search !== 'off') {
    const allTodosForSearch = await fetchTodayTodos(db, todayStr, {});
    mergedSections.push(...buildSearchSections(allTodosForSearch, cfg.daily_include_search));
  }

  if (mergedSections.length === 0) {
    mergedSections.push({ title: '当前无待办数据', items: [], emptyMessage: '今日无待办，连通测试正常', listStyle: 'cards' });
  }

  const summaries = results.filter((r) => r.summary).map((r) => r.summary!);
  const subjectPrefix = summaries.length > 0 ? summaries.join(' · ') : '无数据';
  const subject = `[连通测试] ${subjectPrefix}`;
  const subtitle = `${mergedSections.length} 个板块 · ${getLocalDateStr(localNow)} ${pad2(localNow.getUTCHours())}:${pad2(localNow.getUTCMinutes())}:${pad2(localNow.getUTCSeconds())} ${timezoneLabel(cfg.timezone_offset)}`;

  const { html, text } = renderModeEmail({
    title: subject, subtitle, sections: mergedSections,
    runAt: localNow, timezoneLabel: timezoneLabel(cfg.timezone_offset), appUrl: cfg.app_url,
  });

  const result = await sendEmail(env.RESEND_API_KEY, {
    from: cfg.from, to: cfg.recipient, subject, html, text,
    idempotencyKey: `cf-todo:test:${idemBucket()}`,
  });
  return { ok: result.ok, id: result.id, error: result.error };
}
