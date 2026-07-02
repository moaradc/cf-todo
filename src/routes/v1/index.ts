/**
 * V1 路由 Hono app（/api/v1/*）
 *
 * 阶段 6 起，V1 业务路由从 api-v1.js 搬到这里。
 * 当前阶段（4.1）：仅骨架。
 *
 * 鉴权策略：v1Auth（API Key 优先，回退 cookie）
 *
 * 挂载顺序（worker.ts）：
 *   app.route('/api/v1', v1App);  // V1 优先匹配，必须在 v0App 之前
 */

import { Hono } from 'hono';
import type { Env } from '../../env';
import type { AuthVariables } from '../../middleware/auth';

/** V1 路由的 Hono app 类型。 */
export type V1AppEnv = {
  Bindings: Env;
  Variables: AuthVariables;
};

/** V1 Hono app。具体路由在阶段 6 添加。 */
export const v1App = new Hono<V1AppEnv>();
