/**
 * V1 简单路由：categories / trash / stats / settings / custom-*
 *
 * 这些路由业务逻辑与 V0 高度重复，差异仅在响应壳（v1Ok + formatTodo/formatCategory）。
 *
 * 用 raw D1 API 保持与原代码字节级一致。
 */

import { Hono } from 'hono';
import {
  normalizePriority,
  parseJsonField,
  validateStatsDateRange,
  DEFAULT_CATEGORY_COLOR,
} from '../../utils.js';
import { createDb, createReadDb } from '../../db/client';
import { v1Ok, v1OkNoData, v1Err, formatTodo, formatCategory } from '../../services/v1-response';
import { removeExdate } from '../../recurring-engine.js';
import type { V1AppEnv } from './index';

/** D1 原生数据库实例。 */
function d1(db: ReturnType<typeof createDb>): D1Database {
  return (db as unknown as { $client: D1Database }).$client;
}

/** V1 鉴权（API Key 优先，回退 cookie）。返回 null=通过，Response=错误响应。 */
  // 回退 cookie 鉴权

const BATCH_CHUNK_SIZE = 99;
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
function sqlPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(',');
}

/** V1 简单路由 Hono app。 */
export const v1SimpleApp = new Hono<V1AppEnv>();

// ==================== Categories ====================

v1SimpleApp.get('/categories', async (c) => {
  const d = d1(createReadDb(c.env.DB));
  const { results } = await d.prepare('SELECT id, name, color FROM categories ORDER BY id').all();
  return v1Ok((results || []).map(formatCategory));
});

v1SimpleApp.post('/categories', async (c) => {
  const d = d1(createDb(c.env.DB));
  let body: { name?: string; color?: string };
  try { body = await c.req.raw.json(); } catch { return v1Err('请求体不是有效的 JSON'); }
  const { name, color } = body;
  if (!name || !name.trim()) return v1Err('name 为必填项');
  const existing = await d.prepare('SELECT id FROM categories WHERE LOWER(name) = ?').bind(name.trim().toLowerCase()).first();
  if (existing) return v1Err('分类名称已存在');
  const id = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const cat_color = (color && color.trim()) ? color.trim() : DEFAULT_CATEGORY_COLOR;
  await d.prepare('INSERT INTO categories (id, name, color) VALUES (?, ?, ?)').bind(id, name.trim(), cat_color).run();
  return v1Ok({ id, name: name.trim(), color: cat_color }, undefined, 201);
});

v1SimpleApp.get('/categories/:id', async (c) => {
  const d = d1(createReadDb(c.env.DB));
  const catId = c.req.param('id');
  const row = await d.prepare('SELECT id, name, color FROM categories WHERE id = ?').bind(catId).first<Record<string, unknown>>();
  if (!row) return v1Err('分类不存在', 404);
  return v1Ok(formatCategory(row));
});

v1SimpleApp.put('/categories/:id', async (c) => {
  const d = d1(createDb(c.env.DB));
  const catId = c.req.param('id');
  const existing = await d.prepare('SELECT id FROM categories WHERE id = ?').bind(catId).first();
  if (!existing) return v1Err('分类不存在', 404);
  let body: Record<string, unknown>;
  try { body = await c.req.raw.json(); } catch { return v1Err('请求体不是有效的 JSON'); }
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (body.name !== undefined && String(body.name).trim()) {
    const dup = await d.prepare('SELECT id FROM categories WHERE LOWER(name) = ? AND id != ?').bind(String(body.name).trim().toLowerCase(), catId).first();
    if (dup) return v1Err('分类名称已存在');
    sets.push('name = ?'); vals.push(String(body.name).trim());
  }
  if (body.color !== undefined && String(body.color).trim()) { sets.push('color = ?'); vals.push(String(body.color).trim()); }
  if (sets.length > 0) { vals.push(catId); await d.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run(); }
  const updated = await d.prepare('SELECT id, name, color FROM categories WHERE id = ?').bind(catId).first<Record<string, unknown>>();
  return v1Ok(formatCategory(updated!));
});

v1SimpleApp.delete('/categories/:id', async (c) => {
  const d = d1(createDb(c.env.DB));
  const catId = c.req.param('id');
  const existing = await d.prepare('SELECT id FROM categories WHERE id = ?').bind(catId).first();
  if (!existing) return v1Err('分类不存在', 404);
  await d.batch([
    d.prepare('DELETE FROM categories WHERE id = ?').bind(catId),
    d.prepare("UPDATE todos SET category_id = '' WHERE category_id = ?").bind(catId),
    d.prepare("UPDATE todo_templates SET category_id = '' WHERE category_id = ?").bind(catId),
  ]);
  return v1OkNoData();
});

// POST /api/v1/categories/batch
v1SimpleApp.post('/categories/batch', async (c) => {
  const d = d1(createDb(c.env.DB));
  let body: { action?: string; ids?: string[] };
  try { body = await c.req.raw.json(); } catch { return v1Err('请求体不是有效的 JSON'); }
  const { action, ids } = body;
  if (action !== 'BATCH_DELETE') return v1Err('未知操作，可用: BATCH_DELETE');
  if (!ids || !Array.isArray(ids) || ids.length === 0) return v1Err('ids 为必填数组');
  let totalDeleted = 0;
  for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
    const ph = sqlPlaceholders(chunk.length);
    try {
      // D1 不返回 batch 中 DELETE 的 changes，单独执行 SELECT COUNT 后 DELETE
      const countRes = await d.prepare(`SELECT COUNT(*) as cnt FROM categories WHERE id IN (${ph})`).bind(...chunk).first<{ cnt: number }>();
      totalDeleted += Number(countRes?.cnt || 0);
      await d.batch([
        d.prepare(`DELETE FROM categories WHERE id IN (${ph})`).bind(...chunk),
        d.prepare(`UPDATE todos SET category_id = '' WHERE category_id IN (${ph})`).bind(...chunk),
        d.prepare(`UPDATE todo_templates SET category_id = '' WHERE category_id IN (${ph})`).bind(...chunk),
      ]);
    } catch { /* 静默 */ }
  }
  return v1Ok({ deleted: totalDeleted, chunked: ids.length > BATCH_CHUNK_SIZE, chunkCount: Math.ceil(ids.length / BATCH_CHUNK_SIZE) });
});

// ==================== Trash ====================

v1SimpleApp.get('/trash', async (c) => {
  const d = d1(createReadDb(c.env.DB));
  const url = new URL(c.req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 500);
  const offset = Math.min(Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0), 10000);
  const { results } = await d.prepare('SELECT * FROM todos WHERE deleted = 1 ORDER BY date DESC LIMIT ? OFFSET ?').bind(limit, offset).all();
  const countRes = await d.prepare('SELECT COUNT(*) as total FROM todos WHERE deleted = 1').first<{ total: number }>();
  return v1Ok((results || []).map((r: Record<string, unknown>) => formatTodo(r)), { total: countRes?.total || 0, limit, offset });
});

v1SimpleApp.post('/trash-action', async (c) => {
  const d = d1(createDb(c.env.DB));
  let body: { action?: string; id?: string; ids?: string[] };
  try { body = await c.req.raw.json(); } catch { return v1Err('请求体不是有效的 JSON'); }
  const { action, id, ids } = body;

  if (action === 'RESTORE') {
    if (!id) return v1Err('缺少 id');
    const t = await d.prepare('SELECT parent_id, date, type FROM todos WHERE id = ?').bind(id).first<{ parent_id: string; date: string; type: string }>();
    if (!t) return v1Err('待办不存在', 404);
    await d.prepare('UPDATE todos SET deleted = 0 WHERE id = ?').bind(id).run();
    if (t.type === 'recurring' && t.parent_id && t.parent_id !== id) {
      const existing = await d.prepare('SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 AND id != ? LIMIT 1').bind(t.parent_id, t.date, id).first();
      if (existing) {
        await d.prepare('UPDATE todos SET parent_id=?, type=?, rrule=?, anchor_date=?, exdates=? WHERE id=?').bind(id, 'none', '', '', '[]', id).run();
      } else {
        const tpl = await d.prepare('SELECT rrule, exdates FROM todo_templates WHERE parent_id = ?').bind(t.parent_id).first<{ rrule: string; exdates: string }>();
        if (tpl && tpl.rrule) {
          const new_exdates = removeExdate(tpl.exdates || '[]', t.date);
          await d.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, t.parent_id).run();
        } else {
          await d.prepare('UPDATE todos SET parent_id=?, type=?, rrule=?, anchor_date=?, exdates=? WHERE id=?').bind(id, 'none', '', '', '[]', id).run();
        }
      }
    }
    return v1OkNoData();
  }
  if (action === 'DELETE_PERMANENT') {
    if (!id) return v1Err('缺少 id');
    await d.prepare('DELETE FROM todos WHERE id = ?').bind(id).run();
    return v1OkNoData();
  }
  if (action === 'CLEAR_ALL') {
    await d.prepare('DELETE FROM todos WHERE deleted = 1').run();
    return v1OkNoData();
  }
  if (action === 'CLEAR_ALL_DATA') {
    // 清空所有用户数据，但保留 db_schema_version（否则 ensureMigrated 会返回 'missing' 导致 503）
    // 同时保留 api_keys 让调用方能继续鉴权（用户可选择是否删除 key）
    // 实际策略：删除 todos / todo_templates / categories，settings 仅删除用户配置（app_settings / custom_* / customColors / active_session_token）
    await d.batch([
      d.prepare('DELETE FROM todos'),
      d.prepare('DELETE FROM todo_templates'),
      d.prepare('DELETE FROM categories'),
      d.prepare("DELETE FROM settings WHERE key != 'db_schema_version'"),
    ]);
    return v1OkNoData();
  }
  if (action === 'BATCH_RESTORE') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return v1Err('ids 为必填数组');
    // 先统计 ids 中实际处于回收站（deleted=1）的数量，作为 restored 基线
    let totalRestored = 0;
    for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
      const ph = sqlPlaceholders(chunk.length);
      try { const r = await d.prepare(`SELECT COUNT(*) as cnt FROM todos WHERE id IN (${ph}) AND deleted = 1`).bind(...chunk).first<{ cnt: number }>(); totalRestored += Number(r?.cnt || 0); } catch { /* 静默 */ }
    }
    // 复用 V0 trash-service 的 batchRestore 逻辑（行为一致，只是响应壳不同）
    const { batchRestore } = await import('../../services/trash-service');
    await batchRestore(createDb(c.env.DB), ids);
    return v1Ok({ restored: totalRestored, chunked: ids.length > BATCH_CHUNK_SIZE, chunkCount: Math.ceil(ids.length / BATCH_CHUNK_SIZE) });
  }
  if (action === 'BATCH_DELETE_PERMANENT') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return v1Err('ids 为必填数组');
    let totalDeleted = 0;
    for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
      const ph = sqlPlaceholders(chunk.length);
      try { const r = await d.prepare(`DELETE FROM todos WHERE id IN (${ph})`).bind(...chunk).run(); totalDeleted += (r.meta?.changes || 0); } catch { /* 静默 */ }
    }
    return v1Ok({ deleted: totalDeleted, chunked: ids.length > BATCH_CHUNK_SIZE, chunkCount: Math.ceil(ids.length / BATCH_CHUNK_SIZE) });
  }
  return v1Err('未知操作，可用: RESTORE, DELETE_PERMANENT, CLEAR_ALL, CLEAR_ALL_DATA, BATCH_RESTORE, BATCH_DELETE_PERMANENT');
});

// ==================== Stats ====================

v1SimpleApp.get('/stats', async (c) => {
  const d = d1(createReadDb(c.env.DB));
  const url = new URL(c.req.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const rangeCheck = validateStatsDateRange(start, end);
  if (!rangeCheck.ok) return v1Err(rangeCheck.error);

  const s = start as string;
  const e = end as string;
  const baseWhere = `FROM todos WHERE deleted = 0 AND ((date >= ?1 AND date <= ?2) OR (date = '' AND type = 'fragment' AND done = 0))`;

  const batchResults = await d.batch([
    d.prepare(`SELECT COALESCE(NULLIF(date, ''), ?2) AS date, COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done ${baseWhere} GROUP BY COALESCE(NULLIF(date, ''), ?2)`).bind(s, e),
    d.prepare(`SELECT COALESCE(NULLIF(category_id, ''), '') AS category_id, COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done ${baseWhere} GROUP BY COALESCE(NULLIF(category_id, ''), '')`).bind(s, e),
    d.prepare(`SELECT priority, done, COUNT(*) AS cnt ${baseWhere} GROUP BY priority, done`).bind(s, e),
    d.prepare(`SELECT CAST(strftime('%w', COALESCE(NULLIF(date, ''), ?2)) AS INTEGER) AS weekday, done, COUNT(*) AS cnt ${baseWhere} GROUP BY weekday, done`).bind(s, e),
    d.prepare(`SELECT CASE WHEN time IS NULL OR time = '' THEN -1 WHEN CAST(substr(time, 1, 2) AS INTEGER) < 6 THEN 0 WHEN CAST(substr(time, 1, 2) AS INTEGER) < 12 THEN 1 WHEN CAST(substr(time, 1, 2) AS INTEGER) < 18 THEN 2 ELSE 3 END AS bucket, COUNT(*) AS cnt ${baseWhere} GROUP BY bucket`).bind(s, e),
    d.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done, SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END) AS undone, COUNT(DISTINCT CASE WHEN date = '' THEN NULL ELSE date END) AS active_days ${baseWhere}`).bind(s, e),
  ]);

  // 组装（V1 字段名与 V0 不同：byDate/byCategory/byPriority/byWeekday/byHourBucket）
  const results = batchResults as unknown as Array<{ results?: Array<Record<string, number | string>> }>;
  const byDate: Record<string, { total: number; done: number }> = {};
  for (const r of (results[0].results || [])) byDate[String(r.date)] = { total: Number(r.total), done: Number(r.done) };
  const byCategory: Record<string, { total: number; done: number }> = {};
  let noCategoryCount = { total: 0, done: 0 };
  for (const r of (results[1].results || [])) { if (r.category_id === '') noCategoryCount = { total: Number(r.total), done: Number(r.done) }; else byCategory[String(r.category_id)] = { total: Number(r.total), done: Number(r.done) }; }
  const byPriority = { high: 0, med: 0, low: 0 };
  const byPriorityDone = { high: 0, med: 0, low: 0 };
  for (const r of (results[2].results || [])) { const p = (r.priority === 'high' || r.priority === 'med' || r.priority === 'low') ? String(r.priority) : 'low'; byPriority[p as 'high'|'med'|'low'] += Number(r.cnt); if (r.done === 1) byPriorityDone[p as 'high'|'med'|'low'] += Number(r.cnt); }
  const byWeekday = [0,0,0,0,0,0,0]; const byWeekdayDone = [0,0,0,0,0,0,0];
  for (const r of (results[3].results || [])) { const wd = Number(r.weekday); if (wd >= 0 && wd <= 6) { byWeekday[wd] += Number(r.cnt); if (r.done === 1) byWeekdayDone[wd] += Number(r.cnt); } }
  const byHourBucket = [0,0,0,0];
  for (const r of (results[4].results || [])) { const b = Number(r.bucket); if (b >= 0 && b <= 3) byHourBucket[b] = Number(r.cnt); }
  const summaryRow = (results[5].results || [])[0] || { total: 0, done: 0, undone: 0, active_days: 0 };

  // V1 stats 不含 aggregated/range/summary 包装，直接平铺
  return v1Ok({
    total: Number(summaryRow.total) || 0, done: Number(summaryRow.done) || 0, undone: Number(summaryRow.undone) || 0, activeDays: Number(summaryRow.active_days) || 0,
    byDate, byCategory, noCategoryCount, byPriority, byPriorityDone, byWeekday, byWeekdayDone, byHourBucket,
  });
});

// ==================== Settings + Custom-* ====================

v1SimpleApp.get('/settings', async (c) => {
  const d = d1(createReadDb(c.env.DB));
  const record = await d.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first<{ value: string }>();
  let settingsObj: unknown = {};
  if (record && record.value) {
    try {
      const parsed = JSON.parse(record.value);
      // 防御性：如果历史数据被错误存为 {success, data} 包装格式（旧 POST 误存），自动解包
      settingsObj = (parsed && typeof parsed === 'object' && 'success' in parsed && 'data' in parsed && typeof (parsed as Record<string, unknown>).data === 'object')
        ? (parsed as { data: unknown }).data
        : parsed;
    } catch { /* 静默 */ }
  }
  return v1Ok(settingsObj);
});

v1SimpleApp.post('/settings', async (c) => {
  const d = d1(createDb(c.env.DB));
  let data: unknown;
  try { data = await c.req.raw.json(); } catch { return v1Err('请求体不是有效的 JSON'); }
  if (!data || typeof data !== 'object') return v1Err('请求体不是有效的 JSON 对象');
  // 防御性：如果调用方误传了 {success, data} 包装格式（例如把 GET 响应原样回传），
  // 自动解包到 data 内层，避免 DB 存储被污染导致 getApiKeyScope 等读取方拿不到字段
  if ('success' in (data as Record<string, unknown>) && 'data' in (data as Record<string, unknown>) && typeof (data as Record<string, unknown>).data === 'object') {
    data = (data as { data: unknown }).data;
  }
  await d.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)").bind(JSON.stringify(data)).run();
  return v1OkNoData();
});

v1SimpleApp.get('/custom-code', async (c) => {
  const d = d1(createReadDb(c.env.DB));
  const [headerRecord, contentRecord] = await Promise.all([
    d.prepare("SELECT value FROM settings WHERE key = 'custom_header'").first<{ value: string }>(),
    d.prepare("SELECT value FROM settings WHERE key = 'custom_content'").first<{ value: string }>(),
  ]);
  return v1Ok({ customHeader: headerRecord?.value || '', customContent: contentRecord?.value || '' });
});

v1SimpleApp.post('/custom-code', async (c) => {
  const d = d1(createDb(c.env.DB));
  let body: { customHeader?: string; customContent?: string };
  try { body = await c.req.raw.json(); } catch { return v1Err('请求体不是有效的 JSON'); }
  const stmts: D1PreparedStatement[] = [];
  if (body.customHeader !== undefined) stmts.push(d.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_header', ?)").bind(body.customHeader));
  if (body.customContent !== undefined) stmts.push(d.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_content', ?)").bind(body.customContent));
  if (stmts.length > 0) await d.batch(stmts);
  return v1OkNoData();
});

v1SimpleApp.get('/custom-header', async (c) => {
  const d = d1(createReadDb(c.env.DB));
  const record = await d.prepare("SELECT value FROM settings WHERE key = 'custom_header'").first<{ value: string }>();
  return new Response(record?.value || '', { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
});

v1SimpleApp.get('/custom-content', async (c) => {
  const d = d1(createReadDb(c.env.DB));
  const record = await d.prepare("SELECT value FROM settings WHERE key = 'custom_content'").first<{ value: string }>();
  return new Response(record?.value || '', { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
});

v1SimpleApp.get('/custom-colors', async (c) => {
  const d = d1(createReadDb(c.env.DB));
  const record = await d.prepare("SELECT value FROM settings WHERE key = 'customColors'").first<{ value: string }>();
  let customColors: unknown[] = [];
  if (record && record.value) { try { customColors = JSON.parse(record.value); } catch { /* 静默 */ } }
  return v1Ok(customColors);
});

v1SimpleApp.post('/custom-colors', async (c) => {
  const d = d1(createDb(c.env.DB));
  let body: { colors?: unknown[] };
  try { body = await c.req.raw.json(); } catch { return v1Err('请求体不是有效的 JSON'); }
  if (!Array.isArray(body.colors)) return v1Err('colors 必须为数组');
  await d.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('customColors', ?)").bind(JSON.stringify(body.colors)).run();
  return v1Ok(body.colors);
});
