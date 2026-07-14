/**
 * V0 Time Records 路由
 *
 *
 * 路由：
 *   - GET /api/time-records?todo_id=&parent_id=
 *
 * 鉴权：cookie 鉴权
 */

import { Hono } from 'hono';
import { apiError } from '../../utils.js';
import { createDb, createReadDb } from '../../db/client';
import { getTimeRecords } from '../../services/time-records-service';
import type { V0AppEnv } from './index';

/** Time Records Hono app。 */
export const timeRecordsApp = new Hono<V0AppEnv>();

timeRecordsApp.get('/time-records', async (c) => {

  const url = new URL(c.req.url);
  const todo_id = url.searchParams.get('todo_id');
  const parent_id = url.searchParams.get('parent_id');

  const db = createReadDb(c.env.DB);
  const result = await getTimeRecords(db, { todo_id, parent_id });
  if (!result.ok) {
    return apiError(result.error, 400);
  }

  return new Response(JSON.stringify(result.data), {
    headers: { 'Content-Type': 'application/json' },
  });
});
