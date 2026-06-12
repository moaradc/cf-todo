---
name: cf-todo
description: Manage todos and categories on a Cloudflare Worker + D1 Todo App. Create, read, update, delete todos and categories via a secure RESTful API.
version: 1.1.0
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

## CRITICAL: Recurring Todo Scope Rules

**Recurring (repeating) todos** have a `repeatType` of `daily`, `weekly`, `monthly`, or `yearly`. They belong to a "series" — a group of instances sharing the same `parentId`.

When updating or deleting a recurring todo, you MUST choose the correct `scope`:

| User intent (natural language) | scope value | What it does |
|---|---|---|
| "删除这个" / "仅删除" / "删掉今天的" / "delete this one" | `this` (default) | Deletes only this instance; adds an exception date so it won't regenerate |
| "删除这个及之后的" / "从这天起不再重复" / "delete this and future" | `thisAndFuture` | Deletes this and all future instances; keeps past instances |
| "删除整个系列" / "删除所有重复" / "delete the entire series" | `all` | Deletes ALL instances in the series and the template — **IRREVERSIBLE** |

### IMPORTANT Safety Rules

1. **Default scope is `this`** — If the user doesn't specify, always use `scope=this`. The API already defaults to this, but you should be explicit.
2. **NEVER use `scope=all` unless the user EXPLICITLY says so** — Phrases like "删除整个系列", "删掉所有重复的", "delete the entire series" qualify. If unsure, ASK the user first.
3. **Always confirm before `scope=all` or `scope=thisAndFuture`** — These are destructive and affect multiple instances. Show the user what will happen and ask for confirmation.
4. **When user says "删除" without qualification for a recurring todo** — Use `scope=this` (delete only this one instance).

### How to identify a recurring todo

A todo is recurring if its API response has:
- `repeatType` != `"none"` (e.g. `"daily"`, `"weekly"`, `"monthly"`, `"yearly"`)
- `isSeries` = `true`

Always check these fields before deciding on scope.

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
Optional: `time`, `priority` (low/medium/high, default low), `desc`, `url`, `copyText`, `subtasks`, `searchTerms`, `repeatType` (none/daily/weekly/monthly/yearly), `repeatEnd`, `endTime`, `categoryId`

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

#### List all categories

```
GET {CF_TODO_API_URL}/api/v1/categories
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
  "color": "#FF5733"
}
```

Required: `name`. Optional: `color` (hex color, default #888888)

#### Update a category

```
PUT {CF_TODO_API_URL}/api/v1/categories/{id}
Content-Type: application/json

{
  "name": "Updated name",
  "color": "#00FF00"
}
```

#### Delete a category

```
DELETE {CF_TODO_API_URL}/api/v1/categories/{id}
```

Deleting a category clears the `categoryId` on all associated todos.

## Usage Instructions

When the user asks to manage their todo list or categories, use the `exec` tool to make curl requests to the cf-todo API. Always include the API key header.

### Step-by-step workflow

1. **Always fetch first** — Before deleting or updating, GET the todo list to find the correct `id` and check if it's recurring (`isSeries: true`).
2. **Check recurring status** — If the todo is recurring, determine the appropriate `scope` based on the user's intent (see scope rules above).
3. **Confirm destructive actions** — Before using `scope=all` or `scope=thisAndFuture`, tell the user what will happen and ask for confirmation.
4. **Execute and verify** — After the operation, GET the todo list again to confirm the result.

### Common patterns

**Show today's todos:**
```bash
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos?date=$(date +%Y-%m-%d)"
```

**Create a new todo:**
```bash
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos" \
  -d '{"date":"2026-06-12","text":"Task description","priority":"medium"}'
```

**Create a recurring todo:**
```bash
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/todos" \
  -d '{"date":"2026-06-12","text":"Daily standup","time":"09:30","priority":"high","repeatType":"daily"}'
```

**Delete a non-recurring todo:**
```bash
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}"
```

**Delete only this instance of a recurring todo:**
```bash
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}?scope=this"
```

**Delete entire recurring series (MUST confirm with user first!):**
```bash
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}?scope=all"
```

**Mark a todo as done:**
```bash
curl -s -X PATCH -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}/toggle"
```

**List categories:**
```bash
curl -s -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/categories"
```

**Create a category:**
```bash
curl -s -X POST -H "X-API-Key: $CF_TODO_API_KEY" -H "Content-Type: application/json" \
  "$CF_TODO_API_URL/api/v1/categories" \
  -d '{"name":"Work","color":"#3B82F6"}'
```

## Response format

All responses are JSON. Successful responses contain a `success: true` field and a `data` field with the result. Error responses contain an `error` field with a message.

## Limitations

- Maximum 10 API keys per deployment
- API keys can be managed only through the web UI (cookie auth required)
- Date format must be YYYY-MM-DD
- Maximum 500 todos per query (use pagination for more)
