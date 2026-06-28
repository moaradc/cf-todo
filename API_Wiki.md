# Cloudflare Todo App API Wiki

本文档详细说明了项目中所有 API 端点，涵盖 V0（Web 内部）和 V1（RESTful 外部调用）两套体系。

## 目录

- [1. 架构概览](#1-架构概览)
- [2. V1 RESTful API（用于外部调用）](#2-v1-restful-api用于外部调用)
  - [2.1 鉴权](#21-鉴权-authentication)
  - [2.2 API Key 管理](#22-api-key-管理)
  - [2.3 Todo API](#23-todo-api)
  - [2.4 Category API](#24-category-api)
  - [2.5 回收站 API](#25-回收站-api)
  - [2.6 Todo 子任务与搜索词](#26-todo-子任务与搜索词)
  - [2.7 统计 API](#27-统计-api)
  - [2.8 设置 API](#28-设置-api)
  - [2.9 自定义代码 API](#29-自定义代码-api)
  - [2.10 自定义颜色 API](#210-自定义颜色-api)
  - [2.11 HTTP 状态码](#211-http-状态码)
- [3. V0 Internal API（Web 端）](#3-v0-internal-apiweb-端)
- [4. 数据模型](#4-数据模型)
  - [4.1 Todo 对象（V1 响应格式）](#41-todo-对象v1-响应格式)
  - [4.2 Todo 对象（V0 响应格式）](#42-todo-对象v0-响应格式)
  - [4.3 Category 对象](#43-category-对象)
- [5. Todo 类型专章](#5-todo-类型专章)
  - [5.1 三种类型概览](#51-三种类型概览)
  - [5.2 普通 todo（`repeat_type: "none"`）](#52-普通-todorepeat_type-none)
  - [5.3 重复 todo（`repeat_type: "daily/weekly/monthly/yearly"`）](#53-重复-todorepeat_type-dailyweeklymonthlyyearly)
  - [5.4 碎时记（`repeat_type: "fragment"`）](#54-碎时记repeat_type-fragment)
  - [5.5 字段一致性参考](#55-字段一致性参考)
- [6. 示例代码](#6-示例代码)
- [7. 注意事项](#7-注意事项)

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
    | `expand` | string | `true` | 仅 `date` 查询时有效。`true`（默认）：服务端自动展开重复任务模板并持久化实例；`false`：跳过展开，响应附带 `templates` 数组，调用方自行用 ical.js/rrule.js 计算 |
  - **注意**: 当使用 `date` 查询且 `expand=true`（默认）时，重复任务模板会自动展开——如果某重复任务应在当天出现但尚无实例，系统会自动创建并返回。
  - **响应（默认 expand=true）**:
    ```json
    {
      "success": true,
      "data": [ /* Todo Objects */ ],
      "pagination": { "total": 10, "limit": 100, "offset": 0 }
    }
    ```
  - **响应（expand=false，仅 date 查询）**:
    ```json
    {
      "success": true,
      "data": [ /* 当天已存在的 Todo Objects（不含自动展开的重复实例） */ ],
      "pagination": { "total": 5, "limit": 100, "offset": 0 },
      "templates": [
        {
          "parent_id": "uuid",
          "text": "每天任务",
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
    **templates 行字段说明**：每条 `templates` 元素是 `todo_templates` 表的原始行（`SELECT *`），仅做两处归一化：
    - `exdates`：字符串（JSON 编码数组），保证非空（默认 `"[]"`）
    - `subtasks`：已 parse 为数组（`[]` 或 `[{text, done}]`）
    
    其余字段均为 DB 原值：`search_terms` 与 `time_records` **保留字符串形式**（V1 不 parse，调用方需要时自行 `JSON.parse`）；`time_records` 是模板级历史记录，供 `predictDuration` 中位数预估。`_type` 字段不出现在 V1 响应中（仅 V0 export/import NDJSON 流会加 `_type: "template"`）。

    **expand=false 使用场景**：
    - 程序化调用方需降低 Worker CPU 占用（Free 计划 10ms CPU 限制）
    - 调用方已有 RRULE 计算能力（如 ical.js / rrule.js）
    - 只需查询当天已持久化的实例，不需要自动展开
    - 与 Google Tasks API 行为一致（只返回实例，调用方自行处理重复规则）

    **注意**：`expand=false` 模式不会自动创建重复实例（不写 D1），调用方拿 `templates` 后需自行判断当天是否应有实例。如需持久化实例，请用默认 `expand=true`。`templates` 只包含 `repeat_type IN ('daily','weekly','monthly','yearly')` 的模板，**碎时记（`fragment`）无模板**，会按可见性规则直接出现在 `data` 里。

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
      "copy_text": "Text to copy",
      "subtasks": ["Subtask 1", { "text": "Subtask 2", "done": true }],
      "search_terms": ["tag1", { "text": "tag2", "done": false }],
      "repeat_type": "none | daily | weekly | monthly | yearly | fragment",
      "repeat_end": "2023-12-31",
      "end_time": "11:00",
      "category_id": "category_id",
      "repeat_interval": 1
    }
    ```
  - **说明**: 字段名与 V0 Web API 保持一致（snake_case）。`subtasks` 和 `search_terms` 支持纯字符串或 `{text, done}` 对象，纯字符串会自动转为 `{text: "xxx", done: false}`。当 `repeat_type` 为 `daily`/`weekly`/`monthly`/`yearly` 时会同时创建模板记录；`fragment`（碎时记）与 `none` 不创建模板。
  - **`repeat_type: "fragment"`（碎时记）特殊约束**：
    - `date` 允许为空（表示不限起始日期）。
    - `time`、`end_time`、`repeat_end` 强制清空，`repeat_interval` 强制为 1。
    - 同步写入 `fragment_anchor` 字段（与 `date` 一致），作为取消完成时恢复起始日期的权威副本（详见 [4.1 节](#41-todo-对象v1-响应格式)）。
  - **响应 (201)**:
    ```json
    {
      "success": true,
      "data": { "id": "uuid", "date": "2023-10-01", "text": "Buy milk", "repeat_type": "none", "category_id": "", "repeat_interval": 1, "fragment_anchor": "" }
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
        "parent_id": "uuid",
        "date": "2023-10-01",
        "text": "Task Title",
        "time": "09:00",
        "priority": "med",
        "desc": "",
        "url": "",
        "copy_text": "",
        "subtasks": [{ "text": "Subtask 1", "done": false }],
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
        "fragment_anchor": ""
      }
    }
    ```

- **PUT /api/v1/todos/:id**
  - **描述**: 更新 Todo。仅传需修改的字段。
  - **Body**: 同创建，所有字段可选。额外支持：
    - `date` (string): 修改日期。对于重复任务配合 `scope=all` 或 `thisAndFuture` 时，会删除并重新生成未来实例。
    - `scope` (string): 用于重复任务，见下方说明。
  - **字段回退规则**：未传的字段（`text` / `time` / `priority` / `desc` / `url` / `copy_text` 等）会从数据库当前值回退，不会被静默清空。例如仅传 `{"time":"14:00"}` 时，其他字段保留原值。
  - **scope 说明**:
    | scope | 行为 |
    |-------|------|
    | `this` | 仅更新此实例（重复任务默认值）。向模板添加 exdate；若将 `repeat_type` 改为 `none`，则脱离系列（`parent_id` 设为自身 `id`） |
    | `thisAndFuture` | 更新此实例及未来实例，同时更新模板 |
    | `all` | 更新所有实例，同时更新模板和所有已有实例 |
  - **特殊行为**:
    - 非重复 → 重复：自动创建模板。
    - 重复 → 非重复：自动脱离系列（`parent_id` 改为自身，模板添加 exdate）。
    - 重复任务未指定 `scope` 时，默认 `scope=this`。
    - `scope=all` 缺 `task.parent_id` 时，后端自动从 DB 派生。
    - `repeat_type` 改为 `fragment`（碎时记）时：脱离旧系列（给旧模板加 exdate），强制清空 `time`/`end_time`/`repeat_end`，`repeat_interval=1`，`fragment_anchor` 同步为 `date`（未完成时）或保留原值（已完成时）。
  - **响应**:
    ```json
    {
      "success": true,
      "data": { /* 完整 Todo 对象（含 fragment_anchor） */ }
    }
    ```

- **DELETE /api/v1/todos/:id**
  - **描述**: 删除 Todo（软删除，移入回收站，可通过 Trash API 恢复）。
  - **查询参数**:
    - `scope` (string): 用于重复任务。
      | scope | 行为 |
      |-------|------|
      | `this` (默认) | 仅删除此实例，向模板添加 exdate 防止重新生成 |
      | `thisAndFuture` | 删除此实例及所有未来实例，设置模板和过去实例的 `repeat_end`。被删实例在回收站中 `repeat_type='none'`、`parent_id=id`，恢复时不再重新激活循环 |
      | `all` | 删除整个系列（所有实例 + 模板）。模板被永久删除，被删实例脱钩为单次任务快照，即使从回收站恢复也无法重建系列 |
  - **注意**: 重复任务未指定 `scope` 时，默认 `scope=this`。
  - **响应**: `{"success": true}`

- **PATCH /api/v1/todos/:id/toggle**
  - **描述**: 切换 Todo 完成状态。重复任务仅影响当天实例。
  - **可选 Body**: 切换为完成（`done: false → true`）时可附带 `record` 记录完成时刻：
    ```json
    {
      "record": {
        "s": 1719000000000,  // 开始时间（epoch ms）
        "e": 1719000120000,  // 结束时间（epoch ms）
        "p": 0               // 暂停累计时长（ms）
      }
    }
    ```
  - **record 写入规则**（与 V0 `TOGGLE_DONE` 一致）：
    - `s === e`（零耗时，如勾选框完成）：仅写入实例级 `time_records`，**不写模板级**（避免污染 `predictDuration` 中位数预估）。详情面板显示"完成于 X"。
    - `s < e`（真实耗时，如计时器完成）：实例级 + 模板级双写（与 `TIMER_COMPLETE` 一致）。详情面板显示"完成于 X，耗时 Y"。
    - 实例级 `time_records` 截断规则：**碎时记不截断**（保留全部 session 用于累计统计）；**普通 todo FIFO 5**（保留最近 5 条）。
    - 模板级 `time_records` FIFO 10（仅真实耗时且非碎时记写；碎时记无模板，零耗时跳过）。
    - 校验：`s > 0`、`e >= s`、时长 ≤ 7 天、`0 <= p <= (e-s)`。非法 record 静默跳过。
    - 切换为未完成（`done: true → false`）：清空实例级 `time_records`；碎时记 `date` 从 `fragment_anchor` 恢复。
    - 无 `record` 或 body 解析失败：仅更新 `done` 字段（向后兼容）。
  - **响应**:
    ```json
    {
      "success": true,
      "data": { "id": "uuid", "done": true }
    }
    ```

- **POST /api/v1/todos/batch**
  - **描述**: 批量操作 Todo。后端自动分片处理，可传任意数量。
  - **Body**:
    ```json
    {
      "action": "BATCH_TOGGLE_DONE | BATCH_DELETE",
      "ids": ["id1", "id2", /* ... 任意数量 */],
      "done_status": true,          // BATCH_TOGGLE_DONE 时必填
      "timer_records": [            // 可选，BATCH_TOGGLE_DONE + done_status=true 时生效
        {
          "id": "id1",
          "parent_id": "parent-uuid",
          "record": { "s": 1719000000000, "e": 1719000120000, "p": 0 }
        }
      ]
    }
    ```
  - **BATCH_TOGGLE_DONE**: 批量设置完成状态。
    - `done_status: true`：先批量 `UPDATE done=1`，再对 `timer_records` 中每条 record 写入 `time_records`（规则同 `PATCH /toggle` 的 record 写入）。
    - `done_status: false`：批量 `UPDATE done=0, time_records='[]'`（清空所有选中项的实例级记录）。
    - `ids` 中有但 `timer_records` 没有的项：仅 `done=1`，不写 `time_records`（向后兼容）。
  - **BATCH_DELETE**: 批量软删除，自动为重复任务添加 exdate 防止重新生成。
  - **自动分片**: 当 `ids.length > 99` 时，后端按 99 一组自动分片处理，调用方无需手动拆分。分片内单语句失败不阻断整体流程。
  - **响应 (BATCH_TOGGLE_DONE)**:
    ```json
    {
      "success": true,
      "data": {
        "affected": 105,        // 实际改动行数（非 ids.length，排除不存在/已删除的 id）
        "done": true,
        "chunked": true,        // 是否触发分片（ids.length > 99）
        "chunkCount": 2         // 分片数量（ceil(ids.length / 99)）
      }
    }
    ```
  - **响应 (BATCH_DELETE)**:
    ```json
    {
      "success": true,
      "data": {
        "affected": 105,        // 实际软删除行数
        "chunked": true,
        "chunkCount": 2
      }
    }
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
        { "id": "17825620661884319", "name": "Work", "color": "#3B82F6" }
      ]
    }
    ```

- **GET /api/v1/categories/:id**
  - **描述**: 获取单个分类详情。
  - **响应**:
    ```json
    {
      "success": true,
      "data": { "id": "17825620661884319", "name": "Work", "color": "#3B82F6" }
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
      "data": { "id": "17825620661884319", "name": "New Category", "color": "#00ff00" }
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
      "data": { "id": "17825620661884319", "name": "Updated Name", "color": "#0000ff" }
    }
    ```

- **DELETE /api/v1/categories/:id**
  - **描述**: 删除分类。**硬删除**（不可恢复），关联的 Todo 和模板的 `category_id` 自动置空。
  - **响应**: `{"success": true}`

- **POST /api/v1/categories/batch**
  - **描述**: 批量删除分类。**硬删除**，关联的 Todo 和模板的 `category_id` 自动置空。自动分片。
  - **Body**:
    ```json
    {
      "action": "BATCH_DELETE",
      "ids": ["17825620661884319", "17825620662884320", /* ... 任意数量 */]
    }
    ```
  - **响应**:
    ```json
    {
      "success": true,
      "data": {
        "deleted": 2,           // 实际删除行数
        "chunked": false,       // 是否触发分片（ids.length > 99）
        "chunkCount": 1         // 分片数量
      }
    }
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
    | `RESTORE` | 恢复单条。对齐 RFC 5545 + Google Tasks 标准：仅当回收站行仍携带循环属性（`repeat_type != 'none'` 且 `parent_id != id`）时处理。同日期已有活跃实例 → 脱钩为单次任务；模板仍覆盖此日期 → 从 EXDATE 移除并入系列；模板已删除/截断 → 脱钩为单次任务。**不再重建已删除的模板** |
    | `DELETE_PERMANENT` | 永久删除单条。**不可恢复** |
    | `CLEAR_ALL` | 清空回收站。**不可恢复** |
    | `BATCH_RESTORE` | 批量恢复。自动分片。逻辑同 `RESTORE`：同日期已有实例或模板 `repeat_end` 已过期/删除时自动脱钩为单次任务，否则从 EXDATE 移除并入系列 |
    | `BATCH_DELETE_PERMANENT` | 批量永久删除。自动分片。**不可恢复** |
    | `CLEAR_ALL_DATA` | **危险** 清空所有数据（todos、templates、settings、categories），**不可恢复** |
  - **响应**:
    - `RESTORE` / `DELETE_PERMANENT` / `CLEAR_ALL`: `{"success": true}`
    - `BATCH_RESTORE`: `{"success": true, "data": {"restored": 2, "chunked": false, "chunkCount": 1}}`（`restored` 为实际恢复行数，附 `chunked`/`chunkCount`）
    - `BATCH_DELETE_PERMANENT`: `{"success": true, "data": {"deleted": 2, "chunked": false, "chunkCount": 1}}`（`deleted` 为实际删除行数，附 `chunked`/`chunkCount`）

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
      "search_terms": [
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
  - **会话管理**: 最多同时 10 个设备（按 User-Agent 去重），超出后淘汰最早的会话。
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

- **GET /api/time-records?parent_id=PARENT_ID**
  - **描述**: 获取某个重复模板的最近 10 条完成时间记录（用于详情面板的预估和历史展示）。
  - **响应**:
    ```json
    { "records": [ { "s": 1718841600000, "e": 1718843400000, "p": 60000 }, ... ] }
    ```
    - `s`: 开始时间（epoch ms）
    - `e`: 结束时间（epoch ms）
    - `p`: 暂停累计时长（ms）
    - 实际耗时 = `e - s - p`

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
      "done_status": true,
      "parent_id": "parent-uuid",
      "keep_records": false,
      "timer_records": [
        { "id": "id1", "parent_id": "parent-uuid", "record": { "s": 1719000000000, "e": 1719000120000, "p": 0 } }
      ],
      "record": { "s": 1718841600000, "e": 1718843400000, "p": 60000 }
    }
    ```
  - **命名规则**：所有字段统一 snake_case。`task` 对象字段见 [4.2 节](#42-todo-对象-v0-响应格式)。
  - **支持的 Action**:
    | Action | 说明 |
    |--------|------|
    | `CREATE` | 创建任务。若 `repeat_type` 不为 `none`，同时创建模板。`task.parent_id` 可省略（CREATE 时后端始终用 `task.id` 作为 `parent_id`） |
    | `UPDATE` | 更新任务。支持 `scope` 参数控制重复任务更新范围。**字段回退**：未传的字段（`text`/`time`/`priority`/`desc`/`url`/`copy_text` 等）从 DB 当前值回退，不会被清空。`scope=all` 缺 `task.parent_id` 时后端从 DB 派生 |
    | `DELETE` | 删除任务（软删除）。支持 `scope` 参数控制重复任务删除范围。缺 `task.parent_id` 时后端从 DB 派生 |
    | `TOGGLE_DONE` | 切换单个完成状态。`done: false → true` 时可附带 `record`：`s===e` 零耗时仅写实例级，`s<e` 真实耗时实例级 + 模板级 FIFO 10 双写。实例级截断：碎时记不截断（保留全部 session），普通 todo FIFO 5。`done: true → false` 默认清空实例级 `time_records`；碎时记 `date` 从 `fragment_anchor` 恢复；附带 `keep_records: true`（来自"继续计时"路径，仅碎时记）时保留累计记录不清空 |
    | `TIMER_COMPLETE` | 计时"完成"：标记 done=1 + 追加 session 到 `time_records`。实例级：碎时记不截断 / 普通 todo FIFO 5；模板级 FIFO 10（仅真实耗时且非碎时记）。需 `task.id`、`parent_id`（顶层或 `task.parent_id`）、`record`，服务端校验时长合理性（1s ~ 7d）。碎时记完成时同时冻结 `date` 到 `body.date` |
    | `TIMER_RECORD` | 计时"记录"：保存本次 session 到实例级 `time_records`（碎时记不截断），不标记完成，**不写模板级**。**仅碎时记支持**；普通 todo 收到此 action 直接 no-op（返回 `downgraded: true`），不写任何记录。需 `task.id`、`record` |
    | `UPDATE_SUBTASKS` | 更新子任务 |
    | `UPDATE_SEARCH_TERMS` | 更新搜索词 |
    | `BATCH_TOGGLE_DONE` | 批量切换状态（需 `ids` + `done_status`）。`done_status: true` 可附带 `timer_records` 数组（每项含 `id` / `parent_id` / `record`），每条 record 写入规则同 `TOGGLE_DONE`；`done_status: false` 清空所有选中项实例级 `time_records` |
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
  - **响应格式**: trash 返回**纯数据库行**（snake_case），无 `is_series` 等派生字段，`done`/`deleted`/`is_exception` 为整数（0/1），`subtasks`/`search_terms` 为未解析的 JSON 字符串。详见 [4.2 节](#42-todo-对象v0-响应格式)。

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

V1 API 字段名与 V0 Web API 保持一致（snake_case）。`is_series` 为后端派生字段（由 `repeat_type` 推导，客户端不可篡改）。

```json
{
  "id": "uuid",
  "parent_id": "uuid",
  "date": "2023-10-01",
  "text": "Task Title",
  "time": "09:00",
  "priority": "low | med | high",
  "desc": "Description",
  "url": "https://...",
  "copy_text": "...",
  "subtasks": [
    { "text": "Subtask 1", "done": false },
    { "text": "Subtask 2", "done": true }
  ],
  "search_terms": [
    { "text": "tag1", "done": false },
    { "text": "tag2", "done": false }
  ],
  "done": false,
  "deleted": false,
  "repeat_type": "none | daily | weekly | monthly | yearly | fragment",
  "repeat_custom": "",
  "repeat_end": "2023-12-31",
  "end_time": "10:00",
  "category_id": "cat_id",
  "recurrence_id": "",
  "is_exception": false,
  "is_series": true,
  "repeat_interval": 1,
  "time_records": [
    { "s": 1719000000000, "e": 1719000120000, "p": 0 },
    { "s": 1719000000000, "e": 1719000000000, "p": 0 }
  ],
  "last_completed_at": 1719000000000,
  "last_duration_ms": 120000,
  "is_zero_duration": false,
  "fragment_anchor": ""
}
```

> **`fragment_anchor` 字段说明**：碎时记（`repeat_type: "fragment"`）起始日期的权威副本，不受完成/取消完成影响。
> - 未完成碎时记：`fragment_anchor` 与 `date` 一致。
> - 已完成碎时记：`date` 被冻结为完成日期，`fragment_anchor` 仍保留起始日期；取消完成时 `date` 从 `fragment_anchor` 恢复。
> - 非 fragment 类型（`none`/`daily`/`weekly`/`monthly`/`yearly`）：`fragment_anchor` 始终为空字符串。

**计时字段说明**（实例级完成记录，每个 todo 独立存储）：

V1 API 同时返回**原始记录数组**和**计算字段**，客户端可直接使用计算字段显示，无需自行解析 epoch ms 或计算耗时。

#### 原始字段 `time_records`

| 字段 | 类型 | 说明 |
|------|------|------|
| `s` | number | 开始时间（epoch ms） |
| `e` | number | 结束时间（epoch ms） |
| `p` | number | 暂停累计时长（ms） |

- **实际耗时** = `e - s - p`
- `s === e`：零耗时记录（勾选框完成，仅记录完成时刻）
- `s < e`：有耗时记录（计时器完成）
- 截断规则：**碎时记不截断**（保留全部 session 用于累计统计）；**普通 todo FIFO 5**（保留最近 5 条）
- **末尾为最新一次完成记录**
- `done: false` 时通常为空数组 `[]`（取消勾选会清空）

#### 计算字段（取最新一条 record 计算）

| 字段 | 类型 | 说明 |
|------|------|------|
| `last_completed_at` | number \| null | 最新完成时刻（epoch ms），即 `time_records` 末尾的 `e`；无记录时 `null` |
| `last_duration_ms` | number \| null | 最新一次实际耗时（ms）= `e - s - p`；零耗时为 `0`；无记录时 `null` |
| `is_zero_duration` | boolean | 最新记录是否零耗时（`s === e`）；无记录时 `false` |

#### 客户端显示建议（对应 Web UI）

| 条件 | 显示 |
|------|------|
| `last_completed_at === null` | "无完成耗时记录" |
| `is_zero_duration === true` | "完成于 X"（X = `last_completed_at` 格式化为 HH:MM，不显示耗时） |
| `is_zero_duration === false` | "完成于 X，耗时 Y"（Y = `last_duration_ms` 格式化为可读时长） |

**示例**（JavaScript）：
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
  "repeat_type": "none | daily | weekly | monthly | yearly | fragment",
  "repeat_custom": "",
  "repeat_end": "2023-12-31",
  "end_time": "10:00",
  "category_id": "cat_id",
  "recurrence_id": "",
  "is_exception": 0,            // DB 原始值（整数 0/1）
  "repeat_interval": 1,          // DB 原始值（正整数，碎时记强制为 1）
  "is_series": true,             // 计算字段：repeat_type !== 'none' 且 !== 'fragment'
  "time_records": "[]",         // DB 原始值（JSON 字符串，需客户端 JSON.parse；格式同 V1 的 time_records）
  "fragment_anchor": ""         // DB 原始列，碎时记起始日期权威副本（非碎时记为空字符串）
}
```

> **注意**：V0 `/api/todos` 返回的 `time_records` 是**未解析的 JSON 字符串**（如 `"[{\"s\":...,\"e\":...,\"p\":0}]"`），客户端需自行 `JSON.parse`。V1 API 已解析为数组，无需客户端解析。

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
  "is_exception": 0,            // 整数 0/1（无 is_series 字段）
  "repeat_interval": 1,         // 整数（无默认值的 DB 行）
  "fragment_anchor": "",        // 字符串（碎时记起始日期，非碎时记为空）
  "time_records": "[]",         // 未解析的 JSON 字符串
  // ...其余 snake_case 字段同 V0 /api/todos
}
```

**V0 输入（todo-action 的 task 对象）** 命名规则：
- **统一 snake_case**：`copy_text`、`repeat_type`、`repeat_end`、`end_time`、`category_id`、`search_terms`、`parent_id`、`recurrence_id`、`is_exception`、`repeat_interval`、`repeat_custom`
- `is_series` 为后端派生字段（响应中返回），作为输入时后端忽略，统一从 DB `repeat_type` 推导，避免客户端篡改
- `parent_id`：CREATE 时后端忽略客户端传入，始终使用 `task.id` 作为 `parent_id`；UPDATE/DELETE 时若缺省则从 DB 派生
- **字段回退**：UPDATE 时未传的字段（`text`/`time`/`priority`/`desc`/`url`/`copy_text` 等）从 DB 当前值回退，不会被清空

**V1 输入/输出**：字段命名与 V0 一致（snake_case）。

### 4.3 Category 对象

V0 和 V1 的 Category 对象格式一致：

```json
{
  "id": "17825620661884319",
  "name": "Category Name",
  "color": "#hex_color"
}
```

> **id 生成规则**：category id 由 `Date.now() + 4 位随机数` 拼接而成（纯数字字符串），无固定前缀。

---

## 5. Todo 类型专章

按 `repeat_type` 字段，Todo 实际分为三种行为显著不同的类型：**普通 todo**（`none`）、**重复 todo**（`daily`/`weekly`/`monthly`/`yearly`）、**碎时记**（`fragment`）。本章集中说明三者差异，所有字段命名遵循 [4.1 节](#41-todo-对象v1-响应格式) / [4.2 节](#42-todo-对象v0-响应格式)的 snake_case 规则，下表不再重复列出字段名拼写。

### 5.1 三种类型概览

| 维度 | 普通 todo (`none`) | 重复 todo (`daily/weekly/...`) | 碎时记 (`fragment`) |
|------|--------------------|--------------------------------|---------------------|
| 是否创建 `todo_templates` | 否 | 是 | 否 |
| `is_series` | `false` | `true` | `false` |
| `parent_id` | 自身 `id` | 系列 anchor `id`（CREATE 时与自身一致，后续实例沿用） | 自身 `id` |
| `repeat_interval` | 始终 `1`（无意义） | 用户指定，正整数 | 强制 `1` |
| `date` | 必填 `YYYY-MM-DD` | 必填 `YYYY-MM-DD`（首实例 / anchor） | 可空，未完成=起始或空，完成=冻结为完成日期 |
| `time` / `end_time` | 可设置 | 可设置 | 强制空 |
| `repeat_end` | 强制空 | 可设置 | 强制空 |
| `fragment_anchor` | 始终空 | 始终空 | `YYYY-MM-DD` 或空（碎时记起始日期权威副本） |
| 实例级 `time_records` 截断 | FIFO 5 | FIFO 5 | **不截断**（保留全部 session 用于累计） |
| 模板级 `time_records` | 不写（无模板） | 仅真实耗时（`s<e`）写，FIFO 10 | 不写（无模板） |
| `expand=false` 时是否出现在 `templates` 数组 | 否 | 是 | 否（无模板） |
| 完成 `done: false → true` `date` 行为 | 不变 | 不变 | 冻结为完成日期（`body.date` 或现有 `date`） |
| 取消完成 `done: true → false` `date` 行为 | 不变 | 不变 | 从 `fragment_anchor` 恢复 |
| 取消完成 `time_records` 行为 | 清空实例级 | 清空实例级 | 清空实例级 |

> **三态判定**：后端统一用 `repeat_type !== 'none' && repeat_type !== 'fragment'` 推导 `is_series`，因此「是否重复系列」只看 `daily`/`weekly`/`monthly`/`yearly`；普通 todo 和碎时记都不是系列。

### 5.2 普通 todo（`repeat_type: "none"`）

最常见的一次性任务。

**数据模型约束**

| 字段 | 取值 | 说明 |
|------|------|------|
| `repeat_type` | `"none"` | — |
| `date` | 必填 `YYYY-MM-DD` | 后端校验格式，POST 时缺 `date` 返回 400 |
| `time` / `end_time` | 可设置 | HH:MM 字符串 |
| `repeat_end` | 强制空 | POST/PUT 时即便传入也会被忽略 |
| `repeat_interval` | 始终 `1` | 无意义，PUT 时若不传则回退为 1 |
| `repeat_custom` | 强制空 | `repeat_type=none` 时即使传入也会被静默清空 |
| `fragment_anchor` | 始终空 | DB 列存在但永远写空串 |
| `is_series` | `false` | 后端派生 |
| `parent_id` | 自身 `id` | CREATE 时由后端写入 |

**模板**：不创建 `todo_templates`。

**完成与取消完成**

| 操作 | 行为 |
|------|------|
| `done: false → true` | 写入 `done=1`；若 body 带 `record` 则按 [2.3 节 PATCH /toggle](#patch-apiv1todosidtoggle) 规则写入实例级 `time_records`（零耗时仅实例级，真实耗时实例级 + 模板级双写——但普通 todo 无模板，所以模板级写入跳过） |
| `done: true → false` | 写入 `done=0`，清空实例级 `time_records`；`date` 不变 |

**`time_records` 截断**：实例级 FIFO 5（保留最近 5 条）；无模板级。

**可见性**：`GET /api/v1/todos` 查询时按 `date` 精确匹配 / 范围匹配，无特殊规则。

### 5.3 重复 todo（`repeat_type: "daily/weekly/monthly/yearly"`）

有 RRULE 周期的重复任务，对齐 RFC 5545 + Google Tasks 行为。

**数据模型约束**

| 字段 | 取值 | 说明 |
|------|------|------|
| `repeat_type` | `daily`/`weekly`/`monthly`/`yearly` | 任一非 `none`/`fragment` 值会触发模板创建 |
| `date` | 必填 `YYYY-MM-DD` | 作为 anchor date，首实例日期 |
| `time` / `end_time` | 可设置 | — |
| `repeat_end` | 可设置 | YYYY-MM-DD，重复截止日期；空表示无限 |
| `repeat_interval` | 用户指定，正整数 | 如 `weekly` + `repeat_interval=2` 表示每两周 |
| `repeat_custom` | 可设置（自定义 RRULE） | 自定义 RRULE 字符串（不含 `RRULE:` 前缀），如 `FREQ=WEEKLY;BYDAY=MO,WE,FR`。非空时优先于 `repeat_type`/`repeat_interval` 生效（引擎仍会用 `repeat_interval` 覆盖 custom 中的 INTERVAL，`repeat_end` 在 custom 未含 UNTIL 时追加），`exdates` 与 `repeat_end` 始终叠加生效。校验：必须以 `FREQ=DAILY/WEEKLY/MONTHLY/YEARLY` 开头（拒绝 SECONDLY/MINUTELY/HOURLY），最大长度 500，不含换行/控制字符，全大写规范化，须通过 ical.js 解析；校验失败返回 400。`repeat_type` ∈ {none, fragment} 时强制清空（静默，不报错） |
| `fragment_anchor` | 始终空 | — |
| `is_series` | `true` | 后端派生 |
| `parent_id` | CREATE 时 = 自身 `id`；UPDATE/DELETE 时若缺省则从 DB 派生 | 系列 anchor |

**模板**：CREATE 时同步在 `todo_templates` 表插入一条记录，包含 `anchor_date` / `exdates` / `repeat_interval` 等字段，供后续展开。

**RRULE 展开**

- `GET /api/v1/todos?date=YYYY-MM-DD`（`expand=true` 默认）：服务端用 ical.js 计算当天是否应有实例，若无则自动创建并持久化。
- `expand=false`：跳过服务端展开，响应附带 `templates` 数组（`todo_templates` 表 `SELECT *` 原始行，含 `parent_id` / `text` / `time` / `priority` / `desc` / `url` / `copy_text` / `subtasks`（已 parse 数组）/ `search_terms`（字符串）/ `repeat_type` / `repeat_custom` / `repeat_end` / `end_time` / `anchor_date` / `exdates`（字符串）/ `category_id` / `repeat_interval` / `time_records`（字符串，模板级历史记录）），调用方自行用 ical.js/rrule.js 计算。详见 [2.3 节](#23-todo-api)。

**完成与取消完成**

| 操作 | 行为 |
|------|------|
| `done: false → true` | 仅影响当天实例：`done=1`；`record` 写入实例级 `time_records`（FIFO 5）；真实耗时（`s<e`）额外写入模板级 `time_records`（FIFO 10，供 `predictDuration` 中位数预估）；`date` 不变 |
| `done: true → false` | `done=0`，清空实例级 `time_records`；`date` 不变；模板级 `time_records` 保留 |

**`scope` 参数（PUT/DELETE 重复 todo 时）**

| scope | 行为 |
|-------|------|
| `this`（默认） | 仅此实例；向模板添加 exdate；若将 `repeat_type` 改为 `none` 则脱离系列（`parent_id` 设为自身 `id`） |
| `thisAndFuture` | 此实例及未来实例；同时更新模板 |
| `all` | 全系列；同时更新模板和所有已有实例；缺 `parent_id` 时后端从 DB 派生 |

**可见性**：与普通 todo 一致，按 `date` 精确 / 范围匹配；当天未展开的重复实例若用 `expand=true` 会被服务端临时创建并返回。

### 5.4 碎时记（`repeat_type: "fragment"`）

无固定周期、可累积计时的特殊任务，与有 RRULE 周期的重复任务在数据模型与生命周期上都有显著差异。

**数据模型约束**

| 字段 | 取值 | 说明 |
|------|------|------|
| `repeat_type` | `"fragment"` | 标识为碎时记 |
| `date` | 可空 / `YYYY-MM-DD` | 未完成态：起始日期或空（不限起始）；完成态：被冻结为完成日期 |
| `time` | `""` | 强制清空 |
| `end_time` | `""` | 强制清空 |
| `repeat_end` | `""` | 强制清空 |
| `repeat_interval` | `1` | 强制为 1 |
| `repeat_custom` | `""` | 强制清空（碎时记无 RRULE） |
| `fragment_anchor` | `YYYY-MM-DD` 或 `""` | **起始日期权威副本**，不受完成/取消完成影响 |
| `is_series` | `false` | 碎时记不算重复系列 |
| `parent_id` | 自身 `id` | 不挂载到任何模板 |
| `time_records` | 数组 | 实例级完成记录，**不截断**（保留全部 session 用于累计统计） |

POST 时碎时记允许 `date` 为空；`time` / `end_time` / `repeat_end` 即便传入也会被强制清空，`repeat_interval` 被强制为 1。

**模板**：**不创建 `todo_templates` 记录**。`date`、`fragment_anchor`、`time_records` 都直接挂在 `todos` 行上。

**完成与取消完成**

| 操作 | 行为 |
|------|------|
| `done: false → true` | 写入实例级 `time_records`；同步把 `date` 冻结为完成日期（`body.date` 或现有 `date`，不能是未来日期，否则纠正为今天）；`fragment_anchor` 不变 |
| `done: true → false` | 清空实例级 `time_records`；`date` 从 `fragment_anchor` 恢复（保留用户设置的起始日期）；`fragment_anchor` 不变 |

碎时记 `time_records` 截断规则：**不截断**（与普通 todo FIFO 5 不同）。模板级 `time_records` 不写（碎时记无模板）。

V0 Web API 还支持 `keep_records: true`（来自「继续计时」路径，仅碎时记）——保留累计记录不清空。V1 toggle 接口无此参数。

**切换 `repeat_type` 进入 / 退出 `fragment`**

| 切换方向 | 行为 |
|----------|------|
| `none`/`daily`/... → `fragment` | 脱离旧系列（旧模板加 exdate），强制清空 `time`/`end_time`/`repeat_end`，`repeat_interval=1`，`fragment_anchor` 同步为 `date`（未完成时）或保留原值（已完成时）；不创建新模板 |
| `fragment` → `none`/`daily`/... | 视为「单次 → 重复」路径：若新值是 `daily`/`weekly`/`monthly`/`yearly` 则创建模板；`fragment_anchor` 同步清空 |

**可见性规则（GET /api/v1/todos 查询）**

碎时记的可见性与普通 / 重复 todo 不同，查询时按以下规则匹配：

| 查询模式 | 碎时记可见条件 |
|----------|----------------|
| `date=YYYY-MM-DD` | 已完成且 `date = ?`，或未完成且（`date = ''` 或 `date <= ?`） |
| `start_date` + `end_date` | 已完成且 `date` 在范围内，或未完成且（`date = ''` 或 `date <= end_date`） |
| 仅 `start_date` | 已完成且 `date >= ?`，或未完成且（`date = ''` 或 `date >= ?`） |
| 仅 `end_date` | 已完成且 `date <= ?`，或未完成且（`date = ''` 或 `date <= ?`） |

> 设计意图：未完成的碎时记只要起始日期不晚于查询上界就应可见（仍在进行中）；已完成碎时记按完成日期匹配。普通 / 重复 todo 的可见性则严格按 `date` 精确或范围匹配，无此宽松规则。

### 5.5 字段一致性参考

三种类型在以下字段上行为完全一致（无差异，无需区分类型处理）：

| 字段 | 一致行为 |
|------|----------|
| `id` | `Date.now() + 4 位随机数` 拼成的纯数字字符串 |
| `text` | 必填，字符串 |
| `priority` | `low`/`med`/`high`，`medium` 自动转 `med` |
| `desc` / `url` / `copy_text` | 可选字符串 |
| `subtasks` / `search_terms` | 数组，元素可为字符串或 `{text, done}` 对象；纯字符串自动转为 `{text: "xxx", done: false}` |
| `category_id` | 可选，关联 [4.3 节](#43-category-对象)的 Category id；空表示未分类 |
| `recurrence_id` | RFC 5545 RECURRENCE-ID，重复 todo 例外实例使用，其余类型为空 |
| `is_exception` | 是否为例外实例（重复 todo 脱离系列后为 `true`，其余为 `false`） |
| `repeat_custom` | 自定义 RRULE 字符串（不含 `RRULE:` 前缀，全大写规范化）。V0 (CREATE/UPDATE) 与 V1 (POST/PUT) 入口均接受请求体中的 `repeat_custom` 字段并写入 DB 与 `todo_templates` 模板。`recurring-engine.js buildRRuleString()` 在 `repeat_custom` 非空时优先使用，覆盖 `repeat_type`/`repeat_interval` 的 RRULE 构建逻辑（`repeat_interval` 参数仍会覆盖 custom 中的 INTERVAL，`repeat_end` 在 custom 未含 UNTIL 时追加），`exdates` 与 `repeat_end` 始终生效。校验规则：必须以 `FREQ=DAILY/WEEKLY/MONTHLY/YEARLY` 开头，最大长度 500，不含换行/控制字符，须通过 ical.js 解析；校验失败返回 400。`repeat_type` ∈ {none, fragment} 时强制清空（静默）。`expand=false` 返回的 `templates` 中 `repeat_custom` 现可能为非空字符串，调用方需自行解析并按优先级应用 |
| `done` / `deleted` | V1 均为布尔；V0 `/api/todos` 中 `done` 为布尔、`deleted` 为整数 0/1；V0 `/api/trash` 均为整数 0/1 |
| `last_completed_at` / `last_duration_ms` / `is_zero_duration` | 计算字段，取 `time_records` 末尾一条计算；无记录时分别为 `null` / `null` / `false` |
| `time_records` 原始字段 | V1 已解析为数组；V0 `/api/todos` 与 `/api/trash` 均为未解析 JSON 字符串 |

**下列字段三种类型行为不一致，详见 [5.1 三种类型概览](#51-三种类型概览) / [5.2 普通 todo](#52-普通-todorepeat_type-none) / [5.3 重复 todo](#53-重复-todorepeat_type-dailyweeklymonthlyyearly) / [5.4 碎时记](#54-碎时记repeat_type-fragment)**：

| 字段 | 不一致要点 |
|------|-----------|
| `repeat_type` | 三种类型的判定依据：`none` / `daily`/`weekly`/`monthly`/`yearly` / `fragment` |
| `date` | 普通/重复 todo 必填 `YYYY-MM-DD`；碎时记可空（未完成=起始或空，完成=冻结为完成日期） |
| `time` / `end_time` | 普通/重复 todo 可设置；碎时记强制空 |
| `repeat_end` | 普通 todo 与碎时记强制空；重复 todo 可设置（YYYY-MM-DD，空表示无限） |
| `repeat_interval` | 普通 todo 与碎时记始终 `1`；重复 todo 用户指定（正整数） |
| `repeat_custom` | 普通 todo 与碎时记强制空；重复 todo 可设置（自定义 RRULE，校验规则见 [5.3 节](#53-重复-todorepeat_type-dailyweeklymonthlyyearly)） |
| `is_series` | 后端派生：`repeat_type !== 'none' && !== 'fragment'`；普通/碎时记 `false`，重复 todo `true` |
| `parent_id` | 普通 todo 与碎时记 = 自身 `id`；重复 todo = 系列 anchor `id`（CREATE 时与自身一致，后续实例沿用，UPDATE/DELETE 时若缺省则从 DB 派生） |
| `fragment_anchor` | 普通 todo 与重复 todo 始终空；碎时记 = `YYYY-MM-DD` 或空（起始日期权威副本，不受完成/取消完成影响） |
| `time_records` 截断规则 | 普通/重复 todo 实例级 FIFO 5；碎时记**不截断**（保留全部 session 用于累计）。模板级仅重复 todo 写（真实耗时，FIFO 10） |

**字段回退**（PUT /api/v1/todos/:id 或 V0 UPDATE）：三种类型均适用——未传的字段（`text` / `time` / `priority` / `desc` / `url` / `copy_text` 等）会从 DB 当前值回退，不会被静默清空。

---

## 6. 示例代码

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

## 7. 注意事项

1. API Key 格式为 `cfk_` 前缀 + 32 字节随机编码
2. 完整密钥仅在创建时返回一次，请妥善保存
3. 最多创建 10 个 API Key
4. 禁用的密钥无法通过验证
5. 每次成功调用会异步更新密钥的最后使用时间（5分钟限频）
6. **重复任务 `scope` 默认值**：重复任务（`daily`/`weekly`/`monthly`/`yearly`）未指定 `scope` 时，V0 和 V1 均默认 `scope=this`，仅操作当前实例——软删除当前实例 + 向模板添加 exdate 防止下次 `GET /api/todos?date=X` 时模板重新展开生成新实例（避免「复活」）。非重复任务（`none`/`fragment`）不受 `scope` 影响，直接软删除。
7. **`priority` 规范化**：`priority` 接受 `low`、`med`、`high`，`medium` 会自动转为 `med`，其它非法值回退为 `low`。V0 和 V1 均在所有写入点（CREATE / UPDATE / 模板展开）统一走 `normalizePriority` 函数（`src/utils.js`），保证 DB 不会出现 `medium` 等非标准值，stats 聚合（`priCounts` 仅识别 `low/med/high`）不会漏统计。
8. **批量接口**（`BATCH_TOGGLE_DONE` / `BATCH_DELETE` / `BATCH_RESTORE` / `BATCH_DELETE_PERMANENT` / category `BATCH_DELETE`）按 99 一组自动分片。响应含 `chunked`（是否分片）和 `chunkCount`（分片数）字段。`affected`/`restored`/`deleted` 为实际改动行数（非 `ids.length`）
9. `GET /api/v1/todos?date=X` 支持 `expand=false` 参数，跳过服务端重复任务展开，响应附带 `templates` 数组（`todo_templates` 表 `SELECT *` 原始行，`subtasks`/`exdates` 已归一化，`search_terms`/`time_records` 保留字符串形式）供调用方自算。`templates` 只含 `daily`/`weekly`/`monthly`/`yearly` 模板，碎时记（`fragment`）无模板直接出现在 `data` 里
10. 后端代码适配 D1 读副本会话 API（`env.DB.withSession('first-primary')`）。**默认关闭**（`wrangler.toml` 中 `read_replication = false`），需手动启用 wrangler 配置并在 Cloudflare 控制台开启读副本后才生效。详见 [D1 Read Replication](https://developers.cloudflare.com/d1/best-practices/read-replication)
11. **字段命名规则**：
    - **Todo / Category 对象**：统一 snake_case（如 `copy_text`、`repeat_type`、`category_id`、`parent_id`、`is_series`、`time_records`、`last_completed_at`、`is_zero_duration`、`fragment_anchor`）。
    - **API Key 管理端点**（`GET/POST /api/v1/keys`）：camelCase，字段为 `keyPrefix` / `createdAt` / `lastUsedAt` / `disabled`。
    - **设置端点**（`GET/POST /api/v1/settings` 与 V0 `/api/settings`）：camelCase，常见字段 `provider` / `sortMethod` / `sortAsc` / `customCodeEnabled` / `apiKeyScope` / `scaleByBrowser` / `fontSizeByBrowser` / `displayScaleByBrowser`。
    - **自定义代码端点**（`GET/POST /api/v1/custom-code` 与 V0 `/api/custom-code`）：camelCase，字段 `customHeader` / `customContent`。
    - **统计端点**（`GET /api/v1/stats` 与 V0 `/api/stats`）：camelCase，字段 `total` / `done` / `undone` / `activeDays` / `byDate` / `byCategory` / `noCategoryCount` / `byPriority` / `byPriorityDone` / `byWeekday` / `byWeekdayDone` / `byHourBucket`；V0 额外字段 `aggregated` / `range` / `summary` / `dailyCounts` / `categoryCounts` / `priCounts` / `priDone` / `weekdayCounts` / `weekdayDone`。
    - **批量端点响应**（`POST /api/v1/todos/batch`、`POST /api/v1/categories/batch`、`POST /api/v1/trash-action` 的 BATCH_*）：camelCase，字段 `chunked` / `chunkCount`。
    - **会话端点**（`GET /api/sessions`）：camelCase，字段 `ua` / `disabled` / `isCurrent`。
    - 历史背景：V3.0 重构时仅对 Todo/Category 做了 snake_case 化（移除 camelCase 兼容层），其它端点保留原始 camelCase 字段名。客户端集成时需按端点区分命名风格。
12. V0 `UPDATE` / `DELETE` 缺 `task.parent_id` 时后端自动从 DB 派生
13. V0 `UPDATE` 未传的字段（`copy_text` / `text` / `time` 等）从 DB 当前值回退，不会被清空
14. Todo 按 `repeat_type` 分为普通 todo（`none`）、重复 todo（`daily/weekly/monthly/yearly`）、碎时记（`fragment`）三种类型，三者的数据模型、模板、完成/取消完成、可见性、字段一致性对比详见 [5. Todo 类型专章](#5-todo-类型专章)。
