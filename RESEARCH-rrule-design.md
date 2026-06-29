# RFC 5545 RRULE 业界设计调研报告

> 调研对象：Google Calendar / Microsoft Graph / Apple Calendar / Todoist / TickTick / Nylas / Thunderbird / RFC 5545 标准 / UX Medium 文章
> 调研目的：为 cf-todo v3.0 破坏性变更提供设计参考

---

## 一、API 字段设计对比

### 1.1 Google Calendar API —— 纯 RRULE 字符串派

**字段**：`recurrence: string[]`（数组，每个元素是 `RRULE:` / `EXDATE:` / `RDATE:` 前缀的字符串）

**示例**：
```json
{
  "start": { "dateTime": "2011-06-03T10:00:00-07:00", "timeZone": "America/Los_Angeles" },
  "end":   { "dateTime": "2011-06-03T10:25:00-07:00", "timeZone": "America/Los_Angeles" },
  "recurrence": ["RRULE:FREQ=WEEKLY;UNTIL=20110701T170000Z"]
}
```

**关键设计**：
- 顶层 `recurrence` 字段是数组，支持多 RRULE / EXDATE / RDATE 混合
- DTSTART 由 `start.dateTime` 提供（与 RRULE 解耦）
- 时区独立字段 `timeZone`（Olson ID 如 `America/Los_Angeles`）
- 实例修改用 `instances()` API 单独操作，修改时通过 `originalStartTime` 关联到母事件

**可借鉴点**：
- ✅ 用数组容器（未来扩展 RDATE/EXDATE 顶层属性）
- ✅ DTSTART 独立于 RRULE（与 cf-todo 当前 `anchor_date` 一致）
- ✅ 时区独立字段（cf-todo 当前隐式 UTC，未来可加 `tz` 字段）

### 1.2 Microsoft Graph API —— 结构化对象派（反例）

**字段**：`recurrence: { pattern: recurrencePattern, range: recurrenceRange }`

**recurrencePattern**：
| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | enum | `daily` / `weekly` / `absoluteMonthly` / `relativeMonthly` / `absoluteYearly` / `relativeYearly` |
| `interval` | int | 间隔 |
| `daysOfWeek` | enum[] | `sunday`...`saturday` |
| `dayOfMonth` | int | 1-31 |
| `month` | int | 1-12 |
| `firstDayOfWeek` | enum | 默认 `sunday` |
| `index` | enum | `first` / `second` / `third` / `fourth` / `last` |

**recurrenceRange**：
| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | enum | `noEnd` / `endDate` / `numbered` |
| `startDate` | date | 起始 |
| `endDate` | date | 截止（type=endDate 时必填） |
| `numberOfOccurrences` | int | 次数（type=numbered 时必填） |
| `recurrenceTimeZone` | string | 时区 |

**关键设计**：
- 把 RRULE 拆成 14 个结构化字段
- `absoluteMonthly` vs `relativeMonthly` 区分"每月 15 号" vs "每月第二个周四"
- 调用方无需懂 RRULE 语法
- 但表达能力受限：无法表达"每月最后一个工作日"（需 `BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1`），需用 `relativeMonthly` + `index=last` + `daysOfWeek=[monday..friday]` 间接表达，且只支持单日

**可借鉴点**：
- ⚠️ **反面教材**：14 个字段分散调用方心智负担；表达力反而不如 RRULE 字符串
- ✅ `index` 枚举（first/second/third/fourth/last）作为 UI 选择器映射到 `BYSETPOS` 的设计可借鉴
- ✅ `type` 区分 absolute/relative 是 UI 友好的抽象（cf-todo 当前 `repeat_type` 只有 daily/weekly/monthly/yearly，没有 absolute/relative 区分）

### 1.3 Todoist —— 自然语言派

**字段**：任务标题里嵌入自然语言（"every day", "every 3rd friday", "every last day"），后端解析

**两种模式**：
- `every` —— 基于 scheduled date（计划日期）
- `every!` —— 基于 completed date（完成日期，适合"每 N 天浇花，完成后下次从完成日算起"）

**示例**：
- `every day` → 每天
- `every morning` → 每天 9am
- `every 3rd friday` → 每月第三个周五
- `every 27th` → 每月 27 号
- `every last day` → 每月最后一天（用 `BYMONTHDAY=-1` 或 `BYSETPOS=-1`）
- `every weekday` / `every workday` → 工作日（`FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`）
- `every weekend` → 周末（`FREQ=WEEKLY;BYDAY=SA,SU`）
- `every hour` → 每小时（cf-todo 明确拒绝！）

**关键设计**：
- 调用方零心智负担，直接 `task.content = "Buy milk every week"`
- 完成时自动 shift 到下次（无需用户手动改日期）
- 完成-based (`every!`) 与 scheduled-based (`every`) 区分是项目独有创新

**可借鉴点**：
- ✅ "完成-based 循环"概念（cf-todo 当前所有循环都是 scheduled-based，未来可加 `rrule_anchor: 'scheduled' | 'completed'`）
- ✅ 自然语言输入框（cf-todo v3.0 可加可选的"自然语言输入"作为高级模式）
- ❌ `every hour` 项目明确拒绝，与 Todoist 不同

### 1.4 Nylas v3 API —— RRULE + 例外完整派

**字段**：
- `rrule: string` —— RRULE 字符串数组
- `exdates: datetime[]` —— 排除日期数组
- `rdates: datetime[]` —— 额外添加日期数组
- `recurrence_override: object` —— 单实例修改（key=原日期，value=新事件数据）

**关键设计**：
- RRULE / EXDATE / RDATE 三者并列顶层字段（非 RRULE 字符串内嵌）
- 单实例修改用 override map 而非独立事件 + RECURRENCE-ID
- 支持 `separate_master_events` 参数，返回展开的实例数组

**可借鉴点**：
- ✅ RDATE 顶层字段（未来扩展用，cf-todo 当前无此能力）
- ✅ override map 思路（比 cf-todo 当前的 EXDATE + 脱离系列两步操作更直观）

### 1.5 Thunderbird / CalDAV —— 标准 RFC 5545 实现

**字段**：完整 iCalendar 协议
- `RRULE` 属性
- `EXDATE` 属性（独立）
- `RDATE` 属性（独立）
- `RECURRENCE-ID` 属性（标记例外实例）
- 母事件 + 子事件分离存储

**关键设计**：
- 严格遵循 RFC 5545，CalDAV 协议交换
- 例外实例用 RECURRENCE-ID 关联回母事件，可独立修改任意字段
- 支持 EXRULE（已废弃，RFC 5545 移除）

**可借鉴点**：
- ✅ RECURRENCE-ID 用于例外实例（cf-todo 当前用 `is_exception` + EXDATE 两套机制）
- ❌ EXRULE 已废弃，不要实现

---

## 二、RFC 5545 标准 RRULE 完整语法

### 2.1 完整 token 列表（RFC 5545 §3.3.10）

```
FREQ=SECONDLY|MINUTELY|HOURLY|DAILY|WEEKLY|MONTHLY|YEARLY  (必填，第一个)
UNTIL=date|date-time                  (与 COUNT 互斥)
COUNT=1*DIGIT                         (与 UNTIL 互斥)
INTERVAL=1*DIGIT                      (默认 1)
BYSECOND=seconds[,seconds]            (0-60)
BYMINUTE=minutes[,minutes]            (0-59)
BYHOUR=hour[,hour]                    (0-23)
BYDAY=[+/-]ordwkweekday[,weekday]     (如 MO,WE,FR 或 2MO=第二个周一)
BYMONTHDAY=monthday[,monthday]        (-31 to 31，负数从月末倒数)
BYYEARDAY=yearday[,yearday]           (-366 to 366)
BYWEEKNO=weeknum[,weeknum]            (-53 to 53)
BYMONTH=month[,month]                 (1-12)
BYSETPOS=setpos[,setpos]              (-366 to 366)
WKST=weekday                          (SU/MO/TU/WE/TH/FR/SA)
```

### 2.2 RFC 5545 关键约束

1. **FREQ 必须是第一个 token**（向后兼容）
2. **UNTIL 与 COUNT 互斥**，不能同时出现
3. **每个 token 至多出现一次**
4. **token 顺序无要求**（除 FREQ）
5. **UNTIL 是 DATE 或 DATE-TIME**（UTC 格式 `YYYYMMDDTHHMMSSZ`）
6. **DTSTART 始终是第一个实例**（即使不匹配 RRULE）
7. **WKST 影响周内实例排序**（默认 MO）

### 2.3 经典用例

| 场景 | RRULE |
|---|---|
| 每天 | `FREQ=DAILY` |
| 每 2 周 | `FREQ=WEEKLY;INTERVAL=2` |
| 每周一三五 | `FREQ=WEEKLY;BYDAY=MO,WE,FR` |
| 每月 15 号 | `FREQ=MONTHLY;BYMONTHDAY=15` |
| 每月最后一天 | `FREQ=MONTHLY;BYMONTHDAY=-1` |
| 每月最后一个工作日 | `FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1` |
| 每月第二个周四 | `FREQ=MONTHLY;BYDAY=2TH` 或 `FREQ=MONTHLY;BYDAY=TH;BYSETPOS=2` |
| 每年 1 月 1 日 | `FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1` |
| 每 10 次每 2 天 | `FREQ=DAILY;INTERVAL=2;COUNT=10` |
| 截止 2026 年底 | `FREQ=DAILY;UNTIL=20261231T235959Z` |
| 每周工作日（周一到周五） | `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR` |

---

## 三、UI/UX 设计对比

### 3.1 通用三段式布局（Medium 文章总结）

所有专业产品都用 **Appointment Time / Recurrence Pattern / Summary** 三段式：

```
┌─────────────────────────────────────────────┐
│ Appointment Time                            │
│  Start: [2026-06-29] [10:00]                │
│  End:   [2026-06-29] [10:25]                │
│  All day: [ ]  Time zone: [Asia/Shanghai]   │
├─────────────────────────────────────────────┤
│ Recurrence Pattern                          │
│  Repeat: [Daily ▼]                          │
│  Every: [1] [day ▼]                         │
│  On: [☑ Mon] [☑ Wed] [☑ Fri] (weekly 时)    │
├─────────────────────────────────────────────┤
│ Summary                                     │
│  "Every Mon, Wed, Fri, until 2026-12-31"   │
│  End: [Never] [On date] [After X times]    │
└─────────────────────────────────────────────┘
```

### 3.2 各家 UI 细节

#### Google Calendar
- 重复下拉：不重复 / 每天 / 每周 / 每月 / 每年 / 每工作日 / 自定义
- 自定义弹窗：分 4 区（频率 / 间隔 / 周日选择 / 结束方式）
- 结束方式：永不 / 截止日期 / 重复 N 次
- **预览**：底部显示"接下来 5 次：2026-06-29, 2026-07-06..."

#### Apple Calendar (iOS)
- 重复下拉：无 / 每天 / 每周 / 每 2 周 / 每月 / 每年 / 自定义
- 自定义：选 FREQ → 选 INTERVAL → 选具体规则（周一/.../月日/年月日）
- 月度：absoluteDay（每月 15 号） vs relativeDay（每月第二个周四）—— 与 Microsoft Graph 类似
- 结束方式：永不 / 截止日期（**无 COUNT 选项**，简化）

#### Microsoft Outlook
- 重复对话框：最完整的 6 种 type 枚举（与 Graph API 对应）
- 月度有"第 N 个 周X" vs "每月 X 号"两种 UI 切换
- 结束方式：无结束 / 截至 X / 重复 X 次

#### Todoist
- **无 UI 选择器，纯自然语言输入**
- 输入框输入"every 3rd friday"自动解析
- 帮助页提供 30+ 自然语言示例对照表
- 支持 `every!` 与 `every` 切换（基于完成 vs 基于计划）

#### TickTick
- 重复下拉：每天 / 工作日 / 每周 / 每月 / 每年 / 自定义
- 自定义：FREQ + INTERVAL + 周日选择 + 结束方式
- 结束方式：永不 / 截止 / 重复 N 次

### 3.3 UX Medium 文章总结的 8 个最佳实践

1. **24h vs 12h 时间格式**：默认 24h，am/pm 作为提示
2. **预定义时间槽下拉**：避免用户反复点 +/- 按钮
3. **日期格式本地化**：用缩写月份（Jan/Feb）避免 MM/DD 混淆
4. **结束日期不能早于开始日期**：前端校验，不要靠错误提示
5. **"After N Occurrences" 选项**：对应 COUNT，方便用户
6. **"No end time" 选项**：对应无限循环
7. **All-day 联动**：勾选后禁用时间字段
8. **时区用图标**：节省空间（如 Outlook）

---

## 四、cf-todo v3.0 破坏性变更设计建议

### 4.1 推荐采纳的设计点（按优先级）

#### P0（必做）

1. **完全删除旧字段**：`repeat_custom` / `repeat_interval` / `repeat_end` / `is_series`
2. **`repeat_type` 收窄为 3 值**：`none` / `fragment` / `recurring`（参考 Microsoft Graph `type` 枚举的简洁性）
3. **`rrule` 为唯一规范字段**：所有 RRULE 语义集中
4. **`anchor_date` 独立字段**（即 RFC 5545 的 DTSTART，与 Google Calendar `start` 字段一致）
5. **`exdates` 顶层字段**（与 Nylas 一致，符合 RFC 5545 EXDATE 独立属性）
6. **UI 三段式布局**（Medium 文章总结）：Appointment / Pattern / Summary
7. **结束方式三选项**（与所有产品一致）：永不 / 截止日期 / 重复 N 次

#### P1（强烈建议）

8. **预览未来 5 次实例**（参考 Google Calendar）：用 ical.js 在前端展开
9. **月度"绝对" vs "相对"切换**（参考 Apple Calendar / Outlook）：
   - 绝对：`FREQ=MONTHLY;BYMONTHDAY=15`
   - 相对：`FREQ=MONTHLY;BYDAY=2TH`（每月第二个周四）
   - UI 切换，底层都是 RRULE
10. **预设快捷选项**（参考 Google Calendar 下拉）：
    - 工作日 = `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`
    - 周末 = `FREQ=WEEKLY;BYDAY=SA,SU`
    - 每月最后一天 = `FREQ=MONTHLY;BYMONTHDAY=-1`
    - 每月最后一个工作日 = `FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1`
11. **BYSETPOS 支持**（参考 RFC 5545 完整规范）：用于"最后一个"语义
12. **BYMONTHDAY 负数支持**（参考 RFC 5545）：`-1` = 月末，`-2` = 倒数第二天

#### P2（可选，提升体验）

13. **完成-based 循环**（参考 Todoist `every!`）：新增 `rrule_anchor: 'scheduled' | 'completed'` 字段
14. **自然语言输入**（参考 Todoist）：高级模式下支持 "every 3rd friday" 自动解析为 RRULE
15. **时区独立字段**（参考 Google Calendar / Graph API）：`tz: 'Asia/Shanghai'`（cf-todo 当前隐式 UTC）
16. **RDATE 顶层字段**（参考 Nylas）：用于"每月 15 号 + 额外 12 月 25 日"这种追加场景
17. **RECURRENCE-ID 例外实例**（参考 Thunderbird）：替代当前的 `is_exception` + EXDATE 双机制

### 4.2 不采纳的设计点

- ❌ **Microsoft Graph 14 字段结构化对象**：心智负担太重，表达力反而不如 RRULE
- ❌ **EXRULE**：RFC 5545 已废弃
- ❌ **SECONDLY / MINUTELY / HOURLY**：与 cf-todo 项目语义不符（明确拒绝）
- ❌ **BYHOUR / BYMINUTE / BYSECOND**：时间段语义，项目无此场景
- ❌ **Todoist 自然语言作为唯一输入**：错误率高，cf-todo 仍以 UI 选择器为主

### 4.3 推荐的 v3.0 数据模型

```sql
CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  date TEXT NOT NULL,
  text TEXT NOT NULL,
  time TEXT,                -- 展示型，不参与计算
  end_time TEXT,            -- 展示型
  priority TEXT,
  desc TEXT,
  url TEXT,
  copy_text TEXT,
  subtasks TEXT,
  search_terms TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  type TEXT DEFAULT 'none',  -- 'none' | 'fragment' | 'recurring'
  category_id TEXT DEFAULT '',
  recurrence_id TEXT DEFAULT '',
  is_exception INTEGER NOT NULL DEFAULT 0,
  time_records TEXT NOT NULL DEFAULT '[]',
  fragment_anchor TEXT NOT NULL DEFAULT '',
  rrule TEXT NOT NULL DEFAULT '',                -- 唯一规范字段
  exdates TEXT NOT NULL DEFAULT '[]',            -- JSON 数组字符串
  anchor_date TEXT NOT NULL DEFAULT '',          -- DTSTART
  -- tz TEXT DEFAULT 'UTC'                       -- P2: 时区
  -- rrule_anchor TEXT DEFAULT 'scheduled'       -- P2: scheduled | completed
  -- rdates TEXT NOT NULL DEFAULT '[]'           -- P2: RDATE 数组
);

CREATE TABLE todo_templates (
  parent_id TEXT PRIMARY KEY,
  text TEXT, time TEXT, priority TEXT, desc TEXT, url TEXT,
  copy_text TEXT, subtasks TEXT, search_terms TEXT,
  type TEXT,            -- 'recurring' (templates 只有此值)
  end_time TEXT DEFAULT '',
  anchor_date TEXT,
  exdates TEXT DEFAULT '[]',
  category_id TEXT DEFAULT '',
  time_records TEXT NOT NULL DEFAULT '[]',
  rrule TEXT NOT NULL DEFAULT ''
  -- tz, rrule_anchor, rdates
);
```

### 4.4 推荐的 UI 设计（参考 Google Calendar + Medium 文章）

```
┌─────────────────────────────────────────────────┐
│ 新建事项                                          │
├─────────────────────────────────────────────────┤
│ 文本: [每周一三五站桩                            ]│
│ 描述: [                                         ]│
│ 链接: [                                         ]│
├─────────────────────────────────────────────────┤
│ 时间                                            │
│ 日期: [2026-06-29]  开始: [09:00] 结束: [09:30] │
│ 全天: [ ]                                        │
├─────────────────────────────────────────────────┤
│ 重复                                            │
│ 类型: [☑ 单次] [☐ 碎时记] [☐ 重复]              │
│                                                  │
│ (重复时显示)                                     │
│ 快捷: [每天] [工作日] [周末] [每周] [每月] [每年]│
│ 频率: [每周 ▼]  间隔: [1] 周                     │
│ 周日: [☑一] [☐二] [☑三] [☐四] [☑五] [☐六] [☐日]│
│                                                  │
│ 结束: ◉ 永不  ○ 截止日期 [2026-12-31]           │
│       ○ 重复 [10] 次                             │
│                                                  │
│ 预览: 2026-06-29, 2026-07-01, 2026-07-03, ...  │
├─────────────────────────────────────────────────┤
│ 优先级: [低 ▼]  分类: [无 ▼]                     │
├─────────────────────────────────────────────────┤
│              [取消]  [保存]                      │
└─────────────────────────────────────────────────┘
```

**关键改进**：
1. 类型三选一（单次/碎时记/重复）替代当前的 6 种 repeat_type
2. 重复时显示完整 UI（频率/间隔/周日选择/结束方式）
3. **预览未来 5 次**（关键 UX 提升）
4. 快捷按钮一键填入常用 RRULE
5. 结束方式三选一（永不/截止日期/重复 N 次）

### 4.5 推荐的 v3.0 API 字段（V0/V1 一致）

#### 请求体（CREATE/UPDATE）

```json
{
  "date": "2026-06-29",
  "text": "每周一三五站桩",
  "time": "09:00",
  "end_time": "09:30",
  "type": "recurring",
  "rrule": "FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261231T235959Z",
  "anchor_date": "2026-06-29",
  "exdates": [],
  "priority": "low",
  "category_id": ""
}
```

#### 响应体（GET）

```json
{
  "id": "17827387824347553",
  "parent_id": "17827387824347553",
  "date": "2026-06-29",
  "text": "每周一三五站桩",
  "time": "09:00",
  "end_time": "09:30",
  "type": "recurring",
  "rrule": "FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261231T235959Z",
  "anchor_date": "2026-06-29",
  "exdates": ["2026-07-01"],
  "is_series": true,  // 派生: type === 'recurring'
  "priority": "low",
  "category_id": "",
  "done": false,
  "subtasks": [],
  "search_terms": [],
  "time_records": [],
  "fragment_anchor": ""
}
```

### 4.6 删除清单（破坏性变更）

#### DB 列删除（共 6 个）
- `todos.repeat_custom`
- `todos.repeat_interval`
- `todos.repeat_end`
- `todo_templates.repeat_custom`
- `todo_templates.repeat_interval`
- `todo_templates.repeat_end`

#### DB 列重命名（共 2 个）
- `todos.repeat_type` → `todos.type`（值收窄为 none/fragment/recurring）
- `todo_templates.repeat_type` → `todo_templates.type`（值固定为 recurring）

#### 后端代码删除
- `sanitizeRepeatCustom` / `processRepeatCustom` / `deriveRepeatTypeFromCustom`
- `validateRepeatEndCompat` / `validateRepeatIntervalCompat`
- `buildRRuleString` 简化为 `expandRRule(rrule, anchor_date, exdates)`
- `computeUpdateActions` 中 recurrence_changed 简化为 rrule 字符串对比
- `getRepeatLabel` 重写为直接解析 rrule

#### 前端代码删除
- `tempRepeatInterval` / `tempRepeatEnd` 状态
- `getIntervalDisplayText` 函数
- 详情页"间隔"/"截止"独立行合并为"重复规则"单行
- 新增"预览未来 5 次"区块

#### API 文档删除
- API_Wiki.md 5.6 节（repeat_custom 指南）
- 5.5 字段一致性参考中关于旧字段的行
- 5.1 三种类型概览表中旧字段行
- 5.3 重复 todo 章节重写为只用 rrule
- 4.1 / 4.2 Todo 对象字段列表中旧字段

#### 迁移工具
- migrate.html 删除 convertRepeatCustom / 旧字段补全逻辑
- 仅保留 rrule 合成
- 新增 v2.8 → v3.0 迁移路径（type 收窄）

---

## 五、调研结论

业界对 RFC 5545 RRULE 的处理分两派：
1. **纯 RRULE 字符串派**（Google Calendar / Nylas / Thunderbird / CalDAV）：API 层完全遵循 RFC 5545，UI 层翻译
2. **结构化对象派**（Microsoft Graph / Apple Calendar 内部）：API 层用结构化字段，UI 层直接对应

**cf-todo v3.0 应坚定走纯 RRULE 字符串派路线**（与 Google Calendar 一致），原因：
- 项目已有 ical.js 依赖
- RRULE 表达力 > 任何结构化方案
- 调用方迁移成本最低（只改 1 个字段）
- 与 CalDAV / iCalendar 生态原生兼容（未来可加 ICS 导出导入）

**UI 层可借鉴结构化派的友好抽象**：
- Microsoft Graph 的 `absoluteMonthly` vs `relativeMonthly` → UI 切换
- Apple Calendar 的预设下拉 → cf-todo 快捷按钮
- Medium 文章的三段式布局 → cf-todo 详情页重构
- Google Calendar 的实例预览 → cf-todo 新增预览区块

**核心设计哲学**：API 层 100% RFC 5545，UI 层 100% 用户友好。两层之间的翻译由前后端各自承担。
