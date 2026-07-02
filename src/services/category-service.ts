/**
 * Category Service —— V0 categories 业务逻辑
 *
 * 阶段 5.1：从 api.js:1994-2066 搬迁，用 Drizzle 替换 env.DB.prepare()。
 *
 * 业务逻辑：
 *   - list：SELECT id, name, color FROM categories ORDER BY id
 *   - CREATE：校验名称唯一（LOWER 比较）+ 生成 id + INSERT
 *   - UPDATE：校验名称唯一（排除自身）+ 动态 SET + 返回完整对象
 *   - BATCH_DELETE：分片删除 categories + 级联清空 todos/todo_templates 的 category_id
 *
 * 审计警告保留：
 *   - §3f：V0 用 camelCase customColors 作为 settings key（本 service 不涉及，但
 *     categories 路由不读 customColors，所以无需特殊处理）
 *   - §9a #1：BATCH_CHUNK_SIZE = 99 必须保留，Drizzle 不会自动分块
 */

import { eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { categories, todos, todo_templates } from '../db/schema';
import { DEFAULT_CATEGORY_COLOR } from '../utils.js';

/** D1 bound params/query 限制 100，留 1 个余量，chunk size 设为 99。 */
const BATCH_CHUNK_SIZE = 99;

/** 分片辅助：把数组切成指定大小的子数组。 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Category 列表项类型。 */
export interface CategoryRow {
  id: string;
  name: string;
  color: string;
}

/**
 * 列出所有分类（按 id 排序）。
 * 与 api.js:1994-1997 一致。
 */
export async function listCategories(db: Db): Promise<CategoryRow[]> {
  const rows = await db
    .select({ id: categories.id, name: categories.name, color: categories.color })
    .from(categories)
    .orderBy(categories.id)
    .all();
  return rows as CategoryRow[];
}

/** CREATE 结果。 */
export interface CreateResult {
  success: true;
  id: string;
  name: string;
  color: string;
}

/** CREATE 错误。 */
export interface CreateError {
  success: false;
  error: string;
  status: number;
}

/**
 * 创建分类。
 * 与 api.js:2004-2016 一致。
 *
 * 规则：
 *   - name 不能为空
 *   - name 不区分大小写唯一（LOWER 比较）
 *   - id = Date.now() + 4 位随机
 *   - color 默认 DEFAULT_CATEGORY_COLOR
 */
export async function createCategory(
  db: Db,
  params: { name?: string; color?: string },
): Promise<CreateResult | CreateError> {
  const { name, color } = params;
  if (!name || !name.trim()) {
    return { success: false, error: '分类名称不能为空', status: 400 };
  }
  const trimmedName = name.trim();

  // 名称唯一校验（不区分大小写）
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(sql`LOWER(${categories.name}) = ${trimmedName.toLowerCase()}`)
    .get();
  if (existing) {
    return { success: false, error: '分类名称已存在', status: 400 };
  }

  const newId = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const catColor = color && color.trim() ? color.trim() : DEFAULT_CATEGORY_COLOR;

  await db
    .insert(categories)
    .values({ id: newId, name: trimmedName, color: catColor })
    .run();

  return { success: true, id: newId, name: trimmedName, color: catColor };
}

/** UPDATE 结果。 */
export interface UpdateResult {
  success: true;
  id: string;
  name: string;
  color: string;
}

/** UPDATE 错误。 */
export interface UpdateError {
  success: false;
  error: string;
  status: number;
}

/**
 * 更新分类。
 * 与 api.js:2017-2044 一致。
 *
 * 规则：
 *   - id 必填
 *   - name 非空时校验唯一（排除自身）
 *   - name/color 至少一个非空才执行 UPDATE
 *   - 返回 DB 中的完整对象（不存在则 404）
 */
export async function updateCategory(
  db: Db,
  params: { id?: string; name?: string; color?: string },
): Promise<UpdateResult | UpdateError> {
  const { id, name, color } = params;
  if (!id) {
    return { success: false, error: '缺少分类ID', status: 400 };
  }

  const trimmedName = name?.trim();
  const trimmedColor = color?.trim();

  // 名称唯一校验（排除自身）
  if (trimmedName) {
    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(sql`LOWER(${categories.name}) = ${trimmedName.toLowerCase()} AND ${categories.id} != ${id}`)
      .get();
    if (existing) {
      return { success: false, error: '分类名称已存在', status: 400 };
    }
  }

  // 检查分类是否存在
  const cat = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, id))
    .get();

  if (cat) {
    // 动态构建 SET 子句
    const setValues: Partial<{ name: string; color: string }> = {};
    if (trimmedName) setValues.name = trimmedName;
    if (trimmedColor) setValues.color = trimmedColor;
    if (Object.keys(setValues).length > 0) {
      await db
        .update(categories)
        .set(setValues)
        .where(eq(categories.id, id))
        .run();
    }
  }

  // 返回 DB 中的完整对象
  const updated = await db
    .select({ id: categories.id, name: categories.name, color: categories.color })
    .from(categories)
    .where(eq(categories.id, id))
    .get();
  if (!updated) {
    return { success: false, error: '分类不存在', status: 404 };
  }
  return {
    success: true,
    id: updated.id,
    name: updated.name,
    color: updated.color,
  };
}

/**
 * 批量删除分类。
 * 与 api.js:2045-2062 一致。
 *
 * 规则：
 *   - ids 必须是非空数组
 *   - 分片删除（BATCH_CHUNK_SIZE=99，防 D1 100 参数限制）
 *   - 级联清空 todos / todo_templates 的 category_id
 *   - 单片失败不阻断整体流程（与原代码 try/catch 一致）
 *
 * 返回传入的 ids（即使部分删除失败也返回全部，与原行为一致）。
 */
export async function batchDeleteCategories(db: Db, ids: string[]): Promise<{ success: true; ids: string[] } | { success: false; error: string; status: number }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: '缺少分类ID列表', status: 400 };
  }

  // 自动分片：每片内三个语句原子提交，跨片独立
  for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
    try {
      // Drizzle 的 inArray 生成 id IN (?, ?, ...) 形式
      // 三个语句放在一个 batch 里保证原子性
      await db.batch([
        db.delete(categories).where(inArray(categories.id, chunk)),
        db.update(todos).set({ category_id: '' }).where(inArray(todos.category_id, chunk)),
        db.update(todo_templates).set({ category_id: '' }).where(inArray(todo_templates.category_id, chunk)),
      ]);
    } catch {
      // 单片失败不阻断整体流程（与原代码一致）
    }
  }
  return { success: true, ids };
}
