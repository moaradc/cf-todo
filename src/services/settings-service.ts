/**
 * Settings Service —— V0 settings / custom-code / custom-* 业务逻辑
 *
 *
 * 搬迁来源：
 *   - GET  /api/settings
 *   - POST /api/settings
 *   - GET  /api/custom-code
 *   - POST /api/custom-code
 *   - GET  /api/custom-colors
 *   - POST /api/custom-colors
 *   - GET  /api/custom-header
 *   - GET  /api/custom-content
 *
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

/**
 * 防御性解包：如果误存为 {success, data} 包装格式（旧 POST 误存），自动解包到 data 内层。
 * 否则原样返回。
 */
function unwrapAppSettings(obj: unknown): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return {} as Record<string, unknown>;
  const rec = obj as Record<string, unknown>;
  if ('success' in rec && 'data' in rec && typeof rec.data === 'object' && rec.data !== null) {
    return rec.data as Record<string, unknown>;
  }
  return rec;
}

/** GET /api/settings：返回 app_settings JSON 对象。 */
export async function getAppSettings(db: Db): Promise<Record<string, unknown>> {
  const raw = await getSettingJson<unknown>(db, 'app_settings', {});
  return unwrapAppSettings(raw);
}

/** POST /api/settings：写入 app_settings（防御性解包 {success,data} 包装）。 */
export async function setAppSettings(db: Db, data: Record<string, unknown>): Promise<void> {
  const clean = unwrapAppSettings(data);
  await setSettingJson(db, 'app_settings', clean);
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
  return getSettingJson(db, 'customColors', []);
}

/** POST /api/custom-colors：写入 customColors。 */
export async function setCustomColors(db: Db, colors: unknown[]): Promise<void> {
  await setSettingJson(db, 'customColors', colors);
}
