/**
 * V1 Keys 路由 —— API Key 管理（cookie-only，不走 API Key 鉴权）
 *
 *
 * 路由：/api/v1/keys
 *   - GET：列出所有 key（隐藏完整 key，只显示前8位 + 掩码）
 *   - POST：action=CREATE/DELETE/TOGGLE/RENAME
 *
 * 鉴权：cookie 鉴权（checkCookieAuth），不走 API Key 中间件
 */

import { Hono } from 'hono';
import { getApiKeys, saveApiKeys, cookieAuth, type ApiKeyRecord } from '../../middleware/auth';
import type { V1AppEnv } from './index';

export const keysApp = new Hono<V1AppEnv>();

// 关键：cookieAuth 必须在 .all('/keys', handler) 之前注册，
// 否则 Hono 会先匹配 .all 路由处理器，导致鉴权被绕过。
keysApp.use('/keys', cookieAuth);

/** 生成 API Key（cfk_ 前缀 + 32 字节随机 base64url）。 */
function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = btoa(String.fromCharCode(...bytes))
    .replace(/[+/=]/g, (c) => (c === '+' ? '-' : c === '/' ? '_' : ''));
  return 'cfk_' + raw;
}

keysApp.all('/keys', async (c) => {
  if (c.req.method === 'GET') {
    const keys = await getApiKeys(c.env.DB);
    // 返回时隐藏完整 key，只显示前8位 + 掩码
    const safe = keys.map((k) => ({
      id: k.id,
      name: k.name || '',
      keyPrefix: k.key.slice(0, 8) + '...' + k.key.slice(-4),
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt || null,
      disabled: k.disabled || false,
    }));
    return new Response(JSON.stringify(safe), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (c.req.method === 'POST') {
    let parsed: { action?: string; id?: string; name?: string };
    try {
      parsed = await c.req.raw.json();
    } catch {
      return new Response(JSON.stringify({ error: '请求体不是有效的 JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }
    const { action, id, name } = parsed;

    if (action === 'CREATE') {
      const keys = await getApiKeys(c.env.DB);
      if (keys.length >= 10) {
        return new Response(JSON.stringify({ error: '最多创建10个API Key' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }
      const newKey = generateApiKey();
      const keyId = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const record: ApiKeyRecord = {
        id: keyId,
        key: newKey,
        name: (name || '').trim().slice(0, 50) || 'Default',
        createdAt: Date.now(),
        lastUsedAt: null,
        disabled: false,
      };
      keys.push(record);
      await saveApiKeys(c.env.DB, keys);
      // 仅在创建时返回完整 key
      return new Response(JSON.stringify({ success: true, id: keyId, key: newKey, name: record.name }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'DELETE') {
      if (!id) return new Response(JSON.stringify({ error: '缺少 id' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      let keys = await getApiKeys(c.env.DB);
      keys = keys.filter((k) => k.id !== id);
      await saveApiKeys(c.env.DB, keys);
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'TOGGLE') {
      if (!id) return new Response(JSON.stringify({ error: '缺少 id' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      const keys = await getApiKeys(c.env.DB);
      const target = keys.find((k) => k.id === id);
      if (!target) return new Response(JSON.stringify({ error: 'Key 不存在' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      target.disabled = !target.disabled;
      await saveApiKeys(c.env.DB, keys);
      return new Response(JSON.stringify({ success: true, disabled: target.disabled }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'RENAME') {
      if (!id) return new Response(JSON.stringify({ error: '缺少 id' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      const keys = await getApiKeys(c.env.DB);
      const target = keys.find((k) => k.id === id);
      if (!target) return new Response(JSON.stringify({ error: 'Key 不存在' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      target.name = (name || '').trim().slice(0, 50) || 'Default';
      await saveApiKeys(c.env.DB, keys);
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: '未知操作，可用: CREATE, DELETE, TOGGLE, RENAME' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});
