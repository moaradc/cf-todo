/**
 * cf-todo Worker 入口 —— 阶段 1 透传层
 *
 * 阶段 1 目标：让 TypeScript + esbuild 构建链路闭环，运行行为零变化。
 * 旧的 src/index.js 已重命名为 src/index.legacy.js，内容未改。
 * 本文件作为新的入口（被 esbuild 打包成 dist/worker.mjs），仅做透传：
 *   import legacy → export default legacy
 *
 * 阶段 4+ 会在此处替换为真正的 Hono app，并在阶段 8 删除 index.legacy.js。
 */

// 从遗留入口透传 default export（即 { fetch: handleRequest }）。
// allowJs=true 让 .js 文件可被 .ts 项目导入；checkJs=false 不对其做类型检查。
import legacy from './index.legacy.js';

// Cloudflare Workers fetch handler 签名。
// 阶段 3 会引入 Env 类型（DB / JWT_SECRET / ADMIN_PASSWORD 等）替换 unknown。
export interface FetchHandler {
  fetch(
    request: Request,
    env: unknown,
    ctx: unknown
  ): Promise<Response> | Response;
}

// 运行时直接转发 default export，行为与旧 src/index.js 完全一致。
const worker: FetchHandler = legacy as FetchHandler;
export default worker;
