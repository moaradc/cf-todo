---
name: cf-todo
description: Manage todos and categories on a self-hosted Cloudflare Worker + D1 Todo App. Use when users ask to add, create, view, complete, update, or delete todos, manage recurring/repeating tasks, organize categories, or check their to-do list.
version: 1.1.0
metadata: {"openclaw":{"emoji":"📝","requires":{"env":["CF_TODO_API_URL","CF_TODO_API_KEY"],"bins":["curl"]},"primaryEnv":"CF_TODO_API_KEY","envVars":[{"name":"CF_TODO_API_URL","required":true,"description":"Base URL of your cf-todo deployment (e.g. https://todo.example.com, no trailing slash)"},{"name":"CF_TODO_API_KEY","required":true,"description":"API Key (cfk_...) generated from the cf-todo web UI Settings page"}]}}
---

# cf-todo

Manage your personal todo list and categories through the cf-todo RESTful API.

## Trigger Phrases

Use this skill when the user:

- Asks to add, create, or schedule a todo/task ("添加待办", "新建任务", "add a todo")
- Wants to view their todos ("看看今天的待办", "我的任务", "show my todos")
- Wants to mark a todo as done ("标记完成", "完成了", "mark as done")
- Wants to update a todo ("改一下", "更新", "change the time")
- Wants to delete a todo ("删除", "删掉", "remove")
- Mentions recurring/repeating tasks ("每日重复", "每周", "daily repeat")
- Wants to manage categories ("创建分类", "改颜色", "new category")
- Asks to assign a category to a todo ("加到工作分类", "set category")

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
| GET | `/api/v1/todos?date=` | 查询 Todo 列表 | 必填 `date`；可选 `start_date`+`end_date`, `category_id`, `done`, `limit`, `offset` |
| GET | `/api/v1/todos/:id` | 获取单个 Todo | — |
| POST | `/api/v1/todos` | 创建 Todo | 必填 `date`, `text`；返回 201；`date` 为首次出现日期 |
| PUT | `/api/v1/todos/:id` | 更新 Todo | 仅传需改字段；可改 `date`；重复任务需设 `scope` |
| PATCH | `/api/v1/todos/:id/toggle` | 切换完成状态 | 重复任务仅影响当天实例 |
| DELETE | `/api/v1/todos/:id` | 删除 Todo（软删除） | 重复任务默认 `scope=this`；可选 `thisAndFuture`, `all` |
| POST | `/api/v1/todos/batch` | 批量操作 | `BATCH_TOGGLE_DONE`（需 `ids`+`doneStatus`）或 `BATCH_DELETE`（需 `ids`）；最多100条 |
| PATCH | `/api/v1/todos/:id/subtasks` | 独立更新子任务 | 需 `subtasks` 数组 |
| PATCH | `/api/v1/todos/:id/search-terms` | 独立更新搜索词 | 需 `searchTerms` 数组 |
| **Category** | | | |
| GET | `/api/v1/categories` | 列出所有分类 | — |
| GET | `/api/v1/categories/:id` | 获取单个分类 | — |
| POST | `/api/v1/categories` | 创建分类 | 必填 `name`；可选 `color`（默认 `#888888`）；返回 201；名称唯一（不区分大小写） |
| PUT | `/api/v1/categories/:id` | 更新分类 | 仅传 `name` 和/或 `color` |
| DELETE | `/api/v1/categories/:id` | 删除分类 | 关联 Todo 的 `categoryId` 自动置空；硬删除 |
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
| GET | `/api/v1/stats?start=&end=` | 统计数据 | 必填 `start`, `end`；返回 total/done/undone/byPriority/byDate |
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

## Safety Rules

These rules are MANDATORY. Violating them may cause irreversible data loss.

### 1. Only do what the user explicitly asked

- "删除A" → delete ONLY A. Do NOT also delete B or modify C.
- "标记为完成" → mark ONLY the specified item. Do NOT mark others.
- "看看今天的待办" → ONLY list. Do NOT delete, update, or create.

### 2. Context-aware targeting

When the user says "标记为完成" or "删掉" without specifying which item:
- Use **conversation context** to identify the exact target (e.g., the item just discussed)
- If multiple items could match, **ASK** which one — never guess or assume "all"
- **NEVER apply operations to items the user did not mention**

### 3. Identify targets before acting

Before update/delete:
1. GET the todo list for the relevant date
2. Match by `text` field to find the target's `id`
3. Use that `id` for the API call
4. If multiple matches, ASK the user which one

### 4. Confirm before destructive actions

Before ANY delete, `scope=all`, or `scope=thisAndFuture`:
1. Show the user exactly what will be affected (name, id, scope)
2. Wait for explicit confirmation
3. Only then execute

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

Recurring todos have `repeatType` != `"none"` and `isSeries` = `true`. They belong to a series sharing the same `parentId`.

When updating/deleting a recurring todo, choose the correct `scope`:

| scope | 含义 | 适用场景 | 风险 |
|-------|------|----------|------|
| `this` | 仅操作此实例 | "仅删除"、"只改这个"（默认） | 低 — 不影响其他实例 |
| `thisAndFuture` | 操作此实例及之后 | "从这天起不再重复" | 中 — 影响多个未来实例，需确认 |
| `all` | 操作整个系列 | "删除整个系列"、"删掉所有重复" | 高 — **不可恢复**，必须用户明确要求 |

**Rules:**
- Default = `this`. API defaults to this, but be explicit in the request.
- **NEVER use `scope=all` unless user EXPLICITLY says so** (e.g., "删除整个系列")
- Always confirm before `all` or `thisAndFuture`
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
      "parentId": "uuid",
      "date": "2026-06-12",
      "text": "Buy groceries",
      "time": "14:00",
      "priority": "high",
      "desc": "Milk, eggs, bread",
      "url": "",
      "copyText": "",
      "subtasks": [{"text": "Milk", "done": false}],
      "searchTerms": [],
      "done": false,
      "deleted": false,
      "repeatType": "none",
      "repeatCustom": "",
      "repeatEnd": "",
      "endTime": "",
      "categoryId": "",
      "recurrenceId": "",
      "isException": false,
      "isSeries": false
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
    "parentId": "uuid",
    "date": "2026-06-12",
    "text": "Buy groceries",
    "time": "14:00",
    "priority": "high",
    "desc": "",
    "url": "",
    "copyText": "",
    "subtasks": [],
    "searchTerms": [],
    "done": false,
    "deleted": false,
    "repeatType": "none",
    "repeatCustom": "",
    "repeatEnd": "",
    "endTime": "",
    "categoryId": "",
    "recurrenceId": "",
    "isException": false,
    "isSeries": false
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
    "repeatType": "none",
    "categoryId": "",
    "subtasks": [{"text": "Milk", "done": false}],
    "endTime": ""
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
| `copyText` | String | `""` |
| `subtasks` | `[{"text":"...", "done":false}]` or `["..."]` | `[]` |
| `searchTerms` | `[{"text":"...", "done":false}]` or `["..."]` | `[]` |
| `repeatType` | `"none"`, `"daily"`, `"weekly"`, `"monthly"`, `"yearly"` | `"none"` |
| `repeatEnd` | YYYY-MM-DD or `""` | `""` |
| `endTime` | HH:MM | `""` |
| `categoryId` | Category ID | `""` |

Note: `"medium"` priority is auto-converted to `"med"`. Subtask/searchTerm strings are auto-converted to `{text, done:false}` objects.

Response (HTTP 201):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "date": "2026-06-12",
    "text": "Buy groceries",
    "repeatType": "none",
    "categoryId": ""
  }
}
```

**Creating a recurring todo:** When `repeatType` is not `"none"`, a template is also created in `todo_templates`. The `date` field becomes the anchor (first occurrence) date.

```bash
# Create a daily recurring todo
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos" \
  -d '{"date":"2026-06-12","text":"晨跑","repeatType":"daily"}'

# Create a weekly recurring todo ending on a specific date
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos" \
  -d '{"date":"2026-06-13","text":"周会","repeatType":"weekly","repeatEnd":"2026-12-31"}'
```

### Update a todo

```bash
curl -s -X PUT -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos/{id}" \
  -d '{"text": "Updated text", "priority": "high", "scope": "this"}'
```

Only include fields you want to change. All fields from Create are also updatable, plus:

| Field | Description |
|---|---|
| `date` | Change the date. For recurring todos with `scope=all` or `thisAndFuture`, changing date will delete and regenerate future instances. |
| `scope` | For recurring todos only: `"this"`, `"thisAndFuture"`, `"all"` |

For recurring todos, set `scope`:
- `"this"` — update this instance only (default for recurring). Adds exdate to template; detaches from series if `repeatType` changes to `"none"`.
- `"thisAndFuture"` — update this + future instances. Updates template.
- `"all"` — update all instances — **DESTRUCTIVE, confirm first**. Updates template + all existing instances.

**Special behaviors:**
- Changing a non-recurring todo to recurring (`repeatType` != `"none"`) creates a template automatically.
- Changing a recurring instance to non-recurring detaches it from the series (sets `parentId` = own `id`, adds exdate to template).
- Changing `date` on a recurring todo with `scope=all` or `thisAndFuture` will delete future instances and regenerate them from the updated template.

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "parentId": "uuid",
    "date": "2026-06-12",
    "text": "Updated text",
    "...": "full todo object"
  }
}
```

### Toggle done status

```bash
curl -s -X PATCH -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}/toggle"
```

Toggles `done` between `true` and `false`. For recurring todos, only the specific day's instance is toggled — other days remain unaffected.

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
- `thisAndFuture` — Soft-deletes this + all future instances; sets `repeatEnd` on template and past instances.
- `all` — Soft-deletes ALL instances + deletes the template — **IRREVERSIBLE even from trash** (template is permanently deleted).

Response:

```json
{
  "success": true
}
```

### Batch operations

```bash
# Batch toggle done
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos/batch" \
  -d '{"action":"BATCH_TOGGLE_DONE","ids":["id1","id2"],"doneStatus":true}'

# Batch delete (soft delete, max 100)
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos/batch" \
  -d '{"action":"BATCH_DELETE","ids":["id1","id2"]}'
```

**BATCH_TOGGLE_DONE** — Set `doneStatus` to `true` (mark done) or `false` (mark undone) for all given `ids`.

**BATCH_DELETE** — Soft-deletes all given `ids` (moves to trash). For recurring todos in the batch, exdates are automatically added to their templates to prevent regeneration.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `action` | string | Yes | `BATCH_TOGGLE_DONE` or `BATCH_DELETE` |
| `ids` | string[] | Yes | Array of todo IDs (max 100) |
| `doneStatus` | boolean | BATCH_TOGGLE_DONE | `true` = done, `false` = undone |

Response:

```json
// BATCH_TOGGLE_DONE
{"success": true, "data": {"affected": 3, "done": true}}

// BATCH_DELETE
{"success": true, "data": {"affected": 3}}
```

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

This is a **hard delete** — the category is permanently removed. All todos and templates that referenced this category will have their `categoryId` set to `""`. **Confirm with user first.**

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
  -d '{"categoryId":"cat_xxx"}'
```

If the category doesn't exist, ask the user if they want to create it first.

### Batch delete categories

```bash
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/categories/batch" \
  -d '{"action":"BATCH_DELETE","ids":["cat_id1","cat_id2"]}'
```

Hard-deletes all specified categories. All associated todos/templates have `categoryId` cleared. **Confirm with user first.**

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
```

**Action details:**

| Action | Required Params | Description |
|---|---|---|
| `RESTORE` | `id` | Restore single todo. For recurring: removes exdate from template, rebuilds template if missing, detaches from series if date conflicts. |
| `DELETE_PERMANENT` | `id` | **Irreversible** hard delete. |
| `CLEAR_ALL` | — | **Irreversible** hard delete all trashed todos. |
| `BATCH_RESTORE` | `ids` (array) | Restore multiple. Auto-handles recurring conflicts: detaches from series if same-date instance already exists or if template `repeatEnd` has passed. |
| `BATCH_DELETE_PERMANENT` | `ids` (array) | **Irreversible** hard delete multiple. |

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

Required: `start`, `end` (YYYY-MM-DD). Only counts non-deleted todos.

Response:

```json
{
  "success": true,
  "data": {
    "total": 20,
    "done": 15,
    "undone": 5,
    "byPriority": {"low": 10, "med": 5, "high": 5},
    "byDate": {
      "2026-06-12": {"total": 3, "done": 2},
      "2026-06-11": {"total": 5, "done": 4}
    }
  }
}
```

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
  -d '{"searchTerms":[{"text":"tag1","done":false}]}'
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
4. **Check recurring** — If `isSeries: true`, determine `scope` from user intent
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

- Max 10 API keys per deployment
- API keys managed only via web UI (cookie auth)
- Date format must be YYYY-MM-DD
- Max 500 todos per query (use pagination)
- Max 100 items per batch operation
- Category names must be unique (case-insensitive)
- Category delete is hard delete (cannot be restored); todo delete is soft delete (restorable from trash)
- Deleting a recurring todo with `scope=all` also permanently deletes the template — the series cannot be restored from trash
