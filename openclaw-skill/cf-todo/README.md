# OpenClaw Skill: cf-todo

A skill for [OpenClaw](https://openclaw.ai) that connects to a [cf-todo](https://github.com/user/cf-todo) deployment (Cloudflare Worker + D1 Todo App) and lets you manage todos and categories through natural language.

## Features

- View, create, update, and delete todos
- Toggle todo completion status
- Manage categories (create, rename, recolor, delete)
- Full support for recurring/repeating todos with scope control
- Secure API Key authentication

## Setup

### 1. Get an API Key

Log in to your cf-todo web UI, then create an API Key:

```bash
curl -X POST https://your-todo.example.com/api/v1/keys \
  -H "Cookie: auth_token=xxx; auth_sig=xxx" \
  -H "Content-Type: application/json" \
  -d '{"action":"CREATE","name":"openclaw"}'
```

Copy the `key` value from the response — it starts with `cfk_` and is shown only once.

### 2. Install the skill

```bash
openclaw skills install ./cf-todo
```

Or copy the `cf-todo` folder to `~/.openclaw/workspace/skills/cf-todo`.

### 3. Configure environment variables

Add to your `~/.openclaw/openclaw.json`:

```json
{
  "skills": {
    "entries": {
      "cf-todo": {
        "enabled": true,
        "env": {
          "CF_TODO_API_URL": "https://your-todo.example.com",
          "CF_TODO_API_KEY": "cfk_your_api_key_here"
        }
      }
    }
  }
}
```

### 4. Restart and use

```bash
openclaw gateway restart
```

Then chat with your OpenClaw agent:

- "Show me today's todos"
- "Add a todo: buy groceries tomorrow"
- "Mark the groceries todo as done"
- "Create a Work category with blue color"
- "Delete the old meeting todo"

## API Reference

See [SKILL.md](./SKILL.md) for the full API documentation.

## Helper Script

A `cf-todo.sh` bash helper is included for quick CLI usage:

```bash
# List today's todos
./cf-todo.sh todos:date 2026-06-12

# Create a todo
./cf-todo.sh todos:create 2026-06-12 "Buy groceries" high

# Toggle done
./cf-todo.sh todos:toggle <todo-id>

# List categories
./cf-todo.sh cats:list

# Create a category
./cf-todo.sh cats:create Work "#3B82F6"
```

## License

MIT-0 (consistent with ClawHub publishing requirements)
