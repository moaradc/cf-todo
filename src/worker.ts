/**
 * cf-todo Worker 入口 —— Hono app
 *
 * 阶段 7：feature flag USE_NEW_ROUTER 控制新旧路由切换。
 *
 * 架构：
 *   request → ensureMigrated → 路由匹配
 *     ├ /api/v1/*  → v1App
 *     ├ /api/*     → v0App
 *     ├ /          → staticApp（manifest / sw / SPA fallback）
 *     └ *          → feature flag 检查
 *         ├ USE_NEW_ROUTER !== 'false'（默认）→ 404
 *         └ USE_NEW_ROUTER === 'false'（灰度回滚）→ legacy.handleRequest
 *
 * Feature flag 用法：
 *   wrangler secret put USE_NEW_ROUTER    # 设置为 'false' 回滚到 legacy
 *   wrangler secret delete USE_NEW_ROUTER # 删除，回到默认（新路由）
 */

import { Hono } from 'hono';
import type { Env } from './env';
import { ensureMigrated } from './middleware/init-db';
import legacy from './index.legacy.js';
import { v0App } from './routes/v0';
import { v1App } from './routes/v1';
import { staticApp } from './routes/v0/static';

/** Hono app 类型。 */
export type AppEnv = {
  Bindings: Env & { USE_NEW_ROUTER?: string };
  Variables: {
    session?: import('./middleware/auth').SessionState;
  };
};

/** 主 Hono app。 */
const app = new Hono<AppEnv>();

/**
 * 全局中间件：迁移就绪检查。
 * 第一次请求时查 d1_migrations 表，后续请求零开销。
 * 仅新路由模式需要（legacy 有自己的 initDb）。
 */
app.use('*', async (c, next) => {
  if (c.env.USE_NEW_ROUTER !== 'false') {
    try {
      await ensureMigrated(c.env);
    } catch {
      // ensureMigrated 内部已 console.warn，不阻断请求
    }
  }
  await next();
  return;
});

/**
 * 子路由挂载（必须在 catch-all 之前，Hono 按注册顺序匹配）。
 */
app.route('/api/v1', v1App);
app.route('/api', v0App);
app.route('/', staticApp);

/**
 * Catch-all：未匹配的请求。
 *
 * USE_NEW_ROUTER === 'false' → legacy 紧急回滚（全部走旧 api.js）
 * 其他 → 404 Not Found
 *
 * 注意：legacy 的 V0/V1 路由分支已被删除（阶段 5-6），回滚到 legacy 只有
 * manifest / sw / SPA fallback 可用。V0/V1 API 在 legacy 里返回 404。
 * 这是"紧急回滚"开关——保住前端页面，丢失 API 功能。
 */
app.all('*', async (c) => {
  if (c.env.USE_NEW_ROUTER === 'false') {
    return legacy.fetch(c.req.raw, c.env, c.executionCtx);
  }
  return c.json({ error: 'Not Found' }, 404);
});

/**
 * Worker default export。
 */
export default {
  fetch: app.fetch,
} as const;
