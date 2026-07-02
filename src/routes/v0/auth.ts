/**
 * V0 鉴权路由：login / logout / sessions / session-action
 *
 * 阶段 4 / Commit 4.3：从 api.js 搬迁 4 个鉴权路由到 Hono。
 *
 * 搬迁来源：
 *   - POST /api/login          ← api.js:270-383
 *   - POST /api/logout         ← api.js:385-416
 *   - GET  /api/sessions       ← api.js:720-738
 *   - POST /api/session-action ← api.js:740-822
 *
 * 关键保留（审计警告）：
 *   - §9f #12：session-action DELETE/DELETE_ALL 必须同步更新三个 per-UA 数组
 *     （scaleByBrowser / fontSizeByBrowser / displayScaleByBrowser）
 *   - login 的 5 次锁定 + 15 分钟封禁逻辑
 *   - login 成功时同步初始化三个 per-UA 数组（与 api.js:311-367 一致）
 *   - logout 清 session + 清 cookie（Max-Age=0）
 *
 * 鉴权策略：
 *   - /api/login：公开（不鉴权，否则永远登不进来）
 *   - /api/logout：公开（即使 cookie 失效也要能清 cookie）
 *   - /api/sessions：需要 cookie 鉴权
 *   - /api/session-action：需要 cookie 鉴权
 *
 * 挂载：在 v0App 注册。
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
import { checkCookieAuth, type SessionEntry } from '../../middleware/auth';
import type { V0AppEnv } from './index';

/** 鉴权路由 Hono app。 */
export const authApp = new Hono<V0AppEnv>();

// ==================== POST /api/login ====================

/**
 * 登录：5 次锁定 + 15 分钟封禁 + session 创建 + per-UA 数组初始化。
 * 与 api.js:270-383 完全一致。
 */
authApp.post('/login', async (c) => {
  const env = c.env;
  const request = c.req.raw;
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();

  // 检查 IP 封禁
  const attemptRecord = await env.DB.prepare('SELECT * FROM login_attempts WHERE ip = ?')
    .bind(clientIp)
    .first<{ lock_until: number }>();
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
    await env.DB.prepare(
      `INSERT INTO login_attempts (ip, attempts, lock_until) VALUES (?, 0, 0)
       ON CONFLICT(ip) DO UPDATE SET attempts = 0, lock_until = 0`,
    )
      .bind(clientIp)
      .run();

    const loginUA = request.headers.get('User-Agent') || '';

    // 读取现有 sessions
    let sessions: SessionEntry[] = [];
    const sessionRecord = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'active_session_token'",
    ).first<{ value: string }>();
    if (sessionRecord && sessionRecord.value) {
      try {
        const parsed = JSON.parse(sessionRecord.value);
        if (Array.isArray(parsed)) sessions = parsed;
      } catch {
        sessions = [];
      }
    }

    // 生成新 token + 签名
    const token = generateSessionToken();
    const sig = await sign(token, env.JWT_SECRET);

    // 同 UA 的旧 session 替换，新 session push
    sessions = sessions.filter((s) => s.ua !== loginUA);
    sessions.push({ token, ua: loginUA });
    while (sessions.length > MAX_BROWSER_UA) sessions.shift();

    await env.DB.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_session_token', ?)",
    )
      .bind(JSON.stringify(sessions))
      .run();

    // 初始化三个 per-UA 数组（与 api.js:311-367 一致）
    if (loginUA) {
      const appSettingsRecord = await env.DB.prepare(
        "SELECT value FROM settings WHERE key = 'app_settings'",
      ).first<{ value: string }>();
      let appSettingsObj: Record<string, unknown> = {};
      if (appSettingsRecord && appSettingsRecord.value) {
        try {
          appSettingsObj = JSON.parse(appSettingsRecord.value);
        } catch {
          // 静默
        }
      }
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
      let uaExists = false;
      const scaleByBrowser = appSettingsObj.scaleByBrowser as Array<{ ua: string; scale: number }>;
      for (let i = 0; i < scaleByBrowser.length; i++) {
        if (scaleByBrowser[i].ua === loginUA) {
          uaExists = true;
          break;
        }
      }
      if (!uaExists) {
        scaleByBrowser.push({ ua: loginUA, scale: 1.0 });
        while (scaleByBrowser.length > MAX_BROWSER_UA) scaleByBrowser.shift();
      }

      // fontSizeByBrowser
      let uaExistsFontSize = false;
      const fontSizeByBrowser = appSettingsObj.fontSizeByBrowser as Array<{ ua: string; fontSize: number }>;
      for (let i = 0; i < fontSizeByBrowser.length; i++) {
        if (fontSizeByBrowser[i].ua === loginUA) {
          uaExistsFontSize = true;
          break;
        }
      }
      if (!uaExistsFontSize) {
        fontSizeByBrowser.push({ ua: loginUA, fontSize: 16 });
        while (fontSizeByBrowser.length > MAX_BROWSER_UA) fontSizeByBrowser.shift();
      }

      // displayScaleByBrowser
      let uaExistsDisplayScale = false;
      const displayScaleByBrowser = appSettingsObj.displayScaleByBrowser as Array<{ ua: string; displayScale: number }>;
      for (let i = 0; i < displayScaleByBrowser.length; i++) {
        if (displayScaleByBrowser[i].ua === loginUA) {
          uaExistsDisplayScale = true;
          break;
        }
      }
      if (!uaExistsDisplayScale) {
        displayScaleByBrowser.push({ ua: loginUA, displayScale: 1.0 });
        while (displayScaleByBrowser.length > MAX_BROWSER_UA) displayScaleByBrowser.shift();
      }

      await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)")
        .bind(JSON.stringify(appSettingsObj))
        .run();
    }

    // 设置 cookie + 返回成功
    const headers = new Headers();
    headers.append('Set-Cookie', `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
    headers.append('Set-Cookie', `auth_sig=${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
    return new Response(JSON.stringify({ success: true }), { headers });
  } else {
    // 登录失败：累加失败计数，5 次后封禁 15 分钟
    await env.DB.prepare(
      `INSERT INTO login_attempts (ip, attempts, lock_until) VALUES (?, 1, 0)
       ON CONFLICT(ip) DO UPDATE SET
         attempts = attempts + 1,
         lock_until = CASE WHEN attempts + 1 >= 5 THEN ? ELSE 0 END`,
    )
      .bind(clientIp, now + 15 * 60 * 1000)
      .run();
    return apiError('ACCESS DENIED', 401);
  }
});

// ==================== POST /api/logout ====================

/**
 * 登出：清 session + 清 cookie。
 * 与 api.js:385-416 一致。
 * 公开路由（即使 cookie 失效也要能清 cookie）。
 */
authApp.post('/logout', async (c) => {
  const env = c.env;
  const cookies = parseCookies(c.req.raw);

  if (cookies.auth_token) {
    const record = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'active_session_token'",
    ).first<{ value: string }>();
    if (record && record.value) {
      try {
        let sessions: SessionEntry[] = [];
        try {
          const parsed = JSON.parse(record.value);
          if (Array.isArray(parsed)) sessions = parsed;
        } catch {
          // 静默
        }
        if (sessions.length > 0) {
          sessions = sessions.filter((s) => s.token !== cookies.auth_token);
          if (sessions.length > 0) {
            await env.DB.prepare(
              "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_session_token', ?)",
            )
              .bind(JSON.stringify(sessions))
              .run();
          } else {
            await env.DB.prepare("DELETE FROM settings WHERE key = 'active_session_token'").run();
          }
        }
      } catch {
        // 静默
      }
    }
  }
  const headers = new Headers();
  headers.append('Set-Cookie', `auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  headers.append('Set-Cookie', `auth_sig=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return new Response(JSON.stringify({ success: true }), { headers });
});

// ==================== GET /api/sessions ====================

/**
 * 返回安全 sessions 列表（不带 token）。
 * 与 api.js:720-738 一致。
 * 需要 cookie 鉴权。
 */
authApp.get('/sessions', async (c) => {
  const env = c.env;
  const request = c.req.raw;

  // cookie 鉴权
  const authResult = await checkCookieAuth(request, env);
  if (!authResult.ok) {
    return apiError('UNAUTHORIZED', 401);
  }

  const record = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'active_session_token'",
  ).first<{ value: string }>();
  let sessions: SessionEntry[] = [];
  if (record && record.value) {
    try {
      const parsed = JSON.parse(record.value);
      if (Array.isArray(parsed)) sessions = parsed;
    } catch {
      // 静默
    }
  }
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

/**
 * 会话操作：DELETE（踢指定 UA）/ DELETE_ALL（踢全部）。
 * 与 api.js:740-822 一致。
 *
 * §9f #12：必须同步清理三个 per-UA 数组中被删除的 UA。
 * 需要 cookie 鉴权。
 */
authApp.post('/session-action', async (c) => {
  const env = c.env;
  const request = c.req.raw;

  // cookie 鉴权
  const authResult = await checkCookieAuth(request, env);
  if (!authResult.ok) {
    return apiError('UNAUTHORIZED', 401);
  }

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

  // 读取 sessions
  const record = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'active_session_token'",
  ).first<{ value: string }>();
  let sessions: SessionEntry[] = [];
  if (record && record.value) {
    try {
      const parsed = JSON.parse(record.value);
      if (Array.isArray(parsed)) sessions = parsed;
    } catch {
      // 静默
    }
  }

  // 执行删除
  if (action === 'DELETE' && ua) {
    sessions = sessions.filter((s) => s.ua !== ua);
  } else if (action === 'DELETE_ALL') {
    sessions = [];
  }

  // 写回 sessions
  if (sessions.length > 0) {
    await env.DB.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_session_token', ?)",
    )
      .bind(JSON.stringify(sessions))
      .run();
  } else {
    await env.DB.prepare("DELETE FROM settings WHERE key = 'active_session_token'").run();
  }

  // §9f #12：同步清理三个 per-UA 数组中被删除的 UA
  if (action === 'DELETE' || action === 'DELETE_ALL') {
    try {
      const appSettingsRecord = await env.DB.prepare(
        "SELECT value FROM settings WHERE key = 'app_settings'",
      ).first<{ value: string }>();
      if (appSettingsRecord && appSettingsRecord.value) {
        const appSettingsObj = JSON.parse(appSettingsRecord.value) as Record<string, unknown>;
        const remainingUAs = sessions.map((s) => s.ua);
        let changed = false;

        if (Array.isArray(appSettingsObj.scaleByBrowser)) {
          if (action === 'DELETE_ALL') {
            appSettingsObj.scaleByBrowser = [];
          } else {
            appSettingsObj.scaleByBrowser = (
              appSettingsObj.scaleByBrowser as Array<{ ua: string }>
            ).filter((item) => remainingUAs.includes(item.ua));
          }
          changed = true;
        }
        if (Array.isArray(appSettingsObj.fontSizeByBrowser)) {
          if (action === 'DELETE_ALL') {
            appSettingsObj.fontSizeByBrowser = [];
          } else {
            appSettingsObj.fontSizeByBrowser = (
              appSettingsObj.fontSizeByBrowser as Array<{ ua: string }>
            ).filter((item) => remainingUAs.includes(item.ua));
          }
          changed = true;
        }
        if (Array.isArray(appSettingsObj.displayScaleByBrowser)) {
          if (action === 'DELETE_ALL') {
            appSettingsObj.displayScaleByBrowser = [];
          } else {
            appSettingsObj.displayScaleByBrowser = (
              appSettingsObj.displayScaleByBrowser as Array<{ ua: string }>
            ).filter((item) => remainingUAs.includes(item.ua));
          }
          changed = true;
        }
        if (changed) {
          await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)")
            .bind(JSON.stringify(appSettingsObj))
            .run();
        }
      }
    } catch {
      // 静默
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
