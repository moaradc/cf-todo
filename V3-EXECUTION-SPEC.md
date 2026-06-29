# v3.0 破坏性变更执行规范

## 设计目标

1. **API 层 100% RFC 5545**：唯一规范字段 `rrule`，配套 `anchor_date` + `exdates`
2. **UI 层 100% 用户友好**：三段式布局 + 预览 + 快捷按钮
3. **零兼容包袱**：旧字段彻底删除，不留过渡期
4. **数据零丢失**：DB 迁移自动从旧字段合成 rrule，老数据完整保留

## 字段变更总表

### DB 列变更

| 表 | 旧列 | 新列 | 处理 |
|---|---|---|---|
| todos | repeat_type | type | 重命名 + 值收窄为 `none`/`fragment`/`recurring` |
| todos | repeat_custom | (删除) | 数据回填到 rrule |
| todos | repeat_interval | (删除) | 数据回填到 rrule |
| todos | repeat_end | (删除) | 数据回填到 rrule |
| todos | rrule | rrule | 保留，回填老数据 |
| todo_templates | repeat_type | type | 重命名 + 固定 `recurring` |
| todo_templates | repeat_custom | (删除) | 数据回填到 rrule |
| todo_templates | repeat_interval | (删除) | 数据回填到 rrule |
| todo_templates | repeat_end | (删除) | 数据回填到 rrule |
| todo_templates | rrule | rrule | 保留，回填老数据 |

### API 字段变更（V0 + V1 一致）

**入参**（CREATE/UPDATE body）：
- 删除：`repeat_type`, `repeat_custom`, `repeat_interval`, `repeat_end`, `is_series`
- 新增/保留：`type`（none/fragment/recurring）, `rrule`, `anchor_date`, `exdates`

**响应**（GET）：
- 删除：`repeat_type`, `repeat_custom`, `repeat_interval`, `repeat_end`
- 新增/保留：`type`, `rrule`, `anchor_date`, `exdates`, `is_series`（派生：`type==='recurring'`）

### type 取值映射

| 旧 repeat_type | 新 type | rrule |
|---|---|---|
| `none` | `none` | `''` |
| `fragment` | `fragment` | `''` |
| `daily` | `recurring` | `FREQ=DAILY;...` |
| `weekly` | `recurring` | `FREQ=WEEKLY;...` |
| `monthly` | `recurring` | `FREQ=MONTHLY;...` |
| `yearly` | `recurring` | `FREQ=YEARLY;...` |

### 模板展开 SQL 变更

| 旧 SQL | 新 SQL |
|---|---|
| `WHERE repeat_type IN ('daily','weekly','monthly','yearly')` | `WHERE type = 'recurring'` |
| `WHERE repeat_type != 'fragment'` | `WHERE type != 'fragment'` |
| `WHERE repeat_type != 'fragment' AND date = ?` | `WHERE type != 'fragment' AND date = ?` |
| `idx_templates_repeat_type` | `idx_templates_type` |

## 后端代码删除清单

### recurring-engine.js
- 删除：`sanitizeRepeatCustom`、`processRepeatCustom`、`deriveRepeatTypeFromCustom`、`validateRepeatEndCompat`、`validateRepeatIntervalCompat`、`FREQ_MAP`（内部用）
- 删除：`buildRRuleString` 5 参数版本，简化为 `expandRRule(rrule, anchor_date, exdates)`
- 删除：`getRepeatLabel` 旧版本（按 type 推导），改为直接解析 rrule
- 删除：`deriveLegacyFieldsFromRRule`、`rruleFromLegacyFields`（保留为内部迁移工具，不再导出）
- 保留：`sanitizeRRule`、`processRRule`、`isOccurrenceOnDate`、`getOccurrencesBetween`、`computeDeleteActions`、`computeUpdateActions`、`addExdate`、`removeExdate`、日期工具

### api.js (V0)
- 删除所有 `repeat_type` / `repeat_custom` / `repeat_interval` / `repeat_end` 处理逻辑
- CREATE/UPDATE 入口仅接受 `type` + `rrule` + `anchor_date` + `exdates`
- 响应序列化仅返回 `type` + `rrule` + `anchor_date` + `exdates` + 派生 `is_series`

### api-v1.js (V1)
- 同 V0

## 前端代码变更清单

### detail.js
- 新增 `_buildRRuleFromUI(repeatType, interval, repeatEnd, anchorDate)` —— 保留，调整为从 UI 状态合成 rrule
- 删除：`tempRepeatInterval`、`tempRepeatEnd` 状态变量
- `confirmAddTask` / `confirmAction` 仅发送 `type` + `rrule` + `anchor_date` + `exdates`
- `getRepeatDisplayText` 简化为只解析 rrule
- 新增：预览未来 5 次实例（用 ical.js 在前端展开）

### core.js
- `_rruleToZhLabel` 保留
- 删除：`_rruleParse` 等内部函数中处理旧字段的分支

## 迁移工具 migrate.html

- v2.8 → v3.0 迁移路径
- 删除旧字段补全逻辑（repeat_interval / repeat_end / repeat_custom）
- 新增 type 字段重命名（repeat_type → type，值收窄）
- rrule 已在 v2.8 合成，仅验证非空

## 文档变更

### API_Wiki.md
- 删除：5.6 节（repeat_custom 指南）
- 删除：5.7 节（rrule 一等公民过渡说明）
- 重写：4.1/4.2 字段列表（删除旧字段，添加 type/rrule/anchor_date/exdates）
- 重写：5.1-5.5 三种类型章节
- 新增：5.6 节 v3.0 完整 RRULE 指南（含 BYSETPOS/BYMONTHDAY 负数）

### version.json
- 版本升至 3.0.0
- db_schema 升至 3
- changelog 标注破坏性变更

### README.md
- 更新能干什么章节
- 标注 v3.0 破坏性变更提示

## 测试用例覆盖（目标 ≥80）

1. sanitizeRRule 合法/非法（30 用例）
2. processRRule 校验（10 用例）
3. isOccurrenceOnDate rrule 优先（15 用例）
4. getOccurrencesBetween 范围查询（10 用例）
5. computeUpdateActions 系列 split（10 用例）
6. type 三态判定（5 用例）
7. 端到端 CREATE/UPDATE/GET 流程（10 用例）

## 风险点与对策

### 风险 1: DB ALTER 失败
- **场景**：D1 ALTER TABLE 不支持某些组合操作
- **对策**：分步执行 ALTER，每步 try/catch；提供回滚 SQL

### 风险 2: 老数据 rrule 列为空但旧字段有效
- **场景**：v2.7 用户跳过 v2.8 直接升级到 v3.0
- **对策**：schema 3 迁移时先回填 rrule（用旧字段合成），再删除旧字段

### 风险 3: SQL 查询漏改
- **场景**：534 处旧字段引用，可能漏改
- **对策**：所有 SQL 用 `WHERE type = 'recurring'` 替代 `WHERE repeat_type IN (...)`，grep 全量审计

### 风险 4: 前端缓存导致旧逻辑运行
- **场景**：用户浏览器缓存旧 JS
- **对策**：版本号变更触发 Service Worker 清缓存（项目已有机制）

### 风险 5: API 客户端兼容性
- **场景**：外部 API 客户端仍传旧字段
- **对策**：返回 400 + 明确错误消息（"v3.0 已弃用 repeat_type，请用 type + rrule"）；不静默忽略

## 执行顺序

1. Phase 2: recurring-engine.js 重写
2. Phase 3: DB schema 升级（CREATE TABLE + ALTER）
3. Phase 4: api.js V0 改造
4. Phase 5: api-v1.js V1 改造
5. Phase 6: 前端 detail.js 重写
6. Phase 7: migrate.html 重写
7. Phase 8: 文档更新
8. Phase 9: 测试用例
9. Phase 10: 验证 + commit
