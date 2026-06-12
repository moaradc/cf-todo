---
name: cf-todo
description: Manage todos and categories on a self-hosted Cloudflare Worker + D1 Todo App. Use when users ask to add, create, view, complete, update, or delete todos, manage recurring/repeating tasks, organize categories, or check their to-do list.
version: 1.0.2
metadata:
  openclaw:
    requires:
      env:
        - CF_TODO_API_URL
        - CF_TODO_API_KEY
      bins:
        - curl
    primaryEnv: CF_TODO_API_KEY
    envVars:
      - name: CF_TODO_API_URL
        required: true
        description: Base URL of your cf-todo deployment (e.g. https://todo.example.com, no trailing slash)
      - name: CF_TODO_API_KEY
        required: true
        description: API Key (cfk_...) generated from the cf-todo web UI Settings page
    emoji: "\U0001F4DD"
    homepage: https://github.com/user/cf-todo
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

---

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

---

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

---

## Recurring Todo Scope

Recurring todos have `repeatType` != `"none"` and `isSeries` = `true`. They belong to a series sharing the same `parentId`.

When updating/deleting a recurring todo, choose the correct `scope`:

| User intent | scope | Effect |
|---|---|---|
| "仅删除" / "删掉今天的" / "只删这个" | `this` (default) | Delete this instance only; adds exception date |
| "删除这个及之后的" / "不再重复" | `thisAndFuture` | Delete this + future; keep past |
| "删除整个系列" / "删除所有重复" | `all` | Delete ALL instances + template — **IRREVERSIBLE** |

**Rules:**
- Default = `this`. API defaults to this, but be explicit in the request.
- **NEVER use `scope=all` unless user EXPLICITLY says so** (e.g., "删除整个系列")
- Always confirm before `all` or `thisAndFuture`
- Toggle on a recurring todo marks only that day's instance (next day is still undone — correct)

---

## Core Operations

### List todos

```bash
# By date (required)
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos?date=2026-06-12"

# Date range
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos?start_date=2026-06-12&end_date=2026-06-18"

# Filter by category or completion
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos?date=2026-06-12&category_id=cat_xxx&done=false"
```

Query params: `date`, `start_date`+`end_date`, `category_id`, `done` (true/false), `limit` (max 500), `offset`

### Get a single todo

```bash
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}"
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

Note: `"medium"` priority is auto-converted to `"med"`. Subtask strings are auto-converted to objects.

### Update a todo

```bash
curl -s -X PUT -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos/{id}" \
  -d '{"text": "Updated text", "priority": "high", "scope": "this"}'
```

Only include fields you want to change. For recurring todos, set `scope`:
- `"this"` — update this instance only (default for recurring)
- `"thisAndFuture"` — update this + future instances
- `"all"` — update all instances — **DESTRUCTIVE, confirm first**

### Toggle done status

```bash
curl -s -X PATCH -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}/toggle"
```

### Delete a todo

```bash
# Non-recurring
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}"

# Recurring: delete only this instance (default)
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}?scope=this"

# Recurring: delete entire series (MUST confirm with user!)
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}?scope=all"
```

### List categories

```bash
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/categories"
```

Response: `{"success":true,"data":[{"id":"cat_xxx","name":"Work","color":"#3B82F6"}]}`

### Create a category

```bash
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/categories" \
  -d '{"name":"Work","color":"#3B82F6"}'
```

Required: `name`. Optional: `color` (hex, default `"#888888"`).

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
```

### Delete a category

```bash
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/categories/{id}"
```

Deletes the category and clears `categoryId` on all associated todos. **Confirm with user first.**

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

---

## Workflow

1. **Fetch first** — GET the list before update/delete to find the correct `id`
2. **Identify target** — Match by `text` field. If multiple match, ASK
3. **Calculate date** — Convert natural language to YYYY-MM-DD. For recurring, `date` = first occurrence
4. **Check recurring** — If `isSeries: true`, determine `scope` from user intent
5. **Confirm destructive** — Before delete, `scope=all`, or `scope=thisAndFuture`
6. **Execute only what was asked** — No extra operations
7. **Verify** — GET again after the operation to confirm

---

## Response format

All responses are JSON: `{"success":true,"data":...}` or `{"error":"message"}`

HTTP errors: `400` (bad request), `401` (auth failed), `404` (not found), `405` (method not allowed)

## Limitations

- Max 10 API keys per deployment
- API keys managed only via web UI (cookie auth)
- Date format must be YYYY-MM-DD
- Max 500 todos per query (use pagination)
- Category names must be unique (case-insensitive)
