/**
 * cf-todo Worker 入口 —— 纯 Hono app + DO Alarm 精确提醒
 *
 * 架构：
 *   request → 迁移就绪检查 → 路由匹配
 *     ├ /api/v1/*  → v1App（V1 RESTful API）
 *     ├ /api/*     → v0App（V0 Web API，含 /api/reminder/precise/* DO 调度路由）
 *     ├ /          → staticApp（manifest / sw / SPA fallback）
 *     └ *          → 404
 *
 * Cron digest（每 4 小时）与 DO Alarm 精确提醒（单条到点）并行独立运行。
 *
 * 技术栈：TypeScript + Hono + Drizzle ORM + Durable Objects
 */

import { Hono } from 'hono';
import type { Env } from './env';
import { ensureMigrated } from './middleware/init-db';
import type { SchemaCheckResult } from './middleware/init-db';
import { DB_SCHEMA } from './utils.js';
import { v0App } from './routes/v0';
import { v1App } from './routes/v1';
import { staticApp } from './routes/v0/static';
import { runScheduledReminders } from './services/reminder-service';
import { ReminderDO } from './do/reminder-do';

/**
 * Durable Object 类必须从 Worker 入口 re-export，CF 平台才能实例化。
 * wrangler.toml 中 [[durable_objects.bindings]] class_name = "ReminderDO" 引用此类。
 *
 * 注意：esbuild 会 tree-shake 未使用的 class 导出。这里通过 globalThis 赋值的
 * side-effect 强制保留 ReminderDO 在 bundle 中，确保 `export { ReminderDO }` 生效。
 */
;(globalThis as unknown as { __ReminderDO?: unknown }).__ReminderDO = ReminderDO;
export { ReminderDO };

/** Hono app 类型。 */
export type AppEnv = {
  Bindings: Env;
  Variables: {
    session?: import('./middleware/auth').SessionState;
  };
};

/** 主 Hono app。 */
const app = new Hono<AppEnv>();

/**
 * 全局中间件：DB schema 版本校验。
 *
 * ensureMigrated 读 settings.db_schema_version 与 version.json DB_SCHEMA 比对：
 *   - 'ok'      → 正常服务
 *   - 'missing' → 503 提示跑迁移
 *   - 'mismatch' → 503 提示版本不一致（迁移落后或超前）
 */
let cachedSchemaState: SchemaCheckResult | null = null;
app.use('*', async (c, next) => {
  if (cachedSchemaState === 'ok') {
    await next();
    return;
  }
  let state: SchemaCheckResult;
  try {
    state = await ensureMigrated(c.env);
  } catch {
    state = 'missing';
  }
  cachedSchemaState = state;

  if (state !== 'ok') {
    const hint = state === 'mismatch'
      ? `Database schema mismatch: version.json expects db_schema=${DB_SCHEMA}. Run \`wrangler d1 migrations apply todo-db --remote\` to update.`
      : 'Database not initialized. Run `wrangler d1 migrations apply todo-db --remote` first.';
    console.error(`[cf-todo] schema check: ${state} (expected db_schema=${DB_SCHEMA})`);
    return c.html(
      `<html><body><h1>Database schema ${state === 'mismatch' ? 'mismatch' : 'not initialized'}</h1><p>${hint}</p></body></html>`,
      503,
    );
  }
  await next();
  return;
});

/**
 * 子路由挂载（Hono 按注册顺序匹配）。
 */
app.route('/api/v1', v1App);
app.route('/api', v0App);
app.route('/', staticApp);

/**
 * Catch-all：未匹配的请求返回 404。
 */
app.all('*', (c) => c.json({ error: 'Not Found' }, 404));

/**
 * Worker default export。
 *
 * fetch：HTTP 请求入口（Hono app）。
 * scheduled：Cron 触发器入口，执行定时提醒扫描。Cron 表达式在 wrangler.toml
 *   [triggers] crons 中配置。即使 schema 未就绪也安全降级（仅记录日志）。
 */
export default {
  fetch: app.fetch,
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(handleScheduled(env));
  },
} as const;

/**
 * Cron 实际执行体。单独抽出便于 waitUntil 异步执行 + 单元测试。
 *
 * 容错策略：任何异常都吞掉并记录，避免 Cron 失败导致 Worker 整体崩溃。
 * Cloudflare 控制台可在「Workers → Triggers → Cron Events」查看调度历史。
 */
async function handleScheduled(env: Env): Promise<void> {
  let schemaState: SchemaCheckResult;
  try {
    schemaState = await ensureMigrated(env);
  } catch {
    schemaState = 'missing';
  }
  if (schemaState !== 'ok') {
    console.error(`[cf-todo][cron] skip: schema state=${schemaState} (expected db_schema=${DB_SCHEMA})`);
    return;
  }

  try {
    const result = await runScheduledReminders(env);
    // 精简日志：只记录 skip/sent/failed + 各模式 summary，不打印完整 sections（避免日志膨胀）
    const modesLog = result.modes.map((m) => `${m.mode}:${m.enabled ? 'on' : 'off'}:${m.summary || m.reason || '-'}`).join(' ');
    console.log(`[cf-todo][cron] reminder run: skipped=${result.skipped} sent=${result.sent} failed=${result.failed} | ${modesLog}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cf-todo][cron] reminder run failed:', msg);
  }

  // 顺便清理 DO 中的死事件（runAt 已过期但仍在 storage）。
  // 死事件来源：alarm() 失败 6 次后停止重试、手动测试残留等。
  // 每 4 小时清理一次，开销极小（一次 storage.list + delete）。
  // 失败不影响 digest 主流程。
  try {
    const id = env.REMINDER_DO.idFromName('reminder');
    const stub = env.REMINDER_DO.get(id);
    const cleanup = await stub.clearPast();
    if (cleanup.cleared > 0) {
      console.log(`[cf-todo][cron] DO clearPast: cleared=${cleanup.cleared} remaining=${cleanup.remaining}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cf-todo][cron] DO clearPast failed:', msg);
  }
}
