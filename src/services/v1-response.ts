/**
 * V1 Response Helpers —— 响应信封 + DTO 格式化
 *
 *
 *   - V0 返回裸 array/object
 *   - V1 返回 { success, data, pagination? } 信封 + Cache-Control: no-store
 *   - V1 用 formatTodo() 格式化（含 last_completed_at / last_duration_ms / is_zero_duration 计算字段）
 *   - V1 用 formatCategory() 格式化
 */

import { normalizePriority, parseJsonField, DEFAULT_CATEGORY_COLOR } from '../utils.js';

// ==================== 响应信封 ====================

/**
 * V1 成功响应。
 * 返回 { success: true, data } 信封 + Cache-Control: no-store（V1 特有，V0 无此头）。
 */
export function v1Ok(data: unknown, pagination?: unknown, status = 200): Response {
  const body: Record<string, unknown> = { success: true, data };
  if (pagination !== undefined) body.pagination = pagination;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * V1 成功响应（无 data 字段，仅 success: true）。
 * 用于 DELETE / abort 等无返回体的操作。
 */
export function v1OkNoData(status = 200): Response {
  return new Response(JSON.stringify({ success: true }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * V1 错误响应。V0/V1 共用，但 V1 加 Cache-Control: no-store。
 */
export function v1Err(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

// ==================== DTO 格式化 ====================

/** V1 Todo DTO 类型。 */
export interface V1TodoDTO {
  id: string;
  parent_id: string;
  date: string;
  text: string;
  time: string;
  priority: string;
  desc: string;
  url: string;
  copy_text: string;
  subtasks: Array<{ text: string; done: boolean }>;
  search_terms: Array<{ text: string; done: boolean }>;
  done: boolean;
  deleted: boolean;
  type: string;
  rrule: string;
  anchor_date: string;
  exdates: string;
  end_time: string;
  category_id: string;
  is_series: boolean;
  time_records: Array<{ s: number; e: number; p?: number }>;
  last_completed_at: number | null;
  last_duration_ms: number | null;
  is_zero_duration: boolean;
  fragment_anchor: string;
}

/**
 * 格式化 todo 记录为 V1 DTO。
 *
 * 计算字段（取最新一条 time_records）：
 *   - last_completed_at：最新完成时刻（epoch ms）
 *   - last_duration_ms：最新实际耗时（ms），零耗时为 0
 *   - is_zero_duration：最新记录是否零耗时（s===e）
 */
export function formatTodo(row: Record<string, unknown>): V1TodoDTO {
  const subtasks = (parseJsonField(row.subtasks) as unknown as unknown[])
    .map((s) => {
      if (typeof s === 'string' && s.trim()) return { text: s, done: false };
      if (s && typeof s === 'object' && (s as { text?: string }).text) return s as { text: string; done: boolean };
      return null;
    })
    .filter(Boolean) as Array<{ text: string; done: boolean }>;

  const searchTerms = (parseJsonField(row.search_terms) as unknown as unknown[])
    .map((w) => {
      if (typeof w === 'string' && w.trim()) return { text: w, done: false };
      if (w && typeof w === 'object' && (w as { text?: string }).text) return w as { text: string; done: boolean };
      return null;
    })
    .filter(Boolean) as Array<{ text: string; done: boolean }>;

  // 解析实例级 time_records
  let time_records: Array<{ s: number; e: number; p?: number }> = [];
  try {
    const raw = row.time_records;
    if (Array.isArray(raw)) {
      time_records = raw as Array<{ s: number; e: number; p?: number }>;
    } else if (typeof raw === 'string' && raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) time_records = parsed;
    }
  } catch {
    time_records = [];
  }

  // 计算字段：取最新一条 record（末尾）
  let last_completed_at: number | null = null;
  let last_duration_ms: number | null = null;
  let is_zero_duration = false;
  if (time_records.length > 0) {
    const last = time_records[time_records.length - 1];
    const s = Number(last.s) || 0;
    const e = Number(last.e) || 0;
    const p = Number(last.p) || 0;
    last_completed_at = e > 0 ? e : null;
    is_zero_duration = s === e;
    last_duration_ms = Math.max(0, e - s - p);
  }

  // type 兜底
  let type = (row.type as string) || 'none';
  if (type !== 'none' && type !== 'fragment' && type !== 'recurring') type = 'none';

  return {
    id: row.id as string,
    parent_id: row.parent_id as string,
    date: row.date as string,
    text: row.text as string,
    time: (row.time as string) || '',
    priority: normalizePriority((row.priority as string) || 'low'),
    desc: (row.desc as string) || '',
    url: (row.url as string) || '',
    copy_text: (row.copy_text as string) || '',
    subtasks,
    search_terms: searchTerms,
    done: !!row.done,
    deleted: !!row.deleted,
    type,
    rrule: (row.rrule as string) || '',
    anchor_date: (row.anchor_date as string) || '',
    exdates: (row.exdates as string) || '[]',
    end_time: (row.end_time as string) || '',
    category_id: (row.category_id as string) || '',
    is_series: type === 'recurring',
    time_records,
    last_completed_at,
    last_duration_ms,
    is_zero_duration,
    fragment_anchor: (row.fragment_anchor as string) || '',
  };
}

/** V1 Category DTO 类型。 */
export interface V1CategoryDTO {
  id: string;
  name: string;
  color: string;
}

/**
 * 格式化 category 记录为 V1 DTO。
 */
export function formatCategory(row: Record<string, unknown>): V1CategoryDTO {
  return {
    id: row.id as string,
    name: row.name as string,
    color: (row.color as string) || DEFAULT_CATEGORY_COLOR,
  };
}
