/**
 * ReminderDO —— Durable Object 精确提醒（DO Alarm）
 *
 * 设计要点（与 Cron digest 完全并行独立）：
 *   1. 单实例 DO（worker 中通过 `env.REMINDER_DO.idFromName('reminder')` 获取）。
 *      个人应用无需按用户分片。
 *   2. 每个 DO 仅支持 1 个 alarm；本 DO 把多条待办事件存为 storage 行
 *      (`event:<todoId>:<type>` → PreciseEvent)，alarm 触发时批量处理所有到期事件，
 *      然后用最近一个未到期事件重新 setAlarm。
 *   3. 事件类型：`start`（开始时间到点）、`end`（结束时间到点）。
 *   4. 待办详情在 `scheduleEvent` 时快照进 storage；alarm 触发只读一次 D1
 *      `reminder_config`（settings 表单行）以保证配置变更即时生效，
 *      但不回头读 todos 表（避免 D1 延迟 + 已删除数据风险）。
 *   5. 快照新鲜度由 CRUD 联动保证：
 *      - 编辑待办 → cancelEvent + scheduleEvent（刷新快照）
 *      - 删除 / 完成 → cancelEvent（出队）
 *   6. alarm handler 必须 catch 所有异常，否则 CF 6 次重试后停止。
 *      catch 后重新调度 1 分钟后重试。
 *   7. 时区跳过与 Cron 共享：触发时若在 skip_window 内，跳过本次发送
 *      （事件仍清理，不重试，避免下次 alarm 再次触发同样的过期事件）。
 *   8. 幂等键：`cf-todo:precise:<todoId>:<type>:<runAt>`，Resend 24h 内同 key 不重发。
 *   9. alarm handler 内不调用 waitUntil —— 直接 await；DO 在 I/O pending 时保持存活。
 *
 * 与 Cron digest 的边界（必须明确）：
 *   - 配置独立：`precise_enabled` 与 `timed_enabled` 是两个独立开关
 *   - 调度独立：DO Alarm 由 setAlarm(runAt) 精确触发，不依赖 Cron 周期
 *   - 触发独立：DO 只发对应单条待办邮件，不参与 digest 合并
 *   - 数据独立：DO 用自身 storage 存事件队列；Cron 用 D1 settings 存 reminder_state
 *   - 失败独立：DO Alarm 失败不影响 Cron；反之亦然
 *   - 代码复用而非耦合：DO 通过 import 复用 sendEmail / renderModeEmail /
 *     getReminderConfig，但这些函数本身不持有状态，复用安全
 *
 * 与原方案的差异：
 *   - 使用现代 RPC 模式（`extends DurableObject<Env>` + `await stub.scheduleEvent(...)`）
 *   - 使用 `new_sqlite_classes` 而非 legacy `new_classes`（CF 现代推荐）
 *   - 单 alarm 调度策略：取所有事件中最早的 runAt 设为下次 alarm
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../env';
import { createDb } from '../db/client';
import {
  getReminderConfig,
  isInSkipWindow,
  timezoneLabel,
} from '../services/reminder-service';
import { sendEmail } from '../services/resend';
import { renderModeEmail, formatRunTimestamp } from '../services/reminder-template';
import type { EmailItem, EmailSection } from '../services/reminder-template';

// ==================== 类型 ====================

export type PreciseEventType = 'start' | 'end';

export interface PreciseEvent {
  /** 待办 ID（todos.id）。 */
  todoId: string;
  /** 触发时刻（UTC ms）。alarm 调度用，已扣除提前量。 */
  runAt: number;
  /** 事件类型：start=开始时间到点；end=结束时间到点。 */
  type: PreciseEventType;
  /** 待办文本（schedule 时快照）。 */
  text: string;
  /** 开始时间 hh:mm（快照）。 */
  time: string;
  /** 结束时间 hh:mm（快照）。 */
  end_time: string;
  /** 优先级（快照）。 */
  priority: string;
  /** 备注（快照）。 */
  desc: string;
  /** 链接（快照）。 */
  url: string;
  /** 分类名（快照）。 */
  categoryName: string;
  /** 分类颜色（快照）。 */
  categoryColor: string;
}

/** scheduleEvent 的 data 参数：除 todoId / runAt / type 之外的快照字段。 */
export type ScheduleEventData = Omit<PreciseEvent, 'todoId' | 'runAt' | 'type'>;

/** scheduleEvent RPC 入参。 */
export interface ScheduleEventInput {
  todoId: string;
  runAt: number;
  type: PreciseEventType;
  data: ScheduleEventData;
}

// ==================== DO 实现 ====================

export class ReminderDO extends DurableObject<Env> {
  /**
   * 调度一条精确提醒事件。
   *
   * - 写入 `event:<todoId>:<type>` storage 行（覆盖同 todoId+type 的旧事件）
   * - 若新 runAt 比当前 alarm 早，则提前 alarm 到新 runAt
   *
   * @returns 写入后的 alarm 时刻（UTC ms），或 null 表示无 alarm
   */
  async scheduleEvent(input: ScheduleEventInput): Promise<{ alarm: number | null }> {
    const { todoId, runAt, type, data } = input;
    if (!todoId || !Number.isFinite(runAt) || (type !== 'start' && type !== 'end')) {
      return { alarm: await this.getCurrentAlarm() };
    }

    const event: PreciseEvent = { todoId, runAt, type, ...data };
    await this.ctx.storage.put(`event:${todoId}:${type}`, event);

    const currentAlarm = await this.ctx.storage.getAlarm();
    if (currentAlarm === null || runAt < currentAlarm) {
      await this.ctx.storage.setAlarm(runAt);
      return { alarm: runAt };
    }
    return { alarm: currentAlarm };
  }

  /**
   * 取消某待办的所有精确提醒事件（start + end）。
   * 编辑 / 删除 / 完成时调用。完成后重新调度 alarm 到剩余事件中最早的 runAt。
   *
   * @returns 剩余事件数量
   */
  async cancelEvent(todoId: string): Promise<{ remaining: number; alarm: number | null }> {
    if (!todoId) return { remaining: 0, alarm: await this.getCurrentAlarm() };

    const events = await this.ctx.storage.list<PreciseEvent>({ prefix: `event:${todoId}:` });
    const keys = Array.from(events.keys());
    if (keys.length > 0) {
      await this.ctx.storage.delete(keys);
    }

    const { earliest, count } = await this.findEarliest();
    if (earliest !== null) {
      await this.ctx.storage.setAlarm(earliest);
    } else {
      await this.ctx.storage.deleteAlarm();
    }
    return { remaining: count, alarm: earliest };
  }

  /**
   * 取消某待办的特定类型事件（如编辑时只改了 time 不改 end_time，只清 start）。
   */
  async cancelEventByType(todoId: string, type: PreciseEventType): Promise<{ remaining: number; alarm: number | null }> {
    if (!todoId) return { remaining: 0, alarm: await this.getCurrentAlarm() };

    await this.ctx.storage.delete(`event:${todoId}:${type}`);

    const { earliest, count } = await this.findEarliest();
    if (earliest !== null) {
      await this.ctx.storage.setAlarm(earliest);
    } else {
      await this.ctx.storage.deleteAlarm();
    }
    return { remaining: count, alarm: earliest };
  }

  /**
   * 调试用：列出所有当前调度的事件。
   * 不在 alarm 路径上调用，仅供 /api/reminder/precise/alarms 路由使用。
   */
  async listEvents(): Promise<PreciseEvent[]> {
    const map = await this.ctx.storage.list<PreciseEvent>({ prefix: 'event:' });
    return Array.from(map.values()).sort((a, b) => a.runAt - b.runAt);
  }

  /**
   * 调试用：返回当前 alarm 时刻（UTC ms），无 alarm 时为 null。
   */
  async getCurrentAlarm(): Promise<number | null> {
    return await this.ctx.storage.getAlarm();
  }

  // ==================== alarm handler ====================

  /**
   * alarm 触发处理：批量发送所有到期事件 → 重新调度下次 alarm。
   *
   * 容错策略：
   *   - 整个 handler 包 try/catch；异常时重新 setAlarm(Date.now() + 60_000)
   *     避免 6 次重试耗尽
   *   - 单个事件发送失败不阻塞其他事件；事件仍从 storage 清除（幂等键兜底重发）
   *   - 配置关闭 / 在 skip 窗口内 / 缺凭证 → 事件仍清除（不重试，避免死循环）
   */
  async alarm(): Promise<void> {
    try {
      const now = Date.now();
      const events = await this.ctx.storage.list<PreciseEvent>({ prefix: 'event:' });

      const due: PreciseEvent[] = [];
      let nextAlarm: number | null = null;

      for (const [key, event] of events) {
        if (event.runAt <= now) {
          due.push(event);
          await this.ctx.storage.delete(key);
        } else if (nextAlarm === null || event.runAt < nextAlarm) {
          nextAlarm = event.runAt;
        }
      }

      if (due.length > 0) {
        await this.sendPreciseEmails(due);
      }

      if (nextAlarm !== null) {
        await this.ctx.storage.setAlarm(nextAlarm);
      }
      // 若无下次事件，当前 alarm 已被消费 → 不需要 deleteAlarm
    } catch (e) {
      // 异常时重新调度 1 分钟后重试，避免 6 次重试耗尽
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[ReminderDO] alarm() error:', msg);
      try {
        await this.ctx.storage.setAlarm(Date.now() + 60_000);
      } catch {
        // setAlarm 自身失败时只能放弃，等下次 scheduleEvent 重新调度
      }
    }
  }

  // ==================== 私有：邮件发送 ====================

  /**
   * 批量发送到期事件邮件（同一 alarm 触发的所有事件合并为一封邮件）。
   *
   * 合并策略（零配置）：
   *   - 同一 alarm() 触发中处理的所有 due 事件 → 合并为一封邮件
   *   - 按 type 分组为 section：start 事件 → 「即将开始」section；end 事件 → 「即将到期」section
   *   - 单事件：保持原格式 `[开始] <text>` / `[到期] <text>`
   *   - 多事件同类型：`[开始] <text1>、<text2>` / `[到期] <text1>、<text2>`
   *   - 多事件混合类型：`[精确提醒] <text1> 等${N}条`
   *
   * 设计：
   *   - 仅在 alarm 触发时读一次 D1 reminder_config（settings 表单行，~5-20ms）
   *   - 不读 todos 表 —— 用 scheduleEvent 时的快照
   *   - skip 窗口 / 配置关闭 / 缺凭证 → 直接 return，事件已被 alarm 清除
   *   - 幂等键：所有事件的 `todoId:type:runAt` 拼接后 SHA-256，保证同批次稳定
   */
  private async sendPreciseEmails(events: PreciseEvent[]): Promise<void> {
    const db = createDb(this.env.DB);
    const cfg = await getReminderConfig(db);

    // 配置校验：未启用 / 未开启精确 / 缺凭证 → 跳过（事件已被 alarm 清除）
    if (!cfg.enabled || !cfg.precise_enabled) return;
    if (!cfg.recipient || !cfg.from || !this.env.RESEND_API_KEY) return;

    // 时区跳过检查（与 Cron 共享 isInSkipWindow）
    const tzOffsetMs = cfg.timezone_offset * 60 * 1000;
    const localNow = new Date(Date.now() + tzOffsetMs);
    if (isInSkipWindow(localNow, cfg.skip_start, cfg.skip_end)) return;

    const tzLbl = timezoneLabel(cfg.timezone_offset);
    const runStr = formatRunTimestamp(localNow);

    try {
      await this.sendBatchEmail(events, cfg, tzLbl, runStr, localNow);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ReminderDO] send batch email failed (${events.length} events):`, msg);
    }
  }

  /**
   * 将一批到期事件合并为一封邮件发送。
   * 单事件走原始格式；多事件按 type 分组为 section。
   */
  private async sendBatchEmail(
    events: PreciseEvent[],
    cfg: {
      recipient: string;
      from: string;
      app_url?: string;
    },
    tzLbl: string,
    runStr: string,
    localNow: Date,
  ): Promise<void> {
    // 按类型分组（保持事件顺序稳定：按 runAt 升序，同 runAt 按 todoId）
    const sorted = [...events].sort((a, b) =>
      a.runAt !== b.runAt ? a.runAt - b.runAt : a.todoId.localeCompare(b.todoId),
    );
    const startEvents = sorted.filter((e) => e.type === 'start');
    const endEvents = sorted.filter((e) => e.type === 'end');

    // 构建 section
    const sections: EmailSection[] = [];
    if (startEvents.length > 0) {
      sections.push({
        title: startEvents.length === 1 ? '即将开始' : `即将开始（${startEvents.length} 条）`,
        items: startEvents.map((ev) => this.eventToItem(ev)),
        listStyle: 'cards',
      });
    }
    if (endEvents.length > 0) {
      sections.push({
        title: endEvents.length === 1 ? '即将到期' : `即将到期（${endEvents.length} 条）`,
        items: endEvents.map((ev) => this.eventToItem(ev)),
        listStyle: 'cards',
      });
    }

    // 构建主题
    const subject = this.buildBatchSubject(sorted, startEvents.length, endEvents.length);

    // 构建副标题
    const subtitleParts: string[] = [];
    if (startEvents.length > 0) subtitleParts.push(`START×${startEvents.length}`);
    if (endEvents.length > 0) subtitleParts.push(`DUE×${endEvents.length}`);
    const subtitle = `${subtitleParts.join(' ')} · ${runStr} ${tzLbl}`;

    const { html, text } = renderModeEmail({
      title: subject,
      subtitle,
      sections,
      runAt: localNow,
      timezoneLabel: tzLbl,
      appUrl: cfg.app_url,
      footerNote: '本邮件由 cf-todo 精确提醒（DO Alarm）自动发送。',
    });

    // 幂等键：单事件用原始格式；多事件用 SHA-256（保证稳定 + 长度可控）
    let idempotencyKey: string;
    if (events.length === 1) {
      const ev = events[0];
      idempotencyKey = `cf-todo:precise:${ev.todoId}:${ev.type}:${ev.runAt}`;
    } else {
      // 多事件：拼接所有事件 key → SHA-256 → 稳定短串
      const keyParts = sorted
        .map((e) => `${e.todoId}:${e.type}:${e.runAt}`)
        .join('|');
      const hash = await sha256Hex(keyParts);
      idempotencyKey = `cf-todo:precise-batch:${hash.slice(0, 16)}`;
    }

    await sendEmail(this.env.RESEND_API_KEY, {
      from: cfg.from,
      to: cfg.recipient,
      subject,
      html,
      text,
      idempotencyKey,
    });
  }

  /** 将事件转为邮件 item。同时携带 time 和 end_time，让卡片渲染完整时间范围。 */
  private eventToItem(ev: PreciseEvent): EmailItem {
    return {
      text: ev.text,
      time: ev.time || undefined,
      end_time: ev.end_time || undefined,
      priority: ev.priority,
      desc: ev.desc || undefined,
      url: ev.url || undefined,
      categoryName: ev.categoryName || undefined,
      categoryColor: ev.categoryColor || undefined,
    };
  }

  /**
   * 构建邮件主题：
   *   - 单事件：`[开始] <text>` / `[到期] <text>`（保持原格式）
   *   - 多事件同类型：`[开始] <text1>、<text2>` / `[到期] <text1>、<text2>`
   *   - 多事件混合类型：`[精确提醒] <text1> 等${N}条`
   *
   * 主题长度上限 100 字符，超出时截断为 `<前缀>...等N条`。
   */
  private buildBatchSubject(
    sorted: PreciseEvent[],
    startCount: number,
    endCount: number,
  ): string {
    const MAX_LEN = 100;

    if (sorted.length === 1) {
      const ev = sorted[0];
      return `${ev.type === 'start' ? '[开始]' : '[到期]'} ${ev.text}`;
    }

    if (startCount > 0 && endCount === 0) {
      // 全部 start
      const tag = '[开始]';
      const texts = sorted.map((e) => e.text).join('、');
      if (texts.length > MAX_LEN - tag.length - 10) {
        return `${tag} ${sorted[0].text} 等${sorted.length}条`;
      }
      return `${tag} ${texts}`;
    }

    if (endCount > 0 && startCount === 0) {
      // 全部 end
      const tag = '[到期]';
      const texts = sorted.map((e) => e.text).join('、');
      if (texts.length > MAX_LEN - tag.length - 10) {
        return `${tag} ${sorted[0].text} 等${sorted.length}条`;
      }
      return `${tag} ${texts}`;
    }

    // 混合类型
    return `[精确提醒] ${sorted[0].text} 等${sorted.length}条`;
  }

  // ==================== 私有：调度工具 ====================

  /** 扫描所有事件，返回最早 runAt 与事件总数。 */
  private async findEarliest(): Promise<{ earliest: number | null; count: number }> {
    const events = await this.ctx.storage.list<PreciseEvent>({ prefix: 'event:' });
    let earliest: number | null = null;
    let count = 0;
    for (const event of events.values()) {
      count++;
      if (earliest === null || event.runAt < earliest) {
        earliest = event.runAt;
      }
    }
    return { earliest, count };
  }
}

/** SHA-256 hex（用于多事件幂等键）。DO 内部用，不导出。 */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
