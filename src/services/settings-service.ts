/**
 * Settings Service —— V0 settings / custom-code / custom-* 业务逻辑
 *
 * 阶段 5.3：从 api.js 搬迁，用 Drizzle 替换 env.DB.prepare()。
 *
 * 搬迁来源：
 *   - GET  /api/settings        ← api.js:1947-1954
 *   - POST /api/settings        ← api.js:1956-1962
 *   - GET  /api/custom-code     ← api.js:824-831
 *   - POST /api/custom-code     ← api.js:833-850
 *   - GET  /api/custom-colors   ← api.js:1964-1971
 *   - POST /api/custom-colors   ← api.js:1983-1992
 *   - GET  /api/custom-header   ← api.js:1973-1976
 *   - GET  /api/custom-content  ← api.js:1978-1981
 *
 * 审计 §3f：V0 用 camelCase customColors 作为 settings key，必须保留。
 * 所有 settings 值存 D1 settings 表（key-value），JSON 字符串序列化。
 */

import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { settings } from '../db/schema';

/**
 * 读取单个 settings 值（JSON 解析）。
 * @param key settings key
 * @param fallback 解析失败时的默认值
 */
export async function getSettingJson<T>(db: Db, key: string, fallback: T): Promise<T> {
  const record = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .get() as { value: string } | undefined;
  if (!record || !record.value) return fallback;
  try {
    return JSON.parse(record.value) as T;
  } catch {
    return fallback;
  }
}

/**
 * 读取单个 settings 值（原始字符串，不解析）。
 */
export async function getSettingRaw(db: Db, key: string): Promise<string> {
  const record = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .get() as { value: string } | undefined;
  return record?.value || '';
}

/**
 * 写入单个 settings 值（JSON 序列化）。
 */
export async function setSettingJson(db: Db, key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value: JSON.stringify(value) })
    .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(value) } })
    .run();
}

/**
 * 写入单个 settings 值（原始字符串）。
 */
export async function setSettingRaw(db: Db, key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

// ==================== app_settings ====================

/** GET /api/settings：返回 app_settings JSON 对象。 */
export async function getAppSettings(db: Db): Promise<Record<string, unknown>> {
  return getSettingJson(db, 'app_settings', {} as Record<string, unknown>);
}

/** POST /api/settings：写入 app_settings。 */
export async function setAppSettings(db: Db, data: Record<string, unknown>): Promise<void> {
  await setSettingJson(db, 'app_settings', data);
}

// ==================== custom-code ====================

/** GET /api/custom-code：返回 custom_header + custom_content。 */
export async function getCustomCode(db: Db): Promise<{ customHeader: string; customContent: string }> {
  // 并行查两个 key
  const [headerRecord, contentRecord] = await Promise.all([
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'custom_header')).get() as Promise<{ value: string } | undefined>,
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'custom_content')).get() as Promise<{ value: string } | undefined>,
  ]);
  return {
    customHeader: headerRecord?.value || '',
    customContent: contentRecord?.value || '',
  };
}

/** POST /api/custom-code：写入 custom_header 和/或 custom_content。 */
export async function setCustomCode(
  db: Db,
  params: { customHeader?: string; customContent?: string },
): Promise<void> {
  const stmts = [];
  if (params.customHeader !== undefined) {
    stmts.push(
      db
        .insert(settings)
        .values({ key: 'custom_header', value: params.customHeader })
        .onConflictDoUpdate({ target: settings.key, set: { value: params.customHeader } }),
    );
  }
  if (params.customContent !== undefined) {
    stmts.push(
      db
        .insert(settings)
        .values({ key: 'custom_content', value: params.customContent })
        .onConflictDoUpdate({ target: settings.key, set: { value: params.customContent } }),
    );
  }
  if (stmts.length > 0) {
    await db.batch(stmts as unknown as Parameters<Db['batch']>[0]);
  }
}

// ==================== custom-colors ====================

/** GET /api/custom-colors：返回 customColors JSON 数组。 */
export async function getCustomColors(db: Db): Promise<unknown[]> {
  // §3f：V0 用 camelCase customColors 作为 settings key
  return getSettingJson(db, 'customColors', []);
}

/** POST /api/custom-colors：写入 customColors。 */
export async function setCustomColors(db: Db, colors: unknown[]): Promise<void> {
  await setSettingJson(db, 'customColors', colors);
}
