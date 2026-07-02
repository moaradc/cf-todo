import { Hono } from 'hono';
import type { Env } from '../../env';
import type { AuthVariables } from '../../middleware/auth';
import { authApp } from './auth';
import { hotSearchApp } from './hot-search';
import { categoriesApp } from './categories';
import { trashApp } from './trash';
import { settingsApp } from './settings';
import { statsApp } from './stats';
import { timeRecordsApp } from './time-records';
import { todoActionApp } from './todo-action';
import { todosGetApp } from './todos';
import { ioApp } from './io';

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
v0App.route('/', settingsApp);
v0App.route('/', statsApp);
v0App.route('/', timeRecordsApp);
v0App.route('/', todoActionApp);
v0App.route('/', todosGetApp);
v0App.route('/', ioApp);
