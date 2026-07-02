/**
 * V1 路由 Hono app（/api/v1/*）
 *
 *
 * 鉴权策略：
 *   - /api/v1/keys：cookie-only（不走 API Key 中间件）
 *   - 其他 /api/v1/*：API Key 优先，回退 cookie（v1Auth）
 *
 * 挂载顺序（worker.ts）：
 *   app.route('/api/v1', v1App);  // V1 优先匹配，必须在 v0App 之前
 */

import { Hono } from 'hono';
import type { Env } from '../../env';
import type { AuthVariables } from '../../middleware/auth';
import { keysApp } from './keys';
import { v1SimpleApp } from './simple';
import { v1TodosApp } from './todos';

/** V1 路由的 Hono app 类型。 */
export type V1AppEnv = {
  Bindings: Env;
  Variables: AuthVariables;
};

/** V1 Hono app。全部 V1 路由已迁移。 */
export const v1App = new Hono<V1AppEnv>();

v1App.route('/', keysApp);
v1App.route('/', v1TodosApp);
v1App.route('/', v1SimpleApp);
