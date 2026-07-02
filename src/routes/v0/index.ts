import { Hono } from 'hono';
import type { Env } from '../../env';
import type { AuthVariables } from '../../middleware/auth';
import { authApp } from './auth';
import { hotSearchApp } from './hot-search';
import { categoriesApp } from './categories';
import { trashApp } from './trash';

/** V0 路由的 Hono app 类型。 */
export type V0AppEnv = {
  Bindings: Env;
  Variables: AuthVariables;
};

export const v0App = new Hono<V0AppEnv>();
v0App.route('/', authApp);
v0App.route('/', hotSearchApp);
v0App.route('/', categoriesApp);
v0App.route('/', trashApp);
