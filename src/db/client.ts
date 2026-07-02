/**
 * cf-todo Drizzle D1 客户端工厂
 *
 * 而不是直接用 env.DB.prepare()。旧 api.js / api-v1.js 仍走 env.DB 直连，
 *
 * 读副本策略（与原代码一致）：
 *   - createDb(env.DB)：写操作 + 强一致读（默认）
 *   - createReadDb(env.DB)：first-primary 语义——第一查询走 primary 保证刚写入
 *     数据可见，后续走 replica。当前 read_replication=false 时退化为 env.DB。
 *   - withSession 是 D1 的 Beta API，用 ?. 防御性调用。
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
 * 当前 read_replication=false 时 withSession 返回 undefined，退化为 d1。
 *
 * 与原 api-v1.js:2210 的逻辑等价：
 *   env.DB.withSession && env.DB.withSession('first-primary') || env.DB
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
