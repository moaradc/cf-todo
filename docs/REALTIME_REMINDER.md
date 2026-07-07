# 实时提醒方案：Durable Objects Alarm + 邮件

## 概述

将当前的 Cron 每 4 小时轮询升级为**Durable Objects Alarm 精确调度**，在待办到期前精确触发邮件提醒。不再依赖 Cron 轮询，而是为每个待办设置精确的 Alarm 时间点。

## 架构

```
用户创建待办 time=14:30, leadMinutes=15
  → POST /api/reminder/schedule → DO.scheduleEvent()
  → DO storage.put('event:<todoId>:start', {runAt: 14:15, todoId, type, ...})
  → DO storage.setAlarm(最近的 runAt)

14:15 DO Alarm 触发
  → alarm() 处理所有到期事件
  → 邮件（Resend API）
  → 清理已处理事件
  → setAlarm(下一个最近事件)
```

## 与现有 Cron 的关系

- **Cron（每 4 小时）**: 保留，负责 daily/priority/搜索词等汇总型提醒
- **DO Alarm（精确触发）**: 新增，负责 timed 模式（起止提醒）的精确触发
- 两者并行运行，timed 模式从 Cron 迁移到 DO Alarm，其他模式仍用 Cron

## 组件

### 1. Durable Object: `ReminderDO`

**文件**: `src/do/reminder-do.ts`

**职责**:
- 存储所有待办提醒事件（`event:<todoId>:<type>` → `{runAt, todoId, type, text, time, priority, ...}`）
- `scheduleEvent(todoId, runAt, type, data)`: 添加/更新事件，重新调度 alarm
- `cancelEvent(todoId)`: 删除事件，重新调度 alarm
- `alarm()`: 处理到期事件 → 发送邮件 → 重新调度

**设计决策**:
- 个人应用，使用单一 DO 实例（`id = 'reminder'`）
- 每个 DO 只能有 1 个 alarm，存储多个事件，alarm 触发时批量处理到期事件
- 事件类型: `start`（开始时间到期）、`end`（结束时间到期）
- alarm handler 内 catch 所有异常，避免耗尽 6 次重试
- DO 从 D1 读取提醒配置（收件人、发件人等），从 D1 读取待办详情

**关键代码模式**（参考 CF 官方文档）:
```typescript
import { DurableObject } from 'cloudflare:workers';

export class ReminderDO extends DurableObject {
  async scheduleEvent(todoId: string, runAt: number, type: string, data: object) {
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
      const events = await this.ctx.storage.list({ prefix: 'event:' });
      let nextAlarm: number | null = null;

      for (const [key, event] of events) {
        if (event.runAt <= now) {
          await this.processEvent(event);
          await this.ctx.storage.delete(key);
        } else if (!nextAlarm || event.runAt < nextAlarm) {
          nextAlarm = event.runAt;
        }
      }

      if (nextAlarm) await this.ctx.storage.setAlarm(nextAlarm);
    } catch (e) {
      // catch 所有异常，重新调度 1 分钟后重试
      await this.ctx.storage.setAlarm(Date.now() + 60000);
    }
  }

  private async processEvent(event) {
    // 从 D1 读取提醒配置 + 待办详情
    // 调用 Resend API 发送邮件
  }

  private async rescheduleAlarm() {
    const events = await this.ctx.storage.list({ prefix: 'event:' });
    let earliest: number | null = null;
    for (const [, event] of events) {
      if (!earliest || event.runAt < earliest) earliest = event.runAt;
    }
    if (earliest) {
      await this.ctx.storage.setAlarm(earliest);
    } else {
      await this.ctx.storage.deleteAlarm();
    }
  }
}
```

### 2. 调度路由

**文件**: `src/routes/v0/reminder.ts`（扩展现有）

**新增路由**:
- `POST /api/reminder/schedule` — 调度提醒（供待办 CRUD 调用）
  - body: `{ todoId, date, time, endTime, leadMinutes, timezoneOffset }`
  - 计算 runAt = time - leadMinutes（开始提醒）和 end_time - leadMinutes（到期提醒）
  - 调用 DO.scheduleEvent()
- `POST /api/reminder/cancel` — 取消提醒（待办删除/完成时调用）
  - body: `{ todoId }`
  - 调用 DO.cancelEvent()
- `GET /api/reminder/alarms` — 查看当前调度的 alarm（调试用）

### 3. 待办 CRUD 联动

**创建待办时**:
- 如果有 time/end_time + timed_enabled → POST /api/reminder/schedule
- 计算 runAt = time - leadMinutes（或 end_time - leadMinutes）

**编辑待办时**:
- 先 POST /api/reminder/cancel（取消旧的）
- 再 POST /api/reminder/schedule（调度新的）

**删除/完成待办时**:
- POST /api/reminder/cancel

### 4. 配置变更

**wrangler.toml**:
```toml
[[durable_objects.bindings]]
name = "REMINDER_DO"
class_name = "ReminderDO"

[[migrations]]
tag = "v1"
new_classes = ["ReminderDO"]
```

**env.ts**:
```typescript
export interface Env {
  // ... 现有字段
  REMINDER_DO: DurableObjectNamespace;
}
```

**worker.ts**:
```typescript
export { ReminderDO } from './do/reminder-do';

export default {
  fetch: app.fetch,
  scheduled: ...,
} as const;
```

## 实施阶段

### 第一阶段：后端骨架
1. wrangler.toml + env.ts 配置（DO 绑定 + migration）
2. `src/do/reminder-do.ts` — DO 类（alarm 调度 + 事件管理 + 邮件发送）
3. `src/routes/v0/reminder.ts` 扩展（schedule/cancel 路由）
4. `worker.ts` 注册 DO export
5. typecheck + build + test

### 第二阶段：待办 CRUD 联动
1. `todo-service.ts` 创建/编辑/删除时调用 schedule/cancel
2. 前端调用 `/api/reminder/schedule` 和 `/api/reminder/cancel`

### 第三阶段：部署 + 测试
1. 部署（DO migration 自动创建）
2. 端到端测试

## 注意事项

1. **DO 单 alarm 限制**: 每个 DO 只能 1 个 alarm，通过存储多事件 + alarm 内批量处理解决
2. **alarm 异常处理**: `alarm()` handler 必须 catch 所有异常，否则 6 次重试后停止。catch 后重新调度 1 分钟后重试
3. **构造函数不要 setAlarm**: DO 唤醒时构造函数先于 alarm handler 执行，构造函数中 setAlarm 会干扰已有 alarm
4. **跨时区**: 提醒时间基于用户配置的 timezone_offset，DO 内部统一用 UTC 时间戳
5. **个人应用**: 使用单一 DO 实例（id='reminder'），不需要按用户分片
6. **DO 从 D1 读数据**: DO 内部需要访问 D1 读取提醒配置和待办详情，通过 env.DB binding
7. **与 Cron 并行**: timed 模式从 Cron 迁移到 DO Alarm，Cron 仍负责 daily/priority/搜索词
8. **alarm 至少一次执行**: 失败自动重试（指数退避，最多 6 次）
