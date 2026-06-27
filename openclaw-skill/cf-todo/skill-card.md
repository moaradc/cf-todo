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
1.3.0 <br>

## Changelog: <br>
- **1.3.0** (2026-06-27, requires cf-todo v2.7.8.2+): `todos:date` 新增 `--no-expand` 选项，跳过服务端重复任务展开，响应附带 `templates` 数组供调用方自算（降低 Worker CPU 占用）。批量接口解除 100 条限制，响应含 `chunked`/`chunkCount` 字段，`affected`/`restored`/`deleted` 为实际改动行数。 <br>
- **1.2.0**: Initial release. <br>

## Ethical Considerations: <br>
Users should evaluate whether this skill is appropriate for their environment, review any changes before confirming destructive actions, and apply their organization's safety, security, and compliance requirements before deployment. <br>
