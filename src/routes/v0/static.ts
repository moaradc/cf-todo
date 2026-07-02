/**
 * V0 静态路由：manifest / sw / SPA fallback
 *
 *
 * 搬迁来源：
 *   - GET /manifest.json  ← api.js:419-437
 *   - GET /sw.js          ← api.js:440-561
 *   - GET /*（SPA）       ← api.js:563-717
 *
 * 关键保留（审计警告）：
 *
 * 挂载：在 v0App 注册（实际是根路径，不挂在 /api 下）。
 * 顺序：manifest / sw 精确匹配优先，SPA fallback 兜底。
 */

import { Hono } from 'hono';
import { APP_VERSION, MAX_BROWSER_UA } from '../../utils.js';
import { renderHTML } from '../../html.js';
import { checkCookieAuth, type SessionEntry } from '../../middleware/auth';
import type { V0AppEnv } from './index';

/** 静态路由 Hono app。挂在根路径（不在 /api 下）。 */
export const staticApp = new Hono<V0AppEnv>();

// ==================== PWA Manifest ====================

/**
 * GET /manifest.json
 * 与 api.js:419-437 一致。
 */
staticApp.get('/manifest.json', (c) => {
  const manifest = {
    name: 'MOARA 待办事项',
    short_name: 'MOARA',
    description: '普通的待办事项管理',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    orientation: 'any',
    icons: [
      {
        src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="80" fill="#0a0a0a"/><rect x="60" y="60" width="392" height="392" rx="40" fill="none" stroke="%23ff3300" stroke-width="16"/><path d="M160 256l50 50 142-142" fill="none" stroke="%2300ff41" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
      {
        src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="30" fill="#0a0a0a"/><rect x="22" y="22" width="148" height="148" rx="15" fill="none" stroke="%23ff3300" stroke-width="6"/><path d="M60 96l19 19 53-53" fill="none" stroke="%2300ff41" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
});

// ==================== PWA Service Worker ====================

/**
 * GET /sw.js
 * 与 api.js:440-561 一致。
 *
 * CACHE_NAME 跟随 APP_VERSION：版本升级 → 新 SW activate 时自动清理旧缓存。
 * sw.js 不缓存，确保浏览器每次注册都拿到最新版本（触发 update）。
 */
staticApp.get('/sw.js', (c) => {
  const swCode = `
'use strict';
const CACHE_NAME = 'moara-todo-v${APP_VERSION}';

// App Shell: install阶段预缓存根页面，确保离线可加载
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.add('/');
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        event.source.postMessage({ type: 'CACHE_CLEARED' });
      })
    );
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const reqUrl = new URL(event.request.url);
  const isSameOrigin = reqUrl.origin === self.location.origin;
  if (!isSameOrigin) return;

  const isApi = reqUrl.pathname.startsWith('/api/');
  const isNav = event.request.mode === 'navigate' || reqUrl.pathname === '/';

  if (isApi) {
    // Network-first for API: 优先网络获取最新数据，离线时回退缓存
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // 网络不可用：从缓存读取上次的数据
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // API无缓存时返回离线标记，前端可据此显示提示
            return new Response(JSON.stringify({ offline: true }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
  } else if (isNav) {
    // Network-first for navigation: 优先加载最新页面，离线时回退缓存的App Shell
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // 网络不可用：从缓存获取页面
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // 回退到预缓存的根页面（App Shell）
            return caches.match('/').then((rootCached) => {
              if (rootCached) return rootCached;
              return new Response('离线不可用', { status: 503 });
            });
          });
        })
    );
  } else {
    // Stale-while-revalidate for other same-origin static assets (CSS, JS, images, etc.)
    event.respondWith(
      caches.match(event.request).then((cached) => {
        var fetchPromise = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              var clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
              });
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
`;
  return new Response(swCode, {
    headers: {
      'Content-Type': 'application/javascript',
      // sw.js 不缓存，确保浏览器每次注册都拿到最新版本（触发 update）
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
});

// ==================== SPA Fallback ====================

/**
 * UA 自动更新辅助：把 oldUA 在三个 per-UA 数组里替换为 currentUA。
 *
 *
 * 三个数组各自的更新逻辑：
 *   1. 找 oldUA，找到则替换 ua 字段为 currentUA（replaced=true）
 *   2. 没找到则 push 新条目（{ ua: currentUA, scale/fontSize/displayScale: 默认值 }）
 *   3. 去重：保留第一个 ua===currentUA 的条目，其余删除
 *   4. 限长：超过 MAX_BROWSER_UA 时 shift 最旧的
 *
 * @param appSettingsObj app_settings JSON 对象（会被原地修改）
 * @param oldUA 旧 UA（matchedSession.ua）
 * @param currentUA 新 UA（当前请求 UA）
 */
function updateUaInArrays(
  appSettingsObj: Record<string, unknown>,
  oldUA: string,
  currentUA: string,
): void {
  // ----- scaleByBrowser -----
  if (!Array.isArray(appSettingsObj.scaleByBrowser)) {
    appSettingsObj.scaleByBrowser = [];
  }
  const scaleByBrowser = appSettingsObj.scaleByBrowser as Array<{ ua: string; scale: number }>;

  let replaced = false;
  for (let i = 0; i < scaleByBrowser.length; i++) {
    if (scaleByBrowser[i].ua === oldUA) {
      scaleByBrowser[i].ua = currentUA;
      replaced = true;
      break;
    }
  }
  if (!replaced) {
    scaleByBrowser.push({ ua: currentUA, scale: 1.0 });
  }

  let foundCurrentUA = false;
  appSettingsObj.scaleByBrowser = scaleByBrowser.filter((s) => {
    if (s.ua === currentUA) {
      if (!foundCurrentUA) {
        foundCurrentUA = true;
        return true;
      }
      return false;
    }
    return true;
  });

  while ((appSettingsObj.scaleByBrowser as unknown[]).length > MAX_BROWSER_UA) {
    (appSettingsObj.scaleByBrowser as unknown[]).shift();
  }

  // ----- fontSizeByBrowser -----
  if (!Array.isArray(appSettingsObj.fontSizeByBrowser)) {
    appSettingsObj.fontSizeByBrowser = [];
  }
  const fontSizeByBrowser = appSettingsObj.fontSizeByBrowser as Array<{ ua: string; fontSize: number }>;

  let replacedFontSize = false;
  for (let i = 0; i < fontSizeByBrowser.length; i++) {
    if (fontSizeByBrowser[i].ua === oldUA) {
      fontSizeByBrowser[i].ua = currentUA;
      replacedFontSize = true;
      break;
    }
  }
  if (!replacedFontSize) {
    fontSizeByBrowser.push({ ua: currentUA, fontSize: 16 });
  }

  let foundCurrentUAFontSize = false;
  appSettingsObj.fontSizeByBrowser = fontSizeByBrowser.filter((s) => {
    if (s.ua === currentUA) {
      if (!foundCurrentUAFontSize) {
        foundCurrentUAFontSize = true;
        return true;
      }
      return false;
    }
    return true;
  });

  while ((appSettingsObj.fontSizeByBrowser as unknown[]).length > MAX_BROWSER_UA) {
    (appSettingsObj.fontSizeByBrowser as unknown[]).shift();
  }

  // ----- displayScaleByBrowser -----
  if (!Array.isArray(appSettingsObj.displayScaleByBrowser)) {
    appSettingsObj.displayScaleByBrowser = [];
  }
  const displayScaleByBrowser = appSettingsObj.displayScaleByBrowser as Array<{ ua: string; displayScale: number }>;

  let replacedDisplayScale = false;
  for (let i = 0; i < displayScaleByBrowser.length; i++) {
    if (displayScaleByBrowser[i].ua === oldUA) {
      displayScaleByBrowser[i].ua = currentUA;
      replacedDisplayScale = true;
      break;
    }
  }
  if (!replacedDisplayScale) {
    displayScaleByBrowser.push({ ua: currentUA, displayScale: 1.0 });
  }

  let foundCurrentUADisplayScale = false;
  appSettingsObj.displayScaleByBrowser = displayScaleByBrowser.filter((s) => {
    if (s.ua === currentUA) {
      if (!foundCurrentUADisplayScale) {
        foundCurrentUADisplayScale = true;
        return true;
      }
      return false;
    }
    return true;
  });

  while ((appSettingsObj.displayScaleByBrowser as unknown[]).length > MAX_BROWSER_UA) {
    (appSettingsObj.displayScaleByBrowser as unknown[]).shift();
  }
}

/**
 * GET /* SPA fallback
 *
 * 与 api.js:563-717 完全一致，包括：
 *   - 排除 /api/ 路径 + 含 . 的路径（静态资源）
 *   - 并行查 isAuthorized + app_settings
 *   - customCodeEnabled=true 时查 custom_header / custom_content
 *   - renderHTML(authorized, customHeader, customContent)
 */
staticApp.get('*', async (c) => {
  const url = new URL(c.req.url);

  // 排除 /api/ 路径 + 含 . 的路径（静态资源如 .js .css .png）
  // 这些路径返回 404（不再 fall through 到 legacy）
  if (url.pathname.startsWith('/api/') || url.pathname.includes('.')) {
    return c.json({ error: 'Not Found' }, 404);
  }

  return handleSpaFallback(c);
});

/**
 */
async function handleSpaFallback(c: import('hono').Context<V0AppEnv>): Promise<Response> {
  const env = c.env;
  const url = new URL(c.req.url);
  const request = c.req.raw;

  // 并行查鉴权 + app_settings
  const [authResult, settingsRecord] = await Promise.all([
    checkCookieAuth(request, env),
    env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first<{ value: string }>(),
  ]);

  // 类型收窄：checkCookieAuth 返回 union，需要 discriminant narrow
  const authorized = authResult.ok;
  const matchedSession = authorized ? (authResult as { ok: true; matched: SessionEntry; sessions: SessionEntry[] }).matched : null;
  const authSessions = authorized ? (authResult as { ok: true; matched: SessionEntry; sessions: SessionEntry[] }).sessions : [];

  let customHeader = '';
  let customContent = '';

  let appSettingsObj: Record<string, unknown> | null = null;
  if (settingsRecord && settingsRecord.value) {
    try {
      appSettingsObj = JSON.parse(settingsRecord.value);
    } catch {
      // 静默吞掉
    }
  }

  if (url.searchParams.get('preview') !== '1' && appSettingsObj && appSettingsObj.customCodeEnabled === true) {
    try {
      const customRecords = await env.DB.prepare(
        "SELECT key, value FROM settings WHERE key IN ('custom_header', 'custom_content')",
      ).all<{ key: string; value: string }>();
      if (customRecords.results) {
        for (const row of customRecords.results) {
          if (row.key === 'custom_header' && row.value) customHeader = row.value;
          if (row.key === 'custom_content' && row.value) customContent = row.value;
        }
      }
    } catch {
      // 静默吞掉
    }
  }

  if (authorized && matchedSession) {
    const currentUA = request.headers.get('User-Agent') || '';
    if (currentUA && matchedSession.ua !== currentUA) {
      const oldUA = matchedSession.ua;

      matchedSession.ua = currentUA;
      // 更新 sessions：保留当前 token 或 UA 不同的其他 session
      const updatedSessions = (authSessions as SessionEntry[]).filter(
        (s) => s.token === matchedSession.token || s.ua !== currentUA,
      );

      const batchStmts = [
        env.DB.prepare(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_session_token', ?)",
        ).bind(JSON.stringify(updatedSessions)),
      ];

      if (!appSettingsObj) appSettingsObj = {};

      // 复用提取的 UA 更新函数（逻辑与 api.js:610-703 完全一致）
      updateUaInArrays(appSettingsObj, oldUA, currentUA);

      batchStmts.push(
        env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)").bind(
          JSON.stringify(appSettingsObj),
        ),
      );

      await env.DB.batch(batchStmts);
    }
  }

  return new Response(renderHTML(authorized, customHeader, customContent), {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}
