import { Hono } from 'hono';
import type { Env } from '../../env';
import type { AuthVariables } from '../../middleware/auth';
import { v1Auth } from '../../middleware/auth';
import { keysApp } from './keys';
import { v1SimpleApp } from './simple';
import { v1TodosApp } from './todos';

export type V1AppEnv = {
  Bindings: Env;
  Variables: AuthVariables;
};

export const v1App = new Hono<V1AppEnv>();

// keys 路由：cookie-only 鉴权（cookieAuth 已在 keys.ts 内 .all('/keys') 之前注册，
// 必须在路由处理器之前注册否则会被 Hono 路由匹配绕过）
v1App.route('/', keysApp);

// 其他 V1 路由：API Key 优先，回退 cookie
v1App.use('*', v1Auth);

v1App.route('/', v1TodosApp);
v1App.route('/', v1SimpleApp);
