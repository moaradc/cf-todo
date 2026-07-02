/**
 * Time Records Service —— V0 time-records 查询
 *
 *
 * 业务逻辑：
 *   - todo_id 查询（推荐）：实例级 records + 模板级 template_records
 *     实例级用于"完成于"显示，模板级用于 predictDuration（基于该模板最近 10 次完成时长中位数）
 *   - parent_id 查询（兼容旧客户端）：仅返回模板级 records
 *
 * FIFO 规则（写入时截断，读取时直接返回全部）：
 *   - 普通 todo：实例级 FIFO 5 / 模板级 FIFO 10
 *   - fragment：unlimited（不截断）
 *   - template：FIFO 10
 */

import type { Db } from '../db/client';

/** time-records 响应。 */
export interface TimeRecordsResponse {
  records: Array<{ s: number; e: number; p?: number }>;
  template_records: Array<{ s: number; e: number; p?: number }>;
}

/**
 * 获取 time-records。
 * 与 api.js:1979-2028 一致。
 */
export async function getTimeRecords(
  db: Db,
  params: { todo_id?: string | null; parent_id?: string | null },
): Promise<{ ok: true; data: TimeRecordsResponse } | { ok: false; error: string }> {
  const { todo_id, parent_id } = params;
  const d1 = (db as unknown as { $client: D1Database }).$client;

  let records: Array<{ s: number; e: number; p?: number }> = [];
  let template_records: Array<{ s: number; e: number; p?: number }> = [];

  if (todo_id) {
    // 实例级查询（推荐）：修复同一模板不同实例串台的问题
    const todo_row = await d1
      .prepare('SELECT time_records, parent_id FROM todos WHERE id = ?')
      .bind(todo_id)
      .first<{ time_records: string; parent_id: string }>();

    if (todo_row) {
      try {
        const p =
          typeof todo_row.time_records === 'string'
            ? JSON.parse(todo_row.time_records || '[]')
            : todo_row.time_records;
        if (Array.isArray(p)) records = p;
      } catch {
        // 静默
      }
      // 同时取模板级记录，用于 predictDuration
      const pidForTpl = todo_row.parent_id;
      if (pidForTpl) {
        const tplRow = await d1
          .prepare('SELECT time_records FROM todo_templates WHERE parent_id = ?')
          .bind(pidForTpl)
          .first<{ time_records: string }>();
        if (tplRow) {
          try {
            const tp =
              typeof tplRow.time_records === 'string'
                ? JSON.parse(tplRow.time_records || '[]')
                : tplRow.time_records;
            if (Array.isArray(tp)) template_records = tp;
          } catch {
            // 静默
          }
        }
      }
    }
  } else if (parent_id) {
    // 兼容旧客户端：仅返回模板级记录
    const row = await d1
      .prepare('SELECT time_records FROM todo_templates WHERE parent_id = ?')
      .bind(parent_id)
      .first<{ time_records: string }>();
    if (row && row.time_records) {
      try {
        const parsed =
          typeof row.time_records === 'string' ? JSON.parse(row.time_records) : row.time_records;
        if (Array.isArray(parsed)) records = parsed;
      } catch {
        // 静默
      }
    }
  } else {
    return { ok: false, error: 'todo_id or parent_id required' };
  }

  return { ok: true, data: { records, template_records } };
}
