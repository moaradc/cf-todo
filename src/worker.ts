/**
 * cf-todo Worker 入口 —— Hono app
 *
 * 阶段 4：Hono 路由树成型，首批简单路由切到 Hono。
 *
 * 当前架构（阶段 4 完成态）：
 *   request → ensureMigrated → 路由匹配
 *     ├ /api/v1/*  → v1App（阶段 6 填充）
 *     ├ /api/*     → v0App（阶段 4.2-4.4 填充：static / auth / hot-search）
 *     ├ /          → staticApp（manifest / sw / SPA fallback）← 阶段 4.2
 *     └ *          → legacy.handleRequest（未迁移的业务路由）
 *
 * 挂载顺序至关重要：
 *   1. /api/v1 必须在 /api 之前（否则 V1 路由被 /api/* 吞掉）
 *   2. 具体路由必须在 catch-all 之前（否则被 catch-all 吞掉）
 *
 * 阶段 8：删除 index.legacy.js + catch-all，Hono app 成为唯一入口。
 */

import { Hono } from 'hono';
import type { Env } from './env';
import { ensureMigrated } from './middleware/init-db';
import legacy from './index.legacy.js';
import { v0App } from './routes/v0';
import { v1App } from './routes/v1';
import { staticApp } from './routes/v0/static';

/** Hono app 类型（Bindings=Env，Variables 含 session）。 */
export type AppEnv = {
  Bindings: Env;
  Variables: {
    // session 由 cookieAuth / v0Auth / v1Auth 中间件挂载（阶段 4+ 生效）
    session?: import('./middleware/auth').SessionState;
  };
};

/** 主 Hono app。 */
const app = new Hono<AppEnv>();

/**
 * 全局中间件：迁移就绪检查。
 * 第一次请求时查 d1_migrations 表，后续请求零开销（migrationChecked 短路）。
 */
app.use('*', async (c, next) => {
  try {
    await ensureMigrated(c.env);
  } catch {
    // ensureMigrated 内部已 console.warn，不阻断请求
  }
  await next();
  return;
});

/**
 * 挂载子路由。
 *
 * 顺序约束（Hono 按注册顺序匹配）：
 *   1. /api/v1/* → v1App（V1 优先，避免被 /api/* 吞掉）
 *   2. /api/*    → v0App（V0 业务路由：auth / hot-search 等，4.3-4.4 添加）
 *   3. /         → staticApp（manifest / sw / SPA fallback，4.2 添加）
 *   4. *         → legacy（未迁移的路由 fall through）
 *
 * staticApp 挂在根路径，注册了 /manifest.json / /sw.js / /*（SPA）。
 * staticApp 的 /* 会捕获所有非 /api、非含 . 的 GET 请求。
 * 未匹配的（如 /api/todo-action）fall through 到 catch-all → legacy。
 */
app.route('/api/v1', v1App);
app.route('/api', v0App);
app.route('/', staticApp);

/**
 * Catch-all：未匹配的请求转发给 legacy handleRequest。
 *
 * legacy 的 default export 是 { fetch: handleRequest }（见 index.legacy.js）。
 * 阶段 4+ 随着路由迁移，catch-all 覆盖的路径越来越少。
 * 阶段 8 删除 legacy + catch-all。
 */
app.all('*', async (c) => {
  const response = await legacy.fetch(c.req.raw, c.env, c.executionCtx);
  return response;
});

/**
 * Worker default export。
 * Cloudflare Workers 要求 { fetch } 接口。
 */
export default {
  fetch: app.fetch,
} as const;
