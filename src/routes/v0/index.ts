/**
 * V0 路由 Hono app（/api/* 非 v1）
 *
 * 阶段 4 起，V0 业务路由逐步从 api.js 搬到这里。
 * 当前阶段（4.1）：仅骨架，具体路由在 4.2-4.4 添加。
 *
 * 鉴权策略：
 *   - 公开路由（/api/login, /api/logout, /api/hot-search）：不加中间件
 *   - 需鉴权路由：v0Auth（API Key 优先，回退 cookie）
 *
 * 挂载顺序（worker.ts）：
 *   app.route('/api/v1', v1App);  // V1 优先匹配
 *   app.route('/api', v0App);     // V0 兜底
 */

import { Hono } from 'hono';
import type { Env } from '../../env';
import type { AuthVariables } from '../../middleware/auth';
import { authApp } from './auth';
import { hotSearchApp } from './hot-search';

/** V0 路由的 Hono app 类型。 */
export type V0AppEnv = {
  Bindings: Env;
  Variables: AuthVariables;
};

/**
 * V0 Hono app。
 *
 * 挂载子路由：
 *   - authApp：/api/login / /api/logout / /api/sessions / /api/session-action
 *   - hotSearchApp：/api/hot-search（公开路由）
 *
 * 未匹配的请求 fall through 到 worker.ts 的 catch-all → legacy。
 */
export const v0App = new Hono<V0AppEnv>();
v0App.route('/', authApp);
v0App.route('/', hotSearchApp);
