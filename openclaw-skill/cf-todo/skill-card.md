## Description: <br>
Manage todos and categories on a self-hosted Cloudflare Worker + D1 Todo App via RESTful API. Supports CRUD operations, recurring/repeating tasks, categories, trash/restore, statistics, settings, custom code, and custom colors. <br>

This skill is ready for commercial/non-commercial use. <br>

## Publisher: <br>
cf-todo community <br>

### License/Terms of Use: <br>
MIT <br>

## Use Case: <br>
External users and developers use this skill to let an AI agent manage a self-hosted cf-todo deployment through its V1 RESTful API, including creating/viewing/completing/deleting todos, managing recurring tasks with scope control, organizing categories, restoring from trash, viewing statistics, and managing app settings and custom code. <br>

### Deployment Geography for Use: <br>
Global (Cloudflare Workers) <br>

## Known Risks and Mitigations: <br>
Risk: Destructive actions (DELETE_PERMANENT, CLEAR_ALL, CLEAR_ALL_DATA, scope=all) can cause irreversible data loss. <br>
Mitigation: The skill enforces explicit user confirmation before any destructive action. CLEAR_ALL_DATA requires the strongest confirmation. <br>
Risk: Custom code (POST /api/v1/custom-code) injects HTML/CSS/JS directly into the web UI, which can break the interface if malformed. <br>
Mitigation: The skill shows the user what will be saved before executing custom code updates. <br>
Risk: Settings POST is a full overwrite — partial updates without GET-first can lose existing configuration. <br>
Mitigation: The skill instructs agents to always GET settings first, modify, then POST back. <br>

## Skill Output: <br>
**Output Type(s):** [text, shell commands, guidance] <br>
**Output Format:** [Concise confirmation lines after mutations; detailed data only when explicitly requested] <br>
**Output Parameters:** [1D] <br>
**Other Properties Related to Output:** [Uses curl via cf-todo.sh helper script; requires CF_TODO_API_URL and CF_TODO_API_KEY environment variables] <br>

## Skill Version(s): <br>
1.4.1 <br>

## Changelog: <br>
- **1.4.1** (2026-06-28): SKILL.md 补全 `fragment_anchor` 字段文档（List / Get / Create 响应示例、字段说明）；`repeat_type` 枚举补 `"fragment"`（碎时记）并新增约束说明（无模板、强制清空 time/end_time/repeat_end、`fragment_anchor` 自动同步 `date`）；Update 章节补充 `repeat_type` 与 `fragment` 互转时 `fragment_anchor` 的清理/同步行为；`expand=false` 段补充 `templates` 不含 `fragment_anchor` 列的说明（`fragment_anchor` 仅在 `todos` 表上）。`expand=false` templates 字段清单补 `repeat_custom` + RRULE 计算优先级规则。Breaking Change 条目精确化（snake_case 前置落地、静默忽略风险、响应字段 `isSeries` 改名）。 <br>
- **1.4.0** (2026-06-27): API 字段统一 snake_case。`todos:date` 新增 `--no-expand` 选项（跳过服务端重复任务展开）。批量接口自动分片（99/组），响应含 `chunked`/`chunkCount` 字段，`affected`/`restored`/`deleted` 为实际改动行数。 <br>
- **1.2.0**: Initial release. <br>

## Ethical Considerations: <br>
Users should evaluate whether this skill is appropriate for their environment, review any changes before confirming destructive actions, and apply their organization's safety, security, and compliance requirements before deployment. <br>
