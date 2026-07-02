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
 */

import { Hono } from 'hono';
import { apiError } from '../../utils.js';
import { createDb } from '../../db/client';
import { checkCookieAuth } from '../../middleware/auth';
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
import type { V0AppEnv } from './index';

/** Todo Action Hono app。 */
export const todoActionApp = new Hono<V0AppEnv>();

todoActionApp.post('/todo-action', async (c) => {
  const authResult = await checkCookieAuth(c.req.raw, c.env);
  if (!authResult.ok) {
    return apiError('UNAUTHORIZED', 401);
  }

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
  let effective_date = date;
  if (date && ['TOGGLE_DONE', 'TIMER_COMPLETE', 'BATCH_TOGGLE_DONE'].includes(action)) {
    const todayStr = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    if (date > todayStr) {
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
