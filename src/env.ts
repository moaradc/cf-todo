/**
 * cf-todo Cloudflare Workers 环境类型
 *
 * 阶段 3 起，所有中间件 / 路由 / 服务共用此类型。
 * 来自 wrangler.toml 的 [[d1_databases]] binding + .dev.vars / Workers Secrets。
 */

export interface Env {
  /** D1 数据库绑定（wrangler.toml 中 binding = "DB"）。 */
  DB: D1Database;
  /** HMAC 签名密钥，用于 cookie + API Key 校验。来自 .dev.vars / Workers Secrets。 */
  JWT_SECRET: string;
  /** 管理员登录密码。来自 .dev.vars / Workers Secrets。 */
  ADMIN_PASSWORD: string;
}
