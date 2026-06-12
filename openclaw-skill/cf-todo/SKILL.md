---
name: cf-todo
description: Manage todos and categories on a Cloudflare Worker + D1 Todo App. Create, read, update, delete todos and categories via a secure RESTful API.
version: 1.0.2
metadata:
  openclaw:
    requires:
      env:
        - CF_TODO_API_URL
        - CF_TODO_API_KEY
    primaryEnv: CF_TODO_API_KEY
    envVars:
      - name: CF_TODO_API_URL
        required: true
        description: Base URL of your cf-todo deployment (e.g. https://todo.example.com)
      - name: CF_TODO_API_KEY
        required: true
        description: API Key (cfk_...) generated from the cf-todo web UI under /api/v1/keys
  emoji: "\U0001F4DD"
  homepage: https://github.com/user/cf-todo
---

# cf-todo Skill

Manage your personal todo list and categories through the cf-todo RESTful API. This skill lets you create, view, update, and delete todos and categories.

## Authentication

All requests require an API Key. It is sent via the `X-API-Key` header. The key and base URL are read from environment variables:
- `CF_TODO_API_URL` — your deployment's base URL (no trailing slash)
- `CF_TODO_API_KEY` — your API key (starts with `cfk_`)

---

## CRITICAL: Strict Instruction Compliance Rules

These rules are MANDATORY. Violating them is a critical error.

### Rule 1: Only do what the user explicitly asked

- **Do exactly what the user says — nothing more, nothing less.**
- If the user says "删除A", delete ONLY A. Do NOT also delete B, modify C, or create D.
- If the user says "创建一个待办", create ONE todo. Do NOT also modify existing ones.
- If the user says "看看今天的待办", ONLY list them. Do NOT delete, update, or create anything.
- If the user says "标记为完成" referring to a specific item, mark ONLY that item. Do NOT mark other items as done.

### Rule 2: Context-aware targeting

- When the user gives a command like "标记为完成" or "删掉" without specifying which item, **use conversation context to identify the exact target**.
- If the previous message mentioned a specific item (e.g., "蓝牙耳机测评那件还没完成"), the user's next command ("标记为完成") refers to THAT item only.
- If there are multiple possible targets and the context is unclear, ASK the user which one. Never assume "all" or pick randomly.
- **NEVER apply operations to items the user did not mention.** If the user says "标记蓝牙耳机测评为完成", do NOT also mark "耳机线" as done.

### Rule 3: How to identify the target for update/delete

When the user wants to update or delete a specific todo, you must identify it by:

1. **GET the todo list first** — Fetch today's (or the relevant date's) todos.
2. **Match by name** — Find the todo whose `text` field matches the user's description (e.g., "蓝牙耳机测评" matches `text: "蓝牙耳机测评"`).
3. **Use the `id` from the result** — Once matched, use that todo's `id` for the update/delete API call.
4. **If multiple matches** — ASK the user which one they mean. Show the matching items with their details.

Example flow:
- User: "删掉蓝牙耳机测评"
- You: GET /api/v1/todos?date=2026-06-12 → find item with text "蓝牙耳机测评" → get its id → DELETE /api/v1/todos/{id}

### Rule 4: Never perform extra operations

- Do NOT batch unrelated operations together unless the user explicitly asks for all of them.
- Do NOT "clean up" or "organize" data on your own initiative.
- Do NOT modify items the user didn't mention.
- Do NOT use `scope=all` or `scope=thisAndFuture` unless the user EXPLICITLY requests it.

### Rule 5: Always confirm before destructive actions

Before ANY delete or bulk operation, you MUST:
1. Show the user exactly what will be affected (item name, id, scope)
2. Wait for explicit user confirmation
3. Only then execute

This applies to:
- Deleting any todo or category
- Using `scope=all` or `scope=thisAndFuture` on recurring todos
- Updating multiple items at once

### Rule 6: Verify after execution

After every create/update/delete, GET the data again to confirm the result. Report the outcome to the user.

### Rule 7: If unsure, ASK

If the user's intent is ambiguous (e.g., "删除那个待办" when there are multiple), ASK which one. Never guess.

---

## CRITICAL: Date Calculation Rules

### Natural language to date mapping

The API requires dates in `YYYY-MM-DD` format. You MUST calculate the correct date from the user's natural language:

| User says | Meaning | How to calculate |
|---|---|---|
| "今天" / "today" | Today's date | Use current date |
| "明天" / "tomorrow" | Tomorrow | current date + 1 day |
| "后天" | Day after tomorrow | current date + 2 days |
| "下周一" / "next Monday" | Next Monday | Find next Monday from current date |
| "6月15日" / "June 15" | Specific date | Use 2026-06-15 (use current year) |
| "周六" / "Saturday" | This Saturday | Find next Saturday (including today if it's Saturday) |

### CRITICAL: Recurring todo first occurrence date

When creating a recurring todo, the `date` field is the **first occurrence date** (anchor date). This is crucial:

- **"创建每周六待办"** on a Friday → `date` should be **Saturday** (tomorrow), NOT today (Friday)
- **"创建每日重复待办"** → `date` should be **today** (or the date the user specified)
- **"创建每周重复待办，名称日常"** on Friday → If the user doesn't specify a start date, use **today** as the first occurrence

Rule: The `date` field = the date of the FIRST occurrence. For weekly recurring todos, if the user says "每周X" (e.g., "每周六"), calculate the NEXT occurrence of that weekday (including today if it matches).

Weekday numbers: Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6

---

## CRITICAL: Recurring Todo Scope Rules

**Recurring (repeating) todos** have a `repeatType` of `daily`, `weekly`, `monthly`, or `yearly`. They belong to a "series" — a group of instances sharing the same `parentId`.

When updating or deleting a recurring todo, you MUST choose the correct `scope`:

| User intent (natural language) | scope value | What it does |
|---|---|---|
| "删除这个" / "仅删除" / "删掉今天的" / "只删这个" / "delete this one" | `this` (default) | Deletes only this instance; adds an exception date so it won't regenerate |
| "删除这个及之后的" / "从这天起不再重复" / "delete this and future" | `thisAndFuture` | Deletes this and all future instances; keeps past instances |
| "删除整个系列" / "删除所有重复" / "delete the entire series" | `all` | Deletes ALL instances in the series and the template — **IRREVERSIBLE** |

### Scope Safety Rules

1. **Default scope is `this`** — If the user doesn't specify, always use `scope=this`. The API already defaults to this, but you should be explicit.
2. **NEVER use `scope=all` unless the user EXPLICITLY says so** — Phrases like "删除整个系列", "删掉所有重复的", "delete the entire series" qualify. If unsure, ASK the user first.
3. **Always confirm before `scope=all` or `scope=thisAndFuture`** — These are destructive and affect multiple instances. Show the user what will happen and ask for confirmation.
4. **When user says "删除" without qualification for a recurring todo** — Use `scope=this` (delete only this one instance).

### How to identify a recurring todo

A todo is recurring if its API response has:
- `repeatType` != `"none"` (e.g. `"daily"`, `"weekly"`, `"monthly"`, `"yearly"`)
- `isSeries` = `true`

Always check these fields before deciding on scope.

### Toggle behavior for recurring todos

- Toggling a recurring todo marks **only that specific date's instance** as done/undone.
- The next day's instance will still appear as undone (this is correct behavior — each day is independent).
- If the user says "标记为完成", use the toggle endpoint for that specific instance only.

---

## API Endpoints

### Todos

#### List todos by date

```
GET {CF_TODO_API_URL}/api/v1/todos?date=YYYY-MM-DD
```

Query parameters:
- `date` (required) — filter by exact date, format YYYY-MM-DD
- `start_date` + `end_date` — date range filter (alternative to `date`)
- `category_id` — filter by category
- `done` — filter by completion: `true` or `false`
- `limit` — max results (default 100, max 500)
- `offset` — pagination offset

#### Get a single todo

```
GET {CF_TODO_API_URL}/api/v1/todos/{id}
```

#### Create a todo

```
POST {CF_TODO_API_URL}/api/v1/todos
Content-Type: application/json

{
  "date": "2026-06-12",
  "text": "Buy groceries",
  "time": "14:00",
  "priority": "high",
  "desc": "Milk, eggs, bread",
  "categoryId": "",
  "repeatType": "none",
  "repeatEnd": "",
  "endTime": "",
  "subtasks": [],
  "searchTerms": []
}
```

Required fields: `date`, `text`
Optional: `time`, `priority`, `desc`, `url`, `copyText`, `subtasks`, `searchTerms`, `repeatType`, `repeatEnd`, `endTime`, `categoryId`

**Priority values:** `"low"`, `"med"`, `"high"` (default: `"low"`). The value `"medium"` is also accepted and will be auto-converted to `"med"`.

**subtasks format:** Array of objects with `text` and `done` fields. You can use either format:
- Object format (recommended): `[{"text": "Task 1", "done": false}, {"text": "Task 2", "done": false}]`
- String shorthand (API will auto-convert): `["Task 1", "Task 2"]` → becomes `[{"text": "Task 1", "done": false}]`

**Creating a recurring todo:** Set `repeatType` to `daily`, `weekly`, `monthly`, or `yearly`. Optionally set `repeatEnd` (YYYY-MM-DD) for when the repetition should stop. **The `date` field is the first occurrence date** — see Date Calculation Rules above.

#### Update a todo

```
PUT {CF_TODO_API_URL}/api/v1/todos/{id}
Content-Type: application/json

{
  "text": "Updated text",
  "priority": "high",
  "scope": "this"
}
```

Only include fields you want to change. Omitted fields keep their current values.

For recurring (series) todos, set `scope` to control the update range:
- `"this"` — update this instance only, detach from series (default for recurring todos)
- `"thisAndFuture"` — update this and all future instances
- `"all"` — update all instances in the series — **DESTRUCTIVE, requires explicit user confirmation**

For non-recurring todos, `scope` is ignored.

#### Toggle todo done status

```
PATCH {CF_TODO_API_URL}/api/v1/todos/{id}/toggle
```

#### Delete a todo

```
DELETE {CF_TODO_API_URL}/api/v1/todos/{id}?scope=this
```

Query parameter `scope` (for recurring todos):
- `this` — delete only this instance (default for recurring todos)
- `thisAndFuture` — delete this and all future instances
- `all` — delete ALL instances in the series — **DESTRUCTIVE, requires explicit user confirmation**

For non-recurring todos, no `scope` is needed.

### Categories

Categories have an `id`, `name`, and `color` (hex color string, e.g. `"#3B82F6"`).

#### List all categories

```
GET {CF_TODO_API_URL}/api/v1/categories
```

Response:
```json
{
  "success": true,
  "data": [
    { "id": "cat_1234", "name": "Work", "color": "#3B82F6" },
    { "id": "cat_5678", "name": "Personal", "color": "#10B981" }
  ]
}
```

#### Get a single category

```
GET {CF_TODO_API_URL}/api/v1/categories/{id}
```

#### Create a category

```
POST {CF_TODO_API_URL}/api/v1/categories
Content-Type: application/json

{
  "name": "Work",
  "color": "#3B82F6"
}
```

Required: `name`. Optional: `color` (hex color string, default `"#888888"`).

**You can create a category with a color in one request** — just include both `name` and `color`.

#### Update a category (name, color, or both)

```
PUT {CF_TODO_API_URL}/api/v1/categories/{id}
Content-Type: application/json

{
  "name": "Updated name",
  "color": "#00FF00"
}
```

You can update `name` alone, `color` alone, or both together. Only include the fields you want to change.

**Change only the color:**
```json
{ "color": "#FF5733" }
```

**Change only the name:**
```json
{ "name": "New Name" }
```

#### Delete a category

```
DELETE {CF_TODO_API_URL}/api/v1/categories/{id}
```

Deleting a category clears the `categoryId` on all associated todos (they become uncategorized). **This requires user confirmation.**

#### Assigning a category to a todo

When the user says "add to Work category" or "set category to Work":
1. First GET /api/v1/categories to find the category ID by name
2. Then PUT /api/v1/todos/{id} with `{"categoryId": "cat_xxx"}`
3. If the category doesn't exist, ask the user if they want to create it first

---

## Step-by-step Workflow

1. **Always fetch first** — Before deleting or updating, GET the todo/category list to find the correct `id` and check if it's recurring (`isSeries: true`).
2. **Identify the exact target** — Match the user's description to a specific item by `text` field. If multiple match, ASK the user which one.
3. **Calculate the correct date** — Convert natural language dates to YYYY-MM-DD format. For recurring todos, ensure `date` is the first occurrence date.
4. **Check recurring status** — If the todo is recurring, determine the appropriate `scope` based on the user's intent (see scope rules above).
5. **Confirm destructive actions** — Before ANY delete or `scope=all`/`thisAndFuture`, tell the user exactly what will happen and wait for confirmation.
6. **Execute only what was asked** — Do NOT add extra operations the user didn't request.
7. **Verify and report** — After the operation, GET the data again to confirm the result. Report the outcome to the user.

---

## Common Patterns

### Read operations (safe, no confirmation needed)

**Show today's todos:**
```bash
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos?date=$(date +%Y-%m-%d)"
```

**List categories:**
```bash
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/categories"
```

### Create operations

**Create a simple todo:**
```bash
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos" \
  -d '{"date":"2026-06-12","text":"Task description","priority":"med"}'
```

**Create a recurring todo (daily):**
```bash
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos" \
  -d '{"date":"2026-06-12","text":"Daily standup","time":"09:30","priority":"high","repeatType":"daily"}'
```

**Create a weekly todo with subtasks and time range:**
```bash
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos" \
  -d '{"date":"2026-06-13","text":"日常","time":"09:00","endTime":"10:00","desc":"日常","repeatType":"weekly","subtasks":[{"text":"书剑","done":false}]}'
```

**Create a category with color:**
```bash
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/categories" \
  -d '{"name":"Work","color":"#3B82F6"}'
```

### Update operations

**Update a category's color only:**
```bash
curl -s -X PUT -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/categories/{id}" \
  -d '{"color":"#FF5733"}'
```

**Update a category's name only:**
```bash
curl -s -X PUT -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/categories/{id}" \
  -d '{"name":"New Name"}'
```

**Mark a todo as done:**
```bash
curl -s -X PATCH -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}/toggle"
```

### Delete operations (ALWAYS confirm with user first!)

**Delete a non-recurring todo:**
```bash
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}"
```

**Delete only this instance of a recurring todo (default):**
```bash
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}?scope=this"
```

**Delete entire recurring series (MUST get explicit user confirmation first!):**
```bash
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}?scope=all"
```

**Delete a category (MUST confirm with user first!):**
```bash
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/categories/{id}"
```

---

## Response format

All responses are JSON. Successful responses contain a `success: true` field and a `data` field with the result. Error responses contain an `error` field with a message.

## Error handling

- `400` — Bad request (missing required fields, invalid format, duplicate name)
- `401` — Authentication failed (invalid or missing API key)
- `404` — Item not found
- `405` — Method not allowed

Always report errors to the user with the error message from the API response.

## Limitations

- Maximum 10 API keys per deployment
- API keys can be managed only through the web UI (cookie auth required)
- Date format must be YYYY-MM-DD
- Maximum 500 todos per query (use pagination for more)
- Category names must be unique (case-insensitive)
