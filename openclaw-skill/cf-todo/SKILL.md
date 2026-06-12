---
name: cf-todo
description: Manage todos and categories on a Cloudflare Worker + D1 Todo App. Create, read, update, delete todos and categories via a secure RESTful API.
version: 1.0.0
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
  "scope": "none"
}
```

For recurring (series) todos, set `scope` to control the update range:
- `"none"` — update this instance only (default for non-recurring)
- `"this"` — update this instance, detach from series
- `"thisAndFuture"` — update this and all future instances
- `"all"` — update all instances in the series

#### Toggle todo done status

```
PATCH {CF_TODO_API_URL}/api/v1/todos/{id}/toggle
```

#### Delete a todo

```
DELETE {CF_TODO_API_URL}/api/v1/todos/{id}?scope=none
```

Query parameter `scope` (for recurring todos): `this`, `thisAndFuture`, `all`

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

**Mark a todo as done:**
```bash
curl -s -X PATCH -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}/toggle"
```

**Delete a todo:**
```bash
curl -s -X DELETE -H "X-API-Key: $CF_TODO_API_KEY" "$CF_TODO_API_URL/api/v1/todos/{id}"
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
