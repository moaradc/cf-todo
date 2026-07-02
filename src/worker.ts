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
 * 全局中间件：迁移就绪检查 + D1 表存在性探测。
 */
let migrationFailed = false;
app.use('*', async (c, next) => {
  if (migrationFailed) {
    return c.html(
      '<html><body><h1>Database not initialized</h1><p>Run <code>wrangler d1 migrations apply todo-db --remote</code> first.</p></body></html>',
      503,
    );
  }
  try {
    await ensureMigrated(c.env);
  } catch {
    // ensureMigrated 内部已 console.warn
  }
  try {
    await c.env.DB.prepare('SELECT 1 FROM settings LIMIT 1').first();
  } catch {
    migrationFailed = true;
    console.error('[cf-todo] D1 tables missing — run: wrangler d1 migrations apply todo-db --remote');
    return c.html(
      '<html><body><h1>Database not initialized</h1><p>Run <code>wrangler d1 migrations apply todo-db --remote</code> first.</p></body></html>',
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
