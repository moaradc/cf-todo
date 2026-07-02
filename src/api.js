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

// 阶段 2 起：旧 initDb 不再执行。
// - 真正的迁移交给 wrangler d1 migrations apply（部署时）。
// - 运行时由 src/middleware/init-db.ts 的 ensureMigrated 做诊断检查。
// - 此处 isDbInitialized=true 让 initDb 函数体在第一行就 early return（dead code，阶段 8 删）。
let isDbInitialized = true;

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

// 统一命名：所有 task 对象属性一律使用 snake_case `copy_text`（与 DB 列名 / V1 API 一致）。
// 历史 camelCase `copyText` 已废弃，不再兼容读取。
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

        // ==================== 基础表结构（首次部署，schema 1）====================
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
    
    // /api/custom-code 已迁移到 src/routes/v0/settings.ts（阶段 5.3）

    if (url.pathname === '/api/hot-search' && request.method === 'GET') {
      const provider = url.searchParams.get('provider') || 'auto';
      // 注：hot-search 不做服务端缓存，保证实时性（用户主动点「换一批」、创建带热搜的 todo 都需要最新数据）
      // fetchHotSearchData 内部已有 5s 超时 + 失败降级，足够健壮
      const all_words = await fetchHotSearchData(provider);
      return new Response(JSON.stringify({ success: true, data: all_words }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // /api/stats 已迁移到 src/routes/v0/stats.ts（阶段 5.4）

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

      // D1 bound params/query 限制 100
      // TODO_COLUMNS 21 列，4 行 = 84 params < 100 ✓
      // TEMPLATE_COLUMNS 16 列，6 行 = 96 params < 100 ✓
      const TODO_ROWS_PER_INSERT = 4;  // 4 × 21 = 84 params
      const TEMPLATE_ROWS_PER_INSERT = 6;  // 6 × 16 = 96 params

      const TODO_COLUMNS = '(id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, type, end_time, category_id, time_records, fragment_anchor, rrule, anchor_date, exdates)';
      const TODO_ROW_PLACEHOLDER = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

      const TEMPLATE_COLUMNS = '(parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule)';
      const TEMPLATE_ROW_PLACEHOLDER = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

      const TODO_BIND_EXTRACTOR = (t) => {
        // type 兜底：旧导出文件可能用 repeat_type；导入时映射
        let type = t.type;
        if (!type) {
          // 兼容旧版导出：从 repeat_type 推导
          const rpt = t.repeat_type;
          if (rpt === 'fragment') type = 'fragment';
          else if (rpt && ['daily','weekly','monthly','yearly'].includes(rpt)) type = 'recurring';
          else type = 'none';
        }
        // rrule 兜底：旧导出文件可能 rrule 为空但有旧字段；导入时合成
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

          safeTimeRecords(t.time_records),
          // fragment_anchor: 碎时记起始日期，导入时保留；非碎时记或旧数据为 ''
          t.fragment_anchor || '',
          // 规范字段
          rrule,
          // anchor_date: 优先用导出值，否则用 date 兜底
          t.anchor_date || t.date || '',
          // exdates: 优先用导出值，否则 '[]'
          t.exdates || '[]'
        ];
      };

      const TEMPLATE_BIND_EXTRACTOR = (t) => {
        const exdates = t.exdates || '[]';
        // type 兜底
        let type = t.type;
        if (!type) {
          const rpt = t.repeat_type;
          if (rpt && ['daily','weekly','monthly','yearly'].includes(rpt)) type = 'recurring';
          else type = 'recurring';  // 模板默认 recurring
        }
        // rrule 兜底
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
          let ndjsonPrefixSkipped = false;  // 跳过导出流的 'ndjson' 首行字面量

          const processBuffer = async () => {
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';  // 最后一段（可能不完整）留到下次
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              // 跳过导出流的 'ndjson' 首行字面量（非 JSON，是流类型标识）
              if (!ndjsonPrefixSkipped) {
                ndjsonPrefixSkipped = true;
                if (trimmed === 'ndjson') continue;
              }
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

    // /api/settings + /api/custom-* 已迁移到 src/routes/v0/settings.ts（阶段 5.3）


    // /api/categories + /api/category-action 已迁移到 src/routes/v0/categories.ts（阶段 5.1）


    // /api/trash + /api/trash-action 已迁移到 src/routes/v0/trash.ts（阶段 5.2）


    // /api/todos GET 已迁移到 src/routes/v0/todos.ts（阶段 5.5c）

    // /api/time-records 已迁移到 src/routes/v0/time-records.ts（阶段 5.5e）

    // /api/todo-action 已迁移到 src/routes/v0/todo-action.ts（阶段 5.5a + 5.5b）

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
