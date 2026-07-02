/**
 * Todos Get Service —— V0 GET /api/todos
 *
 *
 * 核心逻辑：
 *   1. 日期校验（YYYY-MM-DD + 真实性）
 *   3. 查当天可见 todos：
 *      - 普通 todo (none/recurring)：date = ?
 *      - fragment 已完成：date = ?（冻结到完成日期）
 *      - fragment 未完成：date = '' OR date <= ?（浮动可见）
 *   4. 模板展开：
 *      - 查 type=recurring 模板，anchor_date <= date，NOT EXISTS 同日期实例
 *      - isOccurrenceOnDate 判断是否在此日期生成实例
 *      - search_terms 热词替换（fetchHotSearchData，5s 超时 + 失败降级）
 *   5. 格式化响应：解析 subtasks/search_terms JSON + type 兜底 + is_series 派生
 */

import type { Db } from '../db/client';
import { normalizePriority, fetchHotSearchData } from '../utils.js';
import { isOccurrenceOnDate } from '../recurring-engine.js';

/** D1 原生数据库实例。 */
function d1(db: Db): D1Database {
  return (db as unknown as { $client: D1Database }).$client;
}

import { withTodosDateLock } from '../middleware/per-date-lock';

/** 格式化后的 todo 行类型。 */
export interface FormattedTodo {
  id: string;
  parent_id: string;
  date: string;
  text: string;
  time: string;
  priority: string;
  desc: string;
  url: string;
  copy_text: string;
  done: boolean;
  deleted: number;
  type: string;
  end_time: string;
  category_id: string;
  time_records: string;
  fragment_anchor: string;
  rrule: string;
  anchor_date: string;
  exdates: string;
  subtasks: unknown[];
  search_terms: Array<{ text: string; done: boolean }>;
  is_series: boolean;
  [key: string]: unknown;
}

/**
 * 获取指定日期的 todos（含 RRULE 展开）。
 * 与 api.js:1809-1977 完全一致。
 */
export async function getTodos(
  db: Db,
  date: string,
): Promise<{ ok: true; todos: FormattedTodo[] } | { ok: false; error: string; status: number }> {
  // 日期校验
  if (!date) return { ok: false, error: 'Date required', status: 400 };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: `date 格式应为 YYYY-MM-DD，当前值: ${date}`, status: 400 };
  }
  const [yy, mm, dd] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  if (dt.getUTCFullYear() !== yy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) {
    return { ok: false, error: `日期无效: ${date}`, status: 400 };
  }

  const todos = await withTodosDateLock(date, async () => {
    const d = d1(db);

    // 1. 查当天可见 todos
    const r = await d
      .prepare(
        `SELECT * FROM todos WHERE deleted = 0 AND (
           (type != 'fragment' AND date = ?)
           OR (type = 'fragment' AND done = 1 AND date = ?)
           OR (type = 'fragment' AND done = 0 AND (date = '' OR date <= ?))
        )`,
      )
      .bind(date, date, date)
      .all();
    let results: Record<string, unknown>[] = (r.results || []) as Record<string, unknown>[];

    // 2. 模板展开：仅 type='recurring' 模板参与
    const templatesReq = await d
      .prepare(
        `SELECT * FROM todo_templates t
        WHERE t.type = 'recurring'
        AND t.anchor_date <= ?
        AND NOT EXISTS (
          SELECT 1 FROM todos td
          WHERE td.parent_id = t.parent_id
            AND td.date = ?
            AND td.deleted = 0
        )`,
      )
      .bind(date, date)
      .all();

    const insertStmts: D1PreparedStatement[] = [];
    let newlyFetchedSearchTerms: string[] | null = null;

    if (templatesReq.results && templatesReq.results.length > 0) {
      for (const tpl of templatesReq.results as Record<string, unknown>[]) {
        const templateForEngine = { ...tpl, exdates: (tpl.exdates as string) || '[]' };

        // 使用 recurring-engine 判断此模板是否在目标日期生成实例
        if (!isOccurrenceOnDate(templateForEngine as never, date)) continue;

        const new_id = crypto.randomUUID();

        let parsedSubtasks: Array<Record<string, unknown>> = [];
        const tplSubtasks = tpl.subtasks as string;
        if (tplSubtasks && tplSubtasks !== '[]' && tplSubtasks !== '') {
          try {
            parsedSubtasks = JSON.parse(tplSubtasks);
            parsedSubtasks.forEach((st) => (st.done = false));
          } catch {
            /* 静默 */
          }
        }

        let parsedSearchTerms: Array<{ text: string; done: boolean }> = [];
        const tplSearchTerms = tpl.search_terms as string;
        if (tplSearchTerms && tplSearchTerms !== '[]' && tplSearchTerms !== '') {
          try {
            const oldTerms = JSON.parse(tplSearchTerms) as unknown[];
            if (Array.isArray(oldTerms) && oldTerms.length > 0) {
              if (!newlyFetchedSearchTerms) {
                const fetched = (await fetchHotSearchData('auto')) as unknown[];
                const valid = fetched.filter((w) => typeof w === 'string' && (w as string).trim().length > 0) as string[];
                newlyFetchedSearchTerms = valid.sort(() => 0.5 - Math.random()).slice(0, 20);
              }
              if (newlyFetchedSearchTerms.length > 0) {
                parsedSearchTerms = newlyFetchedSearchTerms.map((w) => ({ text: w, done: false }));
              } else {
                parsedSearchTerms = oldTerms.map((w) => {
                  const t = typeof w === 'string' ? w : ((w as { text?: string }).text || '');
                  return { text: t, done: false };
                }).filter((w) => w.text);
              }
            }
          } catch {
            /* 静默 */
          }
        }

        // anchor_date 用模板的 anchor_date（RFC 5545 DTSTART 等价物）
        const tpl_anchor_date = (tpl.anchor_date as string) || '';
        const newRecord = {
          ...tpl,
          id: new_id,
          date: date,
          parent_id: tpl.parent_id,
          done: 0,
          deleted: 0,
          subtasks: parsedSubtasks,
          search_terms: parsedSearchTerms,
          time_records: '[]',
          anchor_date: tpl_anchor_date,
        };
        results.push(newRecord);

        insertStmts.push(
          d
            .prepare(
              'INSERT OR IGNORE INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, type, end_time, category_id, time_records, fragment_anchor, rrule, anchor_date, exdates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              new_id,
              tpl.parent_id,
              date,
              tpl.text,
              tpl.time || '',
              normalizePriority(tpl.priority as string),
              tpl.desc || '',
              tpl.url || '',
              tpl.copy_text || '',
              JSON.stringify(parsedSubtasks),
              JSON.stringify(parsedSearchTerms),
              0,
              0,
              'recurring',
              tpl.end_time || '',
              tpl.category_id || '',
              '[]',
              '',
              tpl.rrule || '',
              tpl_anchor_date,
              '[]',
            ),
        );
      }
      // 分片 batch INSERT（D1 限制 100 参数/query，但单条 INSERT 只有 21 参数，
      // batch 限制是 ~1000 statements，这里用 100 分片保守）
      for (let i = 0; i < insertStmts.length; i += 100) {
        await d.batch(insertStmts.slice(i, i + 100));
      }
    }

    // 3. 格式化响应
    const formatted = results.map((row) => {
      let parsedSubtasks: unknown[] = [];
      let parsedSearchTerms: Array<{ text: string; done?: boolean }> = [];

      if (Array.isArray(row.subtasks)) {
        parsedSubtasks = row.subtasks as unknown[];
      } else {
        try {
          if (row.subtasks) parsedSubtasks = JSON.parse(row.subtasks as string);
        } catch {
          /* 静默 */
        }
      }

      if (Array.isArray(row.search_terms)) {
        parsedSearchTerms = row.search_terms as Array<{ text: string; done?: boolean }>;
      } else {
        try {
          if (row.search_terms) parsedSearchTerms = JSON.parse(row.search_terms as string);
        } catch {
          /* 静默 */
        }
      }

      parsedSearchTerms = (parsedSearchTerms as unknown[])
        .map((w) => {
          if (typeof w === 'string' && w.trim()) return { text: w, done: false };
          if (w && typeof w === 'object' && (w as { text?: string }).text) return w as { text: string; done: boolean };
          return null;
        })
        .filter(Boolean) as Array<{ text: string; done: boolean }>;

      // type 兜底（防 DB 脏数据）
      let type = (row.type as string) || 'none';
      if (type !== 'none' && type !== 'fragment' && type !== 'recurring') type = 'none';

      return {
        ...row,
        type: type,
        rrule: (row.rrule as string) || '',
        anchor_date: (row.anchor_date as string) || '',
        exdates: (row.exdates as string) || '[]',
        end_time: (row.end_time as string) || '',
        is_series: type === 'recurring',
        done: !!row.done,
        subtasks: parsedSubtasks,
        search_terms: parsedSearchTerms,
        fragment_anchor: (row.fragment_anchor as string) || '',
      } as FormattedTodo;
    });

    return formatted;
  });

  return { ok: true, todos };
}
