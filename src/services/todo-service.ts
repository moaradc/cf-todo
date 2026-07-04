/**
 * Todo Service —— V0 todo-action 业务逻辑
 *
 *
 * 用 raw D1 API（db.$client）保持与原代码字节级一致。
 * Drizzle query builder 对这些复杂动态 SQL 支持不佳（类型断言地狱）。
 *
 * Action 清单：
 *   5.5a: CREATE / UPDATE / DELETE（含 computeUpdateActions / computeDeleteActions）
 *   5.5b: TOGGLE_DONE / TIMER_COMPLETE / TIMER_RECORD /
 *         UPDATE_SUBTASKS / UPDATE_SEARCH_TERMS /
 *         BATCH_TOGGLE_DONE / BATCH_DELETE
 */

import type { Db } from '../db/client';
import {
  normalizePriority,
  parseJsonField,
} from '../utils.js';
import {
  processRRule,
  validateType,
  validateDateFormat,
  validateTimeFormat,
  validateExdates,
  addExdate,
  getPreviousDate,
  sanitizeRRule,
  computeUpdateActions,
  computeDeleteActions,
  detectLegacyRepeatFields,
} from '../recurring-engine.js';

/** D1 原生数据库实例（从 Drizzle 客户端提取）。 */
function d1(db: Db): D1Database {
  return (db as unknown as { $client: D1Database }).$client;
}

/** readCopyText：统一读取 copy_text（snake_case）。 */
function readCopyText(task: Record<string, unknown>): string {
  const v = task.copy_text;
  return typeof v === 'string' ? v : '';
}

/** 分片辅助。 */
const BATCH_CHUNK_SIZE = 99;
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
function sqlPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(',');
}

/** todo-action 请求体。 */
export interface TodoActionBody {
  action: string;
  date?: string;
  task?: Record<string, unknown>;
  scope?: string;
  ids?: string[];
  done_status?: boolean;
  record?: { s: number; e: number; p?: number };
  parent_id?: string;
  timer_records?: Array<{ id: string; parent_id: string; record: { s: number; e: number; p?: number } }>;
  keep_records?: boolean;
}

/** todo-action 结果。 */
export type ActionResult =
  | { ok: true; response?: Record<string, unknown> }
  | { ok: false; error: string; status: number };

// ==================== 5.5a: CREATE / UPDATE / DELETE ====================

/** CREATE：创建 todo + 可选模板 */
export async function createTodo(db: Db, body: TodoActionBody): Promise<ActionResult> {
  const d = d1(db);
  const { task, date } = body;
  if (!task || !task.id || typeof task.id !== 'string' || !String(task.id).trim()) {
    return { ok: false, error: 'task.id 为必填字段且不能为空字符串', status: 400 };
  }
  if (!task.text || typeof task.text !== 'string' || !String(task.text).trim()) {
    return { ok: false, error: 'task.text 为必填字段', status: 400 };
  }
  // v3.0: 拒绝已废弃的旧字段（repeat_type / repeat_custom / repeat_interval / repeat_end）
  const legacyField = detectLegacyRepeatFields(task);
  if (legacyField) {
    return { ok: false, error: 'v1.0 已废弃 repeat_type / repeat_custom / repeat_interval / repeat_end 字段，请改用 type + rrule + anchor_date + exdates', status: 400 };
  }

  let type = (task.type as string) || 'none';
  // validateType 返回 type string（合法）或 null（非法），不是错误消息
  if (validateType(type) === null) {
    return { ok: false, error: `无效的 type: ${type}，v3.0 有效值: none / fragment / recurring`, status: 400 };
  }

  const rruleResult = processRRule((task.rrule as string) || '', type, { allowDerive: true });
  if (rruleResult.error) return { ok: false, error: rruleResult.error, status: 400 };
  let final_rrule = rruleResult.value;
  if (type === 'recurring' && !final_rrule) {
    return { ok: false, error: 'type=recurring 时 rrule 不能为空，请提供合法 RFC 5545 RRULE 字符串', status: 400 };
  }
  if (type === 'none' || type === 'fragment') final_rrule = '';

  const exdatesResult = validateExdates(task.exdates as unknown as string);
  if (exdatesResult.error) return { ok: false, error: exdatesResult.error, status: 400 };
  const final_exdates = exdatesResult.value;

  const is_fragment = type === 'fragment';
  const effectiveEndTime = is_fragment ? '' : ((task.end_time as string) || '');
  const effectiveTime = is_fragment ? '' : ((task.time as string) || '');

  const fallbackDate = date || (task.date as string) || '';
  if (!is_fragment && !fallbackDate) {
    return { ok: false, error: 'date 为必填项（碎时记允许为空），请传顶层 date 或 task.date', status: 400 };
  }
  if (fallbackDate) {
    const dateErr = validateDateFormat(fallbackDate);
    if (dateErr) return { ok: false, error: dateErr, status: 400 };
  }
  if (effectiveTime) {
    const tfErr = validateTimeFormat(effectiveTime);
    if (tfErr) return { ok: false, error: tfErr, status: 400 };
  }
  if (effectiveEndTime) {
    const etErr = validateTimeFormat(effectiveEndTime);
    if (etErr) return { ok: false, error: etErr, status: 400 };
  }

  const effective_date = fallbackDate;
  const anchor_date = type === 'recurring' ? effective_date : '';
  const effective_fragment_anchor = is_fragment ? effective_date : '';
  const category_id = (task.category_id as string) || '';

  await d.prepare(
    'INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, type, end_time, category_id, time_records, fragment_anchor, rrule, anchor_date, exdates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    task.id, task.id, effective_date, task.text, effectiveTime, normalizePriority(task.priority as string),
    task.desc || '', task.url || '', readCopyText(task), JSON.stringify(task.subtasks || []), JSON.stringify(task.search_terms || []),
    0, 0, type, effectiveEndTime, category_id,
    '[]', effective_fragment_anchor, final_rrule, anchor_date, final_exdates,
  ).run();

  if (type === 'recurring') {
    await d.prepare(
      'INSERT INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      task.id, task.text, effectiveTime, normalizePriority(task.priority as string), task.desc || '', task.url || '', readCopyText(task),
      JSON.stringify(task.subtasks || []), JSON.stringify(task.search_terms || []),
      'recurring', effectiveEndTime, anchor_date, final_exdates, category_id, '[]', final_rrule,
    ).run();
  }

  return { ok: true };
}

/** UPDATE：scope=this/thisAndFuture/all，含 computeUpdateActions */
export async function updateTodo(db: Db, body: TodoActionBody): Promise<ActionResult> {
  const d = d1(db);
  const { task, date, scope } = body;
  if (!task || !task.id || typeof task.id !== 'string' || !String(task.id).trim()) {
    return { ok: false, error: 'task.id 为必填字段', status: 400 };
  }
  // v3.0: 拒绝已废弃的旧字段（repeat_type / repeat_custom / repeat_interval / repeat_end）
  const legacyField = detectLegacyRepeatFields(task);
  if (legacyField) {
    return { ok: false, error: 'v1.0 已废弃 repeat_type / repeat_custom / repeat_interval / repeat_end 字段，请改用 type + rrule + anchor_date + exdates', status: 400 };
  }
  if (task.type !== undefined && task.type !== 'none' && task.type !== 'fragment' && task.type !== 'recurring') {
    return { ok: false, error: `无效的 type: ${task.type}，v3.0 有效值: none / fragment / recurring`, status: 400 };
  }

  let parent_id = (task.parent_id as string) || '';
  if (!parent_id) {
    try {
      const pid_row = await d.prepare('SELECT parent_id FROM todos WHERE id = ?').bind(task.id).first<{ parent_id: string }>();
      if (pid_row) parent_id = pid_row.parent_id;
    } catch { /* 静默 */ }
  }
  if (!parent_id) {
    return { ok: false, error: '无法确定 parent_id（任务不存在或未传 parent_id）', status: 400 };
  }

  // 获取原始任务数据
  let original_task: Record<string, unknown> = { ...task };
  try {
    const orig = await d.prepare('SELECT text, time, priority, desc, url, copy_text, type, end_time, category_id, subtasks, search_terms, done, date, parent_id, fragment_anchor, rrule, anchor_date, exdates FROM todos WHERE id = ?').bind(task.id).first<Record<string, unknown>>();
    if (orig) {
      original_task = {
        ...task,
        text: orig.text, time: orig.time, priority: orig.priority,
        desc: orig.desc, url: orig.url, copy_text: orig.copy_text,
        type: orig.type, end_time: orig.end_time, category_id: orig.category_id,
        subtasks: orig.subtasks, search_terms: orig.search_terms,
        date: orig.date, parent_id: orig.parent_id,
        fragment_anchor: orig.fragment_anchor,
        rrule: orig.rrule, anchor_date: orig.anchor_date, exdates: orig.exdates,
        _orig_done: orig.done,
        _orig_date: orig.date,
        _orig_parent_id: orig.parent_id,
        _orig_type: orig.type,
        _orig_rrule: orig.rrule,
        _orig_anchor_date: orig.anchor_date,
        _orig_fragment_anchor: orig.fragment_anchor,
      };
      if (task.text !== undefined) original_task.text = task.text;
      if (task.time !== undefined) original_task.time = task.time;
      if (task.priority !== undefined) original_task.priority = task.priority;
      if (task.desc !== undefined) original_task.desc = task.desc;
      if (task.url !== undefined) original_task.url = task.url;
      if (task.copy_text !== undefined) original_task.copy_text = task.copy_text;
      if (task.type !== undefined) original_task.type = task.type;
      if (task.end_time !== undefined) original_task.end_time = task.end_time;
      if (task.category_id !== undefined) original_task.category_id = task.category_id;
      if (task.subtasks !== undefined) original_task.subtasks = task.subtasks;
      if (task.search_terms !== undefined) original_task.search_terms = task.search_terms;
      if (task.date !== undefined) original_task.date = task.date;
      if (task.rrule !== undefined) original_task.rrule = task.rrule;
      if (task.anchor_date !== undefined) original_task.anchor_date = task.anchor_date;
      if (task.exdates !== undefined) original_task.exdates = task.exdates;
    }
  } catch { /* 静默 */ }

  // PATCH 语义回退
  let patchText = (original_task.text as string) || '';
  let patchTime = (original_task.time as string) || '';
  const patchPriority = (original_task.priority as string) || 'low';
  let patchDesc = (original_task.desc as string) || '';
  let patchUrl = (original_task.url as string) || '';
  let patchCopyText = original_task.copy_text !== undefined ? (original_task.copy_text as string) : '';
  const patchSubtasks = task.subtasks !== undefined ? task.subtasks : parseJsonField(original_task.subtasks);
  const patchSearchTerms = task.search_terms !== undefined ? task.search_terms : parseJsonField(original_task.search_terms);
  let patchType = (original_task.type as string) || 'none';
  let patchEndTime = (original_task.end_time as string) || '';
  let patchCategoryId = (original_task.category_id as string) || '';
  let patchDate = (original_task.date as string) || '';
  let patchRRule = (original_task.rrule as string) || '';
  let patchAnchorDate = (original_task.anchor_date as string) || '';
  let patchExdates = (original_task.exdates as string) || '[]';

  if (task.rrule !== undefined) {
    if (task.rrule === null || String(task.rrule).trim() === '') {
      patchRRule = '';
      if (task.type === undefined) patchType = 'none';
    } else {
      const rruleResult = processRRule(task.rrule as string, patchType, { allowDerive: true });
      if (rruleResult.error) return { ok: false, error: rruleResult.error, status: 400 };
      patchRRule = rruleResult.value;
      if (patchRRule && patchType === 'none') patchType = 'recurring';
    }
  }

  if (task.exdates !== undefined) {
    const exdatesResult = validateExdates(task.exdates as unknown as string);
    if (exdatesResult.error) return { ok: false, error: exdatesResult.error, status: 400 };
    patchExdates = exdatesResult.value;
  }

  if (patchType === 'fragment' || patchType === 'none') {
    patchRRule = ''; patchAnchorDate = ''; patchExdates = '[]';
  }
  if (patchType === 'recurring' && !patchRRule) {
    return { ok: false, error: 'type=recurring 时 rrule 不能为空', status: 400 };
  }
  if (patchType === 'recurring') {
    if (!patchAnchorDate) patchAnchorDate = patchDate;
    if (!patchAnchorDate) return { ok: false, error: 'type=recurring 时 anchor_date 不能为空（请传 task.anchor_date 或 task.date）', status: 400 };
  }
  if (patchType === 'fragment') { patchTime = ''; patchEndTime = ''; }

  if (patchDate) { const e = validateDateFormat(patchDate); if (e) return { ok: false, error: e, status: 400 }; }
  if (patchTime) { const e = validateTimeFormat(patchTime); if (e) return { ok: false, error: e, status: 400 }; }
  if (patchEndTime) { const e = validateTimeFormat(patchEndTime); if (e) return { ok: false, error: e, status: 400 }; }
  if (patchAnchorDate) { const e = validateDateFormat(patchAnchorDate); if (e) return { ok: false, error: e, status: 400 }; }

  if (patchType !== 'fragment' && !patchDate) patchDate = date || '';

  const type = patchType;
  const subtasks_str = JSON.stringify(patchSubtasks || []);
  const search_terms_str = JSON.stringify(patchSearchTerms || []);
  const end_time = patchEndTime;
  const category_id = patchCategoryId;
  const new_date = patchDate;
  const date_changed = new_date !== date;
  const is_series = original_task._orig_type === 'recurring' && type !== 'fragment';

  if (scope && scope !== 'none' && !['this', 'thisAndFuture', 'all'].includes(scope)) {
    return { ok: false, error: `无效的 scope: ${scope}，有效值: this, thisAndFuture, all`, status: 400 };
  }
  const effective_scope = is_series && scope === undefined ? 'this' : (scope || 'none');

  const new_values = {
    text: patchText, time: patchTime, priority: normalizePriority(patchPriority),
    desc: patchDesc, url: patchUrl, copy_text: patchCopyText !== undefined ? patchCopyText : '',
    subtasks: subtasks_str, search_terms: search_terms_str, type, rrule: patchRRule,
    anchor_date: patchAnchorDate, exdates: patchExdates, end_time, category_id, date: new_date,
  };

  if (!is_series) {
    if (type === 'recurring') {
      await d.prepare('UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?')
        .bind(new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, task.id).run();
      await d.prepare('INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(task.id, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'recurring', end_time, patchAnchorDate, patchExdates, category_id, '[]', patchRRule).run();
    } else if (type === 'fragment' && parent_id && parent_id !== task.id) {
      let effective_update_date = new_date;
      let effective_fragment_anchor = new_date;
      if (original_task._orig_done === 1) {
        effective_update_date = (original_task._orig_date as string) || '';
        try {
          const fa_row = await d.prepare('SELECT fragment_anchor FROM todos WHERE id = ?').bind(task.id).first<{ fragment_anchor: string }>();
          effective_fragment_anchor = (fa_row && fa_row.fragment_anchor) ? fa_row.fragment_anchor : '';
        } catch { effective_fragment_anchor = ''; }
      }
      await d.prepare('UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=?, fragment_anchor=? WHERE id=?')
        .bind(task.id, effective_update_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, '', '', '[]', effective_fragment_anchor, task.id).run();
      const tpl = await d.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first<{ exdates: string }>();
      if (tpl) {
        const new_exdates = addExdate(tpl.exdates || '[]', date || '');
        await d.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, parent_id).run();
      }
    } else if (parent_id && parent_id !== task.id && type !== 'fragment') {
      await d.prepare('UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=?, fragment_anchor=? WHERE id=?')
        .bind(task.id, new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'none', end_time, category_id, '', '', '[]', '', task.id).run();
      const tpl = await d.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first<{ exdates: string }>();
      if (tpl) {
        const new_exdates = addExdate(tpl.exdates || '[]', date || '');
        await d.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, parent_id).run();
      }
    } else {
      let effective_update_date = new_date;
      let effective_fragment_anchor = type === 'fragment' ? new_date : '';
      if (type === 'fragment' && original_task._orig_done === 1) {
        effective_update_date = (original_task._orig_date as string) || '';
        try {
          const fa_row = await d.prepare('SELECT fragment_anchor FROM todos WHERE id = ?').bind(task.id).first<{ fragment_anchor: string }>();
          effective_fragment_anchor = (fa_row && fa_row.fragment_anchor) ? fa_row.fragment_anchor : '';
        } catch { effective_fragment_anchor = ''; }
      }
      await d.prepare('UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=?, fragment_anchor=? WHERE id=?')
        .bind(effective_update_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, effective_fragment_anchor, task.id).run();
      if ((type === 'fragment' || type === 'none') && original_task._orig_type === 'recurring' && original_task._orig_parent_id === task.id) {
        try { await d.prepare('DELETE FROM todo_templates WHERE parent_id = ?').bind(task.id).run(); } catch { /* 静默 */ }
      }
    }
  } else {
    const actions = computeUpdateActions({ task: original_task, date: date || '', scope: effective_scope, new_values, new_date }) as Record<string, unknown>;
    let split_new_pid: string | null = null;
    if (actions.currentTodo && (actions.currentTodo as { split_series?: boolean }).split_series) {
      split_new_pid = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    }
    if (actions.currentTodo) {
      const cv = actions.currentTodo as Record<string, unknown>;
      if (cv.split_series) {
        await d.prepare('UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?')
          .bind(split_new_pid, new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, task.id).run();
      } else if (cv.detach_from_series) {
        await d.prepare('UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?')
          .bind(task.id, new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'none', end_time, category_id, '', '', '[]', task.id).run();
      } else if (cv.is_recurring) {
        await d.prepare('UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?')
          .bind(new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, task.id).run();
      } else {
        await d.prepare('UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?')
          .bind(new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'none', end_time, category_id, '', '', '[]', task.id).run();
      }
    }
    if (effective_scope === 'thisAndFuture') {
      if (type === 'recurring') {
        await d.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND date >= ? AND deleted = 0').bind(parent_id, task.id, date).run();
      } else {
        await d.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND date > ? AND deleted = 0').bind(parent_id, task.id, date).run();
      }
    } else if (effective_scope === 'all') {
      if (type === 'recurring') {
        const tmpl = actions.template as { recurrence_changed?: boolean } | undefined;
        if (date_changed || (tmpl && tmpl.recurrence_changed)) {
          await d.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0').bind(parent_id, task.id).run();
        } else {
          await d.prepare('UPDATE todos SET text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE parent_id=? AND id != ? AND deleted = 0')
            .bind(new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, parent_id, task.id).run();
        }
      } else {
        await d.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0').bind(parent_id, task.id).run();
      }
    }
    if (actions.template) {
      const tmpl = actions.template as Record<string, string>;
      if (tmpl.type === 'add_exdate') {
        const tpl = await d.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first<{ exdates: string }>();
        if (tpl) {
          const new_exdates = addExdate(tpl.exdates || '[]', date || '');
          await d.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, parent_id).run();
        }
      } else if (tmpl.type === 'set_repeat_end') {
        const prev_date = getPreviousDate(date || '');
        try {
          const tpl_row = await d.prepare('SELECT rrule FROM todo_templates WHERE parent_id = ?').bind(parent_id).first<{ rrule: string }>();
          if (tpl_row && tpl_row.rrule) {
            let rrule = tpl_row.rrule.replace(/;UNTIL=[^;]+/i, '');
            rrule = rrule + ';UNTIL=' + prev_date.replace(/-/g, '') + 'T235959Z';
            const sanitized = sanitizeRRule(rrule);
            if (sanitized) await d.prepare('UPDATE todo_templates SET rrule = ? WHERE parent_id = ?').bind(sanitized, parent_id).run();
          }
        } catch { /* 静默 */ }
      } else if (tmpl.type === 'update_all') {
        if (type === 'recurring') {
          let existing_exdates = '[]', existing_time_records = '[]';
          try {
            const existing_tpl = await d.prepare('SELECT exdates, time_records FROM todo_templates WHERE parent_id = ?').bind(parent_id).first<{ exdates: string; time_records: string }>();
            if (existing_tpl) { existing_exdates = existing_tpl.exdates || '[]'; existing_time_records = existing_tpl.time_records || '[]'; }
          } catch { /* 静默 */ }
          await d.prepare('INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(parent_id, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'recurring', end_time, patchAnchorDate, existing_exdates, category_id, existing_time_records, patchRRule).run();
        }
      } else if (tmpl.type === 'delete') {
        await d.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parent_id).run();
      }
    }
    if (actions.insertTemplate && split_new_pid) {
      const it = actions.insertTemplate as Record<string, string>;
      await d.prepare('INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(split_new_pid, it.text, it.time, it.priority, it.desc, it.url, it.copy_text, it.subtasks, it.search_terms, 'recurring', it.end_time, it.anchor_date, it.exdates, it.category_id, '[]', it.rrule || '').run();
    }
  }

  return { ok: true };
}

/** DELETE：scope=this/thisAndFuture/all，含 computeDeleteActions */
export async function deleteTodo(db: Db, body: TodoActionBody): Promise<ActionResult> {
  const d = d1(db);
  const { task, date, scope } = body;
  if (!task || !task.id) return { ok: false, error: 'task.id required', status: 400 };

  let parent_id = (task.parent_id as string) || '';
  if (!parent_id) {
    try {
      const pid_row = await d.prepare('SELECT parent_id FROM todos WHERE id = ?').bind(task.id).first<{ parent_id: string }>();
      if (pid_row) parent_id = pid_row.parent_id;
    } catch { /* 静默 */ }
  }
  let delete_is_series = false;
  try {
    const orig = await d.prepare('SELECT type FROM todos WHERE id = ?').bind(task.id).first<{ type: string }>();
    if (orig) delete_is_series = orig.type === 'recurring';
  } catch { /* 静默 */ }

  if (scope && !['this', 'thisAndFuture', 'all'].includes(scope)) {
    return { ok: false, error: `无效的 scope: ${scope}，有效值: this, thisAndFuture, all`, status: 400 };
  }
  const effective_delete_scope = delete_is_series && !scope ? 'this' : scope;
  if (!delete_is_series || !effective_delete_scope) {
    await d.prepare('UPDATE todos SET deleted = 1 WHERE id = ?').bind(task.id).run();
  } else {
    const actions = computeDeleteActions({ task: { ...task, type: 'recurring' }, date: date || '', scope: effective_delete_scope } as never) as Record<string, unknown>;
    const _deleteIds = (actions.deleteTodoIds || []) as string[];
    if (_deleteIds.length > 0) {
      for (const todo_id of _deleteIds) {
        await d.prepare('UPDATE todos SET deleted = 1 WHERE id = ?').bind(todo_id).run();
      }
    }
    if (actions.updateTemplate) {
      const tmpl = actions.updateTemplate as Record<string, unknown>;
      if (tmpl.type === 'add_exdate') {
        const tpl = await d.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first<{ exdates: string }>();
        if (tpl) {
          const new_exdates = addExdate(tpl.exdates || '[]', date || '');
          await d.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, parent_id).run();
        }
      } else if (tmpl.type === 'set_repeat_end') {
        const prev_date = getPreviousDate(date || '');
        if (tmpl.also_delete_future) {
          await d.prepare('UPDATE todos SET deleted = 1, type=?, rrule=?, anchor_date=?, exdates=?, parent_id=id, time_records=? WHERE parent_id=? AND date >= ?')
            .bind('none', '', '', '[]', '[]', parent_id, date).run();
        }
        try {
          const tpl_row = await d.prepare('SELECT rrule FROM todo_templates WHERE parent_id = ?').bind(parent_id).first<{ rrule: string }>();
          if (tpl_row && tpl_row.rrule) {
            let rrule = tpl_row.rrule.replace(/;UNTIL=[^;]+/i, '');
            rrule = rrule + ';UNTIL=' + prev_date.replace(/-/g, '') + 'T235959Z';
            const sanitized = sanitizeRRule(rrule);
            if (sanitized) await d.prepare('UPDATE todo_templates SET rrule = ? WHERE parent_id = ?').bind(sanitized, parent_id).run();
          }
        } catch { /* 静默 */ }
      } else if (tmpl.type === 'delete_all') {
        await d.prepare('UPDATE todos SET deleted = 1, type=?, rrule=?, anchor_date=?, exdates=?, parent_id=id, time_records=? WHERE parent_id=?')
          .bind('none', '', '', '[]', '[]', parent_id).run();
        await d.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parent_id).run();
      }
    }
    if (actions.deleteTemplate) {
      await d.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parent_id).run();
    }
  }

  return { ok: true };
}

// ==================== 5.5b: TOGGLE_DONE / TIMER / BATCH / SUBTASKS ====================

/** TOGGLE_DONE：fragment/普通 todo 的完成/取消切换 */
export async function toggleDone(db: Db, body: TodoActionBody, effective_date?: string): Promise<ActionResult> {
  const d = d1(db);
  const { task, record, keep_records } = body;
  if (!task || !task.id) return { ok: false, error: 'task.id required', status: 400 };

  let is_fragment = false;
  try {
    const row = await d.prepare('SELECT type FROM todos WHERE id = ?').bind(task.id).first<{ type: string }>();
    if (row && row.type === 'fragment') is_fragment = true;
  } catch { /* 读取失败按普通 todo 处理 */ }

  if (is_fragment) {
    if (!task.done) {
      const should_keep_records = !!keep_records;
      try {
        if (should_keep_records) {
          await d.prepare('UPDATE todos SET done = 0, date = fragment_anchor WHERE id = ?').bind(task.id).run();
        } else {
          await d.prepare('UPDATE todos SET done = 0, date = fragment_anchor, time_records = ? WHERE id = ?').bind('[]', task.id).run();
        }
      } catch {
        await d.prepare('UPDATE todos SET done = 0 WHERE id = ?').bind(task.id).run();
      }
    } else {
      try {
        if (record && typeof record.s === 'number' && typeof record.e === 'number' && record.s === record.e && record.s > 0) {
          const cur = await d.prepare('SELECT time_records FROM todos WHERE id = ?').bind(task.id).first<{ time_records: string }>();
          let inst_arr: unknown[] = [];
          try { inst_arr = typeof cur?.time_records === 'string' ? JSON.parse(cur.time_records || '[]') : cur?.time_records || []; } catch { inst_arr = []; }
          if (!Array.isArray(inst_arr)) inst_arr = [];
          (inst_arr as Array<Record<string, unknown>>).push({ s: record.s, e: record.e, p: 0 });
          await d.prepare('UPDATE todos SET done = 1, date = ?, time_records = ? WHERE id = ?').bind(effective_date || '', JSON.stringify(inst_arr), task.id).run();
        } else {
          await d.prepare('UPDATE todos SET done = 1, date = ? WHERE id = ?').bind(effective_date || '', task.id).run();
        }
      } catch {
        await d.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(task.id).run();
      }
    }
  } else if (!task.done) {
    let should_keep_records = false;
    if (keep_records) {
      try {
        const cur = await d.prepare('SELECT done FROM todos WHERE id = ?').bind(task.id).first<{ done: number }>();
        should_keep_records = !!(cur && cur.done === 1);
      } catch { should_keep_records = false; }
    }
    if (should_keep_records) {
      try { await d.prepare('UPDATE todos SET done = 0 WHERE id = ?').bind(task.id).run(); }
      catch { await d.prepare('UPDATE todos SET done = 0 WHERE id = ?').bind(task.id).run(); }
    } else {
      try { await d.prepare('UPDATE todos SET done = 0, time_records = ? WHERE id = ?').bind('[]', task.id).run(); }
      catch { await d.prepare('UPDATE todos SET done = 0 WHERE id = ?').bind(task.id).run(); }
    }
  } else {
    try {
      if (record && typeof record.s === 'number' && typeof record.e === 'number' && record.s === record.e && record.s > 0) {
        const cur = await d.prepare('SELECT time_records FROM todos WHERE id = ?').bind(task.id).first<{ time_records: string }>();
        let inst_arr: unknown[] = [];
        if (cur?.time_records) {
          try { inst_arr = typeof cur.time_records === 'string' ? JSON.parse(cur.time_records || '[]') : cur.time_records; } catch { inst_arr = []; }
        }
        if (!Array.isArray(inst_arr)) inst_arr = [];
        (inst_arr as Array<Record<string, unknown>>).push({ s: record.s, e: record.e, p: 0 });
        if (inst_arr.length > 5) inst_arr = inst_arr.slice(inst_arr.length - 5);
        await d.prepare('UPDATE todos SET done = 1, time_records = ? WHERE id = ?').bind(JSON.stringify(inst_arr), task.id).run();
      } else {
        await d.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(task.id).run();
      }
    } catch {
      await d.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(task.id).run();
    }
  }
  return { ok: true };
}

/** TIMER_COMPLETE：计时完成 */
export async function timerComplete(db: Db, body: TodoActionBody, effective_date?: string): Promise<ActionResult> {
  const d = d1(db);
  const { task, record, parent_id } = body;
  const todo_id = task?.id as string;
  const pid = parent_id || (task?.parent_id as string);
  if (!todo_id) return { ok: false, error: 'INVALID_PARAMS', status: 400 };

  let is_fragment = false;
  try {
    const row = await d.prepare('SELECT type FROM todos WHERE id = ?').bind(todo_id).first<{ type: string }>();
    if (row && row.type === 'fragment') is_fragment = true;
  } catch { /* 静默 */ }

  if (is_fragment) {
    try { await d.prepare('UPDATE todos SET done = 1, date = ? WHERE id = ?').bind(effective_date || '', todo_id).run(); }
    catch { await d.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(todo_id).run(); }
  } else {
    try { await d.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(todo_id).run(); }
    catch (eDone) { console.error('TIMER_COMPLETE mark done failed:', eDone); }
  }

  if (record && typeof record.s === 'number' && typeof record.e === 'number') {
    const s = Math.floor(record.s); const e = Math.floor(record.e); const p = Math.floor(record.p || 0);
    const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
    if (s > 0 && e > s && (e - s) <= MAX_DURATION_MS && p >= 0 && p < (e - s)) {
      try {
        const cur = await d.prepare('SELECT time_records FROM todos WHERE id = ?').bind(todo_id).first<{ time_records: string }>();
        let inst_arr: unknown[] = [];
        if (cur?.time_records) {
          try { inst_arr = typeof cur.time_records === 'string' ? JSON.parse(cur.time_records || '[]') : cur.time_records; } catch { inst_arr = []; }
        }
        if (!Array.isArray(inst_arr)) inst_arr = [];
        (inst_arr as Array<Record<string, unknown>>).push({ s, e, p });
        if (!is_fragment && inst_arr.length > 5) inst_arr = inst_arr.slice(inst_arr.length - 5);
        await d.prepare('UPDATE todos SET time_records = ? WHERE id = ?').bind(JSON.stringify(inst_arr), todo_id).run();
      } catch (eInst) { console.error('TIMER_COMPLETE per-instance record write failed:', eInst); }
      if (!is_fragment && pid) {
        try {
          const tpl = await d.prepare('SELECT time_records FROM todo_templates WHERE parent_id = ?').bind(pid).first<{ time_records: string }>();
          if (tpl) {
            let arr: unknown[] = [];
            try { arr = Array.isArray(tpl.time_records) ? tpl.time_records : JSON.parse(tpl.time_records || '[]'); } catch { arr = []; }
            if (!Array.isArray(arr)) arr = [];
            (arr as Array<Record<string, unknown>>).push({ s, e, p });
            if (arr.length > 10) arr = arr.slice(arr.length - 10);
            await d.prepare('UPDATE todo_templates SET time_records = ? WHERE parent_id = ?').bind(JSON.stringify(arr), pid).run();
          }
        } catch (e3) { console.error('TIMER_COMPLETE template record write failed:', e3); }
      }
    }
  }
  return { ok: true };
}

/** TIMER_RECORD：碎时记计时记录 */
export async function timerRecord(db: Db, body: TodoActionBody): Promise<ActionResult> {
  const d = d1(db);
  const { task, record } = body;
  const todo_id = task?.id as string;
  if (!todo_id) return { ok: false, error: 'INVALID_PARAMS', status: 400 };

  let is_fragment = false;
  try {
    const row = await d.prepare('SELECT type FROM todos WHERE id = ?').bind(todo_id).first<{ type: string }>();
    if (row && row.type === 'fragment') is_fragment = true;
  } catch { /* 静默 */ }
  if (!is_fragment) {
    return { ok: true, response: { ok: true, downgraded: true } };
  }

  if (record && typeof record.s === 'number' && typeof record.e === 'number') {
    const s = Math.floor(record.s); const e = Math.floor(record.e); const p = Math.floor(record.p || 0);
    const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
    if (s > 0 && e > s && (e - s) <= MAX_DURATION_MS && p >= 0 && p < (e - s)) {
      try {
        const cur = await d.prepare('SELECT time_records FROM todos WHERE id = ?').bind(todo_id).first<{ time_records: string }>();
        let inst_arr: unknown[] = [];
        if (cur?.time_records) {
          try { inst_arr = typeof cur.time_records === 'string' ? JSON.parse(cur.time_records || '[]') : cur.time_records; } catch { inst_arr = []; }
        }
        if (!Array.isArray(inst_arr)) inst_arr = [];
        (inst_arr as Array<Record<string, unknown>>).push({ s, e, p });
        await d.prepare('UPDATE todos SET time_records = ? WHERE id = ?').bind(JSON.stringify(inst_arr), todo_id).run();
      } catch (eInst) { console.error('TIMER_RECORD per-instance record write failed:', eInst); }
    }
  }
  return { ok: true };
}

/** UPDATE_SUBTASKS */
export async function updateSubtasks(db: Db, body: TodoActionBody): Promise<ActionResult> {
  const d = d1(db);
  const { task } = body;
  await d.prepare('UPDATE todos SET subtasks = ? WHERE id = ?').bind(JSON.stringify((task?.subtasks as unknown[]) || []), task?.id).run();
  return { ok: true };
}

/** UPDATE_SEARCH_TERMS */
export async function updateSearchTerms(db: Db, body: TodoActionBody): Promise<ActionResult> {
  const d = d1(db);
  const { task } = body;
  await d.prepare('UPDATE todos SET search_terms = ? WHERE id = ?').bind(JSON.stringify((task?.search_terms as unknown[]) || []), task?.id).run();
  return { ok: true };
}

/** BATCH_TOGGLE_DONE */
export async function batchToggleDone(db: Db, body: TodoActionBody, effective_date?: string): Promise<ActionResult> {
  const d = d1(db);
  const { ids, done_status, timer_records } = body;
  if (!ids || ids.length === 0) return { ok: true };

  let fragmentIds: string[] = [];
  const fragment_id_set = new Set<string>();
  let plainIds: string[] = [];
  for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
    const ph = sqlPlaceholders(chunk.length);
    try {
      const rows = await d.prepare(`SELECT id, type FROM todos WHERE id IN (${ph})`).bind(...chunk).all<{ id: string; type: string }>();
      for (const r of (rows.results || [])) {
        if (r.type === 'fragment') { fragmentIds.push(r.id); fragment_id_set.add(r.id); }
        else plainIds.push(r.id);
      }
    } catch { /* 静默 */ }
  }

  if (!done_status) {
    const runFragmentUncomplete = async () => {
      for (const chunk of chunkArray(fragmentIds, BATCH_CHUNK_SIZE)) {
        const frPh = sqlPlaceholders(chunk.length);
        try { await d.prepare(`UPDATE todos SET done = 0, date = fragment_anchor, time_records = ? WHERE id IN (${frPh})`).bind('[]', ...chunk).run(); }
        catch { try { await d.prepare(`UPDATE todos SET done = 0 WHERE id IN (${frPh})`).bind(...chunk).run(); } catch { /* 静默 */ } }
      }
    };
    const runPlainUncomplete = async () => {
      for (const chunk of chunkArray(plainIds, BATCH_CHUNK_SIZE)) {
        const plPh = sqlPlaceholders(chunk.length);
        try { await d.prepare(`UPDATE todos SET done = 0, time_records = ? WHERE id IN (${plPh})`).bind('[]', ...chunk).run(); }
        catch { try { await d.prepare(`UPDATE todos SET done = 0 WHERE id IN (${plPh})`).bind(...chunk).run(); } catch { /* 静默 */ } }
      }
    };
    await Promise.all([runFragmentUncomplete(), runPlainUncomplete()]);
  } else {
    const runFragmentComplete = async () => {
      for (const chunk of chunkArray(fragmentIds, BATCH_CHUNK_SIZE)) {
        const frPh = sqlPlaceholders(chunk.length);
        try { await d.prepare(`UPDATE todos SET done = 1, date = ? WHERE id IN (${frPh}) AND done = 0`).bind(effective_date || '', ...chunk).run(); }
        catch { try { await d.prepare(`UPDATE todos SET done = 1 WHERE id IN (${frPh}) AND done = 0`).bind(...chunk).run(); } catch { /* 静默 */ } }
      }
    };
    const runPlainComplete = async () => {
      for (const chunk of chunkArray(plainIds, BATCH_CHUNK_SIZE)) {
        const plPh = sqlPlaceholders(chunk.length);
        try { await d.prepare(`UPDATE todos SET done = 1 WHERE id IN (${plPh}) AND done = 0`).bind(...chunk).run(); }
        catch { /* 静默 */ }
      }
    };
    await Promise.all([runFragmentComplete(), runPlainComplete()]);
  }

  // 批量完成时：对带 record 的 todo 写入 time_records
  if (done_status && Array.isArray(timer_records) && timer_records.length > 0) {
    const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
    const valid_items: Array<{ id: string; parent_id: string; is_fragment: boolean; is_zero_duration: boolean; s: number; e: number; p: number }> = [];
    for (const item of timer_records) {
      if (!item || !item.id || !item.record) continue;
      const rec = item.record;
      if (typeof rec.s !== 'number' || typeof rec.e !== 'number') continue;
      const s = Math.floor(rec.s); const e = Math.floor(rec.e); const p = Math.floor(rec.p || 0);
      if (!(s > 0 && e >= s && (e - s) <= MAX_DURATION_MS && p >= 0 && p <= (e - s))) continue;
      valid_items.push({ id: item.id, parent_id: item.parent_id, is_fragment: fragment_id_set.has(item.id), is_zero_duration: s === e, s, e, p });
    }

    const instIds = [...new Set(valid_items.map((it) => it.id))];
    const inst_time_records_map = new Map<string, unknown[]>();
    for (const chunk of chunkArray(instIds, BATCH_CHUNK_SIZE)) {
      const ph = sqlPlaceholders(chunk.length);
      try {
        const rows = await d.prepare(`SELECT id, time_records FROM todos WHERE id IN (${ph})`).bind(...chunk).all<{ id: string; time_records: string }>();
        for (const r of (rows.results || [])) {
          let arr: unknown[] = [];
          try { arr = typeof r.time_records === 'string' ? JSON.parse(r.time_records || '[]') : r.time_records; } catch { arr = []; }
          if (!Array.isArray(arr)) arr = [];
          inst_time_records_map.set(r.id, arr);
        }
      } catch { /* 静默 */ }
    }

    const tpl_parent_ids = [...new Set(valid_items.filter((it) => !it.is_zero_duration && !it.is_fragment && it.parent_id).map((it) => it.parent_id))];
    const tpl_time_records_map = new Map<string, unknown[]>();
    for (const chunk of chunkArray(tpl_parent_ids, BATCH_CHUNK_SIZE)) {
      const ph = sqlPlaceholders(chunk.length);
      try {
        const rows = await d.prepare(`SELECT parent_id, time_records FROM todo_templates WHERE parent_id IN (${ph})`).bind(...chunk).all<{ parent_id: string; time_records: string }>();
        for (const r of (rows.results || [])) {
          let arr: unknown[] = [];
          try { arr = Array.isArray(r.time_records) ? r.time_records : JSON.parse(r.time_records || '[]'); } catch { arr = []; }
          if (!Array.isArray(arr)) arr = [];
          tpl_time_records_map.set(r.parent_id, arr);
        }
      } catch { /* 静默 */ }
    }

    const inst_updates: Array<{ id: string; time_records: string }> = [];
    for (const it of valid_items) {
      const arr = inst_time_records_map.get(it.id);
      if (!arr) continue;
      (arr as Array<Record<string, unknown>>).push({ s: it.s, e: it.e, p: it.p });
      if (!it.is_fragment && arr.length > 5) arr.splice(0, arr.length - 5);
      inst_updates.push({ id: it.id, time_records: JSON.stringify(arr) });
    }
    const tpl_updates = new Map<string, unknown[]>();
    for (const it of valid_items) {
      if (it.is_zero_duration || it.is_fragment || !it.parent_id) continue;
      const arr = tpl_time_records_map.get(it.parent_id);
      if (!arr) continue;
      let target = tpl_updates.get(it.parent_id);
      if (!target) { target = arr.slice(); tpl_updates.set(it.parent_id, target); }
      (target as Array<Record<string, unknown>>).push({ s: it.s, e: it.e, p: it.p });
      if (target.length > 10) target.splice(0, target.length - 10);
    }

    for (const chunk of chunkArray(inst_updates, BATCH_CHUNK_SIZE)) {
      try {
        const stmts = chunk.map((u) => d.prepare('UPDATE todos SET time_records = ? WHERE id = ?').bind(u.time_records, u.id));
        await d.batch(stmts);
      } catch (e) { console.error('BATCH_TOGGLE_DONE batch inst update failed:', e); }
    }
    const tplUpdateArr = Array.from(tpl_updates.entries()).map(([pid, arr]) => ({ pid, time_records: JSON.stringify(arr) }));
    for (const chunk of chunkArray(tplUpdateArr, BATCH_CHUNK_SIZE)) {
      try {
        const stmts = chunk.map((u) => d.prepare('UPDATE todo_templates SET time_records = ? WHERE parent_id = ?').bind(u.time_records, u.pid));
        await d.batch(stmts);
      } catch (e) { console.error('BATCH_TOGGLE_DONE batch tpl update failed:', e); }
    }
  }
  return { ok: true };
}

/** BATCH_DELETE */
export async function batchDelete(db: Db, body: TodoActionBody): Promise<ActionResult> {
  const d = d1(db);
  const { ids } = body;
  if (!ids || ids.length === 0) return { ok: true };

  // 只查询未删除的 todos（已 deleted=1 的不重复处理，避免 exdate 重复添加）
  const tasks: Array<{ parent_id: string; date: string; type: string }> = [];
  const activeIds: string[] = [];
  for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
    const ph = sqlPlaceholders(chunk.length);
    try {
      const rows = await d.prepare(`SELECT id, parent_id, date, type FROM todos WHERE id IN (${ph}) AND deleted = 0`).bind(...chunk).all<{ id: string; parent_id: string; date: string; type: string }>();
      for (const r of (rows.results || [])) { tasks.push(r); activeIds.push(r.id); }
    } catch { /* 静默 */ }
  }

  // 只 UPDATE 未删除的，避免重复软删除
  for (const chunk of chunkArray(activeIds, BATCH_CHUNK_SIZE)) {
    const ph = sqlPlaceholders(chunk.length);
    try { await d.prepare(`UPDATE todos SET deleted = 1 WHERE id IN (${ph}) AND deleted = 0`).bind(...chunk).run(); }
    catch { /* 静默 */ }
  }

  const exdateUpdates: Record<string, string[]> = {};
  for (const t of tasks) {
    if (t.type === 'recurring' && t.parent_id) {
      if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
      exdateUpdates[t.parent_id].push(t.date);
    }
  }
  const parentIds = Object.keys(exdateUpdates);
  const tplExdatesMap = new Map<string, string>();
  for (const chunk of chunkArray(parentIds, BATCH_CHUNK_SIZE)) {
    const ph = sqlPlaceholders(chunk.length);
    try {
      const rows = await d.prepare(`SELECT parent_id, exdates FROM todo_templates WHERE parent_id IN (${ph})`).bind(...chunk).all<{ parent_id: string; exdates: string }>();
      for (const r of (rows.results || [])) tplExdatesMap.set(r.parent_id, r.exdates || '[]');
    } catch { /* 静默 */ }
  }
  const exdateStmts: D1PreparedStatement[] = [];
  for (const pid of parentIds) {
    const currentExdates = tplExdatesMap.get(pid);
    if (currentExdates === undefined) continue;
    let new_exdates = currentExdates;
    let changed = false;
    for (const dt of exdateUpdates[pid]) {
      const next = addExdate(new_exdates, dt);
      if (next !== new_exdates) { new_exdates = next; changed = true; }
    }
    if (changed) exdateStmts.push(d.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, pid));
  }
  for (const chunk of chunkArray(exdateStmts, BATCH_CHUNK_SIZE)) {
    try { await d.batch(chunk); } catch { /* 静默 */ }
  }
  return { ok: true };
}
