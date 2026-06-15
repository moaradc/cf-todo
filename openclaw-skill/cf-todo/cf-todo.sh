#!/usr/bin/env bash
# cf-todo API helper script for OpenClaw skill
# Usage: cf-todo.sh <action> [args...]
#
# Environment variables:
#   CF_TODO_API_URL  - Base URL (e.g. https://todo.example.com)
#   CF_TODO_API_KEY  - API Key (cfk_...)
#
# Actions:
#   todos:date <YYYY-MM-DD>              - List todos by date
#   todos:range <start> <end>            - List todos by date range
#   todos:get <id>                        - Get a single todo
#   todos:create <date> <text> [priority] - Create a todo
#   todos:update <id> <json-body>         - Update a todo
#   todos:toggle <id>                     - Toggle done status
#   todos:delete <id> [scope]             - Delete a todo
#   todos:subtasks <id> <json-body>     - Update subtasks independently
#   todos:search-terms <id> <json-body> - Update search terms independently
#   trash:list                            - List trash
#   trash:restore <id>                    - Restore a todo
#   trash:permanent <id>                  - Permanently delete a todo
#   trash:clear                           - Clear all trash
#   trash:clear-all-data                  - Clear ALL data (dangerous!)
#   cats:list                             - List all categories
#   cats:get <id>                         - Get a category
#   cats:create <name> [color]            - Create a category
#   cats:update <id> <json-body>          - Update a category
#   cats:delete <id>                      - Delete a category
#   stats <start> <end>                   - Get statistics
#   settings:get                          - Get app settings
#   settings:save <json-body>             - Save app settings (full overwrite)
#   custom-code:get                       - Get custom header + content
#   custom-code:save <json-body>          - Save custom code
#   custom-header                         - Get custom header (plain text)
#   custom-content                        - Get custom content (plain text)
#   custom-colors:get                     - Get custom colors
#   custom-colors:save <json-body>        - Save custom colors

set -euo pipefail

BASE_URL="${CF_TODO_API_URL:-}"
API_KEY="${CF_TODO_API_KEY:-}"

if [[ -z "$BASE_URL" || -z "$API_KEY" ]]; then
  echo "Error: CF_TODO_API_URL and CF_TODO_API_KEY must be set" >&2
  exit 1
fi

BASE_URL="${BASE_URL%/}"
curl_opts=(-s -H "X-API-Key: $API_KEY" -H "Content-Type: application/json")

# JSON-safe string escaping (no jq dependency)
json_str() {
  python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$1"
}

action="${1:-}"
shift || true

case "$action" in
  todos:date)
    date="${1:?Usage: todos:date <YYYY-MM-DD>}"
    curl "${curl_opts[@]}" "$BASE_URL/api/v1/todos?date=$date"
    ;;
  todos:range)
    start="${1:?Usage: todos:range <start> <end>}"
    end="${2:?Usage: todos:range <start> <end>}"
    curl "${curl_opts[@]}" "$BASE_URL/api/v1/todos?start_date=$start&end_date=$end"
    ;;
  todos:get)
    id="${1:?Usage: todos:get <id>}"
    curl "${curl_opts[@]}" "$BASE_URL/api/v1/todos/$id"
    ;;
  todos:create)
    date="${1:?Usage: todos:create <date> <text> [priority]}"
    text="${2:?Usage: todos:create <date> <text> [priority]}"
    priority="${3:-low}"
    curl "${curl_opts[@]}" -X POST "$BASE_URL/api/v1/todos" \
      -d "{\"date\":\"$date\",\"text\":$(json_str "$text"),\"priority\":\"$priority\"}"
    ;;
  todos:update)
    id="${1:?Usage: todos:update <id> <json-body>}"
    body="${2:?Usage: todos:update <id> <json-body>}"
    curl "${curl_opts[@]}" -X PUT "$BASE_URL/api/v1/todos/$id" -d "$body"
    ;;
  todos:toggle)
    id="${1:?Usage: todos:toggle <id>}"
    curl "${curl_opts[@]}" -X PATCH "$BASE_URL/api/v1/todos/$id/toggle"
    ;;
  todos:delete)
    id="${1:?Usage: todos:delete <id> [scope]}"
    scope="${2:-}"
    url="$BASE_URL/api/v1/todos/$id"
    [[ -n "$scope" ]] && url="$url?scope=$scope"
    curl "${curl_opts[@]}" -X DELETE "$url"
    ;;
  todos:subtasks)
    id="${1:?Usage: todos:subtasks <id> <json-body>}"
    body="${2:?Usage: todos:subtasks <id> <json-body>}"
    curl "${curl_opts[@]}" -X PATCH "$BASE_URL/api/v1/todos/$id/subtasks" -d "$body"
    ;;
  todos:search-terms)
    id="${1:?Usage: todos:search-terms <id> <json-body>}"
    body="${2:?Usage: todos:search-terms <id> <json-body>}"
    curl "${curl_opts[@]}" -X PATCH "$BASE_URL/api/v1/todos/$id/search-terms" -d "$body"
    ;;
  trash:list)
    curl "${curl_opts[@]}" "$BASE_URL/api/v1/trash"
    ;;
  trash:restore)
    id="${1:?Usage: trash:restore <id>}"
    curl "${curl_opts[@]}" -X POST "$BASE_URL/api/v1/trash-action" \
      -d "{\"action\":\"RESTORE\",\"id\":\"$id\"}"
    ;;
  trash:permanent)
    id="${1:?Usage: trash:permanent <id>}"
    curl "${curl_opts[@]}" -X POST "$BASE_URL/api/v1/trash-action" \
      -d "{\"action\":\"DELETE_PERMANENT\",\"id\":\"$id\"}"
    ;;
  trash:clear)
    curl "${curl_opts[@]}" -X POST "$BASE_URL/api/v1/trash-action" \
      -d '{"action":"CLEAR_ALL"}'
    ;;
  trash:clear-all-data)
    curl "${curl_opts[@]}" -X POST "$BASE_URL/api/v1/trash-action" \
      -d '{"action":"CLEAR_ALL_DATA"}'
    ;;
  cats:list)
    curl "${curl_opts[@]}" "$BASE_URL/api/v1/categories"
    ;;
  cats:get)
    id="${1:?Usage: cats:get <id>}"
    curl "${curl_opts[@]}" "$BASE_URL/api/v1/categories/$id"
    ;;
  cats:create)
    name="${1:?Usage: cats:create <name> [color]}"
    color="${2:-#888888}"
    curl "${curl_opts[@]}" -X POST "$BASE_URL/api/v1/categories" \
      -d "{\"name\":$(json_str "$name"),\"color\":\"$color\"}"
    ;;
  cats:update)
    id="${1:?Usage: cats:update <id> <json-body>}"
    body="${2:?Usage: cats:update <id> <json-body>}"
    curl "${curl_opts[@]}" -X PUT "$BASE_URL/api/v1/categories/$id" -d "$body"
    ;;
  cats:delete)
    id="${1:?Usage: cats:delete <id>}"
    curl "${curl_opts[@]}" -X DELETE "$BASE_URL/api/v1/categories/$id"
    ;;
  stats)
    start="${1:?Usage: stats <start> <end>}"
    end="${2:?Usage: stats <start> <end>}"
    curl "${curl_opts[@]}" "$BASE_URL/api/v1/stats?start=$start&end=$end"
    ;;
  settings:get)
    curl "${curl_opts[@]}" "$BASE_URL/api/v1/settings"
    ;;
  settings:save)
    body="${1:?Usage: settings:save <json-body>}"
    curl "${curl_opts[@]}" -X POST "$BASE_URL/api/v1/settings" -d "$body"
    ;;
  custom-code:get)
    curl "${curl_opts[@]}" "$BASE_URL/api/v1/custom-code"
    ;;
  custom-code:save)
    body="${1:?Usage: custom-code:save <json-body>}"
    curl "${curl_opts[@]}" -X POST "$BASE_URL/api/v1/custom-code" -d "$body"
    ;;
  custom-header)
    curl "${curl_opts[@]}" "$BASE_URL/api/v1/custom-header"
    ;;
  custom-content)
    curl "${curl_opts[@]}" "$BASE_URL/api/v1/custom-content"
    ;;
  custom-colors:get)
    curl "${curl_opts[@]}" "$BASE_URL/api/v1/custom-colors"
    ;;
  custom-colors:save)
    body="${1:?Usage: custom-colors:save <json-body>}"
    curl "${curl_opts[@]}" -X POST "$BASE_URL/api/v1/custom-colors" -d "$body"
    ;;
  *)
    echo "Unknown action: $action" >&2
    echo "Available: todos:date, todos:range, todos:get, todos:create, todos:update, todos:toggle, todos:delete, todos:subtasks, todos:search-terms, trash:list, trash:restore, trash:permanent, trash:clear, trash:clear-all-data, cats:list, cats:get, cats:create, cats:update, cats:delete, stats, settings:get, settings:save, custom-code:get, custom-code:save, custom-header, custom-content, custom-colors:get, custom-colors:save" >&2
    exit 1
    ;;
esac

echo ""
