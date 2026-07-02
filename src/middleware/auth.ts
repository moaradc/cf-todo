/**
 * cf-todo 鉴权中间件
 *
 * 阶段 3 把 api.js:88-118 的 isAuthorized + api-v1.js:147-158 的 extractApiKey +
 * api-v1.js:82-142 的 verifyApiKey/getApiKeyScope + api-v1.js:297-310 的 touchApiKeyLastUsed
 * 整体搬到 Hono 中间件。
 *
 * 设计原则：
 *   - cookie 鉴权用 verify()（非恒定时间）——cookie token 是高熵随机串，时序攻击无意义。
 *   - 密码 + API Key 用 secureCompare()（恒定时间）——低熵输入需防时序攻击。
 *   - line 100 的 legacy single-string session 兼容分支必须保留（审计 §9b 警告）。
 *   - scope 规则：disabled → 403，v1 → V0 路由 403，v0 → V1 路由 403，all → 放行，默认 v1。
 *
 * 阶段 3 行为：本中间件仅作为「预热」存在，不被任何路由实际调用
 * （业务路由仍走旧 handleRequest）。阶段 4+ 切换到 Hono 路由时才生效。
 */

import type { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../env';
import { parseCookies, verify } from '../utils.js';

// ==================== 类型定义 ====================

/** 单个登录会话（与 settings.active_session_token 的 JSON 数组元素结构一致）。 */
export interface SessionEntry {
  token: string;
  ua: string;
}

/** cookieAuth 中间件挂到 c.var 的会话信息。 */
export interface SessionState {
  matched: SessionEntry;
  sessions: SessionEntry[];
}

/** 扩展 Hono 的 Variables 类型，让 c.get('session') 有类型推断。 */
export type AuthVariables = {
  session: SessionState;
};

// ==================== Cookie 鉴权（Commit 3.2）====================

/**
 * 校验 cookie 鉴权。
 *
 * 逻辑与 api.js:88-118 的 isAuthorized 完全一致，包括 line 100 的 legacy
 * single-string 兼容分支（旧版 cf-todo 把单个 token 直接存为字符串，新版存 JSON 数组）。
 *
 * 返回：
 *   - { ok: true, matched, sessions }：鉴权通过
 *   - { ok: false }：鉴权失败（任一环节不通过）
 *
 * 注意：
 *   - 用 verify()（非恒定时间）校验 HMAC 签名。cookie token 是 32 字节随机串，
 *     时序攻击无意义；HMAC 签名本身就是高熵的。
 *   - 失败分支全部 return { ok: false }，不区分原因，避免信息泄露。
 */
export async function checkCookieAuth(
  request: Request,
  env: Env,
): Promise<{ ok: true; matched: SessionEntry; sessions: SessionEntry[] } | { ok: false }> {
  const cookies = parseCookies(request);
  if (!cookies.auth_token || !cookies.auth_sig) return { ok: false };

  // cookie token 是高熵随机串，verify() 用普通 === 比较即可（非恒定时间）。
  const sigValid = await verify(cookies.auth_token, cookies.auth_sig, env.JWT_SECRET);
  if (!sigValid) return { ok: false };

  const record = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'active_session_token'",
  ).first<{ value: string }>();
  if (!record || !record.value) return { ok: false };

  let sessions: SessionEntry[];
  // line 100 legacy 兼容：旧版存单个 token 字符串（不以 [ 开头），新版存 JSON 数组。
  // 审计 §9b 警告：这个分支不能删，否则旧部署用户升级后立即失效。
  if (!record.value.startsWith('[')) {
    if (record.value !== cookies.auth_token) return { ok: false };
    sessions = [{ token: record.value, ua: '' }];
  } else {
    try {
      const parsed = JSON.parse(record.value);
      if (!Array.isArray(parsed)) return { ok: false };
      sessions = parsed;
    } catch {
      return { ok: false };
    }
  }

  const matched = sessions.find((s) => s.token === cookies.auth_token);
  if (!matched) return { ok: false };

  return { ok: true, matched, sessions };
}

/**
 * Hono 中间件：cookie 鉴权。
 *
 * 用法（阶段 4+）：
 *   app.use('/api/*', cookieAuth);
 *   app.get('/api/todos', (c) => {
 *     const { matched } = c.get('session');
 *     // ...
 *   });
 *
 * 失败时返回 401 UNAUTHORIZED（与旧 apiError('UNAUTHORIZED', 401) 一致）。
 */
export const cookieAuth: MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> = async (c, next) => {
  const result = await checkCookieAuth(c.req.raw, c.env);
  if (!result.ok) {
    return c.json({ error: 'UNAUTHORIZED' }, 401);
  }
  c.set('session', { matched: result.matched, sessions: result.sessions });
  await next();
  return;
};

