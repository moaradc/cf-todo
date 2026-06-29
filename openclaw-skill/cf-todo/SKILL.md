---
name: cf-todo
description: Manage todos and categories on a self-hosted Cloudflare Worker + D1 Todo App. Use when users ask to add, create, view, complete, update, or delete todos, manage recurring/repeating tasks, organize categories, or check their to-do list.
version: 1.5.0
metadata: {"openclaw":{"emoji":"📝","requires":{"env":["CF_TODO_API_URL","CF_TODO_API_KEY"],"bins":["curl"]},"primaryEnv":"CF_TODO_API_KEY","envVars":[{"name":"CF_TODO_API_URL","required":true,"description":"Base URL of your cf-todo deployment (e.g. https://todo.example.com, no trailing slash)"},{"name":"CF_TODO_API_KEY","required":true,"description":"API Key (cfk_...) generated from the cf-todo web UI Settings page"}]}}
---

# cf-todo

Manage your personal todo list and categories through the cf-todo RESTful API.

## Trigger Phrases

Use this skill when the user:

- Asks to add, create, or schedule a todo/task ("添加待办", "新建任务", "加一个", "记一下", "别忘了", "提醒我", "add a todo", "create a task", "new todo", "add to my list", "remind me to", "don't forget to", "I need to", "make a note to")
- Wants to view their todos ("看看今天的待办", "我的任务", "今天有什么", "待办列表", "show my todos", "what's on my list", "today's tasks", "what do I have to do", "pending items", "my todos")
- Wants to mark a todo as done ("标记完成", "完成了", "mark as done")
- Wants to update a todo ("改一下", "更新", "改时间", "改优先级", "改描述", "换个时间", "change the time", "update", "edit", "modify", "reschedule", "move to", "change priority")
- Wants to delete a todo ("删除", "删掉", "不要了", "去掉", "移除", "remove", "delete", "get rid of", "trash it", "discard")
- Mentions recurring/repeating tasks ("每日重复", "每周", "每天", "循环", "定期", "重复任务", "daily repeat", "recurring", "every day", "weekly", "repeating task", "scheduled task", "改为不重复", "stop repeating", "no longer repeat")
- Wants to manage categories ("创建分类", "改颜色", "新建分类", "分类管理", "new category", "organize", "group by", "change color", "add label", "tag")
- Asks to assign a category to a todo ("加到X分类", "设分类", "归类到", "set category", "assign to", "categorize as", "put in group")
- Wants to view or change app settings ("查看设置", "改排序方式", "change settings")
- Wants to manage custom code ("改自定义代码", "更新样式", "update custom CSS/JS")
- Wants to manage custom colors ("添加颜色", "自定义颜色", "add custom colors")
- Wants to update subtasks or search terms independently ("更新子任务", "改搜索词", "update subtasks", "add subtask")

Do NOT use this skill for:

- Calendar/scheduling without todo context
- Time tracking or Pomodoro sessions
- General reminders without actionable task context

## Quick Start

```bash
# List today's todos
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos?date=$(date +%Y-%m-%d)"

# Create a todo
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos" \
  -d '{"date":"2026-06-12","text":"Buy groceries","priority":"high"}'

# Mark a todo as done
curl -s -X PATCH -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}/toggle"
```

## Setup

1. Deploy cf-todo to Cloudflare Workers (follow project README)
2. Log in to the web UI, go to Settings → API 密钥管理
3. Create an API Key (starts with `cfk_`, shown only once — copy it immediately)
4. Set environment variables:

```bash
export CF_TODO_API_URL="https://your-todo.example.com"
export CF_TODO_API_KEY="cfk_your_api_key_here"
```

## Authentication

All API requests require the API key via header:

```
X-API-Key: $CF_TODO_API_KEY
```

Alternative methods (also supported):
- Query parameter: `?api_key=cfk_xxx`
- Authorization header: `Authorization: Bearer cfk_xxx`

Endpoints under `/api/v1/keys` require **Cookie auth only** (web UI session), not API Key.

## API Reference

| Method | Endpoint | Description | Notes |
|--------|----------|-------------|-------|
| **Todo** | | | |
| GET | `/api/v1/todos?date=` | 查询 Todo 列表 | 必填 `date`；可选 `start_date`+`end_date`, `category_id`, `done`, `limit`, `offset`, `expand`（`false` 跳过服务端展开，返回 `templates`） |
| GET | `/api/v1/todos/:id` | 获取单个 Todo | — |
| POST | `/api/v1/todos` | 创建 Todo | 必填 `date`, `text`；返回 201；`date` 为首次出现日期 |
| PUT | `/api/v1/todos/:id` | 更新 Todo | 仅传需改字段；可改 `date`；重复任务需设 `scope` |
| PATCH | `/api/v1/todos/:id/toggle` | 切换完成状态 | 重复任务仅影响当天实例；`done: false→true` 时可附带 `record` 记录完成时刻/耗时 |
| DELETE | `/api/v1/todos/:id` | 删除 Todo（软删除） | 重复任务默认 `scope=this`；可选 `thisAndFuture`, `all` |
| POST | `/api/v1/todos/batch` | 批量操作 | `BATCH_TOGGLE_DONE`（需 `ids`+`done_status`，可选 `timer_records`）或 `BATCH_DELETE`（需 `ids`）；自动分片 |
| PATCH | `/api/v1/todos/:id/subtasks` | 独立更新子任务 | 需 `subtasks` 数组 |
| PATCH | `/api/v1/todos/:id/search-terms` | 独立更新搜索词 | 需 `search_terms` 数组 |
| **Category** | | | |
| GET | `/api/v1/categories` | 列出所有分类 | — |
| GET | `/api/v1/categories/:id` | 获取单个分类 | — |
| POST | `/api/v1/categories` | 创建分类 | 必填 `name`；可选 `color`（默认 `#888888`）；返回 201；名称唯一（不区分大小写） |
| PUT | `/api/v1/categories/:id` | 更新分类 | 仅传 `name` 和/或 `color` |
| DELETE | `/api/v1/categories/:id` | 删除分类 | 关联 Todo 的 `category_id` 自动置空；硬删除 |
| POST | `/api/v1/categories/batch` | 批量删除分类 | `BATCH_DELETE`（需 `ids`）；硬删除 |
| **Trash** | | | |
| GET | `/api/v1/trash` | 回收站列表 | 可选 `limit`, `offset`；含分页 |
| POST | `/api/v1/trash-action` | `RESTORE` 恢复单条 | 自动处理重复任务：移除 exdate、重建模板、冲突脱钩 |
| POST | `/api/v1/trash-action` | `DELETE_PERMANENT` 永久删除 | **不可恢复**，需确认；硬删除 |
| POST | `/api/v1/trash-action` | `CLEAR_ALL` 清空回收站 | **不可恢复**，需确认 |
| POST | `/api/v1/trash-action` | `BATCH_RESTORE` 批量恢复 | 需 `ids` 数组；自动处理冲突脱钩 |
| POST | `/api/v1/trash-action` | `BATCH_DELETE_PERMANENT` 批量永久删除 | **不可恢复**，需确认；需 `ids` 数组 |
| POST | `/api/v1/trash-action` | `CLEAR_ALL_DATA` 清空所有数据 | **危险** 清空 todos、templates、settings、categories；**不可恢复** |
| **Stats** | | | |
| GET | `/api/v1/stats?start=&end=` | 统计数据 | 必填 `start`, `end`；服务端聚合返回 total/done/undone/activeDays/byDate/byCategory/noCategoryCount/byPriority/byPriorityDone/byWeekday/byWeekdayDone/byHourBucket |
| **Settings** | | | |
| GET | `/api/v1/settings` | 获取应用配置 | 返回 `app_settings` 键值 |
| POST | `/api/v1/settings` | 保存应用配置 | 整体覆盖 |
| **Custom Code** | | | |
| GET | `/api/v1/custom-code` | 获取自定义头部+内容代码 | 返回 `customHeader` + `customContent` |
| POST | `/api/v1/custom-code` | 保存自定义代码 | 两字段可选，仅更新传入的 |
| GET | `/api/v1/custom-header` | 获取自定义头部代码 | 纯文本 `text/plain` |
| GET | `/api/v1/custom-content` | 获取自定义内容代码 | 纯文本 `text/plain` |
| **Custom Colors** | | | |
| GET | `/api/v1/custom-colors` | 获取自定义颜色列表 | 返回颜色数组 |
| POST | `/api/v1/custom-colors` | 保存自定义颜色列表 | 需 `colors` 数组 |
| **API Key 管理** | | | |
| GET | `/api/v1/keys` | 列出所有 Key（脱敏） | Cookie only；返回 `keyPrefix`，不返回完整 Key |
| POST | `/api/v1/keys` | `CREATE` 创建 Key | Cookie only；仅创建时返回完整 Key；最多10个 |
| POST | `/api/v1/keys` | `DELETE` 删除 Key | Cookie only；需 `id` |
| POST | `/api/v1/keys` | `TOGGLE` 启用/禁用 Key | Cookie only；需 `id` |
| POST | `/api/v1/keys` | `RENAME` 重命名 Key | Cookie only；需 `id`+`name` |

## Non-negotiable Rules

These rules are MANDATORY. Violating them may cause irreversible data loss. No exceptions.

### 1. Only do what the user explicitly asked

- "删除A" → delete ONLY A. Do NOT also delete B or modify C.
- "标记为完成" → mark ONLY the specified item. Do NOT mark others.
- "看看今天的待办" → ONLY list. Do NOT delete, update, or create.

### 2. After successfully creating/updating/deleting/switching: The response should indicate what action was taken and what was operated on. Do not include full API responses, raw JSON, or code blocks unless the user explicitly requests detailed information.

Bad examples (too terse, missing context):
- "Done." / "已完成。"
- "Updated." / "已更新。"
- "Deleted." / "已删除。"

Bad examples (too verbose, dumping API response):
- Pasting the full JSON response body
- Showing the entire todo object with all 20+ fields

### 3. Never print the todo list unless explicitly asked

- If the user does NOT ask to "show/list/print my todos", do NOT paste the list.
- Exception: when resolving ambiguity (see rule #5), you may show matching items to ask which one.

### 4. Context-aware targeting

When the user says "标记为完成" or "删掉" without specifying which item:
- Use **conversation context** to identify the exact target (e.g., the item just discussed)
- If multiple items could match, **ASK** which one — never guess or assume "all"
- **NEVER apply operations to items the user did not mention**

### 5. Identify targets before acting

Before update/delete:
1. GET the todo list for the relevant date (do NOT paste results unless asked)
2. Match by `text` field to find the target's `id`
3. Use that `id` for the API call
4. If multiple matches, show the matching items and ASK which one

### 6. Confirm before destructive actions

Before ANY delete, `scope=all`, `scope=thisAndFuture`, `CLEAR_ALL_DATA`, or saving custom code:
1. Show the user exactly what will be affected (name, id, scope)
2. Wait for explicit confirmation
3. Only then execute

**CLEAR_ALL_DATA** is the most destructive action — it permanently deletes ALL todos, templates, settings, and categories. **NEVER use it unless the user EXPLICITLY asks to wipe everything.** Always show a clear warning and wait for confirmation.

**Custom code** (`POST /api/v1/custom-code`) directly injects HTML/CSS/JS into the web UI. Be cautious — malformed code can break the interface. Always show the user what will be saved before executing.

### 5. Verify after execution

After every create/update/delete, GET the data again to confirm the result.

### 6. If unsure, ASK

Ambiguous intent → ask the user. Never guess.

## Date Calculation

The API requires `YYYY-MM-DD` format. Calculate dates from natural language:

| User says | Calculation |
|---|---|
| 今天 / today | Current date |
| 明天 / tomorrow | Current date + 1 |
| 后天 | Current date + 2 |
| 下周一 / next Monday | Find next Monday |
| 周六 / Saturday | Next Saturday (including today if it matches) |
| 6月15日 | 2026-06-15 (current year) |

### Recurring todo first occurrence

The `date` field = first occurrence date (anchor). This is crucial:

- **"创建每周六待办"** on Friday → `date` = Saturday (tomorrow), NOT today
- **"创建每日重复待办"** → `date` = today (or user-specified date)
- **"创建每周重复待办"** without date → `date` = today as first occurrence

Weekday numbers: Sunday=0, Monday=1, ..., Saturday=6

## Recurring Todo Scope

Recurring todos have `repeat_type` != `"none"` and `is_series` = `true`. They belong to a series sharing the same `parent_id`.

When updating/deleting a recurring todo, choose the correct `scope`:

| scope | 含义 | 适用场景 | 风险 |
|-------|------|----------|------|
| `this` | 仅操作此实例 | "仅删除"、"只改这个"（默认） | 低 — 不影响其他实例 |
| `thisAndFuture` | 操作此实例及之后 | "从这天起不再重复" | 中 — 影响多个未来实例，需确认 |
| `all` | 操作整个系列 | "删除整个系列"、"删掉所有重复" | 高 — **不可恢复**，必须用户明确要求 |

### Scope 意图映射（CRITICAL — 必须严格遵守）

**将重复任务改为不重复** 是最常见的歧义场景，必须根据用户意图选择正确的 scope：

| 用户说的 | 正确 scope | 错误 scope | 原因 |
|----------|-----------|-----------|------|
| "改为不重复，以后都不需要了" | `thisAndFuture` | ~~`this`~~ | "以后都不需要" = 从今天起停止，不是只改今天 |
| "改为不重复，以后不再重复" | `thisAndFuture` | ~~`this`~~ | "以后不再" = 从今天起停止 |
| "改为不重复，从今天起" | `thisAndFuture` | ~~`this`~~ | "从今天起" = 从今天起停止 |
| "只今天不重复" | `this` | ~~`thisAndFuture`~~ | "只今天" = 仅此一次 |
| "仅此一次不重复" | `this` | ~~`thisAndFuture`~~ | "仅此一次" = 仅此一天 |
| "今天这个改成不重复" | `this` | ~~`thisAndFuture`~~ | "今天这个" = 仅此实例 |

**判断规则：**
1. **关键词检测**：用户提到"以后"、"以后都"、"不再"、"从今天起"、"从这天起" → `thisAndFuture`
2. **关键词检测**：用户提到"只今天"、"仅此一次"、"就今天" → `this`
3. **默认规则**：如果用户只说"改为不重复"而没有时间范围限定，**必须询问**用户是"仅此一天"还是"以后都不重复"

**其他操作的 scope 映射：**

| 用户意图 | scope |
|----------|-------|
| "删掉今天这个" / "只删这个" | `this` |
| "从今天起删掉" / "以后都不要了" | `thisAndFuture` |
| "删掉整个系列" / "所有重复的都删" | `all` |
| "改一下时间"（没说范围） | 先问：仅今天？还是以后都改？ |

**Rules:**
- Default = `this`. API defaults to this, but be explicit in the request.
- **NEVER use `scope=all` unless user EXPLICITLY says so** (e.g., "删除整个系列")
- Always confirm before `all` or `thisAndFuture`
- **When changing `repeat_type` to `"none"`**: if user implies "以后都不需要" → MUST use `thisAndFuture`, NOT `this`
- Toggle on a recurring todo marks only that day's instance (next day is still undone — correct)

## Core Operations

### List todos

```bash
# By date (required)
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos?date=2026-06-12"

# Date range
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos?start_date=2026-06-12&end_date=2026-06-18"

# Filter by category or completion
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos?date=2026-06-12&category_id=cat_xxx&done=false"

# With pagination
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos?date=2026-06-12&limit=20&offset=0"
```

Query params: `date`, `start_date`+`end_date`, `category_id`, `done` (true/false), `limit` (1-500, default 100), `offset` (default 0)

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "parent_id": "uuid",
      "date": "2026-06-12",
      "text": "Buy groceries",
      "time": "14:00",
      "priority": "high",
      "desc": "Milk, eggs, bread",
      "url": "",
      "copy_text": "",
      "subtasks": [{"text": "Milk", "done": false}],
      "search_terms": [],
      "done": false,
      "deleted": false,
      "repeat_type": "none",
      "repeat_custom": "",
      "repeat_end": "",
      "end_time": "",
      "category_id": "",
      "recurrence_id": "",
      "is_exception": false,
      "is_series": false,
      "repeat_interval": 1,
      "time_records": [],
      "fragment_anchor": ""
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 100,
    "offset": 0
  }
}
```

**Note:** When querying by `date`, recurring todo templates are auto-expanded: if a recurring todo should appear on that date but no instance exists yet, one is created automatically and included in the results.

**`fragment_anchor` field** — Authoritative copy of the start date for `repeat_type: "fragment"` todos (碎时记). Always present in todo responses; empty string `""` for non-fragment types.
- Uncompleted fragment: `fragment_anchor` equals `date`
- Completed fragment: `date` is frozen to the completion date, `fragment_anchor` still holds the original start date
- On `done: true → false`, fragment `date` is restored from `fragment_anchor`
- Non-fragment types (`none` / `daily` / `weekly` / `monthly` / `yearly`): always `""`

**`expand=false` option** — Add `&expand=false` to skip both server-side RRULE expansion AND the auto-instance `INSERT` into `todos`. The response includes a `templates` array (active recurring templates covering that date) for the caller to compute occurrences locally via ical.js / rrule.js / any RRULE library. This reduces Worker CPU usage (Cloudflare Free plan 10ms CPU limit) and avoids side-effect writes (no D1 INSERT). Use cases: programmatic callers that already have RRULE computation capability, or read-only snapshots where you don't want to mutate the database. Note: `expand=false` is only valid on `date` queries (range queries never expand server-side anyway). Response format:

```json
{
  "success": true,
  "data": [ /* existing todos for that date */ ],
  "pagination": { "total": 5, "limit": 100, "offset": 0 },
  "templates": [
    {
      "parent_id": "uuid",
      "text": "Daily task",
      "time": "",
      "priority": "low",
      "desc": "",
      "url": "",
      "copy_text": "",
      "subtasks": [],
      "search_terms": "[]",
      "repeat_type": "daily",
      "repeat_custom": "",
      "repeat_end": "",
      "end_time": "",
      "anchor_date": "2026-01-01",
      "exdates": "[]",
      "category_id": "",
      "repeat_interval": 1,
      "time_records": "[]"
    }
  ],
  "expand": false
}
```

**Template row fields (V1 `expand=false`)** — Each entry in `templates` is the raw `todo_templates` row with two normalizations:
- `exdates` — string (JSON-encoded array), guaranteed non-empty (defaults to `"[]"`)
- `subtasks` — parsed array (e.g. `[]` or `[{text, done}]`)

All other fields are raw DB values:
- **RRULE-driving**: `repeat_type` / `repeat_interval` / `anchor_date` / `repeat_end` / `exdates` / `repeat_custom` (see precedence rules below)
- **Display**: `text` / `time` / `priority` / `desc` / `url` / `copy_text` / `category_id` / `end_time`
- **Other**: `parent_id` (template PK, also the series identifier), `search_terms` (string `"[]"` — **not** parsed by V1, caller must `JSON.parse` if needed), `time_records` (string `"[]"` — template-level historical records for `predictDuration`, **not** parsed by V1)

**Note on `_type: "template"`** — V1 `expand=false` does **NOT** add a `_type` field. If you see `_type: "template"` on a row, it's from the V0 export/import stream (NDJSON), not from V1 `expand=false`. Don't rely on `_type` to distinguish templates in V1 responses — use the presence of the top-level `templates` array + `expand: false` flag instead.

**RRULE computation precedence** — When computing occurrences from a `templates` entry locally, follow the same precedence the server uses (`src/recurring-engine.js buildRRuleString()`):
1. If `repeat_custom` is non-empty → use it verbatim as the RRULE string (it overrides `repeat_type` / `repeat_interval` / `anchor_date` / `repeat_end` for frequency & by-day rules; `exdates` still apply).
2. Else → build the RRULE from `repeat_type` + `repeat_interval` + `anchor_date` (DTSTART) + `repeat_end` (UNTIL).
3. Always apply `exdates` (cancel specific dates) and respect `repeat_end` (hard UNTIL bound) regardless of branch 1 or 2.

> **`repeat_custom` 现可能为非空字符串**（API 入口已开放）。调用方需自行用 ical.js / rrule.js 解析，按优先级 custom > type/interval 应用，并叠加 exdates / repeat_end。`repeat_interval > 1` 会用正则替换覆盖 custom 中的 INTERVAL；`repeat_end` 在 custom 未含 UNTIL 时追加为 UNTIL。

**Caveat:** `expand=false` does NOT auto-create recurring instances (no D1 writes). The caller is fully responsible for filtering `templates` against the queried date (applying `exdates`, checking `repeat_end`, honoring `repeat_custom` precedence). Use default `expand=true` if you need persisted instances or don't want to re-implement RRULE evaluation.

**Note on `fragment` type:** `templates` only contains rows where `repeat_type IN ('daily','weekly','monthly','yearly')`. Fragment (碎时记) todos have no template — they appear directly in `data` (filtered by the fragment visibility rule: uncompleted fragments with `date = '' OR date <= queried_date`, completed fragments with `date = queried_date`). `fragment_anchor` is a column on `todos` only, not `todo_templates`, so it never appears in `templates` entries.

### Get a single todo

```bash
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}"
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "parent_id": "uuid",
    "date": "2026-06-12",
    "text": "Buy groceries",
    "time": "14:00",
    "priority": "high",
    "desc": "",
    "url": "",
    "copy_text": "",
    "subtasks": [],
    "search_terms": [],
    "done": true,
    "deleted": false,
    "repeat_type": "none",
    "repeat_custom": "",
    "repeat_end": "",
    "end_time": "",
    "category_id": "",
    "recurrence_id": "",
    "is_exception": false,
    "is_series": false,
    "repeat_interval": 1,
    "time_records": [
      { "s": 1719000000000, "e": 1719000120000, "p": 0 }
    ],
    "last_completed_at": 1719000120000,
    "last_duration_ms": 120000,
    "is_zero_duration": false,
    "fragment_anchor": ""
  }
}
```

**Timer fields** (instance-level completion records, per-todo):

V1 API returns both the **raw records array** and **computed fields**. Clients can use the computed fields directly without parsing epoch ms or calculating durations.

**Type note**: In V1 todo responses (List / Get / Create / Update), `time_records`, `subtasks`, and `search_terms` are always **parsed arrays** (e.g. `[]` or `[{s,e,p}]`). The raw DB stores them as JSON-encoded strings, but `formatTodo()` parses them before returning. This differs from `templates` rows in `expand=false` responses, where `search_terms` and `time_records` stay as raw strings (see `expand=false` section below).

#### Raw field `time_records`

Each record is `{ "s": <epoch_ms>, "e": <epoch_ms>, "p": <paused_ms> }`:
- `s` — start time (epoch ms)
- `e` — end time (epoch ms)
- `p` — paused duration accumulated (ms)
- **Actual duration** = `e - s - p`
- `s === e` — zero-duration (checkbox completion, only records completion timestamp)
- `s < e` — real duration (timer completion)
- Retention: **fragment todos keep all sessions** (no truncation, for cumulative stats); **regular todos FIFO 5** (keep most recent 5)
- **The last element is always the latest completion**
- Empty array `[]` when `done: false` (unchecking clears records)

#### Computed fields (calculated from the latest record)

| Field | Type | Description |
|-------|------|-------------|
| `last_completed_at` | number \| null | Latest completion timestamp (epoch ms), i.e. `e` of the last record; `null` if no records |
| `last_duration_ms` | number \| null | Latest actual duration (ms) = `e - s - p`; `0` for zero-duration; `null` if no records |
| `is_zero_duration` | boolean | Whether the latest record is zero-duration (`s === e`); `false` if no records |

#### Display suggestions (matching the web UI)

| Condition | Display |
|-----------|---------|
| `last_completed_at === null` | "无完成耗时记录" (no completion record) |
| `is_zero_duration === true` | "完成于 X" (X = `last_completed_at` formatted as HH:MM, no duration shown) |
| `is_zero_duration === false` | "完成于 X，耗时 Y" (Y = `last_duration_ms` formatted as readable duration) |

**Example** (JavaScript):
```js
if (todo.last_completed_at === null) {
  show('无完成耗时记录');
} else {
  const time = new Date(todo.last_completed_at).toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'});
  if (todo.is_zero_duration) {
    show(`完成于 ${time}`);
  } else {
    show(`完成于 ${time}，耗时 ${formatMs(todo.last_duration_ms)}`);
  }
}
```

### Create a todo

```bash
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos" \
  -d '{
    "date": "2026-06-12",
    "text": "Buy groceries",
    "time": "14:00",
    "priority": "high",
    "desc": "Milk, eggs, bread",
    "repeat_type": "none",
    "category_id": "",
    "subtasks": [{"text": "Milk", "done": false}],
    "end_time": ""
  }'
```

**Required:** `date` (YYYY-MM-DD), `text`

**Optional fields:**

| Field | Values | Default |
|---|---|---|
| `time` | HH:MM | `""` |
| `priority` | `"low"`, `"med"`, `"high"` | `"low"` |
| `desc` | String | `""` |
| `url` | String | `""` |
| `copy_text` | String | `""` |
| `subtasks` | `[{"text":"...", "done":false}]` or `["..."]` | `[]` |
| `search_terms` | `[{"text":"...", "done":false}]` or `["..."]` | `[]` |
| `repeat_type` | `"none"`, `"daily"`, `"weekly"`, `"monthly"`, `"yearly"`, `"fragment"` | `"none"` |
| `repeat_end` | YYYY-MM-DD or `""` | `""` |
| `end_time` | HH:MM | `""` |
| `category_id` | Category ID | `""` |
| `repeat_interval` | Integer (every N units) | `1` |
| `repeat_custom` | 自定义 RRULE 字符串（如 `FREQ=WEEKLY;BYDAY=MO,WE,FR`），非空时优先于 `repeat_type`/`repeat_interval` 生效。校验：必须以 `FREQ=DAILY/WEEKLY/MONTHLY/YEARLY` 开头，最大长度 500，全大写规范化，须通过 ical.js 解析。`repeat_type` ∈ {none, fragment} 时强制清空 | `""` |

Note: `"medium"` priority is auto-converted to `"med"`. Subtask/search_term strings are auto-converted to `{text, done:false}` objects.

**字段校验（V0 CREATE / V0 UPDATE / V1 POST / V1 PUT 共享）**

服务端联动推导（调用方无需关心）：
- `repeat_type=fragment` → 强制清空 `time` / `end_time` / `repeat_end` / `repeat_interval` / `repeat_custom`
- `repeat_type=none` → 强制清空 `repeat_custom`
- `repeat_custom` 非空 + `repeat_type=none` → 从 custom 的 FREQ 反推 `repeat_type`（不覆盖 `fragment`）

原子组校验（冲突返回 400）：
- `repeat_end` 非空时 `repeat_type` 必须 ∈ {daily, weekly, monthly, yearly}
- `repeat_interval > 1` 时 `repeat_type` 必须 ∈ {daily, weekly, monthly, yearly}
- `repeat_interval` 必须为正整数

格式校验（冲突返回 400）：
- `date` / `repeat_end` — `YYYY-MM-DD` 且真实存在（防 `2026-13-45`）
- `time` / `end_time` — `HH:MM` 且范围合法（00:00-23:59，防 `25:99`）

**`time` / `end_time` 为独立展示字段** — 不参与业务计算（耗时走 `time_records`）。允许的输入组合：仅传 `time`、仅传 `end_time`（语义：在 `end_time` 前完成即可）、两者都传（含跨日/夜班如 `22:00` - `06:00`）、两者都空。服务端不再校验 `time ≤ end_time`。

**常见 400 错误响应**：

```json
// repeat_custom 格式无效
{ "error": "repeat_custom 格式无效：必须为合法 RRULE 字符串，以 FREQ=DAILY/WEEKLY/MONTHLY/YEARLY 开头，长度 ≤ 500，不含换行/控制字符" }

// repeat_interval 非正整数
{ "error": "repeat_interval 必须为正整数" }

// 原子组冲突
{ "error": "repeat_end 仅在 repeat_type 为 daily/weekly/monthly/yearly 时有效，当前 repeat_type=none" }
{ "error": "repeat_interval > 1 仅在 repeat_type 为 daily/weekly/monthly/yearly 时有效，当前 repeat_type=none" }

// 格式冲突
{ "error": "日期格式应为 YYYY-MM-DD，当前值: 20260629" }
{ "error": "日期无效: 2026-13-45" }
{ "error": "时间格式应为 HH:MM，当前值: 0930" }
{ "error": "时间范围无效（HH: 00-23, MM: 00-59），当前值: 25:99" }

// repeat_type 非法
{ "error": "无效的 repeat_type: hourly，有效值: none, daily, weekly, monthly, yearly, fragment" }

// API Key 作用域错误
{ "error": "API Key 仅允许访问 v1 接口" }
```

**`repeat_type: "fragment"` (碎时记) constraints** — When `repeat_type` is `"fragment"`:
- A floating todo not tied to a specific date; no template is created (same as `"none"`).
- Server forces `time = ""`, `end_time = ""`, `repeat_end = ""`, `repeat_interval = 1`.
- `fragment_anchor` is auto-set to the value of `date` (the start date).
- Visible on any date `>= fragment_anchor` while uncompleted; on completion, `date` is frozen to the completion date and `fragment_anchor` retains the original start date.
- Supports multi-segment timing (开始 / 暂停 / 继续 / 记录当前段 / 完成 / 继续计时). All sessions retained (no FIFO truncation). See `time_records` retention rules below.

Response (HTTP 201) — 创建响应返回完整记录（27 字段，含 `formatTodo` 派生的计算字段 `is_series` / `last_completed_at` / `last_duration_ms` / `is_zero_duration`），无需再发一次 GET：

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "parent_id": "uuid",
    "date": "2026-06-12",
    "text": "Buy groceries",
    "time": "14:00",
    "priority": "high",
    "desc": "",
    "url": "",
    "copy_text": "",
    "subtasks": [],
    "search_terms": [],
    "done": false,
    "deleted": false,
    "repeat_type": "none",
    "repeat_custom": "",
    "repeat_end": "",
    "end_time": "",
    "category_id": "",
    "recurrence_id": "",
    "is_exception": false,
    "is_series": false,
    "repeat_interval": 1,
    "time_records": [],
    "last_completed_at": null,
    "last_duration_ms": null,
    "is_zero_duration": false,
    "fragment_anchor": ""
  }
}
```

**Creating a recurring todo:** When `repeat_type` is `daily`/`weekly`/`monthly`/`yearly`, a template is also created in `todo_templates`. The `date` field becomes the anchor (first occurrence) date. When `repeat_type` is `"fragment"` or `"none"`, no template is created.

```bash
# Create a daily recurring todo
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos" \
  -d '{"date":"2026-06-12","text":"晨跑","repeat_type":"daily"}'

# Create a weekly recurring todo ending on a specific date
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos" \
  -d '{"date":"2026-06-13","text":"周会","repeat_type":"weekly","repeat_end":"2026-12-31"}'

# Create a fragment (碎时记) todo — floating, multi-segment timing
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos" \
  -d '{"date":"2026-06-12","text":"读《深度工作》","repeat_type":"fragment"}'
```

### Update a todo

```bash
curl -s -X PUT -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos/{id}" \
  -d '{"text": "Updated text", "priority": "high", "scope": "this"}'
```

**PATCH 语义** — 只传想修改的字段，未传字段保留 DB 原值（不会静默清空）。显式清空方式：字符串字段传 `""` 或 `null`，数组字段传 `[]`。

All fields from Create are also updatable, plus:

| Field | Description |
|---|---|
| `date` | Change the date. For recurring todos with `scope=all` or `thisAndFuture`, changing date will delete and regenerate future instances. |
| `scope` | For recurring todos only: `"this"`, `"thisAndFuture"`, `"all"` |
| `repeat_custom` | PATCH 语义：未传保留原值；传 `""` 显式清空；传非空字符串则严格校验后写入。`scope=all` + `repeat_custom` 变更会触发 `recurrence_changed`，旧实例被 DELETE 并由模板按新 custom 重新生成 |

For recurring todos, set `scope`:
- `"this"` — update this instance only (default for recurring). Adds exdate to template; detaches from series if `repeat_type` changes to `"none"`.
- `"thisAndFuture"` — update this + future instances. Updates template.
- `"all"` — update all instances — **DESTRUCTIVE, confirm first**. Updates template + all existing instances.

**Special behaviors:**
- Changing a non-recurring todo to recurring (`repeat_type` in `daily`/`weekly`/`monthly`/`yearly`) creates a template automatically.
- Changing a recurring instance to non-recurring detaches it from the series (sets `parent_id` = own `id`, adds exdate to template).
- Changing `date` on a recurring todo with `scope=all` or `thisAndFuture` will delete future instances and regenerate them from the updated template.
- Changing `repeat_type` to `"fragment"`: detaches from old series (adds exdate to old template), forces `time=""`, `end_time=""`, `repeat_end=""`, `repeat_interval=1`, sets `fragment_anchor` to `date` (if uncompleted) or keeps existing `fragment_anchor` (if completed).
- Changing `repeat_type` from `"fragment"` to `"none"` or any recurring type: clears `fragment_anchor` to `""`.
- Updating `date` on a fragment todo: if uncompleted, `fragment_anchor` syncs to new `date`; if completed, `fragment_anchor` retains its original value.

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "parent_id": "uuid",
    "date": "2026-06-12",
    "text": "Updated text",
    "...": "full todo object"
  }
}
```

### Toggle done status

```bash
# Basic toggle (no completion timestamp recorded)
curl -s -X PATCH -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}/toggle"

# Toggle to done WITH completion timestamp (zero-duration record, s === e)
# Records "完成于 X" (completed at X) without duration. Useful for checkbox completion.
curl -s -X PATCH -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos/{id}/toggle" \
  -d '{"record":{"s":1719000000000,"e":1719000000000,"p":0}}'

# Toggle to done WITH real duration (s < e, e.g. timer completion)
# Records "完成于 X，耗时 Y" (completed at X, duration Y). Writes to both instance + template.
curl -s -X PATCH -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos/{id}/toggle" \
  -d '{"record":{"s":1719000000000,"e":1719000120000,"p":0}}'
```

Toggles `done` between `true` and `false`. For recurring todos, only the specific day's instance is toggled — other days remain unaffected.

**Optional `record` body** (only effective when toggling to `done: true`):
- `s === e` (zero-duration): Records completion timestamp only. Writes to instance-level `time_records`, **not** template-level (avoids polluting `predictDuration` median estimate). Web UI shows "完成于 X".
- `s < e` (real duration): Records completion timestamp + duration. Writes to both instance-level + template-level `time_records` (same as `TIMER_COMPLETE`). Web UI shows "完成于 X，耗时 Y".
- Instance-level retention: **fragment todos keep all sessions** (no truncation); **regular todos FIFO 5**.
- Template-level `time_records` FIFO 10 (only real-duration records, only non-fragment todos; fragment has no template, zero-duration skipped).
- Validation: `s > 0`, `e >= s`, duration ≤ 7 days, `0 <= p <= (e-s)`. Invalid records are silently skipped.
- Toggling to `done: false` clears instance-level `time_records`; fragment `date` is restored from `fragment_anchor`.
- No `record` or body parse failure: only updates `done` (backward compatible).

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "done": true
  }
}
```

### Delete a todo

```bash
# Non-recurring
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}"

# Recurring: delete only this instance (default)
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}?scope=this"

# Recurring: delete this and all future instances
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}?scope=thisAndFuture"

# Recurring: delete entire series (MUST confirm with user!)
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}?scope=all"
```

This is a **soft delete** — the todo is moved to trash (`deleted = 1`), not permanently removed. It can be restored via the Trash API.

**Scope behaviors for recurring todos:**
- `this` (default) — Soft-deletes this instance only; adds exdate to template to prevent regeneration.
- `thisAndFuture` — Soft-deletes this + all future instances; sets `repeat_end` on template and past instances.
- `all` — Soft-deletes ALL instances + deletes the template — **IRREVERSIBLE even from trash** (template is permanently deleted).

Response:

```json
{
  "success": true
}
```

### Batch operations

```bash
# Batch toggle done (basic, no completion timestamp)
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos/batch" \
  -d '{"action":"BATCH_TOGGLE_DONE","ids":["id1","id2"],"done_status":true}'

# Batch toggle done WITH timer_records (mixed: one zero-duration, one real-duration)
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos/batch" \
  -d '{
    "action":"BATCH_TOGGLE_DONE",
    "ids":["id1","id2"],
    "done_status":true,
    "timer_records":[
      {"id":"id1","parent_id":"parent-uuid-1","record":{"s":1719000000000,"e":1719000000000,"p":0}},
      {"id":"id2","parent_id":"parent-uuid-2","record":{"s":1719000000000,"e":1719000120000,"p":0}}
    ]
  }'

# Batch delete (soft delete, auto-chunked)
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos/batch" \
  -d '{"action":"BATCH_DELETE","ids":["id1","id2"]}'
```

**BATCH_TOGGLE_DONE** — Set `done_status` to `true` (mark done) or `false` (mark undone) for all given `ids`.

- `done_status: true`: First batch-updates `done=1`, then writes `time_records` for each entry in `timer_records` (if provided). Record write rules are identical to `PATCH /toggle`.
- `done_status: false`: Batch-updates `done=0, time_records='[]'` (clears instance-level records for all selected ids).
- `ids` present but missing from `timer_records`: only `done=1` is set, no `time_records` written (backward compatible).

**BATCH_DELETE** — Soft-deletes all given `ids` (moves to trash). For recurring todos in the batch, exdates are automatically added to their templates to prevent regeneration.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `action` | string | Yes | `BATCH_TOGGLE_DONE` or `BATCH_DELETE` |
| `ids` | string[] | Yes | Array of todo IDs. No upper limit (auto-chunked at 99) |
| `done_status` | boolean | BATCH_TOGGLE_DONE | `true` = done, `false` = undone |
| `timer_records` | array | No | `[{id, parent_id, record}]` — only effective when `done_status: true`. Each `record` follows the same validation rules as `PATCH /toggle`. |

Response:

```json
// BATCH_TOGGLE_DONE (includes chunked/chunkCount, affected = actual changed rows)
{"success": true, "data": {"affected": 105, "done": true, "chunked": true, "chunkCount": 2}}

// BATCH_DELETE
{"success": true, "data": {"affected": 105, "chunked": true, "chunkCount": 2}}
```

**Auto-chunking**: When `ids.length > 99`, the backend processes in chunks of 99. `chunked` indicates whether chunking was triggered; `chunkCount` = `ceil(ids.length / 99)`. `affected` is the actual number of changed rows (excludes non-existent/already-deleted ids), not `ids.length`.

### List categories

```bash
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/categories"
```

Response:

```json
{
  "success": true,
  "data": [
    {"id": "cat_xxx", "name": "Work", "color": "#3B82F6"},
    {"id": "cat_yyy", "name": "Personal", "color": "#888888"}
  ]
}
```

### Get a single category

```bash
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/categories/{id}"
```

Response:

```json
{
  "success": true,
  "data": {"id": "cat_xxx", "name": "Work", "color": "#3B82F6"}
}
```

### Create a category

```bash
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/categories" \
  -d '{"name":"Work","color":"#3B82F6"}'
```

Required: `name`. Optional: `color` (hex string, default `"#888888"`).

Category names must be unique (case-insensitive check). If a duplicate name is provided, returns `400`.

Response (HTTP 201):

```json
{
  "success": true,
  "data": {"id": "cat_xxx", "name": "Work", "color": "#3B82F6"}
}
```

### Update a category

```bash
# Change name only
curl -s -X PUT -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/categories/{id}" \
  -d '{"name":"New Name"}'

# Change color only
curl -s -X PUT -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/categories/{id}" \
  -d '{"color":"#FF5733"}'

# Change both
curl -s -X PUT -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/categories/{id}" \
  -d '{"name":"New Name","color":"#FF5733"}'
```

Only include fields you want to change. Name uniqueness is checked against other categories (excluding the current one).

Response:

```json
{
  "success": true,
  "data": {"id": "cat_xxx", "name": "New Name", "color": "#FF5733"}
}
```

### Delete a category

```bash
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/categories/{id}"
```

This is a **hard delete** — the category is permanently removed. All todos and templates that referenced this category will have their `category_id` set to `""`. **Confirm with user first.**

Response:

```json
{"success": true}
```

### Assign a category to a todo

```bash
# 1. Find the category ID
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/categories"

# 2. Assign it
curl -s -X PUT -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos/{id}" \
  -d '{"category_id":"cat_xxx"}'
```

If the category doesn't exist, ask the user if they want to create it first.

### Batch delete categories

```bash
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/categories/batch" \
  -d '{"action":"BATCH_DELETE","ids":["cat_id1","cat_id2"]}'
```

Hard-deletes all specified categories. All associated todos/templates have `category_id` cleared. **Confirm with user first.**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `action` | string | Yes | `BATCH_DELETE` |
| `ids` | string[] | Yes | Array of category IDs |

Response:

```json
{"success": true, "data": {"deleted": 2}}
```

### Trash (deleted todos)

```bash
# List trash (with pagination)
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/trash?limit=20&offset=0"
```

Response:

```json
{
  "success": true,
  "data": [
    {"id": "uuid", "text": "Deleted todo", "...": "full todo object with deleted: true"}
  ],
  "pagination": {"total": 5, "limit": 20, "offset": 0}
}
```

```bash
# Restore a single todo
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/trash-action" \
  -d '{"action":"RESTORE","id":"todo_id"}'

# Permanently delete a single todo
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/trash-action" \
  -d '{"action":"DELETE_PERMANENT","id":"todo_id"}'

# Clear all trash
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/trash-action" \
  -d '{"action":"CLEAR_ALL"}'

# Batch restore
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/trash-action" \
  -d '{"action":"BATCH_RESTORE","ids":["id1","id2"]}'

# Batch permanent delete
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/trash-action" \
  -d '{"action":"BATCH_DELETE_PERMANENT","ids":["id1","id2"]}'

# Clear ALL data (DANGEROUS - confirm with user first!)
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/trash-action" \
  -d '{"action":"CLEAR_ALL_DATA"}'
```

**Action details:**

| Action | Required Params | Description |
|---|---|---|
| `RESTORE` | `id` | Restore single todo. Aligned with RFC 5545 + Google Tasks: only processes rows still carrying recurring attrs (`repeat_type != "none"` && `parent_id != id`). If same-date active instance exists → detach to single; if template still covers this date → remove from EXDATE and re-merge into series; if template deleted/truncated → detach to single. **No longer rebuilds deleted templates.** |
| `DELETE_PERMANENT` | `id` | **Irreversible** hard delete. |
| `CLEAR_ALL` | — | **Irreversible** hard delete all trashed todos. |
| `BATCH_RESTORE` | `ids` (array) | Restore multiple. Same logic as `RESTORE`: detaches to single if same-date instance exists or template `repeat_end` has passed/deleted; otherwise removes from EXDATE and re-merges into series. |
| `BATCH_DELETE_PERMANENT` | `ids` (array) | **Irreversible** hard delete multiple. |
| `CLEAR_ALL_DATA` | — | **DANGEROUS** Permanently deletes ALL todos, templates, settings, and categories. **Irreversible. Must confirm with user.** |

Response:

```json
// RESTORE / DELETE_PERMANENT / CLEAR_ALL
{"success": true}

// BATCH_RESTORE
{"success": true, "data": {"restored": 2}}

// BATCH_DELETE_PERMANENT
{"success": true, "data": {"deleted": 2}}
```

### Statistics

```bash
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/stats?start=2026-06-01&end=2026-06-12"
```

Required: `start`, `end` (YYYY-MM-DD). Only counts non-deleted todos. Server-side aggregation via D1 batch (6 GROUP BY queries in one round-trip), so even tens of thousands of todos return a compact aggregated payload.

Response:

```json
{
  "success": true,
  "data": {
    "total": 510,
    "done": 272,
    "undone": 238,
    "activeDays": 170,
    "byDate": {
      "2026-06-12": {"total": 3, "done": 2},
      "2026-06-11": {"total": 5, "done": 4}
    },
    "byCategory": {
      "<category_id>": {"total": 80, "done": 40}
    },
    "noCategoryCount": {"total": 100, "done": 50},
    "byPriority": {"high": 68, "med": 306, "low": 136},
    "byPriorityDone": {"high": 30, "med": 150, "low": 70},
    "byWeekday": [71, 72, 73, 74, 75, 75, 70],
    "byWeekdayDone": [38, 38, 39, 40, 40, 40, 37],
    "byHourBucket": [0, 68, 204, 136]
  }
}
```

Field reference:
- `total` / `done` / `undone`: total / completed / incomplete counts
- `activeDays`: number of distinct dates with at least one todo
- `byDate`: per-date `{ total, done }`
- `byCategory`: per-category `{ total, done }` (excludes uncategorized)
- `noCategoryCount`: `{ total, done }` for todos without a category
- `byPriority` / `byPriorityDone`: per-priority total / completed (`high`, `med`, `low`)
- `byWeekday` / `byWeekdayDone`: 7-element arrays indexed by weekday (0=Sun, 1=Mon, ..., 6=Sat)
- `byHourBucket`: 4-element array (0=00-06, 1=06-12, 2=12-18, 3=18-24; todos without `time` are not counted in any bucket)

### Update subtasks independently

```bash
curl -s -X PATCH -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos/{id}/subtasks" \
  -d '{"subtasks":[{"text":"Subtask 1","done":false},{"text":"Subtask 2","done":true}]}'
```

Response: `{"success": true}`

### Update search terms independently

```bash
curl -s -X PATCH -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos/{id}/search-terms" \
  -d '{"search_terms":[{"text":"tag1","done":false}]}'
```

Response: `{"success": true}`

### Settings

```bash
# Get settings
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/settings"

# Save settings (full overwrite)
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/settings" \
  -d '{"provider":"auto","sortMethod":"time","sortAsc":true}'
```

GET response:

```json
{
  "success": true,
  "data": {"provider": "auto", "sortMethod": "time", "sortAsc": true}
}
```

POST response: `{"success": true}`

### Custom code

```bash
# Get custom header + content
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/custom-code"

# Save custom code (both fields optional)
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/custom-code" \
  -d '{"customHeader":"<style>...</style>","customContent":"<script>...</script>"}'

# Get custom header only (plain text)
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/custom-header"

# Get custom content only (plain text)
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/custom-content"
```

GET `/api/v1/custom-code` response:

```json
{
  "success": true,
  "data": {
    "customHeader": "<style>...</style>",
    "customContent": "<script>...</script>"
  }
}
```

### Custom colors

```bash
# Get custom colors
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/custom-colors"

# Save custom colors
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/custom-colors" \
  -d '{"colors":["#FF5733","#3B82F6"]}'
```

GET response:

```json
{
  "success": true,
  "data": ["#FF5733", "#3B82F6"]
}
```

POST response: `{"success": true, "data": ["#FF5733", "#3B82F6"]}`

## Workflow

1. **Fetch first** — GET the list before update/delete to find the correct `id`
2. **Identify target** — Match by `text` field. If multiple match, ASK
3. **Calculate date** — Convert natural language to YYYY-MM-DD. For recurring, `date` = first occurrence
4. **Check recurring** — If `is_series: true`, determine `scope` from user intent
5. **Confirm destructive** — Before delete, `scope=all`, or `scope=thisAndFuture`
6. **Execute only what was asked** — No extra operations
7. **Verify** — GET again after the operation to confirm

## Response format

All responses are JSON: `{"success":true,"data":...}` or `{"error":"message"}`

HTTP status codes:
- `200` — Success
- `201` — Created (POST /todos, POST /categories)
- `400` — Bad request (missing required fields, invalid format, duplicate name)
- `401` — Auth failed (invalid API Key or missing cookie)
- `404` — Not found (todo/category does not exist)
- `405` — Method not allowed

## Limitations

- Date format must be YYYY-MM-DD
- Max 500 todos per query (use pagination)
- Batch operations auto-chunk (99 per chunk), no upper limit. Response includes `chunked` (boolean) and `chunkCount` (number) fields. `affected`/`restored`/`deleted` reflect actual changed rows (not `ids.length`).
- Category names must be unique (case-insensitive)
- Category delete is hard delete (cannot be restored); todo delete is soft delete (restorable from trash)
- Deleting a recurring todo with `scope=all` also permanently deletes the template — the series cannot be restored from trash
- Settings POST is a full overwrite — always GET first, modify, then POST back
- Custom code is injected directly into the web UI — malformed HTML/CSS/JS can break the interface
- Custom colors must be an array of hex strings
