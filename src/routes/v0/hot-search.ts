/**
 * V0 公开路由：hot-search
 *
 * 这是最简单的路由，验证 Hono 路由 + 外部 fetch 的基本通路。
 *
 *
 * 设计：
 *   - 公开路由（不加 auth 中间件）
 *   - 不做服务端缓存，保证实时性
 *   - fetchHotSearchData 内部已有 5s 超时 + 失败降级
 */

import { Hono } from 'hono';
import { fetchHotSearchData } from '../../utils.js';
import type { V0AppEnv } from './index';

/** hot-search Hono app。 */
export const hotSearchApp = new Hono<V0AppEnv>();

/**
 * GET /api/hot-search?provider=auto
 *
 *
 * 注：hot-search 不做服务端缓存，保证实时性（用户主动点「换一批」、
 * 创建带热搜的 todo 都需要最新数据）。fetchHotSearchData 内部已有
 * 5s 超时 + 失败降级，足够健壮。
 */
hotSearchApp.get('/hot-search', async (c) => {
  const url = new URL(c.req.url);
  const provider = url.searchParams.get('provider') || 'auto';
  const all_words = await fetchHotSearchData(provider);
  return new Response(JSON.stringify({ success: true, data: all_words }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
