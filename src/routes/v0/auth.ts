/**
 * V0 鉴权路由：login / logout / sessions / session-action
 *
 * 关键保留（审计警告）：
 *   - login 的 5 次锁定 + 15 分钟封禁逻辑
 *   - login 成功时同步初始化三个 per-UA 数组
 *   - logout 清 session + 清 cookie（Max-Age=0）
 *
 * 鉴权策略：
 *   - /api/login：公开（不鉴权，否则永远登不进来）
 *   - /api/logout：公开（即使 cookie 失效也要能清 cookie）
 *   - /api/sessions：需要 cookie 鉴权
 *   - /api/session-action：需要 cookie 鉴权
 */

import { Hono } from 'hono';
import {
  MAX_BROWSER_UA,
  parseCookies,
  sign,
  generateSessionToken,
  secureCompare,
  apiError,
} from '../../utils.js';
import {
  checkCookieAuth,
  v0Auth,
  type SessionEntry,
  getLoginAttempt,
  resetLoginAttempt,
  recordLoginFailure,
} from '../../middleware/auth';
import { createDb } from '../../db/client';
import { eq } from 'drizzle-orm';
import { settings } from '../../db/schema';
import { getSettingRaw, setSettingRaw, getAppSettings, setAppSettings } from '../../services/settings-service';
import type { V0AppEnv } from './index';

/** 鉴权路由 Hono app。 */
export const authApp = new Hono<V0AppEnv>();

// sessions / session-action 需要 API Key 或 Cookie 鉴权
authApp.use('/sessions', v0Auth);
authApp.use('/session-action', v0Auth);

/** 读取 active_session_token 并解析为 SessionEntry[]（容错：JSON 解析失败返回空数组）。 */
async function loadSessions(db: ReturnType<typeof createDb>): Promise<SessionEntry[]> {
  const value = await getSettingRaw(db, 'active_session_token');
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 写入 sessions（空数组时删除行，避免残留空 JSON）。 */
async function saveSessions(db: ReturnType<typeof createDb>, sessions: SessionEntry[]): Promise<void> {
  if (sessions.length > 0) {
    await setSettingRaw(db, 'active_session_token', JSON.stringify(sessions));
  } else {
    await db.delete(settings).where(eq(settings.key, 'active_session_token')).run();
  }
}

// ==================== POST /api/login ====================

authApp.post('/login', async (c) => {
  const env = c.env;
  const request = c.req.raw;
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  const db = createDb(env.DB);

  // 检查 IP 封禁
  const attemptRecord = await getLoginAttempt(db, clientIp);
  if (attemptRecord && attemptRecord.lock_until > now) {
    return apiError('ACCOUNT LOCKED', 429);
  }

  // 解析 body（容错：JSON 解析失败返回空对象）
  const { password } = await (async () => {
    try {
      return (await request.json()) as { password?: string };
    } catch {
      return {} as { password?: string };
    }
  })();

  // 恒定时间比较密码（防时序攻击）
  const isAdmin = await secureCompare(password || '', env.ADMIN_PASSWORD, env.JWT_SECRET);

  if (isAdmin) {
    // 登录成功：清零失败计数
    await resetLoginAttempt(db, clientIp);

    const loginUA = request.headers.get('User-Agent') || '';

    // 读取现有 sessions + 生成新 token
    let sessions = await loadSessions(db);
    const token = generateSessionToken();
    const sig = await sign(token, env.JWT_SECRET);

    // 同 UA 的旧 session 替换，新 session push
    sessions = sessions.filter((s) => s.ua !== loginUA);
    sessions.push({ token, ua: loginUA });
    while (sessions.length > MAX_BROWSER_UA) sessions.shift();

    await saveSessions(db, sessions);

    // 初始化三个 per-UA 数组
    if (loginUA) {
      const appSettingsObj = await getAppSettings(db);
      if (!Array.isArray(appSettingsObj.scaleByBrowser)) {
        appSettingsObj.scaleByBrowser = [];
      }
      if (!Array.isArray(appSettingsObj.fontSizeByBrowser)) {
        appSettingsObj.fontSizeByBrowser = [];
      }
      if (!Array.isArray(appSettingsObj.displayScaleByBrowser)) {
        appSettingsObj.displayScaleByBrowser = [];
      }

      // scaleByBrowser
      const scaleByBrowser = appSettingsObj.scaleByBrowser as Array<{ ua: string; scale: number }>;
      if (!scaleByBrowser.some((item) => item.ua === loginUA)) {
        scaleByBrowser.push({ ua: loginUA, scale: 1.0 });
        while (scaleByBrowser.length > MAX_BROWSER_UA) scaleByBrowser.shift();
      }

      // fontSizeByBrowser
      const fontSizeByBrowser = appSettingsObj.fontSizeByBrowser as Array<{ ua: string; fontSize: number }>;
      if (!fontSizeByBrowser.some((item) => item.ua === loginUA)) {
        fontSizeByBrowser.push({ ua: loginUA, fontSize: 16 });
        while (fontSizeByBrowser.length > MAX_BROWSER_UA) fontSizeByBrowser.shift();
      }

      // displayScaleByBrowser
      const displayScaleByBrowser = appSettingsObj.displayScaleByBrowser as Array<{ ua: string; displayScale: number }>;
      if (!displayScaleByBrowser.some((item) => item.ua === loginUA)) {
        displayScaleByBrowser.push({ ua: loginUA, displayScale: 1.0 });
        while (displayScaleByBrowser.length > MAX_BROWSER_UA) displayScaleByBrowser.shift();
      }

      await setAppSettings(db, appSettingsObj);
    }

    // 设置 cookie + 返回成功
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Set-Cookie', `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
    headers.append('Set-Cookie', `auth_sig=${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
    return new Response(JSON.stringify({ success: true }), { headers });
  } else {
    // 登录失败：累加失败计数，5 次后封禁 15 分钟
    await recordLoginFailure(db, clientIp, now + 15 * 60 * 1000);
    return apiError('ACCESS DENIED', 401);
  }
});

// ==================== POST /api/logout ====================

authApp.post('/logout', async (c) => {
  const cookies = parseCookies(c.req.raw);

  if (cookies.auth_token) {
    const db = createDb(c.env.DB);
    const sessions = await loadSessions(db);
    if (sessions.length > 0) {
      const remaining = sessions.filter((s) => s.token !== cookies.auth_token);
      // 只在实际有变化时写回（remaining 与 sessions 长度不同，或过滤后不同）
      if (remaining.length !== sessions.length) {
        await saveSessions(db, remaining);
      }
    }
  }
  const headers = new Headers();
  headers.append('Content-Type', 'application/json');
  headers.append('Set-Cookie', `auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  headers.append('Set-Cookie', `auth_sig=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return new Response(JSON.stringify({ success: true }), { headers });
});

// ==================== GET /api/sessions ====================

authApp.get('/sessions', async (c) => {
  const request = c.req.raw;
  const db = createDb(c.env.DB);

  // v0Auth 中间件已鉴权，此处直接使用
  const sessions = await loadSessions(db);
  const clientUA = request.headers.get('User-Agent') || '';
  const safeSessions = sessions.map((s) => ({
    ua: s.ua,
    disabled: (s as { disabled?: boolean }).disabled || false,
    isCurrent: s.ua === clientUA,
  }));
  return new Response(JSON.stringify(safeSessions), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// ==================== POST /api/session-action ====================

authApp.post('/session-action', async (c) => {
  const request = c.req.raw;
  const db = createDb(c.env.DB);

  // 解析 body
  let sessionParsedBody: { action?: string; ua?: string };
  try {
    sessionParsedBody = (await request.json()) as { action?: string; ua?: string };
  } catch {
    return apiError('请求体不是有效的 JSON', 400);
  }
  const { action, ua } = sessionParsedBody;
  if (!action || !['DELETE', 'DELETE_ALL'].includes(action)) {
    return apiError('action 必须为 DELETE 或 DELETE_ALL', 400);
  }
  if (action === 'DELETE' && (!ua || typeof ua !== 'string')) {
    return apiError('DELETE 操作需要 ua 参数', 400);
  }

  // 读取 sessions + 执行删除
  let sessions = await loadSessions(db);
  if (action === 'DELETE' && ua) {
    sessions = sessions.filter((s) => s.ua !== ua);
  } else if (action === 'DELETE_ALL') {
    sessions = [];
  }

  // 写回 sessions
  await saveSessions(db, sessions);

  // 同步清理 app_settings 里的 per-UA 数组
  if (action === 'DELETE' || action === 'DELETE_ALL') {
    try {
      const appSettingsObj = await getAppSettings(db);
      const remainingUAs = sessions.map((s) => s.ua);
      let changed = false;

      if (Array.isArray(appSettingsObj.scaleByBrowser)) {
        appSettingsObj.scaleByBrowser = action === 'DELETE_ALL'
          ? []
          : (appSettingsObj.scaleByBrowser as Array<{ ua: string }>).filter((item) => remainingUAs.includes(item.ua));
        changed = true;
      }
      if (Array.isArray(appSettingsObj.fontSizeByBrowser)) {
        appSettingsObj.fontSizeByBrowser = action === 'DELETE_ALL'
          ? []
          : (appSettingsObj.fontSizeByBrowser as Array<{ ua: string }>).filter((item) => remainingUAs.includes(item.ua));
        changed = true;
      }
      if (Array.isArray(appSettingsObj.displayScaleByBrowser)) {
        appSettingsObj.displayScaleByBrowser = action === 'DELETE_ALL'
          ? []
          : (appSettingsObj.displayScaleByBrowser as Array<{ ua: string }>).filter((item) => remainingUAs.includes(item.ua));
        changed = true;
      }
      if (changed) {
        await setAppSettings(db, appSettingsObj);
      }
    } catch {
      // 静默
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
