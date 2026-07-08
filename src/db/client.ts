/**
 * cf-todo Drizzle D1 客户端工厂
 *
 * 读副本策略（参考 Cloudflare D1 Sessions API 官方文档）：
 *   - createDb(env.DB)：写操作 + 强一致读（默认）
 *   - createReadDb(env.DB)：first-primary 语义——第一查询走 primary 保证刚写入
 *     数据可见，后续走就近副本降低延迟、分摊主库压力。
 *
 * 关于 read_replication 配置：
 *   - 副本是否实际存在由 CF Dashboard（或 REST API）控制，wrangler.toml 的
 *     read_replication 只是声明"代码准备好用读副本"，本身不创建副本。
 *   - 官方明确："Sessions API works with databases that do not have read
 *     replication enabled, so it is safe to run code with Sessions API even
 *     after disabling read replication."
 *     即：代码可以永远开着 withSession，副本开关交给 Dashboard，无需环境变量桥接。
 *   - 未启用读副本时，withSession 返回的 session 仍可用，D1 会把查询路由到主库，
 *     行为与 createDb 一致，零风险。
 *   - 本项目 wrangler.toml 的 read_replication=false（对中国用户无优化），
 *     未来在 Dashboard 开副本 + 改 true 即可生效，代码零改动。
 *
 *   - withSession 是 D1 Beta API，用 ?. 防御性调用以兼容旧版运行时。
 */

import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

/** Drizzle 客户端类型（含 schema 绑定，支持 db.todos / db.categories 等查询）。 */
export type Db = DrizzleD1Database<typeof schema>;

/**
 * 创建主库 Drizzle 客户端（写 + 强一致读）。
 * 用于：所有写操作 / 需要刚写入数据立即可见的读。
 */
export function createDb(d1: D1Database): Db {
  return drizzle(d1, { schema });
}

/**
 * 创建读副本 Drizzle 客户端（first-primary 语义）。
 * 第一查询走 primary 保证刚写入的数据可见，后续走 replica。
 *
 * 未启用读副本时：withSession 仍返回 session 对象，D1 将查询路由到主库，
 * 行为与 createDb 一致（官方明确此场景安全，无需在代码层判断开关）。
 *
 * 类型说明：
 *   withSession 返回 D1DatabaseSession（不含 exec/dump/withSession），
 *   但 Drizzle 的 drizzle() 只用 prepare/batch/dump 等基础方法，
 *   D1DatabaseSession 完全兼容。这里用 as 断言绕过类型差异。
 */
export function createReadDb(d1: D1Database): Db {
  // withSession 是 D1 Beta API，运行时可能不存在（旧版 wrangler/workerd）。
  // 用可选链 + 短路兜底，保证退化时仍可用。
  const replica = d1.withSession?.('first-primary') ?? d1;
  // D1DatabaseSession 是 D1Database 的子集（缺 exec/dump/withSession），
  // 但 Drizzle 只用 prepare/bind/run/all/first 等基础方法，子集完全兼容。
  // 双重断言绕过 TS 结构类型检查（运行时安全）。
  return drizzle(replica as unknown as D1Database, { schema });
}
