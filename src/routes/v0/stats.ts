/**
 * V0 Stats 路由
 *
 * 阶段 5.4：从 api.js:836-957 搬迁到 Hono + Drizzle。
 *
 * 路由：
 *   - GET /api/stats?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * 鉴权：cookie 鉴权
 */

import { Hono } from 'hono';
import { apiError } from '../../utils.js';
import { createDb } from '../../db/client';
import { checkCookieAuth } from '../../middleware/auth';
import { getStats } from '../../services/stats-service';
import type { V0AppEnv } from './index';

/** Stats Hono app。 */
export const statsApp = new Hono<V0AppEnv>();

statsApp.get('/stats', async (c) => {
  const authResult = await checkCookieAuth(c.req.raw, c.env);
  if (!authResult.ok) {
    return apiError('UNAUTHORIZED', 401);
  }

  const url = new URL(c.req.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');

  const db = createDb(c.env.DB);
  const result = await getStats(db, start, end);
  if (!result.ok) {
    return apiError(result.error, 400);
  }

  return new Response(JSON.stringify(result.payload), {
    headers: { 'Content-Type': 'application/json' },
  });
});
