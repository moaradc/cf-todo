/**
 * V0 Todos GET 路由
 *
 * 阶段 5.5c：从 api.js:1809-1977 搬迁到 Hono + Drizzle。
 * 含 RRULE 展开 + per-date lock + fragment 浮动可见 + search_terms 热词替换。
 *
 * 路由：GET /api/todos?date=YYYY-MM-DD
 * 鉴权：cookie 鉴权
 */

import { Hono } from 'hono';
import { apiError } from '../../utils.js';
import { createDb } from '../../db/client';
import { checkCookieAuth } from '../../middleware/auth';
import { getTodos } from '../../services/todos-get-service';
import type { V0AppEnv } from './index';

/** Todos GET Hono app。 */
export const todosGetApp = new Hono<V0AppEnv>();

todosGetApp.get('/todos', async (c) => {
  const authResult = await checkCookieAuth(c.req.raw, c.env);
  if (!authResult.ok) {
    return apiError('UNAUTHORIZED', 401);
  }

  const url = new URL(c.req.url);
  const date = url.searchParams.get('date');

  const db = createDb(c.env.DB);
  const result = await getTodos(db, date || '');
  if (!result.ok) {
    return apiError(result.error, result.status);
  }

  return new Response(JSON.stringify(result.todos), {
    headers: { 'Content-Type': 'application/json' },
  });
});
