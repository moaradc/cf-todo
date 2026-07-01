/**
 * cf-todo Worker 入口 —— 阶段 2 起：迁移就绪检查 + legacy 透传
 *
 * 阶段 1：纯透传 legacy default export。
 * 阶段 2：转发前调用 ensureMigrated 做一次性诊断检查。
 * 阶段 3：引入 Hono app，开始替换 legacy 路由。
 * 阶段 8：删除 index.legacy.js，本文件成为唯一入口。
 */

import legacy from './index.legacy.js';
import { ensureMigrated, type Env } from './middleware/init-db';

export interface FetchHandler {
  fetch(
    request: Request,
    env: unknown,
    ctx: unknown
  ): Promise<Response> | Response;
}

/**
 * 包装 legacy fetch handler，在第一次请求时跑迁移检查。
 * 检查失败不阻断请求（见 init-db.ts 注释）。
 */
async function handleFetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
  // env 在 Workers 运行时实际类型是 Env，但 legacy 用 any 处理。
  // 这里做一次窄化检查：只跑 ensureMigrated，不阻断。
  try {
    await ensureMigrated(env as Env);
  } catch {
    // ensureMigrated 内部已 console.warn，这里不重复报错。
    // 让请求继续转发给 legacy，由 legacy 的 SQL 错误自然暴露问题。
  }
  return (legacy as FetchHandler).fetch(request, env as Env, ctx);
}

const worker: FetchHandler = { fetch: handleFetch };
export default worker;
