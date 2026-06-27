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
  apiError
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
} from './recurring-engine.js';
import { handleV1Request, verifyApiKey, extractApiKey, getApiKeyScope } from './api-v1.js';

let isDbInitialized = false;

// 健壮性：批量操作自动分片工具（与 api-v1.js 一致）
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

// v3.0 统一命名：所有 task 对象属性一律使用 snake_case `copy_text`（与 DB 列名 / API_Wiki §4.2 / V1 API 一致）。
// 历史 camelCase `copyText` 已废弃，不再兼容读取（v3.0 破坏性变更）。
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

        // ==================== 基础表结构（首次部署） ====================
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
              repeat_type TEXT DEFAULT 'none',
              repeat_custom TEXT DEFAULT '',
              repeat_end TEXT DEFAULT '',
              end_time TEXT DEFAULT '',
              category_id TEXT DEFAULT '',
              recurrence_id TEXT DEFAULT '',
              is_exception INTEGER NOT NULL DEFAULT 0,
              repeat_interval INTEGER NOT NULL DEFAULT 1,
              time_records TEXT NOT NULL DEFAULT '[]',
              fragment_anchor TEXT NOT NULL DEFAULT ''
            )
          `),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)`),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)`),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_stats ON todos(date, deleted, priority, done, category_id, time)`),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS todo_templates (
              parent_id TEXT PRIMARY KEY,
              text TEXT, time TEXT, priority TEXT, desc TEXT, url TEXT,
              copy_text TEXT, subtasks TEXT, search_terms TEXT,
              repeat_type TEXT, repeat_custom TEXT, repeat_end TEXT DEFAULT '', end_time TEXT DEFAULT '',
              anchor_date TEXT,
              exdates TEXT DEFAULT '[]',
              category_id TEXT DEFAULT '',
              repeat_interval INTEGER NOT NULL DEFAULT 1,
              time_records TEXT NOT NULL DEFAULT '[]'
            )
          `),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)`),
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

        // ==================== 版本化增量迁移 ====================
        // db_schema 基线为 1。所有列与索引已在上方 CREATE TABLE / CREATE INDEX
        // 基础批次里一次性建出，新部署等同于全新状态，不依赖版本号判断。
        //
        // 当前没有运行时迁移代码。如未来需要新增字段/索引：
        // 1. 在上方 CREATE TABLE / CREATE INDEX 基础批次里加上对应定义（覆盖新部署）
        // 2. 在 Screenshots/migrate.html 离线迁移工具里加上对应字段补全（覆盖老用户）
        // 3. 递增 version.json 中的 db_schema 版本号
        // 4. 在下方添加 `if (currentSchema < N)` 块（运行时 ALTER TABLE 覆盖已部署老用户）
        //
        // 模板（仅作参考，需要时取消注释并替换为实际 SQL）：
        // if (currentSchema < 2) {
        //   try {
        //     await env.DB.prepare(`ALTER TABLE todos ADD COLUMN new_field TEXT NOT NULL DEFAULT ''`).run();
        //   } catch (e) {}
        // }

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
      // 避免用户拿到旧 HTML/JS 缓存，导致新代码"完全没效果"
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
      // 健壮性：校验 action
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
      const allWords = await fetchHotSearchData(provider);
      return new Response(JSON.stringify({ success: true, data: allWords }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/api/stats' && request.method === 'GET') {
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');
      if (!start || !end) return apiError("Date required", 400);

      // 服务端聚合：D1 batch 一次往返跑 6 条 GROUP BY，把数万行原始数据压缩为几十行聚合结果。
      // 收益：rows returned / 网络字节 / Worker 内存 / 客户端解析 全部从 O(N) 降为 O(log N)。
      // 索引依赖：idx_todos_date_done 覆盖 (date, deleted) + include (priority, done, category_id, time)。
      // 注意：D1 batch 顺序执行（非并行），但只占一次 HTTP 往返。
      // 统计 WHERE 子句：普通 todo 按 date 范围过滤，碎时记特殊处理
      // - 普通 todo: date 在 [start, end] 范围内
      // - 碎时记已完成: date（完成日期）在 [start, end] 范围内
      // - 碎时记未完成: date=''（浮动，按 end 日计数）OR date 在 [start, end] 范围内
      //   未完成碎时记若起始日期 < start 但仍活跃，按 end 日计数（它在 end 日可见）
      const baseWhere = `FROM todos WHERE deleted = 0 AND (
        (repeat_type != 'fragment' AND date >= ?1 AND date <= ?2)
        OR (repeat_type = 'fragment' AND done = 1 AND date >= ?1 AND date <= ?2)
        OR (repeat_type = 'fragment' AND done = 0 AND (date = '' OR (date >= ?1 AND date <= ?2)))
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
      // 健壮性：两个不同的 batch 概念
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
      // 防止导入文件携带畸形数据污染数据库，导致后续 JSON.parse 报错
      // 性能：99%+ 的行该字段为 undefined（旧导出）或 '[]'（新导出但未计时），
      // 首两个分支零开销短路，只有实际有记录的行才 JSON.parse。
      // 上万行导入估算额外 CPU < 5ms（远低于 Workers CPU 限制）。
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

      // 健壮性：multi-row VALUES INSERT 优化
      // D1 bound params/query 限制 100，单行 todos 23 列，4 行 = 92 params（留 8 余量）
      // 单行 templates 18 列，5 行 = 90 params（留 10 余量）
      // 性能：SQLite multi-row VALUES 比 N 个单行 INSERT 快 5-10x（减少 prepared statement 创建 + 网络往返）
      // DB.batch 内 statement 数量也减少 4-5 倍
      const TODO_ROWS_PER_INSERT = 4;  // 4 × 23 = 92 params
      const TEMPLATE_ROWS_PER_INSERT = 5;  // 5 × 18 = 90 params

      const TODO_COLUMNS = '(id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id, recurrence_id, is_exception, repeat_interval, time_records, fragment_anchor)';
      const TODO_ROW_PLACEHOLDER = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

      const TEMPLATE_COLUMNS = '(parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id, repeat_interval, time_records)';
      const TEMPLATE_ROW_PLACEHOLDER = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

      const TODO_BIND_EXTRACTOR = (t) => [
        t.id, t.parent_id, t.date, t.text, t.time || '', t.priority || 'low',
        t.desc || '', t.url || '', t.copy_text || '',
        safeStringify(t.subtasks), safeStringify(t.search_terms), t.done || 0, t.deleted || 0,
        t.repeat_type || 'none', t.repeat_custom || '', t.repeat_end || '', t.end_time || '', t.category_id || '',
        t.recurrence_id || '', t.is_exception || 0, t.repeat_interval || 1,
        safeTimeRecords(t.time_records),
        // fragment_anchor: 碎时记起始日期，导入时保留；非碎时记或旧数据为 ''
        t.fragment_anchor || ''
      ];

      const TEMPLATE_BIND_EXTRACTOR = (t) => {
        const exdates = t.exdates || '[]';
        return [
          t.parent_id, t.text || '', t.time || '', t.priority || 'low', t.desc || '', t.url || '', t.copy_text || '',
          safeStringify(t.subtasks), safeStringify(t.search_terms), t.repeat_type || 'none', t.repeat_custom || '', t.repeat_end || '', t.end_time || '', t.anchor_date || '', exdates, t.category_id || '', t.repeat_interval || 1,
          safeTimeRecords(t.time_records)
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

          // 健壮性：处理 buffer 内所有完整行，返回未完成的尾部
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
              // 健壮性：done=true 时 value 仍可能含数据（CF Workers 边界场景）
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
                  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)'),
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
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)'),
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
                env.DB.prepare('DROP INDEX IF EXISTS idx_templates_repeat_type'),
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
                    repeat_type TEXT DEFAULT 'none',
                    repeat_custom TEXT DEFAULT '',
                    repeat_end TEXT DEFAULT '',
                    end_time TEXT DEFAULT '',
                    category_id TEXT DEFAULT '',
                    recurrence_id TEXT DEFAULT '',
                    is_exception INTEGER NOT NULL DEFAULT 0,
                    repeat_interval INTEGER NOT NULL DEFAULT 1,
                    time_records TEXT NOT NULL DEFAULT '[]',
                    fragment_anchor TEXT NOT NULL DEFAULT ''
                  )
                `),
                env.DB.prepare(`CREATE INDEX idx_todos_cursor ON todos(date, deleted, id)`),
                env.DB.prepare(`CREATE INDEX idx_todos_parent_date_del ON todos(parent_id, date, deleted)`),
                env.DB.prepare(`CREATE INDEX idx_todos_stats ON todos(date, deleted, priority, done, category_id, time)`),
                env.DB.prepare(`
                  CREATE TABLE todo_templates (
                    parent_id TEXT PRIMARY KEY,
                    text TEXT, time TEXT, priority TEXT, desc TEXT, url TEXT,
                    copy_text TEXT, subtasks TEXT, search_terms TEXT,
                    repeat_type TEXT, repeat_custom TEXT, repeat_end TEXT DEFAULT '', end_time TEXT DEFAULT '',
                    anchor_date TEXT,
                    exdates TEXT DEFAULT '[]',
                    category_id TEXT DEFAULT '',
                    repeat_interval INTEGER NOT NULL DEFAULT 1,
                    time_records TEXT NOT NULL DEFAULT '[]'
                  )
                `),
                env.DB.prepare(`CREATE INDEX idx_templates_repeat_type ON todo_templates(repeat_type)`),
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
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)'),
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
                env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)'),
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
                  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)')
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
        const newId = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const catColor = (color && color.trim()) ? color.trim() : DEFAULT_CATEGORY_COLOR;
        await env.DB.prepare("INSERT INTO categories (id, name, color) VALUES (?, ?, ?)").bind(newId, name.trim(), catColor).run();
        return new Response(JSON.stringify({ success: true, id: newId, name: name.trim(), color: catColor }), { headers: { 'Content-Type': 'application/json' } });
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
      const { results } = await env.DB.prepare('SELECT * FROM todos WHERE deleted = 1 ORDER BY date DESC LIMIT 100').all();
      return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/trash-action' && request.method === 'POST') {
      let trashBodyV0;
      try { trashBodyV0 = await request.json(); } catch(e) { return apiError('请求体不是有效的 JSON', 400); }
      const { action, id, ids } = trashBodyV0;
      if (action === 'RESTORE') {
        const t = await env.DB.prepare('SELECT parent_id, date, repeat_type, repeat_end FROM todos WHERE id = ?').bind(id).first();
        await env.DB.prepare('UPDATE todos SET deleted = 0 WHERE id = ?').bind(id).run();
        // 仅当回收站行仍携带循环属性时才需判定 (this-scope 删除, 或旧版未脱钩的 thisAndFuture/all 行)
        // 新版 thisAndFuture/all 删除已在删除时脱钩为单次快照 (repeat_type='none', parent_id=id)，此处直接跳过。
        // 碎时记 (fragment) 无模板，直接恢复即可。
        // 对齐 RFC 5545 + Google Tasks 标准：停止/删除系列后恢复，实例为单次任务，不再重新激活循环。
        if (t && t.repeat_type && t.repeat_type !== 'none' && t.repeat_type !== 'fragment' && t.parent_id && t.parent_id !== id) {
          // 检查同日期是否已有活跃实例（避免恢复后出现重复）
          const existing = await env.DB.prepare(
            'SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 AND id != ? LIMIT 1'
          ).bind(t.parent_id, t.date, id).first();
          if (existing) {
            // 同日期已有活跃实例，恢复的实例脱离模板变为单次任务
            await env.DB.prepare(
              'UPDATE todos SET parent_id=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', repeat_interval=1 WHERE id=?'
            ).bind(id, id).run();
          } else {
            // 以模板的 repeat_end 为准判定系列是否仍覆盖此日期 (旧版按实例 repeat_end 判定，但实例 repeat_end 常为空导致漏判)
            const tpl = await env.DB.prepare('SELECT repeat_end, exdates FROM todo_templates WHERE parent_id = ?').bind(t.parent_id).first();
            if (tpl && (tpl.repeat_end === '' || tpl.repeat_end == null || tpl.repeat_end >= t.date)) {
              // 模板仍覆盖此日期: 视为"仅此日程"删除的恢复，从EXDATE移除此日期，重新并入系列
              const currentExdates = tpl.exdates || '[]';
              const newExdates = removeExdate(currentExdates, t.date);
              await env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(newExdates, t.parent_id).run();
            } else {
              // 模板已删除(旧版 all)或已截断至此日期之前(旧版 thisAndFuture): 无法并入系列，脱钩为单次任务
              await env.DB.prepare(
                'UPDATE todos SET parent_id=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', repeat_interval=1 WHERE id=?'
              ).bind(id, id).run();
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
              const rows = await env.DB.prepare(`SELECT id, parent_id, date, repeat_type, repeat_end FROM todos WHERE id IN (${ph})`).bind(...chunk).all();
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
          // 新版 thisAndFuture/all 删除时已脱钩为单次 (repeat_type='none', parent_id=id)，跳过
          // 对齐 RFC 5545 + Google Tasks: 模板已删除/截断的，恢复为单次任务，不重建系列
          // 健壮性：批量预取所有相关 template 和 existing，避免逐行查询撞 D1 50 queries/invocation 限制
          const candidateTasks = tasks.filter(t =>
            t.repeat_type && t.repeat_type !== 'none' && t.repeat_type !== 'fragment' && t.parent_id && t.parent_id !== t.id
          );
          const uniqueParentIds = [...new Set(candidateTasks.map(t => t.parent_id))];
          const tplMap = new Map();
          for (const chunk of chunkArray(uniqueParentIds, BATCH_CHUNK_SIZE)) {
            const ph = sqlPlaceholders(chunk.length);
            try {
              const rows = await env.DB.prepare(`SELECT parent_id, repeat_end, exdates FROM todo_templates WHERE parent_id IN (${ph})`).bind(...chunk).all();
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
            if (tpl && (tpl.repeat_end === '' || tpl.repeat_end == null || tpl.repeat_end >= t.date)) {
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
              await env.DB.prepare(`UPDATE todos SET parent_id=id, repeat_type='none', repeat_custom='', repeat_end='', repeat_interval=1 WHERE id IN (${ph})`).bind(...chunk).run();
            } catch (e) {
              // 单片失败不阻断整体流程
            }
          }

          // exdate 维护：复用预取的 tplMap，不再二次查询
          for (const pid of Object.keys(exdateUpdates)) {
            try {
              const tpl = tplMap.get(pid);
              if (tpl) {
                let currentExdates = tpl.exdates || '[]';
                let changed = false;
                for (const d of exdateUpdates[pid]) {
                  const newExdates = removeExdate(currentExdates, d);
                  if (newExdates !== currentExdates) {
                    currentExdates = newExdates;
                    changed = true;
                  }
                }
                if (changed) await env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(currentExdates, pid).run();
              }
            } catch (e) {
              // 单模板 exdate 维护失败不阻断整体流程
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
      // 查询当前日期的所有可见 todos：
      // - 普通 todo (repeat_type='none' 或 'daily'/'weekly'/'monthly'/'yearly')：date = ?
      // - 碎时记 (repeat_type='fragment')：
      //   - 已完成：date = ?（完成时冻结到完成日期，仅该日可见）
      //   - 未完成：date = '' OR date <= ?（开始日期 <= 当前日期，则每日可见）
      //   date='' 表示不限开始日期，视为任意日期都可见
      let results = [];
      const r = await env.DB.prepare(
        `SELECT * FROM todos WHERE deleted = 0 AND (
           (repeat_type != 'fragment' AND date = ?)
           OR (repeat_type = 'fragment' AND done = 1 AND date = ?)
           OR (repeat_type = 'fragment' AND done = 0 AND (date = '' OR date <= ?))
        )`
      ).bind(date, date, date).all();
      results = r.results || [];
      
      const targetDayOfWeek = String(getDayOfWeek(date));
      const targetDayOfMonth = date.slice(8, 10);
      const targetMonthDay   = date.slice(5, 10);
    
      // 使用 recurring-engine 计算重复事件（碎时记不走模板扩展，仅 daily/weekly/monthly/yearly）
      const templatesReq = await env.DB.prepare(`
        SELECT * FROM todo_templates t
        WHERE t.repeat_type IN ('daily','weekly','monthly','yearly')
        AND t.anchor_date <= ?
        AND (t.repeat_end = '' OR t.repeat_end IS NULL OR t.repeat_end >= ?)
        AND NOT EXISTS (
          SELECT 1 FROM todos td
          WHERE td.parent_id = t.parent_id
            AND td.date = ?
            AND td.deleted = 0
        )
      `).bind(date, date, date).all();
    
      const insertStmts = [];
      let newlyFetchedSearchTerms = null;
    
      if (templatesReq.results && templatesReq.results.length > 0) {
        for (const tpl of templatesReq.results) {
          let templateForEngine = { ...tpl, exdates: tpl.exdates || '[]' };

          // 使用 recurring-engine 判断此模板是否在目标日期生成实例
          if (!isOccurrenceOnDate(templateForEngine, date)) continue;
    
          const newId = crypto.randomUUID();
    
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
          ...tpl, id: newId, date: date, parent_id: tpl.parent_id, 
          done: 0, deleted: 0,
          subtasks: parsedSubtasks,
          search_terms: parsedSearchTerms,
          // 关键修复：模板的 time_records 是跨实例预估数据（供 predictDuration），
          // 不能带到新实例上。新实例的实例级 time_records 应为空（DB INSERT 也不写该列，默认 '[]'）。
          // 否则前端 getDetailTimeRecords() 会从 task.time_records 读到模板级记录，
          // 导致新实例错误显示历史累计（如 06.27 新实例显示 06.25+06.26 的累计）。
          time_records: '[]'
        };
        results.push(newRecord); 
      
        insertStmts.push(env.DB.prepare(
          'INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id, repeat_interval) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          newId, tpl.parent_id, date, tpl.text, tpl.time || '', tpl.priority || 'low',
          tpl.desc || '', tpl.url || '', tpl.copy_text || '',
          JSON.stringify(parsedSubtasks), JSON.stringify(parsedSearchTerms),
          0, 0, tpl.repeat_type || 'none', tpl.repeat_custom || '', tpl.repeat_end || '', tpl.end_time || '', tpl.category_id || '', tpl.repeat_interval || 1
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

        let rType = row.repeat_type || 'none';
        // 兜底：repeat_type 为无效值时默认 daily（防御迁移未覆盖的边界情况）
        // 'fragment' 是合法值（碎时记），不在此兜底范围内
        if (rType !== 'none' && rType !== 'fragment' && !['daily','weekly','monthly','yearly'].includes(rType)) rType = 'daily';

        return {
          ...row, 
          repeat_type: rType,
          repeat_custom: row.repeat_custom || '',
          repeat_end: row.repeat_end || '',
          end_time: row.end_time || '',
          // is_series: 重复系列（daily/weekly/monthly/yearly），碎时记 (fragment) 不算重复系列
          is_series: rType && rType !== 'none' && rType !== 'fragment',
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
      const todoId = url.searchParams.get('todo_id');
      const parentId = url.searchParams.get('parent_id');
      let records = [];
      let templateRecords = [];

      if (todoId) {
        // 实例级查询（推荐）：修复同一模板不同实例串台的问题
        const todoRow = await env.DB.prepare(
          'SELECT time_records, parent_id FROM todos WHERE id = ?'
        ).bind(todoId).first();
        if (todoRow) {
          try {
            const p = typeof todoRow.time_records === 'string'
              ? JSON.parse(todoRow.time_records || '[]')
              : todoRow.time_records;
            if (Array.isArray(p)) records = p;
          } catch (e) {}
          // 同时取模板级记录，用于 predictDuration（基于该模板最近 10 次完成时长中位数）
          // 模板级与实例级记录解耦：实例级用于"完成于"显示，模板级用于预估
          const pidForTpl = todoRow.parent_id;
          if (pidForTpl) {
            const tplRow = await env.DB.prepare(
              'SELECT time_records FROM todo_templates WHERE parent_id = ?'
            ).bind(pidForTpl).first();
            if (tplRow) {
              try {
                const tp = typeof tplRow.time_records === 'string'
                  ? JSON.parse(tplRow.time_records || '[]')
                  : tplRow.time_records;
                if (Array.isArray(tp)) templateRecords = tp;
              } catch (e) {}
            }
          }
        }
      } else if (parentId) {
        // 兼容旧客户端：仅返回模板级记录
        const row = await env.DB.prepare(
          'SELECT time_records FROM todo_templates WHERE parent_id = ?'
        ).bind(parentId).first();
        if (row && row.time_records) {
          try {
            const parsed = typeof row.time_records === 'string' ? JSON.parse(row.time_records) : row.time_records;
            if (Array.isArray(parsed)) records = parsed;
          } catch (e) {}
        }
      } else {
        return apiError("todo_id or parent_id required", 400);
      }
      return new Response(JSON.stringify({ records, templateRecords }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/todo-action' && request.method === 'POST') {
      let parsedBody;
      try {
        parsedBody = await request.json();
      } catch (e) {
        return apiError('请求体不是有效的 JSON', 400);
      }
      const { action, date, task, scope, ids, done_status, record, parent_id, timer_records, keep_records } = parsedBody;
      // v3.0 兼容：旧 camelCase 客户端可能仍传 doneStatus/timerRecords/keepRecords/parentId
      // 在使用点统一通过 snake_case 访问；下面做一次映射以保证健壮性。
      const doneStatus = done_status !== undefined ? done_status : parsedBody.doneStatus;
      const timerRecords = timer_records !== undefined ? timer_records : parsedBody.timerRecords;
      const keepRecords = keep_records !== undefined ? keep_records : parsedBody.keepRecords;
      const parentId = parent_id !== undefined ? parent_id : parsedBody.parentId;

      // 健壮性：校验 action 必填且有效
      if (!action || typeof action !== 'string') {
        return apiError('action 为必填字段', 400);
      }
      const VALID_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'TOGGLE_DONE', 'TIMER_COMPLETE', 'TIMER_RECORD', 'UPDATE_SUBTASKS', 'UPDATE_SEARCH_TERMS', 'BATCH_TOGGLE_DONE', 'BATCH_DELETE'];
      if (!VALID_ACTIONS.includes(action)) {
        return apiError(`未知的 action: ${action}，有效值: ${VALID_ACTIONS.join(', ')}`, 400);
      }

      // 健壮性：碎时记完成场景校验 date 不能是未来日期
      // 否则恶意/错误客户端可将 fragment 冻结到未来日期，导致它在未来前完全不可见
      // 仅对 TOGGLE_DONE/TIMER_COMPLETE/BATCH_TOGGLE_DONE 的完成分支校验
      let effectiveDate = date;
      if (date && ['TOGGLE_DONE', 'TIMER_COMPLETE', 'BATCH_TOGGLE_DONE'].includes(action)) {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (date > todayStr) {
          effectiveDate = todayStr; // 纠正为今天，而非拒绝请求（保持幂等）
        }
      }

      if (action === 'TOGGLE_DONE') {
          // 先读取 todo 的 repeat_type，判断是否碎时记（fragment）
          // 碎时记分支：保留 time_records 历史累计，完成时冻结日期，取消勾选时重置开始日期
          let isFragment = false;
          try {
            const row = await env.DB.prepare('SELECT repeat_type FROM todos WHERE id = ?').bind(task.id).first();
            if (row && row.repeat_type === 'fragment') isFragment = true;
          } catch (e) { /* 读取失败按普通 todo 处理 */ }

          if (isFragment) {
            if (!task.done) {
              // 取消勾选（done 1→0）：
              // - keepRecords=true（"继续计时"按钮路径）：保留 time_records 历史累计
              // - keepRecords=false/未传（checkbox 取消勾选）：清空 time_records，与普通重复 todo 一致
              // date 从 fragment_anchor 恢复（用户设置的起始日期），fragment_anchor 始终保留
              // 这样取消完成不会丢失用户设置的起始日期
              const shouldKeepRecords = !!keepRecords;
              try {
                if (shouldKeepRecords) {
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
                  let instArr = [];
                  try {
                    instArr = typeof cur.time_records === 'string'
                      ? JSON.parse(cur.time_records || '[]')
                      : cur.time_records;
                  } catch (e2) { instArr = []; }
                  if (!Array.isArray(instArr)) instArr = [];
                  instArr.push({ s: record.s, e: record.e, p: 0 });
                  // 碎时记不 FIFO 截断（保留全部历史 session 用于累计统计）
                  await env.DB.prepare(
                    'UPDATE todos SET done = 1, date = ?, time_records = ? WHERE id = ?'
                  ).bind(effectiveDate || '', JSON.stringify(instArr), task.id).run();
                } else {
                  await env.DB.prepare(
                    'UPDATE todos SET done = 1, date = ? WHERE id = ?'
                  ).bind(effectiveDate || '', task.id).run();
                }
              } catch (e) {
                await env.DB.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(task.id).run();
              }
            }
          }
          // 普通分支（原逻辑）：取消勾选时按 keepRecords 决定是否清空实例级 time_records
          else if (!task.done) {
            let shouldKeepRecords = false;
            if (keepRecords) {
              try {
                const cur = await env.DB.prepare('SELECT done FROM todos WHERE id = ?')
                  .bind(task.id).first();
                // 仅当 DB 中当前 done=1 且请求改为 done=0 时，才允许保留 records
                shouldKeepRecords = !!(cur && cur.done === 1);
              } catch (e) {
                // DB 读取失败：保守起见不清除（避免数据丢失），但也不信任 keepRecords
                shouldKeepRecords = false;
              }
            }
            if (shouldKeepRecords) {
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
            // 注意：done 0→1 时 keepRecords 无意义，强制清除旧 records 避免污染。
            try {
              if (record && typeof record.s === 'number' && typeof record.e === 'number'
                  && record.s === record.e && record.s > 0) {
                // 写入实例级 time_records（FIFO 5，复刻 bd3f88d）
                const cur = await env.DB.prepare(
                  'SELECT time_records FROM todos WHERE id = ?'
                ).bind(task.id).first();
                let instArr = [];
                if (cur && cur.time_records) {
                  try {
                    instArr = typeof cur.time_records === 'string'
                      ? JSON.parse(cur.time_records || '[]')
                      : cur.time_records;
                  } catch (e2) { instArr = []; }
                }
                if (!Array.isArray(instArr)) instArr = [];
                instArr.push({ s: record.s, e: record.e, p: 0 });
                // 普通重复 todo：FIFO 5 截断（复刻 bd3f88d）
                // 碎时记分支不走到这里（已在上面的 isFragment 分支处理）
                if (instArr.length > 5) instArr = instArr.slice(instArr.length - 5);
                await env.DB.prepare(
                  'UPDATE todos SET done = 1, time_records = ? WHERE id = ?'
                ).bind(JSON.stringify(instArr), task.id).run();
              } else {
                await env.DB.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(task.id).run();
              }
            } catch (e) {
              // 兜底：仅更新 done
              await env.DB.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(task.id).run();
            }
          }
        }
        else if (action === 'TIMER_COMPLETE') {
          // 计时"完成"：标记 done=1 + 追加 session 到实例级（+ 模板级，仅普通 todo）
          // - 碎时记：实例级不截断 + 冻结 date 到完成日期 + 无模板级
          // - 普通 todo：实例级 FIFO 5 + 模板级 FIFO 10
          // record: { s, e, p }，校验 1s ≤ (e-s) ≤ 7d、p ≥ 0、p < (e-s)
          const todoId = task && task.id;
          const pid = parentId || (task && task.parent_id);
          if (!todoId) return apiError("INVALID_PARAMS", 400);

          // 读取 repeat_type，区分碎时记 / 普通 todo
          let isFragment = false;
          try {
            const row = await env.DB.prepare('SELECT repeat_type FROM todos WHERE id = ?').bind(todoId).first();
            if (row && row.repeat_type === 'fragment') isFragment = true;
          } catch (e) { /* 读取失败按普通 todo 处理 */ }

          // 标记完成（始终执行，即便记录写入失败也不阻断）
          // 碎时记完成时同时冻结 date（effectiveDate 已校验不超过今天）
          if (isFragment) {
            try {
              await env.DB.prepare('UPDATE todos SET done = 1, date = ? WHERE id = ?')
                .bind(effectiveDate || '', todoId).run();
            } catch (e) {
              await env.DB.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(todoId).run();
            }
          } else {
            try {
              await env.DB.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(todoId).run();
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
                ).bind(todoId).first();
                let instArr = [];
                if (cur && cur.time_records) {
                  try {
                    instArr = typeof cur.time_records === 'string'
                      ? JSON.parse(cur.time_records || '[]')
                      : cur.time_records;
                  } catch (e2) { instArr = []; }
                }
                if (!Array.isArray(instArr)) instArr = [];
                instArr.push({ s, e, p });
                if (!isFragment && instArr.length > 5) instArr = instArr.slice(instArr.length - 5);
                await env.DB.prepare(
                  'UPDATE todos SET time_records = ? WHERE id = ?'
                ).bind(JSON.stringify(instArr), todoId).run();
              } catch (eInst) {
                console.error("TIMER_COMPLETE per-instance record write failed:", eInst);
              }

              // 模板级：仅普通 todo（FIFO 10）；碎时记无模板，跳过
              if (!isFragment && pid) {
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
          const todoId = task && task.id;
          if (!todoId) return apiError("INVALID_PARAMS", 400);

          let isFragment = false;
          try {
            const row = await env.DB.prepare('SELECT repeat_type FROM todos WHERE id = ?').bind(todoId).first();
            if (row && row.repeat_type === 'fragment') isFragment = true;
          } catch (e) { /* 读取失败按普通 todo 处理，no-op */ }
          if (!isFragment) {
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
                ).bind(todoId).first();
                let instArr = [];
                if (cur && cur.time_records) {
                  try {
                    instArr = typeof cur.time_records === 'string'
                      ? JSON.parse(cur.time_records || '[]')
                      : cur.time_records;
                  } catch (e2) { instArr = []; }
                }
                if (!Array.isArray(instArr)) instArr = [];
                instArr.push({ s, e, p });
                await env.DB.prepare(
                  'UPDATE todos SET time_records = ? WHERE id = ?'
                ).bind(JSON.stringify(instArr), todoId).run();
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
            let fragmentIdSet = new Set();
            let plainIds = [];
            for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
              const ph = sqlPlaceholders(chunk.length);
              try {
                const rows = await env.DB.prepare(
                  `SELECT id, repeat_type FROM todos WHERE id IN (${ph})`
                ).bind(...chunk).all();
                for (const r of (rows.results || [])) {
                  if (r.repeat_type === 'fragment') {
                    fragmentIds.push(r.id);
                    fragmentIdSet.add(r.id);
                  } else {
                    plainIds.push(r.id);
                  }
                }
              } catch (e) {
                // 单片查询失败不阻断整体流程
              }
            }

            // 批量取消勾选
            if (!doneStatus) {
              // 碎时记：清空 time_records，done=0，date 从 fragment_anchor 恢复
              // 健壮性：fragment 与 plain 并发执行（6 连接限内，2 个并发安全）
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
              // 健壮性：fragment 与 plain 并发执行
              const runFragmentComplete = async () => {
                for (const chunk of chunkArray(fragmentIds, BATCH_CHUNK_SIZE)) {
                  const frPh = sqlPlaceholders(chunk.length);
                  try {
                    await env.DB.prepare(`UPDATE todos SET done = 1, date = ? WHERE id IN (${frPh}) AND done = 0`)
                      .bind(effectiveDate || '', ...chunk).run();
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
            // timerRecords (legacy) / timer_records (v3.0): [{ id, parent_id, record: {s, e, p} }]
            // - 真实耗时（s<e）：实例级 + 模板级双写（与 TIMER_COMPLETE 一致；碎时记跳过模板级）
            // - 零耗时（s===e）：仅实例级，不写模板级（与 TOGGLE_DONE 一致，
            //   避免零耗时记录污染 predictDuration 中位数预估）
            // 健壮性：批量预取 + 分片 UPDATE，避免逐条 SELECT/UPDATE 撞 D1 50 queries/invocation 限制
            if (doneStatus && Array.isArray(timerRecords) && timerRecords.length > 0) {
              const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
              // 过滤+校验 record
              const validItems = [];
              for (const item of timerRecords) {
                if (!item || !item.id || !item.record) continue;
                const rec = item.record;
                if (typeof rec.s !== 'number' || typeof rec.e !== 'number') continue;
                const s = Math.floor(rec.s);
                const e = Math.floor(rec.e);
                const p = Math.floor(rec.p || 0);
                if (!(s > 0 && e >= s && (e - s) <= MAX_DURATION_MS && p >= 0 && p <= (e - s))) continue;
                validItems.push({
                  id: item.id,
                  parent_id: item.parent_id,
                  isFragment: fragmentIdSet.has(item.id),
                  isZeroDuration: s === e,
                  s, e, p,
                });
              }

              // 批量预取实例级 time_records
              const instIds = [...new Set(validItems.map(it => it.id))];
              const instTimeRecordsMap = new Map();
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
                    instTimeRecordsMap.set(r.id, arr);
                  }
                } catch (e) {
                  // 单片查询失败不阻断整体流程
                }
              }

              // 批量预取模板级 time_records
              const tplParentIds = [...new Set(
                validItems
                  .filter(it => !it.isZeroDuration && !it.isFragment && it.parent_id)
                  .map(it => it.parent_id)
              )];
              const tplTimeRecordsMap = new Map();
              for (const chunk of chunkArray(tplParentIds, BATCH_CHUNK_SIZE)) {
                const ph = sqlPlaceholders(chunk.length);
                try {
                  const rows = await env.DB.prepare(`SELECT parent_id, time_records FROM todo_templates WHERE parent_id IN (${ph})`).bind(...chunk).all();
                  for (const r of (rows.results || [])) {
                    let arr = [];
                    try { arr = Array.isArray(r.time_records) ? r.time_records : JSON.parse(r.time_records || '[]'); } catch (e2) { arr = []; }
                    if (!Array.isArray(arr)) arr = [];
                    tplTimeRecordsMap.set(r.parent_id, arr);
                  }
                } catch (e) {
                  // 单片查询失败不阻断整体流程
                }
              }

              // Worker 内 merge
              const instUpdates = [];
              for (const it of validItems) {
                const arr = instTimeRecordsMap.get(it.id);
                if (!arr) continue;
                arr.push({ s: it.s, e: it.e, p: it.p });
                if (!it.isFragment && arr.length > 5) arr.splice(0, arr.length - 5);
                instUpdates.push({ id: it.id, time_records: JSON.stringify(arr) });
              }
              const tplUpdates = new Map();
              for (const it of validItems) {
                if (it.isZeroDuration || it.isFragment || !it.parent_id) continue;
                const arr = tplTimeRecordsMap.get(it.parent_id);
                if (!arr) continue;
                let target = tplUpdates.get(it.parent_id);
                if (!target) {
                  target = arr.slice();
                  tplUpdates.set(it.parent_id, target);
                }
                target.push({ s: it.s, e: it.e, p: it.p });
                if (target.length > 10) target.splice(0, target.length - 10);
              }

              // 分片 UPDATE 实例级
              for (const chunk of chunkArray(instUpdates, BATCH_CHUNK_SIZE)) {
                try {
                  const stmts = chunk.map(u => env.DB.prepare('UPDATE todos SET time_records = ? WHERE id = ?').bind(u.time_records, u.id));
                  await env.DB.batch(stmts);
                } catch (e) {
                  console.error('BATCH_TOGGLE_DONE batch inst update failed:', e);
                }
              }
              // 分片 UPDATE 模板级
              const tplUpdateArr = Array.from(tplUpdates.entries()).map(([pid, arr]) => ({ pid, time_records: JSON.stringify(arr) }));
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
                const rows = await env.DB.prepare(`SELECT parent_id, date, repeat_type FROM todos WHERE id IN (${ph})`).bind(...chunk).all();
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
              if (t.repeat_type && t.repeat_type !== 'none' && t.repeat_type !== 'fragment') {
                if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
                exdateUpdates[t.parent_id].push(t.date);
              }
            }
            // 健壮性：批量预取所有相关 template 的 exdates，避免逐 parent 查询撞 D1 50 queries/invocation 限制
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
            for (const pid of parentIds) {
              try {
                const currentExdates = tplExdatesMap.get(pid);
                if (currentExdates === undefined) continue;
                let newExdates = currentExdates;
                let changed = false;
                for (const d of exdateUpdates[pid]) {
                  const next = addExdate(newExdates, d);
                  if (next !== newExdates) { newExdates = next; changed = true; }
                }
                if (changed) await env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(newExdates, pid).run();
              } catch (e) {
                // 单模板 exdate 维护失败不阻断整体流程
              }
            }
          }
        }
        else if (action === 'CREATE') {
          // 健壮性：校验 task.id 和 task.text
          if (!task || !task.id || typeof task.id !== 'string' || !task.id.trim()) {
            return apiError('task.id 为必填字段且不能为空字符串', 400);
          }
          if (!task.text || typeof task.text !== 'string' || !task.text.trim()) {
            return apiError('task.text 为必填字段', 400);
          }
          const rptType = task.repeat_type || 'none';
          // 健壮性：校验 repeat_type 合法值
          const VALID_REPEAT_TYPES = ['none', 'daily', 'weekly', 'monthly', 'yearly', 'fragment'];
          if (rptType !== 'none' && !VALID_REPEAT_TYPES.includes(rptType)) {
            return apiError(`无效的 repeat_type: ${rptType}`, 400);
          }
          const categoryId = task.category_id || '';
          // 碎时记 (repeat_type='fragment')：强制无开始/结束时间、无重复截止、间隔为1
          // 客户端已在 selectRepeat('fragment') 中清空相关字段，此处兜底防御（API 也能创建碎时记）
          // 碎时记允许 date 为空（表示不限开始日期，任意日期都可见）
          const isFragment = (rptType === 'fragment');
          const effectiveEndTime = isFragment ? '' : (task.end_time || '');
          const effectiveTime = isFragment ? '' : (task.time || '');
          const effectiveRepeatEnd = isFragment ? '' : (task.repeat_end || '');
          const effectiveRepeatInterval = isFragment ? 1 : (task.repeat_interval || 1);
          // 健壮性修复：date 顶层字段缺失时回退到 task.date（与 V1 行为对齐）
          // API_Wiki §3.2 文档要求 date 在 body 顶层，但外部调用方常按 V1 风格放在 task.date
          // 原 bug：非碎时记 + date 缺失 → D1_TYPE_ERROR 500（无指引性）
          const fallbackDate = date || (task && task.date) || '';
          // 非碎时记必须有有效日期；碎时记允许空（浮动）
          if (!isFragment && !fallbackDate) {
            return apiError('date 为必填项（碎时记允许为空），请传顶层 date 或 task.date', 400);
          }
          const effectiveDate = fallbackDate;
          // 碎时记：fragment_anchor 同步存起始日期（与 date 一致），作为取消完成时恢复的权威副本
          const effectiveFragmentAnchor = isFragment ? effectiveDate : '';
          await env.DB.prepare(
            'INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id, repeat_interval, fragment_anchor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            task.id, task.id, effectiveDate, task.text, effectiveTime, task.priority || 'low',
            task.desc || '', task.url || '', readCopyText(task), JSON.stringify(task.subtasks||[]), JSON.stringify(task.search_terms||[]),
            0, 0, rptType, '', effectiveRepeatEnd, effectiveEndTime, categoryId, effectiveRepeatInterval, effectiveFragmentAnchor
          ).run();

          // 仅 daily/weekly/monthly/yearly 才创建模板；碎时记 (fragment) 和 none 不创建
          if (rptType !== 'none' && rptType !== 'fragment') {
              await env.DB.prepare(
                'INSERT INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id, repeat_interval) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(
                task.id, task.text, effectiveTime, task.priority || 'low', task.desc || '', task.url || '', readCopyText(task),
                JSON.stringify(task.subtasks||[]), JSON.stringify(task.search_terms||[]), rptType, '', effectiveRepeatEnd, effectiveEndTime, effectiveDate, '[]', categoryId, task.repeat_interval || 1
              ).run();
          }
        }
        else if (action === 'UPDATE') {
          // 健壮性：校验 task.id
          if (!task || !task.id || typeof task.id !== 'string' || !task.id.trim()) {
            return apiError('task.id 为必填字段', 400);
          }
          const rptType = task.repeat_type || 'none';
          // 健壮性：校验 repeat_type 合法值
          const VALID_REPEAT_TYPES_UPD = ['none', 'daily', 'weekly', 'monthly', 'yearly', 'fragment'];
          if (task.repeat_type && !VALID_REPEAT_TYPES_UPD.includes(task.repeat_type)) {
            return apiError(`无效的 repeat_type: ${task.repeat_type}`, 400);
          }
          const subtasksStr = JSON.stringify(task.subtasks ||[]);
          const searchTermsStr = JSON.stringify(task.search_terms ||[]);
          const categoryId = task.category_id || '';
          const repeatEnd = task.repeat_end || '';
          const endTime = task.end_time || '';
          let newDate = (task.date !== undefined && task.date !== null) ? task.date : date;
          // 健壮性兜底：非 fragment 类型必须有有效具体日期
          // fragment 允许 date 为空（不限起始），但 none/daily/weekly/monthly/yearly 不允许
          // 前端已兜底，这里防御 API 直接调用或异常情况
          const rptTypeForCheck = task.repeat_type || 'none';
          if (rptTypeForCheck !== 'fragment' && !newDate) {
            newDate = date;
          }
          const dateChanged = newDate !== date;
          // 健壮性修复：parentId 缺失时从 DB 派生
          // 原 bug：UPDATE scope=all 不传 task.parent_id → DELETE FROM todos WHERE parent_id=undefined → 500
          // V0 调用方（含外部 API）可能省略 parent_id（V1 风格），需要服务端补全
          let parentId = task.parent_id;
          if (!parentId) {
            try {
              const pidRow = await env.DB.prepare('SELECT parent_id FROM todos WHERE id = ?').bind(task.id).first();
              if (pidRow) parentId = pidRow.parent_id;
            } catch (e) {}
          }
          if (!parentId) {
            return apiError('无法确定 parent_id（任务不存在或未传 parent_id）', 400);
          }

          // 获取原始任务数据，用于检测重复规则变更和正确判断 isSeries
          // 健壮性修复：同时取 text/time/priority/desc/url/copy_text 等字段，
          // 调用方按 V1 风格只传需要修改的字段时，缺失字段从 DB 回退，避免 500
          let originalTask = task;
          try {
            const orig = await env.DB.prepare('SELECT text, time, priority, desc, url, copy_text, repeat_type, repeat_interval, done, date, parent_id FROM todos WHERE id = ?').bind(task.id).first();
            if (orig) {
              originalTask = { ...task, repeat_type: orig.repeat_type, repeat_interval: orig.repeat_interval, _origDone: orig.done, _origDate: orig.date, _origParentId: orig.parent_id, _origRepeatType: orig.repeat_type };
              // 缺失字段从 DB 回退（V1 PATCH 风格：仅传需修改字段）
              if (task.text === undefined) originalTask.text = orig.text;
              if (task.time === undefined) originalTask.time = orig.time;
              if (task.priority === undefined) originalTask.priority = orig.priority;
              if (task.desc === undefined) originalTask.desc = orig.desc;
              if (task.url === undefined) originalTask.url = orig.url;
              if (task.copy_text === undefined) originalTask.copy_text = orig.copy_text || '';
            }
          } catch(e) {}

          // isSeries 基于数据库原始数据判断，而非前端提交的新值
          // 前端可能已将 repeat_type 改为 'none'，但原始任务仍是循环的
          // 碎时记 (fragment) 不算重复系列
          // 若新值是 fragment，强制按"非系列"处理：脱离旧系列 + 删除旧模板 + 不创建新模板
          const isSeries = originalTask.repeat_type && originalTask.repeat_type !== 'none' && originalTask.repeat_type !== 'fragment' && rptType !== 'fragment';
          // 健壮性：校验 scope 合法值
          if (scope && scope !== 'none' && !['this', 'thisAndFuture', 'all'].includes(scope)) {
            return apiError(`无效的 scope: ${scope}，有效值: this, thisAndFuture, all`, 400);
          }
          // 循环任务未指定 scope 时，默认 scope=this（仅更新此实例）
          const effectiveScope = isSeries && (!scope || scope === 'none') ? 'this' : (scope || 'none');

          const newValues = {
            text: originalTask.text,
            time: originalTask.time || '',
            priority: originalTask.priority || 'low',
            desc: originalTask.desc || '',
            url: originalTask.url || '',
            copy_text: readCopyText(originalTask),
            subtasks: subtasksStr,
            search_terms: searchTermsStr,
            repeat_type: rptType,
            repeat_custom: '',
            repeat_end: repeatEnd,
            end_time: endTime,
            category_id: categoryId,
            date: newDate,
            repeat_interval: task.repeat_interval || 1,
          };

          // 碎时记强制约束：若新值是 fragment，强制清空 time/end_time/repeat_end/repeat_interval
          // 防止 API 调用者绕过前端约束，向碎时记写入无意义字段
          if (rptType === 'fragment') {
            newValues.time = '';
            newValues.end_time = '';
            newValues.repeat_end = '';
            newValues.repeat_interval = 1;
          }

          if (!isSeries) {
            // 原始任务不是循环的（none 或 fragment），或新值是 fragment（强制脱离旧系列）
            if (rptType !== 'none' && rptType !== 'fragment') {
              // 单次任务 → 重复：更新 todo 并创建模板
              await env.DB.prepare(
                'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=?, repeat_interval=? WHERE id=?'
              ).bind(newDate, originalTask.text, originalTask.time || '', originalTask.priority || 'low', originalTask.desc || '', originalTask.url || '', readCopyText(task), subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, categoryId, task.repeat_interval || 1, task.id).run();
              await env.DB.prepare(
                'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id, repeat_interval) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(
                task.id, originalTask.text, originalTask.time || '', originalTask.priority || 'low', originalTask.desc || '', originalTask.url || '', readCopyText(task),
                subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, newDate, '[]', categoryId, task.repeat_interval || 1
              ).run();
            } else if (rptType === 'fragment' && parentId && parentId !== task.id) {
              // 重复 → 碎时记：脱离旧系列，删除旧模板（如果只剩这一个实例）
              // 碎时记 (fragment): date 列即起始日期（未完成时）或完成日期（已完成时）
              //   - 未完成：接受前端传入的 newDate（用户可能在编辑表单改了起始日期）
              //   - 已完成：date 是冻结的完成日期，不应被 UPDATE 改动，用 DB 原始值
              // fragment_anchor：未完成时同步为 newDate（新起始日期），已完成时保留原值
              let effectiveUpdateDate = newDate;
              let effectiveFragmentAnchor = newDate;
              if (originalTask._origDone === 1) {
                effectiveUpdateDate = originalTask._origDate || '';
                // 已完成时 fragment_anchor 保留原值（不从 task 读取，避免被前端污染）
                try {
                  const faRow = await env.DB.prepare('SELECT fragment_anchor FROM todos WHERE id = ?').bind(task.id).first();
                  effectiveFragmentAnchor = (faRow && faRow.fragment_anchor) ? faRow.fragment_anchor : '';
                } catch (e) { effectiveFragmentAnchor = ''; }
              }
              await env.DB.prepare(
                'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=?, repeat_interval=?, fragment_anchor=? WHERE id=?'
              ).bind(task.id, effectiveUpdateDate, originalTask.text, newValues.time, originalTask.priority || 'low', originalTask.desc || '', originalTask.url || '', readCopyText(task), subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, categoryId, newValues.repeat_interval, effectiveFragmentAnchor, task.id).run();
              // 给旧模板加 exdate 防止该日期重新生成实例
              const tpl = await env.DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parentId).first();
              if (tpl) {
                const newExdates = addExdate(tpl.exdates || '[]', date);
                await env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(newExdates, parentId).run();
              }
            } else if (parentId && parentId !== task.id && rptType !== 'fragment') {
              // 重复 → 单次：脱离系列
              await env.DB.prepare(
                'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', end_time=?, category_id=?, repeat_interval=1, fragment_anchor=? WHERE id=?'
              ).bind(task.id, newDate, originalTask.text, originalTask.time || '', originalTask.priority || 'low', originalTask.desc || '', originalTask.url || '', readCopyText(task), subtasksStr, searchTermsStr, endTime, categoryId, '', task.id).run();
              const tpl = await env.DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parentId).first();
              if (tpl) {
                const newExdates = addExdate(tpl.exdates || '[]', date);
                await env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(newExdates, parentId).run();
              }
            } else {
              // 普通更新（none 或 fragment→fragment 或 fragment→none）
              // 碎时记 (fragment): date 列即起始日期（未完成时）或完成日期（已完成时）
              //   - 未完成：接受前端传入的 newDate（用户可能在编辑表单改了起始日期）
              //   - 已完成：date 是冻结的完成日期，不应被 UPDATE 改动，用 DB 原始值
              // fragment_anchor：未完成时同步为 newDate，已完成时保留原值
              let effectiveUpdateDate = newDate;
              let effectiveFragmentAnchor = (rptType === 'fragment') ? newDate : '';
              if (rptType === 'fragment' && originalTask._origDone === 1) {
                // 已完成：保留冻结的完成日期
                effectiveUpdateDate = originalTask._origDate || '';
                // fragment_anchor 保留原值
                try {
                  const faRow = await env.DB.prepare('SELECT fragment_anchor FROM todos WHERE id = ?').bind(task.id).first();
                  effectiveFragmentAnchor = (faRow && faRow.fragment_anchor) ? faRow.fragment_anchor : '';
                } catch (e) { effectiveFragmentAnchor = ''; }
              }
              await env.DB.prepare(
                'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=?, repeat_interval=?, fragment_anchor=? WHERE id=?'
              ).bind(effectiveUpdateDate, originalTask.text, newValues.time, originalTask.priority || 'low', originalTask.desc || '', originalTask.url || '', readCopyText(task), subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, categoryId, newValues.repeat_interval, effectiveFragmentAnchor, task.id).run();
              // BUG 修复：原任务是系列主实例（id === parent_id）且新类型为 fragment 时，
              // 必须删除旧模板，否则旧模板会持续按原 daily/weekly 规则生成新实例（幽灵重复事项）
              if (rptType === 'fragment' && originalTask._origRepeatType
                  && originalTask._origRepeatType !== 'none'
                  && originalTask._origRepeatType !== 'fragment'
                  && originalTask._origParentId === task.id) {
                try {
                  await env.DB.prepare('DELETE FROM todo_templates WHERE parent_id = ?').bind(task.id).run();
                } catch (e) {}
              }
            }
          } else {
            const actions = computeUpdateActions({ task: originalTask, date, scope: effectiveScope, newValues, newDate });

            // Split 系列时生成新 parent_id
            let splitNewPid = null;
            if (actions.currentTodo && actions.currentTodo.splitSeries) {
              splitNewPid = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            }

            // Execute currentTodo action
            if (actions.currentTodo) {
              const cv = actions.currentTodo;
              if (cv.splitSeries) {
                // Split: 脱离旧系列，加入新系列（thisAndFuture + isRecurring）
                await env.DB.prepare(
                  'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=?, repeat_interval=? WHERE id=?'
                ).bind(splitNewPid, newDate, originalTask.text, originalTask.time || '', originalTask.priority || 'low', originalTask.desc || '', originalTask.url || '', readCopyText(task), subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, categoryId, task.repeat_interval || 1, task.id).run();
              } else if (cv.detachFromSeries) {
                // 脱离系列，变为单次任务（"仅此项"或 thisAndFuture 改为不重复）
                // 保留实例级 time_records：非重复 todo 详情面板也渲染只读计时区块
                // （显示"完成于 X"），清空会让历史完成记录消失。
                // 前端 confirmAction('save') 已 clearTimerState 清掉 localStorage 计时器，
                // 不会复活成"进行中"。
                await env.DB.prepare(
                  'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', end_time=?, category_id=?, repeat_interval=1 WHERE id=?'
                ).bind(task.id, newDate, originalTask.text, originalTask.time || '', originalTask.priority || 'low', originalTask.desc || '', originalTask.url || '', readCopyText(task), subtasksStr, searchTermsStr, endTime, categoryId, task.id).run();
              } else if (cv.isRecurring) {
                await env.DB.prepare(
                  'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=?, repeat_interval=? WHERE id=?'
                ).bind(newDate, originalTask.text, originalTask.time || '', originalTask.priority || 'low', originalTask.desc || '', originalTask.url || '', readCopyText(task), subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, categoryId, task.repeat_interval || 1, task.id).run();
              } else {
                await env.DB.prepare(
                  'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', category_id=?, repeat_interval=1 WHERE id=?'
                ).bind(newDate, originalTask.text, originalTask.time || '', originalTask.priority || 'low', originalTask.desc || '', originalTask.url || '', readCopyText(task), subtasksStr, searchTermsStr, categoryId, task.id).run();
              }
            }

            // Execute pastTodos action (set repeat_end on past instances)
            if (actions.pastTodos) {
              const pt = actions.pastTodos;
              if (pt.type === 'set_repeat_end') {
                const prevDate = getPreviousDate(date);
                await env.DB.prepare(
                  'UPDATE todos SET repeat_end=? WHERE parent_id=? AND date < ? AND repeat_type != \'none\' AND (repeat_end = \'\' OR repeat_end IS NULL) AND deleted = 0'
                ).bind(prevDate, parentId, date).run();
              }
            }

            // Handle future instances for thisAndFuture/all
            if (effectiveScope === 'thisAndFuture') {
              if (rptType !== 'none') {
                // Split: 删除旧系列中当前及之后的实例（新模板会重新生成）
                await env.DB.prepare(
                  'DELETE FROM todos WHERE parent_id=? AND id != ? AND date >= ? AND deleted = 0'
                ).bind(parentId, task.id, date).run();
              } else {
                // 改为不重复：未来非回收站项真删除
                await env.DB.prepare(
                  'DELETE FROM todos WHERE parent_id=? AND id != ? AND date > ? AND deleted = 0'
                ).bind(parentId, task.id, date).run();
              }
            } else if (effectiveScope === 'all') {
              if (rptType !== 'none') {
                const tmpl = actions.template;
                // 重复规则变更或日期变更时：删除其他实例，由模板重新生成
                // 仅非重复属性变更时：原地更新其他实例
                if (dateChanged || (tmpl && tmpl.recurrenceChanged)) {
                  await env.DB.prepare(
                    'DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0'
                  ).bind(parentId, task.id).run();
                } else {
                  await env.DB.prepare(
                    'UPDATE todos SET text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=?, repeat_interval=? WHERE parent_id=? AND id != ? AND deleted = 0'
                  ).bind(originalTask.text, originalTask.time || '', originalTask.priority || 'low', originalTask.desc || '', originalTask.url || '', readCopyText(task), subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, categoryId, task.repeat_interval || 1, parentId, task.id).run();
                }
              } else {
                // 改为不重复：其他非回收站项删除
                await env.DB.prepare(
                  'DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0'
                ).bind(parentId, task.id).run();
              }
            }

            // Execute template action
            if (actions.template) {
              const tmpl = actions.template;
              if (tmpl.type === 'add_exdate') {
                // "this" scope: add EXDATE to template
                const tpl = await env.DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parentId).first();
                if (tpl) {
                  const currentExdates = tpl.exdates || '[]';
                  const newExdates = addExdate(currentExdates, date);
                  await env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(newExdates, parentId).run();
                }
              } else if (tmpl.type === 'set_repeat_end') {
                // 旧模板截断：设置 repeat_end
                const prevDate = getPreviousDate(date);
                await env.DB.prepare('UPDATE todo_templates SET repeat_end=? WHERE parent_id=?').bind(prevDate, parentId).run();
              } else if (tmpl.type === 'update_all') {
                // all scope: 更新模板
                if (rptType !== 'none') {
                  // 保留现有 exdates 和 time_records，避免 INSERT OR REPLACE 误清。
                  // time_records 是模板级跨实例预估数据 (predictDuration)，即使在调整重复规则
                  // (如频率/间隔/截止) 时也应保留——只有「改为不重复」才应丢弃 (走 tmpl.type='delete')。
                  let existingExdates = '[]';
                  let existingTimeRecords = '[]';
                  try {
                    const existingTpl = await env.DB.prepare(
                      'SELECT exdates, time_records FROM todo_templates WHERE parent_id = ?'
                    ).bind(parentId).first();
                    if (existingTpl) {
                      existingExdates = existingTpl.exdates || '[]';
                      existingTimeRecords = existingTpl.time_records || '[]';
                    }
                  } catch(e) {}

                  await env.DB.prepare(
                    'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id, repeat_interval, time_records) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                  ).bind(
                    parentId, originalTask.text, originalTask.time || '', originalTask.priority || 'low', originalTask.desc || '', originalTask.url || '', readCopyText(task),
                    subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, newDate, existingExdates, categoryId, task.repeat_interval || 1, existingTimeRecords
                  ).run();
                }
              } else if (tmpl.type === 'delete') {
                await env.DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parentId).run();
              }
            }

            // Execute insertTemplate action (Split: 创建新系列模板)
            if (actions.insertTemplate && splitNewPid) {
              const it = actions.insertTemplate;
              await env.DB.prepare(
                'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id, repeat_interval) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(
                splitNewPid, it.text, it.time, it.priority, it.desc, it.url, it.copy_text,
                it.subtasks, it.search_terms, it.repeat_type, it.repeat_custom, it.repeat_end,
                it.end_time, it.anchor_date, it.exdates, it.category_id, it.repeat_interval
              ).run();
            }
          }
        }
        else if (action === 'DELETE') {
          const rptType = task.repeat_type || 'none';
          // 健壮性修复：与 UPDATE 路径一致，parentId 缺失时从 DB 派生
          let parentId = task.parent_id;
          if (!parentId) {
            try {
              const pidRow = await env.DB.prepare('SELECT parent_id FROM todos WHERE id = ?').bind(task.id).first();
              if (pidRow) parentId = pidRow.parent_id;
            } catch (e) {}
          }
          // DELETE 兜底：若仍无 parentId（任务不存在），后续 is_series 分支会跳过模板操作，无需 400
          // 从数据库获取原始 repeat_type，确保 is_series 判断正确
          // 碎时记 (fragment) 不算重复系列，直接软删除
          // v3.0：忽略前端传入的 isSeries（v2 历史字段），统一用 task.is_series 或 repeat_type 推导
          let deleteIsSeries = task.is_series || (rptType && rptType !== 'none' && rptType !== 'fragment');
          try {
            const orig = await env.DB.prepare('SELECT repeat_type FROM todos WHERE id = ?').bind(task.id).first();
            if (orig) {
              deleteIsSeries = orig.repeat_type && orig.repeat_type !== 'none' && orig.repeat_type !== 'fragment';
            }
          } catch(e) {}

          // 健壮性：校验 scope 合法值
          if (scope && !['this', 'thisAndFuture', 'all'].includes(scope)) {
            return apiError(`无效的 scope: ${scope}，有效值: this, thisAndFuture, all`, 400);
          }
          if (!deleteIsSeries || !scope) {
            // 非循环任务（含碎时记）: 直接软删除
            await env.DB.prepare('UPDATE todos SET deleted = 1 WHERE id = ?').bind(task.id).run();
          } else {
            const actions = computeDeleteActions({ task, date, scope });

            // Soft delete specified todo IDs
            if (actions.deleteTodoIds && actions.deleteTodoIds.length > 0) {
              for (const todoId of actions.deleteTodoIds) {
                await env.DB.prepare('UPDATE todos SET deleted = 1 WHERE id = ?').bind(todoId).run();
              }
            }

            // Execute template action
            if (actions.updateTemplate) {
              const tmpl = actions.updateTemplate;
              if (tmpl.type === 'add_exdate') {
                // "this" scope: add EXDATE to template
                const tpl = await env.DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parentId).first();
                if (tpl) {
                  const currentExdates = tpl.exdates || '[]';
                  const newExdates = addExdate(currentExdates, date);
                  await env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(newExdates, parentId).run();
                }
              } else if (tmpl.type === 'set_repeat_end') {
                // "thisAndFuture" scope: 截断模板 repeat_end，软删除当前及以后实例
                // 关键修复: 被软删除的实例在回收站中脱钩为单次任务快照 (repeat_type='none', parent_id=id)
                // 这样恢复时不会重新激活循环，对齐 Google Tasks "停止重复后不可再循环" 的标准语义
                // (RFC 5545 RANGE=THISANDFUTURE 等价: 模板 UNTIL 截断，被删实例视为脱离系列的冻结快照)
                // 同步清空实例级 time_records：脱钩后非重复，UI 不再渲染计时区块，旧记录为死数据。
                const prevDate = getPreviousDate(date);
                if (tmpl.alsoDeleteFuture) {
                  await env.DB.prepare(
                    'UPDATE todos SET deleted = 1, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', repeat_interval=1, parent_id=id, time_records=\'[]\' WHERE parent_id=? AND date >= ?'
                  ).bind(parentId, date).run();
                }
                // 过去实例保持活跃，设置 repeat_end 用于显示"每天·至日期"
                await env.DB.prepare('UPDATE todos SET repeat_end=? WHERE parent_id=? AND date < ? AND repeat_type != \'none\'').bind(prevDate, parentId, date).run();
                // 截断模板
                await env.DB.prepare('UPDATE todo_templates SET repeat_end=? WHERE parent_id=?').bind(prevDate, parentId).run();
              } else if (tmpl.type === 'delete_all') {
                // "all" scope: 软删除所有实例并删除模板
                // 关键修复: 所有实例 (含回收站中已有的同系列项) 脱钩为单次任务快照，避免恢复时重建整个循环系列
                // 同步清空实例级 time_records：脱钩后非重复，UI 不再渲染计时区块，旧记录为死数据。
                // 模板被 DELETE，模板级 time_records 随之销毁——这是「整个系列停止」的预期语义。
                await env.DB.prepare(
                  'UPDATE todos SET deleted = 1, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', repeat_interval=1, parent_id=id, time_records=\'[]\' WHERE parent_id=?'
                ).bind(parentId).run();
                await env.DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parentId).run();
              }
            }

            if (actions.deleteTemplate) {
              await env.DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parentId).run();
            }
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return apiError('Not Found', 404);
    } catch (e) {
      // 健壮性：区分错误类型返回不同 HTTP 状态码
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
