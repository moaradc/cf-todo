/**
 * V0 Todo Action 路由
 *
 *
 * 路由：POST /api/todo-action
 * 鉴权：cookie 鉴权
 *
 * Action 清单：
 *   CREATE / UPDATE / DELETE（含 computeUpdateActions / computeDeleteActions）
 *   TOGGLE_DONE / TIMER_COMPLETE / TIMER_RECORD
 *   UPDATE_SUBTASKS / UPDATE_SEARCH_TERMS
 *   BATCH_TOGGLE_DONE / BATCH_DELETE
 *
 * 精确提醒联动：CREATE / UPDATE / DELETE / TOGGLE_DONE / BATCH_* 成功后，
 * 后台同步该 todo 在 DO 中的精确提醒事件（precise_enabled=false 时自动跳过）。
 * 使用 c.executionCtx.waitUntil 异步执行，不阻塞 CRUD 响应。
 */

import { Hono } from 'hono';
import { apiError } from '../../utils.js';
import { createDb } from '../../db/client';
import {
  createTodo,
  updateTodo,
  deleteTodo,
  toggleDone,
  timerComplete,
  timerRecord,
  updateSubtasks,
  updateSearchTerms,
  batchToggleDone,
  batchDelete,
} from '../../services/todo-service';
import {
  syncPreciseReminderForTodo,
  syncPreciseRemindersForTodos,
} from '../../services/precise-reminder-service';
import type { V0AppEnv } from './index';

/** Todo Action Hono app。 */
export const todoActionApp = new Hono<V0AppEnv>();

todoActionApp.post('/todo-action', async (c) => {

  let parsedBody: Record<string, unknown>;
  try {
    parsedBody = await c.req.raw.json();
  } catch {
    return apiError('请求体不是有效的 JSON', 400);
  }

  const { action, date } = parsedBody as { action?: string; date?: string };
  if (!action || typeof action !== 'string') {
    return apiError('action 为必填字段', 400);
  }

  const VALID_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'TOGGLE_DONE', 'TIMER_COMPLETE', 'TIMER_RECORD', 'UPDATE_SUBTASKS', 'UPDATE_SEARCH_TERMS', 'BATCH_TOGGLE_DONE', 'BATCH_DELETE'];
  if (!VALID_ACTIONS.includes(action)) {
    return apiError(`未知的 action: ${action}，有效值: ${VALID_ACTIONS.join(', ')}`, 400);
  }

  // TOGGLE_DONE/TIMER_COMPLETE/BATCH_TOGGLE_DONE 的完成日期校验
  // todayStr 使用 UTC+8（用户时区 Asia/Shanghai），避免 UTC 与本地日期跨天偏差
  // 碎时记 done: false→true 时若未传 date，应冻结为今天（而非保留空串），详见 wiki §5.4
  let effective_date = date;
  if (['TOGGLE_DONE', 'TIMER_COMPLETE', 'BATCH_TOGGLE_DONE'].includes(action)) {
    const todayStr = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    if (!date) {
      // 仅对碎时记完成操作补默认日期；非碎时记不需要 date 冻结，保持 undefined 避免影响其他逻辑
      // 服务端 toggleDone / timerComplete / batchToggleDone 内部会判断 is_fragment 后使用
      // 但为了与 V1 PATCH /toggle 行为一致，这里统一补 todayStr 作为 fragment 完成日期默认值
      // 注意：普通 todo 的 TOGGLE_DONE 不依赖 date，effective_date 传 todayStr 也不会影响行为
      effective_date = todayStr;
    } else if (date > todayStr) {
      effective_date = todayStr;
    }
  }

  const db = createDb(c.env.DB);
  const body = { ...parsedBody, date: effective_date } as never;

  try {
    let result: { ok: true; response?: Record<string, unknown> } | { ok: false; error: string; status: number };

    switch (action) {
      case 'CREATE':
        result = await createTodo(db, body);
        break;
      case 'UPDATE':
        result = await updateTodo(db, body);
        break;
      case 'DELETE':
        result = await deleteTodo(db, body);
        break;
      case 'TOGGLE_DONE':
        result = await toggleDone(db, body, effective_date);
        break;
      case 'TIMER_COMPLETE':
        result = await timerComplete(db, body, effective_date);
        break;
      case 'TIMER_RECORD':
        result = await timerRecord(db, body);
        break;
      case 'UPDATE_SUBTASKS':
        result = await updateSubtasks(db, body);
        break;
      case 'UPDATE_SEARCH_TERMS':
        result = await updateSearchTerms(db, body);
        break;
      case 'BATCH_TOGGLE_DONE':
        result = await batchToggleDone(db, body, effective_date);
        break;
      case 'BATCH_DELETE':
        result = await batchDelete(db, body);
        break;
      default:
        return apiError(`未知的 action: ${action}`, 400);
    }

    if (!result.ok) {
      return apiError(result.error, result.status);
    }

    // —— 精确提醒联动（DO Alarm）：CRUD 成功后异步同步 ——
    // syncPreciseReminderForTodo 内部检查 precise_enabled，关闭时直接返回，
    // 不会产生 DO 调用，因此对未启用精确提醒的用户零开销。
    // 使用 waitUntil 让同步在后台执行，不阻塞 CRUD 响应。
    try {
      const task = parsedBody.task as { id?: string } | undefined;
      const ids = parsedBody.ids as string[] | undefined;
      const todoId = task?.id;

      if (action === 'BATCH_TOGGLE_DONE' || action === 'BATCH_DELETE') {
        if (Array.isArray(ids) && ids.length > 0) {
          c.executionCtx.waitUntil(syncPreciseRemindersForTodos(c.env, ids));
        }
      } else if (todoId && typeof todoId === 'string') {
        // CREATE / UPDATE / DELETE / TOGGLE_DONE / TIMER_COMPLETE 等单条操作
        // UPDATE_SUBTASKS / UPDATE_SEARCH_TERMS / TIMER_RECORD 不影响 time/end_time，
        // 但统一调用 sync 也无副作用（sync 会读 todo 并决定是否需要重新调度）。
        c.executionCtx.waitUntil(syncPreciseReminderForTodo(c.env, todoId));
      }
    } catch (syncErr) {
      // 同步调度本身失败不影响 CRUD 主流程
      console.error('[todo-action] precise reminder sync failed:', syncErr instanceof Error ? syncErr.message : syncErr);
    }

    if (result.response) {
      return new Response(JSON.stringify(result.response), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // D1 约束错误 → 409 Conflict
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE constraint') || msg.includes('SQLITE_CONSTRAINT')) {
      return apiError('数据约束冲突: ' + msg, 409);
    }
    return apiError(msg);
  }
});
