/**
 * V1 路由 Hono app（/api/v1/*）
 *
 * 阶段 6：V1 业务路由从 api-v1.js 搬到这里。
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

/** V1 路由的 Hono app 类型。 */
export type V1AppEnv = {
  Bindings: Env;
  Variables: AuthVariables;
};

/** V1 Hono app。 */
export const v1App = new Hono<V1AppEnv>();

// keys 路由（cookie-only，内部自行鉴权）
v1App.route('/', keysApp);

// 其他 V1 路由在后续 commit 添加（todos / categories / trash / stats / settings / custom-*）
// 未匹配的 V1 请求 fall through 到 worker.ts catch-all → legacy.handleV1Request
