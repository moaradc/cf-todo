/**
 * cf-todo 迁移就绪检查中间件
 *
 * 设计变更说明（相对原计划）：
 *   原计划用 drizzle-orm/d1/migrator 在运行时跑迁移。实测发现该模块
 *   依赖 Node.js fs 读 migrationsFolder，Cloudflare Workers 运行时无 fs，
 *   直接调用会崩。因此本文件改为「诊断模式」：
 *
 *   - 部署时迁移：npm run db:migrate:prod（wrangler d1 migrations apply --remote）
 *   - 本地开发：npm run dev 自动先跑 db:migrate:local（见 package.json）
 *   - 运行时：ensureMigrated 只做一次性轻量检查——查 d1_migrations 表是否存在。
 *     如果不存在，console.warn 提醒开发者/运维「请先跑迁移」，但不阻断请求
 *     （让后续 SQL 错误自然暴露，错误信息更明确）。
 *
 *   旧 src/api.js 的 initDb() 函数保留为 dead code，通过 isDbInitialized=true
 *   让其 short-circuit（见 src/api.js 第 45 行）。阶段 8 删除 initDb 与本检查。
 *
 * Env 类型定义：
 *   阶段 3 起所有中间件/路由共用此类型。当前只声明 DB / JWT_SECRET / ADMIN_PASSWORD，
 *   后续阶段按需扩展（如自定义环境变量）。
 */

/** Cloudflare Workers 环境变量绑定。 */
export interface Env {
  /** D1 数据库绑定（wrangler.toml 中 binding = "DB"）。 */
  DB: D1Database;
  /** HMAC 签名密钥，用于 cookie + API Key 校验。来自 .dev.vars / Workers Secrets。 */
  JWT_SECRET: string;
  /** 管理员登录密码。来自 .dev.vars / Workers Secrets。 */
  ADMIN_PASSWORD: string;
}

let migrationChecked = false;

/**
 * 检查 D1 是否已应用迁移。
 *
 * 一次性检查 d1_migrations 表是否存在。检查通过后标记 migrationChecked=true，
 * 同一 isolate 内后续请求直接跳过，零开销。
 *
 * 行为：
 *   - 表存在 + 有记录 → 静默通过
 *   - 表不存在 → console.warn 提醒，但不抛错（让请求继续，SQL 错误更明确）
 *   - 任何异常 → 静默吞掉（不阻断业务请求；迁移问题应在部署时被发现）
 */
export async function ensureMigrated(env: Env): Promise<void> {
  if (migrationChecked) return;
  migrationChecked = true;

  try {
    // 查 d1_migrations 表是否存在且有记录。
    // 不读具体内容，只确认表就绪——最小开销。
    const result = await env.DB.prepare(
      "SELECT count(*) as n FROM d1_migrations"
    ).first<{ n: number }>();
    if (!result || result.n === 0) {
      console.warn(
        "[cf-todo] d1_migrations 表为空或不存在。请先跑 `npm run db:migrate:local`（本地）" +
        "或 `npm run db:migrate:prod`（远端）应用迁移。"
      );
    }
  } catch (e) {
    // 表不存在的错误会落到这里——同样是 warn 不阻断
    console.warn(
      "[cf-todo] 迁移检查失败（d1_migrations 表可能不存在）：" +
      (e instanceof Error ? e.message : String(e)) +
      "。请先跑 `npm run db:migrate:local` 或 `npm run db:migrate:prod`。"
    );
  }
}
