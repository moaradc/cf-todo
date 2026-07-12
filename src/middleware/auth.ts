/**
 * cf-todo 鉴权中间件
 *
 * 提供 cookie 鉴权 + API Key 鉴权 + scope 校验。
 *
 * 设计原则：
 *   - cookie 鉴权用 verify()（非恒定时间）——cookie token 是高熵随机串，时序攻击无意义。
 *   - 密码 + API Key 用 secureCompare()（恒定时间）——低熵输入需防时序攻击。
 *   - scope 规则：disabled → 403，v1 → V0 路由 403，v0 → V1 路由 403，all → 放行，默认 v1。
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../env';
import type { Db } from '../db/client';
import { createDb } from '../db/client';
import { settings, login_attempts } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { parseCookies, verify } from '../utils.js';
import { getSettingJson, setSettingJson, getAppSettings } from '../services/settings-service';

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
 * legacy 兼容：旧版存单个 token 字符串（不以 [ 开头），新版存 JSON 数组。
 * 失败分支全部 return { ok: false }，不区分原因，避免信息泄露。
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

  const db = createDb(env.DB);
  const record = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, 'active_session_token'))
    .get() as { value: string } | undefined;
  if (!record || !record.value) return { ok: false };

  let sessions: SessionEntry[];
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

/** Hono 中间件：cookie 鉴权。失败返回 401 UNAUTHORIZED。 */
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

/** 从 settings 读取所有 API Keys。 */
export async function getApiKeys(db: Db): Promise<ApiKeyRecord[]> {
  return getSettingJson<ApiKeyRecord[]>(db, API_KEYS_SETTINGS_KEY, []);
}

/** 保存所有 API Keys。 */
export async function saveApiKeys(db: Db, keys: ApiKeyRecord[]): Promise<void> {
  await setSettingJson(db, API_KEYS_SETTINGS_KEY, keys);
}

/** 获取 API Key 作用域设置。默认 'v1'。复用 settings-service 的解包逻辑。 */
export async function getApiKeyScope(db: Db): Promise<ApiKeyScope> {
  try {
    const obj = await getAppSettings(db);
    const scope = obj.apiKeyScope;
    if (scope === 'v1' || scope === 'v0' || scope === 'all' || scope === 'disabled') return scope;
  } catch {
    // 静默吞掉，返回默认值
  }
  return 'v1';
}

/**
 * 从请求中提取 API Key。
 *
 * 优先级：X-API-Key 头 → api_key 查询参数 → Authorization: Bearer cfk_... 头
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
 * 必须用 secureCompare（HMAC），不能用 ===，否则时序攻击可逐字符爆破。
 */
export async function verifyApiKey(
  db: Db,
  providedKey: string,
  jwtSecret: string,
): Promise<boolean> {
  if (!providedKey || typeof providedKey !== 'string') return false;
  const keys = await getApiKeys(db);
  const { secureCompare } = await import('../utils.js');
  for (const k of keys) {
    if (k.disabled) continue;
    const match = await secureCompare(providedKey, k.key, jwtSecret);
    if (match) return true;
  }
  return false;
}

/** 更新 API Key 最后使用时间（限频：5 分钟一次）。通过 waitUntil 异步执行。 */
export async function touchApiKeyLastUsed(db: Db, apiKey: string): Promise<void> {
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
 * 行为：有 API Key → 校验 + scope + touch；无 → next() 让 cookieAuth 接管；scope 不匹配 → 403。
 */
export function apiKeyAuth(routeScope: 'v0' | 'v1'): MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> {
  return async (c, next) => {
    const url = new URL(c.req.url);
    const apiKey = extractApiKey(c.req.raw, url);
    if (!apiKey) {
      await next();
      return;
    }

    const db = createDb(c.env.DB);
    const valid = await verifyApiKey(db, apiKey, c.env.JWT_SECRET);
    if (!valid) {
      return c.json({ error: 'Invalid API Key' }, 401);
    }

    const scope = await getApiKeyScope(db);
    if (scope === 'disabled') {
      return c.json({ error: 'API Key 已被禁用' }, 403);
    }
    if (scope === 'v1' && routeScope === 'v0') {
      return c.json({ error: 'API Key 仅允许访问 v1 接口' }, 403);
    }
    if (scope === 'v0' && routeScope === 'v1') {
      return c.json({ error: 'API Key 仅允许访问 v0 接口' }, 403);
    }

    c.executionCtx.waitUntil(touchApiKeyLastUsed(db, apiKey));

    await next();
    return;
  };
}

// ==================== 组合中间件：API Key 或 Cookie ====================

/** Hono 中间件：API Key 优先，回退到 Cookie。用于 V0 路由。 */
export const v0Auth: MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> = async (c, next) => {
  const url = new URL(c.req.url);
  const apiKey = extractApiKey(c.req.raw, url);
  if (apiKey) {
    const db = createDb(c.env.DB);
    const valid = await verifyApiKey(db, apiKey, c.env.JWT_SECRET);
    if (!valid) return c.json({ error: 'UNAUTHORIZED' }, 401);
    const scope = await getApiKeyScope(db);
    if (scope === 'disabled') return c.json({ error: 'API Key 已被禁用' }, 403);
    if (scope === 'v1') return c.json({ error: 'API Key 仅允许访问 v1 接口' }, 403);
    c.executionCtx.waitUntil(touchApiKeyLastUsed(db, apiKey));
    await next();
    return;
  }
  const result = await checkCookieAuth(c.req.raw, c.env);
  if (!result.ok) return c.json({ error: 'UNAUTHORIZED' }, 401);
  c.set('session', { matched: result.matched, sessions: result.sessions });
  await next();
  return;
};

/** Hono 中间件：V1 路由鉴权（API Key 优先，回退到 Cookie）。 */
export const v1Auth: MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> = async (c, next) => {
  const url = new URL(c.req.url);
  const apiKey = extractApiKey(c.req.raw, url);
  if (apiKey) {
    const db = createDb(c.env.DB);
    const valid = await verifyApiKey(db, apiKey, c.env.JWT_SECRET);
    if (!valid) return c.json({ error: 'Invalid API Key' }, 401);
    const scope = await getApiKeyScope(db);
    if (scope === 'disabled') return c.json({ error: 'API Key 已被禁用' }, 403);
    if (scope === 'v0') return c.json({ error: 'API Key 仅允许访问 v0 接口' }, 403);
    c.executionCtx.waitUntil(touchApiKeyLastUsed(db, apiKey));
    await next();
    return;
  }
  const result = await checkCookieAuth(c.req.raw, c.env);
  if (!result.ok) return c.json({ error: 'Cookie authentication required' }, 401);
  c.set('session', { matched: result.matched, sessions: result.sessions });
  await next();
  return;
};

// ==================== login_attempts 查询（供 routes/v0/auth.ts 使用） ====================

/** 读取指定 IP 的登录失败记录。 */
export async function getLoginAttempt(db: Db, ip: string): Promise<{ attempts: number; lock_until: number } | null> {
  const row = await db
    .select({ attempts: login_attempts.attempts, lock_until: login_attempts.lock_until })
    .from(login_attempts)
    .where(eq(login_attempts.ip, ip))
    .get();
  return row ?? null;
}

/** 登录成功：清零失败计数（upsert）。 */
export async function resetLoginAttempt(db: Db, ip: string): Promise<void> {
  await db
    .insert(login_attempts)
    .values({ ip, attempts: 0, lock_until: 0 })
    .onConflictDoUpdate({
      target: login_attempts.ip,
      set: { attempts: 0, lock_until: 0 },
    })
    .run();
}

/** 登录失败：累加失败计数，5 次后封禁 15 分钟（upsert）。 */
export async function recordLoginFailure(db: Db, ip: string, lockUntilMs: number): Promise<void> {
  await db
    .insert(login_attempts)
    .values({ ip, attempts: 1, lock_until: 0 })
    .onConflictDoUpdate({
      target: login_attempts.ip,
      set: {
        attempts: sql`attempts + 1`,
        lock_until: sql`CASE WHEN attempts + 1 >= 5 THEN ${lockUntilMs} ELSE 0 END`,
      },
    })
    .run();
}
