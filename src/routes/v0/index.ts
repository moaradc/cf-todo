import { Hono } from 'hono';
import type { Env } from '../../env';
import type { AuthVariables } from '../../middleware/auth';
import { authApp } from './auth';
import { hotSearchApp } from './hot-search';
import { categoriesApp } from './categories';

/** V0 路由的 Hono app 类型。 */
export type V0AppEnv = {
  Bindings: Env;
  Variables: AuthVariables;
};

/**
 * V0 Hono app。
 *
 * 子路由通过 route('/', subApp) 挂载。Hono 会按注册顺序匹配。
 */
export const v0App = new Hono<V0AppEnv>();
v0App.route('/', authApp);
v0App.route('/', hotSearchApp);
v0App.route('/', categoriesApp);
