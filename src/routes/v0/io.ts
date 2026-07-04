/**
 * V0 IO 路由：export / import / import-backup
 *
 *
 * 路由：
 *   - GET  /api/export（page/session/stream）
 *   - POST /api/import（init/finalize/status/abort + NDJSON）
 *
 * 鉴权：cookie 鉴权
 */

import { Hono } from 'hono';
import { apiError } from '../../utils.js';
import { createDb } from '../../db/client';
import { exportPage, exportSession, exportStream, importNdjson, importPhase, importBackup } from '../../services/io-service';
import type { V0AppEnv } from './index';

/** IO Hono app。 */
export const ioApp = new Hono<V0AppEnv>();

/** cookie 鉴权辅助。 */
// ==================== GET /api/export ====================

ioApp.get('/export', async (c) => {

  const url = new URL(c.req.url);
  const mode = url.searchParams.get('mode');
  const db = createDb(c.env.DB);

  if (mode === 'page') {
    return exportPage(
      db,
      {
        type: url.searchParams.get('type') || undefined,
        cursor: url.searchParams.get('cursor') || undefined,
        sessionId: url.searchParams.get('sessionId') || undefined,
        final: url.searchParams.get('final') === 'true',
        todos: url.searchParams.get('todos') === 'true',
        trash: url.searchParams.get('trash') === 'true',
      },
      (p) => c.executionCtx.waitUntil(p),
    );
  }

  if (mode === 'session') {
    return exportSession(db, {
      action: url.searchParams.get('action') || undefined,
      sessionId: url.searchParams.get('sessionId') || undefined,
      todos: url.searchParams.get('todos') === 'true',
      trash: url.searchParams.get('trash') === 'true',
      settings: url.searchParams.get('settings') === 'true',
      categories: url.searchParams.get('categories') === 'true',
      todosCursor: url.searchParams.get('todosCursor'),
      templatesCursor: url.searchParams.get('templatesCursor'),
    });
  }

  if (mode === 'stream') {
    return exportStream(db, {
      sessionId: url.searchParams.get('sessionId'),
      todosCursor: url.searchParams.get('todosCursor') || '',
      templatesCursor: url.searchParams.get('templatesCursor') || '',
      skipHeader: url.searchParams.get('skipHeader') === 'true',
      todos: url.searchParams.get('todos') === 'true',
      trash: url.searchParams.get('trash') === 'true',
      settings: url.searchParams.get('settings') === 'true',
      categories: url.searchParams.get('categories') === 'true',
    });
  }

  return apiError('Unknown mode. Use mode=page, mode=stream or mode=session', 400);
});

// ==================== POST /api/import ====================

ioApp.post('/import', async (c) => {

  const url = new URL(c.req.url);
  const contentType = c.req.raw.headers.get('Content-Type') || '';
  const db = createDb(c.env.DB);

  // NDJSON 上传模式
  if (contentType.includes('application/x-ndjson')) {
    const importId = url.searchParams.get('importId') || '';
    return importNdjson(db, c.req.raw, importId);
  }

  // JSON phase 模式（init/finalize/status/abort）
  let impBody: Record<string, unknown>;
  try {
    impBody = await c.req.raw.json();
  } catch {
    return apiError('请求体不是有效的 JSON', 400);
  }
  return importPhase(db, impBody);
});


ioApp.all('/import-backup', async (c) => {

  const url = new URL(c.req.url);
  const action = url.searchParams.get('action') || 'query';
  const db = createDb(c.env.DB);
  return importBackup(db, action);
});
