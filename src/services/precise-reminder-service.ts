/**
 * Precise Reminder Service —— DO Alarm 精确提醒的 CRUD 联动层。
 *
 * 在 todo CRUD 后同步 DO 中的精确提醒事件。仅在 precise_enabled 时访问 DO。
 * syncPreciseReminderForTodo 统一处理所有场景：不存在/删除/完成 → cancel；
 * 有效时间 → schedule；过期但未到期 → 兜底立即触发。
 */

import { eq } from 'drizzle-orm';
import type { Env } from '../env';
import { createReadDb } from '../db/client';
import { todos, categories } from '../db/schema';
import { getReminderConfig, dueUtcMsFor } from './reminder-service';
import type { ScheduleEventData, PreciseEventType } from '../do/reminder-do';

// ==================== 类型 ====================

export interface SyncResult {
  /** scheduled=调度了新事件；cancelled=仅取消；skipped=因 precise_enabled=false 跳过 */
  action: 'scheduled' | 'cancelled' | 'skipped';
  /** 调度的事件列表（runAt UTC ms） */
  events: Array<{ type: PreciseEventType; runAt: number }>;
  /** 跳过 / 取消原因（调试用） */
  reason?: string;
}

// ==================== DO 单例获取 ====================

/** 获取 ReminderDO 单例 stub。 */
function getReminderStub(env: Env) {
  const id = env.REMINDER_DO.idFromName('reminder');
  return env.REMINDER_DO.get(id);
}

// ==================== 时间工具 ====================

/**
 * 从 YYYY-MM-DD + hh:mm 构造「本地」Date（tzOffsetMs 位移后的视角）。
 * 配合 dueUtcMsFor：localNow 用 UTC getter 读 = 用户视角的年月日时分。
 */
function makeLocalDate(dateStr: string, timeStr: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi, 0, 0));
}

// ==================== 主入口 ====================

/**
 * 同步某待办的精确提醒事件。在 todo CRUD 后调用。
 *
 * 读 todo 状态决定 schedule vs cancel：
 *   - 不存在/删除/完成 → cancel
 *   - 有效 time/end_time → schedule（runAt 过期但未到期则兜底立即触发）
 *   - 无 time/end_time → cancel
 */
export async function syncPreciseReminderForTodo(
  env: Env,
  todoId: string,
): Promise<SyncResult> {
  if (!todoId) return { action: 'skipped', events: [], reason: 'no_todoId' };

  let cfg;
  try {
    const db = createReadDb(env.DB);
    cfg = await getReminderConfig(db);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[precise-reminder] read config failed:', msg);
    return { action: 'skipped', events: [], reason: 'config_read_failed' };
  }

  if (!cfg.precise_enabled) {
    return { action: 'skipped', events: [], reason: 'precise_disabled' };
  }

  // 读 todo（包含 category 信息）
  let todo: typeof todos.$inferSelect | undefined;
  let categoryName = '';
  let categoryColor = '';
  try {
    const db = createReadDb(env.DB);
    todo = await db.select().from(todos).where(eq(todos.id, todoId)).get();
    if (todo && todo.category_id) {
      const cat = await db.select().from(categories).where(eq(categories.id, todo.category_id)).get();
      if (cat) {
        categoryName = cat.name;
        categoryColor = cat.color;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[precise-reminder] read todo failed:', msg);
    return { action: 'skipped', events: [], reason: 'todo_read_failed' };
  }

  const stub = getReminderStub(env);

  // todo 不存在 → cancel 并返回
  if (!todo) {
    try {
      await stub.cancelEvent(todoId);
    } catch (e) {
      console.error('[precise-reminder] cancelEvent failed (todo not found):', e instanceof Error ? e.message : e);
    }
    return { action: 'cancelled', events: [], reason: 'todo_not_found' };
  }

  // 已删除 / 已完成 → cancel 并返回
  if (todo.deleted === 1 || todo.done === 1) {
    try {
      await stub.cancelEvent(todoId);
    } catch (e) {
      console.error('[precise-reminder] cancelEvent failed (deleted/done):', e instanceof Error ? e.message : e);
    }
    return {
      action: 'cancelled',
      events: [],
      reason: todo.deleted === 1 ? 'deleted' : 'done',
    };
  }

  // 无 date 或无 (time/end_time) → cancel 并返回
  if (!todo.date || (!todo.time && !todo.end_time)) {
    try {
      await stub.cancelEvent(todoId);
    } catch (e) {
      console.error('[precise-reminder] cancelEvent failed (no time):', e instanceof Error ? e.message : e);
    }
    return { action: 'cancelled', events: [], reason: 'no_time' };
  }

  // 构建快照
  const snapshot: ScheduleEventData = {
    text: todo.text,
    time: todo.time || '',
    end_time: todo.end_time || '',
    priority: todo.priority || 'low',
    desc: todo.desc || '',
    url: todo.url || '',
    categoryName,
    categoryColor,
  };

  const tzOffsetMs = cfg.timezone_offset * 60 * 1000;
  const leadMs = cfg.precise_lead_minutes * 60 * 1000;
  const now = Date.now();

  const events: Array<{ type: PreciseEventType; runAt: number }> = [];
  const scheduledTypes = new Set<PreciseEventType>();

  /**
   * 计算最终 runAt：
   *   - runAt > now → 正常调度
   *   - runAt <= now 但 todo 未到期 → 兜底 now+1s
   *   - todo 已过期 → null（不调度）
   */
  function computeRunAt(dueMs: number): number | null {
    const rawRunAt = dueMs - leadMs;
    if (rawRunAt > now) return rawRunAt;
    // runAt 已过期；检查 todo 实际到期时间是否仍在未来
    if (dueMs > now) return now + 1000; // 立即触发（1 秒后）
    return null; // todo 已过期，不调度
  }

  // 调度 start 事件
  if (todo.time && /^\d{1,2}:\d{2}$/.test(todo.time)) {
    const localDate = makeLocalDate(todo.date, todo.time);
    const dueMs = dueUtcMsFor(todo.time, localDate, tzOffsetMs);
    if (dueMs !== null) {
      const runAt = computeRunAt(dueMs);
      if (runAt !== null) {
        try {
          await stub.scheduleEvent({ todoId, runAt, type: 'start', data: snapshot });
          events.push({ type: 'start', runAt });
          scheduledTypes.add('start');
        } catch (e) {
          console.error('[precise-reminder] scheduleEvent start failed:', e instanceof Error ? e.message : e);
        }
      }
    }
  }

  // 调度 end 事件
  if (todo.end_time && /^\d{1,2}:\d{2}$/.test(todo.end_time)) {
    const localDate = makeLocalDate(todo.date, todo.end_time);
    const dueMs = dueUtcMsFor(todo.end_time, localDate, tzOffsetMs);
    if (dueMs !== null) {
      const runAt = computeRunAt(dueMs);
      if (runAt !== null) {
        try {
          await stub.scheduleEvent({ todoId, runAt, type: 'end', data: snapshot });
          events.push({ type: 'end', runAt });
          scheduledTypes.add('end');
        } catch (e) {
          console.error('[precise-reminder] scheduleEvent end failed:', e instanceof Error ? e.message : e);
        }
      }
    }
  }

  // 清理未调度的事件类型（如旧 start 事件，新 todo 已无 time 或 todo 已过期）
  if (!scheduledTypes.has('start')) {
    try {
      await stub.cancelEventByType(todoId, 'start');
    } catch (e) {
      console.error('[precise-reminder] cancelEventByType start failed:', e instanceof Error ? e.message : e);
    }
  }
  if (!scheduledTypes.has('end')) {
    try {
      await stub.cancelEventByType(todoId, 'end');
    } catch (e) {
      console.error('[precise-reminder] cancelEventByType end failed:', e instanceof Error ? e.message : e);
    }
  }

  if (events.length === 0) {
    return { action: 'cancelled', events: [], reason: 'all_events_in_past' };
  }
  return { action: 'scheduled', events };
}

/**
 * 批量同步多个 todo 的精确提醒（用于 BATCH_TOGGLE_DONE / BATCH_DELETE）。
 * 并行调用，单个失败不影响其他。
 */
export async function syncPreciseRemindersForTodos(
  env: Env,
  todoIds: string[],
): Promise<SyncResult[]> {
  if (!todoIds || todoIds.length === 0) return [];
  return await Promise.all(
    todoIds.map((id) => syncPreciseReminderForTodo(env, id).catch((e) => ({
      action: 'skipped' as const,
      events: [],
      reason: `error: ${e instanceof Error ? e.message : String(e)}`,
    }))),
  );
}
