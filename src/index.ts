/**
 * cf-todo Worker 入口 —— 阶段 3 起：从 worker.ts 导出 Hono app
 *
 * 阶段 1：纯透传 legacy default export
 * 阶段 2：加 ensureMigrated 诊断
 * 阶段 3：切换到 Hono app（src/worker.ts），所有业务路由仍走 legacy
 * 阶段 8：删除 index.legacy.js，worker.ts 成为唯一入口
 */

export { default } from './worker';
