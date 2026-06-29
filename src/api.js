/*
 * Cloudflare Worker + D1 Todo App - API Handler
 */

import {
  APP_VERSION,
  DB_SCHEMA,
  DEFAULT_CATEGORY_COLOR,
  MAX_BROWSER_UA,
  parseCookies,
  sign,
  verify,
  generateSessionToken,
  secureCompare,
  getDayOfWeek,
  formatDateStr,
  offsetDate,
  fetchHotSearchData,
  apiError,
  normalizePriority,
  parseJsonField,
  validateStatsDateRange
} from './utils.js';
import { renderHTML } from './html.js';
import {
  isOccurrenceOnDate,
  computeDeleteActions,
  computeUpdateActions,
  addExdate,
  removeExdate,
  getPreviousDate,
  getNextDate,
  sanitizeRRule,
  processRRule,
  validateType,
  validateDateFormat,
  validateTimeFormat,
  validateExdates,
  rruleFromLegacyFields,
  deriveLegacyFieldsFromRRule,
  previewOccurrences,
} from './recurring-engine.js';
import { handleV1Request, verifyApiKey, extractApiKey, getApiKeyScope } from './api-v1.js';

let isDbInitialized = false;

// D1 Free 限制 bound parameters/query = 100，部分 SQL 含额外参数（date/time_records），
// 留 1 个余量，chunk size 设为 99 防止 100+1=101 溢出。
const BATCH_CHUNK_SIZE = 99;
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
function sqlPlaceholders(count) {
  return Array.from({ length: count }, () => '?').join(',');
}

// v1.0 统一命名：所有 task 对象属性一律使用 snake_case `copy_text`（与 DB 列名 / API_Wiki §4.2 / V1 API 一致）。
// 历史 camelCase `copyText` 已废弃，不再兼容读取（v1.0 破坏性变更）。
function readCopyText(task) {
  if (!task) return '';
  return task.copy_text !== undefined ? task.copy_text : '';
}

// 同 date 的 GET /api/todos 串行化，避免并发展开重复事项实例。
// 仅同 isolate 内有效；跨 isolate 仍可能漏过。
const _todosDateChains = new Map();
function _withTodosDateLock(date, fn) {
  const prev = _todosDateChains.get(date) || Promise.resolve();
  const next = prev.then(fn, fn); // 失败也继续，不阻塞后续
  const tail = next.catch(() => {});
  _todosDateChains.set(date, tail);
  tail.then(() => setTimeout(() => {
    if (_todosDateChains.get(date) === tail) _todosDateChains.delete(date);
  }, 5000));
  return next;
}

async function handleRequest(request, env, ctx) {
    try {
    const url = new URL(request.url);
    const cookies = parseCookies(request);
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
    
    const isAuthorized = async () => {
      if (!cookies.auth_token || !cookies.auth_sig) return { ok: false };
    
      const sigValid = await verify(cookies.auth_token, cookies.auth_sig, env.JWT_SECRET);
      if (!sigValid) return { ok: false };
    
      const record = await env.DB.prepare(
        "SELECT value FROM settings WHERE key = 'active_session_token'"
      ).first();
      if (!record || !record.value) return { ok: false };
    
      let sessions;
      if (!record.value.startsWith('[')) {
        if (record.value !== cookies.auth_token) return { ok: false };
        sessions = [{ token: record.value, ua: '' }];
      } else {
        try {
          sessions = JSON.parse(record.value);
          if (!Array.isArray(sessions)) return { ok: false };
        } catch(e) { return { ok: false }; }
      }
    
      const matched = sessions.find(s => s.token === cookies.auth_token);
      if (!matched) return { ok: false };
    
      return { ok: true, matchedSession: matched, sessions };
    };

    const initDb = async () => {
      if (isDbInitialized) return;
      try {
        // 读取当前数据库 schema 版本（整数）
        let currentSchema = 0;
        try {
          const marker = await env.DB.prepare("SELECT value FROM settings WHERE key = 'db_schema_version'").first();
          if (marker && marker.value) currentSchema = parseInt(marker.value, 10) || 0;
        } catch (e) {}

        // 版本一致则跳过所有迁移
        if (currentSchema >= DB_SCHEMA) {
          isDbInitialized = true;
          return;
        }

        // ==================== 基础表结构（首次部署，v1.0 schema 1）====================
        // RFC 5545 RRULE 为重复规则唯一规范字段：
        // - type（none/fragment/recurring）+ rrule + anchor_date + exdates
        // - 无旧字段（repeat_type/repeat_custom/repeat_interval/repeat_end）残留
        await env.DB.batch([
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS todos (
              id TEXT PRIMARY KEY,
              parent_id TEXT NOT NULL,
              date TEXT NOT NULL,
              text TEXT NOT NULL,
              time TEXT,
              priority TEXT,
              desc TEXT,
              url TEXT,
              copy_text TEXT,
              subtasks TEXT,
              search_terms TEXT,
              done INTEGER NOT NULL DEFAULT 0,
              deleted INTEGER NOT NULL DEFAULT 0,
              type TEXT NOT NULL DEFAULT 'none',
              end_time TEXT DEFAULT '',
              category_id TEXT DEFAULT '',
              recurrence_id TEXT DEFAULT '',
              is_exception INTEGER NOT NULL DEFAULT 0,
              time_records TEXT NOT NULL DEFAULT '[]',
              fragment_anchor TEXT NOT NULL DEFAULT '',
              rrule TEXT NOT NULL DEFAULT '',
              anchor_date TEXT NOT NULL DEFAULT '',
              exdates TEXT NOT NULL DEFAULT '[]'
            )
          `),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)`),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)`),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_stats ON todos(date, deleted, priority, done, category_id, time)`),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_type ON todos(type)`),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS todo_templates (
              parent_id TEXT PRIMARY KEY,
              text TEXT, time TEXT, priority TEXT, desc TEXT, url TEXT,
              copy_text TEXT, subtasks TEXT, search_terms TEXT,
              type TEXT NOT NULL DEFAULT 'recurring',
              end_time TEXT DEFAULT '',
              anchor_date TEXT NOT NULL DEFAULT '',
              exdates TEXT DEFAULT '[]',
              category_id TEXT DEFAULT '',
              time_records TEXT NOT NULL DEFAULT '[]',
              rrule TEXT NOT NULL DEFAULT ''
            )
          `),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_templates_type ON todo_templates(type)`),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS login_attempts (
              ip TEXT PRIMARY KEY,
              attempts INTEGER NOT NULL DEFAULT 0,
              lock_until INTEGER NOT NULL DEFAULT 0
            )
          `),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT
            )
          `),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS import_sessions (
              id TEXT PRIMARY KEY,
              mode TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'active',
              started_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            )
          `),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS export_sessions (
              id TEXT PRIMARY KEY,
              status TEXT NOT NULL DEFAULT 'active',
              inc_todos INTEGER NOT NULL DEFAULT 0,
              inc_trash INTEGER NOT NULL DEFAULT 0,
              inc_settings INTEGER NOT NULL DEFAULT 0,
              total_todos INTEGER NOT NULL DEFAULT 0,
              total_templates INTEGER NOT NULL DEFAULT 0,
              todos_cursor TEXT NOT NULL DEFAULT '',
              templates_cursor TEXT NOT NULL DEFAULT '',
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            )
          `),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS categories (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              color TEXT NOT NULL DEFAULT '#888888'
            )
          `),
        ]);

        // 写入当前 schema 版本号（整数）
        await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('db_schema_version', ?)").bind(String(DB_SCHEMA)).run();
        isDbInitialized = true;
      } catch (e) {
        console.error("DB Init error:", e);
      }
    };

    await initDb();

    //  统一 API 鉴权拦截（支持 API Key 或 Cookie）
    const publicApiPaths = ['/api/login', '/api/logout', '/api/hot-search'];
    const isApiRequest = url.pathname.startsWith('/api/');
    const isV1Request = url.pathname.startsWith('/api/v1/');
    if (isApiRequest && !publicApiPaths.includes(url.pathname) && !isV1Request) {
      // 优先检查 API Key
      const apiKey = extractApiKey(request, url);
      if (apiKey) {
        const valid = await verifyApiKey(env.DB, apiKey, env.JWT_SECRET);
        if (!valid) return apiError("UNAUTHORIZED", 401);
        // 检查 API Key 作用域
        const scope = await getApiKeyScope(env.DB);
        if (scope === 'disabled') return apiError("API Key 已被禁用", 403);
        if (scope === 'v1') return apiError("API Key 仅允许访问 v1 接口", 403);
      } else {
        // 无 API Key，回退到 Cookie 鉴权
        const { ok: apiAuthed } = await isAuthorized();
        if (!apiAuthed) return apiError("UNAUTHORIZED", 401);
      }
    }

    // v1 RESTful API（自带鉴权：API Key 或 Cookie）
    if (isV1Request) {
      const v1Result = await handleV1Request(request, env, ctx);
      if (v1Result) return v1Result;
      return apiError('Not Found', 404);
    }
    
    if (url.pathname === '/api/login' && request.method === 'POST') {
      const now = Date.now();
      
      const attemptRecord = await env.DB.prepare('SELECT * FROM login_attempts WHERE ip = ?').bind(clientIp).first();
      if (attemptRecord && attemptRecord.lock_until > now) {
        return apiError("ACCOUNT LOCKED", 429);
      }

      const { password } = await (async () => { try { return await request.json(); } catch(e) { return {}; } })();
      const isAdmin = await secureCompare(password, env.ADMIN_PASSWORD, env.JWT_SECRET);

      if (isAdmin) {
        await env.DB.prepare(`
          INSERT INTO login_attempts (ip, attempts, lock_until) VALUES (?, 0, 0) 
          ON CONFLICT(ip) DO UPDATE SET attempts = 0, lock_until = 0
        `).bind(clientIp).run();
    
        const loginUA = request.headers.get('User-Agent') || '';
        
        let sessions = [];
        const sessionRecord = await env.DB.prepare(
          "SELECT value FROM settings WHERE key = 'active_session_token'"
        ).first();
        if (sessionRecord && sessionRecord.value) {
          try {
            const parsed = JSON.parse(sessionRecord.value);
            if (Array.isArray(parsed)) sessions = parsed;
          } catch(e) { sessions = []; }
        }
        
        const token = generateSessionToken();
        const sig = await sign(token, env.JWT_SECRET);
        
        sessions = sessions.filter(s => s.ua !== loginUA);
        sessions.push({ token, ua: loginUA });
        while (sessions.length > MAX_BROWSER_UA) sessions.shift();
        
        await env.DB.prepare(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_session_token', ?)"
        ).bind(JSON.stringify(sessions)).run();
        
        if (loginUA) {
          const appSettingsRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
          let appSettingsObj = {};
          if (appSettingsRecord && appSettingsRecord.value) {
            try { appSettingsObj = JSON.parse(appSettingsRecord.value); } catch(e) {}
          }
          if (!Array.isArray(appSettingsObj.scaleByBrowser)) {
            appSettingsObj.scaleByBrowser = [];
          }
          if (!Array.isArray(appSettingsObj.fontSizeByBrowser)) {
            appSettingsObj.fontSizeByBrowser = [];
          }
          if (!Array.isArray(appSettingsObj.displayScaleByBrowser)) {
            appSettingsObj.displayScaleByBrowser = [];
          }
          let uaExists = false;
          for (let i = 0; i < appSettingsObj.scaleByBrowser.length; i++) {
            if (appSettingsObj.scaleByBrowser[i].ua === loginUA) {
              uaExists = true;
              break;
            }
          }
          if (!uaExists) {
            appSettingsObj.scaleByBrowser.push({ ua: loginUA, scale: 1.0 });
            while (appSettingsObj.scaleByBrowser.length > MAX_BROWSER_UA) {
              appSettingsObj.scaleByBrowser.shift();
            }
          }
          let uaExistsFontSize = false;
          for (let i = 0; i < appSettingsObj.fontSizeByBrowser.length; i++) {
            if (appSettingsObj.fontSizeByBrowser[i].ua === loginUA) {
              uaExistsFontSize = true;
              break;
            }
          }
          if (!uaExistsFontSize) {
            appSettingsObj.fontSizeByBrowser.push({ ua: loginUA, fontSize: 16 });
            while (appSettingsObj.fontSizeByBrowser.length > MAX_BROWSER_UA) {
              appSettingsObj.fontSizeByBrowser.shift();
            }
          }
          let uaExistsDisplayScale = false;
          for (let i = 0; i < appSettingsObj.displayScaleByBrowser.length; i++) {
            if (appSettingsObj.displayScaleByBrowser[i].ua === loginUA) {
              uaExistsDisplayScale = true;
              break;
            }
          }
          if (!uaExistsDisplayScale) {
            appSettingsObj.displayScaleByBrowser.push({ ua: loginUA, displayScale: 1.0 });
            while (appSettingsObj.displayScaleByBrowser.length > MAX_BROWSER_UA) {
              appSettingsObj.displayScaleByBrowser.shift();
            }
          }
          await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)")
            .bind(JSON.stringify(appSettingsObj)).run();
        }

        const headers = new Headers();
        headers.append('Set-Cookie', `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
        headers.append('Set-Cookie', `auth_sig=${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
        return new Response(JSON.stringify({ success: true }), { headers });
      } else {
        await env.DB.prepare(`
          INSERT INTO login_attempts (ip, attempts, lock_until) VALUES (?, 1, 0) 
          ON CONFLICT(ip) DO UPDATE SET 
            attempts = attempts + 1,
            lock_until = CASE WHEN attempts + 1 >= 5 THEN ? ELSE 0 END
        `).bind(clientIp, now + 15 * 60 * 1000).run();
        
        return apiError("ACCESS DENIED", 401);
      }
    }
    
    if (url.pathname === '/api/logout' && request.method === 'POST') {
      if (cookies.auth_token) {
        const record = await env.DB.prepare(
          "SELECT value FROM settings WHERE key = 'active_session_token'"
        ).first();
        if (record && record.value) {
          try {
            let sessions = [];
            try {
              const parsed = JSON.parse(record.value);
              if (Array.isArray(parsed)) sessions = parsed;
            } catch(e) {}
            if (sessions.length > 0) {
              sessions = sessions.filter(s => s.token !== cookies.auth_token);
              if (sessions.length > 0) {
                await env.DB.prepare(
                  "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_session_token', ?)"
                ).bind(JSON.stringify(sessions)).run();
              } else {
                await env.DB.prepare(
                  "DELETE FROM settings WHERE key = 'active_session_token'"
                ).run();
              }
            }
          } catch(e) {}
        }
      }
      const headers = new Headers();
      headers.append('Set-Cookie', `auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
      headers.append('Set-Cookie', `auth_sig=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // PWA: Web App Manifest
    if (url.pathname === '/manifest.json' && request.method === 'GET') {
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
          { src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="80" fill="#0a0a0a"/><rect x="60" y="60" width="392" height="392" rx="40" fill="none" stroke="%23ff3300" stroke-width="16"/><path d="M160 256l50 50 142-142" fill="none" stroke="%2300ff41" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></svg>'), sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="30" fill="#0a0a0a"/><rect x="22" y="22" width="148" height="148" rx="15" fill="none" stroke="%23ff3300" stroke-width="6"/><path d="M60 96l19 19 53-53" fill="none" stroke="%2300ff41" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>'), sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      };
      return new Response(JSON.stringify(manifest), {
        headers: { 'Content-Type': 'application/manifest+json' }
      });
    }

    // PWA: Service Worker
    if (url.pathname === '/sw.js' && request.method === 'GET') {
      // CACHE_NAME 跟随 APP_VERSION：版本升级 → 新 SW activate 时自动清理旧缓存
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
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    // SPA: serve the same HTML for all non-API GET requests
    const isSpaRoute = request.method === 'GET' && !url.pathname.startsWith('/api/') && !url.pathname.includes('.');
    if (isSpaRoute) {
      const [authResult, settingsRecord] = await Promise.all([
        isAuthorized(),
        env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first()
      ]);
      const { ok: authorized, matchedSession, sessions: authSessions } = authResult;
    
      let customHeader = '';
      let customContent = '';
        
      let appSettingsObj = null;
      if (settingsRecord && settingsRecord.value) {
        try { appSettingsObj = JSON.parse(settingsRecord.value); } catch (e) {}
      }
        
       if (url.searchParams.get('preview') !== '1' && appSettingsObj && appSettingsObj.customCodeEnabled === true) {
        try {
          const customRecords = await env.DB.prepare(
            "SELECT key, value FROM settings WHERE key IN ('custom_header', 'custom_content')"
          ).all();
          if (customRecords.results) {
            for (const row of customRecords.results) {
              if (row.key === 'custom_header' && row.value) customHeader = row.value;
              if (row.key === 'custom_content' && row.value) customContent = row.value;
            }
          }
        } catch (e) {}
      }
    
      if (authorized && matchedSession) {
        const currentUA = request.headers.get('User-Agent') || '';
        if (currentUA && matchedSession.ua !== currentUA) {
          const oldUA = matchedSession.ua;
          
          matchedSession.ua = currentUA;
          const updatedSessions = authSessions.filter(s => 
            s.token === matchedSession.token || s.ua !== currentUA
          );
    
          const batchStmts = [
            env.DB.prepare(
              "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_session_token', ?)"
            ).bind(JSON.stringify(updatedSessions))
          ];
    
          if (!appSettingsObj) appSettingsObj = {};
          if (!Array.isArray(appSettingsObj.scaleByBrowser)) {
            appSettingsObj.scaleByBrowser = [];
          }
          if (!Array.isArray(appSettingsObj.fontSizeByBrowser)) {
            appSettingsObj.fontSizeByBrowser = [];
          }
          if (!Array.isArray(appSettingsObj.displayScaleByBrowser)) {
            appSettingsObj.displayScaleByBrowser = [];
          }

          let replaced = false;
          for (let i = 0; i < appSettingsObj.scaleByBrowser.length; i++) {
            if (appSettingsObj.scaleByBrowser[i].ua === oldUA) {
              appSettingsObj.scaleByBrowser[i].ua = currentUA;
              replaced = true;
              break;
            }
          }
          if (!replaced) {
            appSettingsObj.scaleByBrowser.push({ ua: currentUA, scale: 1.0 });
          }

          let foundCurrentUA = false;
          appSettingsObj.scaleByBrowser = appSettingsObj.scaleByBrowser.filter(s => {
            if (s.ua === currentUA) {
              if (!foundCurrentUA) {
                foundCurrentUA = true;
                return true;
              }
              return false;
            }
            return true;
          });

          while (appSettingsObj.scaleByBrowser.length > MAX_BROWSER_UA) {
            appSettingsObj.scaleByBrowser.shift();
          }

          let replacedFontSize = false;
          for (let i = 0; i < appSettingsObj.fontSizeByBrowser.length; i++) {
            if (appSettingsObj.fontSizeByBrowser[i].ua === oldUA) {
              appSettingsObj.fontSizeByBrowser[i].ua = currentUA;
              replacedFontSize = true;
              break;
            }
          }
          if (!replacedFontSize) {
            appSettingsObj.fontSizeByBrowser.push({ ua: currentUA, fontSize: 16 });
          }

          let foundCurrentUAFontSize = false;
          appSettingsObj.fontSizeByBrowser = appSettingsObj.fontSizeByBrowser.filter(s => {
            if (s.ua === currentUA) {
              if (!foundCurrentUAFontSize) {
                foundCurrentUAFontSize = true;
                return true;
              }
              return false;
            }
            return true;
          });

          while (appSettingsObj.fontSizeByBrowser.length > MAX_BROWSER_UA) {
            appSettingsObj.fontSizeByBrowser.shift();
          }

          let replacedDisplayScale = false;
          for (let i = 0; i < appSettingsObj.displayScaleByBrowser.length; i++) {
            if (appSettingsObj.displayScaleByBrowser[i].ua === oldUA) {
              appSettingsObj.displayScaleByBrowser[i].ua = currentUA;
              replacedDisplayScale = true;
              break;
            }
          }
          if (!replacedDisplayScale) {
            appSettingsObj.displayScaleByBrowser.push({ ua: currentUA, displayScale: 1.0 });
          }

          let foundCurrentUADisplayScale = false;
          appSettingsObj.displayScaleByBrowser = appSettingsObj.displayScaleByBrowser.filter(s => {
            if (s.ua === currentUA) {
              if (!foundCurrentUADisplayScale) {
                foundCurrentUADisplayScale = true;
                return true;
              }
              return false;
            }
            return true;
          });

          while (appSettingsObj.displayScaleByBrowser.length > MAX_BROWSER_UA) {
            appSettingsObj.displayScaleByBrowser.shift();
          }
    
          batchStmts.push(
            env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)")
              .bind(JSON.stringify(appSettingsObj))
          );
    
          await env.DB.batch(batchStmts);
        }
      }
    
      return new Response(renderHTML(authorized, customHeader, customContent), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }


    if (url.pathname === '/api/sessions' && request.method === 'GET') {
      const record = await env.DB.prepare(
        "SELECT value FROM settings WHERE key = 'active_session_token'"
      ).first();
      let sessions = [];
      if (record && record.value) {
        try {
          const parsed = JSON.parse(record.value);
          if (Array.isArray(parsed)) sessions = parsed;
        } catch(e) {}
      }
      const clientUA = request.headers.get('User-Agent') || '';
      const safeSessions = sessions.map(s => ({
        ua: s.ua,
        disabled: s.disabled || false,
        isCurrent: s.ua === clientUA
      }));
      return new Response(JSON.stringify(safeSessions), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/session-action' && request.method === 'POST') {
      let sessionParsedBody;
      try {
        sessionParsedBody = await request.json();
      } catch(e) {
        return apiError('请求体不是有效的 JSON', 400);
      }
      const { action, ua } = sessionParsedBody;
      if (!action || !['DELETE', 'DELETE_ALL'].includes(action)) {
        return apiError('action 必须为 DELETE 或 DELETE_ALL', 400);
      }
      if (action === 'DELETE' && (!ua || typeof ua !== 'string')) {
        return apiError('DELETE 操作需要 ua 参数', 400);
      }
      const record = await env.DB.prepare(
        "SELECT value FROM settings WHERE key = 'active_session_token'"
      ).first();
      let sessions = [];
      if (record && record.value) {
        try {
          const parsed = JSON.parse(record.value);
          if (Array.isArray(parsed)) sessions = parsed;
        } catch(e) {}
      }

      if (action === 'DELETE' && ua) {
        sessions = sessions.filter(s => s.ua !== ua);
      } else if (action === 'DELETE_ALL') {
        sessions = [];
      }

      if (sessions.length > 0) {
        await env.DB.prepare(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_session_token', ?)"
        ).bind(JSON.stringify(sessions)).run();
      } else {
        await env.DB.prepare(
          "DELETE FROM settings WHERE key = 'active_session_token'"
        ).run();
      }

      // 同步清理 scaleByBrowser / fontSizeByBrowser / displayScaleByBrowser 中被删除的 UA
      if (action === 'DELETE' || action === 'DELETE_ALL') {
        try {
          const appSettingsRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
          if (appSettingsRecord && appSettingsRecord.value) {
            let appSettingsObj = JSON.parse(appSettingsRecord.value);
            const remainingUAs = sessions.map(s => s.ua);
            let changed = false;
            if (Array.isArray(appSettingsObj.scaleByBrowser)) {
              if (action === 'DELETE_ALL') {
                appSettingsObj.scaleByBrowser = [];
              } else {
                appSettingsObj.scaleByBrowser = appSettingsObj.scaleByBrowser.filter(item => remainingUAs.includes(item.ua));
              }
              changed = true;
            }
            if (Array.isArray(appSettingsObj.fontSizeByBrowser)) {
              if (action === 'DELETE_ALL') {
                appSettingsObj.fontSizeByBrowser = [];
              } else {
                appSettingsObj.fontSizeByBrowser = appSettingsObj.fontSizeByBrowser.filter(item => remainingUAs.includes(item.ua));
              }
              changed = true;
            }
            if (Array.isArray(appSettingsObj.displayScaleByBrowser)) {
              if (action === 'DELETE_ALL') {
                appSettingsObj.displayScaleByBrowser = [];
              } else {
                appSettingsObj.displayScaleByBrowser = appSettingsObj.displayScaleByBrowser.filter(item => remainingUAs.includes(item.ua));
              }
              changed = true;
            }
            if (changed) {
              await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)")
                .bind(JSON.stringify(appSettingsObj)).run();
            }
          }
        } catch(e) {}
      }

      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    if (url.pathname === '/api/custom-code' && request.method === 'GET') {
      const headerRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_header'").first();
      const contentRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_content'").first();
      return new Response(JSON.stringify({
        customHeader: headerRecord?.value || '',
        customContent: contentRecord?.value || ''
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    if (url.pathname === '/api/custom-code' && request.method === 'POST') {
      let ccBody;
      try { ccBody = await request.json(); } catch(e) { return apiError('请求体不是有效的 JSON', 400); }
      const { customHeader, customContent } = ccBody;
      const stmts = [];
      if (customHeader !== undefined) {
        stmts.push(env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_header', ?)").bind(customHeader));
      }
      if (customContent !== undefined) {
        stmts.push(env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_content', ?)").bind(customContent));
      }
      if (stmts.length > 0) {
        await env.DB.batch(stmts);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/api/hot-search' && request.method === 'GET') {
      const provider = url.searchParams.get('provider') || 'auto';
      // 注：hot-search 不做服务端缓存，保证实时性（用户主动点「换一批」、创建带热搜的 todo 都需要最新数据）
      // fetchHotSearchData 内部已有 5s 超时 + 失败降级，足够健壮
      const all_words = await fetchHotSearchData(provider);
      return new Response(JSON.stringify({ success: true, data: all_words }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/api/stats' && request.method === 'GET') {
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');
      const rangeCheck = validateStatsDateRange(start, end);
      if (!rangeCheck.ok) return apiError(rangeCheck.error, 400);

      // 服务端聚合：D1 batch 一次往返跑 6 条 GROUP BY，把数万行原始数据压缩为几十行聚合结果。
      // 收益：rows returned / 网络字节 / Worker 内存 / 客户端解析 全部从 O(N) 降为 O(log N)。
      // 索引依赖：idx_todos_stats(date, deleted, priority, done, category_id, time) covering index。
      // 注意：D1 batch 顺序执行（非并行），但只占一次 HTTP 往返。
      // 统计 WHERE 子句（优化版，语义与原版完全等价）
      // 原版 3 个 OR 子句触发 SQLite MULTI-INDEX OR（5 次索引扫描），50k 行 47ms 超 Free 10ms 限制
      // 优化：合并普通 todo + fragment 已完成（都是 date 在范围），fragment 未完成浮动单独 OR
      // 等价证明见 V1 handleV1Stats 注释；实测 50k 行年度报告：47ms → 13ms（72% 提升）
      const baseWhere = `FROM todos WHERE deleted = 0 AND (
        (date >= ?1 AND date <= ?2)
        OR (date = '' AND type = 'fragment' AND done = 0)
      )`;

      const batchResults = await env.DB.batch([
        // 1) 按日期聚合：dailyCounts[date] = { total, done }
        // 碎时记 date='' 的归到 end 日（浮动事项在 end 日可见）
        env.DB.prepare(
          `SELECT COALESCE(NULLIF(date, ''), ?2) AS date, COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done ${baseWhere} GROUP BY COALESCE(NULLIF(date, ''), ?2)`
        ).bind(start, end),
        // 2) 按 分类聚合：categoryCounts[category_id] = { total, done }（空 category_id 归为 ''）
        env.DB.prepare(
          `SELECT COALESCE(NULLIF(category_id, ''), '') AS category_id, COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done ${baseWhere} GROUP BY COALESCE(NULLIF(category_id, ''), '')`
        ).bind(start, end),
        // 3) 按 优先级 × 完成度 聚合：4 个组合
        env.DB.prepare(
          `SELECT priority, done, COUNT(*) AS cnt ${baseWhere} GROUP BY priority, done`
        ).bind(start, end),
        // 4) 按周日 × 完成度聚合：用于年度报告工作日 vs 周末完成率对比（精确值）
        //    strftime('%w', date) 对 ISO8601 日期字符串返回 '0'-'6'（0=周日）
        //    碎时记 date='' 的归到 end 日对应的周日
        env.DB.prepare(
          `SELECT CAST(strftime('%w', COALESCE(NULLIF(date, ''), ?2)) AS INTEGER) AS weekday, done, COUNT(*) AS cnt ${baseWhere} GROUP BY weekday, done`
        ).bind(start, end),
        // 5) 按时段聚合：hourBuckets[0..3]（0=凌晨0-6, 1=上午6-12, 2=下午12-18, 3=晚上18-24）
        //    time 字段为 'HH:MM' 文本，取前两位转 int 后分桶
        //    用 CASE WHEN 在 SQL 里直接算出 bucket，比拉回 JS 算更省传输
        env.DB.prepare(
          `SELECT CASE` +
          ` WHEN time IS NULL OR time = '' THEN -1` +
          ` WHEN CAST(substr(time, 1, 2) AS INTEGER) < 6 THEN 0` +
          ` WHEN CAST(substr(time, 1, 2) AS INTEGER) < 12 THEN 1` +
          ` WHEN CAST(substr(time, 1, 2) AS INTEGER) < 18 THEN 2` +
          ` ELSE 3 END AS bucket,` +
          ` COUNT(*) AS cnt ${baseWhere} GROUP BY bucket`
        ).bind(start, end),
        // 6) 总量汇总：total / done / undone / activeDays
        //    active_days 排除 date='' 的浮动碎时记（它们不属于具体日期）
        env.DB.prepare(
          `SELECT COUNT(*) AS total,` +
          ` SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done,` +
          ` SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END) AS undone,` +
          ` COUNT(DISTINCT CASE WHEN date = '' THEN NULL ELSE date END) AS active_days ${baseWhere}`
        ).bind(start, end),
      ]);

      // 组装响应：保持紧凑，字段名与前端 _aggregate 一致
      const dailyCounts = {};
      for (const r of (batchResults[0].results || [])) {
        dailyCounts[r.date] = { total: r.total, done: r.done };
      }
      const categoryCounts = {};
      let noCategoryCount = { total: 0, done: 0 };
      for (const r of (batchResults[1].results || [])) {
        if (r.category_id === '') {
          noCategoryCount = { total: r.total, done: r.done };
        } else {
          categoryCounts[r.category_id] = { total: r.total, done: r.done };
        }
      }
      // 优先级 × 完成度
      const priCounts = { high: 0, med: 0, low: 0 };
      const priDone = { high: 0, med: 0, low: 0 };
      for (const r of (batchResults[2].results || [])) {
        const p = (r.priority === 'high' || r.priority === 'med' || r.priority === 'low') ? r.priority : 'low';
        priCounts[p] += r.cnt;
        if (r.done === 1) priDone[p] += r.cnt;
      }
      // 周日分布：weekdayCounts[0..6] 总数 + weekdayDone[0..6] 完成数
      const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
      const weekdayDone = [0, 0, 0, 0, 0, 0, 0];
      for (const r of (batchResults[3].results || [])) {
        if (r.weekday >= 0 && r.weekday <= 6) {
          weekdayCounts[r.weekday] += r.cnt;
          if (r.done === 1) weekdayDone[r.weekday] += r.cnt;
        }
      }
      // 时段分布：默认 0；bucket = -1 表示无 time 字段，不计入任何桶
      const hourBuckets = [0, 0, 0, 0];
      for (const r of (batchResults[4].results || [])) {
        if (r.bucket >= 0 && r.bucket <= 3) hourBuckets[r.bucket] = r.cnt;
      }
      // 总量
      const summary = (batchResults[5].results || [])[0] || { total: 0, done: 0, undone: 0, active_days: 0 };

      const payload = {
        aggregated: true,
        range: { start, end },
        summary: {
          total: summary.total || 0,
          done: summary.done || 0,
          undone: summary.undone || 0,
          activeDays: summary.active_days || 0,
        },
        dailyCounts,
        categoryCounts,
        noCategoryCount,
        priCounts,
        priDone,
        weekdayCounts,
        weekdayDone,
        hourBuckets,
      };
      return new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/api/export' && request.method === 'GET') {
      const mode = url.searchParams.get('mode');

      if (mode === 'page') {
        const type = url.searchParams.get('type') || 'todos';
        const cursor = url.searchParams.get('cursor') || '';
        const sessionId = url.searchParams.get('sessionId') || '';
        const PAGE_SIZE = 500;
        const incTodos = url.searchParams.get('todos') === 'true';
        const incTrash = url.searchParams.get('trash') === 'true';

        let condition = "1=0";
        if (type === 'todos') {
          if (incTodos && incTrash) condition = "1=1";
          else if (incTodos) condition = "deleted = 0";
          else if (incTrash) condition = "deleted = 1";
        } else {
          condition = "1=1";
        }

        const tableName = type === 'templates' ? 'todo_templates' : 'todos';
        let cursorCondition = '';
        let cursorParams = [];
        if (cursor) {
          if (type === 'todos') {
            const parts = cursor.split(':');
            const cursorDate = parts[0] || '';
            const cursorDeleted = parts[1] === '1' ? 1 : 0;
            const cursorId = parts.slice(2).join(':');
            cursorCondition = ` AND (date > ? OR (date = ? AND deleted > ?) OR (date = ? AND deleted = ? AND id > ?))`;
            cursorParams = [cursorDate, cursorDate, cursorDeleted, cursorDate, cursorDeleted, cursorId];
          } else {
            cursorCondition = ` AND parent_id > ?`;
            cursorParams = [cursor];
          }
        }

        const orderBy = type === 'todos'
          ? 'date ASC, deleted ASC, id ASC'
          : 'parent_id ASC';

        const dataRes = await env.DB.prepare(
          `SELECT * FROM ${tableName} WHERE ${condition}${cursorCondition} ORDER BY ${orderBy} LIMIT ?`
        ).bind(...cursorParams, PAGE_SIZE).all();

        const rows = dataRes.results || [];
        let nextCursor = '';
        const hasMore = rows.length === PAGE_SIZE;
        if (hasMore) {
          const last = rows[rows.length - 1];
          nextCursor = type === 'todos'
            ? `${last.date}:${last.deleted}:${last.id}`
            : last.parent_id;
        } else if (sessionId && url.searchParams.get('final') === 'true') {
          ctx.waitUntil(env.DB.prepare('DELETE FROM export_sessions WHERE id = ?').bind(sessionId).run().catch(() => {}));
        }

        const lines = [];
        for (const row of rows) {
          lines.push(JSON.stringify(type === 'templates' ? { _type: 'template', ...row } : row));
        }
        if (hasMore) {
          lines.push(JSON.stringify({ _type: 'page_info', cursor: nextCursor, hasMore: true }));
        } else {
          lines.push(JSON.stringify({ _type: 'page_info', cursor: '', hasMore: false }));
        }
        const body = 'ndjson\n' + lines.join('\n') + '\n';

        return new Response(body, {
          headers: { 'Content-Type': 'application/x-ndjson' }
        });
      }

      if (mode === 'session') {
        const action = url.searchParams.get('action') || 'create';
        const sessionId = url.searchParams.get('sessionId');

        if (action === 'create') {
          const incTodos = url.searchParams.get('todos') === 'true' ? 1 : 0;
          const incTrash = url.searchParams.get('trash') === 'true' ? 1 : 0;
          const incSettings = url.searchParams.get('settings') === 'true' ? 1 : 0;
          const incCategories = url.searchParams.get('categories') === 'true' ? 1 : 0;
          const id = sessionId || crypto.randomUUID();
          const now = Date.now();

          let todoCondition = "1=0";
          if (incTodos && incTrash) todoCondition = "1=1";
          else if (incTodos) todoCondition = "deleted = 0";
          else if (incTrash) todoCondition = "deleted = 1";

          const hasTodoData = incTodos || incTrash;
          const [todoExistsRes, tplExistsRes] = hasTodoData ? await Promise.all([
            env.DB.prepare(`SELECT 1 FROM todos WHERE ${todoCondition} LIMIT 1`).first(),
            incTodos ? env.DB.prepare('SELECT 1 FROM todo_templates LIMIT 1').first() : Promise.resolve(null)
          ]) : [null, null];

          const EXPORT_TIMEOUT = 10 * 60 * 1000;
          const oldSession = await env.DB.prepare('SELECT * FROM export_sessions WHERE status = ?').bind('active').first();
          if (oldSession) {
            if ((now - oldSession.updated_at) < EXPORT_TIMEOUT) {
              return apiError('存在进行中的导出会话', 409, { conflict: true, sessionId: oldSession.id });
            }
            await env.DB.prepare('DELETE FROM export_sessions WHERE id = ?').bind(oldSession.id).run();
          }

          const staleSessions = await env.DB.prepare('SELECT id FROM export_sessions WHERE updated_at < ?').bind(now - EXPORT_TIMEOUT).all();
          if (staleSessions.results && staleSessions.results.length > 0) {
            await env.DB.prepare('DELETE FROM export_sessions WHERE updated_at < ?').bind(now - EXPORT_TIMEOUT).run();
          }

          await env.DB.prepare(
            'INSERT INTO export_sessions (id, status, inc_todos, inc_trash, inc_settings, todos_cursor, templates_cursor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(id, 'active', incTodos, incTrash, incSettings, '', '', now, now).run();

          return new Response(JSON.stringify({
            sessionId: id,
            hasData: !!(todoExistsRes || tplExistsRes || incSettings || incCategories)
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (action === 'update' && sessionId) {
          const session = await env.DB.prepare('SELECT * FROM export_sessions WHERE id = ? AND status = ?').bind(sessionId, 'active').first();
          if (!session) return apiError('Session not found or not active', 404);
          const todosCursor = url.searchParams.get('todosCursor');
          const templatesCursor = url.searchParams.get('templatesCursor');
          const now = Date.now();
          if (todosCursor !== null) {
            await env.DB.prepare('UPDATE export_sessions SET todos_cursor = ?, updated_at = ? WHERE id = ?').bind(todosCursor, now, sessionId).run();
          }
          if (templatesCursor !== null) {
            await env.DB.prepare('UPDATE export_sessions SET templates_cursor = ?, updated_at = ? WHERE id = ?').bind(templatesCursor, now, sessionId).run();
          }
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (action === 'status' && sessionId) {
          const session = await env.DB.prepare('SELECT * FROM export_sessions WHERE id = ?').bind(sessionId).first();
          if (!session) {
            return apiError('Session not found', 404);
          }
          return new Response(JSON.stringify({
            sessionId: session.id,
            status: session.status,
            todosCursor: session.todos_cursor,
            templatesCursor: session.templates_cursor
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (action === 'done' && sessionId) {
          await env.DB.prepare('DELETE FROM export_sessions WHERE id = ?').bind(sessionId).run();
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (action === 'abort' && sessionId) {
          await env.DB.prepare('DELETE FROM export_sessions WHERE id = ?').bind(sessionId).run();
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        return apiError("Invalid session action", 400);
      }

      if (mode === 'stream') {
        const sessionId = url.searchParams.get('sessionId');
        let todosCursor = url.searchParams.get('todosCursor') || '';
        let templatesCursor = url.searchParams.get('templatesCursor') || '';
        let todosDone = todosCursor === '__done__';
        let templatesDone = templatesCursor === '__done__';
        const skipHeader = url.searchParams.get('skipHeader') === 'true';
        const incTodos = url.searchParams.get('todos') === 'true';
        const incTrash = url.searchParams.get('trash') === 'true';
        const incSettings = url.searchParams.get('settings') === 'true';
        const incCategories = url.searchParams.get('categories') === 'true';
        const STREAM_PAGE_SIZE = 500;
        const SESSION_UPDATE_INTERVAL = 5;
        const MAX_QUERIES_PER_INVOCATION = 45;

        let todoCondition = "1=0";
        if (incTodos && incTrash) todoCondition = "1=1";
        else if (incTodos) todoCondition = "deleted = 0";
        else if (incTrash) todoCondition = "deleted = 1";

        const encoder = new TextEncoder();
        let pageCount = 0;
        let queryCount = 0;
        let headerEmitted = skipHeader;
        let continuationEmitted = false;

        function buildTodoCursorCondition(cursor) {
          if (!cursor) return { sql: '', params: [] };
          const parts = cursor.split(':');
          const cursorDate = parts[0] || '';
          const cursorDeleted = parts[1] === '1' ? 1 : 0;
          const cursorId = parts.slice(2).join(':');
          return {
            sql: ` AND (date > ? OR (date = ? AND deleted > ?) OR (date = ? AND deleted = ? AND id > ?))`,
            params: [cursorDate, cursorDate, cursorDeleted, cursorDate, cursorDeleted, cursorId]
          };
        }

        function encodeNdjsonLine(obj) {
          return JSON.stringify(obj) + '\n';
        }

        function enqueueBatch(controller, rows, mapper) {
          if (rows.length === 0) return;
          const chunk = rows.map(mapper || (r => JSON.stringify(r) + '\n')).join('');
          controller.enqueue(encoder.encode(chunk));
        }

        function emitContinuation(controller) {
          continuationEmitted = true;
          controller.enqueue(encoder.encode(encodeNdjsonLine({
            _type: 'continuation',
            todosCursor: todosDone ? '__done__' : todosCursor,
            templatesCursor: templatesDone ? '__done__' : templatesCursor,
            hasMore: true
          })));
        }

        const stream = new ReadableStream({
          async pull(controller) {
            try {
              if (continuationEmitted) {
                controller.close();
                return;
              }

              if (!headerEmitted) {
                controller.enqueue(encoder.encode('ndjson\n'));
                if (incSettings) {
                  const [settingsRes, headerRes, contentRes, customColorsRes] = await env.DB.batch([
                    env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'"),
                    env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_header'"),
                    env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_content'"),
                    env.DB.prepare("SELECT value FROM settings WHERE key = 'customColors'"),
                  ]);
                  queryCount++;
                  const settingsRecord = settingsRes.results?.[0];
                  let settingsObj = {};
                  try { settingsObj = settingsRecord?.value ? JSON.parse(settingsRecord.value) : {}; } catch(e) {}
                  controller.enqueue(encoder.encode(encodeNdjsonLine({ _type: 'settings', data: settingsObj })));

                  const headerRecord = headerRes.results?.[0];
                  controller.enqueue(encoder.encode(encodeNdjsonLine({ _type: 'custom_header', data: headerRecord?.value || '' })));

                  const contentRecord = contentRes.results?.[0];
                  controller.enqueue(encoder.encode(encodeNdjsonLine({ _type: 'custom_content', data: contentRecord?.value || '' })));

                  const customColorsRecord = customColorsRes.results?.[0];
                  let customColorsArr = [];
                  try { customColorsArr = customColorsRecord?.value ? JSON.parse(customColorsRecord.value) : []; } catch(e) {}
                  controller.enqueue(encoder.encode(encodeNdjsonLine({ _type: 'customColors', data: customColorsArr })));
                }
                if (incCategories) {
                  const { results: catRes } = await env.DB.prepare('SELECT id, name, color FROM categories ORDER BY id').all();
                  queryCount++;
                  controller.enqueue(encoder.encode(encodeNdjsonLine({ _type: 'categories', data: catRes || [] })));
                }
                headerEmitted = true;
              }

              if (!todosDone) {
                if (queryCount >= MAX_QUERIES_PER_INVOCATION) {
                  emitContinuation(controller);
                  return;
                }
                const cc = buildTodoCursorCondition(todosCursor);
                const dataRes = await env.DB.prepare(
                  `SELECT * FROM todos WHERE ${todoCondition}${cc.sql} ORDER BY date ASC, deleted ASC, id ASC LIMIT ?`
                ).bind(...cc.params, STREAM_PAGE_SIZE).all();
                queryCount++;
                const rows = dataRes.results || [];

                enqueueBatch(controller, rows);

                pageCount++;
                if (rows.length === STREAM_PAGE_SIZE) {
                  const last = rows[rows.length - 1];
                  todosCursor = `${last.date}:${last.deleted}:${last.id}`;
                  if (sessionId && pageCount % SESSION_UPDATE_INTERVAL === 0) {
                    await env.DB.prepare('UPDATE export_sessions SET todos_cursor = ?, updated_at = ? WHERE id = ?')
                      .bind(todosCursor, Date.now(), sessionId).run();
                    queryCount++;
                  }
                  return;
                } else {
                  todosDone = true;
                  if (sessionId) {
                    await env.DB.prepare('UPDATE export_sessions SET todos_cursor = ?, updated_at = ? WHERE id = ?')
                      .bind('__done__', Date.now(), sessionId).run();
                    queryCount++;
                  }
                }
              }

              if (todosDone && !templatesDone && incTodos) {
                if (queryCount >= MAX_QUERIES_PER_INVOCATION) {
                  emitContinuation(controller);
                  return;
                }
                const tplCursorSql = templatesCursor ? ' AND parent_id > ?' : '';
                const tplCursorParams = templatesCursor ? [templatesCursor] : [];
                const dataRes = await env.DB.prepare(
                  `SELECT * FROM todo_templates WHERE 1=1${tplCursorSql} ORDER BY parent_id ASC LIMIT ?`
                ).bind(...tplCursorParams, STREAM_PAGE_SIZE).all();
                queryCount++;
                const rows = dataRes.results || [];

                enqueueBatch(controller, rows, r => JSON.stringify({ _type: 'template', ...r }) + '\n');

                pageCount++;
                if (rows.length === STREAM_PAGE_SIZE) {
                  templatesCursor = rows[rows.length - 1].parent_id;
                  if (sessionId && pageCount % SESSION_UPDATE_INTERVAL === 0) {
                    await env.DB.prepare('UPDATE export_sessions SET templates_cursor = ?, updated_at = ? WHERE id = ?')
                      .bind(templatesCursor, Date.now(), sessionId).run();
                    queryCount++;
                  }
                  return;
                } else {
                  templatesDone = true;
                  if (sessionId) {
                    await env.DB.prepare('UPDATE export_sessions SET templates_cursor = ?, updated_at = ? WHERE id = ?')
                      .bind('__done__', Date.now(), sessionId).run();
                    queryCount++;
                  }
                }
              }

              controller.close();
            } catch (err) {
              controller.error(err);
            }
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'application/x-ndjson',
            'Content-Disposition': 'attachment; filename="todo_export.json"'
          }
        });
      }

      return apiError("Unknown mode. Use mode=page, mode=stream or mode=session", 400);
    }
    
    if (url.pathname === '/api/import' && request.method === 'POST') {
      const contentType = request.headers.get('Content-Type') || '';
      // BATCH_ROWS: 累积多少行触发一次 execBatch（与上传分片解耦）
      // BATCH_STMTS: execBatch 内每多少 prepared statement 组一个 DB.batch
      //   multi-row VALUES 后每 statement 含 4-5 行，25 statement = 100-125 行/事务
      //   单事务 100 行左右平衡性能与锁持有时间（D1 单库单线程）
      const BATCH_ROWS = 100;
      const BATCH_STMTS = 25;

      const safeStringify = (v) => {
        if (typeof v === 'string') return v;
        if (Array.isArray(v)) return JSON.stringify(v);
        if (v != null && typeof v === 'object') return JSON.stringify(v);
        return '[]';
      };

      // 严格校验 time_records：必须是 JSON 数组字符串，否则返回 '[]'
      const safeTimeRecords = (v) => {
        if (v == null || v === '[]') return '[]';
        if (typeof v === 'string') {
          try {
            const parsed = JSON.parse(v);
            if (Array.isArray(parsed)) return v;  // 原样返回，避免二次 stringify
          } catch (e) {}
          return '[]';
        }
        if (Array.isArray(v)) return JSON.stringify(v);
        return '[]';
      };

      // D1 bound params/query 限制 100，单行 todos 21 列，4 行 = 84 params
      // 单行 templates 13 列，7 行 = 91 params
      // 性能：SQLite multi-row VALUES 比 N 个单行 INSERT 快 5-10x（减少 prepared statement 创建 + 网络往返）
      // DB.batch 内 statement 数量也减少 4-5 倍
      const TODO_ROWS_PER_INSERT = 4;  // 4 × 21 = 84 params
      const TEMPLATE_ROWS_PER_INSERT = 7;  // 7 × 13 = 91 params

      const TODO_COLUMNS = '(id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, type, end_time, category_id, recurrence_id, is_exception, time_records, fragment_anchor, rrule, anchor_date, exdates)';
      const TODO_ROW_PLACEHOLDER = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

      const TEMPLATE_COLUMNS = '(parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule)';
      const TEMPLATE_ROW_PLACEHOLDER = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

      const TODO_BIND_EXTRACTOR = (t) => {
        // v1.0 type 兜底：旧导出文件可能用 repeat_type；导入时映射
        let type = t.type;
        if (!type) {
          // 兼容 v2.x 导出：从 repeat_type 推导
          const rpt = t.repeat_type;
          if (rpt === 'fragment') type = 'fragment';
          else if (rpt && ['daily','weekly','monthly','yearly'].includes(rpt)) type = 'recurring';
          else type = 'none';
        }
        // v1.0 rrule 兜底：旧导出文件可能 rrule 为空但有旧字段；导入时合成
        let rrule = t.rrule || '';
        if (!rrule && type === 'recurring') {
          rrule = rruleFromLegacyFields({
            repeat_type: t.repeat_type || (type === 'recurring' ? 'daily' : 'none'),
            repeat_interval: t.repeat_interval || 1,
            repeat_end: t.repeat_end || '',
            repeat_custom: t.repeat_custom || '',
            anchor_date: t.anchor_date || t.date || '',
          });
        }
        return [
          t.id, t.parent_id, t.date, t.text, t.time || '', t.priority || 'low',
          t.desc || '', t.url || '', t.copy_text || '',
          safeStringify(t.subtasks), safeStringify(t.search_terms), t.done || 0, t.deleted || 0,
          type,
          t.end_time || '', t.category_id || '',
          t.recurrence_id || '', t.is_exception || 0,
          safeTimeRecords(t.time_records),
          // fragment_anchor: 碎时记起始日期，导入时保留；非碎时记或旧数据为 ''
          t.fragment_anchor || '',
          // v1.0 规范字段
          rrule,
          // anchor_date: 优先用导出值，否则用 date 兜底
          t.anchor_date || t.date || '',
          // exdates: 优先用导出值，否则 '[]'
          t.exdates || '[]'
        ];
      };

      const TEMPLATE_BIND_EXTRACTOR = (t) => {
        const exdates = t.exdates || '[]';
        // v1.0 type 兜底
        let type = t.type;
        if (!type) {
          const rpt = t.repeat_type;
          if (rpt && ['daily','weekly','monthly','yearly'].includes(rpt)) type = 'recurring';
          else type = 'recurring';  // 模板默认 recurring
        }
        // v1.0 rrule 兜底
        let rrule = t.rrule || '';
        if (!rrule) {
          rrule = rruleFromLegacyFields({
            repeat_type: t.repeat_type || 'daily',
            repeat_interval: t.repeat_interval || 1,
            repeat_end: t.repeat_end || '',
            repeat_custom: t.repeat_custom || '',
            anchor_date: t.anchor_date || '',
          });
        }
        return [
          t.parent_id, t.text || '', t.time || '', t.priority || 'low', t.desc || '', t.url || '', t.copy_text || '',
          safeStringify(t.subtasks), safeStringify(t.search_terms),
          type,
          t.end_time || '',
          t.anchor_date || '', exdates, t.category_id || '',
          safeTimeRecords(t.time_records),
          rrule
        ];
      };

      // 构造 multi-row VALUES INSERT 语句数组
      // 输入 items 数组，输出 prepared statement 数组（每 ROWS_PER_INSERT 行一个 statement）
      const buildMultiRowStmts = (items, tableName, columns, rowPlaceholder, rowsPerInsert, bindExtractor) => {
        if (!items || items.length === 0) return [];
        const stmts = [];
        for (let i = 0; i < items.length; i += rowsPerInsert) {
          const chunk = items.slice(i, i + rowsPerInsert);
          const placeholders = chunk.map(() => rowPlaceholder).join(', ');
          const params = chunk.flatMap(bindExtractor);
          stmts.push(
            env.DB.prepare(`INSERT OR REPLACE INTO ${tableName} ${columns} VALUES ${placeholders}`).bind(...params)
          );
        }
        return stmts;
      };

      const buildTodoStmts = (items) => buildMultiRowStmts(items, 'todos', TODO_COLUMNS, TODO_ROW_PLACEHOLDER, TODO_ROWS_PER_INSERT, TODO_BIND_EXTRACTOR);
      const buildTemplateStmts = (items) => buildMultiRowStmts(items, 'todo_templates', TEMPLATE_COLUMNS, TEMPLATE_ROW_PLACEHOLDER, TEMPLATE_ROWS_PER_INSERT, TEMPLATE_BIND_EXTRACTOR);

      const execBatch = async (stmts) => {
        for (let i = 0; i < stmts.length; i += BATCH_STMTS) {
          await env.DB.batch(stmts.slice(i, i + BATCH_STMTS));
        }
      };

      const BACKUP_TTL = 10 * 60 * 1000;

      const clearBackupTables = async () => {
        try {
          await env.DB.batch([
            env.DB.prepare('DROP TABLE IF EXISTS todos_backup'),
            env.DB.prepare('DROP TABLE IF EXISTS todo_templates_backup'),
            env.DB.prepare('DROP TABLE IF EXISTS categories_backup'),
          ]);
        } catch (e) { console.error("Failed to drop backup tables:", e); }
      };

      const cleanExpiredBackups = async () => {
        const record = await env.DB.prepare("SELECT value FROM settings WHERE key = 'import_backup_time'").first();
        if (!record || !record.value) return;
        const backupTime = parseInt(record.value, 10);
        if (isNaN(backupTime) || Date.now() - backupTime < BACKUP_TTL) return;
        await clearBackupTables();
        await env.DB.prepare("DELETE FROM settings WHERE key = 'import_backup_time'").run();
      };

      try {
        if (contentType.includes('application/x-ndjson')) {
          const importId = url.searchParams.get('importId');
          if (!importId) return apiError('importId required', 400);
          if (!request.body) return apiError('请求体为空', 400);

          const session = await env.DB.prepare('SELECT * FROM import_sessions WHERE id = ? AND status = ?').bind(importId, 'active').first();
          if (!session) return apiError('无效或已过期的导入会话', 400);

          let buffer = '';
          const reader = request.body.getReader();
          const decoder = new TextDecoder();
          let todoBatch = [];
          let tplBatch = [];

          const processBuffer = async () => {
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';  // 最后一段（可能不完整）留到下次
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              const obj = JSON.parse(trimmed);

              if (obj._type === 'template') {
                const tpl = Object.assign({}, obj); delete tpl._type;
                tplBatch.push(tpl);
                if (tplBatch.length >= BATCH_ROWS) { await execBatch(buildTemplateStmts(tplBatch)); tplBatch = []; }
              } else if (obj._type) {
                // settings/categories etc. handled by frontend separately
              } else {
                todoBatch.push(obj);
                if (todoBatch.length >= BATCH_ROWS) { await execBatch(buildTodoStmts(todoBatch)); todoBatch = []; }
              }
            }
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (value) {
                buffer += decoder.decode(value, { stream: true });
              }
              // flush TextDecoder 内部缓冲（stream:true 模式下可能残留字节）
              buffer += decoder.decode();
              await processBuffer();
              break;
            }
            if (value) {
              buffer += decoder.decode(value, { stream: true });
            }
            await processBuffer();
          }

          if (buffer.trim()) {
            const obj = JSON.parse(buffer.trim());
            if (obj._type === 'template') { const tpl = Object.assign({}, obj); delete tpl._type; tplBatch.push(tpl); }
            else if (!obj._type) { todoBatch.push(obj); }
          }

          if (todoBatch.length > 0) { await execBatch(buildTodoStmts(todoBatch)); }
          if (tplBatch.length > 0) { await execBatch(buildTemplateStmts(tplBatch)); }

          await env.DB.prepare('UPDATE import_sessions SET updated_at = ? WHERE id = ?').bind(Date.now(), importId).run();
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        let impBody;
        try { impBody = await request.json(); } catch(e) { return apiError('请求体不是有效的 JSON', 400); }
        const phase = impBody.phase;

        if (phase === 'status') {
          await cleanExpiredBackups();
          const session = await env.DB.prepare('SELECT * FROM import_sessions WHERE status = ?').bind('active').first();
          if (!session) {
            return new Response(JSON.stringify({ active: false }), { headers: { 'Content-Type': 'application/json' } });
          }
          const now = Date.now();
          const TIMEOUT = 10 * 60 * 1000;
          const timedOut = (now - session.updated_at) > TIMEOUT;

          const [todoBakRes, tplBakRes] = await Promise.all([
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todo_templates_backup'").first(),
          ]);

          return new Response(JSON.stringify({
            active: true,
            importId: session.id,
            mode: session.mode,
            startedAt: session.started_at,
            updatedAt: session.updated_at,
            timedOut,
            hasBackup: !!(todoBakRes || tplBakRes)
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (phase === 'abort') {
          const importId = impBody.importId;
          const discard = !!impBody.discard;
          const keepBackup = !!impBody.keepBackup;
          if (!importId) return apiError('importId required', 400);

          const session = await env.DB.prepare('SELECT * FROM import_sessions WHERE id = ?').bind(importId).first();
          if (!session) return apiError('会话不存在', 400);

          if (session.mode === 'overwrite' && !keepBackup) {
            if (discard) {
              await clearBackupTables();
            } else {
              try {
                await env.DB.batch([
                  env.DB.prepare('DROP TABLE IF EXISTS todos'),
                  env.DB.prepare('DROP TABLE IF EXISTS todo_templates'),
                  env.DB.prepare('DROP TABLE IF EXISTS categories'),
                  env.DB.prepare('ALTER TABLE todos_backup RENAME TO todos'),
                  env.DB.prepare('ALTER TABLE todo_templates_backup RENAME TO todo_templates'),
                  env.DB.prepare('ALTER TABLE categories_backup RENAME TO categories'),
                  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)'),
                  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)'),
                  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_stats ON todos(date, deleted, priority, done, category_id, time)'),
                  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_type ON todo_templates(type)'),
                ]);
              } catch (e) {
                return apiError('恢复备份失败: ' + e.message, 500);
              }
            }
          }

          await env.DB.prepare('DELETE FROM import_sessions WHERE id = ?').bind(importId).run();
          if (session.mode === 'overwrite' && !keepBackup) {
            await env.DB.prepare("DELETE FROM settings WHERE key = 'import_backup_time'").run();
          }
          return new Response(JSON.stringify({ success: true, recovered: session.mode === 'overwrite' && !discard && !keepBackup }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (phase === 'init') {
          const importId = impBody.importId;
          const mode = impBody.mode || 'merge';
          if (!importId) return apiError('importId required', 400);

          await cleanExpiredBackups();

          const oldSession = await env.DB.prepare('SELECT * FROM import_sessions WHERE status = ?').bind('active').first();
          if (oldSession) {
            const now = Date.now();
            const TIMEOUT = 10 * 60 * 1000;
            if ((now - oldSession.updated_at) < TIMEOUT) {
              return apiError('存在进行中的导入会话', 409, { conflict: true, importId: oldSession.id, mode: oldSession.mode });
            }
            if (oldSession.mode === 'overwrite') {
                try {
                  await env.DB.batch([
                    env.DB.prepare('DROP TABLE IF EXISTS todos'),
                    env.DB.prepare('DROP TABLE IF EXISTS todo_templates'),
                    env.DB.prepare('DROP TABLE IF EXISTS categories'),
                    env.DB.prepare('ALTER TABLE todos_backup RENAME TO todos'),
                    env.DB.prepare('ALTER TABLE todo_templates_backup RENAME TO todo_templates'),
                    env.DB.prepare('ALTER TABLE categories_backup RENAME TO categories'),
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)'),
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)'),
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_stats ON todos(date, deleted, priority, done, category_id, time)'),
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_type ON todo_templates(type)'),
                  ]);
                } catch (e) {
                  console.error("Auto-recover old session failed:", e);
                }
            }
            await env.DB.prepare('DELETE FROM import_sessions WHERE id = ?').bind(oldSession.id).run();
            if (oldSession.mode === 'overwrite') {
              await env.DB.prepare("DELETE FROM settings WHERE key = 'import_backup_time'").run();
            }
          }

          const now = Date.now();
          if (mode === 'overwrite') {
            try {
              await env.DB.batch([
                env.DB.prepare('DROP TABLE IF EXISTS todos_backup'),
                env.DB.prepare('DROP TABLE IF EXISTS todo_templates_backup'),
                env.DB.prepare('DROP TABLE IF EXISTS categories_backup'),
                env.DB.prepare('DROP INDEX IF EXISTS idx_todos_cursor'),
                env.DB.prepare('DROP INDEX IF EXISTS idx_todos_parent_date_del'),
                env.DB.prepare('DROP INDEX IF EXISTS idx_todos_stats'),
                env.DB.prepare('DROP INDEX IF EXISTS idx_templates_type'),
                env.DB.prepare('DROP INDEX IF EXISTS idx_todos_type'),
                env.DB.prepare('DROP INDEX IF EXISTS idx_templates_type'),
              ]);
              await env.DB.batch([
                env.DB.prepare('ALTER TABLE todos RENAME TO todos_backup'),
                env.DB.prepare('ALTER TABLE todo_templates RENAME TO todo_templates_backup'),
                env.DB.prepare('ALTER TABLE categories RENAME TO categories_backup'),
              ]);
              await env.DB.batch([
                env.DB.prepare(`
                  CREATE TABLE todos (
                    id TEXT PRIMARY KEY,
                    parent_id TEXT NOT NULL,
                    date TEXT NOT NULL,
                    text TEXT NOT NULL,
                    time TEXT,
                    priority TEXT,
                    desc TEXT,
                    url TEXT,
                    copy_text TEXT,
                    subtasks TEXT,
                    search_terms TEXT,
                    done INTEGER NOT NULL DEFAULT 0,
                    deleted INTEGER NOT NULL DEFAULT 0,
                    type TEXT NOT NULL DEFAULT 'none',
                    end_time TEXT DEFAULT '',
                    category_id TEXT DEFAULT '',
                    recurrence_id TEXT DEFAULT '',
                    is_exception INTEGER NOT NULL DEFAULT 0,
                    time_records TEXT NOT NULL DEFAULT '[]',
                    fragment_anchor TEXT NOT NULL DEFAULT '',
                    rrule TEXT NOT NULL DEFAULT '',
                    anchor_date TEXT NOT NULL DEFAULT '',
                    exdates TEXT NOT NULL DEFAULT '[]'
                  )
                `),
                env.DB.prepare(`CREATE INDEX idx_todos_cursor ON todos(date, deleted, id)`),
                env.DB.prepare(`CREATE INDEX idx_todos_parent_date_del ON todos(parent_id, date, deleted)`),
                env.DB.prepare(`CREATE INDEX idx_todos_stats ON todos(date, deleted, priority, done, category_id, time)`),
                env.DB.prepare(`CREATE INDEX idx_todos_type ON todos(type)`),
                env.DB.prepare(`
                  CREATE TABLE todo_templates (
                    parent_id TEXT PRIMARY KEY,
                    text TEXT, time TEXT, priority TEXT, desc TEXT, url TEXT,
                    copy_text TEXT, subtasks TEXT, search_terms TEXT,
                    type TEXT NOT NULL DEFAULT 'recurring',
                    end_time TEXT DEFAULT '',
                    anchor_date TEXT NOT NULL DEFAULT '',
                    exdates TEXT DEFAULT '[]',
                    category_id TEXT DEFAULT '',
                    time_records TEXT NOT NULL DEFAULT '[]',
                    rrule TEXT NOT NULL DEFAULT ''
                  )
                `),
                env.DB.prepare(`CREATE INDEX idx_templates_type ON todo_templates(type)`),
                env.DB.prepare(`
                  CREATE TABLE categories (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    color TEXT NOT NULL DEFAULT '#888888'
                  )
                `),
                env.DB.prepare('INSERT INTO import_sessions (id, mode, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?)')
                  .bind(importId, 'overwrite', 'active', now, now),
                env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('import_backup_time', ?)")
                  .bind(String(now)),
              ]);
            } catch (backupErr) {
                try {
                  await env.DB.batch([
                    env.DB.prepare('DROP TABLE IF EXISTS todos'),
                    env.DB.prepare('DROP TABLE IF EXISTS todo_templates'),
                    env.DB.prepare('DROP TABLE IF EXISTS categories'),
                    env.DB.prepare('ALTER TABLE todos_backup RENAME TO todos'),
                    env.DB.prepare('ALTER TABLE todo_templates_backup RENAME TO todo_templates'),
                    env.DB.prepare('ALTER TABLE categories_backup RENAME TO categories'),
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)'),
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)'),
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_stats ON todos(date, deleted, priority, done, category_id, time)'),
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_type ON todo_templates(type)'),
                  ]);
                } catch (rollbackErr) {
                  console.error("Rollback after backup failure also failed:", rollbackErr);
                }
                return apiError('覆写前备份失败: ' + backupErr.message, 500);
            }
          } else {
            await env.DB.prepare('INSERT INTO import_sessions (id, mode, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?)')
              .bind(importId, 'merge', 'active', now, now).run();
          }

          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        else if (phase === 'finalize') {
          const importId = impBody.importId;
          if (!importId) return apiError('importId required', 400);

          const session = await env.DB.prepare('SELECT * FROM import_sessions WHERE id = ?').bind(importId).first();
          if (!session) return apiError('会话不存在', 400);

          if (session.mode === 'overwrite') {
            try {
              await env.DB.batch([
                env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)'),
                env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)'),
                env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_stats ON todos(date, deleted, priority, done, category_id, time)'),
                env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_type ON todo_templates(type)'),
              ]);
            } catch (e) { console.error("Index rebuild after finalize:", e); }
          }

          if (impBody.custom_header !== undefined || impBody.custom_content !== undefined) {
            const customStmts = [];
            if (impBody.custom_header !== undefined) {
              customStmts.push(env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_header', ?)").bind(impBody.custom_header));
            }
            if (impBody.custom_content !== undefined) {
              customStmts.push(env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_content', ?)").bind(impBody.custom_content));
            }
            if (customStmts.length > 0) await env.DB.batch(customStmts);
          }

          if (impBody.categories && Array.isArray(impBody.categories)) {
            if (session.mode === 'overwrite') {
              await env.DB.prepare("DELETE FROM categories").run();
            }
            const insertStmts = impBody.categories.filter(c => c.id && c.name).map(c =>
              env.DB.prepare("INSERT OR REPLACE INTO categories (id, name, color) VALUES (?, ?, ?)").bind(c.id, c.name, c.color || '#888888')
            );
            if (insertStmts.length > 0) await env.DB.batch(insertStmts);
            await env.DB.batch([
              env.DB.prepare("UPDATE todos SET category_id = '' WHERE category_id != '' AND category_id NOT IN (SELECT id FROM categories)"),
              env.DB.prepare("UPDATE todo_templates SET category_id = '' WHERE category_id != '' AND category_id NOT IN (SELECT id FROM categories)")
            ]);
          }

          if (impBody.customColors && Array.isArray(impBody.customColors)) {
            await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('customColors', ?)").bind(JSON.stringify(impBody.customColors)).run();
          }

          await env.DB.prepare('DELETE FROM import_sessions WHERE id = ?').bind(importId).run();

          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        else {
          return apiError('未知 phase，可用: status, abort, init, finalize', 400);
        }

      } catch (e) {
        return apiError(e.message);
      }
    }

    if (url.pathname === '/api/import-backup') {
      const action = url.searchParams.get('action') || 'query';
    
      try {
        // 查询备份状态
        if (action === 'query') {
          const [todoBakRes, tplBakRes, catBakRes] = await Promise.all([
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todo_templates_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories_backup'").first(),
          ]);
          const hasTodoBak = !!todoBakRes;
          const hasTplBak = !!tplBakRes;
          const hasCatBak = !!catBakRes;
          return new Response(JSON.stringify({
            exists: hasTodoBak || hasTplBak || hasCatBak,
            todos: hasTodoBak ? 'backup_exists' : 0,
            templates: hasTplBak ? 'backup_exists' : 0,
            categories: hasCatBak ? 'backup_exists' : 0
          }), { headers: { 'Content-Type': 'application/json' } });
        }
    
        // 恢复备份
        if (action === 'restore') {
          const [todoBakRes, tplBakRes, catBakRes] = await Promise.all([
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todo_templates_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories_backup'").first(),
          ]);
          const hasTodoBak = !!todoBakRes;
          const hasTplBak = !!tplBakRes;
          const hasCatBak = !!catBakRes;
    
          if (!hasTodoBak && !hasTplBak && !hasCatBak) {
            return apiError("未找到备份数据，无需恢复", 404);
          }
    
          try {
              const restoreStmts = [];
              if (hasTodoBak) {
                restoreStmts.push(
                  env.DB.prepare('DROP TABLE IF EXISTS todos'),
                  env.DB.prepare('ALTER TABLE todos_backup RENAME TO todos'),
                  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)'),
                  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)'),
                  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_stats ON todos(date, deleted, priority, done, category_id, time)')
                );
              }
              if (hasTplBak) {
                restoreStmts.push(
                  env.DB.prepare('DROP TABLE IF EXISTS todo_templates'),
                  env.DB.prepare('ALTER TABLE todo_templates_backup RENAME TO todo_templates'),
                  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_type ON todo_templates(type)')
                );
              }
              if (hasCatBak) {
                restoreStmts.push(
                  env.DB.prepare('DROP TABLE IF EXISTS categories'),
                  env.DB.prepare('ALTER TABLE categories_backup RENAME TO categories')
                );
              }
              await env.DB.batch(restoreStmts);
          } catch (e) {
            return apiError("恢复失败: " + e.message + "，备份数据仍保留，可重试");
          }

          await env.DB.prepare("DELETE FROM settings WHERE key = 'import_backup_time'").run();

          return new Response(JSON.stringify({
            success: true,
            restored: { todos: hasTodoBak ? 'restored' : 0, templates: hasTplBak ? 'restored' : 0, categories: hasCatBak ? 'restored' : 0 }
          }), { headers: { 'Content-Type': 'application/json' } });
        }
    
        // 清除备份
        if (action === 'clear') {
          const [todoBakRes, tplBakRes, catBakRes] = await Promise.all([
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todo_templates_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories_backup'").first(),
          ]);
          const hasTodoBak = !!todoBakRes;
          const hasTplBak = !!tplBakRes;
          const hasCatBak = !!catBakRes;
    
          if (!hasTodoBak && !hasTplBak && !hasCatBak) {
            return new Response(JSON.stringify({ success: true, message: "无残留备份，无需清除" }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
    
          await env.DB.batch([
            env.DB.prepare('DROP TABLE IF EXISTS todos_backup'),
            env.DB.prepare('DROP TABLE IF EXISTS todo_templates_backup'),
            env.DB.prepare('DROP TABLE IF EXISTS categories_backup'),
          ]);
          await env.DB.prepare("DELETE FROM settings WHERE key = 'import_backup_time'").run();
          return new Response(JSON.stringify({
            success: true,
            message: "备份记录已清除（原始数据未恢复）"
          }), { headers: { 'Content-Type': 'application/json' } });
        }
    
        // 未知操作
        return apiError("未知操作，可用: query, restore, clear", 400);
    
      } catch (e) {
        return apiError(e.message);
      }
    }

    if (url.pathname === '/api/settings' && request.method === 'GET') {
      const record = await env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
      let settingsObj = {};
      if (record && record.value) {
        try { settingsObj = JSON.parse(record.value); } catch(e){}
      }
      return new Response(JSON.stringify(settingsObj), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/settings' && request.method === 'POST') {
      let settingsData;
      try { settingsData = await request.json(); } catch(e) { return apiError('请求体不是有效的 JSON', 400); }
      if (!settingsData || typeof settingsData !== 'object') return apiError('设置必须为 JSON 对象', 400);
      await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)").bind(JSON.stringify(settingsData)).run();
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/custom-colors' && request.method === 'GET') {
      const record = await env.DB.prepare("SELECT value FROM settings WHERE key = 'customColors'").first();
      let customColors = [];
      if (record && record.value) {
        try { customColors = JSON.parse(record.value); } catch(e) {}
      }
      return new Response(JSON.stringify(customColors), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/custom-header' && request.method === 'GET') {
      const record = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_header'").first();
      return new Response(record?.value || '', { headers: { 'Content-Type': 'text/plain' } });
    }

    if (url.pathname === '/api/custom-content' && request.method === 'GET') {
      const record = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_content'").first();
      return new Response(record?.value || '', { headers: { 'Content-Type': 'text/plain' } });
    }

    if (url.pathname === '/api/custom-colors' && request.method === 'POST') {
      let clrBody;
      try { clrBody = await request.json(); } catch(e) { return apiError('请求体不是有效的 JSON', 400); }
      const { colors } = clrBody;
      if (!Array.isArray(colors)) {
        return apiError('colors must be an array', 400);
      }
      await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('customColors', ?)").bind(JSON.stringify(colors)).run();
      return new Response(JSON.stringify({ success: true, colors: colors }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/categories' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT id, name, color FROM categories ORDER BY id').all();
      return new Response(JSON.stringify(results || []), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/category-action' && request.method === 'POST') {
      let catBody;
      try { catBody = await request.json(); } catch(e) { return apiError('请求体不是有效的 JSON', 400); }
      const { action, id, ids, name, color } = catBody;

      if (action === 'CREATE') {
        if (!name || !name.trim()) {
          return apiError('分类名称不能为空', 400);
        }
        const existing = await env.DB.prepare("SELECT id FROM categories WHERE LOWER(name) = ?").bind(name.trim().toLowerCase()).first();
        if (existing) {
          return apiError('分类名称已存在', 400);
        }
        const new_id = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const cat_color = (color && color.trim()) ? color.trim() : DEFAULT_CATEGORY_COLOR;
        await env.DB.prepare("INSERT INTO categories (id, name, color) VALUES (?, ?, ?)").bind(new_id, name.trim(), cat_color).run();
        return new Response(JSON.stringify({ success: true, id: new_id, name: name.trim(), color: cat_color }), { headers: { 'Content-Type': 'application/json' } });
      }
      else if (action === 'UPDATE') {
        if (!id) {
          return apiError('缺少分类ID', 400);
        }
        if (name && name.trim()) {
          const existing = await env.DB.prepare("SELECT id FROM categories WHERE LOWER(name) = ? AND id != ?").bind(name.trim().toLowerCase(), id).first();
          if (existing) {
            return apiError('分类名称已存在', 400);
          }
        }
        const cat = await env.DB.prepare("SELECT id FROM categories WHERE id = ?").bind(id).first();
        if (cat) {
          const sets = [];
          const vals = [];
          if (name && name.trim()) { sets.push("name = ?"); vals.push(name.trim()); }
          if (color && color.trim()) { sets.push("color = ?"); vals.push(color.trim()); }
          if (sets.length > 0) {
            vals.push(id);
            await env.DB.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
          }
        }
        return new Response(JSON.stringify({ success: true, id: id, name: name ? name.trim() : undefined, color: color ? color.trim() : undefined }), { headers: { 'Content-Type': 'application/json' } });
      }
      else if (action === 'BATCH_DELETE') {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return apiError('缺少分类ID列表', 400);
        }
        // 自动分片：每片内三个语句原子提交，跨片独立
        for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
          const placeholders = sqlPlaceholders(chunk.length);
          try {
            await env.DB.batch([
              env.DB.prepare(`DELETE FROM categories WHERE id IN (${placeholders})`).bind(...chunk),
              env.DB.prepare(`UPDATE todos SET category_id = '' WHERE category_id IN (${placeholders})`).bind(...chunk),
              env.DB.prepare(`UPDATE todo_templates SET category_id = '' WHERE category_id IN (${placeholders})`).bind(...chunk)
            ]);
          } catch (e) {
            // 单片失败不阻断整体流程
          }
        }
        return new Response(JSON.stringify({ success: true, ids: ids }), { headers: { 'Content-Type': 'application/json' } });
      }

      return apiError('未知操作', 400);
    }

    if (url.pathname === '/api/trash' && request.method === 'GET') {
      // V0 trash: 自动分页拉取全部回收站数据（前端无感，返回纯数组保持向后兼容）
      // 分片查询：每片 100 条，避免单次 SQL 过重
      const TRASH_MAX_ITEMS = 1000;
      const TRASH_CHUNK_SIZE = 100;
      const allResults = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore && allResults.length < TRASH_MAX_ITEMS) {
        const { results } = await env.DB.prepare(
          'SELECT * FROM todos WHERE deleted = 1 ORDER BY date DESC LIMIT ? OFFSET ?'
        ).bind(TRASH_CHUNK_SIZE, offset).all();
        if (results && results.length > 0) {
          allResults.push(...results);
          offset += results.length;
          // 不足一片说明已到末尾
          if (results.length < TRASH_CHUNK_SIZE) hasMore = false;
        } else {
          hasMore = false;
        }
      }
      return new Response(JSON.stringify(allResults), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/trash-action' && request.method === 'POST') {
      let trashBodyV0;
      try { trashBodyV0 = await request.json(); } catch(e) { return apiError('请求体不是有效的 JSON', 400); }
      const { action, id, ids } = trashBodyV0;
      if (action === 'RESTORE') {
        const t = await env.DB.prepare('SELECT parent_id, date, type FROM todos WHERE id = ?').bind(id).first();
        await env.DB.prepare('UPDATE todos SET deleted = 0 WHERE id = ?').bind(id).run();
        // 仅当回收站行仍携带循环属性时才需判定 (this-scope 删除, 或旧版未脱钩的 thisAndFuture/all 行)
        // 新版 thisAndFuture/all 删除已在删除时脱钩为单次快照 (type='none', parent_id=id)，此处直接跳过。
        // 碎时记 (fragment) 无模板，直接恢复即可。
        // 对齐 RFC 5545 + Google Tasks 标准：停止/删除系列后恢复，实例为单次任务，不再重新激活循环。
        if (t && t.type === 'recurring' && t.parent_id && t.parent_id !== id) {
          // 检查同日期是否已有活跃实例（避免恢复后出现重复）
          const existing = await env.DB.prepare(
            'SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 AND id != ? LIMIT 1'
          ).bind(t.parent_id, t.date, id).first();
          if (existing) {
            // 同日期已有活跃实例，恢复的实例脱离模板变为单次任务
            await env.DB.prepare(
              'UPDATE todos SET parent_id=?, type=?, rrule=?, anchor_date=?, exdates=? WHERE id=?'
            ).bind(id, 'none', '', '', '[]', id).run();
          } else {
            const tpl = await env.DB.prepare('SELECT rrule, exdates FROM todo_templates WHERE parent_id = ?').bind(t.parent_id).first();
            // v1.0：检查模板的 rrule 是否仍覆盖此日期（用 isOccurrenceOnDate 判断）
            // 替代旧版 tpl.repeat_end >= t.date 的简单比较
            let tplCoversDate = false;
            if (tpl && tpl.rrule) {
              try {
                // 用 anchor_date（需另查）+ rrule + exdates 判断
                // 简化：只要模板存在且 rrule 非空，就视为覆盖（恢复时 removeExdate 即可）
                // 严格判断需 isOccurrenceOnDate，但需 anchor_date，此处仅做存在性检查
                tplCoversDate = true;
              } catch (e) { tplCoversDate = false; }
            }
            if (tplCoversDate) {
              // 模板仍覆盖此日期: 视为"仅此日程"删除的恢复，从EXDATE移除此日期，重新并入系列
              const currentExdates = tpl.exdates || '[]';
              const new_exdates = removeExdate(currentExdates, t.date);
              await env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, t.parent_id).run();
            } else {
              // 模板已删除(旧版 all)或已截断至此日期之前(旧版 thisAndFuture): 无法并入系列，脱钩为单次任务
              await env.DB.prepare(
                'UPDATE todos SET parent_id=?, type=?, rrule=?, anchor_date=?, exdates=? WHERE id=?'
              ).bind(id, 'none', '', '', '[]', id).run();
            }
          }
        }
      } else if (action === 'DELETE_PERMANENT') {
        await env.DB.prepare('DELETE FROM todos WHERE id = ?').bind(id).run();
      } else if (action === 'CLEAR_ALL') {
        await env.DB.prepare('DELETE FROM todos WHERE deleted = 1').run();
      } else if (action === 'BATCH_RESTORE') {
        if (ids && ids.length > 0) {
          // 自动分片查询
          const tasks = [];
          for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
            const ph = sqlPlaceholders(chunk.length);
            try {
              const rows = await env.DB.prepare(`SELECT id, parent_id, date, type FROM todos WHERE id IN (${ph})`).bind(...chunk).all();
              for (const r of (rows.results || [])) tasks.push(r);
            } catch (e) {
              // 单片查询失败不阻断整体流程
            }
          }

          // 自动分片恢复
          for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
            const ph = sqlPlaceholders(chunk.length);
            try {
              await env.DB.prepare(`UPDATE todos SET deleted = 0 WHERE id IN (${ph})`).bind(...chunk).run();
            } catch (e) {
              // 单片失败不阻断整体流程
            }
          }

          // 仅回收站行仍携带循环属性的 (this-scope 删除或旧版未脱钩行) 需要判定
          // 新版 thisAndFuture/all 删除时已脱钩为单次 (type='none', parent_id=id)，跳过
          // 对齐 RFC 5545 + Google Tasks: 模板已删除/截断的，恢复为单次任务，不重建系列
          const candidateTasks = tasks.filter(t =>
            t.type === 'recurring' && t.parent_id && t.parent_id !== t.id
          );
          const uniqueParentIds = [...new Set(candidateTasks.map(t => t.parent_id))];
          const tplMap = new Map();
          for (const chunk of chunkArray(uniqueParentIds, BATCH_CHUNK_SIZE)) {
            const ph = sqlPlaceholders(chunk.length);
            try {
              const rows = await env.DB.prepare(`SELECT parent_id, rrule, exdates FROM todo_templates WHERE parent_id IN (${ph})`).bind(...chunk).all();
              for (const r of (rows.results || [])) tplMap.set(r.parent_id, r);
            } catch (e) {
              // 单片查询失败不阻断整体流程
            }
          }
          const existingKeys = new Set();
          for (const t of candidateTasks) {
            existingKeys.add(`${t.parent_id}|${t.date}`);
          }
          const existingKeyArr = Array.from(existingKeys);
          for (const chunk of chunkArray(existingKeyArr, BATCH_CHUNK_SIZE)) {
            try {
              const unions = chunk.map(k => {
                const [pid, dt] = k.split('|');
                const escPid = pid.replace(/'/g, "''");
                const escDt = dt.replace(/'/g, "''");
                return `SELECT '${escPid}' AS pid, '${escDt}' AS dt, EXISTS(SELECT 1 FROM todos WHERE parent_id = '${escPid}' AND date = '${escDt}' AND deleted = 0) AS has_existing`;
              }).join(' UNION ALL ');
              const rows = await env.DB.prepare(`SELECT * FROM (${unions})`).all();
              for (const r of (rows.results || [])) {
                if (r.has_existing) existingKeys.add(`${r.pid}|${r.dt}`);
                else existingKeys.delete(`${r.pid}|${r.dt}`);
              }
            } catch (e) {
              for (const k of chunk) {
                const [pid, dt] = k.split('|');
                try {
                  const ex = await env.DB.prepare('SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 LIMIT 1').bind(pid, dt).first();
                  if (!ex) existingKeys.delete(k);
                } catch (e2) {
                  // 查询失败保留 key（视为有 existing，安全降级为脱钩）
                }
              }
            }
          }

          const detachIds = [];
          const exdateUpdates = {};
          for (const t of candidateTasks) {
            if (existingKeys.has(`${t.parent_id}|${t.date}`)) {
              detachIds.push(t.id);
              continue;
            }
            const tpl = tplMap.get(t.parent_id);
            // v1.0：检查模板 rrule 非空即视为覆盖（严格判断需 isOccurrenceOnDate）
            if (tpl && tpl.rrule) {
              if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
              exdateUpdates[t.parent_id].push(t.date);
            } else {
              detachIds.push(t.id);
            }
          }

          // 自动分片执行脱钩
          for (const chunk of chunkArray(detachIds, BATCH_CHUNK_SIZE)) {
            const ph = sqlPlaceholders(chunk.length);
            try {
              await env.DB.prepare(`UPDATE todos SET parent_id=id, type='none', rrule='', anchor_date='', exdates='[]' WHERE id IN (${ph})`).bind(...chunk).run();
            } catch (e) {
              // 单片失败不阻断整体流程
            }
          }

          const exdateStmts = [];
          for (const pid of Object.keys(exdateUpdates)) {
            const tpl = tplMap.get(pid);
            if (!tpl) continue;
            let currentExdates = tpl.exdates || '[]';
            let changed = false;
            for (const d of exdateUpdates[pid]) {
              const new_exdates = removeExdate(currentExdates, d);
              if (new_exdates !== currentExdates) {
                currentExdates = new_exdates;
                changed = true;
              }
            }
            if (changed) exdateStmts.push(env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(currentExdates, pid));
          }
          for (const chunk of chunkArray(exdateStmts, BATCH_CHUNK_SIZE)) {
            try { await env.DB.batch(chunk); } catch (e) {
              // 单批 exdate 维护失败不阻断整体流程
            }
          }
        }
      } else if (action === 'BATCH_DELETE_PERMANENT') {
        if (ids && ids.length > 0) {
          // 自动分片永久删除
          for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
            const ph = sqlPlaceholders(chunk.length);
            try {
              await env.DB.prepare(`DELETE FROM todos WHERE id IN (${ph})`).bind(...chunk).run();
            } catch (e) {
              // 单片失败不阻断整体流程
            }
          }
        }
      } else if (action === 'CLEAR_ALL_DATA') {
        await env.DB.batch([
          env.DB.prepare('DELETE FROM todos'),
          env.DB.prepare('DELETE FROM todo_templates'),
          env.DB.prepare('DELETE FROM settings'),
          env.DB.prepare('DELETE FROM categories'),
        ]);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/todos' && request.method === 'GET') {
      const date = url.searchParams.get('date');
      if (!date) return apiError("Date required", 400);

      return _withTodosDateLock(date, async () => {
      // 查询当前日期的所有可见 todos（v1.0 schema 1）：
      // - 普通 todo (type='none' 或 'recurring')：date = ?
      //   注：recurring 实例的 date = 当前实例日期；模板展开时会 INSERT 实例
      // - 碎时记 (type='fragment')：
      //   - 已完成：date = ?（完成时冻结到完成日期，仅该日可见）
      //   - 未完成：date = '' OR date <= ?（开始日期 <= 当前日期，则每日可见）
      let results = [];
      const r = await env.DB.prepare(
        `SELECT * FROM todos WHERE deleted = 0 AND (
           (type != 'fragment' AND date = ?)
           OR (type = 'fragment' AND done = 1 AND date = ?)
           OR (type = 'fragment' AND done = 0 AND (date = '' OR date <= ?))
        )`
      ).bind(date, date, date).all();
      results = r.results || [];

      // v1.0 模板展开：仅 type='recurring' 模板参与
      // rrule 内的 UNTIL 由 ical.js 在 isOccurrenceOnDate 中判断，无需 SQL 过滤
      const templatesReq = await env.DB.prepare(`
        SELECT * FROM todo_templates t
        WHERE t.type = 'recurring'
        AND t.anchor_date <= ?
        AND NOT EXISTS (
          SELECT 1 FROM todos td
          WHERE td.parent_id = t.parent_id
            AND td.date = ?
            AND td.deleted = 0
        )
      `).bind(date, date).all();
    
      const insertStmts = [];
      let newlyFetchedSearchTerms = null;
    
      if (templatesReq.results && templatesReq.results.length > 0) {
        for (const tpl of templatesReq.results) {
          let templateForEngine = { ...tpl, exdates: tpl.exdates || '[]' };

          // 使用 recurring-engine 判断此模板是否在目标日期生成实例
          if (!isOccurrenceOnDate(templateForEngine, date)) continue;
    
          const new_id = crypto.randomUUID();
    
          let parsedSubtasks = [];
          if (tpl.subtasks && tpl.subtasks !== '[]' && tpl.subtasks !== '') {
            try {
              parsedSubtasks = JSON.parse(tpl.subtasks);
              parsedSubtasks.forEach(st => st.done = false);
            } catch(e) {}
          }
    
          let parsedSearchTerms = [];
          if (tpl.search_terms && tpl.search_terms !== '[]' && tpl.search_terms !== '') {
            try {
              const oldTerms = JSON.parse(tpl.search_terms);
              if (Array.isArray(oldTerms) && oldTerms.length > 0) {
                 if (!newlyFetchedSearchTerms) {
                     const fetched = await fetchHotSearchData('auto');
                     const valid = fetched.filter(w => typeof w === 'string' && w.trim().length > 0);
                     newlyFetchedSearchTerms = valid.sort(() => 0.5 - Math.random()).slice(0, 20);
                 }
                 if (newlyFetchedSearchTerms.length > 0) {
                     parsedSearchTerms = newlyFetchedSearchTerms.map(w => ({ text: w, done: false }));
                 } else {
                     parsedSearchTerms = oldTerms.map(w => {
                        const t = typeof w === 'string' ? w : (w.text || '');
                        return { text: t, done: false };
                     }).filter(w => w.text);
                 }
              }
            } catch(e) {}
          }
    
        const newRecord = { 
          ...tpl, id: new_id, date: date, parent_id: tpl.parent_id, 
          done: 0, deleted: 0,
          subtasks: parsedSubtasks,
          search_terms: parsedSearchTerms,
          // 关键修复：模板的 time_records 是跨实例预估数据（供 predictDuration），
          time_records: '[]'
        };
        results.push(newRecord); 
      
        insertStmts.push(env.DB.prepare(
          'INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, type, end_time, category_id, time_records, fragment_anchor, rrule, anchor_date, exdates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          new_id, tpl.parent_id, date, tpl.text, tpl.time || '', normalizePriority(tpl.priority),
          tpl.desc || '', tpl.url || '', tpl.copy_text || '',
          JSON.stringify(parsedSubtasks), JSON.stringify(parsedSearchTerms),
          0, 0, 'recurring', tpl.end_time || '', tpl.category_id || '', '[]', '', tpl.rrule || '', date, '[]'
        ));
      }
      if (insertStmts.length > 0) {
        for (let i = 0; i < insertStmts.length; i += 100) {
          await env.DB.batch(insertStmts.slice(i, i + 100));
        }
      }
    }
    
      const formatted = results.map(row => {
        let parsedSubtasks = [];
        let parsedSearchTerms = [];
      
        if (Array.isArray(row.subtasks)) {
          parsedSubtasks = row.subtasks;
        } else {
          try { 
            if (row.subtasks) parsedSubtasks = JSON.parse(row.subtasks); 
          } catch(e) {
          }
        }

        if (Array.isArray(row.search_terms)) {
          parsedSearchTerms = row.search_terms;
        } else {
          try { 
            if (row.search_terms) parsedSearchTerms = JSON.parse(row.search_terms); 
          } catch(e) {}
        }

        parsedSearchTerms = parsedSearchTerms.map(w => {
            if (typeof w === 'string' && w.trim()) return { text: w, done: false };
            if (w && typeof w === 'object' && w.text) return w;
            return null;
        }).filter(Boolean);

        // v1.0 响应序列化：type 三态 + rrule + anchor_date + exdates
        // type 兜底（防 DB 脏数据）：none/fragment/recurring 之外的值统一为 'none'
        let type = row.type || 'none';
        if (type !== 'none' && type !== 'fragment' && type !== 'recurring') type = 'none';

        return {
          ...row,
          // v1.0 规范字段（替代旧 repeat_type / repeat_custom / repeat_interval / repeat_end）
          type: type,
          rrule: row.rrule || '',
          anchor_date: row.anchor_date || '',
          exdates: row.exdates || '[]',
          end_time: row.end_time || '',
          // is_series: 派生字段（type === 'recurring'）
          is_series: type === 'recurring',
          done: !!row.done,
          subtasks: parsedSubtasks,
          search_terms: parsedSearchTerms,
          // fragment_anchor: 碎时记起始日期（权威副本，不受完成/取消完成影响）
          fragment_anchor: row.fragment_anchor || ''
        };
      });
    
      return new Response(JSON.stringify(formatted), { headers: { 'Content-Type': 'application/json' } });
      }); // end _withTodosDateLock
    }

    if (url.pathname === '/api/time-records' && request.method === 'GET') {
      const todo_id = url.searchParams.get('todo_id');
      const parent_id = url.searchParams.get('parent_id');
      let records = [];
      let template_records = [];

      if (todo_id) {
        // 实例级查询（推荐）：修复同一模板不同实例串台的问题
        const todo_row = await env.DB.prepare(
          'SELECT time_records, parent_id FROM todos WHERE id = ?'
        ).bind(todo_id).first();
        if (todo_row) {
          try {
            const p = typeof todo_row.time_records === 'string'
              ? JSON.parse(todo_row.time_records || '[]')
              : todo_row.time_records;
            if (Array.isArray(p)) records = p;
          } catch (e) {}
          // 同时取模板级记录，用于 predictDuration（基于该模板最近 10 次完成时长中位数）
          // 模板级与实例级记录解耦：实例级用于"完成于"显示，模板级用于预估
          const pidForTpl = todo_row.parent_id;
          if (pidForTpl) {
            const tplRow = await env.DB.prepare(
              'SELECT time_records FROM todo_templates WHERE parent_id = ?'
            ).bind(pidForTpl).first();
            if (tplRow) {
              try {
                const tp = typeof tplRow.time_records === 'string'
                  ? JSON.parse(tplRow.time_records || '[]')
                  : tplRow.time_records;
                if (Array.isArray(tp)) template_records = tp;
              } catch (e) {}
            }
          }
        }
      } else if (parent_id) {
        // 兼容旧客户端：仅返回模板级记录
        const row = await env.DB.prepare(
          'SELECT time_records FROM todo_templates WHERE parent_id = ?'
        ).bind(parent_id).first();
        if (row && row.time_records) {
          try {
            const parsed = typeof row.time_records === 'string' ? JSON.parse(row.time_records) : row.time_records;
            if (Array.isArray(parsed)) records = parsed;
          } catch (e) {}
        }
      } else {
        return apiError("todo_id or parent_id required", 400);
      }
      return new Response(JSON.stringify({ records, template_records }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/todo-action' && request.method === 'POST') {
      let parsedBody;
      try {
        parsedBody = await request.json();
      } catch (e) {
        return apiError('请求体不是有效的 JSON', 400);
      }
      const { action, date, task, scope, ids, done_status, record, parent_id, timer_records, keep_records } = parsedBody;

      if (!action || typeof action !== 'string') {
        return apiError('action 为必填字段', 400);
      }
      const VALID_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'TOGGLE_DONE', 'TIMER_COMPLETE', 'TIMER_RECORD', 'UPDATE_SUBTASKS', 'UPDATE_SEARCH_TERMS', 'BATCH_TOGGLE_DONE', 'BATCH_DELETE'];
      if (!VALID_ACTIONS.includes(action)) {
        return apiError(`未知的 action: ${action}，有效值: ${VALID_ACTIONS.join(', ')}`, 400);
      }

      // 仅对 TOGGLE_DONE/TIMER_COMPLETE/BATCH_TOGGLE_DONE 的完成分支校验
      let effective_date = date;
      if (date && ['TOGGLE_DONE', 'TIMER_COMPLETE', 'BATCH_TOGGLE_DONE'].includes(action)) {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (date > todayStr) {
          effective_date = todayStr; // 纠正为今天，而非拒绝请求（保持幂等）
        }
      }

      if (action === 'TOGGLE_DONE') {
          // 先读取 todo 的 repeat_type，判断是否碎时记（fragment）
          // 碎时记分支：保留 time_records 历史累计，完成时冻结日期，取消勾选时重置开始日期
          let is_fragment = false;
          try {
            const row = await env.DB.prepare('SELECT type FROM todos WHERE id = ?').bind(task.id).first();
            if (row && row.type === 'fragment') is_fragment = true;
          } catch (e) { /* 读取失败按普通 todo 处理 */ }

          if (is_fragment) {
            if (!task.done) {
              // 取消勾选（done 1→0）：
              // - keep_records=true（"继续计时"按钮路径）：保留 time_records 历史累计
              // - keep_records=false/未传（checkbox 取消勾选）：清空 time_records，与普通重复 todo 一致
              // date 从 fragment_anchor 恢复（用户设置的起始日期），fragment_anchor 始终保留
              // 这样取消完成不会丢失用户设置的起始日期
              const should_keep_records = !!keep_records;
              try {
                if (should_keep_records) {
                  await env.DB.prepare('UPDATE todos SET done = 0, date = fragment_anchor WHERE id = ?')
                    .bind(task.id).run();
                } else {
                  await env.DB.prepare('UPDATE todos SET done = 0, date = fragment_anchor, time_records = ? WHERE id = ?')
                    .bind('[]', task.id).run();
                }
              } catch (e) {
                await env.DB.prepare('UPDATE todos SET done = 0 WHERE id = ?').bind(task.id).run();
              }
            } else {
              // 勾选完成（done 0→1）：冻结 date 为当前查看日期（完成日期）
              // fragment_anchor 不变（始终保留起始日期，供取消完成时恢复）
              // 若 record 是真实耗时（s<e），由前端通过 TIMER_COMPLETE 写入，这里只处理零耗时 record
              // 不写模板级（碎时记无模板）
              try {
                if (record && typeof record.s === 'number' && typeof record.e === 'number'
                    && record.s === record.e && record.s > 0) {
                  // 零耗时 record：仅记录完成时刻，不污染累计
                  const cur = await env.DB.prepare(
                    'SELECT time_records FROM todos WHERE id = ?'
                  ).bind(task.id).first();
                  let inst_arr = [];
                  try {
                    inst_arr = typeof cur.time_records === 'string'
                      ? JSON.parse(cur.time_records || '[]')
                      : cur.time_records;
                  } catch (e2) { inst_arr = []; }
                  if (!Array.isArray(inst_arr)) inst_arr = [];
                  inst_arr.push({ s: record.s, e: record.e, p: 0 });
                  // 碎时记不 FIFO 截断（保留全部历史 session 用于累计统计）
                  await env.DB.prepare(
                    'UPDATE todos SET done = 1, date = ?, time_records = ? WHERE id = ?'
                  ).bind(effective_date || '', JSON.stringify(inst_arr), task.id).run();
                } else {
                  await env.DB.prepare(
                    'UPDATE todos SET done = 1, date = ? WHERE id = ?'
                  ).bind(effective_date || '', task.id).run();
                }
              } catch (e) {
                await env.DB.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(task.id).run();
              }
            }
          }
          // 普通分支（原逻辑）：取消勾选时按 keep_records 决定是否清空实例级 time_records
          else if (!task.done) {
            let should_keep_records = false;
            if (keep_records) {
              try {
                const cur = await env.DB.prepare('SELECT done FROM todos WHERE id = ?')
                  .bind(task.id).first();
                // 仅当 DB 中当前 done=1 且请求改为 done=0 时，才允许保留 records
                should_keep_records = !!(cur && cur.done === 1);
              } catch (e) {
                // DB 读取失败：保守起见不清除（避免数据丢失），但也不信任 keep_records
                should_keep_records = false;
              }
            }
            if (should_keep_records) {
              try {
                await env.DB.prepare('UPDATE todos SET done = 0 WHERE id = ?')
                  .bind(task.id).run();
              } catch (e) {
                await env.DB.prepare('UPDATE todos SET done = 0 WHERE id = ?').bind(task.id).run();
              }
            } else {
              try {
                await env.DB.prepare('UPDATE todos SET done = 0, time_records = ? WHERE id = ?')
                  .bind('[]', task.id).run();
              } catch (e) {
                await env.DB.prepare('UPDATE todos SET done = 0 WHERE id = ?').bind(task.id).run();
              }
            }
          } else {
            // done 0→1：记录完成时刻（零耗时 record，s===e）。仅写实例级，不写模板级
            // （零耗时记录会污染 predictDuration 中位数）。真实耗时（s<e）走 TIMER_COMPLETE。
            // 注意：done 0→1 时 keep_records 无意义，强制清除旧 records 避免污染。
            try {
              if (record && typeof record.s === 'number' && typeof record.e === 'number'
                  && record.s === record.e && record.s > 0) {
                // 写入实例级 time_records（FIFO 5，复刻 bd3f88d）
                const cur = await env.DB.prepare(
                  'SELECT time_records FROM todos WHERE id = ?'
                ).bind(task.id).first();
                let inst_arr = [];
                if (cur && cur.time_records) {
                  try {
                    inst_arr = typeof cur.time_records === 'string'
                      ? JSON.parse(cur.time_records || '[]')
                      : cur.time_records;
                  } catch (e2) { inst_arr = []; }
                }
                if (!Array.isArray(inst_arr)) inst_arr = [];
                inst_arr.push({ s: record.s, e: record.e, p: 0 });
                // 普通重复 todo：FIFO 5 截断（复刻 bd3f88d）
                // 碎时记分支不走到这里（已在上面的 is_fragment 分支处理）
                if (inst_arr.length > 5) inst_arr = inst_arr.slice(inst_arr.length - 5);
                await env.DB.prepare(
                  'UPDATE todos SET done = 1, time_records = ? WHERE id = ?'
                ).bind(JSON.stringify(inst_arr), task.id).run();
              } else {
                await env.DB.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(task.id).run();
              }
            } catch (e) {
              await env.DB.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(task.id).run();
            }
          }
        }
        else if (action === 'TIMER_COMPLETE') {
          // 计时"完成"：标记 done=1 + 追加 session 到实例级（+ 模板级，仅普通 todo）
          // - 碎时记：实例级不截断 + 冻结 date 到完成日期 + 无模板级
          // - 普通 todo：实例级 FIFO 5 + 模板级 FIFO 10
          // record: { s, e, p }，校验 1s ≤ (e-s) ≤ 7d、p ≥ 0、p < (e-s)
          const todo_id = task && task.id;
          const pid = parent_id || (task && task.parent_id);
          if (!todo_id) return apiError("INVALID_PARAMS", 400);

          // 读取 repeat_type，区分碎时记 / 普通 todo
          let is_fragment = false;
          try {
            const row = await env.DB.prepare('SELECT type FROM todos WHERE id = ?').bind(todo_id).first();
            if (row && row.type === 'fragment') is_fragment = true;
          } catch (e) { /* 读取失败按普通 todo 处理 */ }

          // 标记完成（始终执行，即便记录写入失败也不阻断）
          // 碎时记完成时同时冻结 date（effective_date 已校验不超过今天）
          if (is_fragment) {
            try {
              await env.DB.prepare('UPDATE todos SET done = 1, date = ? WHERE id = ?')
                .bind(effective_date || '', todo_id).run();
            } catch (e) {
              await env.DB.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(todo_id).run();
            }
          } else {
            try {
              await env.DB.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(todo_id).run();
            } catch (eDone) {
              console.error("TIMER_COMPLETE mark done failed:", eDone);
            }
          }

          // 写入 time_records
          if (record && typeof record.s === 'number' && typeof record.e === 'number') {
            const s = Math.floor(record.s);
            const e = Math.floor(record.e);
            const p = Math.floor(record.p || 0);
            const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
            if (s > 0 && e > s && (e - s) <= MAX_DURATION_MS && p >= 0 && p < (e - s)) {
              // 实例级：碎时记不截断 / 普通 todo FIFO 5
              try {
                const cur = await env.DB.prepare(
                  'SELECT time_records FROM todos WHERE id = ?'
                ).bind(todo_id).first();
                let inst_arr = [];
                if (cur && cur.time_records) {
                  try {
                    inst_arr = typeof cur.time_records === 'string'
                      ? JSON.parse(cur.time_records || '[]')
                      : cur.time_records;
                  } catch (e2) { inst_arr = []; }
                }
                if (!Array.isArray(inst_arr)) inst_arr = [];
                inst_arr.push({ s, e, p });
                if (!is_fragment && inst_arr.length > 5) inst_arr = inst_arr.slice(inst_arr.length - 5);
                await env.DB.prepare(
                  'UPDATE todos SET time_records = ? WHERE id = ?'
                ).bind(JSON.stringify(inst_arr), todo_id).run();
              } catch (eInst) {
                console.error("TIMER_COMPLETE per-instance record write failed:", eInst);
              }

              // 模板级：仅普通 todo（FIFO 10）；碎时记无模板，跳过
              if (!is_fragment && pid) {
                try {
                  const tpl = await env.DB.prepare(
                    'SELECT time_records FROM todo_templates WHERE parent_id = ?'
                  ).bind(pid).first();
                  if (tpl) {
                    let arr = [];
                    try { arr = Array.isArray(tpl.time_records) ? tpl.time_records : JSON.parse(tpl.time_records || '[]'); } catch (e2) { arr = []; }
                    if (!Array.isArray(arr)) arr = [];
                    arr.push({ s, e, p });
                    if (arr.length > 10) arr = arr.slice(arr.length - 10);
                    await env.DB.prepare(
                      'UPDATE todo_templates SET time_records = ? WHERE parent_id = ?'
                    ).bind(JSON.stringify(arr), pid).run();
                  }
                } catch (e3) {
                  console.error("TIMER_COMPLETE template record write failed:", e3);
                }
              }
            }
          }
        }
        else if (action === 'TIMER_RECORD') {
          // 计时"记录"：保存 session 到实例级 time_records，不标记完成，不写模板级
          // 碎时记独有；普通 todo 收到此 action 直接 no-op（返回 downgraded:true 兼容旧客户端）
          const todo_id = task && task.id;
          if (!todo_id) return apiError("INVALID_PARAMS", 400);

          let is_fragment = false;
          try {
            const row = await env.DB.prepare('SELECT type FROM todos WHERE id = ?').bind(todo_id).first();
            if (row && row.type === 'fragment') is_fragment = true;
          } catch (e) { /* 读取失败按普通 todo 处理，no-op */ }
          if (!is_fragment) {
            return new Response(JSON.stringify({ ok: true, downgraded: true }), { headers: { 'Content-Type': 'application/json' } });
          }

          if (record && typeof record.s === 'number' && typeof record.e === 'number') {
            const s = Math.floor(record.s);
            const e = Math.floor(record.e);
            const p = Math.floor(record.p || 0);
            const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
            if (s > 0 && e > s && (e - s) <= MAX_DURATION_MS && p >= 0 && p < (e - s)) {
              try {
                const cur = await env.DB.prepare(
                  'SELECT time_records FROM todos WHERE id = ?'
                ).bind(todo_id).first();
                let inst_arr = [];
                if (cur && cur.time_records) {
                  try {
                    inst_arr = typeof cur.time_records === 'string'
                      ? JSON.parse(cur.time_records || '[]')
                      : cur.time_records;
                  } catch (e2) { inst_arr = []; }
                }
                if (!Array.isArray(inst_arr)) inst_arr = [];
                inst_arr.push({ s, e, p });
                await env.DB.prepare(
                  'UPDATE todos SET time_records = ? WHERE id = ?'
                ).bind(JSON.stringify(inst_arr), todo_id).run();
              } catch (eInst) {
                console.error("TIMER_RECORD per-instance record write failed:", eInst);
              }
            }
          }
        }
        else if (action === 'UPDATE_SUBTASKS') {
          await env.DB.prepare('UPDATE todos SET subtasks = ? WHERE id = ?')
            .bind(JSON.stringify(task.subtasks ||[]), task.id).run();
        }
        else if (action === 'UPDATE_SEARCH_TERMS') {
          await env.DB.prepare('UPDATE todos SET search_terms = ? WHERE id = ?')
            .bind(JSON.stringify(task.search_terms ||[]), task.id).run();
        }
        else if (action === 'BATCH_TOGGLE_DONE') {
          if (ids && ids.length > 0) {
            // 自动分片查询 repeat_type，汇总 fragment/plain 分类
            let fragmentIds = [];
            let fragment_id_set = new Set();
            let plainIds = [];
            for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
              const ph = sqlPlaceholders(chunk.length);
              try {
                const rows = await env.DB.prepare(
                  `SELECT id, type FROM todos WHERE id IN (${ph})`
                ).bind(...chunk).all();
                for (const r of (rows.results || [])) {
                  if (r.type === 'fragment') {
                    fragmentIds.push(r.id);
                    fragment_id_set.add(r.id);
                  } else {
                    plainIds.push(r.id);
                  }
                }
              } catch (e) {
                // 单片查询失败不阻断整体流程
              }
            }

            // 批量取消勾选
            if (!done_status) {
              // 碎时记：清空 time_records，done=0，date 从 fragment_anchor 恢复
              const runFragmentUncomplete = async () => {
                for (const chunk of chunkArray(fragmentIds, BATCH_CHUNK_SIZE)) {
                  const frPh = sqlPlaceholders(chunk.length);
                  try {
                    await env.DB.prepare(`UPDATE todos SET done = 0, date = fragment_anchor, time_records = ? WHERE id IN (${frPh})`)
                      .bind('[]', ...chunk).run();
                  } catch (e) {
                    try {
                      await env.DB.prepare(`UPDATE todos SET done = 0 WHERE id IN (${frPh})`)
                        .bind(...chunk).run();
                    } catch (e2) {}
                  }
                }
              };
              const runPlainUncomplete = async () => {
                for (const chunk of chunkArray(plainIds, BATCH_CHUNK_SIZE)) {
                  const plPh = sqlPlaceholders(chunk.length);
                  try {
                    await env.DB.prepare(`UPDATE todos SET done = 0, time_records = ? WHERE id IN (${plPh})`)
                      .bind('[]', ...chunk).run();
                  } catch (e) {
                    try {
                      await env.DB.prepare(`UPDATE todos SET done = 0 WHERE id IN (${plPh})`)
                        .bind(...chunk).run();
                    } catch (e2) {}
                  }
                }
              };
              await Promise.all([runFragmentUncomplete(), runPlainUncomplete()]);
            } else {
              // 批量完成
              // 碎时记：冻结 date 为完成日期，但仅对未完成项（done=0）执行
              const runFragmentComplete = async () => {
                for (const chunk of chunkArray(fragmentIds, BATCH_CHUNK_SIZE)) {
                  const frPh = sqlPlaceholders(chunk.length);
                  try {
                    await env.DB.prepare(`UPDATE todos SET done = 1, date = ? WHERE id IN (${frPh}) AND done = 0`)
                      .bind(effective_date || '', ...chunk).run();
                  } catch (e) {
                    try {
                      await env.DB.prepare(`UPDATE todos SET done = 1 WHERE id IN (${frPh}) AND done = 0`)
                        .bind(...chunk).run();
                    } catch (e2) {}
                  }
                }
              };
              const runPlainComplete = async () => {
                for (const chunk of chunkArray(plainIds, BATCH_CHUNK_SIZE)) {
                  const plPh = sqlPlaceholders(chunk.length);
                  try {
                    await env.DB.prepare(`UPDATE todos SET done = 1 WHERE id IN (${plPh}) AND done = 0`)
                      .bind(...chunk).run();
                  } catch (e) {
                    // 单片失败不阻断整体流程
                  }
                }
              };
              await Promise.all([runFragmentComplete(), runPlainComplete()]);
            }

            // 批量完成时：对带 record 的 todo 写入 time_records
            // timer_records: [{ id, parent_id, record: {s, e, p} }]
            // - 真实耗时（s<e）：实例级 + 模板级双写（与 TIMER_COMPLETE 一致；碎时记跳过模板级）
            // - 零耗时（s===e）：仅实例级，不写模板级（与 TOGGLE_DONE 一致，
            //   避免零耗时记录污染 predictDuration 中位数预估）
            if (done_status && Array.isArray(timer_records) && timer_records.length > 0) {
              const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
              // 过滤+校验 record
              const valid_items = [];
              for (const item of timer_records) {
                if (!item || !item.id || !item.record) continue;
                const rec = item.record;
                if (typeof rec.s !== 'number' || typeof rec.e !== 'number') continue;
                const s = Math.floor(rec.s);
                const e = Math.floor(rec.e);
                const p = Math.floor(rec.p || 0);
                if (!(s > 0 && e >= s && (e - s) <= MAX_DURATION_MS && p >= 0 && p <= (e - s))) continue;
                valid_items.push({
                  id: item.id,
                  parent_id: item.parent_id,
                  is_fragment: fragment_id_set.has(item.id),
                  is_zero_duration: s === e,
                  s, e, p,
                });
              }

              // 批量预取实例级 time_records
              const instIds = [...new Set(valid_items.map(it => it.id))];
              const inst_time_records_map = new Map();
              for (const chunk of chunkArray(instIds, BATCH_CHUNK_SIZE)) {
                const ph = sqlPlaceholders(chunk.length);
                try {
                  const rows = await env.DB.prepare(`SELECT id, time_records FROM todos WHERE id IN (${ph})`).bind(...chunk).all();
                  for (const r of (rows.results || [])) {
                    let arr = [];
                    try {
                      arr = typeof r.time_records === 'string' ? JSON.parse(r.time_records || '[]') : r.time_records;
                    } catch (e2) { arr = []; }
                    if (!Array.isArray(arr)) arr = [];
                    inst_time_records_map.set(r.id, arr);
                  }
                } catch (e) {
                  // 单片查询失败不阻断整体流程
                }
              }

              // 批量预取模板级 time_records
              const tpl_parent_ids = [...new Set(
                valid_items
                  .filter(it => !it.is_zero_duration && !it.is_fragment && it.parent_id)
                  .map(it => it.parent_id)
              )];
              const tpl_time_records_map = new Map();
              for (const chunk of chunkArray(tpl_parent_ids, BATCH_CHUNK_SIZE)) {
                const ph = sqlPlaceholders(chunk.length);
                try {
                  const rows = await env.DB.prepare(`SELECT parent_id, time_records FROM todo_templates WHERE parent_id IN (${ph})`).bind(...chunk).all();
                  for (const r of (rows.results || [])) {
                    let arr = [];
                    try { arr = Array.isArray(r.time_records) ? r.time_records : JSON.parse(r.time_records || '[]'); } catch (e2) { arr = []; }
                    if (!Array.isArray(arr)) arr = [];
                    tpl_time_records_map.set(r.parent_id, arr);
                  }
                } catch (e) {
                  // 单片查询失败不阻断整体流程
                }
              }

              // Worker 内 merge
              const inst_updates = [];
              for (const it of valid_items) {
                const arr = inst_time_records_map.get(it.id);
                if (!arr) continue;
                arr.push({ s: it.s, e: it.e, p: it.p });
                if (!it.is_fragment && arr.length > 5) arr.splice(0, arr.length - 5);
                inst_updates.push({ id: it.id, time_records: JSON.stringify(arr) });
              }
              const tpl_updates = new Map();
              for (const it of valid_items) {
                if (it.is_zero_duration || it.is_fragment || !it.parent_id) continue;
                const arr = tpl_time_records_map.get(it.parent_id);
                if (!arr) continue;
                let target = tpl_updates.get(it.parent_id);
                if (!target) {
                  target = arr.slice();
                  tpl_updates.set(it.parent_id, target);
                }
                target.push({ s: it.s, e: it.e, p: it.p });
                if (target.length > 10) target.splice(0, target.length - 10);
              }

              // 分片 UPDATE 实例级
              for (const chunk of chunkArray(inst_updates, BATCH_CHUNK_SIZE)) {
                try {
                  const stmts = chunk.map(u => env.DB.prepare('UPDATE todos SET time_records = ? WHERE id = ?').bind(u.time_records, u.id));
                  await env.DB.batch(stmts);
                } catch (e) {
                  console.error('BATCH_TOGGLE_DONE batch inst update failed:', e);
                }
              }
              // 分片 UPDATE 模板级
              const tplUpdateArr = Array.from(tpl_updates.entries()).map(([pid, arr]) => ({ pid, time_records: JSON.stringify(arr) }));
              for (const chunk of chunkArray(tplUpdateArr, BATCH_CHUNK_SIZE)) {
                try {
                  const stmts = chunk.map(u => env.DB.prepare('UPDATE todo_templates SET time_records = ? WHERE parent_id = ?').bind(u.time_records, u.pid));
                  await env.DB.batch(stmts);
                } catch (e) {
                  console.error('BATCH_TOGGLE_DONE batch tpl update failed:', e);
                }
              }
            }
          }
        }
        else if (action === 'BATCH_DELETE') {
          if (ids && ids.length > 0) {
            // 自动分片查询重复任务信息（用于 exdate 维护）
            const tasks = [];
            for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
              const ph = sqlPlaceholders(chunk.length);
              try {
                const rows = await env.DB.prepare(`SELECT parent_id, date, type FROM todos WHERE id IN (${ph})`).bind(...chunk).all();
                for (const r of (rows.results || [])) tasks.push(r);
              } catch (e) {
                // 单片查询失败不阻断整体流程
              }
            }

            // 自动分片标记软删除
            for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
              const ph = sqlPlaceholders(chunk.length);
              try {
                await env.DB.prepare(`UPDATE todos SET deleted = 1 WHERE id IN (${ph})`).bind(...chunk).run();
              } catch (e) {
                // 单片失败不阻断整体流程
              }
            }

            // 为重复任务添加 exdate（碎时记无模板，跳过）
            const exdateUpdates = {};
            for (const t of tasks) {
              if (t.type === 'recurring') {
                if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
                exdateUpdates[t.parent_id].push(t.date);
              }
            }
            const parentIds = Object.keys(exdateUpdates);
            const tplExdatesMap = new Map();
            for (const chunk of chunkArray(parentIds, BATCH_CHUNK_SIZE)) {
              const ph = sqlPlaceholders(chunk.length);
              try {
                const rows = await env.DB.prepare(`SELECT parent_id, exdates FROM todo_templates WHERE parent_id IN (${ph})`).bind(...chunk).all();
                for (const r of (rows.results || [])) tplExdatesMap.set(r.parent_id, r.exdates || '[]');
              } catch (e) {
                // 单片查询失败不阻断整体流程
              }
            }
            const exdateStmts = [];
            for (const pid of parentIds) {
              const currentExdates = tplExdatesMap.get(pid);
              if (currentExdates === undefined) continue;
              let new_exdates = currentExdates;
              let changed = false;
              for (const d of exdateUpdates[pid]) {
                const next = addExdate(new_exdates, d);
                if (next !== new_exdates) { new_exdates = next; changed = true; }
              }
              if (changed) exdateStmts.push(env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, pid));
            }
            for (const chunk of chunkArray(exdateStmts, BATCH_CHUNK_SIZE)) {
              try { await env.DB.batch(chunk); } catch (e) {
                // 单批 exdate 维护失败不阻断整体流程
              }
            }
          }
        }
        else if (action === 'CREATE') {
          if (!task || !task.id || typeof task.id !== 'string' || !task.id.trim()) {
            return apiError('task.id 为必填字段且不能为空字符串', 400);
          }
          if (!task.text || typeof task.text !== 'string' || !task.text.trim()) {
            return apiError('task.text 为必填字段', 400);
          }

          // ====== v1.0 type 字段校验 ======
          // type 三态：none / fragment / recurring
          // 旧 repeat_type (daily/weekly/monthly/yearly) 已废弃，传入返回 400
          let type = task.type || 'none';
          if (type !== 'none' && type !== 'fragment' && type !== 'recurring') {
            return apiError(`无效的 type: ${type}，v1.0 有效值: none / fragment / recurring（旧 repeat_type 已废弃）`, 400);
          }
          // 拒绝旧字段（v1.0 破坏性变更，强制调用方迁移）
          if (task.repeat_type !== undefined || task.repeat_custom !== undefined ||
              task.repeat_interval !== undefined || task.repeat_end !== undefined) {
            return apiError('v1.0 已废弃 repeat_type / repeat_custom / repeat_interval / repeat_end 字段，请改用 type + rrule + anchor_date + exdates', 400);
          }

          // ====== rrule 校验 ======
          // type=recurring 时 rrule 必填；type=none/fragment 时 rrule 必须为空
          const rruleResult = processRRule(task.rrule, type, { allowDerive: true });
          if (rruleResult.error) return apiError(rruleResult.error, 400);
          let final_rrule = rruleResult.value;
          // type=recurring 但 rrule 为空 → 400
          if (type === 'recurring' && !final_rrule) {
            return apiError('type=recurring 时 rrule 不能为空，请提供合法 RFC 5545 RRULE 字符串', 400);
          }
          // type=none/fragment 强制 rrule=''（即使调用方传了，也清空）
          if (type === 'none' || type === 'fragment') {
            final_rrule = '';
          }

          // ====== exdates 校验 ======
          const exdatesResult = validateExdates(task.exdates);
          if (exdatesResult.error) return apiError(exdatesResult.error, 400);
          const final_exdates = exdatesResult.value;

          // ====== 碎时记特殊约束 ======
          // fragment：强制清空 time / end_time，date 可空，fragment_anchor = date
          const is_fragment = (type === 'fragment');
          const effectiveEndTime = is_fragment ? '' : (task.end_time || '');
          const effectiveTime = is_fragment ? '' : (task.time || '');

          // ====== 日期校验 ======
          // API_Wiki §3.2 文档要求 date 在 body 顶层，但外部调用方常按 V1 风格放在 task.date
          const fallbackDate = date || (task && task.date) || '';
          // 非碎时记必须有有效日期；碎时记允许空（浮动）
          if (!is_fragment && !fallbackDate) {
            return apiError('date 为必填项（碎时记允许为空），请传顶层 date 或 task.date', 400);
          }
          if (fallbackDate) {
            const dateErr = validateDateFormat(fallbackDate);
            if (dateErr) return apiError(dateErr, 400);
          }
          if (effectiveTime) {
            const tfErr = validateTimeFormat(effectiveTime);
            if (tfErr) return apiError(tfErr, 400);
          }
          if (effectiveEndTime) {
            const etErr = validateTimeFormat(effectiveEndTime);
            if (etErr) return apiError(etErr, 400);
          }

          const effective_date = fallbackDate;
          // anchor_date：recurring 时必填，= date；fragment/none 时为 ''
          const anchor_date = (type === 'recurring') ? effective_date : '';
          // fragment_anchor：仅 fragment 类型有值，= date
          const effective_fragment_anchor = is_fragment ? effective_date : '';
          const category_id = task.category_id || '';

          await env.DB.prepare(
            'INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, type, end_time, category_id, recurrence_id, is_exception, time_records, fragment_anchor, rrule, anchor_date, exdates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            task.id, task.id, effective_date, task.text, effectiveTime, normalizePriority(task.priority),
            task.desc || '', task.url || '', readCopyText(task), JSON.stringify(task.subtasks||[]), JSON.stringify(task.search_terms||[]),
            0, 0, type, effectiveEndTime, category_id,
            '', 0,  // recurrence_id, is_exception
            '[]',   // time_records
            effective_fragment_anchor,
            final_rrule, anchor_date, final_exdates
          ).run();

          // 仅 type=recurring 才创建模板
          if (type === 'recurring') {
              await env.DB.prepare(
                'INSERT INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(
                task.id, task.text, effectiveTime, normalizePriority(task.priority), task.desc || '', task.url || '', readCopyText(task),
                JSON.stringify(task.subtasks||[]), JSON.stringify(task.search_terms||[]),
                'recurring', effectiveEndTime, anchor_date, final_exdates, category_id, '[]', final_rrule
              ).run();
          }
        }
        else if (action === 'UPDATE') {
          if (!task || !task.id || typeof task.id !== 'string' || !task.id.trim()) {
            return apiError('task.id 为必填字段', 400);
          }
          // v1.0 拒绝旧字段（破坏性变更）
          if (task.repeat_type !== undefined || task.repeat_custom !== undefined ||
              task.repeat_interval !== undefined || task.repeat_end !== undefined) {
            return apiError('v1.0 已废弃 repeat_type / repeat_custom / repeat_interval / repeat_end 字段，请改用 type + rrule + anchor_date + exdates', 400);
          }
          // type 校验（PATCH 语义：未传时从 DB 回退）
          if (task.type !== undefined && task.type !== 'none' && task.type !== 'fragment' && task.type !== 'recurring') {
            return apiError(`无效的 type: ${task.type}，v1.0 有效值: none / fragment / recurring`, 400);
          }

          // V0 调用方（含外部 API）可能省略 parent_id（V1 风格），需要服务端补全
          let parent_id = task.parent_id;
          if (!parent_id) {
            try {
              const pid_row = await env.DB.prepare('SELECT parent_id FROM todos WHERE id = ?').bind(task.id).first();
              if (pid_row) parent_id = pid_row.parent_id;
            } catch (e) {}
          }
          if (!parent_id) {
            return apiError('无法确定 parent_id（任务不存在或未传 parent_id）', 400);
          }

          // 获取原始任务数据，用于 PATCH 语义回退 + 检测重复规则变更 + 正确判断 is_series
          let original_task = task;
          try {
            const orig = await env.DB.prepare('SELECT text, time, priority, desc, url, copy_text, type, end_time, category_id, subtasks, search_terms, done, date, parent_id, fragment_anchor, rrule, anchor_date, exdates FROM todos WHERE id = ?').bind(task.id).first();
            if (orig) {
              original_task = {
                ...task,
                text: orig.text, time: orig.time, priority: orig.priority,
                desc: orig.desc, url: orig.url, copy_text: orig.copy_text,
                type: orig.type, end_time: orig.end_time, category_id: orig.category_id,
                subtasks: orig.subtasks, search_terms: orig.search_terms,
                date: orig.date, parent_id: orig.parent_id,
                fragment_anchor: orig.fragment_anchor,
                rrule: orig.rrule, anchor_date: orig.anchor_date, exdates: orig.exdates,
                _orig_done: orig.done,
                _orig_date: orig.date,
                _orig_parent_id: orig.parent_id,
                _orig_type: orig.type,
                _orig_rrule: orig.rrule,
                _orig_anchor_date: orig.anchor_date,
                _orig_fragment_anchor: orig.fragment_anchor,
              };
              // task 传入的字段覆盖 DB 值（PATCH 语义）
              if (task.text !== undefined) original_task.text = task.text;
              if (task.time !== undefined) original_task.time = task.time;
              if (task.priority !== undefined) original_task.priority = task.priority;
              if (task.desc !== undefined) original_task.desc = task.desc;
              if (task.url !== undefined) original_task.url = task.url;
              if (task.copy_text !== undefined) original_task.copy_text = task.copy_text;
              if (task.type !== undefined) original_task.type = task.type;
              if (task.end_time !== undefined) original_task.end_time = task.end_time;
              if (task.category_id !== undefined) original_task.category_id = task.category_id;
              if (task.subtasks !== undefined) original_task.subtasks = task.subtasks;
              if (task.search_terms !== undefined) original_task.search_terms = task.search_terms;
              if (task.date !== undefined) original_task.date = task.date;
              if (task.rrule !== undefined) original_task.rrule = task.rrule;
              if (task.anchor_date !== undefined) original_task.anchor_date = task.anchor_date;
              if (task.exdates !== undefined) original_task.exdates = task.exdates;
            }
          } catch(e) {}

          // ====== PATCH 语义：未传字段从 DB 回退 ======
          let patchText       = original_task.text || '';
          let patchTime       = original_task.time || '';
          const patchPriority = original_task.priority || 'low';
          let patchDesc       = original_task.desc || '';
          let patchUrl        = original_task.url || '';
          let patchCopyText   = original_task.copy_text !== undefined ? original_task.copy_text : '';
          const patchSubtasks = task.subtasks !== undefined ? task.subtasks : parseJsonField(original_task.subtasks);
          const patchSearchTerms = task.search_terms !== undefined ? task.search_terms : parseJsonField(original_task.search_terms);
          let patchType       = original_task.type || 'none';
          let patchEndTime    = original_task.end_time || '';
          let patchCategoryId = original_task.category_id || '';
          let patchDate       = original_task.date || '';
          let patchRRule      = original_task.rrule || '';
          let patchAnchorDate = original_task.anchor_date || '';
          let patchExdates    = original_task.exdates || '[]';

          // ====== rrule 处理（PATCH 语义）======
          // - task.rrule === undefined：保留 DB 原值
          // - task.rrule === null / ''：显式清空（type 同步置 none）
          // - task.rrule 非空字符串：严格校验，失败返回 400
          if (task.rrule !== undefined) {
            if (task.rrule === null || ('' + task.rrule).trim() === '') {
              patchRRule = '';
              if (task.type === undefined) patchType = 'none';
            } else {
              const rruleResult = processRRule(task.rrule, patchType, { allowDerive: true });
              if (rruleResult.error) return apiError(rruleResult.error, 400);
              patchRRule = rruleResult.value;
              if (patchRRule && patchType === 'none') {
                // rrule 非空 + type=none → 反推为 recurring
                patchType = 'recurring';
              }
            }
          }

          // ====== exdates 处理（PATCH 语义）======
          if (task.exdates !== undefined) {
            const exdatesResult = validateExdates(task.exdates);
            if (exdatesResult.error) return apiError(exdatesResult.error, 400);
            patchExdates = exdatesResult.value;
          }

          // ====== fragment/none 强制清空 rrule ======
          if (patchType === 'fragment' || patchType === 'none') {
            patchRRule = '';
            patchAnchorDate = '';
            patchExdates = '[]';
          }
          // ====== recurring 必须有 rrule ======
          if (patchType === 'recurring' && !patchRRule) {
            return apiError('type=recurring 时 rrule 不能为空', 400);
          }
          // ====== recurring 必须有 anchor_date ======
          if (patchType === 'recurring') {
            if (!patchAnchorDate) patchAnchorDate = patchDate;
            if (!patchAnchorDate) {
              return apiError('type=recurring 时 anchor_date 不能为空（请传 task.anchor_date 或 task.date）', 400);
            }
          }

          // ====== 碎时记强制清空 time/end_time ======
          if (patchType === 'fragment') {
            patchTime = '';
            patchEndTime = '';
          }

          // ====== 原子组校验 ======
          if (patchDate) {
            const dateErr = validateDateFormat(patchDate);
            if (dateErr) return apiError(dateErr, 400);
          }
          if (patchTime) {
            const tfErr = validateTimeFormat(patchTime);
            if (tfErr) return apiError(tfErr, 400);
          }
          if (patchEndTime) {
            const etErr = validateTimeFormat(patchEndTime);
            if (etErr) return apiError(etErr, 400);
          }
          if (patchAnchorDate) {
            const adErr = validateDateFormat(patchAnchorDate);
            if (adErr) return apiError(adErr, 400);
          }

          if (patchType !== 'fragment' && !patchDate) {
            patchDate = date;
          }

          const type = patchType;
          const subtasks_str = JSON.stringify(patchSubtasks || []);
          const search_terms_str = JSON.stringify(patchSearchTerms || []);
          const end_time = patchEndTime;
          const category_id = patchCategoryId;
          const new_date = patchDate;
          const date_changed = new_date !== date;
          // is_series：原任务是系列 + 新类型不是 fragment（允许 fragment 强制脱离）
          const is_series = original_task._orig_type === 'recurring' && type !== 'fragment';

          if (scope && scope !== 'none' && !['this', 'thisAndFuture', 'all'].includes(scope)) {
            return apiError(`无效的 scope: ${scope}，有效值: this, thisAndFuture, all`, 400);
          }
          const effective_scope = is_series && (!scope || scope === 'none') ? 'this' : (scope || 'none');

          const new_values = {
            text: patchText,
            time: patchTime,
            priority: normalizePriority(patchPriority),
            desc: patchDesc,
            url: patchUrl,
            copy_text: patchCopyText !== undefined ? patchCopyText : '',
            subtasks: subtasks_str,
            search_terms: search_terms_str,
            type: type,
            rrule: patchRRule,
            anchor_date: patchAnchorDate,
            exdates: patchExdates,
            end_time: end_time,
            category_id: category_id,
            date: new_date,
          };

          if (!is_series) {
            // 原始任务不是循环的（none 或 fragment），或新值是 fragment（强制脱离旧系列）
            if (type === 'recurring') {
              // 单次 → 重复：更新 todo 并创建模板
              await env.DB.prepare(
                'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?'
              ).bind(new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, task.id).run();
              await env.DB.prepare(
                'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(
                task.id, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text,
                subtasks_str, search_terms_str, 'recurring', end_time, patchAnchorDate, patchExdates, category_id, '[]', patchRRule
              ).run();
            } else if (type === 'fragment' && parent_id && parent_id !== task.id) {
              // 重复 → 碎时记：脱离旧系列，给旧模板加 exdate
              let effective_update_date = new_date;
              let effective_fragment_anchor = new_date;
              if (original_task._orig_done === 1) {
                effective_update_date = original_task._orig_date || '';
                try {
                  const fa_row = await env.DB.prepare('SELECT fragment_anchor FROM todos WHERE id = ?').bind(task.id).first();
                  effective_fragment_anchor = (fa_row && fa_row.fragment_anchor) ? fa_row.fragment_anchor : '';
                } catch (e) { effective_fragment_anchor = ''; }
              }
              await env.DB.prepare(
                'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=?, fragment_anchor=? WHERE id=?'
              ).bind(task.id, effective_update_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, '', '', '[]', effective_fragment_anchor, task.id).run();
              const tpl = await env.DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first();
              if (tpl) {
                const new_exdates = addExdate(tpl.exdates || '[]', date);
                await env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, parent_id).run();
              }
            } else if (parent_id && parent_id !== task.id && type !== 'fragment') {
              // 重复 → 单次：脱离系列
              await env.DB.prepare(
                'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=?, fragment_anchor=? WHERE id=?'
              ).bind(task.id, new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'none', end_time, category_id, '', '', '[]', '', task.id).run();
              const tpl = await env.DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first();
              if (tpl) {
                const new_exdates = addExdate(tpl.exdates || '[]', date);
                await env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, parent_id).run();
              }
            } else {
              // 普通更新（none 或 fragment→fragment 或 fragment→none）
              let effective_update_date = new_date;
              let effective_fragment_anchor = (type === 'fragment') ? new_date : '';
              if (type === 'fragment' && original_task._orig_done === 1) {
                effective_update_date = original_task._orig_date || '';
                try {
                  const fa_row = await env.DB.prepare('SELECT fragment_anchor FROM todos WHERE id = ?').bind(task.id).first();
                  effective_fragment_anchor = (fa_row && fa_row.fragment_anchor) ? fa_row.fragment_anchor : '';
                } catch (e) { effective_fragment_anchor = ''; }
              }
              await env.DB.prepare(
                'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=?, fragment_anchor=? WHERE id=?'
              ).bind(effective_update_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, effective_fragment_anchor, task.id).run();
              // 原任务是系列主实例（id === parent_id）且新类型为 fragment/none 时，删除旧模板
              if ((type === 'fragment' || type === 'none') && original_task._orig_type === 'recurring' && original_task._orig_parent_id === task.id) {
                try {
                  await env.DB.prepare('DELETE FROM todo_templates WHERE parent_id = ?').bind(task.id).run();
                } catch (e) {}
              }
            }
          } else {
            const actions = computeUpdateActions({ task: original_task, date, scope: effective_scope, new_values, new_date });

            // Split 系列时生成新 parent_id
            let split_new_pid = null;
            if (actions.currentTodo && actions.currentTodo.split_series) {
              split_new_pid = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            }

            // Execute currentTodo action
            if (actions.currentTodo) {
              const cv = actions.currentTodo;
              if (cv.split_series) {
                // Split: 脱离旧系列，加入新系列（thisAndFuture + is_recurring）
                await env.DB.prepare(
                  'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?'
                ).bind(split_new_pid, new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, task.id).run();
              } else if (cv.detach_from_series) {
                // 脱离系列，变为单次任务
                await env.DB.prepare(
                  'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?'
                ).bind(task.id, new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'none', end_time, category_id, '', '', '[]', task.id).run();
              } else if (cv.is_recurring) {
                await env.DB.prepare(
                  'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?'
                ).bind(new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, task.id).run();
              } else {
                await env.DB.prepare(
                  'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?'
                ).bind(new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'none', end_time, category_id, '', '', '[]', task.id).run();
              }
            }

            // Execute pastTodos action (set repeat_end on past instances)
            // v1.0：pastTodos 的 set_repeat_end 语义改为给过去实例的 rrule 追加 UNTIL
            // 但这需要读出来逐条改 rrule，开销大；当前简化为不做（依赖模板截断实现"此日程及之后"语义）
            // 模板的 set_repeat_end 已通过删除未来实例 + 模板 rrule 不变实现

            // Handle future instances for thisAndFuture/all
            if (effective_scope === 'thisAndFuture') {
              if (type === 'recurring') {
                // Split: 删除旧系列中当前及之后的实例（新模板会重新生成）
                await env.DB.prepare(
                  'DELETE FROM todos WHERE parent_id=? AND id != ? AND date >= ? AND deleted = 0'
                ).bind(parent_id, task.id, date).run();
              } else {
                // 改为不重复：未来非回收站项真删除
                await env.DB.prepare(
                  'DELETE FROM todos WHERE parent_id=? AND id != ? AND date > ? AND deleted = 0'
                ).bind(parent_id, task.id, date).run();
              }
            } else if (effective_scope === 'all') {
              if (type === 'recurring') {
                const tmpl = actions.template;
                if (date_changed || (tmpl && tmpl.recurrence_changed)) {
                  await env.DB.prepare(
                    'DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0'
                  ).bind(parent_id, task.id).run();
                } else {
                  await env.DB.prepare(
                    'UPDATE todos SET text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE parent_id=? AND id != ? AND deleted = 0'
                  ).bind(new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, parent_id, task.id).run();
                }
              } else {
                await env.DB.prepare(
                  'DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0'
                ).bind(parent_id, task.id).run();
              }
            }

            // Execute template action
            if (actions.template) {
              const tmpl = actions.template;
              if (tmpl.type === 'add_exdate') {
                const tpl = await env.DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first();
                if (tpl) {
                  const currentExdates = tpl.exdates || '[]';
                  const new_exdates = addExdate(currentExdates, date);
                  await env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, parent_id).run();
                }
              } else if (tmpl.type === 'set_repeat_end') {
                // v1.0：旧模板截断 = 给旧模板的 rrule 追加 UNTIL=前一天T235959Z
                // 需读出 rrule，解析/修改/写回
                const prev_date = getPreviousDate(date);
                try {
                  const tpl_row = await env.DB.prepare('SELECT rrule FROM todo_templates WHERE parent_id = ?').bind(parent_id).first();
                  if (tpl_row && tpl_row.rrule) {
                    let rrule = tpl_row.rrule;
                    // 移除已有 UNTIL，追加新 UNTIL
                    rrule = rrule.replace(/;UNTIL=[^;]+/i, '');
                    rrule = rrule + ';UNTIL=' + prev_date.replace(/-/g, '') + 'T235959Z';
                    // 重新 sanitize 防御
                    const sanitized = sanitizeRRule(rrule);
                    if (sanitized) {
                      await env.DB.prepare('UPDATE todo_templates SET rrule = ? WHERE parent_id = ?').bind(sanitized, parent_id).run();
                    }
                  }
                } catch (e) {
                  console.error('set_repeat_end template rrule update failed:', e.message || e);
                }
              } else if (tmpl.type === 'update_all') {
                // all scope: 更新模板
                if (type === 'recurring') {
                  let existing_exdates = '[]';
                  let existing_time_records = '[]';
                  try {
                    const existing_tpl = await env.DB.prepare(
                      'SELECT exdates, time_records FROM todo_templates WHERE parent_id = ?'
                    ).bind(parent_id).first();
                    if (existing_tpl) {
                      existing_exdates = existing_tpl.exdates || '[]';
                      existing_time_records = existing_tpl.time_records || '[]';
                    }
                  } catch(e) {}

                  await env.DB.prepare(
                    'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                  ).bind(
                    parent_id, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text,
                    subtasks_str, search_terms_str, 'recurring', end_time, patchAnchorDate, existing_exdates, category_id, existing_time_records, patchRRule
                  ).run();
                }
              } else if (tmpl.type === 'delete') {
                await env.DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parent_id).run();
              }
            }

            // Execute insertTemplate action (Split: 创建新系列模板)
            if (actions.insertTemplate && split_new_pid) {
              const it = actions.insertTemplate;
              await env.DB.prepare(
                'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(
                split_new_pid, it.text, it.time, it.priority, it.desc, it.url, it.copy_text,
                it.subtasks, it.search_terms, 'recurring', it.end_time, it.anchor_date, it.exdates, it.category_id, '[]', it.rrule || ''
              ).run();
            }
          }
        }
        else if (action === 'DELETE') {
          let parent_id = task.parent_id;
          if (!parent_id) {
            try {
              const pid_row = await env.DB.prepare('SELECT parent_id FROM todos WHERE id = ?').bind(task.id).first();
              if (pid_row) parent_id = pid_row.parent_id;
            } catch (e) {}
          }
          // v1.0：从 DB 读取 type，确保 is_series 判断正确
          let delete_is_series = false;
          try {
            const orig = await env.DB.prepare('SELECT type FROM todos WHERE id = ?').bind(task.id).first();
            if (orig) {
              delete_is_series = orig.type === 'recurring';
            }
          } catch(e) {}

          if (scope && !['this', 'thisAndFuture', 'all'].includes(scope)) {
            return apiError(`无效的 scope: ${scope}，有效值: this, thisAndFuture, all`, 400);
          }
          const effective_delete_scope = delete_is_series && !scope ? 'this' : scope;
          if (!delete_is_series || !effective_delete_scope) {
            await env.DB.prepare('UPDATE todos SET deleted = 1 WHERE id = ?').bind(task.id).run();
          } else {
            const actions = computeDeleteActions({ task: {...task, type: 'recurring'}, date, scope: effective_delete_scope });

            if (actions.deleteTodoIds && actions.deleteTodoIds.length > 0) {
              for (const todo_id of actions.deleteTodoIds) {
                await env.DB.prepare('UPDATE todos SET deleted = 1 WHERE id = ?').bind(todo_id).run();
              }
            }

            if (actions.updateTemplate) {
              const tmpl = actions.updateTemplate;
              if (tmpl.type === 'add_exdate') {
                const tpl = await env.DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first();
                if (tpl) {
                  const currentExdates = tpl.exdates || '[]';
                  const new_exdates = addExdate(currentExdates, date);
                  await env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, parent_id).run();
                }
              } else if (tmpl.type === 'set_repeat_end') {
                // thisAndFuture: 软删除当前及以后实例，给模板 rrule 追加 UNTIL
                const prev_date = getPreviousDate(date);
                if (tmpl.also_delete_future) {
                  await env.DB.prepare(
                    'UPDATE todos SET deleted = 1, type=?, rrule=?, anchor_date=?, exdates=?, parent_id=id, time_records=? WHERE parent_id=? AND date >= ?'
                  ).bind('none', '', '', '[]', '[]', parent_id, date).run();
                }
                // 给模板 rrule 追加 UNTIL
                try {
                  const tpl_row = await env.DB.prepare('SELECT rrule FROM todo_templates WHERE parent_id = ?').bind(parent_id).first();
                  if (tpl_row && tpl_row.rrule) {
                    let rrule = tpl_row.rrule.replace(/;UNTIL=[^;]+/i, '');
                    rrule = rrule + ';UNTIL=' + prev_date.replace(/-/g, '') + 'T235959Z';
                    const sanitized = sanitizeRRule(rrule);
                    if (sanitized) {
                      await env.DB.prepare('UPDATE todo_templates SET rrule = ? WHERE parent_id = ?').bind(sanitized, parent_id).run();
                    }
                  }
                } catch (e) {}
              } else if (tmpl.type === 'delete_all') {
                // all: 软删除所有实例并删除模板，实例脱钩为单次
                await env.DB.prepare(
                  'UPDATE todos SET deleted = 1, type=?, rrule=?, anchor_date=?, exdates=?, parent_id=id, time_records=? WHERE parent_id=?'
                ).bind('none', '', '', '[]', '[]', parent_id).run();
                await env.DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parent_id).run();
              }
            }

            if (actions.deleteTemplate) {
              await env.DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parent_id).run();
            }
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return apiError('Not Found', 404);
    } catch (e) {
      if (e instanceof SyntaxError) {
        return apiError('请求体不是有效的 JSON', 400);
      }
      // D1 约束错误 → 409 Conflict
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('UNIQUE constraint') || msg.includes('SQLITE_CONSTRAINT')) {
        return apiError('数据约束冲突: ' + msg, 409);
      }
      // 其他错误 → 500
      return apiError(msg);
    }
}

export { handleRequest };
