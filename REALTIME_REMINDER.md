# 实时提醒方案：Durable Objects Alarm + 邮件（与现有 Cron 并行）

## 概述

新增一项**独立功能**：Durable Objects Alarm 精确提醒。

- **不替换**、**不升级**、**不迁移**现有的 Cron digest 系统
- 与现有 Cron **并行运行**，两者互不影响
- 用户可以单独启用 / 关闭本功能，开关独立于 `timed_enabled` / `daily_enabled` / `priority_enabled`
- 单条待办到期前精确触发（精确到分钟），每条提醒一封独立邮件
- 复用现有代码与数据：`sendEmail`（Resend 客户端）、`renderModeEmail`（ECHO 模板）、`getReminderConfig`（配置读取）、`todos` 表（数据源）

## 两套系统对比

| 维度 | 现有 Cron digest（保留不动） | 新增 DO Alarm 精确提醒（本方案） |
|---|---|---|
| 触发方式 | Cron 每 4 小时扫描 | 单条待办到点 DO Alarm 精确触发 |
| 邮件形态 | 多模式合并为一封 digest | 每条待办一封独立邮件 |
| 模式 | timed / priority / daily / search 共存 | 仅按 time / end_time 精确触发 |
| 配置开关 | `enabled` + `timed_enabled` + `daily_enabled` + `priority_enabled` | 新增 `precise_enabled` + `precise_lead_minutes` |
| 提前量 | `timed_lead_minutes`（扫描窗口） | `precise_lead_minutes`（精确调度） |
| 数据源 | D1 todos 表 | D1 todos 表（同源） |
| 邮件发送 | `sendEmail` (resend.ts) | `sendEmail` (resend.ts) **复用** |
| 邮件模板 | `renderModeEmail` (reminder-template.ts) | `renderModeEmail` **复用**，传入单 section |
| 幂等键 | `cf-todo:digest:<bucket>:<hash>` | `cf-todo:precise:<todoId>:<type>:<runAt>` |
| 时区跳过 | `skip_start` / `skip_end` 共享 | **共享同一配置**（避免用户重复填写） |
| 邮件主题 | 各模式 summary 用「·」拼接 | `[开始] <text>` / `[到期] <text>` |

**关键原则**：

1. 两套系统可同时启用，也可只启用一个，互不依赖
2. 同一条待办可能同时被两套系统提醒（Cron 的 timed 模式 + DO Alarm），这是**预期行为**，不去重
3. 用户若希望只走精确提醒，可关闭 Cron 的 `timed_enabled`；若希望只走 digest，可关闭 `precise_enabled`
4. 现有 `reminder_config` 字段全部保留语义不变，仅**追加**新字段

## 架构

```
用户创建待办 time=14:30, precise_lead_minutes=15, precise_enabled=true
  → todo-service.create() 内部调用 POST /api/reminder/precise/schedule
  → 路由调用 DO.scheduleEvent(todoId, runAt=14:15, type='start', data={...})
  → DO storage.put('event:<todoId>:start', {runAt, todoId, type, ...})
  → DO storage.setAlarm(最近的 runAt)

14:15 DO Alarm 触发
  → alarm() 处理所有到期事件
  → 从 D1 读取 reminder_config（仅 1 行 settings，复用 getReminderConfig）
  → 待办详情使用 scheduleEvent 时存的快照（不读 todos 表）
  → 调用 sendEmail + renderModeEmail（复用）
  → 清理已处理事件
  → setAlarm(下一个最近事件)

与此同时，Cron 仍每 4 小时独立运行 digest 流程，互不感知
```

## 与现有 Cron 的关系（明确边界）

**完全独立**，体现为：

1. **配置独立**：`precise_enabled` 与 `timed_enabled` 是两个独立开关，互不影响
2. **调度独立**：DO Alarm 由 `setAlarm(runAt)` 精确触发，不依赖 Cron 周期
3. **触发独立**：DO Alarm 触发只发对应单条待办的邮件，不参与 digest 合并
4. **数据独立**：DO 用自身 storage 存事件队列；Cron 用 D1 settings 存 `reminder_state`，两者不共享状态
5. **失败独立**：DO Alarm 失败不影响 Cron；Cron 失败不影响 DO Alarm
6. **代码复用而非耦合**：DO 通过函数调用复用 `sendEmail` / `renderModeEmail` / `getReminderConfig`，但这些函数本身不持有状态，复用安全

**复用清单**：

| 复用对象 | 文件 | 复用方式 |
|---|---|---|
| `sendEmail` | `src/services/resend.ts` | DO 内 `import { sendEmail }` 直接调用 |
| `renderModeEmail` | `src/services/reminder-template.ts` | DO 内构造单元素 `sections` 数组传入 |
| `EmailItem` / `EmailSection` 类型 | `src/services/reminder-template.ts` | DO 内 import 类型 |
| `getReminderConfig` | `src/services/reminder-service.ts` | DO 内 `createDb(env.DB)` + `getReminderConfig(db)` |
| `normalizeConfig` | `src/services/reminder-service.ts` | 路由层保存配置时调用，需扩展默认值 |
| `ReminderConfig` 类型 | `src/services/reminder-service.ts` | 追加 `precise_enabled` / `precise_lead_minutes` 字段 |
| `isInSkipWindow` | `src/services/reminder-service.ts` | **需 export**，DO 触发时共享时区跳过逻辑 |
| `dueUtcMsFor` | `src/services/reminder-service.ts` | **需 export**，DO 计算 runAt 时复用 |
| `todos` 表 + `categories` 表 | D1 schema | 路由层 schedule 时读取一次，把快照传入 DO；DO alarm 触发时不读 |

## 组件

### 1. Durable Object: `ReminderDO`

**文件**: `src/do/reminder-do.ts`（新增）

**职责**:
- 存储所有精确提醒事件（`event:<todoId>:<type>` → `{runAt, todoId, type, text, time, end_time, priority, ...}`）
- `scheduleEvent(todoId, runAt, type, data)`: 添加/更新事件，重新调度 alarm
- `cancelEvent(todoId)`: 删除该 todo 的所有事件，重新调度 alarm
- `cancelEventByType(todoId, type)`: 删除特定类型事件（编辑时只改了 time 不改 end_time）
- `alarm()`: 处理到期事件 → 发送邮件 → 重新调度

**设计决策**:
- 个人应用，使用单一 DO 实例（`id = 'reminder'`），不需要按用户分片
- 每个 DO 只能有 1 个 alarm，存储多个事件，alarm 触发时批量处理所有到期事件
- 事件类型: `start`（开始时间到点）、`end`（结束时间到点）
- **待办详情快照存储**：`scheduleEvent` 时把 `text / time / end_time / priority / desc / url / categoryName / categoryColor` 全部写入 DO storage，alarm 触发时**不回头读 D1 todos 表**，避免 D1 延迟
- 快照新鲜度由 CRUD 联动保证：编辑待办 → `cancelEvent` + `scheduleEvent`（刷新快照）；删除 / 完成 → `cancelEvent`（出队）
- alarm handler 内 catch 所有异常，避免耗尽 6 次重试
- DO 只在 alarm 触发时读一次 D1 的 `reminder_config`（settings 表单行读，~5-20ms），因为配置可能在 schedule 后被用户修改
- 时区跳过逻辑与 Cron 共享：触发时若在 `skip_start` ~ `skip_end` 内，跳过本次发送（事件仍清理，不重试）
- 与 Cron 不共享 state：DO 自己维护事件队列，不读 / 不写 `reminder_state`
- 真正的延迟瓶颈是 Resend API 调用（~300-800ms/封），D1 读可忽略；多事件可 `Promise.all` 并行发信

**关键代码模式**（参考 CF 官方文档）:
```typescript
import { DurableObject } from 'cloudflare:workers';
import { createDb } from '../db/client';
import { getReminderConfig } from '../services/reminder-service';
import { isInSkipWindow, dueUtcMsFor } from '../services/reminder-service';
import { sendEmail } from '../services/resend';
import { renderModeEmail } from '../services/reminder-template';
import type { EmailItem, EmailSection } from '../services/reminder-template';

interface PreciseEvent {
  todoId: string;
  runAt: number;       // UTC ms
  type: 'start' | 'end';
  text: string;
  time: string;
  end_time: string;
  priority: string;
  desc: string;
  url: string;
  categoryName: string;
  categoryColor: string;
}

export class ReminderDO extends DurableObject {
  async scheduleEvent(todoId: string, runAt: number, type: 'start' | 'end', data: Omit<PreciseEvent, 'todoId' | 'runAt' | 'type'>) {
    await this.ctx.storage.put(`event:${todoId}:${type}`, { todoId, runAt, type, ...data });
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (!currentAlarm || runAt < currentAlarm) {
      await this.ctx.storage.setAlarm(runAt);
    }
  }

  async cancelEvent(todoId: string) {
    const events = await this.ctx.storage.list({ prefix: `event:${todoId}:` });
    for (const [key] of events) {
      await this.ctx.storage.delete(key);
    }
    await this.rescheduleAlarm();
  }

  async alarm() {
    try {
      const now = Date.now();
      const events = await this.ctx.storage.list<PreciseEvent>({ prefix: 'event:' });
      const due: PreciseEvent[] = [];
      let nextAlarm: number | null = null;

      for (const [key, event] of events) {
        if (event.runAt <= now) {
          due.push(event);
          await this.ctx.storage.delete(key);
        } else if (!nextAlarm || event.runAt < nextAlarm) {
          nextAlarm = event.runAt;
        }
      }

      // 批量发送：每条事件一封邮件（不复用 digest 合并逻辑）
      if (due.length > 0) {
        await this.sendPreciseEmails(due);
      }

      if (nextAlarm) await this.ctx.storage.setAlarm(nextAlarm);
    } catch (e) {
      // catch 所有异常，重新调度 1 分钟后重试
      await this.ctx.storage.setAlarm(Date.now() + 60000);
    }
  }

  private async sendPreciseEmails(events: PreciseEvent[]) {
    const db = createDb(this.env.DB);
    const cfg = await getReminderConfig(db);
    if (!cfg.enabled || !cfg.precise_enabled) return;  // 用户关闭则跳过
    if (!cfg.recipient || !cfg.from || !this.env.RESEND_API_KEY) return;

    const tzOffsetMs = cfg.timezone_offset * 60 * 1000;
    const localNow = new Date(Date.now() + tzOffsetMs);
    if (isInSkipWindow(localNow, cfg.skip_start, cfg.skip_end)) return;

    for (const ev of events) {
      const item: EmailItem = {
        text: ev.text, time: ev.type === 'start' ? ev.time : ev.end_time,
        priority: ev.priority, desc: ev.desc || undefined, url: ev.url || undefined,
        categoryName: ev.categoryName || undefined, categoryColor: ev.categoryColor || undefined,
      };
      const section: EmailSection = {
        title: ev.type === 'start' ? '即将开始' : '即将到期',
        items: [item], listStyle: 'cards',
      };
      const subject = `${ev.type === 'start' ? '[开始]' : '[到期]'} ${ev.text}`;
      const subtitle = `${ev.type === 'start' ? 'START' : 'DUE'} · ${formatRunTimestamp(localNow)}`;
      const { html, text } = renderModeEmail({
        title: subject, subtitle, sections: [section],
        runAt: localNow, timezoneLabel: tzLabel(cfg.timezone_offset), appUrl: cfg.app_url,
        footerNote: '本邮件由 cf-todo 精确提醒（DO Alarm）自动发送。',
      });
      // 幂等键：每条事件独立，同 todoId+type+runAt 24h 内不重发
      await sendEmail(this.env.RESEND_API_KEY, {
        from: cfg.from, to: cfg.recipient, subject, html, text,
        idempotencyKey: `cf-todo:precise:${ev.todoId}:${ev.type}:${ev.runAt}`,
      });
    }
  }

  private async rescheduleAlarm() {
    const events = await this.ctx.storage.list<PreciseEvent>({ prefix: 'event:' });
    let earliest: number | null = null;
    for (const [, event] of events) {
      if (!earliest || event.runAt < earliest) earliest = event.runAt;
    }
    if (earliest) await this.ctx.storage.setAlarm(earliest);
    else await this.ctx.storage.deleteAlarm();
  }
}
```

### 2. 调度路由（与现有 `/api/reminder/*` 同文件，独立路径前缀）

**文件**: `src/routes/v0/reminder.ts`（扩展现有，**不修改现有路由**）

**新增路由**（前缀 `/precise` 与现有 digest 路由隔离）:
- `POST /api/reminder/precise/schedule` — 调度精确提醒
  - body: `{ todoId, date, time, endTime, leadMinutes, timezoneOffset }`
  - 计算 `runAt = time - leadMinutes`（开始）和 `runAt = end_time - leadMinutes`（到期）
  - 调用 `DO.scheduleEvent()`
- `POST /api/reminder/precise/cancel` — 取消某待办所有精确提醒
  - body: `{ todoId }`
  - 调用 `DO.cancelEvent()`
- `GET /api/reminder/precise/alarms` — 查看当前调度的 alarm（调试用，可选）

### 3. 待办 CRUD 联动

仅在 `precise_enabled === true` 时触发，避免无谓 DO 调用：

**创建待办时**:
- 如果有 `time` / `end_time` + `precise_enabled` → POST `/api/reminder/precise/schedule`

**编辑待办时**:
- 先 POST `/api/reminder/precise/cancel`（取消旧的）
- 若新值仍有效且 `precise_enabled` → POST `/api/reminder/precise/schedule`

**删除 / 完成待办时**:
- POST `/api/reminder/precise/cancel`

**注意**：Cron digest 路径完全不感知这些调用，仍按 4 小时周期独立扫描。

### 4. 配置变更

**`ReminderConfig` 类型扩展**（追加字段，不修改现有字段语义）:
```typescript
export interface ReminderConfig {
  // ... 现有字段全部保留 ...
  // 新增：精确提醒（DO Alarm）
  precise_enabled: boolean;
  precise_lead_minutes: number;  // 1 ~ 1440，默认 15
}
```

**`normalizeConfig` 默认值**:
```typescript
precise_enabled: r.precise_enabled === true,
precise_lead_minutes: clamp(r.precise_lead_minutes, 1, 1440, 15),
```

**导入 / 导出**：`io-service.ts` 的导出已包含整个 `reminder_config` 对象，新字段自动随导出，无需改动。

**`wrangler.toml`**:
```toml
# 现有配置全部保留
[[d1_databases]]
binding = "DB"
database_name = "todo-db"
database_id = "..."

[triggers]
crons = ["0 */4 * * *"]   # Cron 不变

# 新增 DO 绑定
[[durable_objects.bindings]]
name = "REMINDER_DO"
class_name = "ReminderDO"

[[migrations]]
tag = "v1"
new_classes = ["ReminderDO"]
```

**线上残留清理**（如有）：若线上已存在同名 DO 类，部署时会因 `class "ReminderDO" not found` 等错误失败。处理方式：
```toml
# 先用 delete-class migration 清理残留
[[migrations]]
tag = "v1"
deleted_classes = ["ReminderDO"]   # 临时一次

# 下次部署恢复为 new_classes
# [[migrations]]
# tag = "v2"
# new_classes = ["ReminderDO"]
```

或一次性使用 `new_classes` 直接覆盖（若线上类从未真正实例化）。

**`env.ts`**:
```typescript
export interface Env {
  // ... 现有字段 ...
  REMINDER_DO: DurableObjectNamespace;
}
```

**`worker.ts`**:
```typescript
import { ReminderDO } from './do/reminder-do';
export { ReminderDO };

export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(handleScheduled(env));  // 现有 Cron digest，不变
  },
} as const;
```

### 5. 前端 UI

**文件**: `src/html/body.js`（设置页邮件通知卡片）

**新增 UI 元素**（在现有 timed/priority/daily 卡片之后追加，不修改现有元素）:
- 「精确提醒（DO Alarm）」开关 pill
- 「提前分钟数」复用现有「选择开始时间」模态框
- 副标题说明：「与上方 digest 提醒独立，单条待办到点单独发邮件」

**联动逻辑**（`src/html/js/core.js`）:
- 待办 CRUD 时检查 `precise_enabled`，启用则调用 `/api/reminder/precise/schedule|cancel`
- 现有 timed digest 调用不变

## 实施阶段

### 第一阶段：后端骨架（不影响现有功能）
1. `wrangler.toml` + `env.ts` 配置（DO 绑定 + migration）
2. `src/do/reminder-do.ts` — DO 类（alarm 调度 + 事件管理 + 邮件发送）
3. `src/services/reminder-service.ts` 追加 `precise_enabled` / `precise_lead_minutes` 字段 + export `isInSkipWindow` / `dueUtcMsFor`
4. `src/routes/v0/reminder.ts` 追加 `/precise/schedule` / `/precise/cancel` 路由
5. `worker.ts` 注册 DO export
6. typecheck + build + 部署验证 DO 创建成功

### 第二阶段：待办 CRUD 联动
1. `todo-service.ts` 创建 / 编辑 / 删除时，若 `precise_enabled` 则调用 schedule / cancel
2. 前端 `core.js` 检查 `precise_enabled` 并触发调用
3. 前端 `body.js` 追加精确提醒开关 UI

### 第三阶段：端到端测试
1. 关闭 `precise_enabled`，确认 Cron digest 行为完全不变
2. 开启 `precise_enabled`，创建带 `time` 的待办，验证到点收到独立邮件
3. 同时开启两套系统，验证同一条待办可能收到两封邮件（一封 digest 一封精确），无报错
4. 验证 `skip_start` / `skip_end` 对两套系统都生效

## 注意事项

1. **DO 单 alarm 限制**: 每个 DO 只能 1 个 alarm，通过存储多事件 + alarm 内批量处理解决
2. **alarm 异常处理**: `alarm()` handler 必须 catch 所有异常，否则 6 次重试后停止。catch 后重新调度 1 分钟后重试
3. **构造函数不要 setAlarm**: DO 唤醒时构造函数先于 alarm handler 执行，构造函数中 setAlarm 会干扰已有 alarm
4. **跨时区**: 提醒时间基于用户配置的 `timezone_offset`，DO 内部统一用 UTC 时间戳
5. **个人应用**: 使用单一 DO 实例（`id='reminder'`），不需要按用户分片
6. **DO 不在 alarm 时读 todos 表**：待办详情在 `scheduleEvent` 时快照进 DO storage，alarm 触发只读一次 `reminder_config`（settings 表单行）。CRUD 联动保证快照新鲜
7. **与 Cron 完全并行**: 两套系统互不感知，不去重，不共享 state。用户可独立启停
8. **alarm 至少一次执行**: 失败自动重试（指数退避，最多 6 次），幂等键保证不重发
9. **配置兼容性**: 旧 `reminder_config`（无 `precise_*` 字段）经 `normalizeConfig` 后默认 `precise_enabled=false`，不影响已有用户
10. **导入 / 导出兼容**: `io-service.ts` 导出整个 `reminder_config` 对象，新字段自动包含；导入时 `normalizeConfig` 兜底缺省字段
