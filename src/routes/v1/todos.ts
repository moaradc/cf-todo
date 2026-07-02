/**
 * V1 Todos 路由 —— 最复杂的 V1 路由块
 *
 *
 * 路由：
 *   GET    /api/v1/todos           — 列表查询（pagination + date/range + category_id + done + expand）
 *   POST   /api/v1/todos           — 创建（服务端生成 id）
 *   GET    /api/v1/todos/:id       — 获取单个
 *   PUT    /api/v1/todos/:id       — 更新（PATCH 语义 + scope）
 *   DELETE /api/v1/todos/:id       — 删除（scope）
 *   PATCH  /api/v1/todos/:id/toggle — 切换完成
 *   PATCH  /api/v1/todos/:id/subtasks — 更新子任务
 *   PATCH  /api/v1/todos/:id/search-terms — 更新搜索词
 *   POST   /api/v1/todos/batch     — 批量操作
 *
 * 用 raw D1 API 保持与原代码字节级一致。
 */

import { Hono } from 'hono';
import { normalizePriority, parseJsonField } from '../../utils.js';
import { createDb } from '../../db/client';
import { v1Ok, v1OkNoData, v1Err, formatTodo } from '../../services/v1-response';
import { withTodosDateLock } from '../../middleware/per-date-lock';
import {
  processRRule, validateType, validateDateFormat, validateTimeFormat, validateExdates,
  addExdate, getPreviousDate, sanitizeRRule,
  computeUpdateActions, computeDeleteActions, isOccurrenceOnDate,
} from '../../recurring-engine.js';
import type { V1AppEnv } from './index';

function d1(db: ReturnType<typeof createDb>): D1Database {
  return (db as unknown as { $client: D1Database }).$client;
}
const BATCH_CHUNK_SIZE = 99;
function chunkArray<T>(arr: T[], size: number): T[][] {
  const c: T[][] = []; for (let i = 0; i < arr.length; i += size) c.push(arr.slice(i, i + size)); return c;
}
function sqlPlaceholders(n: number): string { return Array.from({ length: n }, () => '?').join(','); }

/** V1 鉴权。 */

/** writeTimerRecord（V1 toggle 用）。与 api-v1.js:1217-1270 一致。 */
async function writeTimerRecord(DB: D1Database, todo_id: string, parent_id: string, record: { s: number; e: number; p?: number }, is_fragment: boolean): Promise<boolean> {
  if (!record || typeof record !== 'object') return false;
  if (typeof record.s !== 'number' || typeof record.e !== 'number') return false;
  const s = Math.floor(record.s); const e = Math.floor(record.e); const p = Math.floor(record.p || 0);
  const MAX = 7 * 24 * 60 * 60 * 1000;
  if (!(s > 0 && e >= s && (e - s) <= MAX && p >= 0 && p <= (e - s))) return false;
  const is_zero = (s === e);
  try {
    const cur = await DB.prepare('SELECT time_records FROM todos WHERE id = ?').bind(todo_id).first<{ time_records: string }>();
    if (cur) {
      let arr: unknown[] = [];
      try { arr = typeof cur.time_records === 'string' ? JSON.parse(cur.time_records || '[]') : cur.time_records; } catch { arr = []; }
      if (!Array.isArray(arr)) arr = [];
      (arr as Array<Record<string, unknown>>).push({ s, e, p });
      if (!is_fragment && arr.length > 5) arr = arr.slice(arr.length - 5);
      await DB.prepare('UPDATE todos SET time_records = ? WHERE id = ?').bind(JSON.stringify(arr), todo_id).run();
    }
  } catch { /* 静默 */ }
  if (!is_zero && !is_fragment && parent_id) {
    try {
      const tpl = await DB.prepare('SELECT time_records FROM todo_templates WHERE parent_id = ?').bind(parent_id).first<{ time_records: string }>();
      if (tpl) {
        let arr: unknown[] = [];
        try { arr = Array.isArray(tpl.time_records) ? tpl.time_records : JSON.parse(tpl.time_records || '[]'); } catch { arr = []; }
        if (!Array.isArray(arr)) arr = [];
        (arr as Array<Record<string, unknown>>).push({ s, e, p });
        if (arr.length > 10) arr = arr.slice(arr.length - 10);
        await DB.prepare('UPDATE todo_templates SET time_records = ? WHERE parent_id = ?').bind(JSON.stringify(arr), parent_id).run();
      }
    } catch { /* 静默 */ }
  }
  return true;
}

export const v1TodosApp = new Hono<V1AppEnv>();

// ==================== GET /api/v1/todos ====================

v1TodosApp.get('/todos', async (c) => {
  const d = d1(createDb(c.env.DB));
  const url = new URL(c.req.url);
  const date = url.searchParams.get('date');
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');
  const category_id = url.searchParams.get('category_id');
  const done = url.searchParams.get('done');
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 500);
  const offset = Math.min(Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0), 10000);
  const expand = url.searchParams.get('expand') !== 'false';

  const execGet = async () => {
    const conditions: string[] = ['deleted = 0'];
    const params: (string | number)[] = [];
    if (date) {
      conditions.push(`(type != 'fragment' AND date = ?) OR (type = 'fragment' AND done = 1 AND date = ?) OR (type = 'fragment' AND done = 0 AND (date = '' OR date <= ?))`);
      params.push(date, date, date);
    } else if (startDate && endDate) {
      conditions.push(`(type != 'fragment' AND date >= ? AND date <= ?) OR (type = 'fragment' AND done = 1 AND date >= ? AND date <= ?) OR (type = 'fragment' AND done = 0 AND (date = '' OR date <= ?))`);
      params.push(startDate, endDate, startDate, endDate, endDate);
    } else if (startDate) {
      conditions.push(`(type != 'fragment' AND date >= ?) OR (type = 'fragment' AND done = 1 AND date >= ?) OR (type = 'fragment' AND done = 0 AND (date = '' OR date >= ?))`);
      params.push(startDate, startDate, startDate);
    } else if (endDate) {
      conditions.push(`(type != 'fragment' AND date <= ?) OR (type = 'fragment' AND done = 1 AND date <= ?) OR (type = 'fragment' AND done = 0 AND (date = '' OR date <= ?))`);
      params.push(endDate, endDate, endDate);
    }
    if (category_id) { conditions.push('category_id = ?'); params.push(category_id); }
    if (done === 'true') conditions.push('done = 1');
    else if (done === 'false') conditions.push('done = 0');
    const whereClause = conditions.join(' AND ');
    const countRes = await d.prepare(`SELECT COUNT(*) as total FROM todos WHERE ${whereClause}`).bind(...params).first<{ total: number }>();
    const { results } = await d.prepare(`SELECT * FROM todos WHERE ${whereClause} ORDER BY date ASC, id ASC LIMIT ? OFFSET ?`).bind(...params, limit, offset).all();

    let recurringResults: Record<string, unknown>[] = [];
    let templates: Record<string, unknown>[] = [];
    if (date) {
      if (expand) {
        const templatesReq = await d.prepare(`SELECT * FROM todo_templates t WHERE t.type = 'recurring' AND t.anchor_date <= ? AND NOT EXISTS (SELECT 1 FROM todos td WHERE td.parent_id = t.parent_id AND td.date = ? AND td.deleted = 0)`).bind(date, date).all();
        const insertStmts: D1PreparedStatement[] = [];
        for (const tpl of (templatesReq.results || []) as Record<string, unknown>[]) {
          const templateForEngine = { ...tpl, exdates: (tpl.exdates as string) || '[]' };
          if (!isOccurrenceOnDate(templateForEngine as never, date)) continue;
          if (category_id && ((tpl.category_id as string) || '') !== category_id) continue;
          const new_id = crypto.randomUUID();
          const parsedSubtasks = (parseJsonField(tpl.subtasks) as unknown as Array<Record<string, unknown>>).map((st) => { st.done = false; return st; });
          const tpl_anchor_date = (tpl.anchor_date as string) || '';
          recurringResults.push({ ...tpl, id: new_id, date, parent_id: tpl.parent_id, done: 0, deleted: 0, subtasks: parsedSubtasks, search_terms: [], time_records: '[]', anchor_date: tpl_anchor_date });
          insertStmts.push(d.prepare('INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, type, end_time, category_id, time_records, fragment_anchor, rrule, anchor_date, exdates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(new_id, tpl.parent_id, date, tpl.text, tpl.time || '', tpl.priority || 'low', tpl.desc || '', tpl.url || '', tpl.copy_text || '', JSON.stringify(parsedSubtasks), '[]', 0, 0, 'recurring', tpl.end_time || '', tpl.category_id || '', '[]', '', tpl.rrule || '', tpl_anchor_date, '[]'));
        }
        if (insertStmts.length > 0) { for (let i = 0; i < insertStmts.length; i += 100) await d.batch(insertStmts.slice(i, i + 100)); }
      } else {
        const templatesReq = await d.prepare(`SELECT * FROM todo_templates t WHERE t.type = 'recurring' AND t.anchor_date <= ?`).bind(date).all();
        templates = (templatesReq.results || []).map((t: Record<string, unknown>) => ({ ...t, exdates: (t.exdates as string) || '[]', subtasks: parseJsonField(t.subtasks) }));
      }
    }
    const allResults = [...(results || []), ...recurringResults];
    const formatted = allResults.map((r: Record<string, unknown>) => formatTodo(r));
    const resp: Record<string, unknown> = { success: true, data: formatted, pagination: { total: (countRes?.total || 0) + recurringResults.length, limit, offset } };
    if (!expand) { resp.templates = templates; resp.expand = false; }
    return new Response(JSON.stringify(resp), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  };
  if (date && expand) return withTodosDateLock(date, execGet);
  return execGet();
});

// ==================== POST /api/v1/todos ====================

v1TodosApp.post('/todos', async (c) => {
  const d = d1(createDb(c.env.DB));
  let body: Record<string, unknown>;
  try { body = await c.req.raw.json(); } catch { return v1Err('请求体不是有效的 JSON'); }
  const { date, text, time, priority, desc, url, copy_text, subtasks, search_terms, type: bodyType, end_time, category_id, rrule: bodyRRule, anchor_date: bodyAnchorDate, exdates: bodyExdates } = body as Record<string, unknown>;
  if (body.repeat_type !== undefined || body.repeat_custom !== undefined || body.repeat_interval !== undefined || body.repeat_end !== undefined) return v1Err('v3.0 已废弃 repeat_type / repeat_custom / repeat_interval / repeat_end 字段，请改用 type + rrule + anchor_date + exdates');
  let type = (bodyType as string) || 'none';
  if (type !== 'none' && type !== 'fragment' && type !== 'recurring') return v1Err(`无效的 type: ${type}，v3.0 有效值: none / fragment / recurring`);
  const rruleResult = processRRule((bodyRRule as string) || '', type, { allowDerive: true });
  if (rruleResult.error) return v1Err(rruleResult.error);
  let final_rrule = rruleResult.value;
  if (type === 'recurring' && !final_rrule) return v1Err('type=recurring 时 rrule 不能为空，请提供合法 RFC 5545 RRULE 字符串');
  if (type === 'none' || type === 'fragment') final_rrule = '';
  const exdatesResult = validateExdates(bodyExdates as string);
  if (exdatesResult.error) return v1Err(exdatesResult.error);
  const final_exdates = exdatesResult.value;
  const is_fragment = (type === 'fragment');
  if ((!date && !is_fragment) || !text) return v1Err('date 和 text 为必填项（碎时记允许 date 为空）');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date as string)) return v1Err('date 格式应为 YYYY-MM-DD');
  const id = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const catId = (category_id as string) || '';
  const eTime = is_fragment ? '' : ((end_time as string) || '');
  const effectiveTime = is_fragment ? '' : ((time as string) || '');
  const effective_date = is_fragment ? ((date as string) || '') : (date as string);
  const normPriority = normalizePriority((priority as string) || 'low');
  if (effective_date) { const e = validateDateFormat(effective_date); if (e) return v1Err(e); }
  if (effectiveTime) { const e = validateTimeFormat(effectiveTime); if (e) return v1Err(e); }
  if (eTime) { const e = validateTimeFormat(eTime); if (e) return v1Err(e); }
  const normSubtasks = ((subtasks as unknown[]) || []).map((s: unknown) => { if (typeof s === 'string') return { text: s, done: false }; if (s && typeof s === 'object' && (s as { text?: string }).text) return s; return null; }).filter(Boolean);
  const normSearchTerms = ((search_terms as unknown[]) || []).map((w: unknown) => { if (typeof w === 'string') return { text: w, done: false }; if (w && typeof w === 'object' && (w as { text?: string }).text) return w; return null; }).filter(Boolean);
  const subtasks_str = JSON.stringify(normSubtasks);
  const search_terms_str = JSON.stringify(normSearchTerms);
  const effective_fragment_anchor = is_fragment ? effective_date : '';
  const anchor_date = (type === 'recurring') ? ((bodyAnchorDate as string) || effective_date) : '';
  await d.prepare('INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, type, end_time, category_id, time_records, fragment_anchor, rrule, anchor_date, exdates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, id, effective_date, text, effectiveTime, normPriority, desc || '', url || '', copy_text || '', subtasks_str, search_terms_str, 0, 0, type, eTime, catId, '[]', effective_fragment_anchor, final_rrule, anchor_date, final_exdates).run();
  if (type === 'recurring') {
    await d.prepare('INSERT INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, text, effectiveTime, normPriority, desc || '', url || '', copy_text || '', subtasks_str, search_terms_str, 'recurring', eTime, anchor_date, final_exdates, catId, '[]', final_rrule).run();
  }
  const created = await d.prepare('SELECT * FROM todos WHERE id = ?').bind(id).first<Record<string, unknown>>();
  return v1Ok(formatTodo(created!), undefined, 201);
});

// ==================== GET /api/v1/todos/:id ====================

v1TodosApp.get('/todos/:id', async (c) => {
  const d = d1(createDb(c.env.DB));
  const todo_id = c.req.param('id');
  const row = await d.prepare('SELECT * FROM todos WHERE id = ?').bind(todo_id).first<Record<string, unknown>>();
  if (!row) return v1Err('Todo 不存在', 404);
  return v1Ok(formatTodo(row));
});

// ==================== PUT /api/v1/todos/:id ====================

v1TodosApp.put('/todos/:id', async (c) => {
  const d = d1(createDb(c.env.DB));
  const todo_id = c.req.param('id');
  const existing = await d.prepare('SELECT * FROM todos WHERE id = ?').bind(todo_id).first<Record<string, unknown>>();
  if (!existing) return v1Err('Todo 不存在', 404);
  let body: Record<string, unknown>;
  try { body = await c.req.raw.json(); } catch { return v1Err('请求体不是有效的 JSON'); }
  const parent_id = existing.parent_id as string;
  if (body.repeat_type !== undefined || body.repeat_custom !== undefined || body.repeat_interval !== undefined || body.repeat_end !== undefined) return v1Err('v3.0 已废弃 repeat_type / repeat_custom / repeat_interval / repeat_end 字段，请改用 type + rrule + anchor_date + exdates');
  if (body.type !== undefined && body.type !== 'none' && body.type !== 'fragment' && body.type !== 'recurring') return v1Err(`无效的 type: ${body.type}，v3.0 有效值: none / fragment / recurring`);
  if (body.scope !== undefined && body.scope !== 'none' && !['this', 'thisAndFuture', 'all'].includes(body.scope as string)) return v1Err(`无效的 scope: ${body.scope}，有效值: this, thisAndFuture, all`);
  let patchType = body.type !== undefined ? (body.type as string) : ((existing.type as string) || 'none');
  let patchRRule = (existing.rrule as string) || '';
  let patchAnchorDate = (existing.anchor_date as string) || '';
  let patchExdates = (existing.exdates as string) || '[]';
  if (body.rrule !== undefined) {
    if (body.rrule === null || String(body.rrule).trim() === '') { patchRRule = ''; if (body.type === undefined) patchType = 'none'; }
    else { const r = processRRule(body.rrule as string, patchType, { allowDerive: true }); if (r.error) return v1Err(r.error); patchRRule = r.value; if (patchRRule && patchType === 'none') patchType = 'recurring'; }
  }
  if (body.anchor_date !== undefined) patchAnchorDate = body.anchor_date as string;
  if (body.exdates !== undefined) { const r = validateExdates(body.exdates as string); if (r.error) return v1Err(r.error); patchExdates = r.value; }
  if (patchType === 'fragment' || patchType === 'none') { patchRRule = ''; patchAnchorDate = ''; patchExdates = '[]'; }
  if (patchType === 'recurring' && !patchRRule) return v1Err('type=recurring 时 rrule 不能为空');
  if (patchType === 'recurring') { if (!patchAnchorDate) patchAnchorDate = (body.date as string) || (existing.date as string) || ''; if (!patchAnchorDate) return v1Err('type=recurring 时 anchor_date 不能为空'); }
  const is_series = (existing.type as string) === 'recurring' && patchType !== 'fragment';
  const scope = is_series && body.scope === undefined ? 'this' : ((body.scope as string) || 'none');
  const new_values: Record<string, unknown> = {
    text: body.text !== undefined ? body.text : existing.text,
    time: body.time !== undefined ? body.time : (existing.time || ''),
    priority: body.priority !== undefined ? normalizePriority(body.priority as string) : normalizePriority((existing.priority as string) || 'low'),
    desc: body.desc !== undefined ? body.desc : (existing.desc || ''),
    url: body.url !== undefined ? body.url : (existing.url || ''),
    copy_text: body.copy_text !== undefined ? body.copy_text : (existing.copy_text || ''),
    subtasks: JSON.stringify(body.subtasks !== undefined ? body.subtasks : parseJsonField(existing.subtasks)),
    search_terms: JSON.stringify(body.search_terms !== undefined ? body.search_terms : parseJsonField(existing.search_terms)),
    type: patchType, rrule: patchRRule, anchor_date: patchAnchorDate, exdates: patchExdates,
    end_time: body.end_time !== undefined ? body.end_time : (existing.end_time || ''),
    category_id: body.category_id !== undefined ? body.category_id : (existing.category_id || ''),
    date: body.date !== undefined ? body.date : existing.date,
  };
  if (new_values.type === 'fragment') { new_values.time = ''; new_values.end_time = ''; }
  if (new_values.date) { const e = validateDateFormat(new_values.date as string); if (e) return v1Err(e); }
  if (new_values.time) { const e = validateTimeFormat(new_values.time as string); if (e) return v1Err(e); }
  if (new_values.end_time) { const e = validateTimeFormat(new_values.end_time as string); if (e) return v1Err(e); }
  if (new_values.anchor_date) { const e = validateDateFormat(new_values.anchor_date as string); if (e) return v1Err(e); }
  const date = existing.date as string;
  const subtasks_str = new_values.subtasks as string;
  const search_terms_str = new_values.search_terms as string;
  let new_date = new_values.date as string;
  if (new_values.type !== 'fragment' && !new_date) new_date = date;
  const date_changed = new_date !== date;
  const type = new_values.type as string;
  const end_time = new_values.end_time as string;
  const category_id = new_values.category_id as string;

  if (!is_series || !scope || scope === 'none') {
    if (type === 'recurring') {
      await d.prepare('UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?').bind(new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, todo_id).run();
      await d.prepare('INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(todo_id, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'recurring', end_time, patchAnchorDate, patchExdates, category_id, '[]', patchRRule).run();
    } else if (type === 'fragment' && parent_id && parent_id !== todo_id) {
      let eff_date = new_date; let eff_anchor = new_date;
      if (existing.done === 1) { eff_date = (existing.date as string) || ''; eff_anchor = (existing.fragment_anchor as string) || ''; }
      await d.prepare('UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=?, fragment_anchor=? WHERE id=?').bind(todo_id, eff_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, '', '', '[]', eff_anchor, todo_id).run();
      const tpl = await d.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first<{ exdates: string }>();
      if (tpl) { const ne = addExdate(tpl.exdates || '[]', date); await d.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(ne, parent_id).run(); }
    } else if (parent_id && parent_id !== todo_id && type !== 'fragment') {
      await d.prepare('UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=?, fragment_anchor=? WHERE id=?').bind(todo_id, new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'none', end_time, category_id, '', '', '[]', '', todo_id).run();
      const tpl = await d.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first<{ exdates: string }>();
      if (tpl) { const ne = addExdate(tpl.exdates || '[]', date); await d.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(ne, parent_id).run(); }
    } else {
      let eff_date = new_date; let eff_anchor = type === 'fragment' ? new_date : '';
      if (type === 'fragment' && existing.done === 1) { eff_date = (existing.date as string) || ''; eff_anchor = (existing.fragment_anchor as string) || ''; }
      await d.prepare('UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=?, fragment_anchor=? WHERE id=?').bind(eff_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, eff_anchor, todo_id).run();
      if ((type === 'fragment' || type === 'none') && (existing.type as string) === 'recurring' && (existing.parent_id as string) === todo_id) { try { await d.prepare('DELETE FROM todo_templates WHERE parent_id = ?').bind(todo_id).run(); } catch { /* 静默 */ } }
    }
  } else {
    const actions = computeUpdateActions({ task: { ...existing, parent_id, type: existing.type, is_series }, date, scope, new_values, new_date } as never) as Record<string, unknown>;
    let split_new_pid: string | null = null;
    if (actions.currentTodo && (actions.currentTodo as { split_series?: boolean }).split_series) split_new_pid = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    if (actions.currentTodo) {
      const cv = actions.currentTodo as Record<string, unknown>;
      if (cv.split_series) await d.prepare('UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?').bind(split_new_pid, new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, todo_id).run();
      else if (cv.detach_from_series) await d.prepare('UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?').bind(todo_id, new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'none', end_time, category_id, '', '', '[]', todo_id).run();
      else if (cv.is_recurring) await d.prepare('UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?').bind(new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, todo_id).run();
      else await d.prepare('UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?').bind(new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'none', end_time, category_id, '', '', '[]', todo_id).run();
    }
    if (scope === 'thisAndFuture') {
      if (type === 'recurring') await d.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND date >= ? AND deleted = 0').bind(parent_id, todo_id, date).run();
      else await d.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND date > ? AND deleted = 0').bind(parent_id, todo_id, date).run();
    } else if (scope === 'all') {
      if (type === 'recurring') {
        const tmpl = actions.template as { recurrence_changed?: boolean } | undefined;
        if (date_changed || (tmpl && tmpl.recurrence_changed)) await d.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0').bind(parent_id, todo_id).run();
        else await d.prepare('UPDATE todos SET text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE parent_id=? AND id != ? AND deleted = 0').bind(new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, parent_id, todo_id).run();
      } else await d.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0').bind(parent_id, todo_id).run();
    }
    if (actions.template) {
      const tmpl = actions.template as Record<string, string>;
      if (tmpl.type === 'add_exdate') { const tpl = await d.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first<{ exdates: string }>(); if (tpl) { const ne = addExdate(tpl.exdates || '[]', date); await d.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(ne, parent_id).run(); } }
      else if (tmpl.type === 'set_repeat_end') { const pd = getPreviousDate(date); try { const tr = await d.prepare('SELECT rrule FROM todo_templates WHERE parent_id = ?').bind(parent_id).first<{ rrule: string }>(); if (tr?.rrule) { let r = tr.rrule.replace(/;UNTIL=[^;]+/i, ''); r = r + ';UNTIL=' + pd.replace(/-/g, '') + 'T235959Z'; const s = sanitizeRRule(r); if (s) await d.prepare('UPDATE todo_templates SET rrule = ? WHERE parent_id = ?').bind(s, parent_id).run(); } } catch { /* 静默 */ } }
      else if (tmpl.type === 'update_all') { if (type === 'recurring') { let ee = '[]', etr = '[]'; try { const et = await d.prepare('SELECT exdates, time_records FROM todo_templates WHERE parent_id = ?').bind(parent_id).first<{ exdates: string; time_records: string }>(); if (et) { ee = et.exdates || '[]'; etr = et.time_records || '[]'; } } catch { /* 静默 */ } await d.prepare('INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(parent_id, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'recurring', end_time, patchAnchorDate, ee, category_id, etr, patchRRule).run(); } }
      else if (tmpl.type === 'delete') await d.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parent_id).run();
    }
    if (actions.insertTemplate && split_new_pid) { const it = actions.insertTemplate as Record<string, string>; await d.prepare('INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(split_new_pid, it.text, it.time, it.priority, it.desc, it.url, it.copy_text, it.subtasks, it.search_terms, 'recurring', it.end_time, it.anchor_date, it.exdates, it.category_id, '[]', it.rrule || '').run(); }
  }
  const updated = await d.prepare('SELECT * FROM todos WHERE id = ?').bind(todo_id).first<Record<string, unknown>>();
  return v1Ok(formatTodo(updated!));
});

// ==================== DELETE /api/v1/todos/:id ====================

v1TodosApp.delete('/todos/:id', async (c) => {
  const d = d1(createDb(c.env.DB));
  const todo_id = c.req.param('id');
  const url = new URL(c.req.url);
  const scope = url.searchParams.get('scope') || undefined;
  if (scope && !['this', 'thisAndFuture', 'all'].includes(scope)) return v1Err(`无效的 scope: ${scope}，有效值: this, thisAndFuture, all`);
  const existing = await d.prepare('SELECT * FROM todos WHERE id = ?').bind(todo_id).first<Record<string, unknown>>();
  if (!existing) return v1Err('Todo 不存在', 404);
  const parent_id = existing.parent_id as string;
  const is_series = (existing.type as string) === 'recurring';
  const date = existing.date as string;
  const effective_scope = is_series && !scope ? 'this' : scope;
  if (!is_series || !effective_scope) { await d.prepare('UPDATE todos SET deleted = 1 WHERE id = ?').bind(todo_id).run(); }
  else {
    const actions = computeDeleteActions({ task: { ...existing, parent_id, type: 'recurring', is_series }, date, scope: effective_scope } as never) as Record<string, unknown>;
    const deleteIds = (actions.deleteTodoIds || []) as string[];
    for (const id of deleteIds) await d.prepare('UPDATE todos SET deleted = 1 WHERE id = ?').bind(id).run();
    if (actions.updateTemplate) {
      const tmpl = actions.updateTemplate as Record<string, unknown>;
      if (tmpl.type === 'add_exdate') { const tpl = await d.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first<{ exdates: string }>(); if (tpl) { const ne = addExdate(tpl.exdates || '[]', date); await d.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(ne, parent_id).run(); } }
      else if (tmpl.type === 'set_repeat_end') { const pd = getPreviousDate(date); if (tmpl.also_delete_future) await d.prepare('UPDATE todos SET deleted = 1, type=?, rrule=?, anchor_date=?, exdates=?, parent_id=id, time_records=? WHERE parent_id=? AND date >= ?').bind('none', '', '', '[]', '[]', parent_id, date).run(); try { const tr = await d.prepare('SELECT rrule FROM todo_templates WHERE parent_id = ?').bind(parent_id).first<{ rrule: string }>(); if (tr?.rrule) { let r = tr.rrule.replace(/;UNTIL=[^;]+/i, ''); r = r + ';UNTIL=' + pd.replace(/-/g, '') + 'T235959Z'; const s = sanitizeRRule(r); if (s) await d.prepare('UPDATE todo_templates SET rrule = ? WHERE parent_id = ?').bind(s, parent_id).run(); } } catch { /* 静默 */ } }
      else if (tmpl.type === 'delete_all') { await d.prepare('UPDATE todos SET deleted = 1, type=?, rrule=?, anchor_date=?, exdates=?, parent_id=id, time_records=? WHERE parent_id=?').bind('none', '', '', '[]', '[]', parent_id).run(); await d.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parent_id).run(); }
    }
    if (actions.deleteTemplate) await d.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parent_id).run();
  }
  return v1OkNoData();
});

// ==================== PATCH /api/v1/todos/:id/toggle ====================

v1TodosApp.patch('/todos/:id/toggle', async (c) => {
  const d = d1(createDb(c.env.DB));
  const todo_id = c.req.param('id');
  const existing = await d.prepare('SELECT done, parent_id, type, date, fragment_anchor FROM todos WHERE id = ?').bind(todo_id).first<Record<string, unknown>>();
  if (!existing) return v1Err('Todo 不存在', 404);
  const new_done = existing.done ? 0 : 1;
  const is_fragment = (existing.type as string) === 'fragment';
  let record: { s: number; e: number; p?: number } | null = null;
  let body_date: string | null = null;
  try { const body = await c.req.raw.json() as Record<string, unknown>; if (body && typeof body === 'object') { if (body.record) record = body.record as { s: number; e: number; p?: number }; if (body.date) body_date = body.date as string; } } catch { record = null; }
  if (is_fragment && new_done && body_date) { const todayStr = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10); if (body_date > todayStr) body_date = todayStr; }
  let record_accepted = false;
  if (new_done) {
    if (is_fragment) { const fd = body_date || (existing.date as string) || ''; try { await d.prepare('UPDATE todos SET done = 1, date = ? WHERE id = ?').bind(fd, todo_id).run(); } catch { try { await d.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(todo_id).run(); } catch { /* 静默 */ } } }
    else { try { await d.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(todo_id).run(); } catch { try { await d.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(todo_id).run(); } catch { /* 静默 */ } } }
    if (record) record_accepted = await writeTimerRecord(d, todo_id, existing.parent_id as string, record, is_fragment);
  } else {
    if (is_fragment) { const sa = (existing.fragment_anchor as string) || ''; try { await d.prepare('UPDATE todos SET done = 0, date = ?, time_records = ? WHERE id = ?').bind(sa, '[]', todo_id).run(); } catch { await d.prepare('UPDATE todos SET done = 0 WHERE id = ?').bind(todo_id).run(); } }
    else { try { await d.prepare('UPDATE todos SET done = 0, time_records = ? WHERE id = ?').bind('[]', todo_id).run(); } catch { await d.prepare('UPDATE todos SET done = 0 WHERE id = ?').bind(todo_id).run(); } }
  }
  const updated = await d.prepare('SELECT date, time_records FROM todos WHERE id = ?').bind(todo_id).first<{ date: string; time_records: string }>();
  const rd: Record<string, unknown> = { id: todo_id, done: !!new_done };
  if (updated) { if (new_done && updated.date) rd.date = updated.date; try { const tr = typeof updated.time_records === 'string' ? JSON.parse(updated.time_records || '[]') : (updated.time_records || []); rd.time_records = Array.isArray(tr) ? tr : []; } catch { rd.time_records = []; } if (new_done) rd.record_accepted = record_accepted; }
  return v1Ok(rd);
});

// ==================== PATCH /api/v1/todos/:id/subtasks ====================

v1TodosApp.patch('/todos/:id/subtasks', async (c) => {
  const d = d1(createDb(c.env.DB));
  const todo_id = c.req.param('id');
  let body: { subtasks?: unknown[] };
  try { body = await c.req.raw.json(); } catch { return v1Err('请求体不是有效的 JSON'); }
  if (!Array.isArray(body.subtasks)) return v1Err('subtasks 必须为数组');
  const ex = await d.prepare('SELECT id FROM todos WHERE id = ?').bind(todo_id).first();
  if (!ex) return v1Err('待办不存在', 404);
  await d.prepare('UPDATE todos SET subtasks = ? WHERE id = ?').bind(JSON.stringify(body.subtasks), todo_id).run();
  return v1OkNoData();
});

// ==================== PATCH /api/v1/todos/:id/search-terms ====================

v1TodosApp.patch('/todos/:id/search-terms', async (c) => {
  const d = d1(createDb(c.env.DB));
  const todo_id = c.req.param('id');
  let body: { search_terms?: unknown[] };
  try { body = await c.req.raw.json(); } catch { return v1Err('请求体不是有效的 JSON'); }
  if (!Array.isArray(body.search_terms)) return v1Err('search_terms 必须为数组');
  const ex = await d.prepare('SELECT id FROM todos WHERE id = ?').bind(todo_id).first();
  if (!ex) return v1Err('待办不存在', 404);
  await d.prepare('UPDATE todos SET search_terms = ? WHERE id = ?').bind(JSON.stringify(body.search_terms), todo_id).run();
  return v1OkNoData();
});

// ==================== POST /api/v1/todos/batch ====================

v1TodosApp.post('/todos/batch', async (c) => {
  const d = d1(createDb(c.env.DB));
  let body: { action?: string; ids?: string[]; done_status?: boolean; timer_records?: Array<{ id: string; parent_id: string; record: { s: number; e: number; p?: number } }>; date?: string };
  try { body = await c.req.raw.json(); } catch { return v1Err('请求体不是有效的 JSON'); }
  const { action, ids, done_status, timer_records, date } = body;
  if (action === 'BATCH_TOGGLE_DONE') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return v1Err('ids 为必填数组');
    let totalAffected = 0;
    const all_fragment_ids: string[] = []; const all_fragment_id_set = new Set<string>(); const all_plain_ids: string[] = [];
    for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) { const ph = sqlPlaceholders(chunk.length); const rows = await d.prepare(`SELECT id, type FROM todos WHERE id IN (${ph})`).bind(...chunk).all<{ id: string; type: string }>(); for (const r of (rows.results || [])) { if (r.type === 'fragment') { all_fragment_ids.push(r.id); all_fragment_id_set.add(r.id); } else all_plain_ids.push(r.id); } }
    if (done_status) {
      const runFC = async () => { let a = 0; for (const chunk of chunkArray(all_fragment_ids, BATCH_CHUNK_SIZE)) { const ph = sqlPlaceholders(chunk.length); try { const r = await d.prepare(`UPDATE todos SET done = 1, date = ? WHERE id IN (${ph}) AND done = 0`).bind(date || '', ...chunk).run(); a += (r.meta?.changes || 0); } catch { try { const r2 = await d.prepare(`UPDATE todos SET done = 1 WHERE id IN (${ph}) AND done = 0`).bind(...chunk).run(); a += (r2.meta?.changes || 0); } catch { /* 静默 */ } } } return a; };
      const runPC = async () => { let a = 0; for (const chunk of chunkArray(all_plain_ids, BATCH_CHUNK_SIZE)) { const ph = sqlPlaceholders(chunk.length); try { const r = await d.prepare(`UPDATE todos SET done = 1 WHERE id IN (${ph}) AND done = 0`).bind(...chunk).run(); a += (r.meta?.changes || 0); } catch { /* 静默 */ } } return a; };
      const [fa, pa] = await Promise.all([runFC(), runPC()]); totalAffected += fa + pa;
      if (Array.isArray(timer_records) && timer_records.length > 0) {
        const MAX = 7 * 24 * 60 * 60 * 1000;
        const valid_items: Array<{ id: string; parent_id: string; is_fragment: boolean; is_zero_duration: boolean; s: number; e: number; p: number }> = [];
        for (const item of timer_records) { if (!item?.id || !item?.record) continue; const rec = item.record; if (typeof rec.s !== 'number' || typeof rec.e !== 'number') continue; const s = Math.floor(rec.s), e = Math.floor(rec.e), p = Math.floor(rec.p || 0); if (!(s > 0 && e >= s && (e - s) <= MAX && p >= 0 && p <= (e - s))) continue; valid_items.push({ id: item.id, parent_id: item.parent_id, is_fragment: all_fragment_id_set.has(item.id), is_zero_duration: s === e, s, e, p }); }
        const instIds = [...new Set(valid_items.map((it) => it.id))]; const inst_map = new Map<string, unknown[]>();
        for (const chunk of chunkArray(instIds, BATCH_CHUNK_SIZE)) { const ph = sqlPlaceholders(chunk.length); try { const rows = await d.prepare(`SELECT id, time_records FROM todos WHERE id IN (${ph})`).bind(...chunk).all<{ id: string; time_records: string }>(); for (const r of (rows.results || [])) { let arr: unknown[] = []; try { arr = typeof r.time_records === 'string' ? JSON.parse(r.time_records || '[]') : r.time_records; } catch { arr = []; } if (!Array.isArray(arr)) arr = []; inst_map.set(r.id, arr); } } catch { /* 静默 */ } }
        const tpl_pids = [...new Set(valid_items.filter((it) => !it.is_zero_duration && !it.is_fragment && it.parent_id).map((it) => it.parent_id))]; const tpl_map = new Map<string, unknown[]>();
        for (const chunk of chunkArray(tpl_pids, BATCH_CHUNK_SIZE)) { const ph = sqlPlaceholders(chunk.length); try { const rows = await d.prepare(`SELECT parent_id, time_records FROM todo_templates WHERE parent_id IN (${ph})`).bind(...chunk).all<{ parent_id: string; time_records: string }>(); for (const r of (rows.results || [])) { let arr: unknown[] = []; try { arr = Array.isArray(r.time_records) ? r.time_records : JSON.parse(r.time_records || '[]'); } catch { arr = []; } if (!Array.isArray(arr)) arr = []; tpl_map.set(r.parent_id, arr); } } catch { /* 静默 */ } }
        const inst_updates: Array<{ id: string; time_records: string }> = [];
        for (const it of valid_items) { const arr = inst_map.get(it.id); if (!arr) continue; (arr as Array<Record<string, unknown>>).push({ s: it.s, e: it.e, p: it.p }); if (!it.is_fragment && arr.length > 5) arr.splice(0, arr.length - 5); inst_updates.push({ id: it.id, time_records: JSON.stringify(arr) }); }
        const tpl_updates = new Map<string, unknown[]>();
        for (const it of valid_items) { if (it.is_zero_duration || it.is_fragment || !it.parent_id) continue; const arr = tpl_map.get(it.parent_id); if (!arr) continue; let target = tpl_updates.get(it.parent_id); if (!target) { target = arr.slice(); tpl_updates.set(it.parent_id, target); } (target as Array<Record<string, unknown>>).push({ s: it.s, e: it.e, p: it.p }); if (target.length > 10) target.splice(0, target.length - 10); }
        for (const chunk of chunkArray(inst_updates, BATCH_CHUNK_SIZE)) { try { const stmts = chunk.map((u) => d.prepare('UPDATE todos SET time_records = ? WHERE id = ?').bind(u.time_records, u.id)); await d.batch(stmts); } catch { /* 静默 */ } }
        const tplUpdateArr = Array.from(tpl_updates.entries()).map(([pid, arr]) => ({ pid, time_records: JSON.stringify(arr) }));
        for (const chunk of chunkArray(tplUpdateArr, BATCH_CHUNK_SIZE)) { try { const stmts = chunk.map((u) => d.prepare('UPDATE todo_templates SET time_records = ? WHERE parent_id = ?').bind(u.time_records, u.pid)); await d.batch(stmts); } catch { /* 静默 */ } }
      }
    } else {
      const runFU = async () => { let a = 0; for (const chunk of chunkArray(all_fragment_ids, BATCH_CHUNK_SIZE)) { const ph = sqlPlaceholders(chunk.length); try { const r = await d.prepare(`UPDATE todos SET done = 0, date = fragment_anchor, time_records = ? WHERE id IN (${ph})`).bind('[]', ...chunk).run(); a += (r.meta?.changes || 0); } catch { try { const r2 = await d.prepare(`UPDATE todos SET done = 0 WHERE id IN (${ph})`).bind(...chunk).run(); a += (r2.meta?.changes || 0); } catch { /* 静默 */ } } } return a; };
      const runPU = async () => { let a = 0; for (const chunk of chunkArray(all_plain_ids, BATCH_CHUNK_SIZE)) { const ph = sqlPlaceholders(chunk.length); try { const r = await d.prepare(`UPDATE todos SET done = 0, time_records = ? WHERE id IN (${ph})`).bind('[]', ...chunk).run(); a += (r.meta?.changes || 0); } catch { try { const r2 = await d.prepare(`UPDATE todos SET done = 0 WHERE id IN (${ph})`).bind(...chunk).run(); a += (r2.meta?.changes || 0); } catch { /* 静默 */ } } } return a; };
      const [fa, pa] = await Promise.all([runFU(), runPU()]); totalAffected += fa + pa;
    }
    return v1Ok({ affected: totalAffected, done: !!done_status, chunked: ids.length > BATCH_CHUNK_SIZE, chunkCount: Math.ceil(ids.length / BATCH_CHUNK_SIZE) });
  }
  if (action === 'BATCH_DELETE') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return v1Err('ids 为必填数组');
    const tasks: Array<{ parent_id: string; date: string; type: string }> = [];
    for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) { const ph = sqlPlaceholders(chunk.length); try { const rows = await d.prepare(`SELECT parent_id, date, type FROM todos WHERE id IN (${ph})`).bind(...chunk).all<{ parent_id: string; date: string; type: string }>(); for (const r of (rows.results || [])) tasks.push(r); } catch { /* 静默 */ } }
    let totalAffected = 0;
    for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) { const ph = sqlPlaceholders(chunk.length); try { const r = await d.prepare(`UPDATE todos SET deleted = 1 WHERE id IN (${ph})`).bind(...chunk).run(); totalAffected += (r.meta?.changes || 0); } catch { /* 静默 */ } }
    const exdateUpdates: Record<string, string[]> = {};
    for (const t of tasks) { if (t.type === 'recurring' && t.parent_id) { if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = []; exdateUpdates[t.parent_id].push(t.date); } }
    const parentIds = Object.keys(exdateUpdates); const tplExdatesMap = new Map<string, string>();
    for (const chunk of chunkArray(parentIds, BATCH_CHUNK_SIZE)) { const ph = sqlPlaceholders(chunk.length); try { const rows = await d.prepare(`SELECT parent_id, exdates FROM todo_templates WHERE parent_id IN (${ph})`).bind(...chunk).all<{ parent_id: string; exdates: string }>(); for (const r of (rows.results || [])) tplExdatesMap.set(r.parent_id, r.exdates || '[]'); } catch { /* 静默 */ } }
    const exdateStmts: D1PreparedStatement[] = [];
    for (const pid of parentIds) { const ce = tplExdatesMap.get(pid); if (ce === undefined) continue; let ne = ce; let ch = false; for (const dt of exdateUpdates[pid]) { const next = addExdate(ne, dt); if (next !== ne) { ne = next; ch = true; } } if (ch) exdateStmts.push(d.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(ne, pid)); }
    for (const chunk of chunkArray(exdateStmts, BATCH_CHUNK_SIZE)) { try { await d.batch(chunk); } catch { /* 静默 */ } }
    return v1Ok({ affected: totalAffected, chunked: ids.length > BATCH_CHUNK_SIZE, chunkCount: Math.ceil(ids.length / BATCH_CHUNK_SIZE) });
  }
  return v1Err('未知操作，可用: BATCH_TOGGLE_DONE, BATCH_DELETE');
});
