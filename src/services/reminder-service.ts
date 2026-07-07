/**
 * 定时提醒服务 —— digest 模式：所有启用的模式合并为一封邮件发送。
 *
 * 流程：
 *   1. 每次 Cron 触发，运行所有启用的模式（timed / daily / priority）
 *   2. 每个模式返回 EmailSection[]（不直接发邮件）
 *   3. 合并所有 sections + 附加搜索词 section（所有模式共享）
 *   4. 若合并后有内容则发一封 digest 邮件；无内容则不发
 *   5. 主题由各模式 summary 用「·」拼接，如「即将到期 2 项 · 今日汇总 5 项」
 *
 * 去重：15s 时间桶 + sections 内容哈希幂等键，防 Cron 抖动重发。
 * 不再按 todo_id 应用层去重——每次 Cron 扫描到窗口内的待办都发。
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
  // 时间跳过（hh:mm 格式，空表示不跳过；同时设置时在该时段内不发邮件）
  skip_start: string;
  skip_end: string;
}

interface ReminderState {
  last_run: number;
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
  enabled: boolean;
  /** 本模式贡献的邮件 section（可能为空，表示无内容可发） */
  sections: EmailSection[];
  /** 简短描述，用于拼邮件主题，如「即将到期2」「汇总(9/10)」「优先级3」 */
  summary?: string;
  /** 本模式展示的 todo id（供后续模式去重） */
  displayedIds: string[];
  /** 统计：检查的待办数 */
  checked: number;
  skipped: boolean;
  reason?: string;
}

export interface ReminderRunResult {
  skipped: boolean;
  reason?: string;
  /** 合并发送结果 */
  sent: number;
  failed: number;
  resendId?: string;
  error?: string;
  /** 各模式执行情况（不单独发邮件，仅记录 sections 贡献） */
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

export function normalizeConfig(input: unknown): ReminderConfig {
  if (!input || typeof input !== 'object') return { ...DEFAULT_CONFIG };
  const r = input as Record<string, unknown>;
  // 旧配置迁移：hot_search_enabled → daily_include_search
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
    // daily 启用要求至少包含未完成/已完成之一
    daily_enabled: r.daily_enabled === true && (dailyIncludeUncompleted || dailyIncludeCompleted),
    daily_include_completed: dailyIncludeCompleted,
    daily_include_uncompleted: dailyIncludeUncompleted,
    daily_include_search: migratedSearch,
    priority_enabled: r.priority_enabled === true,
    priority_min_level: parsePriorityLevel(r.priority_min_level),
    skip_start: parseHHMM(r.skip_start),
    skip_end: parseHHMM(r.skip_end),
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

/** 15 秒时间桶：用于 Resend Idempotency-Key。同一桶内重复请求被去重，跨桶允许新发。 */
function idemBucket(): number {
  return Math.floor(Date.now() / 15000);
}

/** 检查当前时间（目标时区壁钟）是否在跳过范围内。支持跨午夜（如 23:00-07:00）。 */
function isInSkipWindow(localNow: Date, skipStart: string, skipEnd: string): boolean {
  if (!skipStart || !skipEnd) return false;
  const [sh, sm] = skipStart.split(':').map(Number);
  const [eh, em] = skipEnd.split(':').map(Number);
  const cur = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  // 同日：start < end，cur 在 [start, end) 内
  // 跨午夜：start > end，cur >= start 或 cur < end
  if (start < end) return cur >= start && cur < end;
  if (start > end) return cur >= start || cur < end;
  // start === end：不跳过（避免全天跳过）
  return false;
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

// ==================== search_terms 解析（供各模式附加 section 用） ====================

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

// ==================== 模式: timed（返回 sections，不直接发邮件） ====================

async function runTimedMode(
  db: Db, cfg: ReminderConfig,
  localNow: Date, todayStr: string, tzOffsetMs: number, nowUtcMs: number,
  excludeIds: Set<string>,
): Promise<ModeResult> {
  if (!cfg.timed_enabled) return { mode: 'timed', enabled: false, sections: [], displayedIds: [], checked: 0, skipped: true, reason: 'disabled' };

  const allTodos = await fetchTodayTodos(db, todayStr, { includeDone: false });
  const timed = allTodos.filter((t) => t.time && /^\d{1,2}:\d{2}$/.test(t.time) && !excludeIds.has(t.id));
  if (timed.length === 0) return { mode: 'timed', enabled: true, sections: [], displayedIds: [], checked: 0, skipped: false, reason: 'no_timed_todos' };

  const windowStartMs = nowUtcMs - LOOKBACK_MINUTES * 60 * 1000;
  const windowEndMs = nowUtcMs + cfg.timed_lead_minutes * 60 * 1000;

  const dueTodos: DueTodo[] = [];
  for (const t of timed) {
    const dueUtcMs = dueUtcMsFor(t.time, localNow, tzOffsetMs);
    if (dueUtcMs === null) continue;
    if (dueUtcMs > windowStartMs && dueUtcMs <= windowEndMs) {
      dueTodos.push(t);
    }
  }

  if (dueTodos.length === 0) {
    return { mode: 'timed', enabled: true, sections: [], displayedIds: [], checked: timed.length, skipped: false, reason: 'no_due_in_window' };
  }

  const sections: EmailSection[] = [{
    title: `未来 ${cfg.timed_lead_minutes} 分钟内即将到期`,
    items: dueTodos.map(dueTodoToItem),
    listStyle: 'cards',
  }];
  return {
    mode: 'timed', enabled: true, sections, checked: timed.length, skipped: false,
    summary: `即将到期${dueTodos.length}`,
    displayedIds: dueTodos.map((t) => t.id),
  };
}

// ==================== 模式: daily（返回 sections） ====================

async function runDailyMode(
  db: Db, cfg: ReminderConfig, todayStr: string,
  excludeIds: Set<string>,
): Promise<ModeResult> {
  if (!cfg.daily_enabled) return { mode: 'daily', enabled: false, sections: [], displayedIds: [], checked: 0, skipped: true, reason: 'disabled' };

  const allTodos = await fetchTodayTodos(db, todayStr, {});
  const totalUncompleted = allTodos.filter((t) => t.done === 0).length;
  const totalCount = allTodos.length;

  // 未完成 section 排除已展示的；已完成不受影响
  const showUncompleted = cfg.daily_include_uncompleted
    ? allTodos.filter((t) => t.done === 0 && !excludeIds.has(t.id))
    : [];
  const showCompleted = cfg.daily_include_completed
    ? allTodos.filter((t) => t.done === 1)
    : [];

  const sections: EmailSection[] = [];
  const displayedIds: string[] = [];
  // 有排除时标题用「其余未完成」表明已去重
  const uncompletedTitle = excludeIds.size > 0 ? '其余未完成' : '今日未完成';

  if (cfg.daily_include_uncompleted) {
    sections.push({
      title: uncompletedTitle,
      items: showUncompleted.map(dueTodoToItem),
      emptyMessage: '无其余未完成待办',
      listStyle: 'cards',
    });
    showUncompleted.forEach((t) => displayedIds.push(t.id));
  }
  if (cfg.daily_include_completed) {
    sections.push({
      title: '今日已完成',
      items: showCompleted.map(dueTodoToItem),
      emptyMessage: '今日无已完成待办',
      listStyle: 'cards',
    });
    showCompleted.forEach((t) => displayedIds.push(t.id));
  }

  // 标题格式：汇总(未完成/总数)
  const summary = `汇总(${totalUncompleted}/${totalCount})`;
  return {
    mode: 'daily', enabled: true, sections, displayedIds, checked: totalCount, skipped: false,
    summary,
  };
}

// ==================== 模式: priority（返回 sections） ====================

async function runPriorityMode(
  db: Db, cfg: ReminderConfig, todayStr: string,
  excludeIds: Set<string>,
): Promise<ModeResult> {
  if (!cfg.priority_enabled) return { mode: 'priority', enabled: false, sections: [], displayedIds: [], checked: 0, skipped: true, reason: 'disabled' };

  const allTodos = await fetchTodayTodos(db, todayStr, { includeDone: false, minPriority: cfg.priority_min_level });
  // 排除已展示的
  const showTodos = allTodos.filter((t) => !excludeIds.has(t.id));
  if (showTodos.length === 0) {
    return { mode: 'priority', enabled: true, sections: [], displayedIds: [], checked: 0, skipped: false, reason: 'no_matching_todos' };
  }

  const levelLabel = cfg.priority_min_level === 'high' ? '高' : cfg.priority_min_level === 'med' ? '中及以上' : '全部';
  const sections: EmailSection[] = [{
    title: `${levelLabel}优先级未完成`,
    items: showTodos.map(dueTodoToItem),
    listStyle: 'cards',
  }];
  // 标题用短标签：高优3 / 中优5 / 全优8
  const shortLevel = cfg.priority_min_level === 'high' ? '高优' : cfg.priority_min_level === 'med' ? '中优' : '全优';
  return {
    mode: 'priority', enabled: true, sections, checked: allTodos.length, skipped: false,
    summary: `${shortLevel}${showTodos.length}`,
    displayedIds: showTodos.map((t) => t.id),
  };
}

// ==================== 主入口：合并所有模式为一封 digest 邮件 ====================

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

  // 时间跳过：在跳过时段内不发送任何邮件
  if (isInSkipWindow(localNow, cfg.skip_start, cfg.skip_end)) {
    return { skipped: true, reason: `skip_window ${cfg.skip_start}-${cfg.skip_end}`, sent: 0, failed: 0, modes: [] };
  }

  const state = await getState(db);
  state.last_run = nowUtcMs;

  // 按顺序运行所有启用的模式（timed → priority → daily），后续模式排除已展示的 todo
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

  // 附加搜索词 section（所有模式共享，按来源 todo 分组）
  if (mergedSections.length > 0 && cfg.daily_include_search !== 'off') {
    const allTodosForSearch = await fetchTodayTodos(db, todayStr, {});
    const searchSections = buildSearchSections(allTodosForSearch, cfg.daily_include_search);
    mergedSections.push(...searchSections);
  }

  // 无内容则不发邮件（仍保存 state）
  if (mergedSections.length === 0) {
    await saveState(db, state);
    return { skipped: false, sent: 0, failed: 0, modes: results };
  }

  // 组合邮件主题：各模式紧凑标签用「·」拼接（即将到期2 · 高优3 · 汇总(9/10)）
  const summaries = results.filter((r) => r.summary).map((r) => r.summary!);
  const subject = summaries.join(' · ');
  const modeSectionCount = results.reduce((acc, r) => acc + r.sections.length, 0);
  const tzLbl = timezoneLabel(cfg.timezone_offset);
  const subtitle = `${modeSectionCount} 个板块 · ${getLocalDateStr(localNow)} ${pad2(localNow.getUTCHours())}:${pad2(localNow.getUTCMinutes())} ${tzLbl}`;

  const { html, text } = renderModeEmail({
    title: subject,
    subtitle,
    sections: mergedSections,
    runAt: localNow,
    timezoneLabel: tzLbl,
    appUrl: cfg.app_url,
  });

  // 幂等键：15s 时间桶 + sections 内容哈希
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

// ==================== 连通测试（用真实数据发一封 digest，不修改 state） ====================

export async function sendTestEmail(env: Env, cfg: ReminderConfig): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY not set' };
  if (!cfg.recipient || !cfg.from) return { ok: false, error: 'recipient or from not configured' };

  const db = createDb(env.DB);
  const tzOffsetMs = cfg.timezone_offset * 60 * 1000;
  const nowUtcMs = Date.now();
  const localNow = new Date(nowUtcMs + tzOffsetMs);
  const todayStr = getLocalDateStr(localNow);

  // 用真实数据运行各模式（空 state，不写去重表）
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

  // 附加搜索词
  if (mergedSections.length > 0 && cfg.daily_include_search !== 'off') {
    const allTodosForSearch = await fetchTodayTodos(db, todayStr, {});
    mergedSections.push(...buildSearchSections(allTodosForSearch, cfg.daily_include_search));
  }

  // 无内容时补占位 section 确认连通性
  if (mergedSections.length === 0) {
    mergedSections.push({ title: '当前无待办数据', items: [], emptyMessage: '今日无待办，连通测试正常', listStyle: 'cards' });
  }

  const summaries = results.filter((r) => r.summary).map((r) => r.summary!);
  const subjectPrefix = summaries.length > 0 ? summaries.join(' · ') : '无数据';
  const subject = `[连通测试] ${subjectPrefix}`;
  const subtitle = `${mergedSections.length} 个板块 · ${getLocalDateStr(localNow)} ${pad2(localNow.getUTCHours())}:${pad2(localNow.getUTCMinutes())} ${timezoneLabel(cfg.timezone_offset)}`;

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
