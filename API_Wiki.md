# Cloudflare Todo App API Wiki

本文档详细说明了项目中所有与 Todo 和分类相关的 API 端点。

---

## 1. 架构概览

项目包含两套 API 体系：
- **V0 (Internal/Web)**: `api.js` 中实现，主要供 Web 前端使用，使用 Cookie 鉴权。
- **V1 (RESTful)**: `api-v1.js` 中实现，供 OpenClaw / 外部程序调用，使用 API Key 鉴权。

### 数据库表结构
- `todos`: 存储待办事项。
- `todo_templates`: 存储重复任务的模板信息。
- `categories`: 存储分类。
- `settings`: 存储配置。

---

## 2. V1 RESTful API (用于外部调用)

基础路径: `/api/v1/`

### 2.1 鉴权 (Authentication)

V1 API 鉴权方式：
1.  **API Key**:
    - Header: `X-API-Key: <your_api_key>`
    - Query: `?api_key=<your_api_key>`
    - Bearer Token: `Authorization: Bearer <your_api_key>`
2.  **Cookie**: 仅限管理 API Key 时使用（网页端）。

#### 管理 API Keys

管理端点需要 Cookie 鉴权（即已登录的网页端用户）。

- **GET /api/v1/keys**
  - **描述**: 获取所有 API Keys 列表（脱敏）。
  - **响应**:
    ```json
    [
      {
        "id": "...",
        "name": "...",
        "keyPrefix": "cfk_xxxx...xxxx",
        "createdAt": 1234567890,
        "lastUsedAt": null,
        "disabled": false
      }
    ]
    ```
  - **注意**: 此端点返回裸数组，非 `{success, data}` 格式。

- **POST /api/v1/keys**
  - **描述**: 创建或管理 API Key。
  - **Body**:
    ```json
    {
      "action": "CREATE | DELETE | TOGGLE | RENAME",
      "id": "key_id (for DELETE/TOGGLE/RENAME)",
      "name": "new_name (for CREATE/RENAME)"
    }
    ```
  - **响应 (CREATE)**:
    ```json
    {
      "success": true,
      "id": "...",
      "key": "cfk_xxxxxxxxxxxxx...",  // 完整 Key，仅创建时返回
      "name": "..."
    }
    ```
  - **响应 (DELETE)**: `{"success": true}`
  - **响应 (TOGGLE)**: `{"success": true, "disabled": true}`
  - **响应 (RENAME)**: `{"success": true}`
  - **限制**: 最多创建 10 个 API Key。名称最长 50 字符。

---

### 2.2 Todo API

- **GET /api/v1/todos**
  - **描述**: 查询 Todo 列表。
  - **查询参数**:
    - `date` (string): 精确日期 `YYYY-MM-DD`。
    - `start_date` (string): 起始日期（含）。
    - `end_date` (string): 结束日期（含）。
    - `category_id` (string): 分类 ID。
    - `done` (string): `true` 或 `false`。
    - `limit` (int, default 100, max 500): 分页大小。
    - `offset` (int, default 0): 分页偏移。
  - **注意**: 当使用 `date` 查询时，重复任务模板会自动展开——如果某重复任务应在当天出现但尚无实例，系统会自动创建并返回。
  - **响应**:
    ```json
    {
      "success": true,
      "data": [ /* Todo Objects */ ],
      "pagination": { "total": 10, "limit": 100, "offset": 0 }
    }
    ```

- **POST /api/v1/todos**
  - **描述**: 创建新 Todo。
  - **Body**:
    ```json
    {
      "date": "2023-10-01",       // 必填，YYYY-MM-DD
      "text": "Buy milk",         // 必填
      "time": "10:00",
      "priority": "low | med | high",  // "medium" 自动转为 "med"
      "desc": "Description",
      "url": "https://...",
      "copyText": "Text to copy",
      "subtasks": ["Subtask 1", { "text": "Subtask 2", "done": true }],
      "searchTerms": ["tag1", { "text": "tag2", "done": false }],
      "repeatType": "none | daily | weekly | monthly | yearly",
      "repeatEnd": "2023-12-31",
      "endTime": "11:00",
      "categoryId": "category_id"
    }
    ```
  - **说明**: `subtasks` 和 `searchTerms` 支持纯字符串或 `{text, done}` 对象，纯字符串会自动转为 `{text: "xxx", done: false}`。当 `repeatType` 不为 `none` 时，会同时创建模板记录。
  - **响应 (201)**:
    ```json
    {
      "success": true,
      "data": { "id": "uuid", "date": "2023-10-01", "text": "Buy milk", "repeatType": "none", "categoryId": "" }
    }
    ```

- **GET /api/v1/todos/:id**
  - **描述**: 获取单个 Todo 详情。
  - **响应**:
    ```json
    {
      "success": true,
      "data": {
        "id": "uuid",
        "parentId": "uuid",
        "date": "2023-10-01",
        "text": "Task Title",
        "time": "09:00",
        "priority": "med",
        "desc": "",
        "url": "",
        "copyText": "",
        "subtasks": [{ "text": "Subtask 1", "done": false }],
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

- **PUT /api/v1/todos/:id**
  - **描述**: 更新 Todo。仅传需修改的字段。
  - **Body**: 同创建，所有字段可选。额外支持：
    - `date` (string): 修改日期。对于重复任务配合 `scope=all` 或 `thisAndFuture` 时，会删除并重新生成未来实例。
    - `scope` (string): 用于重复任务，见下方说明。
  - **scope 说明**:
    - `this`: 仅更新此实例（重复任务默认值）。会向模板添加 exdate；若将 `repeatType` 改为 `none`，则脱离系列（`parentId` 设为自身 `id`）。
    - `thisAndFuture`: 更新此实例及未来实例。同时更新模板。
    - `all`: 更新所有实例。同时更新模板和所有已有实例。
  - **特殊行为**:
    - 非重复 → 重复：自动创建模板。
    - 重复 → 非重复：自动脱离系列（`parentId` 改为自身，模板添加 exdate）。
    - 重复任务未指定 `scope` 时，默认 `scope=this`。
  - **响应**:
    ```json
    {
      "success": true,
      "data": { /* 完整 Todo 对象 */ }
    }
    ```

- **DELETE /api/v1/todos/:id**
  - **描述**: 删除 Todo（软删除，移入回收站，可通过 Trash API 恢复）。
  - **查询参数**:
    - `scope` (string): 用于重复任务。
      - `this` (默认): 仅删除此实例，向模板添加 exdate 防止重新生成。
      - `thisAndFuture`: 删除此实例及所有未来实例，设置模板和过去实例的 `repeatEnd`。
      - `all`: 删除整个系列（所有实例 + 模板）。**注意**: 模板被永久删除，即使从回收站恢复也无法重建系列。
  - **注意**: 重复任务未指定 `scope` 时，默认 `scope=this`。
  - **响应**: `{"success": true}`

- **PATCH /api/v1/todos/:id/toggle**
  - **描述**: 切换 Todo 完成状态。重复任务仅影响当天实例。
  - **响应**:
    ```json
    {
      "success": true,
      "data": { "id": "uuid", "done": true }
    }
    ```

- **POST /api/v1/todos/batch**
  - **描述**: 批量操作 Todo。
  - **Body**:
    ```json
    {
      "action": "BATCH_TOGGLE_DONE | BATCH_DELETE",
      "ids": ["id1", "id2"],       // 最多100条
      "doneStatus": true           // BATCH_TOGGLE_DONE 时必填
    }
    ```
  - **BATCH_TOGGLE_DONE**: 批量设置完成状态。`doneStatus: true` 标记完成，`false` 标记未完成。
  - **BATCH_DELETE**: 批量软删除，自动为重复任务添加 exdate 防止重新生成。
  - **响应 (BATCH_TOGGLE_DONE)**:
    ```json
    { "success": true, "data": { "affected": 3, "done": true } }
    ```
  - **响应 (BATCH_DELETE)**:
    ```json
    { "success": true, "data": { "affected": 3 } }
    ```

---

### 2.3 Category API

- **GET /api/v1/categories**
  - **描述**: 获取所有分类列表。
  - **响应**:
    ```json
    {
      "success": true,
      "data": [
        { "id": "cat_xxx", "name": "Work", "color": "#3B82F6" }
      ]
    }
    ```

- **GET /api/v1/categories/:id**
  - **描述**: 获取单个分类详情。
  - **响应**:
    ```json
    {
      "success": true,
      "data": { "id": "cat_xxx", "name": "Work", "color": "#3B82F6" }
    }
    ```

- **POST /api/v1/categories**
  - **描述**: 创建新分类。名称唯一（不区分大小写），重复返回 400。
  - **Body**:
    ```json
    {
      "name": "New Category",  // 必填
      "color": "#00ff00"       // 可选，默认 "#888888"
    }
    ```
  - **响应 (201)**:
    ```json
    {
      "success": true,
      "data": { "id": "cat_xxx", "name": "New Category", "color": "#00ff00" }
    }
    ```

- **PUT /api/v1/categories/:id**
  - **描述**: 更新分类名称或颜色。仅传需修改的字段。名称唯一性检查排除自身。
  - **Body**:
    ```json
    {
      "name": "Updated Name",
      "color": "#0000ff"
    }
    ```
  - **响应**:
    ```json
    {
      "success": true,
      "data": { "id": "cat_xxx", "name": "Updated Name", "color": "#0000ff" }
    }
    ```

- **DELETE /api/v1/categories/:id**
  - **描述**: 删除分类。**硬删除**（不可恢复），关联的 Todo 和模板的 `category_id` 自动置空。
  - **响应**: `{"success": true}`

- **POST /api/v1/categories/batch**
  - **描述**: 批量删除分类。**硬删除**，关联的 Todo 和模板的 `category_id` 自动置空。
  - **Body**:
    ```json
    {
      "action": "BATCH_DELETE",
      "ids": ["cat_id1", "cat_id2"]
    }
    ```
  - **响应**:
    ```json
    { "success": true, "data": { "deleted": 2 } }
    ```

---

### 2.4 回收站 API

- **GET /api/v1/trash**
  - **描述**: 获取回收站列表（已删除的 Todo）。
  - **查询参数**:
    - `limit` (int, default 100, max 500)
    - `offset` (int, default 0)
  - **响应**:
    ```json
    {
      "success": true,
      "data": [ /* Todo Objects (deleted: true) */ ],
      "pagination": { "total": 5, "limit": 100, "offset": 0 }
    }
    ```

- **POST /api/v1/trash-action**
  - **描述**: 回收站操作。
  - **Body**:
    ```json
    {
      "action": "RESTORE | DELETE_PERMANENT | CLEAR_ALL | BATCH_RESTORE | BATCH_DELETE_PERMANENT",
      "id": "todo_id",             // RESTORE / DELETE_PERMANENT
      "ids": ["id1", "id2"]        // BATCH_RESTORE / BATCH_DELETE_PERMANENT
    }
    ```
  - **Action 详情**:
    - `RESTORE`: 恢复单条。自动处理重复任务：移除 exdate、重建模板（如已删除）、冲突时脱钩（`parentId` 设为自身）。
    - `DELETE_PERMANENT`: 永久删除单条。**不可恢复**。
    - `CLEAR_ALL`: 清空回收站。**不可恢复**。
    - `BATCH_RESTORE`: 批量恢复。自动处理重复任务冲突：同日期已有实例或模板 `repeatEnd` 已过期时自动脱钩。
    - `BATCH_DELETE_PERMANENT`: 批量永久删除。**不可恢复**。
  - **响应**:
    - `RESTORE` / `DELETE_PERMANENT` / `CLEAR_ALL`: `{"success": true}`
    - `BATCH_RESTORE`: `{"success": true, "data": {"restored": 2}}`
    - `BATCH_DELETE_PERMANENT`: `{"success": true, "data": {"deleted": 2}}`

---

### 2.5 统计 API

- **GET /api/v1/stats**
  - **描述**: 获取指定时间范围内的统计数据（仅统计未删除的 Todo）。
  - **查询参数**:
    - `start` (string, 必填): 起始日期 YYYY-MM-DD
    - `end` (string, 必填): 结束日期 YYYY-MM-DD
  - **响应**:
    ```json
    {
      "success": true,
      "data": {
        "total": 20,
        "done": 15,
        "undone": 5,
        "byPriority": { "low": 10, "med": 5, "high": 5 },
        "byDate": {
          "2026-06-12": { "total": 3, "done": 2 }
        }
      }
    }
    ```

---

### 2.6 HTTP 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功（POST /todos, POST /categories） |
| 400 | 请求错误（缺少必填字段、格式错误、分类名称重复） |
| 401 | 鉴权失败（API Key 无效或 Cookie 缺失） |
| 404 | 资源不存在 |
| 405 | 请求方法不允许 |

---

## 3. V0 Internal API (Web 端)

基础路径: `/api/`
鉴权: Cookie (`auth_token`, `auth_sig`)。

### 3.1 Auth API

- **POST /api/login**
  - **Body**: `{ "password": "..." }`
  - **操作**: 验证密码，生成 Session Token 并写入 Cookie。支持多设备登录限制（最多3个）。

- **POST /api/logout**
  - **操作**: 清除当前 Cookie 中的 Session。

- **GET /api/sessions**
  - **描述**: 获取当前登录的设备列表。

- **POST /api/session-action**
  - **操作**: 管理会话。
  - **Body**: `{ "action": "DELETE", "ua": "User-Agent String" }` 或 `{ "action": "DELETE_ALL" }`

---

### 3.2 Todo API (Web)

- **GET /api/todos?date=YYYY-MM-DD**
  - **描述**: 获取指定日期的 Todo 列表（包含自动生成的重复任务实例）。
  - **注意**: 如果数据库中不存在该日期的实例，但存在模板，此接口会**自动创建**该日期的实例并插入数据库。

- **POST /api/todo-action**
  - **描述**: 统一的 Todo 操作接口。
  - **Body**:
    ```json
    {
      "action": "ACTION_NAME",
      "task": { /* Todo Object */ },
      "date": "2023-10-01",
      "scope": "this | all | thisAndFuture",
      "ids": ["id1", "id2"],       // for batch ops
      "doneStatus": true           // for batch toggle
    }
    ```
  - **支持的 Action**:
    - `CREATE`: 创建任务。
    - `UPDATE`: 更新任务。
    - `DELETE`: 删除任务。
    - `TOGGLE_DONE`: 切换单个完成状态。
    - `UPDATE_SUBTASKS`: 更新子任务。
    - `UPDATE_SEARCH_TERMS`: 更新搜索词。
    - `BATCH_TOGGLE_DONE`: 批量切换状态。
    - `BATCH_DELETE`: 批量删除（软删除）。

---

### 3.3 Category API (Web)

- **GET /api/categories**
  - **描述**: 获取所有分类。

- **POST /api/category-action**
  - **描述**: 分类操作。
  - **Body**:
    ```json
    {
      "action": "CREATE | UPDATE | BATCH_DELETE",
      "id": "...",
      "ids": ["id1", "id2"],
      "name": "...",
      "color": "..."
    }
    ```

---

### 3.4 Trash API (Web)

- **GET /api/trash**
  - **描述**: 获取回收站列表（最近100条）。

- **POST /api/trash-action**
  - **描述**: 回收站操作。
  - **支持的 Action**:
    - `RESTORE`: 恢复单条。
    - `DELETE_PERMANENT`: 永久删除单条。
    - `CLEAR_ALL`: 清空回收站。
    - `BATCH_RESTORE`: 批量恢复。
    - `BATCH_DELETE_PERMANENT`: 批量永久删除。
    - `CLEAR_ALL_DATA`: **危险** 清空所有数据（包括分类、设置等）。

---

### 3.5 Other APIs

- **GET /api/stats?start=&end=**
  - **描述**: 获取指定时间范围内的统计数据（日期、优先级、完成状态）。

- **GET /api/settings**
  - **描述**: 获取应用配置。

- **POST /api/settings**
  - **描述**: 保存应用配置。

- **GET /api/export**
  - **描述**: 导出数据，支持多种模式（page/stream/session）。

- **POST /api/import**
  - **描述**: 导入数据（支持 JSON 格式）。

---

## 4. Todo 对象结构 (Response Model)

```json
{
  "id": "uuid",
  "parentId": "uuid",       // 重复任务的系列ID，非重复任务等于id
  "date": "2023-10-01",
  "text": "Task Title",
  "time": "09:00",
  "priority": "low | med | high",
  "desc": "Description",
  "url": "https://...",
  "copyText": "...",
  "subtasks": [
    { "text": "Subtask 1", "done": false },
    { "text": "Subtask 2", "done": true }
  ],
  "searchTerms": [
    { "text": "tag1", "done": false },
    { "text": "tag2", "done": false }
  ],
  "done": false,
  "deleted": false,
  "repeatType": "none | daily | weekly | monthly | yearly",
  "repeatCustom": "",       // 暂未使用或用于自定义RRULE
  "repeatEnd": "2023-12-31",
  "endTime": "10:00",
  "categoryId": "cat_id",
  "recurrenceId": "",       // RFC 5545 相关 (暂未完全支持)
  "isException": false,
  "isSeries": true          // 是否属于重复系列
}
```

## 5. Category 对象结构 (Response Model)

```json
{
  "id": "cat_id",
  "name": "Category Name",
  "color": "#hex_color"
}
```
