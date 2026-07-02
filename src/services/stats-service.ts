/**
 * Stats Service —— V0 统计聚合
 *
 * 阶段 5.4：从 api.js:836-957 搬迁。
 *
 * 核心逻辑：D1 batch 一次往返跑 6 条 GROUP BY，把数万行原始数据压缩为几十行聚合结果。
 * 索引依赖：idx_todos_stats(date, deleted, priority, done, category_id, time) covering index。
 *
 * 6 条查询：
 *   1) 按日期聚合：dailyCounts[date] = { total, done }
 *   2) 按分类聚合：categoryCounts[category_id] = { total, done }
 *   3) 按优先级 × 完成度：priCounts / priDone
 *   4) 按周日 × 完成度：weekdayCounts / weekdayDone
 *   5) 按时段聚合：hourBuckets[0..3]
 *   6) 总量汇总：total / done / undone / activeDays
 *
 * WHERE 子句优化（与原代码一致）：
 *   合并普通 todo + fragment 已完成（都是 date 在范围），fragment 未完成浮动单独 OR
 *   实测 50k 行年度报告：47ms → 13ms（72% 提升）
 */

import type { Db } from '../db/client';
import { validateStatsDateRange } from '../utils.js';

/** 统计响应 payload。 */
export interface StatsPayload {
  aggregated: true;
  range: { start: string; end: string };
  summary: {
    total: number;
    done: number;
    undone: number;
    activeDays: number;
  };
  dailyCounts: Record<string, { total: number; done: number }>;
  categoryCounts: Record<string, { total: number; done: number }>;
  noCategoryCount: { total: number; done: number };
  priCounts: { high: number; med: number; low: number };
  priDone: { high: number; med: number; low: number };
  weekdayCounts: number[];
  weekdayDone: number[];
  hourBuckets: number[];
}

/**
 * 获取统计数据。
 * 与 api.js:836-957 完全一致。
 *
 * @returns { ok: true, payload } 或 { ok: false, error }
 */
export async function getStats(
  db: Db,
  start: string | null,
  end: string | null,
): Promise<{ ok: true; payload: StatsPayload } | { ok: false; error: string }> {
  const rangeCheck = validateStatsDateRange(start, end);
  if (!rangeCheck.ok) return { ok: false, error: rangeCheck.error };

  // 统计 WHERE 子句（优化版，语义与原版完全等价）
  const s = start as string;
  const e = end as string;
  const baseWhere = `FROM todos WHERE deleted = 0 AND (
    (date >= ?1 AND date <= ?2)
    OR (date = '' AND type = 'fragment' AND done = 0)
  )`;

  // 用 D1 原生 batch（Drizzle 的 batch 对复杂 raw SQL 支持不佳）
  // db.$client 是底层 D1Database 实例
  const d1 = (db as unknown as { $client: D1Database }).$client;
  const batchResults = await d1.batch([
    // 1) 按日期聚合
    d1.prepare(`SELECT COALESCE(NULLIF(date, ''), ?2) AS date, COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done ${baseWhere} GROUP BY COALESCE(NULLIF(date, ''), ?2)`).bind(s, e),
    // 2) 按分类聚合
    d1.prepare(`SELECT COALESCE(NULLIF(category_id, ''), '') AS category_id, COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done ${baseWhere} GROUP BY COALESCE(NULLIF(category_id, ''), '')`).bind(s, e),
    // 3) 按优先级 × 完成度
    d1.prepare(`SELECT priority, done, COUNT(*) AS cnt ${baseWhere} GROUP BY priority, done`).bind(s, e),
    // 4) 按周日 × 完成度
    d1.prepare(`SELECT CAST(strftime('%w', COALESCE(NULLIF(date, ''), ?2)) AS INTEGER) AS weekday, done, COUNT(*) AS cnt ${baseWhere} GROUP BY weekday, done`).bind(s, e),
    // 5) 按时段聚合
    d1.prepare(`SELECT CASE WHEN time IS NULL OR time = '' THEN -1 WHEN CAST(substr(time, 1, 2) AS INTEGER) < 6 THEN 0 WHEN CAST(substr(time, 1, 2) AS INTEGER) < 12 THEN 1 WHEN CAST(substr(time, 1, 2) AS INTEGER) < 18 THEN 2 ELSE 3 END AS bucket, COUNT(*) AS cnt ${baseWhere} GROUP BY bucket`).bind(s, e),
    // 6) 总量汇总
    d1.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done, SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END) AS undone, COUNT(DISTINCT CASE WHEN date = '' THEN NULL ELSE date END) AS active_days ${baseWhere}`).bind(s, e),
  ]);

  // 组装响应（与 api.js:898-953 一致）
  const results = batchResults as unknown as Array<{ results?: Array<Record<string, number | string>> }>;

  // 1) dailyCounts
  const dailyCounts: Record<string, { total: number; done: number }> = {};
  for (const r of (results[0].results || [])) {
    dailyCounts[String(r.date)] = { total: Number(r.total), done: Number(r.done) };
  }

  // 2) categoryCounts + noCategoryCount
  const categoryCounts: Record<string, { total: number; done: number }> = {};
  let noCategoryCount = { total: 0, done: 0 };
  for (const r of (results[1].results || [])) {
    if (r.category_id === '') {
      noCategoryCount = { total: Number(r.total), done: Number(r.done) };
    } else {
      categoryCounts[String(r.category_id)] = { total: Number(r.total), done: Number(r.done) };
    }
  }

  // 3) priCounts / priDone
  const priCounts = { high: 0, med: 0, low: 0 };
  const priDone = { high: 0, med: 0, low: 0 };
  for (const r of (results[2].results || [])) {
    const p = (r.priority === 'high' || r.priority === 'med' || r.priority === 'low') ? String(r.priority) : 'low';
    priCounts[p as 'high' | 'med' | 'low'] += Number(r.cnt);
    if (r.done === 1) priDone[p as 'high' | 'med' | 'low'] += Number(r.cnt);
  }

  // 4) weekdayCounts / weekdayDone
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  const weekdayDone = [0, 0, 0, 0, 0, 0, 0];
  for (const r of (results[3].results || [])) {
    const wd = Number(r.weekday);
    if (wd >= 0 && wd <= 6) {
      weekdayCounts[wd] += Number(r.cnt);
      if (r.done === 1) weekdayDone[wd] += Number(r.cnt);
    }
  }

  // 5) hourBuckets
  const hourBuckets = [0, 0, 0, 0];
  for (const r of (results[4].results || [])) {
    const b = Number(r.bucket);
    if (b >= 0 && b <= 3) hourBuckets[b] = Number(r.cnt);
  }

  // 6) summary
  const summaryRow = (results[5].results || [])[0] || { total: 0, done: 0, undone: 0, active_days: 0 };

  return {
    ok: true,
    payload: {
      aggregated: true,
      range: { start: start!, end: end! },
      summary: {
        total: Number(summaryRow.total) || 0,
        done: Number(summaryRow.done) || 0,
        undone: Number(summaryRow.undone) || 0,
        activeDays: Number(summaryRow.active_days) || 0,
      },
      dailyCounts,
      categoryCounts,
      noCategoryCount,
      priCounts,
      priDone,
      weekdayCounts,
      weekdayDone,
      hourBuckets,
    },
  };
}
