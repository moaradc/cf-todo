/**
 * cf-todo 鉴权中间件
 *
 * 提供 cookie 鉴权 + API Key 鉴权 + scope 校验。
 *
 * 设计原则：
 *   - cookie 鉴权用 verify()（非恒定时间）——cookie token 是高熵随机串，时序攻击无意义。
 *   - 密码 + API Key 用 secureCompare()（恒定时间）——低熵输入需防时序攻击。
 *   - scope 规则：disabled → 403，v1 → V0 路由 403，v0 → V1 路由 403，all → 放行，默认 v1。
 *
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


/**
 * 校验 cookie 鉴权。
 *
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


/** API Key 作用域。 */
export type ApiKeyScope = 'v1' | 'v0' | 'all' | 'disabled';

/** 单个 API Key 记录（settings.api_keys JSON 数组元素）。 */
export interface ApiKeyRecord {
  id: string;
  key: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
  disabled: boolean;
}

const API_KEYS_SETTINGS_KEY = 'api_keys';

/**
 * 从 D1 读取所有 API Keys。
 *
 */
export async function getApiKeys(db: D1Database): Promise<ApiKeyRecord[]> {
  const record = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(API_KEYS_SETTINGS_KEY)
    .first<{ value: string }>();
  if (!record || !record.value) return [];
  try {
    const parsed = JSON.parse(record.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 保存所有 API Keys。
 *
 */
export async function saveApiKeys(db: D1Database, keys: ApiKeyRecord[]): Promise<void> {
  await db
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .bind(API_KEYS_SETTINGS_KEY, JSON.stringify(keys))
    .run();
}

/**
 * 获取 API Key 作用域设置。
 *默认 'v1'。
 */
export async function getApiKeyScope(db: D1Database): Promise<ApiKeyScope> {
  try {
    const row = await db
      .prepare("SELECT value FROM settings WHERE key = 'app_settings'")
      .first<{ value: string }>();
    if (row && row.value) {
      const obj = JSON.parse(row.value);
      return (obj.apiKeyScope as ApiKeyScope) || 'v1';
    }
  } catch {
    // 静默吞掉，返回默认值
  }
  return 'v1';
}

/**
 * 从请求中提取 API Key。
 *
 *
 * 优先级：
 *   1. X-API-Key 头
 *   2. api_key 查询参数
 *   3. Authorization: Bearer cfk_... 头（必须 cfk_ 前缀）
 */
export function extractApiKey(request: Request, url: URL): string | null {
  const headerKey = request.headers.get('X-API-Key');
  if (headerKey) return headerKey;
  const queryKey = url.searchParams.get('api_key');
  if (queryKey) return queryKey;
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith('cfk_')) return token;
  }
  return null;
}

/**
 * 验证 API Key（恒定时间比较）。
 *
 *
 * 注意：必须用 secureCompare（HMAC），不能用 ===，否则时序攻击可逐字符爆破。
 * secret 必须为常量（env.JWT_SECRET），不能是用户输入。
 */
export async function verifyApiKey(
  db: D1Database,
  providedKey: string,
  jwtSecret: string,
): Promise<boolean> {
  if (!providedKey || typeof providedKey !== 'string') return false;
  const keys = await getApiKeys(db);
  // 动态导入避免循环依赖（utils.js 导出 secureCompare，但本文件也导入 utils.js）
  const { secureCompare } = await import('../utils.js');
  for (const k of keys) {
    if (k.disabled) continue;
    const match = await secureCompare(providedKey, k.key, jwtSecret);
    if (match) return true;
  }
  return false;
}

/**
 * 更新 API Key 最后使用时间（限频：5 分钟一次）。
 *
 *
 * 设计：
 *   - 通过 c.executionCtx.waitUntil 异步执行，不阻塞请求。
 *   - 5 分钟限频避免每次请求都写库。
 *   - 任何异常静默吞掉（不影响主请求）。
 */
export async function touchApiKeyLastUsed(db: D1Database, apiKey: string): Promise<void> {
  try {
    const keys = await getApiKeys(db);
    const target = keys.find((k) => k.key === apiKey);
    if (target) {
      const now = Date.now();
      if (!target.lastUsedAt || now - target.lastUsedAt > 5 * 60 * 1000) {
        target.lastUsedAt = now;
        await saveApiKeys(db, keys);
      }
    }
  } catch {
    // 静默吞掉，不影响主请求
  }
}

/**
 * Hono 中间件：API Key 鉴权 + scope 校验。
 *
 *   // V1 路由
 *   app.use('/api/v1/*', apiKeyAuth('v1'));
 *   // V0 路由
 *   app.use('/api/*', apiKeyAuth('v0'));
 *
 * 行为：
 *   - 有 API Key → 校验 + scope 检查 + touchApiKeyLastUsed（waitUntil）
 *   - 无 API Key → 调用 next() 让后续中间件（如 cookieAuth）接管
 *   - scope 不匹配 → 403
 *
 * @param routeScope 当前路由所属的 scope（'v0' 或 'v1'）
 */
export function apiKeyAuth(routeScope: 'v0' | 'v1'): MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> {
  return async (c, next) => {
    const url = new URL(c.req.url);
    const apiKey = extractApiKey(c.req.raw, url);
    if (!apiKey) {
      // 无 API Key，交给后续 cookieAuth 接管
      await next();
      return;
    }

    const valid = await verifyApiKey(c.env.DB, apiKey, c.env.JWT_SECRET);
    if (!valid) {
      return c.json({ error: 'Invalid API Key' }, 401);
    }

    const scope = await getApiKeyScope(c.env.DB);
    if (scope === 'disabled') {
      return c.json({ error: 'API Key 已被禁用' }, 403);
    }
    // scope 规则：
    //   - all → 放行所有
    //   - v1 → 只允许 V1 路由
    //   - v0 → 只允许 V0 路由
    if (scope === 'v1' && routeScope === 'v0') {
      return c.json({ error: 'API Key 仅允许访问 v1 接口' }, 403);
    }
    if (scope === 'v0' && routeScope === 'v1') {
      return c.json({ error: 'API Key 仅允许访问 v0 接口' }, 403);
    }

    // 异步更新 lastUsedAt，不阻塞请求（与原 ctx.waitUntil 一致）
    c.executionCtx.waitUntil(touchApiKeyLastUsed(c.env.DB, apiKey));

    await next();
    return;
  };
}

// ==================== 组合中间件：API Key 或 Cookie ====================

/**
 * Hono 中间件：API Key 优先，回退到 Cookie。
 *
 *   - 有 API Key → 校验 + scope（v1 scope 不允许访问 V0）
 *   - 无 API Key → cookie 鉴权
 *
 * 用于 V0 路由（/api/* 但非 /api/v1/*）。
 */
export const v0Auth: MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> = async (c, next) => {
  const url = new URL(c.req.url);
  const apiKey = extractApiKey(c.req.raw, url);
  if (apiKey) {
    const valid = await verifyApiKey(c.env.DB, apiKey, c.env.JWT_SECRET);
    if (!valid) return c.json({ error: 'UNAUTHORIZED' }, 401);
    const scope = await getApiKeyScope(c.env.DB);
    if (scope === 'disabled') return c.json({ error: 'API Key 已被禁用' }, 403);
    if (scope === 'v1') return c.json({ error: 'API Key 仅允许访问 v1 接口' }, 403);
    c.executionCtx.waitUntil(touchApiKeyLastUsed(c.env.DB, apiKey));
    await next();
    return;
  }
  // 回退到 cookie 鉴权
  const result = await checkCookieAuth(c.req.raw, c.env);
  if (!result.ok) return c.json({ error: 'UNAUTHORIZED' }, 401);
  c.set('session', { matched: result.matched, sessions: result.sessions });
  await next();
  return;
};

/**
 * Hono 中间件：V1 路由鉴权（API Key 优先，回退到 Cookie）。
 *。
 * 用于 V1 路由（/api/v1/*）。
 */
export const v1Auth: MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> = async (c, next) => {
  const url = new URL(c.req.url);
  const apiKey = extractApiKey(c.req.raw, url);
  if (apiKey) {
    const valid = await verifyApiKey(c.env.DB, apiKey, c.env.JWT_SECRET);
    if (!valid) return c.json({ error: 'Invalid API Key' }, 401);
    const scope = await getApiKeyScope(c.env.DB);
    if (scope === 'disabled') return c.json({ error: 'API Key 已被禁用' }, 403);
    if (scope === 'v0') return c.json({ error: 'API Key 仅允许访问 v0 接口' }, 403);
    c.executionCtx.waitUntil(touchApiKeyLastUsed(c.env.DB, apiKey));
    await next();
    return;
  }
  const result = await checkCookieAuth(c.req.raw, c.env);
  if (!result.ok) return c.json({ error: 'Cookie authentication required' }, 401);
  c.set('session', { matched: result.matched, sessions: result.sessions });
  await next();
  return;
};
