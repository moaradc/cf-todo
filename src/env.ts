/**
 * cf-todo Cloudflare Workers 环境类型
 *
 * 所有中间件 / 路由 / 服务共用此类型。
 * 来自 wrangler.toml 的 [[d1_databases]] binding + [[durable_objects.bindings]] + Workers Secrets。
 *
 * 注意：REMINDER_DO 使用 `DurableObjectNamespace<ReminderDO>` 泛型，
 * 让 RPC 调用（如 stub.scheduleEvent(...)）享有端到端类型推断。
 * ReminderDO 类避免循环依赖，使用 type-only import。
 */

import type { ReminderDO } from './do/reminder-do';

export interface Env {
  /** D1 数据库绑定（wrangler.toml 中 binding = "DB"）。 */
  DB: D1Database;
  /** HMAC 签名密钥，用于 cookie + API Key 校验。 */
  JWT_SECRET: string;
  /** 管理员登录密码。 */
  ADMIN_PASSWORD: string;
  /** Resend 邮件 API Key（Workers Secret），用于定时提醒发信。 */
  RESEND_API_KEY: string;
  /** 精确提醒 Durable Object（单实例 id='reminder'）。 */
  REMINDER_DO: DurableObjectNamespace<ReminderDO>;
}
