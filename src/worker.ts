/**
 * cf-todo Worker 入口 —— Hono app 骨架
 *
 * 阶段 3 / Commit 3.5：引入 Hono app，但所有业务路由仍走旧 handleRequest。
 *
 * 当前架构（阶段 3 完成态）：
 *   request → ensureMigrated → Hono app → all('*') → legacy.handleRequest
 *
 * 阶段 4+ 演进：
 *   - 阶段 4：在 Hono app 加 V0 静态路由（/ / manifest.json / sw.js）
 *   - 阶段 5：V0 业务路由迁移，逐步替换 legacy
 *   - 阶段 6：V1 业务路由迁移
 *   - 阶段 8：删除 index.legacy.js，Hono app 成为唯一入口
 *
 * 中间件预热（已就位但未生效）：
 *   - src/middleware/init-db.ts ensureMigrated（已生效，诊断检查）
 *   - src/middleware/auth.ts cookieAuth / apiKeyAuth / v0Auth / v1Auth（阶段 4+ 用）
 *   - src/middleware/per-date-lock.ts withTodosDateLock（阶段 5/6 用）
 *   - src/db/client.ts createDb / createReadDb（阶段 5/6 用）
 */

import { Hono } from 'hono';
import type { Env } from './env';
import { ensureMigrated } from './middleware/init-db';
import legacy from './index.legacy.js';

/** Hono app 类型（Bindings=Env，Variables 含 session）。 */
export type AppEnv = {
  Bindings: Env;
  Variables: {
    // session 由 cookieAuth / v0Auth / v1Auth 中间件挂载（阶段 4+ 生效）
    session?: import('./middleware/auth').SessionState;
  };
};

/**
 * Hono app 实例。
 *
 * 当前阶段：只有一个 catch-all 路由，把所有请求转发给 legacy handleRequest。
 * 阶段 4+ 会在此 app 上注册具体路由，逐步替换 legacy。
 */
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
 * Catch-all：所有请求转发给 legacy handleRequest。
 *
 * legacy 的 default export 是 { fetch: handleRequest }（见 index.legacy.js）。
 * 阶段 4+ 会在此 catch-all 之前注册具体路由，匹配到的走新路由，
 * 未匹配的 fall through 到 legacy。
 */
app.all('*', async (c) => {
  // legacy.fetch 等价于原 handleRequest(request, env, ctx)
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
