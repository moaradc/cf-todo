# V0 / V1 API 健壮性验证测试报告

- **测试日期**: 2026-06-27
- **测试目标**: `https://test.945426.xyz`（部署版本 `v2.7.8.2`）
- **测试分支**: `fix/robustness-validation` (`daefce0`)
- **测试脚本**: `/home/z/my-project/scripts/test_runner.js`
- **测试用例数**: 134
- **通过**: 132（98.5%）
- **失败**: 2（均为 V0 API 健壮性缺陷，需在分支中修复）
- **测试用时**: 约 4 分钟（每请求平均 RTT ~1s，含服务端 D1 读写）

---

## 1. 测试范围

按用户要求覆盖以下三类待办事项 × V0/V1 两套 API：

| 待办类型 | `repeat_type` | 关键特性 |
|----------|---------------|----------|
| 单次任务 | `none` | 仅一个实例，无模板 |
| 重复任务 | `daily`（含 `repeat_interval=1/2`） | 创建模板，按 `ical.js` 展开生成实例；支持 `scope=this/thisAndFuture/all` |
| 碎时记 | `fragment` | 无模板；`date` 可为空（浮动）；完成时冻结 `date`；不 FIFO 截断 `time_records` |

每类待办验证以下能力：

1. **不同日期生成**：重复任务在 `GET /api/v1/todos?date=X` 时自动展开并持久化实例
2. **编辑更新**：属性（`text`/`priority`/`desc`/`time`/`subtasks`/`search_terms`）、重复间隔、`search_terms`、`time`
3. **删除恢复**：软删除 → 回收站 → `RESTORE` → 重新可见；`DELETE_PERMANENT`
4. **完成 / 取消完成**：零耗时 record（`s===e`）、真实耗时 record（`s<e`）、取消完成清空实例级 `time_records`
5. **计时功能**：`TIMER_RECORD`（仅碎时记）、`TIMER_COMPLETE`（实例级 + 模板级双写、FIFO 截断规则）

另外补充了 14 个 **健壮性探针**（边界 / 错误输入），覆盖 `fix/robustness-validation` 分支主题。

---

## 2. 通过分组汇总

| 分组 | 用例数 | 通过 | 备注 |
|------|--------|------|------|
| V1 single | 18 | 18 | 单次任务完整 CRUD + 计时 |
| V1 recurring | 18 | 18 | 重复任务展开 + `scope` 三模式 + 间隔变更 |
| V1 fragment | 24 | 24 | 浮动 / 锚定碎时记 + `TIMER_RECORD` 不截断 |
| V0 single | 17 | 17 | 单次任务 V0 路径（注意 `date` 须在 body 顶层） |
| V0 recurring | 17 | 17 | 重复任务 V0 路径（注意 `parent_id` 须传） |
| V0 fragment | 26 | 26 | 碎时记 V0 路径 |
| Robustness | 14 | 12 | 2 个真实健壮性缺陷（详见 §4） |

---

## 3. 关键功能验证结论

### 3.1 单次任务（repeat_type=none）

V0 与 V1 都能完整支持单次任务的创建、属性编辑、零/真实耗时计时、软删除、回收站恢复、永久删除。V1 还在响应中提供 `last_duration_ms`、`is_zero_duration`、`last_completed_at` 计算字段，客户端无需自行解析 epoch ms。**取消完成**会清空实例级 `time_records`，与 API_Wiki §2.3 描述一致。

### 3.2 重复任务（daily, interval=1 → 2）

- **展开机制**：`GET /api/v1/todos?date=X` 在模板覆盖该日期时自动创建实例并持久化，多次调用幂等。`date+5`/`date+6` 在 `interval=2` 下分别不生成 / 生成，符合预期。
- **`scope=this`**：仅修改当前实例，向模板添加 `exdate`，未来实例文本不变（V0/V1 均验证通过）。
- **`scope=thisAndFuture`**：触发系列分裂。原系列 `repeat_end` 截断到当前日期前一天；新系列使用新 `parent_id`，后续展开均使用新 `parent_id`。V1 验证 `date+6` 实例使用新 `parent_id`；V0 验证 `date+8` 不再展开。
- **`scope=all`**：更新模板与所有实例。变更 `repeat_interval` 时删除其他实例由模板重新生成（避免脏数据），仅修改非重复属性时原地 UPDATE 其他实例。
- **修改 `time`**：`scope=all` 后续展开实例的 `time` 字段同步更新。
- **修改 `search_terms`**：`scope=all` 后模板的 `search_terms` 同步更新；展开新实例时会触发热搜刷新（在测试中观察到自动替换为微博热搜词）。

### 3.3 碎时记（repeat_type=fragment）

碎时记行为对齐 API_Wiki §4.1 描述，无偏差：

- **浮动碎时记（`date=''`）**：在任意日期 `GET /api/v1/todos?date=X` 都可见。
- **锚定碎时记（`date=Y`）**：仅在 `date >= Y` 时可见，`date < Y` 时不可见。
- **完成时冻结日期**：
  - V1 `PATCH /api/v1/todos/:id/toggle` 必须传 `body.date` 才会冻结到指定日期；不传则回退到 `existing.date`（浮动碎时记此时为 `''`，不冻结）。
  - V0 `POST /api/todo-action { action: 'TOGGLE_DONE', date: <body.date>, task: { id, done: true } }` 通过 `date` 字段冻结。
  - 未来日期会被服务端 clamp 到今天（V1 验证：传 `body.date=+30d` 后 `date` 字段被 clamp 为今天）。
- **取消完成恢复**：`done: true → false` 时 `date` 从 `fragment_anchor` 恢复（浮动碎时记恢复为 `''`，锚定碎时记恢复为锚定日期），同时清空实例级 `time_records`。
- **`TIMER_RECORD`**：仅碎时记支持。普通 todo 收到该 action 直接 no-op，返回 `downgraded: true`（V0 验证通过）。
- **不 FIFO 截断**：连续 7 次 `TIMER_RECORD` 后实例级 `time_records` 长度 ≥ 7，验证碎时记保留全部 session 用于累计统计。普通 todo 实例级 FIFO 5（5 次后丢弃最旧）。
- **`TIMER_COMPLETE`**：标记 `done=1`，追加 session，冻结 `date` 到 `body.date`。碎时记不写模板级（无模板）。
- **软删除 / 恢复**：碎时记无模板，恢复路径直接将 `deleted=0`，不涉及 `exdate` 处理。

### 3.4 计时字段计算

V1 响应中的计算字段在所有计时场景下均正确：

- `last_completed_at` = 最新 record 的 `e`（epoch ms）
- `last_duration_ms` = `e - s - p`
- `is_zero_duration` = `s === e`
- `time_records` 末尾为最新一次完成记录

### 3.5 V0 vs V1 行为差异

| 维度 | V0 (`/api/todo-action`) | V1 (`/api/v1/todos`) |
|------|--------------------------|----------------------|
| 创建 id | 客户端生成（`task.id` 必填） | 服务端生成 |
| 响应 body | `{success: true}` 无 task 对象 | 返回完整 task 对象 |
| `date` 字段位置 | body 顶层（与 `task` 同级） | `task.date` 内 |
| `time_records` 格式 | JSON 字符串（需 `JSON.parse`） | 已解析数组 |
| `isSeries` | 计算字段 | 计算字段 |
| `done` / `deleted` / `is_exception` | `/api/todos` 返回布尔；`/api/trash` 返回整数 0/1 | 布尔 |
| 鉴权 | Cookie 或 API Key | API Key 或 Cookie |

---

## 4. 发现的健壮性缺陷（须在分支中修复）

以下 2 个问题是本次测试的核心发现，正是 `fix/robustness-validation` 分支应当修复的目标。

### 4.1 [P0] V0 CREATE 在缺少顶层 `date` 字段时返回 500 D1_TYPE_ERROR

**复现命令**：

```bash
curl -X POST -H "X-API-Key: cfk_..." -H "Content-Type: application/json" \
  -d '{"action":"CREATE","task":{"id":"<uuid>","date":"2026-06-27","text":"smoke","repeat_type":"none"}}' \
  "https://test.945426.xyz/api/todo-action"
```

**响应**：`HTTP 500` `{"error":"D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'"}`

**根因**（`src/api.js:2992`）：

```js
const effectiveDate = isFragment ? (date || '') : date;
// 非碎时记分支直接用 date（顶层），若调用方只在 task.date 里传日期，
// date 为 undefined，bind 时 D1 拒收 → 抛 TYPE_ERROR
```

**影响**：
- 调用方按 V1 风格把 `date` 放进 `task` 对象时直接 500
- 错误信息暴露 D1 内部错误细节，无指引性
- 与 API_Wiki §3.2 文档存在隐式契约（`date` 须在顶层），但缺少运行时校验

**建议修复**：

```js
// 方案 A：显式校验，返回 400
if (!isFragment && !date) {
  return apiError('非碎时记 CREATE 必须传顶层 date 字段', 400);
}
// 方案 B：从 task.date 回退
const effectiveDate = isFragment ? (date || '') : (date || task.date || '');
if (!isFragment && !effectiveDate) {
  return apiError('date 为必填项（碎时记允许为空）', 400);
}
```

推荐方案 B（与 V1 行为对齐，V1 直接读 `body.date`），同时增加 400 校验兜底。

**测试用例 #121**：`Robustness :: V0 CREATE without top-level date — graceful 400 (not 500)` → FAIL

---

### 4.2 [P0] V0 UPDATE scope=all 在缺少 `task.parent_id` 时返回 500 D1_TYPE_ERROR

**复现命令**：

```bash
# 1. 创建一个重复任务（id == parent_id）
curl -X POST -H "X-API-Key: cfk_..." -H "Content-Type: application/json" \
  -d '{"action":"CREATE","date":"2026-06-27","task":{"id":"<uuid>","date":"2026-06-27","text":"daily","repeat_type":"daily","repeat_interval":1}}' \
  "https://test.945426.xyz/api/todo-action"

# 2. UPDATE 不带 parent_id
curl -X POST -H "X-API-Key: cfk_..." -H "Content-Type: application/json" \
  -d '{"action":"UPDATE","date":"2026-06-27","task":{"id":"<uuid>","text":"daily","repeat_type":"daily","repeat_interval":2},"scope":"all"}' \
  "https://test.945426.xyz/api/todo-action"
```

**响应**：`HTTP 500` `{"error":"D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'"}`

**根因**（`src/api.js:3038` + `src/api.js:3234`）：

```js
const parentId = task.parentId || task.parent_id;  // ← 调用方未传 → undefined
// ...
} else if (effectiveScope === 'all') {
  if (rptType !== 'none') {
    // 当 recurrenceChanged=true 时走这条 DELETE
    await env.DB.prepare(
      'DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0'
    ).bind(parentId, task.id).run();  // ← parentId=undefined → D1_TYPE_ERROR
  }
}
```

**影响**：
- 前端 `confirmAction('save', { scope: 'all' })` 路径会传 `parent_id`，但任何外部 API 调用方若按 V1 风格省略 `parent_id` 都会触发 500
- 同样的 bind 问题也影响 `scope=all` 下的 `UPDATE todos SET ... WHERE parent_id=?` 路径（line 3240）和模板 `INSERT OR REPLACE` 路径（line 3287）
- 错误信息暴露 D1 内部细节

**建议修复**：

```js
// 在 UPDATE 入口处从 DB 派生 parent_id（如果调用方未传）
let parentId = task.parentId || task.parent_id;
if (!parentId) {
  try {
    const row = await env.DB.prepare('SELECT parent_id FROM todos WHERE id = ?').bind(task.id).first();
    if (row) parentId = row.parent_id;
  } catch (e) {}
}
if (!parentId) {
  return apiError('无法确定任务的 parent_id（任务不存在或未传 parent_id）', 400);
}
```

**测试用例 #126**：`Robustness :: V0 UPDATE scope=all without parent_id — graceful (400 or 200, NOT 500)` → FAIL

---

## 5. 次要观察（非阻塞）

### 5.1 V0 `task.copyText` vs `task.copy_text` 命名不一致

API_Wiki §4.2 说明 V0 输入字段使用 snake_case（`copy_text`），但 `src/api.js` 多处读取 `task.copyText`（camelCase），导致 V0 路径下 `copy_text` 永远读不到。当前由 `|| ''` 兜底，不会报错，但实际效果是 `copy_text` 字段在 V0 路径下被静默丢失。

**建议**：统一为 `task.copy_text`（与 wiki 一致），或同时读两个 key（`task.copyText || task.copy_text || ''`）。

### 5.2 V1 `GET /api/v1/todos/:id` 返回软删除实例（带 `deleted: true`）

非 404。这是合理设计（让客户端能查看回收站条目详情），但 API_Wiki §2.3 未明确说明。建议在 wiki 中补充："GET /api/v1/todos/:id 返回包括已软删除的实例（`deleted: true`）；如需排除请用 `GET /api/v1/trash`。"

### 5.3 V1 PATCH toggle 必须传 `body.date` 才会冻结碎时记日期

API_Wiki §2.3 已提到 "碎时记：冻结 date 为完成日期（body.date 或现有 date）"，但建议在描述中更明确："**调用方必须传 `body.date` 才会冻结**；不传则保留 `existing.date`（浮动碎时记为 `''`）。"

### 5.4 V0 `todo-action` 响应不含 task 对象

V0 所有 action 均返回 `{success: true}`，调用方若需最新数据须额外发 `GET /api/todos?date=X`。V1 在响应中直接返回完整 task 对象，性能更优。建议在 API_Wiki §3.2 中明确标注此差异。

### 5.5 热搜词自动刷新工作正常

V0 `/api/todos?date=X` 展开重复任务时，若模板含 `search_terms`，会自动调用 `fetchHotSearchData('auto')` 获取最新热搜词替换。测试中观察到 `search_terms` 被替换为微博热搜词（如"百花奖启动初评投票"、"克宫要求苹果公司解释"等），功能符合 §3.2 描述。

---

## 6. 测试方法学

### 6.1 测试工具

- Node.js 18+ 原生 `fetch` API
- 测试脚本：`/home/z/my-project/scripts/test_runner.js`（约 580 行）
- 单文件无依赖，直接 `node scripts/test_runner.js` 即可运行
- 输出：stdout 实时日志 + `/home/z/my-project/scripts/test_results.json` 结构化结果

### 6.2 测试隔离

- 每个用例使用 `uuid()` 生成独立 ID，互不影响
- 测试开始前 `CLEAR_ALL` 清空回收站
- 每组测试结束后软删除 + `CLEAR_ALL` 清理产生的数据
- 测试期间产生的 todo 均带前缀（如 `V1 single`、`V0 daily`），便于人工排查

### 6.3 通过判定

每个用例使用断言函数 `record(group, name, pass, actual, extra)`：

- `pass` 为布尔表达式（HTTP 状态码 + 响应体字段值）
- 失败时打印响应 body 前 400 字符便于诊断
- 所有结果写入 JSON 文件供后续分析

### 6.4 测试覆盖维度

每个待办类型至少覆盖：
1. 创建 → 读取校验
2. 编辑属性 → 读取校验
3. 完成切换（零耗时 + 真实耗时）
4. 软删除 → 回收站校验 → 恢复 → 重新可见校验
5. 永久删除
6. 重复任务额外：日期展开、`scope=this/thisAndFuture/all`、间隔变更
7. 碎时记额外：浮动 / 锚定可见性、`TIMER_RECORD` 累计、不 FIFO 截断

完整用例清单见 [_v0-v1-api-robustness-results.md](./_v0-v1-api-robustness-results.md)。

---

## 7. 修复优先级建议

| 优先级 | 问题 | 影响 | 修复难度 |
|--------|------|------|----------|
| P0 | §4.1 V0 CREATE 缺 `date` → 500 | API 不可用，错误信息泄露 | 1 行（增加校验 + 回退） |
| P0 | §4.2 V0 UPDATE 缺 `parent_id` → 500 | API 不可用，错误信息泄露 | 5 行（DB 查询回退） |
| P2 | §5.1 V0 `copyText` vs `copy_text` 命名 | 功能静默失效 | 4 行（增加 snake_case 读取） |
| P3 | §5.2 / §5.3 / §5.4 文档完善 | 调用方易踩坑 | 文档更新 |

---

## 8. 复测指引

修复 §4.1 和 §4.2 后，重跑测试应得到 134/134 全通过：

```bash
cd /home/z/my-project
node scripts/test_runner.js
# 期望: Total: 134  Pass: 134  Fail: 0
```

测试脚本已持久化在 `/home/z/my-project/scripts/test_runner.js`，可作为 CI 回归用例。

完整用例结果表见同目录下 [_v0-v1-api-robustness-results.md](./_v0-v1-api-robustness-results.md)。
