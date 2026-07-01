# cf-todo 重构进度

> **当前分支**: `bak/v3-breaking-rrule-0800-2-1526`
> **备份分支**: `bak/v3-rrule-refactor-snapshot-20260701`
> **最后更新**: 2026-07-01

## 整体目标

把 `src/api.js` (3641 行) + `src/api-v1.js` (2316 行) 这两个 6000 行的纯 JS 巨石，
重构为 TypeScript + Hono (路由层) + Drizzle ORM (D1 层) 架构。前端 `src/html/**`、
`recurring-engine.js`、`utils.js` 业务逻辑、`version.json` 完全不动。生产可上线。

## 9 阶段总览

```
阶段 0: 基线准备 ✅
阶段 1: 构建链 + TS 接入 ✅
阶段 2: Drizzle schema + 首次迁移 ✅
阶段 3: 中间件层（鉴权 + 锁 + DB 工厂）  ← 明天开始
阶段 4: 路由骨架 + V0 静态路由
阶段 5: V0 业务路由迁移（按子域分批）
阶段 6: V1 业务路由迁移
阶段 7: 双轨运行 + 灰度
阶段 8: 清理 + 下线旧代码
```

每个阶段结束都可部署、可回滚。不允许"全部一起上"的大爆炸合并。

## 今天完成（2026-07-01）

### 阶段 0 — 基线准备 ✅

- **Commit 0.2** `1fc5dbd` chore: pin ical.js + add vitest/miniflare dev deps
- **Commit 0.1** `ca95331` chore: snapshot baseline behavior

产出：
- 50 条黄金 HTTP 基线响应（`tests/golden/baseline/`，101 文件）
- 可重复录制脚本（`tests/golden/record_baseline.py`，30 秒跑完）
- 种子数据 1272 条真实 todo（RRULE / fragment / 子任务 / 计时全场景）
- Cloudflare Free 限制已勘察记录（Workers 10ms CPU / D1 500MB / 100 绑定参数）

关键修正：
- API 契约勘误：V0 `/api/todos` 只接受 `date`（无 range），V0 `/api/stats` 用 `start+end`
  （无 range），action 字段必须大写，V0 CREATE 用 `task.id` 而非顶层 id
- Cookie 手动管理：urllib 严格遵守 Secure 限制，必须绕过
- import 是 3 阶段协议（init/upload/finalize），不是单次 POST

### 阶段 1 — 构建链 + TS 接入 ✅

- **Commit 1.1** `d322985` build: add TypeScript + tsconfig + allowJs
- **Commit 1.2** `2bbee5d` build: add wrangler build command + esbuild config
- **Commit 1.3** `d818eed` chore: rename src/index.js → src/index.legacy.js

产出：
- `tsconfig.json`（allowJs + checkJs=false，旧 JS 不强制检查）
- `wrangler.toml` 加 `[build]` + esbuild 打包链路
- `src/index.ts` 透传层（替换 `src/index.js`，后者改名 `index.legacy.js`）
- 验收：`typecheck` + `build` + `wrangler deploy --dry-run` 全绿

关键修正：
- 移除 `--external:ical.js`：Workers 无 bare module resolver，必须 `--bundle` 内联

### 阶段 2 — Drizzle Schema + 首次迁移 ✅

- **Commit 2.1** `a33ebca` feat(db): add drizzle schema definition
- **Commit 2.2** `5a1d74c` feat(db): add drizzle config + first migration
- **Commit 2.3** `126c340` feat(db): add migration runner middleware

产出：
- `src/db/schema.ts` — 7 张表 + 5 个索引，与 `initDb()` 字节级对齐
- `drizzle/0000_baseline.sql` — baseline 迁移（IF NOT EXISTS 风格）
- `src/middleware/init-db.ts` — `Env` 类型 + `ensureMigrated` 诊断检查
- `src/api.js` 第 45 行：`isDbInitialized = true` 让旧 initDb short-circuit
- `@cloudflare/workers-types` 加进 devDeps，`D1Database` 等类型可用

关键修正（相对原计划）：
1. **baseline 必须用 IF NOT EXISTS**：计划说不带，实测在已跑过旧 initDb 的生产 D1 上
   会因 `table already exists` 失败。这是上线时唯一会真实发生的路径。
2. **不在运行时跑 drizzle migrator**：`drizzle-orm/d1/migrator` 依赖 Node.js fs 读
   migrationsFolder，Workers 运行时无 fs 会崩。改为"部署时迁移 + 运行时诊断"模式。

验收（关键）：
- 全新 D1 → `migrations apply` → 7 表 + 5 索引 ✓
- 已有旧 initDb 的 D1 → `migrations apply` → IF NOT EXISTS 跳过，无数据丢失 ✓
- 二次 apply → "No migrations to apply"（幂等）✓
- **50 条黄金基线 sha256 全部一致**（与阶段 0 旧基线对比：`Match: 50, Diff: 0`）
  ——证明阶段 2 改造对运行时行为零影响

## 明天计划（阶段 3 — 中间件层）

**目标**：把 `api.js` 里的鉴权 / per-date lock / DB 工厂逻辑提取到独立 TS 模块，
为阶段 4+ 的 Hono 路由层做准备。旧逻辑还在 `api.js` 里跑，新逻辑并行存在。

**Commit 3.1** `feat(middleware): add db client factory`
- `src/db/client.ts`：`drizzle(env.DB, { schema })` 工厂
- `src/db/read-replica.ts`：`withSession('first-primary')` 透传（保留 D1 读副本能力）

**Commit 3.2** `feat(middleware): add auth middleware (cookie + api key + scope)`
- `src/middleware/auth.ts`：三合一鉴权
  - cookie 鉴权（auth_token + auth_sig HMAC 校验）
  - API Key 鉴权（X-API-Key / Bearer / Query）
  - scope 校验（disabled / v1 / all）
- 从 `api.js` 第 88-114 行的 `isAuthorized` + `api-v1.js` 的 `verifyApiKey` 提取

**Commit 3.3** `feat(middleware): add per-date lock middleware`
- `src/middleware/per-date-lock.ts`：`_withTodosDateLock(date, fn)`
- 从 `api.js` 第 70-80 行提取，保留同 isolate 内串行化语义

**验收**：
- 三个中间件独立可测（vitest + miniflare）
- 不动 `api.js` 里的旧逻辑（dead code 化在阶段 8）
- 重新跑 50 条黄金基线，sha256 仍全部一致

## 已知风险 & 待办

1. **`read_replication` wrangler v4 warning**：`wrangler.toml` 的 `read_replication`
   字段在新版 wrangler 已移动位置，每次跑 wrangler 命令都有 warning。阶段 3 处理
   `src/db/read-replica.ts` 时一并修正 wrangler.toml。
2. **`database_id` 占位**：`wrangler.toml` 用的是占位 UUID，真实部署前必须替换为
   Cloudflare Dashboard 中的真实 database_id。已在 wrangler.toml 注释中标注。
3. **golden baseline 的 hot_search 用例**：case 35 (hot_search) 响应内容依赖外部
   API，size 可能波动（6559B vs 1715B 都见过）。回归测试时这条用例需语义对比而非
   byte 对比，或者考虑用 mock 替代。
4. **`.dev.vars` 不在 git**：含 JWT_SECRET / ADMIN_PASSWORD，每次新环境需手动创建。
   阶段 7 灰度前考虑用 `wrangler secret` 管理。

## 回归测试方法

```bash
# 1. 清理本地 D1 state
rm -rf .wrangler/state/v3/d1

# 2. 重新录制基线（30 秒）
python3 tests/golden/record_baseline.py

# 3. 对比 sha256（应有 50/50 一致，除已知非确定性字段）
python3 << 'PY'
import json, glob
from pathlib import Path
old = Path('tests/golden/baseline')
# 假设新基线录到 candidate/，对比逻辑见 tests/golden/README.md
PY
```

## 文件结构变化

```
cf-todo/
├── wrangler.toml              # 改：build + migrations_dir + database_id 占位
├── package.json               # 改：scripts + deps
├── tsconfig.json              # 新
├── drizzle.config.ts          # 新
├── drizzle/                   # 新
│   ├── 0000_baseline.sql
│   └── meta/_journal.json
├── src/
│   ├── index.ts               # 新：透传 + ensureMigrated
│   ├── index.legacy.js        # 改名自 index.js
│   ├── api.js                 # 改：isDbInitialized=true（dead code initDb）
│   ├── api-v1.js              # 不动
│   ├── utils.js               # 不动
│   ├── recurring-engine.js    # 不动
│   ├── html.js                # 不动
│   ├── html/                  # 不动
│   ├── db/
│   │   └── schema.ts          # 新
│   └── middleware/
│       └── init-db.ts         # 新：Env + ensureMigrated
└── tests/golden/              # 新
    ├── record_baseline.py
    ├── README.md
    └── baseline/              # 50 × (body + meta) + _manifest.json
```
