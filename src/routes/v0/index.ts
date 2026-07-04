import { Hono } from 'hono';
import type { Env } from '../../env';
import type { AuthVariables } from '../../middleware/auth';
import { v0Auth } from '../../middleware/auth';
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

export type V0AppEnv = {
  Bindings: Env;
  Variables: AuthVariables;
};

export const v0App = new Hono<V0AppEnv>();

// 公开路由（不鉴权）
v0App.route('/', authApp);
v0App.route('/', hotSearchApp);

// 需鉴权路由：API Key 优先（与 wiki 一致），无 API Key 回退到 Cookie
const authedApp = new Hono<V0AppEnv>();
authedApp.use('*', v0Auth);
authedApp.route('/', categoriesApp);
authedApp.route('/', trashApp);
authedApp.route('/', settingsApp);
authedApp.route('/', statsApp);
authedApp.route('/', timeRecordsApp);
authedApp.route('/', todoActionApp);
authedApp.route('/', todosGetApp);
authedApp.route('/', ioApp);
v0App.route('/', authedApp);
