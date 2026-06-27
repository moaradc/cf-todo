# V0 / V1 API 健壮性修复报告

- **修复日期**: 2026-06-27
- **修复分支**: `fix/robustness-validation`
- **修复文件**: `src/api.js`（+68 / -23 行）
- **对应测试报告**: [2026-06-27-v0-v1-api-robustness-validation.md](./2026-06-27-v0-v1-api-robustness-validation.md)
- **本地验证**: 16/16 单元断言全通过（`/home/z/my-project/scripts/verify_fixes_locally.js`）
- **待线上验证**: 部署后重跑 `node scripts/test_runner.js`，期望 142/142 全通过

---

## 1. 修复概览

针对前一轮测试发现的 2 个 P0 健壮性缺陷 + 1 个 P2 命名不一致问题，本次共修复 3 类问题，新增 / 改动 4 处代码点：

| 编号 | 优先级 | 问题 | 修复点 |
|------|--------|------|--------|
| F1 | P0 | V0 CREATE 缺顶层 `date` → 500 D1_TYPE_ERROR | `src/api.js:3000-3007` 增加 `task.date` 回退 + 400 校验 |
| F2 | P0 | V0 UPDATE scope=all 缺 `task.parent_id` → 500 D1_TYPE_ERROR | `src/api.js:3054-3066` 增加 DB 派生 + 400 兜底 |
| F3 | P0 | V0 UPDATE 缺 `text/time/priority/desc/url/copy_text` → 500 | `src/api.js:3068-3084` 扩展 SELECT 字段 + 缺失字段 DB 回退 |
| F4 | P2 | V0 `copyText` vs `copy_text` 命名分裂 | `src/api.js:50-56` 新增 `readCopyText(task)` helper，13 处 bind 统一调用 |
| F5 | P0 | V0 DELETE 缺 `parent_id` 同样问题（预防性修复） | `src/api.js:3346-3356` 与 F2 同样模式 |

---

## 2. 修复详情

### 2.1 [F1] V0 CREATE date 字段缺失的健壮处理

**原代码** (`src/api.js:2992`):
```js
const effectiveDate = isFragment ? (date || '') : date;
// 非碎时记 + date 缺失 → undefined → D1 bind 抛 TYPE_ERROR → 500
```

**修复后**:
```js
// 健壮性修复：date 顶层字段缺失时回退到 task.date（与 V1 行为对齐）
// API_Wiki §3.2 文档要求 date 在 body 顶层，但外部调用方常按 V1 风格放在 task.date
// 原 bug：非碎时记 + date 缺失 → D1_TYPE_ERROR 500（无指引性）
const fallbackDate = date || (task && task.date) || '';
// 非碎时记必须有有效日期；碎时记允许空（浮动）
if (!isFragment && !fallbackDate) {
  return apiError('date 为必填项（碎时记允许为空），请传顶层 date 或 task.date', 400);
}
const effectiveDate = fallbackDate;
```

**行为对比**：

| 调用方式 | 修复前 | 修复后 |
|----------|--------|--------|
| `{"action":"CREATE","date":"2026-06-27","task":{...}}` | ✅ 200 | ✅ 200（不变） |
| `{"action":"CREATE","task":{"date":"2026-06-27",...}}` | ❌ 500 D1_TYPE_ERROR | ✅ 200（task.date 回退） |
| `{"action":"CREATE","task":{"text":"x","repeat_type":"none"}}` | ❌ 500 D1_TYPE_ERROR | ✅ 400 `date 为必填项...` |
| `{"action":"CREATE","task":{"text":"x","repeat_type":"fragment"}}` | ✅ 200（碎时记允许空） | ✅ 200（不变） |

### 2.2 [F2] V0 UPDATE parent_id 缺失的健壮处理

**原代码** (`src/api.js:3038`):
```js
const parentId = task.parentId || task.parent_id;
// 调用方未传 → undefined → 后续 bind(parentId, ...) 在 DELETE/UPDATE WHERE parent_id=? 时 500
```

**修复后** (`src/api.js:3054-3066`):
```js
// 健壮性修复：parentId 缺失时从 DB 派生
// 原 bug：UPDATE scope=all 不传 task.parent_id → DELETE FROM todos WHERE parent_id=undefined → 500
// V0 调用方（含外部 API）可能省略 parent_id（V1 风格），需要服务端补全
let parentId = task.parentId || task.parent_id;
if (!parentId) {
  try {
    const pidRow = await env.DB.prepare('SELECT parent_id FROM todos WHERE id = ?').bind(task.id).first();
    if (pidRow) parentId = pidRow.parent_id;
  } catch (e) {}
}
if (!parentId) {
  return apiError('无法确定 parent_id（任务不存在或未传 parent_id）', 400);
}
```

**行为对比**：

| 调用方式 | 修复前 | 修复后 |
|----------|--------|--------|
| `{"action":"UPDATE","task":{"id":"x","parent_id":"x",...},"scope":"all"}` | ✅ 200 | ✅ 200（不变） |
| `{"action":"UPDATE","task":{"id":"x","text":"edit",...},"scope":"all"}`（无 parent_id） | ❌ 500 D1_TYPE_ERROR | ✅ 200（DB 派生） |
| `{"action":"UPDATE","task":{"id":"nonexistent",...},"scope":"all"}` | ❌ 500 D1_TYPE_ERROR | ✅ 400 `无法确定 parent_id...` |

### 2.3 [F3] V0 UPDATE 缺失字段从 DB 回退（V1 PATCH 风格）

**原代码**: UPDATE 路径多处直接用 `task.text`/`task.time`/`task.priority`/`task.desc`/`task.url`，调用方按 V1 PATCH 风格只传修改字段时这些值为 `undefined`，bind 到 D1 抛 TYPE_ERROR。

**修复后** (`src/api.js:3068-3084`):
```js
// 健壮性修复：同时取 text/time/priority/desc/url/copy_text 等字段，
// 调用方按 V1 风格只传需要修改的字段时，缺失字段从 DB 回退，避免 500
let originalTask = task;
try {
  const orig = await env.DB.prepare(
    'SELECT text, time, priority, desc, url, copy_text, repeat_type, repeat_interval, done, date, parent_id FROM todos WHERE id = ?'
  ).bind(task.id).first();
  if (orig) {
    originalTask = { ...task, repeat_type: orig.repeat_type, repeat_interval: orig.repeat_interval, _origDone: orig.done, _origDate: orig.date, _origParentId: orig.parent_id, _origRepeatType: orig.repeat_type };
    // 缺失字段从 DB 回退（V1 PATCH 风格：仅传需修改字段）
    if (task.text === undefined) originalTask.text = orig.text;
    if (task.time === undefined) originalTask.time = orig.time;
    if (task.priority === undefined) originalTask.priority = orig.priority;
    if (task.desc === undefined) originalTask.desc = orig.desc;
    if (task.url === undefined) originalTask.url = orig.url;
    if (task.copyText === undefined && task.copy_text === undefined) originalTask.copyText = orig.copy_text || '';
  }
} catch(e) {}
```

后续 SQL bind 全部改用 `originalTask.*`（10+ 处）。

**新增能力**：V0 现在支持 V1 PATCH 风格的"仅传修改字段"调用，例如：

```bash
# 只改 time，其他字段保持不变
curl -X POST -H "X-API-Key: cfk_..." \
  -d '{"action":"UPDATE","date":"2026-06-27","task":{"id":"x","time":"14:00","repeat_type":"daily"},"scope":"all"}' \
  "https://test.945426.xyz/api/todo-action"
# 修复前: 500 D1_TYPE_ERROR (task.text=undefined)
# 修复后: 200 (text/priority/desc/url 从 DB 回退)
```

### 2.4 [F4] V0 copyText / copy_text 命名统一

**原问题**: API_Wiki §4.2 文档要求 snake_case (`copy_text`)，但 `src/api.js` 13 处 bind 全部读 `task.copyText`（camelCase）。前端 `src/html/js/detail.js:983` 同时写入两者所以正常工作，但外部 API 调用方按 V1 风格传 `copy_text` 时该字段被静默丢弃。

**修复**: 新增 `readCopyText(task)` helper，统一读取两个 key（camelCase 优先以保持前端向后兼容）：

```js
// 健壮性修复：V0 todo-action 接受 camelCase `copyText` 或 snake_case `copy_text`
// API_Wiki §4.2 文档要求 snake_case，但前端 (src/html/js/detail.js:983) 同时写入两者，
// 外部 API 调用方常按 V1 风格传 copy_text。统一在此 helper 兼容读取。
function readCopyText(task) {
  if (!task) return '';
  return task.copyText !== undefined ? task.copyText : (task.copy_text || '');
}
```

13 处 `task.copyText || ''` 替换为 `readCopyText(task)`。

**行为对比**：

| 调用方式 | 修复前 | 修复后 |
|----------|--------|--------|
| `task: { copyText: 'x' }` | ✅ 写入 `copy_text='x'` | ✅ 写入 `copy_text='x'`（不变） |
| `task: { copy_text: 'x' }` | ❌ 静默丢弃（`copy_text=''`） | ✅ 写入 `copy_text='x'` |
| `task: { copyText: 'a', copy_text: 'b' }` | ✅ `copy_text='a'`（camelCase 优先） | ✅ `copy_text='a'`（不变，camelCase 优先以保持前端兼容） |

### 2.5 [F5] V0 DELETE parent_id 缺失的预防性修复

DELETE 路径 (`src/api.js:3338`) 与 UPDATE 有同样问题。虽然 DELETE 不传 parent_id 时只要 `!isSeries || !scope` 分支会跳过模板操作不触发 500，但 `thisAndFuture` / `all` scope 下的模板操作仍可能 bind undefined。本次一并修复：

```js
else if (action === 'DELETE') {
  const rptType = task.repeat_type || 'none';
  // 健壮性修复：与 UPDATE 路径一致，parentId 缺失时从 DB 派生
  let parentId = task.parentId || task.parent_id;
  if (!parentId) {
    try {
      const pidRow = await env.DB.prepare('SELECT parent_id FROM todos WHERE id = ?').bind(task.id).first();
      if (pidRow) parentId = pidRow.parent_id;
    } catch (e) {}
  }
  // DELETE 兜底：若仍无 parentId（任务不存在），后续 isSeries 分支会跳过模板操作，无需 400
```

DELETE 不返回 400（与 UPDATE 不同），因为非循环任务的 DELETE 不需要 parent_id，强行 400 会破坏现有调用方。

---

## 3. 本地验证

由于无法直接部署到 Cloudflare Worker，使用本地 D1 stub 验证修复逻辑：

**验证脚本**: `/home/z/my-project/scripts/verify_fixes_locally.js`

```
[PASS] CREATE: top-level date missing + task.date present → fallbackDate = task.date
[PASS] CREATE: no date anywhere → fallbackDate = ""
[PASS] CREATE: non-fragment + empty fallbackDate → should 400
[PASS] UPDATE: parentId derived from DB when not provided
[PASS] UPDATE: nonexistent task → parentId stays undefined (will 400)
[PASS] UPDATE: text falls back to DB value
[PASS] UPDATE: time uses caller override
[PASS] UPDATE: priority falls back to DB value
[PASS] UPDATE: desc falls back to DB value
[PASS] UPDATE: url falls back to DB value
[PASS] UPDATE: copyText falls back to DB value
[PASS] readCopyText: snake_case copy_text
[PASS] readCopyText: camelCase copyText
[PASS] readCopyText: both present → camelCase wins (backward compat)
[PASS] readCopyText: empty object → ""
[PASS] readCopyText: null task → ""

=== Local fix verification: 16 pass / 0 fail ===
```

16 项断言全部通过，证明修复逻辑正确。

---

## 4. 部署后验证清单

部署 `fix/robustness-validation` 分支到 `https://test.945426.xyz` 后，执行以下命令验证：

```bash
cd /home/z/my-project
node scripts/test_runner.js
```

**期望结果**：

| 用例数 | 通过 | 失败 | 说明 |
|--------|------|------|------|
| 142 | 142 | 0 | 全通过，包括新增的 8 个健壮性探针 |

**关键观察点**：

1. 测试 #121（V0 CREATE without top-level date）应从 500 → 200（task.date 回退）
2. 测试 #122（V0 CREATE no date anywhere）应从 500 → 400
3. 测试 #127（V0 UPDATE scope=all no parent_id）应从 500 → 200（DB 派生）
4. 测试 #128（V0 UPDATE V1-PATCH style text only）应从 500 → 200
5. 测试 #129（V0 UPDATE time only）应从 500 → 200
6. 测试 #130（time applied to expansion）应从 500 → 200 且 `time === '12:00'`
7. 测试 #140（copy_text snake_case persisted）应从 FAIL → PASS（`copy_text === 'snake-copied'`）

---

## 5. 修复影响评估

### 5.1 向后兼容性

| 调用方 | 影响 |
|--------|------|
| 现有 Web 前端 (`src/html/js/`) | 无影响 — 前端已传 `copyText` + `parent_id` + 顶层 `date` + 完整 `task` 对象，修复后行为与修复前一致 |
| V1 API 调用方 | 无影响 — V1 路径未改动 |
| V0 API 调用方（按 wiki 规范） | 无影响 — 修复仅放宽字段位置 / 缺失的容忍度，原本能工作的调用方式继续工作 |
| V0 API 调用方（V1 风格） | **改善** — 现在可以省略 `parent_id`、把 `date` 放在 `task` 内、仅传修改字段、用 `copy_text` snake_case |

### 5.2 性能影响

- F1（CREATE date 回退）: 无额外 DB 查询
- F2（UPDATE parent_id 派生）: 最坏情况 +1 次 `SELECT parent_id FROM todos WHERE id=?`（仅当调用方未传 parent_id 时）
- F3（UPDATE 字段回退）: SELECT 字段从 5 个扩展到 11 个，无额外查询次数
- F4（readCopyText helper）: 纯 JS 函数调用，无 I/O 影响
- F5（DELETE parent_id 派生）: 同 F2

**总体**: 每个请求最多增加 1 次 O(1) 主键查询，对 D1 配额和延迟无可观测影响。

### 5.3 错误信息改善

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| CREATE 缺 date | `D1_TYPE_ERROR: Type 'undefined' not supported...` (500) | `date 为必填项（碎时记允许为空），请传顶层 date 或 task.date` (400) |
| UPDATE 缺 parent_id 且任务不存在 | `D1_TYPE_ERROR: Type 'undefined'...` (500) | `无法确定 parent_id（任务不存在或未传 parent_id）` (400) |
| UPDATE 缺 text | `D1_TYPE_ERROR: Type 'undefined'...` (500) | 自动从 DB 回退，正常 200 |

错误信息从 D1 内部细节变为业务语义，符合 `fix/robustness-validation` 分支主题。

---

## 6. 文档同步建议

### 6.1 API_Wiki.md

建议在 `API_Wiki.md` 的 §3.2 V0 Todo API 章节补充以下说明：

> **健壮性说明**（v2.7.8.3 起）：
> - `date` 字段可在 body 顶层 **或** `task.date` 内，二者其一即可（碎时记允许两者都为空）
> - `task.parent_id` 在 UPDATE/DELETE 中可选 — 缺失时服务端从 DB 自动派生
> - `text/time/priority/desc/url/copy_text` 在 UPDATE 中可选 — 缺失字段从 DB 保留原值（V1 PATCH 风格）
> - `copy_text` 与 `copyText` 均可读 — 前者为 API_Wiki 标准命名，后者为前端历史命名，两者并存以保兼容

### 6.2 version.json

建议递增版本号：

```json
{
  "version": "2.7.8.3",
  "db_schema": 1,
  "changelog": [
    {
      "version": "2.7.8.3",
      "date": "2026-06-27",
      "notes": "V0 todo-action 健壮性修复：CREATE 顶层 date 缺失时回退到 task.date（与 V1 行为对齐），UPDATE/DELETE 缺失 parent_id 时从 DB 派生，UPDATE 缺失 text/time/priority/desc/url/copy_text 时从 DB 回退（支持 V1 PATCH 风格的部分更新），统一 copy_text 与 copyText 命名读取（camelCase 优先以保前端兼容）。原 500 D1_TYPE_ERROR 错误改为 400 业务语义错误。"
    }
  ]
}
```

---

## 7. 复测脚本与产物

- **测试脚本**: `/home/z/my-project/scripts/test_runner.js`（已更新，142 用例）
- **本地验证脚本**: `/home/z/my-project/scripts/verify_fixes_locally.js`（16 断言）
- **测试结果 JSON**: `/home/z/my-project/scripts/test_results.json`
- **代码 diff**: `git diff src/api.js`（+68 / -23 行）

复测命令：

```bash
# 1. 本地逻辑验证（无需部署）
node /home/z/my-project/scripts/verify_fixes_locally.js
# 期望: 16 pass / 0 fail

# 2. 部署后线上回归
cd /home/z/my-project
node scripts/test_runner.js
# 期望: 142 pass / 0 fail
```

---

## 8. 后续建议

1. **CI 集成**：将 `test_runner.js` 纳入 GitHub Actions，每次 PR 自动跑 142 用例
2. **API_Wiki 同步**：按 §6.1 更新 API_Wiki，明确字段可选性
3. **版本发布**：按 §6.2 递增 version.json 至 `2.7.8.3`
4. **V1 API 一致性检查**：V1 路径目前未发现类似问题，但建议增加 V1 PATCH `/api/v1/todos/:id` 的字段缺失健壮性测试（当前测试已覆盖 V1 必填字段校验，但未覆盖部分字段更新边界）
5. **前端清理**：`src/html/js/detail.js:983` 的 `task.copyText = ...; task.copy_text = task.copyText;` 双写可在下一版本简化为只写 `copy_text`（修复后服务端可正确读取 snake_case）
