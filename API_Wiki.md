# Cloudflare Todo App API Wiki

本文档详细说明了项目中所有 API 端点，涵盖 V0（Web 内部）和 V1（RESTful 外部调用）两套体系。

---

## 1. 架构概览

### 两套 API 体系

| 体系 | 文件 | 基础路径 | 鉴权方式 | 用途 |
|------|------|----------|----------|------|
| **V0 (Internal/Web)** | `api.js` | `/api/` | Cookie 或 API Key | Web 前端 + 外部调用 |
| **V1 (RESTful)** | `api-v1.js` | `/api/v1/` | API Key 或 Cookie | 外部程序 / OpenClaw 调用 |

### 公开端点（无需鉴权）

以下 V0 端点无需鉴权即可访问：
- `POST /api/login`
- `POST /api/logout`
- `GET /api/hot-search`

V0 和 V1 的非公开端点均支持 API Key 鉴权，同一个 API Key 可同时用于两套 API。

### 数据库表结构

| 表名 | 用途 |
|------|------|
| `todos` | 待办事项实例 |
| `todo_templates` | 重复任务模板 |
| `categories` | 分类 |
| `settings` | 配置项（键值对） |
| `login_attempts` | 登录尝试记录（IP 限流） |
| `import_sessions` | 导入会话状态 |
| `export_sessions` | 导出会话状态 |

---

## 2. V1 RESTful API（用于外部调用）

基础路径: `/api/v1/`

### 2.1 鉴权 (Authentication)

V1 API 支持两种鉴权方式，二选一：

1. **API Key**（推荐）:
   - Header: `X-API-Key: <your_api_key>`
   - Query: `?api_key=<your_api_key>`
   - Bearer Token: `Authorization: Bearer <your_api_key>`（仅当 token 以 `cfk_` 开头时生效）
2. **Cookie**: 适用于已登录的网页端用户。

API Key 格式为 `cfk_` 前缀 + 32 字节随机 Base64URL 编码。验证使用恒定时间比较防止时序攻击。每次成功调用会异步更新 Key 的 `lastUsedAt`（限频：5 分钟内最多更新一次）。

### 2.2 API Key 管理

管理端点需要 Cookie 鉴权（即已登录的网页端用户），不支持 API Key 鉴权。

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
  - **限制**: 最多创建 10 个 API Key。名称最长 50 字符，默认值 `"Default"`。

---

### 2.3 Todo API

- **GET /api/v1/todos**
  - **描述**: 查询 Todo 列表。
  - **查询参数**:
    | 参数 | 类型 | 默认值 | 说明 |
    |------|------|--------|------|
    | `date` | string | - | 精确日期 `YYYY-MM-DD`，与 `start_date`/`end_date` 互斥 |
    | `start_date` | string | - | 起始日期（含） |
    | `end_date` | string | - | 结束日期（含） |
    | `category_id` | string | - | 按分类筛选 |
    | `done` | string | - | `true` 仅已完成，`false` 仅未完成，不传则全部 |
    | `limit` | int | 100 | 分页大小，最大 500 |
    | `offset` | int | 0 | 分页偏移 |
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
    | scope | 行为 |
    |-------|------|
    | `this` | 仅更新此实例（重复任务默认值）。向模板添加 exdate；若将 `repeatType` 改为 `none`，则脱离系列（`parentId` 设为自身 `id`） |
    | `thisAndFuture` | 更新此实例及未来实例，同时更新模板 |
    | `all` | 更新所有实例，同时更新模板和所有已有实例 |
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
      | scope | 行为 |
      |-------|------|
      | `this` (默认) | 仅删除此实例，向模板添加 exdate 防止重新生成 |
      | `thisAndFuture` | 删除此实例及所有未来实例，设置模板和过去实例的 `repeatEnd` |
      | `all` | 删除整个系列（所有实例 + 模板）。模板被永久删除，即使从回收站恢复也无法重建系列 |
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

### 2.4 Category API

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
  - **描述**: 删除分类。**硬删除**（不可恢复），关联的 Todo 和模板的 `categoryId` 自动置空。
  - **响应**: `{"success": true}`

- **POST /api/v1/categories/batch**
  - **描述**: 批量删除分类。**硬删除**，关联的 Todo 和模板的 `categoryId` 自动置空。
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

### 2.5 回收站 API

- **GET /api/v1/trash**
  - **描述**: 获取回收站列表（已删除的 Todo）。
  - **查询参数**:
    | 参数 | 类型 | 默认值 | 说明 |
    |------|------|--------|------|
    | `limit` | int | 100 | 最大 500 |
    | `offset` | int | 0 | 分页偏移 |
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
    | Action | 说明 |
    |--------|------|
    | `RESTORE` | 恢复单条。自动处理重复任务：移除 exdate、重建模板（如已删除）、冲突时脱钩（`parentId` 设为自身） |
    | `DELETE_PERMANENT` | 永久删除单条。**不可恢复** |
    | `CLEAR_ALL` | 清空回收站。**不可恢复** |
    | `BATCH_RESTORE` | 批量恢复。自动处理重复任务冲突：同日期已有实例或模板 `repeatEnd` 已过期时自动脱钩 |
    | `BATCH_DELETE_PERMANENT` | 批量永久删除。**不可恢复** |
    | `CLEAR_ALL_DATA` | **危险** 清空所有数据（todos、templates、settings、categories），**不可恢复** |
  - **响应**:
    - `RESTORE` / `DELETE_PERMANENT` / `CLEAR_ALL`: `{"success": true}`
    - `BATCH_RESTORE`: `{"success": true, "data": {"restored": 2}}`
    - `BATCH_DELETE_PERMANENT`: `{"success": true, "data": {"deleted": 2}}`

---

### 2.6 Todo 子任务与搜索词

- **PATCH /api/v1/todos/:id/subtasks**
  - **描述**: 独立更新子任务。
  - **Body**:
    ```json
    {
      "subtasks": [
        { "text": "Subtask 1", "done": false },
        { "text": "Subtask 2", "done": true }
      ]
    }
    ```
  - **响应**: `{"success": true}`

- **PATCH /api/v1/todos/:id/search-terms**
  - **描述**: 独立更新搜索词。
  - **Body**:
    ```json
    {
      "searchTerms": [
        { "text": "tag1", "done": false },
        { "text": "tag2", "done": false }
      ]
    }
    ```
  - **响应**: `{"success": true}`

---

### 2.7 统计 API

- **GET /api/v1/stats**
  - **描述**: 获取指定时间范围内的统计数据（仅统计未删除的 Todo）。服务端聚合：D1 batch 一次往返跑 6 条 GROUP BY 查询，把数万行原始数据压缩为几十行聚合结果，Worker 内存与网络出口字节下降一个数量级。
  - **查询参数**:
    - `start` (string, 必填): 起始日期 YYYY-MM-DD
    - `end` (string, 必填): 结束日期 YYYY-MM-DD
  - **响应**:
    ```json
    {
      "success": true,
      "data": {
        "total": 510,
        "done": 272,
        "undone": 238,
        "activeDays": 170,
        "byDate": {
          "2026-06-12": { "total": 3, "done": 2 }
        },
        "byCategory": {
          "<category_id>": { "total": 80, "done": 40 }
        },
        "noCategoryCount": { "total": 100, "done": 50 },
        "byPriority": { "high": 68, "med": 306, "low": 136 },
        "byPriorityDone": { "high": 30, "med": 150, "low": 70 },
        "byWeekday": [71, 72, 73, 74, 75, 75, 70],
        "byWeekdayDone": [38, 38, 39, 40, 40, 40, 37],
        "byHourBucket": [0, 68, 204, 136]
      }
    }
    ```
  - **字段说明**:
    - `total` / `done` / `undone`: 总事项数 / 已完成 / 未完成
    - `activeDays`: 有事项的活跃天数
    - `byDate`: 按日期聚合 `{ "YYYY-MM-DD": { total, done } }`
    - `byCategory`: 按分类聚合 `{ "<category_id>": { total, done } }`（不含未分类）
    - `noCategoryCount`: 未分类事项的 `{ total, done }`
    - `byPriority`: 各优先级总数 `{ high, med, low }`
    - `byPriorityDone`: 各优先级已完成数 `{ high, med, low }`
    - `byWeekday`: 按周日聚合的 7 元数组（索引 0=周日, 1=周一, ..., 6=周六）
    - `byWeekdayDone`: 按周日聚合的已完成数 7 元数组
    - `byHourBucket`: 按时段聚合的 4 元数组（0=凌晨0-6, 1=上午6-12, 2=下午12-18, 3=晚上18-24；无 time 字段的事项不计入任何桶）

---

### 2.8 设置 API

- **GET /api/v1/settings**
  - **描述**: 获取应用配置（`app_settings` 键值）。
  - **响应**:
    ```json
    {
      "success": true,
      "data": { "provider": "auto", "sortMethod": "time", "sortAsc": true }
    }
    ```

- **POST /api/v1/settings**
  - **描述**: 保存应用配置（整体覆盖）。
  - **Body**: JSON 对象
  - **响应**: `{"success": true}`

---

### 2.9 自定义代码 API

- **GET /api/v1/custom-code**
  - **描述**: 获取自定义头部代码和内容代码。
  - **响应**:
    ```json
    {
      "success": true,
      "data": {
        "customHeader": "<style>...</style>",
        "customContent": "<script>...</script>"
      }
    }
    ```

- **POST /api/v1/custom-code**
  - **描述**: 保存自定义头部代码和/或内容代码。
  - **Body**:
    ```json
    {
      "customHeader": "<style>...</style>",
      "customContent": "<script>...</script>"
    }
    ```
  - **说明**: 两个字段均可选，仅更新传入的字段。
  - **响应**: `{"success": true}`

- **GET /api/v1/custom-header**
  - **描述**: 获取自定义头部代码（纯文本）。
  - **响应**: `Content-Type: text/plain`

- **GET /api/v1/custom-content**
  - **描述**: 获取自定义内容代码（纯文本）。
  - **响应**: `Content-Type: text/plain`

---

### 2.10 自定义颜色 API

- **GET /api/v1/custom-colors**
  - **描述**: 获取自定义颜色列表。
  - **响应**:
    ```json
    {
      "success": true,
      "data": ["#hex1", "#hex2"]
    }
    ```

- **POST /api/v1/custom-colors**
  - **描述**: 保存自定义颜色列表。
  - **Body**: `{ "colors": ["#hex1", "#hex2"] }`
  - **说明**: `colors` 必须为数组，否则返回 400。
  - **响应**:
    ```json
    { "success": true, "data": ["#hex1", "#hex2"] }
    ```

---

### 2.11 HTTP 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功（POST /todos, POST /categories） |
| 400 | 请求错误（缺少必填字段、格式错误、分类名称重复） |
| 401 | 鉴权失败（API Key 无效或 Cookie 缺失） |
| 404 | 资源不存在 |
| 405 | 请求方法不允许 |
| 409 | 冲突（存在进行中的导入/导出会话） |

---

## 3. V0 Internal API（Web 端）

基础路径: `/api/`
鉴权: Cookie (`auth_token` + `auth_sig`) 或 API Key，除公开端点外均需鉴权。

### V0 API Key 鉴权

与 V1 共享同一套 API Key。鉴权优先级：

1. **API Key**（优先）：提供 API Key 时优先验证，无需 Cookie
2. **Cookie**（回退）：未提供 API Key 时回退到 Cookie 鉴权

API Key 传递方式（与 V1 一致）：
- Header: `X-API-Key: <your_api_key>`
- Query: `?api_key=<your_api_key>`
- Bearer Token: `Authorization: Bearer <your_api_key>`（仅当 token 以 `cfk_` 开头时生效）

**注意**: API Key 管理端点 (`/api/v1/keys`) 仍仅支持 Cookie 鉴权，不支持 API Key 操作自身。

### 3.1 认证与会话管理

- **POST /api/login**（公开端点）
  - **描述**: 密码登录，生成 Session Token 并写入 Cookie。
  - **Body**: `{ "password": "..." }`
  - **限流**: 同一 IP 连续 5 次失败后锁定 15 分钟（返回 429）。
  - **会话管理**: 最多同时 3 个设备（按 User-Agent 去重），超出后淘汰最早的会话。
  - **Cookie 属性**: `HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`（30 天）。
  - **成功响应**: `{ "success": true }` + Set-Cookie 头
  - **失败响应**: 401 `ACCESS DENIED` 或 429 `ACCOUNT LOCKED`

- **POST /api/logout**（公开端点）
  - **描述**: 清除当前设备的 Session，删除对应 Cookie。
  - **响应**: `{ "success": true }` + 清除 Cookie 头

- **GET /api/sessions**
  - **描述**: 获取当前登录的设备列表。
  - **响应**:
    ```json
    [
      { "ua": "Mozilla/5.0...", "disabled": false, "isCurrent": true },
      { "ua": "Mozilla/5.0...", "disabled": false, "isCurrent": false }
    ]
    ```

- **POST /api/session-action**
  - **描述**: 管理会话。
  - **Body**:
    ```json
    { "action": "DELETE", "ua": "User-Agent String" }
    ```
    或
    ```json
    { "action": "DELETE_ALL" }
    ```
  - **说明**: 删除会话时会同步清理 `app_settings.scaleByBrowser` 中对应 UA 的缩放配置。

---

### 3.2 Todo API (Web)

- **GET /api/todos?date=YYYY-MM-DD**
  - **描述**: 获取指定日期的 Todo 列表（包含自动生成的重复任务实例）。
  - **注意**: 如果数据库中不存在该日期的实例但存在模板，此接口会**自动创建**该日期的实例并插入数据库。对于含 `search_terms` 的重复任务，会尝试获取最新热搜词替换。
  - **响应**: Todo 对象数组（V0 格式，见 [4.2 节](#42-todo-对象-v0-响应格式)）。

- **POST /api/todo-action**
  - **描述**: 统一的 Todo 操作接口。
  - **Body**:
    ```json
    {
      "action": "ACTION_NAME",
      "task": { /* Todo Object */ },
      "date": "2023-10-01",
      "scope": "this | all | thisAndFuture",
      "ids": ["id1", "id2"],
      "doneStatus": true
    }
    ```
  - **注意**: V0 的 `task` 对象字段命名混合使用 camelCase 和 snake_case（见 [4.2 节](#42-todo-对象-v0-响应格式)）。
  - **支持的 Action**:
    | Action | 说明 |
    |--------|------|
    | `CREATE` | 创建任务。若 `repeat_type` 不为 `none`，同时创建模板 |
    | `UPDATE` | 更新任务。支持 `scope` 参数控制重复任务更新范围 |
    | `DELETE` | 删除任务（软删除）。支持 `scope` 参数控制重复任务删除范围 |
    | `TOGGLE_DONE` | 切换单个完成状态 |
    | `UPDATE_SUBTASKS` | 更新子任务 |
    | `UPDATE_SEARCH_TERMS` | 更新搜索词 |
    | `BATCH_TOGGLE_DONE` | 批量切换状态（需 `ids` + `doneStatus`） |
    | `BATCH_DELETE` | 批量软删除（需 `ids`），自动为重复任务添加 exdate |

---

### 3.3 Category API (Web)

- **GET /api/categories**
  - **描述**: 获取所有分类。
  - **响应**: Category 对象数组。

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
  - **Action 详情**:
    | Action | 说明 |
    |--------|------|
    | `CREATE` | 创建分类。名称唯一（不区分大小写），颜色默认 `#888888` |
    | `UPDATE` | 更新分类名称或颜色。名称唯一性检查排除自身 |
    | `BATCH_DELETE` | 批量删除分类，关联的 Todo 和模板 `category_id` 自动置空 |

---

### 3.4 回收站 API (Web)

- **GET /api/trash**
  - **描述**: 获取回收站列表（最近 100 条，按日期倒序）。
  - **注意**: V0 不支持分页，固定返回 100 条。如需分页请使用 V1 API。
  - **响应格式**: 与 V0 `/api/todos` 不同，trash 返回的是**纯数据库行**，无 `parentId`/`isSeries` 等 camelCase 别名，`done`/`deleted`/`is_exception` 为整数（0/1），`subtasks`/`search_terms` 为未解析的 JSON 字符串。详见 [4.2 节](#42-todo-对象v0-响应格式)。

- **POST /api/trash-action**
  - **描述**: 回收站操作。
  - **Body**:
    ```json
    {
      "action": "RESTORE | DELETE_PERMANENT | CLEAR_ALL | BATCH_RESTORE | BATCH_DELETE_PERMANENT | CLEAR_ALL_DATA",
      "id": "todo_id",
      "ids": ["id1", "id2"]
    }
    ```
  - **Action 详情**:
    | Action | 说明 |
    |--------|------|
    | `RESTORE` | 恢复单条。自动处理重复任务冲突和 exdate |
    | `DELETE_PERMANENT` | 永久删除单条。**不可恢复** |
    | `CLEAR_ALL` | 清空回收站。**不可恢复** |
    | `BATCH_RESTORE` | 批量恢复。自动处理重复任务冲突 |
    | `BATCH_DELETE_PERMANENT` | 批量永久删除。**不可恢复** |
    | `CLEAR_ALL_DATA` | **危险** 清空所有数据（todos、templates、settings、categories），**不可恢复** |

---

### 3.5 数据导出

- **GET /api/export**
  - **描述**: 导出数据，支持三种模式。

#### mode=page（分页导出）

  - **查询参数**:
    | 参数 | 说明 |
    |------|------|
    | `mode` | `page` |
    | `type` | `todos` 或 `templates` |
    | `cursor` | 游标，首次为空 |
    | `sessionId` | 导出会话 ID（可选） |
    | `todos` | `true` 包含未删除项 |
    | `trash` | `true` 包含已删除项 |
  - **响应**: `Content-Type: application/x-ndjson`，每行一个 JSON 对象，末尾附带 `page_info`：
    ```json
    { "_type": "page_info", "cursor": "date:deleted:id", "hasMore": true }
    ```
  - **游标格式**: todos 为 `date:deleted:id`，templates 为 `parent_id`。
  - **每页大小**: 500 条。

#### mode=session（导出会话管理）

  - **查询参数**:
    | 参数 | 说明 |
    |------|------|
    | `mode` | `session` |
    | `action` | `create` / `update` / `status` / `done` / `abort` |
    | `sessionId` | 会话 ID |
    | `todos` / `trash` / `settings` / `categories` | `true` 包含对应数据（create 时） |
    | `todosCursor` / `templatesCursor` | 游标更新（update 时） |
  - **create 响应**:
    ```json
    { "sessionId": "uuid", "hasData": true }
    ```
  - **超时**: 会话 10 分钟无更新自动过期。
  - **冲突**: 存在活跃会话时返回 409。

#### mode=stream（流式导出）

  - **查询参数**:
    | 参数 | 说明 |
    |------|------|
    | `mode` | `stream` |
    | `sessionId` | 导出会话 ID |
    | `todosCursor` / `templatesCursor` | 断点续传游标，`__done__` 表示该类型已完成 |
    | `skipHeader` | `true` 跳过头部元数据 |
    | `todos` / `trash` / `settings` / `categories` | `true` 包含对应数据 |
  - **响应**: `Content-Type: application/x-ndjson`，流式输出。
  - **头部元数据**（`skipHeader=false` 时）:
    - `{ "_type": "settings", "data": {...} }`
    - `{ "_type": "custom_header", "data": "..." }`
    - `{ "_type": "custom_content", "data": "..." }`
    - `{ "_type": "customColors", "data": [...] }`
    - `{ "_type": "categories", "data": [...] }`
  - **模板行格式**: `{ "_type": "template", ...fields }`
  - **断点续传**: 当单次调用查询数达到上限（45 次）时，输出 continuation 标记：
    ```json
    { "_type": "continuation", "todosCursor": "...", "templatesCursor": "...", "hasMore": true }
    ```
  - **每页大小**: 500 条。每 5 页更新一次会话游标。

---

### 3.6 数据导入

- **POST /api/import**
  - **描述**: 导入数据，支持 JSON Body（分阶段）和 NDJSON 流式两种方式。

#### NDJSON 流式导入

  - **Content-Type**: `application/x-ndjson`
  - **查询参数**: `importId`（必填，需先通过 `phase=init` 创建会话）
  - **格式**: 每行一个 JSON 对象。`{ "_type": "template", ...fields }` 为模板行，其余为普通 Todo 行。`_type` 为 `settings`/`categories` 等的行由前端单独处理。
  - **批量大小**: 每 100 条执行一次批量写入。

#### JSON Body 分阶段导入

  - **phase=status**: 查询当前导入状态。
    - **响应**:
      ```json
      {
        "active": true,
        "importId": "uuid",
        "mode": "merge | overwrite",
        "startedAt": 1234567890,
        "updatedAt": 1234567890,
        "timedOut": false,
        "hasBackup": true
      }
      ```
    - **说明**: 自动清理超过 10 分钟的过期备份。

  - **phase=init**: 初始化导入会话。
    - **Body**:
      ```json
      { "importId": "uuid", "mode": "merge | overwrite" }
      ```
    - **overwrite 模式**: 将现有表重命名为 `_backup`，创建新空表。若备份失败自动回滚。
    - **merge 模式**: 直接插入/覆盖数据，不备份。
    - **冲突**: 存在活跃会话时返回 409。

  - **phase=finalize**: 完成导入。
    - **Body**:
      ```json
      {
        "importId": "uuid",
        "custom_header": "...",
        "custom_content": "...",
        "categories": [{ "id": "...", "name": "...", "color": "..." }],
        "customColors": ["#hex1", "#hex2"]
      }
      ```
    - **说明**: 重建索引、保存自定义代码/分类/颜色。overwrite 模式下会清理无效 `category_id` 引用。

  - **phase=abort**: 中止导入。
    - **Body**:
      ```json
      { "importId": "uuid", "discard": false, "keepBackup": false }
      ```
    - **说明**: `discard=true` 时丢弃备份数据；`discard=false` 时从备份恢复原始数据。`keepBackup=true` 保留备份表不恢复。

---

### 3.7 导入备份管理

- **GET /api/import-backup**
  - **描述**: 管理 overwrite 导入模式产生的备份表。
  - **查询参数**: `action` = `query` / `restore` / `clear`（默认 `query`）

  | Action | 说明 |
  |--------|------|
  | `query` | 查询备份表是否存在 |
  | `restore` | 从备份恢复原始数据（覆盖当前数据） |
  | `clear` | 删除备份表（**不恢复**原始数据） |

  - **query 响应**:
    ```json
    {
      "exists": true,
      "todos": "backup_exists",
      "templates": "backup_exists",
      "categories": 0
    }
    ```
  - **restore 响应**:
    ```json
    { "success": true, "restored": { "todos": "restored", "templates": "restored", "categories": 0 } }
    ```
  - **clear 响应**:
    ```json
    { "success": true, "message": "备份记录已清除（原始数据未恢复）" }
    ```

---

### 3.8 自定义代码与样式

- **GET /api/custom-code**
  - **描述**: 获取自定义头部代码和内容代码。
  - **响应**:
    ```json
    { "customHeader": "...", "customContent": "..." }
    ```

- **POST /api/custom-code**
  - **描述**: 保存自定义头部代码和/或内容代码。
  - **Body**:
    ```json
    { "customHeader": "...", "customContent": "..." }
    ```
  - **说明**: 两个字段均可选，仅更新传入的字段。

- **GET /api/custom-header**
  - **描述**: 获取自定义头部代码（纯文本）。
  - **响应**: `Content-Type: text/plain`

- **GET /api/custom-content**
  - **描述**: 获取自定义内容代码（纯文本）。
  - **响应**: `Content-Type: text/plain`

- **GET /api/custom-colors**
  - **描述**: 获取自定义颜色列表。
  - **响应**: 颜色数组 `["#hex1", "#hex2"]`

- **POST /api/custom-colors**
  - **描述**: 保存自定义颜色列表。
  - **Body**: `{ "colors": ["#hex1", "#hex2"] }`
  - **说明**: `colors` 必须为数组，否则返回 400。

---

### 3.9 热搜 API

- **GET /api/hot-search**（公开端点）
  - **描述**: 获取热搜词数据，用于重复任务的 `search_terms` 自动刷新。
  - **查询参数**: `provider`（默认 `auto`）
  - **响应**:
    ```json
    { "success": true, "data": ["word1", "word2", ...] }
    ```

---

### 3.10 统计 API (Web)

- **GET /api/stats?start=YYYY-MM-DD&end=YYYY-MM-DD**
  - **描述**: 获取指定时间范围内的统计数据（仅未删除的 Todo）。服务端聚合：D1 batch 一次往返跑 6 条 GROUP BY 查询，把数万行原始数据压缩为几十行聚合结果。
  - **响应**:
    ```json
    {
      "aggregated": true,
      "range": { "start": "2026-01-01", "end": "2026-06-19" },
      "summary": {
        "total": 510,
        "done": 272,
        "undone": 238,
        "activeDays": 170
      },
      "dailyCounts": {
        "2026-06-12": { "total": 3, "done": 2 }
      },
      "categoryCounts": {
        "<category_id>": { "total": 80, "done": 40 }
      },
      "noCategoryCount": { "total": 100, "done": 50 },
      "priCounts": { "high": 68, "med": 306, "low": 136 },
      "priDone": { "high": 30, "med": 150, "low": 70 },
      "weekdayCounts": [71, 72, 73, 74, 75, 75, 70],
      "weekdayDone": [38, 38, 39, 40, 40, 40, 37],
      "hourBuckets": [0, 68, 204, 136]
    }
    ```
  - **字段说明**:
    - `summary`: 总量汇总（`total` / `done` / `undone` / `activeDays`）
    - `dailyCounts`: 按日期聚合 `{ "YYYY-MM-DD": { total, done } }`
    - `categoryCounts`: 按分类聚合（不含未分类）
    - `noCategoryCount`: 未分类事项的 `{ total, done }`
    - `priCounts` / `priDone`: 各优先级总数 / 已完成数
    - `weekdayCounts` / `weekdayDone`: 按周日聚合的 7 元数组（0=周日, ..., 6=周六）
    - `hourBuckets`: 按时段聚合的 4 元数组（0=凌晨0-6, 1=上午6-12, 2=下午12-18, 3=晚上18-24）
  - **注意**: V0 与 V1 Stats API 均返回服务端聚合结果，字段名略有差异（V0 用 `dailyCounts`/`priCounts` 等，V1 用 `byDate`/`byPriority` 等）。前端通过 `aggregated: true` 标志识别 V0 聚合格式，同时兼容旧版行数组响应。

---

### 3.11 设置 API (Web)

- **GET /api/settings**
  - **描述**: 获取应用配置（`app_settings` 键值）。
  - **响应**: JSON 对象

- **POST /api/settings**
  - **描述**: 保存应用配置（整体覆盖）。
  - **Body**: JSON 对象
  - **响应**: `{ "success": true }`

---

## 4. 数据模型

### 4.1 Todo 对象（V1 响应格式）

V1 API 使用一致的 camelCase 命名：

```json
{
  "id": "uuid",
  "parentId": "uuid",
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
  "repeatCustom": "",
  "repeatEnd": "2023-12-31",
  "endTime": "10:00",
  "categoryId": "cat_id",
  "recurrenceId": "",
  "isException": false,
  "isSeries": true
}
```

### 4.2 Todo 对象（V0 响应格式）

V0 API 响应格式因端点而异：

#### `/api/todos` 响应

`/api/todos` 响应以数据库原始列名（snake_case）为基础，叠加少量类型转换和计算字段：

```json
{
  "id": "uuid",
  "parent_id": "uuid",          // DB 原始列，重复任务系列关联字段
  "date": "2023-10-01",
  "text": "Task Title",
  "time": "09:00",
  "priority": "low | med | high",
  "desc": "Description",
  "url": "https://...",
  "copy_text": "...",           // DB 原始列
  "subtasks": [...],            // 已解析为数组（可能包含纯字符串或 {text, done} 对象）
  "search_terms": [...],        // 已解析为数组
  "done": false,                // 覆盖为布尔值
  "deleted": 0,                 // DB 原始值（整数 0/1）
  "repeat_type": "none | daily | weekly | monthly | yearly",
  "repeat_custom": "",
  "repeat_end": "2023-12-31",
  "end_time": "10:00",
  "category_id": "cat_id",
  "recurrence_id": "",
  "is_exception": 0,            // DB 原始值（整数 0/1）
  "isSeries": true              // 计算字段：repeat_type !== 'none'
}
```

#### `/api/trash` 响应（纯数据库行）

`/api/trash` 返回的是**纯数据库行**，无类型转换或计算字段：

```json
{
  "id": "uuid",
  "parent_id": "uuid",
  "date": "2023-10-01",
  "text": "Task Title",
  "subtasks": "[]",             // 未解析的 JSON 字符串（非数组）
  "search_terms": "[]",         // 未解析的 JSON 字符串（非数组）
  "done": 0,                    // 整数 0/1（非布尔值）
  "deleted": 1,                 // 整数 0/1
  "is_exception": 0,            // 整数 0/1（无 isSeries 字段）
  // ...其余 snake_case 字段同上
}
```

**V0 输入（todo-action 的 task 对象）** 命名规则：
- camelCase: `copyText`、`isSeries`（后端读取）
- snake_case: `repeat_type`、`repeat_end`、`end_time`、`category_id`、`search_terms`（后端读取）
- `parentId`：前端可传但后端 CREATE 时已忽略，始终使用 `task.id` 作为 `parent_id`

**建议**: 新集成请使用 V1 API，字段命名一致且规范。

### 4.3 Category 对象

V0 和 V1 的 Category 对象格式一致：

```json
{
  "id": "cat_id",
  "name": "Category Name",
  "color": "#hex_color"
}
```

---

## 5. 示例代码

### cURL

API Key 支持三种传递方式，V0 和 V1 通用：

```bash
# ──────────────── 方式1: X-API-Key Header ────────────────

# V1: 获取待办列表
curl -H "X-API-Key: cfk_your_key_here" \
     "https://your-app.workers.dev/api/v1/todos?date=2023-10-01"

# V1: 创建待办
curl -X POST \
     -H "X-API-Key: cfk_your_key_here" \
     -H "Content-Type: application/json" \
     -d '{"date":"2023-10-01","text":"买牛奶","priority":"high"}' \
     "https://your-app.workers.dev/api/v1/todos"

# V0: 获取待办列表
curl -H "X-API-Key: cfk_your_key_here" \
     "https://your-app.workers.dev/api/todos?date=2023-10-01"

# ──────────────── 方式2: Query 参数 ────────────────

# V1: 获取待办列表
curl "https://your-app.workers.dev/api/v1/todos?date=2023-10-01&api_key=cfk_your_key_here"

# V0: 获取待办列表
curl "https://your-app.workers.dev/api/todos?date=2023-10-01&api_key=cfk_your_key_here"

# ──────────────── 方式3: Bearer Token ────────────────

# V1: 获取待办列表
curl -H "Authorization: Bearer cfk_your_key_here" \
     "https://your-app.workers.dev/api/v1/todos?date=2023-10-01"

# V0: 获取待办列表
curl -H "Authorization: Bearer cfk_your_key_here" \
     "https://your-app.workers.dev/api/todos?date=2023-10-01"
```

### JavaScript

```javascript
const API_KEY = 'cfk_your_key_here';
const BASE_URL = 'https://your-app.workers.dev';

// ──────────────── 方式1: X-API-Key Header ────────────────

// V1: 获取待办列表
const v1Res = await fetch(`${BASE_URL}/api/v1/todos?date=2023-10-01`, {
  headers: { 'X-API-Key': API_KEY }
});
const v1Data = await v1Res.json();

// V1: 创建待办
await fetch(`${BASE_URL}/api/v1/todos`, {
  method: 'POST',
  headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ date: '2023-10-01', text: '新任务', priority: 'high' })
});

// V0: 获取待办列表
const v0Res = await fetch(`${BASE_URL}/api/todos?date=2023-10-01`, {
  headers: { 'X-API-Key': API_KEY }
});
const v0Data = await v0Res.json();

// ──────────────── 方式2: Query 参数 ────────────────

// V0: 获取待办列表
const v0QueryRes = await fetch(
  `${BASE_URL}/api/todos?date=2023-10-01&api_key=${API_KEY}`
);
const v0QueryData = await v0QueryRes.json();

// ──────────────── 方式3: Bearer Token ────────────────

// V0: 获取待办列表
const v0BearerRes = await fetch(`${BASE_URL}/api/todos?date=2023-10-01`, {
  headers: { 'Authorization': `Bearer ${API_KEY}` }
});
const v0BearerData = await v0BearerRes.json();
```

### Python

```python
import requests

API_KEY = 'cfk_your_key_here'
BASE_URL = 'https://your-app.workers.dev'

# ──────────────── 方式1: X-API-Key Header ────────────────

headers = {'X-API-Key': API_KEY}

# V1: 获取待办列表
response = requests.get(f'{BASE_URL}/api/v1/todos',
                        headers=headers,
                        params={'date': '2023-10-01'})
data = response.json()

# V1: 创建待办
response = requests.post(f'{BASE_URL}/api/v1/todos',
                         headers=headers,
                         json={'date': '2023-10-01', 'text': '新任务', 'priority': 'high'})

# V0: 获取待办列表
response = requests.get(f'{BASE_URL}/api/todos',
                        headers=headers,
                        params={'date': '2023-10-01'})
data = response.json()

# ──────────────── 方式2: Query 参数 ────────────────

# V0: 获取待办列表
response = requests.get(f'{BASE_URL}/api/todos',
                        params={'date': '2023-10-01', 'api_key': API_KEY})
data = response.json()

# ──────────────── 方式3: Bearer Token ────────────────

# V0: 获取待办列表
response = requests.get(f'{BASE_URL}/api/todos',
                        headers={'Authorization': f'Bearer {API_KEY}'},
                        params={'date': '2023-10-01'})
data = response.json()
```

---

## 6. 注意事项

1. API Key 格式为 `cfk_` 前缀 + 32 字节随机编码
2. 完整密钥仅在创建时返回一次，请妥善保存
3. 最多创建 10 个 API Key
4. 禁用的密钥无法通过验证
5. 每次成功调用会异步更新密钥的最后使用时间（5分钟限频）
6. 重复任务默认 `scope=this`，仅操作当前实例
7. `priority` 接受 `low`、`med`、`high`，`medium` 会自动转为 `med`
