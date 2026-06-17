/*
 * Cloudflare Worker + D1 Todo App - API Handler
 */

import {
  APP_VERSION,
  DB_SCHEMA,
  DEFAULT_CATEGORY_COLOR,
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
              is_exception INTEGER NOT NULL DEFAULT 0
            )
          `),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)`),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)`),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS todo_templates (
              parent_id TEXT PRIMARY KEY,
              text TEXT, time TEXT, priority TEXT, desc TEXT, url TEXT, 
              copy_text TEXT, subtasks TEXT, search_terms TEXT, 
              repeat_type TEXT, repeat_custom TEXT, repeat_end TEXT DEFAULT '', end_time TEXT DEFAULT '',
              anchor_date TEXT,
              exdates TEXT DEFAULT '[]',
              category_id TEXT DEFAULT ''
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
        // 用整数版本号，每个版本只执行一次
        // 新增迁移：递增 db_schema 版本号，添加 if (currentSchema < N) 块

        // --- schema 1: v2.7.0 基础列（首次部署时需要） ---
        if (currentSchema < 1) {
          try { await env.DB.prepare(`ALTER TABLE export_sessions ADD COLUMN todos_cursor TEXT NOT NULL DEFAULT ''`).run(); } catch (e) {}
          try { await env.DB.prepare(`ALTER TABLE export_sessions ADD COLUMN templates_cursor TEXT NOT NULL DEFAULT ''`).run(); } catch (e) {}
          try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)`).run(); } catch (e) {}
          try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN copy_text TEXT`).run(); } catch (e) {}
          try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN subtasks TEXT`).run(); } catch (e) {}
          try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN search_terms TEXT`).run(); } catch (e) {}
          try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN repeat_type TEXT DEFAULT 'none'`).run(); } catch (e) {}
          try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN repeat_custom TEXT DEFAULT ''`).run(); } catch (e) {}
          try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN repeat_end TEXT DEFAULT ''`).run(); } catch (e) {}
          try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN end_time TEXT DEFAULT ''`).run(); } catch (e) {}
          try { await env.DB.prepare(`ALTER TABLE todo_templates ADD COLUMN repeat_end TEXT DEFAULT ''`).run(); } catch (e) {}
          try { await env.DB.prepare(`ALTER TABLE todo_templates ADD COLUMN end_time TEXT DEFAULT ''`).run(); } catch (e) {}
          try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN category_id TEXT DEFAULT ''`).run(); } catch (e) {}
          try { await env.DB.prepare(`ALTER TABLE todo_templates ADD COLUMN category_id TEXT DEFAULT ''`).run(); } catch (e) {}
        }

        // --- schema 2: v2.7.1 模板自动迁移 ---
        if (currentSchema < 2) {
          // 旧数据中 repeat=1 是重复的标记，repeat_type 可能为空
          try {
            const c = await env.DB.prepare("SELECT COUNT(*) as c FROM todo_templates").first();
            if (c && c.c === 0) {
              await env.DB.prepare(`
                INSERT OR IGNORE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates)
                SELECT parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, 
                  CASE WHEN (repeat_type IS NULL OR repeat_type = 'none' OR repeat_type = '') THEN 'daily' ELSE repeat_type END,
                  repeat_custom, '', '', date, '[]'
                FROM todos t1
                WHERE repeat = 1 AND deleted = 0 
                AND date = (SELECT MAX(date) FROM todos t2 WHERE t2.parent_id = t1.parent_id AND t2.repeat = 1 AND t2.deleted = 0)
              `).run();
            }
          } catch (e) {}
        }

        // --- schema 3: v2.7.2 RFC 5545 重构 ---
        if (currentSchema < 3) {
          // 1. 添加新列
          try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN recurrence_id TEXT DEFAULT ''`).run(); } catch (e) {}
          try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN is_exception INTEGER NOT NULL DEFAULT 0`).run(); } catch (e) {}
          try { await env.DB.prepare(`ALTER TABLE todo_templates ADD COLUMN exdates TEXT DEFAULT '[]'`).run(); } catch (e) {}

          // 2. 迁移 blacklist → exdates
          try {
            await env.DB.prepare(`UPDATE todo_templates SET exdates = blacklist WHERE exdates = '[]' AND blacklist IS NOT NULL AND blacklist != '[]'`).run();
          } catch (e) {}

          // 3. 彻底移除 blacklist 列
          try { await env.DB.prepare(`ALTER TABLE todo_templates DROP COLUMN blacklist`).run(); } catch (e) {}

          // 4. 修复 repeat 列脏数据，为移除 repeat 列做准备
          //    repeat=-1 但 repeat_type='none'：信息丢失，从模板恢复或默认 daily
          try {
            await env.DB.prepare(`
              UPDATE todos SET repeat_type = COALESCE(
                (SELECT t.repeat_type FROM todo_templates t WHERE t.parent_id = todos.parent_id),
                'daily'
              ) WHERE repeat = -1 AND (repeat_type = 'none' OR repeat_type IS NULL OR repeat_type = '')
            `).run();
          } catch (e) {}
          //    repeat=0 但 repeat_type!='none'：不一致，以 repeat=0 为准
          try {
            await env.DB.prepare(`UPDATE todos SET repeat_type = 'none' WHERE repeat = 0 AND repeat_type != 'none' AND repeat_type IS NOT NULL AND repeat_type != ''`).run();
          } catch (e) {}
          //    repeat=1 但 repeat_type='none'：旧数据默认 daily
          try {
            await env.DB.prepare(`UPDATE todos SET repeat_type = 'daily' WHERE repeat = 1 AND (repeat_type = 'none' OR repeat_type IS NULL OR repeat_type = '')`).run();
          } catch (e) {}

          // 5. 彻底移除 repeat 列
          try { await env.DB.prepare(`ALTER TABLE todos DROP COLUMN repeat`).run(); } catch (e) {}
        }

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

      const { password } = await request.json();
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
        while (sessions.length > 3) sessions.shift();
        
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
            while (appSettingsObj.scaleByBrowser.length > 3) {
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
            while (appSettingsObj.fontSizeByBrowser.length > 3) {
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
            while (appSettingsObj.displayScaleByBrowser.length > 3) {
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
      const swCode = `
'use strict';
const CACHE_NAME = 'moara-todo-v1';

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
        headers: { 'Content-Type': 'application/javascript' }
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

          while (appSettingsObj.scaleByBrowser.length > 3) {
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

          while (appSettingsObj.fontSizeByBrowser.length > 3) {
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

          while (appSettingsObj.displayScaleByBrowser.length > 3) {
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
      const { action, ua } = await request.json();
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
      const { customHeader, customContent } = await request.json();
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
      const allWords = await fetchHotSearchData(provider);
      return new Response(JSON.stringify({ success: true, data: allWords }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/stats' && request.method === 'GET') {
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');
      if (!start || !end) return apiError("Date required", 400);
      const { results } = await env.DB.prepare(
        'SELECT date, priority, done FROM todos WHERE date >= ? AND date <= ? AND deleted = 0'
      ).bind(start, end).all();
      return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
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
      const BATCH_SIZE = 100;

      const safeStringify = (v) => {
        if (typeof v === 'string') return v;
        if (Array.isArray(v)) return JSON.stringify(v);
        if (v != null && typeof v === 'object') return JSON.stringify(v);
        return '[]';
      };

      const buildTodoStmts = (items) => (items || []).map((t) => {
        return env.DB.prepare(
          `INSERT OR REPLACE INTO todos
          (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id, recurrence_id, is_exception)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          t.id, t.parent_id, t.date, t.text, t.time || '', t.priority || 'low',
          t.desc || '', t.url || '', t.copy_text || '',
          safeStringify(t.subtasks), safeStringify(t.search_terms), t.done || 0, t.deleted || 0,
          t.repeat_type || 'none', t.repeat_custom || '', t.repeat_end || '', t.end_time || '', t.category_id || '',
          t.recurrence_id || '', t.is_exception || 0
        );
      });

      const buildTemplateStmts = (items) => (items || []).map((t) => {
        const exdates = t.exdates || '[]';
        return env.DB.prepare(
          `INSERT OR REPLACE INTO todo_templates
          (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          t.parent_id, t.text || '', t.time || '', t.priority || 'low', t.desc || '', t.url || '', t.copy_text || '',
          safeStringify(t.subtasks), safeStringify(t.search_terms), t.repeat_type || 'none', t.repeat_custom || '', t.repeat_end || '', t.end_time || '', t.anchor_date || '', exdates, t.category_id || ''
        );
      });

      const execBatch = async (stmts) => {
        for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
          await env.DB.batch(stmts.slice(i, i + BATCH_SIZE));
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

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              const obj = JSON.parse(trimmed);

              if (obj._type === 'template') {
                const tpl = Object.assign({}, obj); delete tpl._type;
                tplBatch.push(tpl);
                if (tplBatch.length >= BATCH_SIZE) { await execBatch(buildTemplateStmts(tplBatch)); tplBatch = []; }
              } else if (obj._type) {
                // settings/categories etc. handled by frontend separately
              } else {
                todoBatch.push(obj);
                if (todoBatch.length >= BATCH_SIZE) { await execBatch(buildTodoStmts(todoBatch)); todoBatch = []; }
              }
            }
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

        const body = await request.json();
        const phase = body.phase;

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
          const importId = body.importId;
          const discard = !!body.discard;
          const keepBackup = !!body.keepBackup;
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
          const importId = body.importId;
          const mode = body.mode || 'merge';
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
                    is_exception INTEGER NOT NULL DEFAULT 0
                  )
                `),
                env.DB.prepare(`CREATE INDEX idx_todos_cursor ON todos(date, deleted, id)`),
                env.DB.prepare(`CREATE INDEX idx_todos_parent_date_del ON todos(parent_id, date, deleted)`),
                env.DB.prepare(`
                  CREATE TABLE todo_templates (
                    parent_id TEXT PRIMARY KEY,
                    text TEXT, time TEXT, priority TEXT, desc TEXT, url TEXT,
                    copy_text TEXT, subtasks TEXT, search_terms TEXT,
                    repeat_type TEXT, repeat_custom TEXT, repeat_end TEXT DEFAULT '', end_time TEXT DEFAULT '',
                    anchor_date TEXT,
                    exdates TEXT DEFAULT '[]',
                    category_id TEXT DEFAULT ''
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
          const importId = body.importId;
          if (!importId) return apiError('importId required', 400);

          const session = await env.DB.prepare('SELECT * FROM import_sessions WHERE id = ?').bind(importId).first();
          if (!session) return apiError('会话不存在', 400);

          if (session.mode === 'overwrite') {
            try {
              await env.DB.batch([
                env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)'),
                env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)'),
                env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)'),
              ]);
            } catch (e) { console.error("Index rebuild after finalize:", e); }
          }

          if (body.custom_header !== undefined || body.custom_content !== undefined) {
            const customStmts = [];
            if (body.custom_header !== undefined) {
              customStmts.push(env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_header', ?)").bind(body.custom_header));
            }
            if (body.custom_content !== undefined) {
              customStmts.push(env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_content', ?)").bind(body.custom_content));
            }
            if (customStmts.length > 0) await env.DB.batch(customStmts);
          }

          if (body.categories && Array.isArray(body.categories)) {
            if (session.mode === 'overwrite') {
              await env.DB.prepare("DELETE FROM categories").run();
            }
            const insertStmts = body.categories.filter(c => c.id && c.name).map(c =>
              env.DB.prepare("INSERT OR REPLACE INTO categories (id, name, color) VALUES (?, ?, ?)").bind(c.id, c.name, c.color || '#888888')
            );
            if (insertStmts.length > 0) await env.DB.batch(insertStmts);
            await env.DB.batch([
              env.DB.prepare("UPDATE todos SET category_id = '' WHERE category_id != '' AND category_id NOT IN (SELECT id FROM categories)"),
              env.DB.prepare("UPDATE todo_templates SET category_id = '' WHERE category_id != '' AND category_id NOT IN (SELECT id FROM categories)")
            ]);
          }

          if (body.customColors && Array.isArray(body.customColors)) {
            await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('customColors', ?)").bind(JSON.stringify(body.customColors)).run();
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
                  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)')
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
      const data = await request.json();
      await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)").bind(JSON.stringify(data)).run();
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
      const { colors } = await request.json();
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
      const { action, id, ids, name, color } = await request.json();

      if (action === 'CREATE') {
        if (!name || !name.trim()) {
          return apiError('分类名称不能为空', 400);
        }
        const existing = await env.DB.prepare("SELECT id FROM categories WHERE LOWER(name) = ?").bind(name.trim().toLowerCase()).first();
        if (existing) {
          return apiError('分类名称已存在', 400);
        }
        const newId = Date.now().toString() + Math.random().toString().slice(2, 6);
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
        const placeholders = ids.map(() => '?').join(',');
        await env.DB.batch([
          env.DB.prepare(`DELETE FROM categories WHERE id IN (${placeholders})`).bind(...ids),
          env.DB.prepare(`UPDATE todos SET category_id = '' WHERE category_id IN (${placeholders})`).bind(...ids),
          env.DB.prepare(`UPDATE todo_templates SET category_id = '' WHERE category_id IN (${placeholders})`).bind(...ids)
        ]);
        return new Response(JSON.stringify({ success: true, ids: ids }), { headers: { 'Content-Type': 'application/json' } });
      }

      return apiError('未知操作', 400);
    }

    if (url.pathname === '/api/trash' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM todos WHERE deleted = 1 ORDER BY date DESC LIMIT 100').all();
      return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/trash-action' && request.method === 'POST') {
      const { action, id, ids } = await request.json();
      if (action === 'RESTORE') {
        const t = await env.DB.prepare('SELECT parent_id, date, repeat_type, repeat_end FROM todos WHERE id = ?').bind(id).first();
        await env.DB.prepare('UPDATE todos SET deleted = 0 WHERE id = ?').bind(id).run();
        if (t && t.repeat_type && t.repeat_type !== 'none' && t.parent_id) {
          // 检查同日期是否已有活跃实例（避免恢复后出现重复）
          const existing = await env.DB.prepare(
            'SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 AND id != ? LIMIT 1'
          ).bind(t.parent_id, t.date, id).first();
          if (existing) {
            // 同日期已有活跃实例，恢复的实例脱离模板变为单次任务
            await env.DB.prepare(
              'UPDATE todos SET parent_id=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\' WHERE id=?'
            ).bind(id, id).run();
          } else if (t.repeat_end && t.repeat_end !== '') {
            // 恢复被终止的系列项：检查模板是否仍活跃
            const tpl = await env.DB.prepare('SELECT repeat_end FROM todo_templates WHERE parent_id = ?').bind(t.parent_id).first();
            if (tpl && tpl.repeat_end && tpl.repeat_end < t.date) {
              // 模板已终止且早于此日期，恢复的实例脱离模板变为单次任务
              await env.DB.prepare(
                'UPDATE todos SET parent_id=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\' WHERE id=?'
              ).bind(id, id).run();
            } else {
              // 模板仍活跃或无终止，重新激活重复（清除repeat_end）
              await env.DB.prepare('UPDATE todos SET repeat_end=\'\' WHERE id=?').bind(id).run();
            }
          }
          // 从exdates中移除此日期
          const tpl = await env.DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(t.parent_id).first();
          if (tpl) {
            const currentExdates = tpl.exdates || '[]';
            const newExdates = removeExdate(currentExdates, t.date);
            await env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(newExdates, t.parent_id).run();
          } else if (!tpl && t.repeat_type && t.repeat_type !== 'none') {
            // 模板不存在时重建（删除scope=thisAndFuture/all时模板被删了）
            const task = await env.DB.prepare('SELECT text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, end_time, category_id FROM todos WHERE id=?').bind(id).first();
            if (task) {
              await env.DB.prepare(
                'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
              ).bind(t.parent_id, task.text, task.time, task.priority, task.desc, task.url, task.copy_text, task.subtasks, task.search_terms, task.repeat_type, task.repeat_custom || '', '', task.end_time, t.date, '[]', task.category_id).run();
            }
          }
        }
      } else if (action === 'DELETE_PERMANENT') {
        await env.DB.prepare('DELETE FROM todos WHERE id = ?').bind(id).run();
      } else if (action === 'CLEAR_ALL') {
        await env.DB.prepare('DELETE FROM todos WHERE deleted = 1').run();
      } else if (action === 'BATCH_RESTORE') {
        if (ids && ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          const tasks = await env.DB.prepare(`SELECT id, parent_id, date, repeat_type, repeat_end FROM todos WHERE id IN (${placeholders})`).bind(...ids).all();
          await env.DB.prepare(`UPDATE todos SET deleted = 0 WHERE id IN (${placeholders})`).bind(...ids).run();
          // 恢复被终止的系列项：检查同日期是否已有活跃实例
          const reviveIds = [];
          const detachIds = [];
          for (const t of tasks.results) {
            if (t.repeat_type && t.repeat_type !== 'none' && t.repeat_end && t.repeat_end !== '') {
              const existing = await env.DB.prepare(
                'SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 AND id != ? LIMIT 1'
              ).bind(t.parent_id, t.date, t.id).first();
              if (existing) {
                detachIds.push(t.id);
              } else {
                const tpl = await env.DB.prepare('SELECT repeat_end FROM todo_templates WHERE parent_id = ?').bind(t.parent_id).first();
                if (tpl && tpl.repeat_end && tpl.repeat_end < t.date) {
                  detachIds.push(t.id);
                } else {
                  reviveIds.push(t.id);
                }
              }
            }
          }
          if (reviveIds.length > 0) {
            const ph = reviveIds.map(() => '?').join(',');
            await env.DB.prepare(`UPDATE todos SET repeat_end='' WHERE id IN (${ph})`).bind(...reviveIds).run();
          }
          if (detachIds.length > 0) {
            const ph = detachIds.map(() => '?').join(',');
            await env.DB.prepare(`UPDATE todos SET parent_id=id, repeat_type='none', repeat_custom='', repeat_end='' WHERE id IN (${ph})`).bind(...detachIds).run();
          }
          const exdateUpdates = {};
          for (const t of tasks.results) {
            if (t.repeat_type && t.repeat_type !== 'none' && t.parent_id) {
              if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
              exdateUpdates[t.parent_id].push(t.date);
            }
          }
          for (const pid of Object.keys(exdateUpdates)) {
            const tpl = await env.DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(pid).first();
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
            } else if (!tpl) {
              // 模板不存在时从第一个有效任务重建
              const firstTask = tasks.results.find(t => t.parent_id === pid && t.repeat_type && t.repeat_type !== 'none');
              if (firstTask) {
                const task = await env.DB.prepare('SELECT text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, end_time, category_id FROM todos WHERE id=?').bind(firstTask.id).first();
                if (task) {
                  await env.DB.prepare(
                    'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
                  ).bind(pid, task.text, task.time, task.priority, task.desc, task.url, task.copy_text, task.subtasks, task.search_terms, task.repeat_type, task.repeat_custom || '', '', task.end_time, firstTask.date, '[]', task.category_id).run();
                }
              }
            }
          }
        }
      } else if (action === 'BATCH_DELETE_PERMANENT') {
        if (ids && ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          await env.DB.prepare(`DELETE FROM todos WHERE id IN (${placeholders})`).bind(...ids).run();
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
      
      let { results } = await env.DB.prepare(
        'SELECT * FROM todos WHERE date = ? AND deleted = 0'
      ).bind(date).all();
      
      const targetDayOfWeek = String(getDayOfWeek(date));
      const targetDayOfMonth = date.slice(8, 10);
      const targetMonthDay   = date.slice(5, 10);
    
      // 使用 recurring-engine 计算重复事件
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
          search_terms: parsedSearchTerms
        };
        results.push(newRecord); 
      
        insertStmts.push(env.DB.prepare(
          'INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          newId, tpl.parent_id, date, tpl.text, tpl.time || '', tpl.priority || 'low',
          tpl.desc || '', tpl.url || '', tpl.copy_text || '', 
          JSON.stringify(parsedSubtasks), JSON.stringify(parsedSearchTerms),
          0, 0, tpl.repeat_type || 'none', tpl.repeat_custom || '', tpl.repeat_end || '', tpl.end_time || '', tpl.category_id || ''
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
        if (rType !== 'none' && !['daily','weekly','monthly','yearly'].includes(rType)) rType = 'daily';

        return {
          ...row, 
          repeat_type: rType,
          repeat_custom: row.repeat_custom || '',
          repeat_end: row.repeat_end || '',
          end_time: row.end_time || '',
          isSeries: rType && rType !== 'none',
          done: !!row.done,
          subtasks: parsedSubtasks,
          search_terms: parsedSearchTerms
        };
      });
    
      return new Response(JSON.stringify(formatted), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/todo-action' && request.method === 'POST') {
      const { action, date, task, scope, ids, doneStatus } = await request.json();

      if (action === 'TOGGLE_DONE') {
          await env.DB.prepare('UPDATE todos SET done = ? WHERE id = ?').bind(task.done ? 1 : 0, task.id).run();
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
            const placeholders = ids.map(() => '?').join(',');
            await env.DB.prepare(`UPDATE todos SET done = ? WHERE id IN (${placeholders})`)
              .bind(doneStatus ? 1 : 0, ...ids).run();
          }
        }
        else if (action === 'BATCH_DELETE') {
          if (ids && ids.length > 0) {
            const placeholders = ids.map(() => '?').join(',');
            const tasks = await env.DB.prepare(`SELECT parent_id, date, repeat_type FROM todos WHERE id IN (${placeholders})`).bind(...ids).all();
            await env.DB.prepare(`UPDATE todos SET deleted = 1 WHERE id IN (${placeholders})`).bind(...ids).run();
            
            const exdateUpdates = {};
            for (const t of tasks.results) {
              if (t.repeat_type && t.repeat_type !== 'none') { 
                if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
                exdateUpdates[t.parent_id].push(t.date);
              }
            }
            for (const pid of Object.keys(exdateUpdates)) {
              const tpl = await env.DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(pid).first();
              if (tpl) {
                let currentExdates = tpl.exdates || '[]';
                let changed = false;
                for (const d of exdateUpdates[pid]) {
                  const newExdates = addExdate(currentExdates, d);
                  if (newExdates !== currentExdates) {
                    currentExdates = newExdates;
                    changed = true;
                  }
                }
                if (changed) await env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(currentExdates, pid).run();
              }
            }
          }
        }
        else if (action === 'CREATE') {
          const rptType = task.repeat_type || 'none';
          const categoryId = task.category_id || '';
          const repeatEnd = task.repeat_end || '';
          const endTime = task.end_time || '';
          await env.DB.prepare(
            'INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            task.id, task.id, date, task.text, task.time || '', task.priority || 'low', 
            task.desc || '', task.url || '', task.copyText || '', JSON.stringify(task.subtasks||[]), JSON.stringify(task.search_terms||[]), 
            0, 0, rptType, '', repeatEnd, endTime, categoryId
          ).run();
          
          if (rptType !== 'none') {
              await env.DB.prepare(
                'INSERT INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(
                task.id, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', 
                JSON.stringify(task.subtasks||[]), JSON.stringify(task.search_terms||[]), rptType, '', repeatEnd, endTime, date, '[]', categoryId
              ).run();
          }
        }
        else if (action === 'UPDATE') {
          const rptType = task.repeat_type || 'none';
          const subtasksStr = JSON.stringify(task.subtasks ||[]);
          const searchTermsStr = JSON.stringify(task.search_terms ||[]);
          const categoryId = task.category_id || '';
          const repeatEnd = task.repeat_end || '';
          const endTime = task.end_time || '';
          const newDate = task.date || date;
          const dateChanged = newDate !== date;
          const parentId = task.parentId || task.parent_id;
          const isSeries = task.isSeries || (parentId && parentId !== task.id);

          const newValues = {
            text: task.text,
            time: task.time || '',
            priority: task.priority || 'low',
            desc: task.desc || '',
            url: task.url || '',
            copyText: task.copyText || '',
            subtasks: subtasksStr,
            search_terms: searchTermsStr,
            repeat_type: rptType,
            repeat_custom: '',
            repeat_end: repeatEnd,
            end_time: endTime,
            category_id: categoryId,
            date: newDate,
          };

          if (!isSeries || !scope || scope === 'none') {
            if (rptType !== 'none') {
              // 单次任务 → 重复：更新 todo 并创建模板
              await env.DB.prepare(
                'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?'
              ).bind(newDate, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, categoryId, task.id).run();
              await env.DB.prepare(
                'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(
                task.id, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '',
                subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, newDate, '[]', categoryId
              ).run();
            } else if (parentId && parentId !== task.id) {
              // 重复 → 单次：脱离系列，parent_id 设为自身
              await env.DB.prepare(
                'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', end_time=?, category_id=? WHERE id=?'
              ).bind(task.id, newDate, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, endTime, categoryId, task.id).run();
              // 从旧模板中移除此日期（EXDATE）
              const tpl = await env.DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parentId).first();
              if (tpl) {
                const currentExdates = tpl.exdates || '[]';
                const newExdates = addExdate(currentExdates, date);
                await env.DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(newExdates, parentId).run();
              }
            } else {
              // 普通单次任务更新
              await env.DB.prepare(
                'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?'
              ).bind(newDate, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, categoryId, task.id).run();
            }
          } else {
            const actions = computeUpdateActions({ task, date, scope, newValues });

            // Execute currentTodo action
            if (actions.currentTodo) {
              const cv = actions.currentTodo;
              if (cv.detachFromSeries) {
                if (cv.newSeries) {
                  // "this" scope + 改为重复: 脱离旧系列，创建新系列
                  await env.DB.prepare(
                    'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?'
                  ).bind(task.id, newDate, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, categoryId, task.id).run();
                  // 创建新模板
                  await env.DB.prepare(
                    'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                  ).bind(
                    task.id, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '',
                    subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, newDate, '[]', categoryId
                  ).run();
                } else {
                  // "this" scope + 改为不重复: 脱离旧系列，变为单次任务
                  await env.DB.prepare(
                    'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', end_time=?, category_id=? WHERE id=?'
                  ).bind(task.id, newDate, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, endTime, categoryId, task.id).run();
                }
              } else if (cv.isRecurring) {
                await env.DB.prepare(
                  'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?'
                ).bind(newDate, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, categoryId, task.id).run();
              } else {
                await env.DB.prepare(
                  'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', category_id=? WHERE id=?'
                ).bind(newDate, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, categoryId, task.id).run();
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
            if (scope === 'thisAndFuture') {
              if (rptType !== 'none') {
                if (dateChanged) {
                  // 日期变了：删除当前之后的其他非回收站实例
                  await env.DB.prepare(
                    'DELETE FROM todos WHERE parent_id=? AND id != ? AND date >= ? AND deleted = 0'
                  ).bind(parentId, task.id, date).run();
                } else {
                  // 日期没变：更新当前之后的其他非回收站实例
                  await env.DB.prepare(
                    'UPDATE todos SET text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE parent_id=? AND id != ? AND date >= ? AND deleted = 0'
                  ).bind(task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, categoryId, parentId, task.id, date).run();
                }
              } else {
                // 改为不重复：未来非回收站项真删除
                await env.DB.prepare(
                  'DELETE FROM todos WHERE parent_id=? AND id != ? AND date > ? AND deleted = 0'
                ).bind(parentId, task.id, date).run();
              }
            } else if (scope === 'all') {
              if (rptType !== 'none') {
                if (dateChanged) {
                  // 日期变了：删除其他非回收站实例
                  await env.DB.prepare(
                    'DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0'
                  ).bind(parentId, task.id).run();
                } else {
                  // 日期没变：更新其他非回收站实例
                  await env.DB.prepare(
                    'UPDATE todos SET text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE parent_id=? AND id != ? AND deleted = 0'
                  ).bind(task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, categoryId, parentId, task.id).run();
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
                // "thisAndFuture" + 改为不重复: 模板保留，设repeat_end
                const prevDate = getPreviousDate(date);
                await env.DB.prepare('UPDATE todo_templates SET repeat_end=? WHERE parent_id=?').bind(prevDate, parentId).run();
              } else if (tmpl.type === 'update_from_date' || tmpl.type === 'update_all') {
                // thisAndFuture or all: update template
                if (rptType !== 'none') {
                  let existingExdates = '[]';
                  try {
                    const existingTpl = await env.DB.prepare(
                      'SELECT exdates FROM todo_templates WHERE parent_id = ?'
                    ).bind(parentId).first();
                    if (existingTpl) {
                      existingExdates = existingTpl.exdates || '[]';
                    }
                  } catch(e) {}
          
                  await env.DB.prepare(
                    'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                  ).bind(
                    parentId, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', 
                    subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, newDate, existingExdates, categoryId
                  ).run();
                }
              } else if (tmpl.type === 'delete') {
                await env.DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parentId).run();
              }
            }
          }
        }
        else if (action === 'DELETE') {
          const parentId = task.parentId || task.parent_id;
          const isSeries = task.isSeries || (parentId && parentId !== task.id);

          if (!isSeries || !scope) {
            // 非循环任务: 直接软删除
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
                // "thisAndFuture" scope: set repeat_end on template, soft delete current and future
                const prevDate = getPreviousDate(date);
                if (tmpl.alsoDeleteFuture) {
                  await env.DB.prepare('UPDATE todos SET deleted = 1 WHERE parent_id=? AND date >= ?').bind(parentId, date).run();
                }
                // Set repeat_end on past instances (系列截止到前一天，当前日期已不属于系列)
                await env.DB.prepare('UPDATE todos SET repeat_end=? WHERE parent_id=? AND date < ? AND repeat_type != \'none\'').bind(prevDate, parentId, date).run();
                // Update template repeat_end
                await env.DB.prepare('UPDATE todo_templates SET repeat_end=? WHERE parent_id=?').bind(prevDate, parentId).run();
              } else if (tmpl.type === 'delete_all') {
                // "all" scope: soft delete all instances and delete template
                await env.DB.prepare('UPDATE todos SET deleted = 1 WHERE parent_id=?').bind(parentId).run();
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
      return apiError(e instanceof Error ? e.message : String(e));
    }
}

export { handleRequest };
