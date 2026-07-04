/**
 * cf-todo Worker 入口 —— 纯 Hono app（1.0 纯净状态）
 *
 * 架构：
 *   request → 迁移就绪检查 → 路由匹配
 *     ├ /api/v1/*  → v1App（V1 RESTful API）
 *     ├ /api/*     → v0App（V0 Web API）
 *     ├ /          → staticApp（manifest / sw / SPA fallback）
 *     └ *          → 404
 *
 * 技术栈：TypeScript + Hono + Drizzle ORM
 */

import { Hono } from 'hono';
import type { Env } from './env';
import { ensureMigrated } from './middleware/init-db';
import type { SchemaCheckResult } from './middleware/init-db';
import { DB_SCHEMA } from './utils.js';
import { v0App } from './routes/v0';
import { v1App } from './routes/v1';
import { staticApp } from './routes/v0/static';

/** Hono app 类型。 */
export type AppEnv = {
  Bindings: Env;
  Variables: {
    session?: import('./middleware/auth').SessionState;
  };
};

/** 主 Hono app。 */
const app = new Hono<AppEnv>();

/**
 * 全局中间件：DB schema 版本校验。
 *
 * ensureMigrated 读 settings.db_schema_version 与 version.json DB_SCHEMA 比对：
 *   - 'ok'      → 正常服务
 *   - 'missing' → 503 提示跑迁移
 *   - 'mismatch' → 503 提示版本不一致（迁移落后或超前）
 */
let cachedSchemaState: SchemaCheckResult | null = null;
app.use('*', async (c, next) => {
  if (cachedSchemaState === 'ok') {
    await next();
    return;
  }
  let state: SchemaCheckResult;
  try {
    state = await ensureMigrated(c.env);
  } catch {
    state = 'missing';
  }
  cachedSchemaState = state;

  if (state !== 'ok') {
    const hint = state === 'mismatch'
      ? `Database schema mismatch: version.json expects db_schema=${DB_SCHEMA}. Run \`wrangler d1 migrations apply todo-db --remote\` to update.`
      : 'Database not initialized. Run `wrangler d1 migrations apply todo-db --remote` first.';
    console.error(`[cf-todo] schema check: ${state} (expected db_schema=${DB_SCHEMA})`);
    return c.html(
      `<html><body><h1>Database schema ${state === 'mismatch' ? 'mismatch' : 'not initialized'}</h1><p>${hint}</p></body></html>`,
      503,
    );
  }
  await next();
  return;
});

/**
 * 子路由挂载（Hono 按注册顺序匹配）。
 */
app.route('/api/v1', v1App);
app.route('/api', v0App);
app.route('/', staticApp);

/**
 * Catch-all：未匹配的请求返回 404。
 */
app.all('*', (c) => c.json({ error: 'Not Found' }, 404));

/**
 * Worker default export。
 */
export default {
  fetch: app.fetch,
} as const;
