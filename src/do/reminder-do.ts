/**
 * ReminderDO —— 精确提醒 Durable Object
 *
 * 单实例（id='reminder'），与 Cron digest 完全独立。
 * 多事件共享单个 alarm：storage 存事件队列，alarm 触发时批量处理到期事件。
 * 事件类型：start（开始到点）/ end（结束到点）。
 * 待办详情在 scheduleEvent 时快照，alarm 触发不读 todos 表。
 * alarm() 内 try/catch + 60s 兜底重试，避免 6 次重试耗尽。
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
  /** 调度一条精确提醒事件。覆盖同 todoId+type 的旧事件，必要时提前 alarm。 */
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

  /** 取消某待办的所有事件（start + end），重新调度 alarm。 */
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

  /** 取消某待办的特定类型事件。 */
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

  /** 调试用：列出所有事件。 */
  async listEvents(): Promise<PreciseEvent[]> {
    const map = await this.ctx.storage.list<PreciseEvent>({ prefix: 'event:' });
    return Array.from(map.values()).sort((a, b) => a.runAt - b.runAt);
  }

  /** 调试用：当前 alarm 时刻（UTC ms）。 */
  async getCurrentAlarm(): Promise<number | null> {
    return await this.ctx.storage.getAlarm();
  }

  /** 清理死事件：删除 runAt <= now 的事件，重新调度 alarm。 */
  async clearPast(): Promise<{ cleared: number; remaining: number; alarm: number | null }> {
    const now = Date.now();
    const events = await this.ctx.storage.list<PreciseEvent>({ prefix: 'event:' });

    const deadKeys: string[] = [];
    let earliest: number | null = null;
    let remaining = 0;

    for (const [key, event] of events) {
      if (event.runAt <= now) {
        deadKeys.push(key);
      } else {
        remaining++;
        if (earliest === null || event.runAt < earliest) {
          earliest = event.runAt;
        }
      }
    }

    if (deadKeys.length > 0) {
      await this.ctx.storage.delete(deadKeys);
    }

    // 重新调度 alarm
    if (earliest !== null) {
      await this.ctx.storage.setAlarm(earliest);
    } else {
      await this.ctx.storage.deleteAlarm();
    }

    return { cleared: deadKeys.length, remaining, alarm: earliest };
  }

  /** 清空所有事件 + 取消 alarm（调试用）。 */
  async clearAll(): Promise<{ cleared: number }> {
    const events = await this.ctx.storage.list<PreciseEvent>({ prefix: 'event:' });
    const keys = Array.from(events.keys());
    if (keys.length > 0) {
      await this.ctx.storage.delete(keys);
    }
    await this.ctx.storage.deleteAlarm();
    return { cleared: keys.length };
  }

  // ==================== alarm handler ====================

  /** alarm 触发：批量处理到期事件 → 发邮件 → 重新调度。异常时 60s 后重试。 */
  async alarm(): Promise<void> {
    try {
      const now = Date.now();
      const events = await this.ctx.storage.list<PreciseEvent>({ prefix: 'event:' });

      const due: PreciseEvent[] = [];
      const deadKeys: string[] = []; // 防御性兜底：理论上 due 已覆盖所有 runAt <= now
      let nextAlarm: number | null = null;

      for (const [key, event] of events) {
        if (event.runAt <= now) {
          due.push(event);
          deadKeys.push(key); // 收集后批量删，减少 storage 调用
        } else if (nextAlarm === null || event.runAt < nextAlarm) {
          nextAlarm = event.runAt;
        }
      }

      // 批量删除到期/死事件
      if (deadKeys.length > 0) {
        await this.ctx.storage.delete(deadKeys);
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

  /** 批量发送到期事件邮件（同一 alarm 内合并为一封）。 */
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

  /** 将一批事件合并为一封邮件发送。 */
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
      footerNote: '本邮件由 cf-todo 精确提醒服务自动发送。',
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

  /** 构建邮件主题。单事件 `[开始] text`；多事件按类型拼接，超 100 字符截断。 */
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

/** SHA-256 hex（用于多事件幂等键）。 */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
