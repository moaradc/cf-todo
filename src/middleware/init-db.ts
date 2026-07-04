/**
 * cf-todo 迁移就绪检查中间件
 *
 * 设计：DB schema 版本与 version.json db_schema 字段绑定。
 *   - 部署时迁移：npm run db:migrate:prod（wrangler d1 migrations apply --remote）
 *   - 本地开发：npm run dev 自动先跑 db:migrate:local（见 package.json）
 *   - 运行时：ensureMigrated 读 settings.db_schema_version，与 version.json 的
 *     DB_SCHEMA 比对。不一致则返回 'missing' / 'mismatch'，由 worker.ts 决定
 *     返回 503 提示运维跑迁移。
 *
 * 单一事实源：version.json db_schema = 期望版本；settings.db_schema_version = 实际版本。
 * baseline 迁移（drizzle/0000_baseline.sql）写入 db_schema_version='1'；
 * 后续迁移（0002+）应在 SQL 里 UPDATE 该行为新版本号，同时 bump version.json。
 */

export type { Env } from '../env';
import type { Env } from '../env';
import { DB_SCHEMA } from '../utils.js';

export type SchemaCheckResult = 'ok' | 'missing' | 'mismatch';

let schemaCheckResult: SchemaCheckResult | null = null;

/**
 * 检查 D1 schema 版本是否与 version.json 一致。
 *
 * 检查 settings.db_schema_version 行。
 * - 'ok' 时缓存结果，同一 isolate 内后续请求直接返回，零开销。
 * - 'missing' / 'mismatch' 时不缓存，每次请求都重新检查，确保修复后能自动恢复。
 *
 * 返回值：
 *   - 'ok'      → schema 版本匹配，可正常服务
 *   - 'missing' → settings 表缺失或 db_schema_version 行不存在（未跑迁移，或被 CLEAR_ALL_DATA 误删）
 *   - 'mismatch' → db_schema_version 与 version.json DB_SCHEMA 不一致（迁移版本落后/超前）
 */
export async function ensureMigrated(env: Env): Promise<SchemaCheckResult> {
  // 只缓存 'ok' 状态；'missing' / 'mismatch' 每次重新检查，确保修复后能自动恢复
  if (schemaCheckResult === 'ok') return schemaCheckResult;

  try {
    const row = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'db_schema_version'"
    ).first<{ value: string }>();

    if (!row || !row.value) {
      return 'missing';
    }

    const dbVersion = parseInt(row.value, 10);
    if (isNaN(dbVersion) || dbVersion !== DB_SCHEMA) {
      return 'mismatch';
    }

    schemaCheckResult = 'ok';
    return schemaCheckResult;
  } catch {
    // settings 表不存在或其他异常 → 未初始化
    return 'missing';
  }
}
