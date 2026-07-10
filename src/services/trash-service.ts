/**
 * Trash Service —— V0 回收站业务逻辑
 *
 *
 * 审计警告保留：
 *   - CLEAR_ALL_DATA 路径单独审计，路由层加二次确认
 *
 * 实现策略：
 *   - 简单查询用 Drizzle query builder
 *   - 复杂动态 SQL（UNION ALL 拼接、IN 子句）保留 raw SQL（sql 模板）
 *   - 分片逻辑全部保留（chunkArray + try/catch 单片失败不阻断）
 */

import { eq, inArray, sql, and, ne } from 'drizzle-orm';
import type { Db } from '../db/client';
import { todos, todo_templates } from '../db/schema';
import { removeExdate } from '../recurring-engine.js';

/** D1 bound params/query 限制 100，留 1 个余量，chunk size 设为 99。 */
const BATCH_CHUNK_SIZE = 99;
const TRASH_MAX_ITEMS = 1000;
const TRASH_CHUNK_SIZE = 100;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function sqlPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(',');
}

export type TrashRow = Record<string, unknown>;

/**
 * 列出回收站（自动分页，最多 1000 条）。
 *
 */
export async function listTrash(db: Db): Promise<TrashRow[]> {
  const allResults: TrashRow[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore && allResults.length < TRASH_MAX_ITEMS) {
    const rows = await db.all(
      sql`SELECT * FROM ${todos} WHERE deleted = 1 ORDER BY date DESC LIMIT ${TRASH_CHUNK_SIZE} OFFSET ${offset}`,
    ) as unknown as TrashRow[];
    if (rows.length > 0) {
      allResults.push(...rows);
      offset += rows.length;
      if (rows.length < TRASH_CHUNK_SIZE) hasMore = false;
    } else {
      hasMore = false;
    }
  }
  return allResults;
}

/**
 * 单条恢复。
 *
 */
export async function restoreTrash(db: Db, id: string): Promise<void> {
  const t = await db
    .select({ parent_id: todos.parent_id, date: todos.date, type: todos.type })
    .from(todos)
    .where(eq(todos.id, id))
    .get() as { parent_id: string; date: string; type: string } | undefined;

  await db.update(todos).set({ deleted: 0 }).where(eq(todos.id, id)).run();

  if (t && t.type === 'recurring' && t.parent_id && t.parent_id !== id) {
    // 检查同日期是否已有活跃实例（排除自身）
    const existing = await db
      .select({ id: todos.id })
      .from(todos)
      .where(
        and(
          eq(todos.parent_id, t.parent_id),
          eq(todos.date, t.date),
          eq(todos.deleted, 0),
          ne(todos.id, id),
        ),
      )
      .get();

    if (existing) {
      // 同日期已有活跃实例，恢复的实例脱离模板变为单次任务
      await db
        .update(todos)
        .set({ parent_id: id, type: 'none', rrule: '', anchor_date: '', exdates: '[]' })
        .where(eq(todos.id, id))
        .run();
    } else {
      const tpl = await db
        .select({ rrule: todo_templates.rrule, exdates: todo_templates.exdates })
        .from(todo_templates)
        .where(eq(todo_templates.parent_id, t.parent_id))
        .get() as { rrule: string; exdates: string } | undefined;

      // 简化：只要模板存在且 rrule 非空，就视为覆盖（与原代码一致）
      const tplCoversDate = !!(tpl && tpl.rrule);

      if (tplCoversDate) {
        // 模板仍覆盖此日期：从 EXDATE 移除此日期，重新并入系列
        const currentExdates = tpl!.exdates || '[]';
        const newExdates = removeExdate(currentExdates, t.date);
        await db
          .update(todo_templates)
          .set({ exdates: newExdates })
          .where(eq(todo_templates.parent_id, t.parent_id))
          .run();
      } else {
        // 模板已删除或已截断：脱钩为单次任务
        await db
          .update(todos)
          .set({ parent_id: id, type: 'none', rrule: '', anchor_date: '', exdates: '[]' })
          .where(eq(todos.id, id))
          .run();
      }
    }
  }
}

/**
 * 单条永久删除。
 *
 */
export async function deletePermanent(db: Db, id: string): Promise<void> {
  await db.delete(todos).where(eq(todos.id, id)).run();
}

/**
 * 清空回收站（deleted=1 的）。
 *
 */
export async function clearAll(db: Db): Promise<void> {
  await db.delete(todos).where(eq(todos.deleted, 1)).run();
}

/**
 * 批量恢复。
 *
 */
export async function batchRestore(db: Db, ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;

  // 1. 分片查询所有 ids 的 parent_id/date/type
  const tasks: Array<{ id: string; parent_id: string; date: string; type: string }> = [];
  for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
    try {
      const rows = await db
        .select({ id: todos.id, parent_id: todos.parent_id, date: todos.date, type: todos.type })
        .from(todos)
        .where(inArray(todos.id, chunk))
        .all();
      for (const r of rows) {
        tasks.push(r as { id: string; parent_id: string; date: string; type: string });
      }
    } catch {
      // 单片查询失败不阻断
    }
  }

  // 2. 分片恢复
  for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
    try {
      await db.update(todos).set({ deleted: 0 }).where(inArray(todos.id, chunk)).run();
    } catch {
      // 单片失败不阻断
    }
  }

  // 3. 对 candidateTasks 处理 RRULE 模板
  const candidateTasks = tasks.filter(
    (t) => t.type === 'recurring' && t.parent_id && t.parent_id !== t.id,
  );
  const uniqueParentIds = [...new Set(candidateTasks.map((t) => t.parent_id))];

  // 批量查模板
  const tplMap = new Map<string, { rrule: string; exdates: string }>();
  for (const chunk of chunkArray(uniqueParentIds, BATCH_CHUNK_SIZE)) {
    try {
      const rows = await db
        .select({
          parent_id: todo_templates.parent_id,
          rrule: todo_templates.rrule,
          exdates: todo_templates.exdates,
        })
        .from(todo_templates)
        .where(inArray(todo_templates.parent_id, chunk))
        .all();
      for (const r of rows) {
        tplMap.set(r.parent_id as string, r as { rrule: string; exdates: string });
      }
    } catch {
      // 单片查询失败不阻断
    }
  }

  // 批量查同日期是否有活跃实例
  const existingKeys = new Set<string>();
  for (const t of candidateTasks) {
    existingKeys.add(`${t.parent_id}|${t.date}`);
  }

  const existingKeyArr = Array.from(existingKeys);
  for (const chunk of chunkArray(existingKeyArr, BATCH_CHUNK_SIZE)) {
    try {
      const unions = chunk
        .map((k) => {
          const [pid, dt] = k.split('|');
          const escPid = pid.replace(/'/g, "''");
          const escDt = dt.replace(/'/g, "''");
          return `SELECT '${escPid}' AS pid, '${escDt}' AS dt, EXISTS(SELECT 1 FROM todos WHERE parent_id = '${escPid}' AND date = '${escDt}' AND deleted = 0) AS has_existing`;
        })
        .join(' UNION ALL ');
      const rows = await db.all(sql.raw(`SELECT * FROM (${unions})`)) as unknown as Array<{ pid: string; dt: string; has_existing: number }>;
      for (const r of (rows || [])) {
        if (r.has_existing) {
          existingKeys.add(`${r.pid}|${r.dt}`);
        } else {
          existingKeys.delete(`${r.pid}|${r.dt}`);
        }
      }
    } catch {
      for (const k of chunk) {
        const [pid, dt] = k.split('|');
        try {
          const ex = await db.all(
            sql`SELECT id FROM ${todos} WHERE parent_id = ${pid} AND date = ${dt} AND deleted = 0 LIMIT 1`,
          ) as unknown as TrashRow[];
          if (!ex || ex.length === 0) {
            existingKeys.delete(k);
          }
        } catch {
          // 查询失败保留 key（视为有 existing，安全降级为脱钩）
        }
      }
    }
  }

  // 分类：脱钩 vs 更新 EXDATE
  const detachIds: string[] = [];
  const exdateUpdates: Record<string, string[]> = {};
  for (const t of candidateTasks) {
    if (existingKeys.has(`${t.parent_id}|${t.date}`)) {
      detachIds.push(t.id);
      continue;
    }
    const tpl = tplMap.get(t.parent_id);
    if (tpl && tpl.rrule) {
      if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
      exdateUpdates[t.parent_id].push(t.date);
    } else {
      detachIds.push(t.id);
    }
  }

  // 分片执行脱钩
  for (const chunk of chunkArray(detachIds, BATCH_CHUNK_SIZE)) {
    try {
      // 用 raw SQL 因为 Drizzle 的 inArray + SET parent_id=id 需要特殊处理
      const placeholders = sqlPlaceholders(chunk.length);
      // 用 D1 原生 prepare + bind（Drizzle 的 sql.raw 不支持 .bind）
      await (db as unknown as { $client: D1Database }).$client
        .prepare(`UPDATE todos SET parent_id=id, type='none', rrule='', anchor_date='', exdates='[]' WHERE id IN (${placeholders})`)
        .bind(...chunk)
        .run();
    } catch {
      // 单片失败不阻断
    }
  }

  // 分片更新 EXDATE
  const exdateStmts = [];
  for (const pid of Object.keys(exdateUpdates)) {
    const tpl = tplMap.get(pid);
    if (!tpl) continue;
    let currentExdates = tpl.exdates || '[]';
    let changed = false;
    for (const d of exdateUpdates[pid]) {
      const newExdates = removeExdate(currentExdates, d);
      if (newExdates !== currentExdates) {
        currentExdates = newExdates;
        changed = true;
      }
    }
    if (changed) {
      exdateStmts.push(
        db
          .update(todo_templates)
          .set({ exdates: currentExdates })
          .where(eq(todo_templates.parent_id, pid)),
      );
    }
  }
  for (const chunk of chunkArray(exdateStmts, BATCH_CHUNK_SIZE)) {
    try {
      await db.batch(chunk as unknown as Parameters<Db['batch']>[0]);
    } catch {
      // 单批 exdate 维护失败不阻断
    }
  }
}

/**
 * 批量永久删除。
 *
 */
export async function batchDeletePermanent(db: Db, ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
    try {
      await db.delete(todos).where(inArray(todos.id, chunk)).run();
    } catch {
      // 单片失败不阻断
    }
  }
}

/**
 * 清空所有用户数据（todos + todo_templates + settings 中除 db_schema_version 外的行 + categories）。
 *
 * 注意：这是危险操作，路由层应加二次确认。
 * 保留 db_schema_version 行，否则 ensureMigrated 会返回 'missing' 导致 503 锁死整个应用。
 */
export async function clearAllData(db: Db): Promise<void> {
  await db.batch([
    db.delete(todos),
    db.delete(todo_templates),
    db.run(sql`DELETE FROM settings WHERE key != 'db_schema_version'`),
    db.run(sql`DELETE FROM categories`),
  ] as unknown as Parameters<Db['batch']>[0]);
}
