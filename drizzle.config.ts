import { defineConfig } from 'drizzle-kit';

/**
 * cf-todo Drizzle 迁移配置
 *
 * - dialect: sqlite（D1 是 SQLite 兼容）
 * - driver: d1-http（drizzle-kit 0.30+ 对 Cloudflare D1 的支持）
 * - schema: ./src/db/schema.ts（与 initDb 字节对齐）
 * - out: ./drizzle（迁移文件目录，wrangler d1 migrations apply 会读取）
 *
 * 生成：npm run db:generate
 * 应用本地：npm run db:migrate:local  → wrangler d1 migrations apply todo-db --local
 * 应用远端：npm run db:migrate:prod   → wrangler d1 migrations apply todo-db --remote
 *
 * 注意：drizzle-orm/d1/migrator 运行时迁移走 __drizzle_migrations 表，
 * 与 wrangler d1 migrations apply 的 d1_migrations 表是两套机制。
 * 本项目阶段 3 起用 wrangler d1 migrations apply 部署，运行时不跑 migrator。
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1-http',
});
