# Tests

本目录包含 `repeat_custom` 自定义 RRULE 功能的测试脚本，覆盖引擎单元测试、API 端到端测试、文档示例验证、字段语义审计等场景。

## 环境要求

- Node.js 18+（推荐 20+）
- 项目依赖已安装：在仓库根目录运行 `npm install`（安装 `ical.js`）

## 脚本清单

### 1. `test_repeat_custom.mjs` — 引擎单元测试

测试 `recurring-engine.js` 中的 `sanitizeRepeatCustom` / `processRepeatCustom` / `buildRRuleString`（通过 `isOccurrenceOnDate` 间接验证）/ `computeUpdateActions` 函数。

**不依赖网络**，纯本地引擎逻辑验证。

```bash
node tests/test_repeat_custom.mjs
```

覆盖范围（67 项）：
- `sanitizeRepeatCustom`：27 种输入的接受/拒绝（空值、合法 RRULE、大小写、控制字符、超长、多 RRULE 注入等）
- `processRepeatCustom`：10 种 repeat_type 兼容性场景
- `buildRRuleString`：18 项 MWF / biweekly / INTERVAL 覆盖 / UNTIL 优先级 / EXDATE 叠加验证
- `computeUpdateActions`：12 项 split-series 透传 + recurrence_changed 检测 + 三种 scope 转不重复清空行为

### 2. `e2e_repeat_custom.sh` — 生产端到端测试（bash + curl）

针对部署实例的端到端 HTTP 测试，验证 V1/V0 API 的 repeat_custom 全流程。

**依赖网络**，需配置 `BASE` 和 `API_KEY`。

```bash
# 修改脚本顶部的 BASE 和 API_KEY
BASE="https://your-app.workers.dev"
API_KEY="cfk_your_key"
WEB_PW="your_web_password"

bash tests/e2e_repeat_custom.sh
```

覆盖范围（13 项）：
- V1 POST 合法/非法 repeat_custom（SECONDLY / CRLF 注入）
- V1 POST fragment 类型强制清空
- V1 expand=true / expand=false
- V1 PUT PATCH 语义（保留 / 修改 / 清空）
- V0 web 登录 + CREATE + UPDATE

### 3. `e2e_doc_audit.mjs` — 文档示例照抄验证

以第三方调用方视角，照抄 `API_Wiki.md` 5.6 节每个示例一字不差地跑，验证文档与实际行为一致。

**依赖网络**，需配置 `BASE` 和 `API_KEY`。

```bash
# 修改脚本顶部的 BASE 和 API_KEY
node tests/e2e_doc_audit.mjs
```

覆盖范围（16 项）：
- 示例 1：V1 POST MWF，响应字段与文档一致
- 示例 2：V1 POST 工作日 + repeat_end，UNTIL 拼接验证
- 示例 3：V1 POST 月末工作日 BYSETPOS=-1，ical.js 能否解析
- 示例 4：expand=false + 文档 `isOccurrenceOnDate` 函数原样运行
- 示例 5：V1 PUT PATCH 语义
- 示例 6：转 fragment 强制清空
- V0 CREATE + UPDATE 完整 task 对象

### 4. `e2e_edge_audit.mjs` — 边界场景测试

真实第三方客户端会遇到的边界场景验证。

**依赖网络**，需配置 `BASE` 和 `API_KEY`。

```bash
node tests/e2e_edge_audit.mjs
```

覆盖范围（12 项）：
- 边界 1：anchor_date 不匹配 BYDAY（RFC 5545 首实例规则）
- 边界 2：V1 PUT undefined vs null vs "" 三种清空方式
- 边界 3：V0 UPDATE scope=this 重复任务时 repeat_custom 行为
- 边界 4：expand=false 范围查询是否返回 templates
- 边界 5：完成重复实例后 exdates 行为
- 边界 6：repeat_custom 含 COUNT=10 的展开上限
- 边界 7：文档 `isOccurrenceOnDate` 函数在 anchor 不匹配 BYDAY 时

### 5. `v0_update_field_audit.mjs` — V0 UPDATE 字段语义审计 v1

逐字段测试 V0 UPDATE 未传字段时是 PATCH（保留）还是全量替换（清空）。

**依赖网络**，需配置 `BASE` 和 `API_KEY`。

```bash
node tests/v0_update_field_audit.mjs
```

> 注：此脚本 UPDATE 时传了 `repeat_type` + `repeat_interval`，对这两个字段的判断不够纯粹。推荐使用 v2 版本。

### 6. `v0_update_field_audit_v2.mjs` — V0 UPDATE 字段语义审计 v2（精确版）

v1 的改进版：V0 UPDATE 只传 `{id, text}`，其余字段全部不传，这样能准确判断每个未传字段的真实行为。

**依赖网络**，需配置 `BASE` 和 `API_KEY`。

```bash
node tests/v0_update_field_audit_v2.mjs
```

输出 14 个字段的 PATCH vs 全量替换判定结果，是 `API_Wiki.md` 5.6 节「V0 UPDATE 字段语义」表格的数据来源。

## 运行顺序建议

首次验证流程：

```bash
# 1. 引擎单元测试（无网络依赖，最快）
node tests/test_repeat_custom.mjs

# 2. 配置 BASE 和 API_KEY 后，跑端到端测试
bash tests/e2e_repeat_custom.sh
node tests/e2e_doc_audit.mjs
node tests/e2e_edge_audit.mjs

# 3. 字段语义审计（文档准确性验证）
node tests/v0_update_field_audit_v2.mjs
```

## 测试数据清理

所有端到端脚本在结束时自动 DELETE 创建的测试 todo，不会残留垃圾数据。若脚本中途失败，可能残留部分测试 todo，可手动通过 V1 API 清理：

```bash
curl -X DELETE -H "X-API-Key: cfk_your_key" \
  "https://your-app.workers.dev/api/v1/todos/{id}?scope=all"
```

测试 todo 的 text 前缀均为 `e2e-` / `audit-` / `V0 测试` / `清空测试` / `intv-test` 等，便于识别和批量清理。
