/**
 * V0 Time Records 路由
 *
 * 阶段 5.5e：从 api.js:1979-2028 搬迁到 Hono + Drizzle。
 *
 * 路由：
 *   - GET /api/time-records?todo_id=&parent_id=
 *
 * 鉴权：cookie 鉴权
 */

import { Hono } from 'hono';
import { apiError } from '../../utils.js';
import { createDb } from '../../db/client';
import { checkCookieAuth } from '../../middleware/auth';
import { getTimeRecords } from '../../services/time-records-service';
import type { V0AppEnv } from './index';

/** Time Records Hono app。 */
export const timeRecordsApp = new Hono<V0AppEnv>();

timeRecordsApp.get('/time-records', async (c) => {
  const authResult = await checkCookieAuth(c.req.raw, c.env);
  if (!authResult.ok) {
    return apiError('UNAUTHORIZED', 401);
  }

  const url = new URL(c.req.url);
  const todo_id = url.searchParams.get('todo_id');
  const parent_id = url.searchParams.get('parent_id');

  const db = createDb(c.env.DB);
  const result = await getTimeRecords(db, { todo_id, parent_id });
  if (!result.ok) {
    return apiError(result.error, 400);
  }

  return new Response(JSON.stringify(result.data), {
    headers: { 'Content-Type': 'application/json' },
  });
});
