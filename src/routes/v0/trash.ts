/**
 * V0 Trash 路由
 *
 *
 * 路由：
 *   - GET  /api/trash
 *   - POST /api/trash-action
 *
 * 鉴权：cookie 鉴权
 *
 * action 合法值：RESTORE / DELETE_PERMANENT / CLEAR_ALL / BATCH_RESTORE /
 *                BATCH_DELETE_PERMANENT / CLEAR_ALL_DATA
 *
 * CLEAR_ALL_DATA 是危险操作，加二次确认（require confirm 参数）。
 */

import { Hono } from 'hono';
import { apiError } from '../../utils.js';
import { createDb, createReadDb } from '../../db/client';
import {
  listTrash,
  restoreTrash,
  deletePermanent,
  clearAll,
  batchRestore,
  batchDeletePermanent,
  clearAllData,
} from '../../services/trash-service';
import type { V0AppEnv } from './index';

/** Trash Hono app。 */
export const trashApp = new Hono<V0AppEnv>();

/**
 * GET /api/trash
 * 返回回收站列表（自动分页，最多 1000 条）。
 */
trashApp.get('/trash', async (c) => {

  const db = createReadDb(c.env.DB);
  const rows = await listTrash(db);
  return new Response(JSON.stringify(rows), {
    headers: { 'Content-Type': 'application/json' },
  });
});

/**
 * POST /api/trash-action
 * action: RESTORE | DELETE_PERMANENT | CLEAR_ALL | BATCH_RESTORE |
 *         BATCH_DELETE_PERMANENT | CLEAR_ALL_DATA
 */
trashApp.post('/trash-action', async (c) => {

  let body: { action?: string; id?: string; ids?: string[]; confirm?: string };
  try {
    body = await c.req.raw.json();
  } catch {
    return apiError('请求体不是有效的 JSON', 400);
  }

  const { action, id, ids, confirm } = body;
  if (!action) {
    return apiError('未知操作', 400);
  }

  const db = createDb(c.env.DB);

  if (action === 'RESTORE') {
    if (!id) return apiError('缺少 id', 400);
    await restoreTrash(db, id);
  } else if (action === 'DELETE_PERMANENT') {
    if (!id) return apiError('缺少 id', 400);
    await deletePermanent(db, id);
  } else if (action === 'CLEAR_ALL') {
    await clearAll(db);
  } else if (action === 'BATCH_RESTORE') {
    await batchRestore(db, ids || []);
  } else if (action === 'BATCH_DELETE_PERMANENT') {
    await batchDeletePermanent(db, ids || []);
  } else if (action === 'CLEAR_ALL_DATA') {
    // 危险操作：二次确认
    if (confirm !== 'DELETE_ALL_DATA_CONFIRM') {
      return apiError('CLEAR_ALL_DATA 需要 confirm=DELETE_ALL_DATA_CONFIRM 参数', 400);
    }
    await clearAllData(db);
  } else {
    // 保留旧行为：未知 action 也返回 success: true（旧代码的 bug，但需 byte-for-byte 兼容）
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
