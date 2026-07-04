/**
 * V0 Categories 路由
 *
 *
 * 路由：
 *   - GET  /api/categories
 *   - POST /api/category-action
 *
 * 鉴权：cookie 鉴权（v0Auth 的 cookie 分支）
 *
 * 注：categories 路由不读 customColors settings（那是 V0 custom-colors 路由的事）。
 */

import { Hono } from 'hono';
import { apiError } from '../../utils.js';
import { createDb } from '../../db/client';
import {
  listCategories,
  createCategory,
  updateCategory,
  batchDeleteCategories,
} from '../../services/category-service';
import type { V0AppEnv } from './index';

/** Categories Hono app。 */
export const categoriesApp = new Hono<V0AppEnv>();

/**
 * GET /api/categories
 * 返回所有分类列表。
 */
categoriesApp.get('/categories', async (c) => {
  // cookie 鉴权

  const db = createDb(c.env.DB);
  const rows = await listCategories(db);
  return new Response(JSON.stringify(rows), {
    headers: { 'Content-Type': 'application/json' },
  });
});

/**
 * POST /api/category-action
 * action: CREATE | UPDATE | BATCH_DELETE
 */
categoriesApp.post('/category-action', async (c) => {
  // cookie 鉴权

  // 解析 body
  let body: { action?: string; id?: string; ids?: string[]; name?: string; color?: string };
  try {
    body = await c.req.raw.json();
  } catch {
    return apiError('请求体不是有效的 JSON', 400);
  }

  const { action, id, ids, name, color } = body;
  if (!action) {
    return apiError('未知操作', 400);
  }

  const db = createDb(c.env.DB);

  if (action === 'CREATE') {
    const result = await createCategory(db, { name, color });
    if (!result.success) {
      return apiError(result.error, result.status);
    }
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (action === 'UPDATE') {
    const result = await updateCategory(db, { id, name, color });
    if (!result.success) {
      return apiError(result.error, result.status);
    }
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (action === 'BATCH_DELETE') {
    const result = await batchDeleteCategories(db, ids || []);
    if (!result.success) {
      return apiError(result.error, result.status);
    }
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return apiError('未知操作', 400);
});
