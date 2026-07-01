# cf-todo 黄金基线测试

## 文件结构

```
tests/golden/
├── record_baseline.py         # 录制脚本（可重复执行）
├── README.md                  # 本文件
└── baseline/                  # 基线响应快照（提交到 git）
    ├── _manifest.json         # 录制元信息（commit / seed sha256 / 已知非确定性字段）
    ├── 01_auth_login_success.body.txt       # 响应体
    ├── 01_auth_login_success.meta.json      # 状态/headers/timing/sha256
    ├── 02_auth_login_wrong_password.body.json
    ├── 02_auth_login_wrong_password.meta.json
    ├── ...
    └── 50_auth_logout.body.json
```

## 录制流程

录制脚本会：
1. 启动 `wrangler dev`（local D1，端口 8787）
2. POST `/api/login` 拿 cookie（手动管理，绕过 Secure 限制）
3. 调用 `/api/import` 3 阶段协议（init → NDJSON upload → finalize）灌入种子数据
4. 跑 50 条用例，保存响应体 + 元数据
5. 关闭 wrangler

### 重新录制

```bash
# 必须先清理本地 D1 状态（import 用 overwrite 模式会备份旧表，重复跑会冲突）
rm -rf .wrangler/state/v3/d1

# 跑录制（约 30 秒）
python3 tests/golden/record_baseline.py
```

如果端口 8787 被占用：

```bash
pkill -9 -f wrangler; pkill -9 -f workerd; sleep 2
```

## 50 条用例分布

| ID | 范围 | 用例数 |
|---|---|---|
| 01-04 | Auth（login success/wrong/empty + sessions list） | 4 |
| 05-07 | Static（index / manifest / sw.js） | 3 |
| 08-11 | Settings（GET settings/custom-code/custom-colors/custom-header） | 4 |
| 12-15 | Categories（list / create / list-after / create-duplicate） | 4 |
| 16-25 | Todos CRUD（GET 各种边界 + CREATE simple/fragment/recurring + UPDATE/DELETE nonexistent） | 10 |
| 26 | Time records GET | 1 |
| 27-29 | Trash（list / restore nonexistent / invalid action） | 3 |
| 30-33 | Stats（week / 12weeks / 6months / year） | 4 |
| 34 | Export stream | 1 |
| 35 | Hot search | 1 |
| 36-45 | V1 API（keys/todos/categories/trash/stats） | 10 |
| 46-49 | Boundary（404 / method-not-allowed / no-auth / SPA fallback） | 4 |
| 50 | Auth logout（必须最后，会清除 session） | 1 |

## 回归对比方法

后续阶段（Hono/Drizzle 重构）完成后，重新录制一遍基线到 `tests/golden/candidate/`，然后 diff：

```bash
# 对比每条用例的 sha256
for i in $(seq -w 1 50); do
  base=$(jq -r .response.body_sha256 tests/golden/baseline/${i}_*.meta.json | head -1)
  cand=$(jq -r .response.body_sha256 tests/golden/candidate/${i}_*.meta.json | head -1)
  if [ "$base" != "$cand" ]; then
    echo "DIFF: case $i  base=$base  cand=$cand"
  fi
done
```

## 已知非确定性字段（已在 manifest 中记录）

1. **Set-Cookie: auth_token / auth_sig** — 每次登录随机生成（已掩码保持长度）
2. **/api/v1/keys POST 返回的 key 明文** — 每次 CREATE 随机生成
3. **/api/category-action CREATE 返回的 id** — `Date.now() + Math.random()`
4. **/api/todo-action CREATE 返回的 task** — 含前端传入的 id（基线录制固定 id 可对比）
5. **/api/stats range=year 年度报告叙事** — 可能含动态日期文本

回归测试时，对以上字段需做语义对比而非 byte 对比。

## 设计取舍

- **录制脚本不进 vitest**：基线是 HTTP 层契约测试，跑一次 wrangler dev 后用 curl/python 发请求最直接。Vitest 留给阶段 3+ 的单元/集成测试。
- **种子数据来源**：`https://1814804152.cdn.123clouddisk.com/1814804152/43538350`（1272 条真实 todo + 9 模板 + 5 配置，含 RRULE 重复 / fragment 碎时记 / 子任务 / 计时等全场景）。下载到 `.research/baseline_seed.json`，**不提交**（`.gitignore` 已排除）。
- **Cookie 手动管理**：Python `urllib` 严格遵守 Secure cookie 限制，但 cf-todo 的 auth cookie 设了 Secure（生产 HTTPS 必需）。本地 HTTP dev 下浏览器对 localhost 豁免，但 urllib 不豁免，所以脚本手动从 Set-Cookie 提取再塞 Cookie 头。
