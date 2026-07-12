import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export type Db = DrizzleD1Database<typeof schema>;

/** 主库客户端（写 + 强一致读）。 */
export function createDb(d1: D1Database): Db {
  return drizzle(d1, { schema });
}

/**
 * 读副本客户端（first-primary：第一查询走主库，后续走副本）。
 * 未启用读副本时 withSession 退化为 d1，行为与 createDb 一致。
 */
export function createReadDb(d1: D1Database): Db {
  const replica = d1.withSession?.('first-primary') ?? d1;
  return drizzle(replica as unknown as D1Database, { schema });
}
