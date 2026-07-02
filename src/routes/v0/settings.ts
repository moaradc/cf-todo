/**
 * V0 Settings 路由：settings / custom-code / custom-colors / custom-header / custom-content
 *
 * 阶段 5.3：从 api.js 搬迁到 Hono + Drizzle。
 *
 * 路由：
 *   - GET  /api/settings        ← api.js:1947-1954
 *   - POST /api/settings        ← api.js:1956-1962
 *   - GET  /api/custom-code     ← api.js:824-831
 *   - POST /api/custom-code     ← api.js:833-850
 *   - GET  /api/custom-colors   ← api.js:1964-1971
 *   - POST /api/custom-colors   ← api.js:1983-1992
 *   - GET  /api/custom-header   ← api.js:1973-1976
 *   - GET  /api/custom-content  ← api.js:1978-1981
 *
 * 鉴权：cookie 鉴权
 * §3f：customColors 用 camelCase 作为 settings key，保留。
 */

import { Hono } from 'hono';
import { apiError } from '../../utils.js';
import { createDb } from '../../db/client';
import { checkCookieAuth } from '../../middleware/auth';
import {
  getAppSettings,
  setAppSettings,
  getCustomCode,
  setCustomCode,
  getCustomColors,
  setCustomColors,
  getSettingRaw,
} from '../../services/settings-service';
import type { V0AppEnv } from './index';

/** Settings Hono app。 */
export const settingsApp = new Hono<V0AppEnv>();

/** cookie 鉴权辅助。 */
async function requireAuth(c: import('hono').Context<V0AppEnv>): Promise<Response | null> {
  const authResult = await checkCookieAuth(c.req.raw, c.env);
  if (!authResult.ok) {
    return apiError('UNAUTHORIZED', 401);
  }
  return null;
}

// ==================== /api/settings ====================

settingsApp.get('/settings', async (c) => {
  const err = await requireAuth(c);
  if (err) return err;
  const db = createDb(c.env.DB);
  const settingsObj = await getAppSettings(db);
  return new Response(JSON.stringify(settingsObj), {
    headers: { 'Content-Type': 'application/json' },
  });
});

settingsApp.post('/settings', async (c) => {
  const err = await requireAuth(c);
  if (err) return err;
  let settingsData: unknown;
  try {
    settingsData = await c.req.raw.json();
  } catch {
    return apiError('请求体不是有效的 JSON', 400);
  }
  if (!settingsData || typeof settingsData !== 'object') {
    return apiError('设置必须为 JSON 对象', 400);
  }
  const db = createDb(c.env.DB);
  await setAppSettings(db, settingsData as Record<string, unknown>);
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// ==================== /api/custom-code ====================

settingsApp.get('/custom-code', async (c) => {
  const err = await requireAuth(c);
  if (err) return err;
  const db = createDb(c.env.DB);
  const { customHeader, customContent } = await getCustomCode(db);
  return new Response(JSON.stringify({ customHeader, customContent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

settingsApp.post('/custom-code', async (c) => {
  const err = await requireAuth(c);
  if (err) return err;
  let ccBody: { customHeader?: string; customContent?: string };
  try {
    ccBody = await c.req.raw.json();
  } catch {
    return apiError('请求体不是有效的 JSON', 400);
  }
  const db = createDb(c.env.DB);
  await setCustomCode(db, ccBody);
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// ==================== /api/custom-colors ====================

settingsApp.get('/custom-colors', async (c) => {
  const err = await requireAuth(c);
  if (err) return err;
  const db = createDb(c.env.DB);
  const customColors = await getCustomColors(db);
  return new Response(JSON.stringify(customColors), {
    headers: { 'Content-Type': 'application/json' },
  });
});

settingsApp.post('/custom-colors', async (c) => {
  const err = await requireAuth(c);
  if (err) return err;
  let clrBody: { colors?: unknown };
  try {
    clrBody = await c.req.raw.json();
  } catch {
    return apiError('请求体不是有效的 JSON', 400);
  }
  if (!Array.isArray(clrBody.colors)) {
    return apiError('colors must be an array', 400);
  }
  const db = createDb(c.env.DB);
  await setCustomColors(db, clrBody.colors);
  return new Response(JSON.stringify({ success: true, colors: clrBody.colors }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// ==================== /api/custom-header ====================

settingsApp.get('/custom-header', async (c) => {
  const err = await requireAuth(c);
  if (err) return err;
  const db = createDb(c.env.DB);
  const value = await getSettingRaw(db, 'custom_header');
  return new Response(value, {
    headers: { 'Content-Type': 'text/plain' },
  });
});

// ==================== /api/custom-content ====================

settingsApp.get('/custom-content', async (c) => {
  const err = await requireAuth(c);
  if (err) return err;
  const db = createDb(c.env.DB);
  const value = await getSettingRaw(db, 'custom_content');
  return new Response(value, {
    headers: { 'Content-Type': 'text/plain' },
  });
});
