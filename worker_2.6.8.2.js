/*
 * Cloudflare Worker + D1 Todo App (v2.6.8.2：修复了进入预览模式时因页面重定向引发并发请求，导致当天待办事项可能被重复生成的问题；移除虚拟滚动机制；优化导入/导出逻辑)
 * Features: Filter, Trash Bin, Batch Manage, Sub-tasks, Selectable Search Provider, Statistics
 */

let isDbInitialized = false;

// 工具函数
function parseCookies(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const list = {};
  cookieHeader.split(';').forEach(function(cookie) {
    let[name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    if (!value) return;
    list[name] = decodeURIComponent(value);
  });
  return list;
}

async function sign(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false,["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verify(data, signature, secret) {
  const expected = await sign(data, secret);
  return expected === signature;
}

function generateSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, c =>
    c === '+' ? '-' : c === '/' ? '_' : ''
  );
}

async function secureCompare(a, b, secret) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length === 0 || b.length === 0) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign("HMAC", key, encoder.encode(a)),
    crypto.subtle.sign("HMAC", key, encoder.encode(b))
  ]);
  if (sigA.byteLength !== sigB.byteLength) return false;
  const arrA = new Uint8Array(sigA);
  const arrB = new Uint8Array(sigB);
  let result = 0;
  for (let i = 0; i < arrA.length; i++) {
    result |= arrA[i] ^ arrB[i];
  }
  return result === 0;
}

function getDayOfWeek(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length < 3) return 0;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.getDay();
}

async function fetchHotSearchData(providerName = 'auto') {
  const fetchers = {
    'bilibili': async () => { 
      const res = await fetch('https://uapis.cn/api/v1/misc/hotboard?type=bilibili');
      const json = await res.json();
      return json?.list?.map(i => i?.title).filter(Boolean) ||[];
    },
    'weibo': async () => { 
      const res = await fetch('https://uapis.cn/api/v1/misc/hotboard?type=weibo');
      const json = await res.json();
      return json?.list?.map(i => i?.title).filter(Boolean) ||[];
    },
    'zhihu': async () => { 
      const res = await fetch('https://uapis.cn/api/v1/misc/hotboard?type=zhihu');
      const json = await res.json();
      return json?.list?.map(i => i?.title).filter(Boolean) ||[];
    },
    'baidu': async () => { 
      const res = await fetch('https://top.baidu.com/api/board?platform=pc&tab=realtime');
      const json = await res.json();
      return json?.data?.cards?.[0]?.content?.map(i => i?.word).filter(Boolean) ||[];
    }
  };

  let providers =[];
  if (providerName && fetchers[providerName]) {
    providers =[fetchers[providerName]];
  } else {
    providers = Object.values(fetchers);
    providers.sort(() => Math.random() - 0.5); 
  }
  
  let allWords =[];
  for (const fetcher of providers) {
    try {
      const words = await fetcher();
      if (words.length >= 10) {
        allWords = words;
        break; 
      }
    } catch(e) { console.error("Fetch API error:", e); }
  }
  return allWords;
}

// 后端逻辑
export default {
  async fetch(request, env, ctx) {
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
        await env.DB.batch([
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS todos (
              id TEXT PRIMARY KEY,
              parent_id TEXT NOT NULL,
              date TEXT NOT NULL,
              text TEXT NOT NULL,
              time TEXT,
              priority TEXT,
              repeat INTEGER NOT NULL DEFAULT 0,
              desc TEXT,
              url TEXT,
              copy_text TEXT,
              subtasks TEXT,
              search_terms TEXT,
              done INTEGER NOT NULL DEFAULT 0,
              deleted INTEGER NOT NULL DEFAULT 0,
              repeat_type TEXT DEFAULT 'none',
              repeat_custom TEXT DEFAULT ''
            )
          `),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_date_del ON todos(date, deleted)`),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)`),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS todo_templates (
              parent_id TEXT PRIMARY KEY,
              text TEXT, time TEXT, priority TEXT, desc TEXT, url TEXT, 
              copy_text TEXT, subtasks TEXT, search_terms TEXT, 
              repeat_type TEXT, repeat_custom TEXT,
              anchor_date TEXT,
              blacklist TEXT DEFAULT '[]'
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
              todos_offset INTEGER NOT NULL DEFAULT 0,
              templates_offset INTEGER NOT NULL DEFAULT 0,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            )
          `),
        ]);
        
        try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN copy_text TEXT`).run(); } catch (e) {}
        try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN subtasks TEXT`).run(); } catch (e) {}
        try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN search_terms TEXT`).run(); } catch (e) {}
        try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN repeat_type TEXT DEFAULT 'none'`).run(); } catch (e) {}
        try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN repeat_custom TEXT DEFAULT ''`).run(); } catch (e) {}
        try { await env.DB.prepare(`ALTER TABLE todo_templates ADD COLUMN blacklist TEXT DEFAULT '[]'`).run(); } catch (e) {}
        
        // 自动迁移老版本
        try {
          const c = await env.DB.prepare("SELECT COUNT(*) as c FROM todo_templates").first();
          if (c && c.c === 0) {
            await env.DB.prepare(`
              INSERT OR IGNORE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, anchor_date, blacklist)
              SELECT parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, 
                CASE WHEN (repeat_type IS NULL OR repeat_type = 'none' OR repeat_type = '') THEN 'daily' ELSE repeat_type END,
                repeat_custom, date, '[]'
              FROM todos t1
              WHERE repeat = 1 AND deleted = 0 
              AND date = (SELECT MAX(date) FROM todos t2 WHERE t2.parent_id = t1.parent_id AND t2.repeat = 1 AND t2.deleted = 0)
            `).run();
          }
        } catch (e) {}

        isDbInitialized = true;
      } catch (e) {
        console.error("DB Init error:", e);
      }
    };

    await initDb();

    //  统一 API 鉴权拦截
    const publicApiPaths = ['/api/login', '/api/logout', '/api/hot-search'];
    const isApiRequest = url.pathname.startsWith('/api/');
    if (isApiRequest && !publicApiPaths.includes(url.pathname)) {
      const { ok: apiAuthed } = await isAuthorized();
      if (!apiAuthed) {
        return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (url.pathname === '/api/login' && request.method === 'POST') {
      const now = Date.now();
      
      const attemptRecord = await env.DB.prepare('SELECT * FROM login_attempts WHERE ip = ?').bind(clientIp).first();
      if (attemptRecord && attemptRecord.lock_until > now) {
        return new Response(JSON.stringify({ error: "ACCOUNT LOCKED" }), { status: 429 });
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
            await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)")
              .bind(JSON.stringify(appSettingsObj)).run();
          }
        }

        const headers = new Headers();
        headers.append('Set-Cookie', `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
        headers.append('Set-Cookie', `auth_sig=${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
        return new Response(JSON.stringify({ success: true }), { headers });
      } else {
        await env.DB.prepare(`
          INSERT INTO login_attempts (ip, attempts, lock_until) VALUES (?, 1, 0) 
          ON CONFLICT(ip) DO UPDATE SET 
            attempts = attempts + 1,
            lock_until = CASE WHEN attempts + 1 >= 5 THEN ? ELSE 0 END
        `).bind(clientIp, now + 15 * 60 * 1000).run();
        
        return new Response(JSON.stringify({ error: "ACCESS DENIED" }), { status: 401 });
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
      headers.append('Set-Cookie', `auth_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
      headers.append('Set-Cookie', `auth_sig=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (url.pathname === '/' && request.method === 'GET') {
      const { ok: authorized, matchedSession, sessions: authSessions } = await isAuthorized();
    
      let customHeader = '';
      let customContent = '';
        
      let appSettingsObj = null;
      try {
        const record = await env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
        if (record && record.value) {
          appSettingsObj = JSON.parse(record.value);
        }
      } catch (e) {}
        
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

      // 同步清理 scaleByBrowser 中被删除的 UA
      if (action === 'DELETE' || action === 'DELETE_ALL') {
        try {
          const appSettingsRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
          if (appSettingsRecord && appSettingsRecord.value) {
            let appSettingsObj = JSON.parse(appSettingsRecord.value);
            if (Array.isArray(appSettingsObj.scaleByBrowser)) {
              const remainingUAs = sessions.map(s => s.ua);
              if (action === 'DELETE_ALL') {
                appSettingsObj.scaleByBrowser = [];
              } else {
                appSettingsObj.scaleByBrowser = appSettingsObj.scaleByBrowser.filter(item => remainingUAs.includes(item.ua));
              }
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
      if (!start || !end) return new Response("Date required", { status: 400 });
      const { results } = await env.DB.prepare(
        'SELECT date, priority, done FROM todos WHERE date >= ? AND date <= ? AND deleted = 0'
      ).bind(start, end).all();
      return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/export' && request.method === 'GET') {
      const mode = url.searchParams.get('mode');

      // 元数据查询
      if (mode === 'meta') {
        const incTodos = url.searchParams.get('todos') === 'true';
        const incTrash = url.searchParams.get('trash') === 'true';
        const incSettings = url.searchParams.get('settings') === 'true';

        let condition = "1=0";
        if (incTodos && incTrash) condition = "1=1";
        else if (incTodos) condition = "deleted = 0";
        else if (incTrash) condition = "deleted = 1";

        const [todoCountRes, tplCountRes] = await Promise.all([
          env.DB.prepare(`SELECT COUNT(*) as c FROM todos WHERE ${condition}`).first(),
          incTodos
            ? env.DB.prepare('SELECT COUNT(*) as c FROM todo_templates').first()
            : Promise.resolve({ c: 0 })
        ]);

        const result = {
          counts: {
            todos: todoCountRes?.c || 0,
            templates: tplCountRes?.c || 0
          }
        };

        if (incSettings) {
          const settingsRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
          try { result.settings = settingsRecord?.value ? JSON.parse(settingsRecord.value) : {}; } catch(e) { result.settings = {}; }
          const headerRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_header'").first();
          result.custom_header = headerRecord?.value || '';
          const contentRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_content'").first();
          result.custom_content = contentRecord?.value || '';
        }

        return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
      }

      // 数据分页
      if (mode === 'page') {
        const type = url.searchParams.get('type') || 'todos';
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '500', 10), 1000);
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

        const [countRes, dataRes] = await Promise.all([
          env.DB.prepare(`SELECT COUNT(*) as c FROM ${tableName} WHERE ${condition}`).first(),
          env.DB.prepare(`SELECT * FROM ${tableName} WHERE ${condition} LIMIT ? OFFSET ?`).bind(limit, offset).all()
        ]);

        const total = countRes?.c || 0;

        return new Response(JSON.stringify({
          data: dataRes.results || [],
          offset: offset,
          limit: limit,
          total: total,
          hasMore: offset + limit < total
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (mode === 'session') {
        const action = url.searchParams.get('action') || 'create';
        const sessionId = url.searchParams.get('sessionId');

        if (action === 'create') {
          const incTodos = url.searchParams.get('todos') === 'true' ? 1 : 0;
          const incTrash = url.searchParams.get('trash') === 'true' ? 1 : 0;
          const incSettings = url.searchParams.get('settings') === 'true' ? 1 : 0;
          const id = sessionId || crypto.randomUUID();
          const now = Date.now();

          let todoCondition = "1=0";
          if (incTodos && incTrash) todoCondition = "1=1";
          else if (incTodos) todoCondition = "deleted = 0";
          else if (incTrash) todoCondition = "deleted = 1";

          const [todoCountRes, tplCountRes] = await Promise.all([
            env.DB.prepare(`SELECT COUNT(*) as c FROM todos WHERE ${todoCondition}`).first(),
            incTodos
              ? env.DB.prepare('SELECT COUNT(*) as c FROM todo_templates').first()
              : Promise.resolve({ c: 0 })
          ]);

          const EXPORT_TIMEOUT = 10 * 60 * 1000;
          const oldSession = await env.DB.prepare('SELECT * FROM export_sessions WHERE status = ?').bind('active').first();
          if (oldSession) {
            if ((now - oldSession.updated_at) < EXPORT_TIMEOUT) {
              return new Response(JSON.stringify({
                error: '存在进行中的导出会话',
                conflict: true,
                sessionId: oldSession.id
              }), { status: 409, headers: { 'Content-Type': 'application/json' } });
            }
            await env.DB.prepare('DELETE FROM export_sessions WHERE id = ?').bind(oldSession.id).run();
          }

          const staleSessions = await env.DB.prepare('SELECT id FROM export_sessions WHERE updated_at < ?').bind(now - EXPORT_TIMEOUT).all();
          if (staleSessions.results && staleSessions.results.length > 0) {
            await env.DB.prepare('DELETE FROM export_sessions WHERE updated_at < ?').bind(now - EXPORT_TIMEOUT).run();
          }

          await env.DB.prepare(
            'INSERT INTO export_sessions (id, status, inc_todos, inc_trash, inc_settings, total_todos, total_templates, todos_offset, templates_offset, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(id, 'active', incTodos, incTrash, incSettings, todoCountRes?.c || 0, tplCountRes?.c || 0, 0, 0, now, now).run();

          return new Response(JSON.stringify({
            sessionId: id,
            totalTodos: todoCountRes?.c || 0,
            totalTemplates: tplCountRes?.c || 0
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (action === 'status' && sessionId) {
          const session = await env.DB.prepare('SELECT * FROM export_sessions WHERE id = ?').bind(sessionId).first();
          if (!session) {
            return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify({
            sessionId: session.id,
            status: session.status,
            totalTodos: session.total_todos,
            totalTemplates: session.total_templates,
            todosOffset: session.todos_offset,
            templatesOffset: session.templates_offset
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

        return new Response(JSON.stringify({ error: "Invalid session action" }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }

      if (mode === 'stream') {
        const sessionId = url.searchParams.get('sessionId');
        let resumeTodosOffset = parseInt(url.searchParams.get('resumeTodosOffset') || '0', 10);
        let resumeTemplatesOffset = parseInt(url.searchParams.get('resumeTemplatesOffset') || '0', 10);
        const incTodos = url.searchParams.get('todos') === 'true';
        const incTrash = url.searchParams.get('trash') === 'true';
        const incSettings = url.searchParams.get('settings') === 'true';
        const STREAM_PAGE_SIZE = 600;
        const SESSION_UPDATE_INTERVAL = 5;

        let todoCondition = "1=0";
        if (incTodos && incTrash) todoCondition = "1=1";
        else if (incTodos) todoCondition = "deleted = 0";
        else if (incTrash) todoCondition = "deleted = 1";

        const [todoCountRes, tplCountRes] = await Promise.all([
          env.DB.prepare(`SELECT COUNT(*) as c FROM todos WHERE ${todoCondition}`).first(),
          incTodos
            ? env.DB.prepare('SELECT COUNT(*) as c FROM todo_templates').first()
            : Promise.resolve({ c: 0 })
        ]);
        const totalTodos = todoCountRes?.c || 0;
        const totalTemplates = incTodos ? (tplCountRes?.c || 0) : 0;

        const encoder = new TextEncoder();
        let firstInArray = true;
        let pageCount = 0;

        const stream = new ReadableStream({
          async pull(controller) {
            try {
              if (resumeTodosOffset < totalTodos) {
                const offset = resumeTodosOffset;
                const dataRes = await env.DB.prepare(
                  `SELECT * FROM todos WHERE ${todoCondition} LIMIT ? OFFSET ?`
                ).bind(STREAM_PAGE_SIZE, offset).all();
                const rows = dataRes.results || [];

                if (offset === 0 && resumeTemplatesOffset === 0) {
                  let header = '{';
                  if (incSettings) {
                    const settingsRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
                    let settingsObj = {};
                    try { settingsObj = settingsRecord?.value ? JSON.parse(settingsRecord.value) : {}; } catch(e) {}
                    header += '"settings":' + JSON.stringify(settingsObj) + ',';
                    const headerRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_header'").first();
                    header += '"custom_header":' + JSON.stringify(headerRecord?.value || '') + ',';
                    const contentRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_content'").first();
                    header += '"custom_content":' + JSON.stringify(contentRecord?.value || '') + ',';
                  }
                  header += '"todos":[';
                  controller.enqueue(encoder.encode(header));
                }

                const chunks = [];
                let chunksLen = 0;
                for (let i = 0; i < rows.length; i++) {
                  const prefix = (offset === 0 && i === 0 && firstInArray) ? '' : ',';
                  const chunk = encoder.encode(prefix + JSON.stringify(rows[i]));
                  chunks.push(chunk);
                  chunksLen += chunk.length;
                  firstInArray = false;
                }
                if (chunks.length > 0) {
                  const combined = new Uint8Array(chunksLen);
                  let pos = 0;
                  for (let i = 0; i < chunks.length; i++) {
                    combined.set(chunks[i], pos);
                    pos += chunks[i].length;
                  }
                  controller.enqueue(combined);
                }

                resumeTodosOffset += rows.length;
                pageCount++;
                if (sessionId && (pageCount % SESSION_UPDATE_INTERVAL === 0 || rows.length < STREAM_PAGE_SIZE)) {
                  await env.DB.prepare('UPDATE export_sessions SET todos_offset = ?, updated_at = ? WHERE id = ?')
                    .bind(resumeTodosOffset, Date.now(), sessionId).run();
                }

                if (rows.length === STREAM_PAGE_SIZE) {
                  controller.enqueue(encoder.encode(''));
                  return;
                }
              }

              if (resumeTodosOffset >= totalTodos && resumeTemplatesOffset < totalTemplates) {
                if (resumeTemplatesOffset === 0) {
                  if (totalTodos === 0 && resumeTodosOffset === 0) {
                    let header = '{';
                    if (incSettings) {
                      const settingsRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
                      let settingsObj = {};
                      try { settingsObj = settingsRecord?.value ? JSON.parse(settingsRecord.value) : {}; } catch(e) {}
                      header += '"settings":' + JSON.stringify(settingsObj) + ',';
                      const headerRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_header'").first();
                      header += '"custom_header":' + JSON.stringify(headerRecord?.value || '') + ',';
                      const contentRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_content'").first();
                      header += '"custom_content":' + JSON.stringify(contentRecord?.value || '') + ',';
                    }
                    header += '"todos":[';
                    controller.enqueue(encoder.encode(header));
                  }
                  controller.enqueue(encoder.encode('],"todo_templates":['));
                  firstInArray = true;
                }

                const offset = resumeTemplatesOffset;
                const dataRes = await env.DB.prepare(
                  'SELECT * FROM todo_templates LIMIT ? OFFSET ?'
                ).bind(STREAM_PAGE_SIZE, offset).all();
                const rows = dataRes.results || [];

                const chunks = [];
                let chunksLen = 0;
                for (let i = 0; i < rows.length; i++) {
                  const prefix = (offset === 0 && i === 0 && firstInArray) ? '' : ',';
                  const chunk = encoder.encode(prefix + JSON.stringify(rows[i]));
                  chunks.push(chunk);
                  chunksLen += chunk.length;
                  firstInArray = false;
                }
                if (chunks.length > 0) {
                  const combined = new Uint8Array(chunksLen);
                  let pos = 0;
                  for (let i = 0; i < chunks.length; i++) {
                    combined.set(chunks[i], pos);
                    pos += chunks[i].length;
                  }
                  controller.enqueue(combined);
                }

                resumeTemplatesOffset += rows.length;
                pageCount++;
                if (sessionId && (pageCount % SESSION_UPDATE_INTERVAL === 0 || rows.length < STREAM_PAGE_SIZE)) {
                  await env.DB.prepare('UPDATE export_sessions SET templates_offset = ?, updated_at = ? WHERE id = ?')
                    .bind(resumeTemplatesOffset, Date.now(), sessionId).run();
                }

                if (rows.length === STREAM_PAGE_SIZE) {
                  controller.enqueue(encoder.encode(''));
                  return;
                }
              }

              if (totalTodos === 0 && totalTemplates === 0) {
                let header = '{';
                if (incSettings) {
                  const settingsRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
                  let settingsObj = {};
                  try { settingsObj = settingsRecord?.value ? JSON.parse(settingsRecord.value) : {}; } catch(e) {}
                  header += '"settings":' + JSON.stringify(settingsObj) + ',';
                  const headerRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_header'").first();
                  header += '"custom_header":' + JSON.stringify(headerRecord?.value || '') + ',';
                  const contentRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_content'").first();
                  header += '"custom_content":' + JSON.stringify(contentRecord?.value || '') + ',';
                }
                header += '"todos":[],"todo_templates":[]}';
                controller.enqueue(encoder.encode(header));
              } else {
                if (totalTemplates === 0 && resumeTemplatesOffset === 0) {
                  controller.enqueue(encoder.encode('],"todo_templates":[]'));
                } else {
                  controller.enqueue(encoder.encode(']'));
                }
                controller.enqueue(encoder.encode('}'));
              }

              if (sessionId) {
                await env.DB.prepare('DELETE FROM export_sessions WHERE id = ?').bind(sessionId).run();
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'application/json',
            'X-Export-Total-Todos': String(totalTodos),
            'X-Export-Total-Templates': String(totalTemplates)
          }
        });
      }

      return new Response(JSON.stringify({ error: "Unknown mode. Use mode=meta, mode=page, mode=stream, or mode=session" }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/api/import' && request.method === 'POST') {
      const body = await request.json();
      const phase = body.phase;
      const BATCH_SIZE = 100;

      const safeStringify = (v) => {
        if (typeof v === 'string') return v;
        if (Array.isArray(v)) return JSON.stringify(v);
        if (v != null && typeof v === 'object') return JSON.stringify(v);
        return '[]';
      };

      const buildTodoStmts = (items) => (items || []).map((t, idx) => {
        const label = t.text || t.id || `第 ${idx + 1} 条`;
        if (!t.id) throw new Error(`事项 "${label}" 缺少必填字段 id`);
        if (!t.parent_id) throw new Error(`事项 "${label}" 缺少必填字段 parent_id`);
        if (!t.date) throw new Error(`事项 "${label}" 缺少必填字段 date`);
        if (!t.text) throw new Error(`事项 id:${t.id} 缺少必填字段 text`);
        return env.DB.prepare(
          `INSERT OR REPLACE INTO todos
          (id, parent_id, date, text, time, priority, repeat, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          t.id, t.parent_id, t.date, t.text, t.time || '', t.priority || 'low',
          t.repeat !== undefined ? t.repeat : ((t.repeat_type && t.repeat_type !== 'none') ? 1 : 0),
          t.desc || '', t.url || '', t.copy_text || '',
          safeStringify(t.subtasks), safeStringify(t.search_terms), t.done || 0, t.deleted || 0,
          t.repeat_type || 'none', t.repeat_custom || ''
        );
      });

      const buildTemplateStmts = (items) => (items || []).map((t, idx) => {
        const label = t.text || t.parent_id || `第 ${idx + 1} 条`;
        if (!t.parent_id) throw new Error(`模板 "${label}" 缺少必填字段 parent_id`);
        return env.DB.prepare(
          `INSERT OR REPLACE INTO todo_templates
          (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, anchor_date, blacklist)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          t.parent_id, t.text || '', t.time || '', t.priority || 'low', t.desc || '', t.url || '', t.copy_text || '',
          safeStringify(t.subtasks), safeStringify(t.search_terms), t.repeat_type || 'none', t.repeat_custom || '', t.anchor_date || '', t.blacklist || '[]'
        );
      });

      const execBatch = async (stmts) => {
        for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
          await env.DB.batch(stmts.slice(i, i + BATCH_SIZE));
        }
      };

      const clearBackupTables = async () => {
        try {
          await env.DB.batch([
            env.DB.prepare('DROP TABLE IF EXISTS todos_backup'),
            env.DB.prepare('DROP TABLE IF EXISTS todo_templates_backup'),
          ]);
        } catch (e) { console.error("Failed to drop backup tables:", e); }
      };

      const errResp = (msg, status = 400) => new Response(JSON.stringify({ error: msg }), {
        status, headers: { 'Content-Type': 'application/json' }
      });

      try {
        // phase=status — 查询当前是否有活跃的导入会话
        if (phase === 'status') {
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

        // phase=abort — 中止导入，覆写模式时恢复备份
        if (phase === 'abort') {
          const importId = body.importId;
          if (!importId) return errResp('importId required');

          const session = await env.DB.prepare('SELECT * FROM import_sessions WHERE id = ?').bind(importId).first();
          if (!session) return errResp('会话不存在');

          if (session.mode === 'overwrite') {
              try {
              // RENAME 方式恢复：丢弃当前(可能不完整的)表，将备份表重命名回主表，并重建索引
                await env.DB.batch([
                  env.DB.prepare('DROP TABLE IF EXISTS todos'),
                  env.DB.prepare('DROP TABLE IF EXISTS todo_templates'),
                  env.DB.prepare('ALTER TABLE todos_backup RENAME TO todos'),
                  env.DB.prepare('ALTER TABLE todo_templates_backup RENAME TO todo_templates'),
                  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_date_del ON todos(date, deleted)'),
                  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)'),
                  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)'),
                ]);
              } catch (e) {
                return errResp('恢复备份失败: ' + e.message, 500);
              }
          }

          await env.DB.prepare('DELETE FROM import_sessions WHERE id = ?').bind(importId).run();
          return new Response(JSON.stringify({ success: true, recovered: session.mode === 'overwrite' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // phase=init — 初始化导入会话
        if (phase === 'init') {
          const importId = body.importId;
          const mode = body.mode || 'merge';
          if (!importId) return errResp('importId required');

          const oldSession = await env.DB.prepare('SELECT * FROM import_sessions WHERE status = ?').bind('active').first();
          if (oldSession) {
            const now = Date.now();
            const TIMEOUT = 10 * 60 * 1000;
            if ((now - oldSession.updated_at) < TIMEOUT) {
              return new Response(JSON.stringify({
                error: '存在进行中的导入会话',
                conflict: true,
                importId: oldSession.id,
                mode: oldSession.mode
              }), { status: 409, headers: { 'Content-Type': 'application/json' } });
            }
            if (oldSession.mode === 'overwrite') {
                try {
                  await env.DB.batch([
                    env.DB.prepare('DROP TABLE IF EXISTS todos'),
                    env.DB.prepare('DROP TABLE IF EXISTS todo_templates'),
                    env.DB.prepare('ALTER TABLE todos_backup RENAME TO todos'),
                    env.DB.prepare('ALTER TABLE todo_templates_backup RENAME TO todo_templates'),
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_date_del ON todos(date, deleted)'),
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)'),
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)'),
                  ]);
                } catch (e) {
                  console.error("Auto-recover old session failed:", e);
                }
            }
            await env.DB.prepare('DELETE FROM import_sessions WHERE id = ?').bind(oldSession.id).run();
          }

          const now = Date.now();
          if (mode === 'overwrite') {
            try {
              // RENAME 备份：主表直接重命名为 backup 表，零拷贝毫秒级完成
              // 先确保 backup 表不存在（正常不应存在，防御性清理）
              // 删除主表索引（RENAME 后索引名不变但属于 backup 表，会导致后续同名索引冲突）
              await env.DB.batch([
                env.DB.prepare('DROP TABLE IF EXISTS todos_backup'),
                env.DB.prepare('DROP TABLE IF EXISTS todo_templates_backup'),
                env.DB.prepare('DROP INDEX IF EXISTS idx_todos_date_del'),
                env.DB.prepare('DROP INDEX IF EXISTS idx_todos_parent_date_del'),
                env.DB.prepare('DROP INDEX IF EXISTS idx_templates_repeat_type'),
              ]);
              await env.DB.batch([
                env.DB.prepare('ALTER TABLE todos RENAME TO todos_backup'),
                env.DB.prepare('ALTER TABLE todo_templates RENAME TO todo_templates_backup'),
              ]);
              // 重新创建空的主表（结构同 initDb 中的定义）
              await env.DB.batch([
                env.DB.prepare(`
                  CREATE TABLE todos (
                    id TEXT PRIMARY KEY,
                    parent_id TEXT NOT NULL,
                    date TEXT NOT NULL,
                    text TEXT NOT NULL,
                    time TEXT,
                    priority TEXT,
                    repeat INTEGER NOT NULL DEFAULT 0,
                    desc TEXT,
                    url TEXT,
                    copy_text TEXT,
                    subtasks TEXT,
                    search_terms TEXT,
                    done INTEGER NOT NULL DEFAULT 0,
                    deleted INTEGER NOT NULL DEFAULT 0,
                    repeat_type TEXT DEFAULT 'none',
                    repeat_custom TEXT DEFAULT ''
                  )
                `),
                env.DB.prepare(`CREATE INDEX idx_todos_date_del ON todos(date, deleted)`),
                env.DB.prepare(`CREATE INDEX idx_todos_parent_date_del ON todos(parent_id, date, deleted)`),
                env.DB.prepare(`
                  CREATE TABLE todo_templates (
                    parent_id TEXT PRIMARY KEY,
                    text TEXT, time TEXT, priority TEXT, desc TEXT, url TEXT,
                    copy_text TEXT, subtasks TEXT, search_terms TEXT,
                    repeat_type TEXT, repeat_custom TEXT,
                    anchor_date TEXT,
                    blacklist TEXT DEFAULT '[]'
                  )
                `),
                env.DB.prepare(`CREATE INDEX idx_templates_repeat_type ON todo_templates(repeat_type)`),
                env.DB.prepare('INSERT INTO import_sessions (id, mode, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?)')
                  .bind(importId, 'overwrite', 'active', now, now),
              ]);
            } catch (backupErr) {
                // 回滚：尝试把 backup 表重命名回来，并重建索引
                try {
                  await env.DB.batch([
                    env.DB.prepare('DROP TABLE IF EXISTS todos'),
                    env.DB.prepare('DROP TABLE IF EXISTS todo_templates'),
                    env.DB.prepare('ALTER TABLE todos_backup RENAME TO todos'),
                    env.DB.prepare('ALTER TABLE todo_templates_backup RENAME TO todo_templates'),
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_date_del ON todos(date, deleted)'),
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)'),
                    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)'),
                  ]);
                } catch (rollbackErr) {
                  console.error("Rollback after backup failure also failed:", rollbackErr);
                }
                return errResp('覆写前备份失败: ' + backupErr.message, 500);
            }
          } else {
            await env.DB.prepare('INSERT INTO import_sessions (id, mode, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?)')
              .bind(importId, 'merge', 'active', now, now).run();
          }

          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // phase=chunk — 分片写入
        else if (phase === 'chunk') {
          const importId = body.importId;
          if (!importId) return errResp('importId required');

          const session = await env.DB.prepare('SELECT * FROM import_sessions WHERE id = ? AND status = ?').bind(importId, 'active').first();
          if (!session) return errResp('无效或已过期的导入会话');

          const chunk = body.data || [];
          const type = body.type;

          await env.DB.prepare('UPDATE import_sessions SET updated_at = ? WHERE id = ?').bind(Date.now(), importId).run();

          if (chunk.length === 0) {
            return new Response(JSON.stringify({ success: true, inserted: 0 }), { headers: { 'Content-Type': 'application/json' } });
          }

          let stmts;
          if (type === 'templates') {
            stmts = buildTemplateStmts(chunk);
          } else {
            stmts = buildTodoStmts(chunk);
          }

          await execBatch(stmts);
          return new Response(JSON.stringify({ success: true, inserted: chunk.length }), { headers: { 'Content-Type': 'application/json' } });
        }

        // phase=finalize — 收尾
        else if (phase === 'finalize') {
          const importId = body.importId;
          if (!importId) return errResp('importId required');

          const session = await env.DB.prepare('SELECT * FROM import_sessions WHERE id = ?').bind(importId).first();
          if (!session) return errResp('会话不存在');

          if (session.mode === 'overwrite') {
            await clearBackupTables();
            try {
              await env.DB.batch([
                env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_date_del ON todos(date, deleted)'),
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

          // 删除会话记录
          await env.DB.prepare('DELETE FROM import_sessions WHERE id = ?').bind(importId).run();

          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // 未知 phase
        else {
          return errResp('未知 phase，可用: status, abort, init, chunk, finalize');
        }

      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (url.pathname === '/api/import-backup') {
      const action = url.searchParams.get('action') || 'query';
    
      try {
        // 查询备份状态
        if (action === 'query') {
          const [todoBakRes, tplBakRes] = await Promise.all([
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todo_templates_backup'").first(),
          ]);
          const hasTodoBak = !!todoBakRes;
          const hasTplBak = !!tplBakRes;
          return new Response(JSON.stringify({
            exists: hasTodoBak || hasTplBak,
            todos: hasTodoBak ? 'backup_exists' : 0,
            templates: hasTplBak ? 'backup_exists' : 0
          }), { headers: { 'Content-Type': 'application/json' } });
        }
    
        // 恢复备份
        if (action === 'restore') {
          const [todoBakRes, tplBakRes] = await Promise.all([
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todo_templates_backup'").first(),
          ]);
          const hasTodoBak = !!todoBakRes;
          const hasTplBak = !!tplBakRes;
    
          if (!hasTodoBak && !hasTplBak) {
            return new Response(JSON.stringify({ error: "未找到备份数据，无需恢复" }), {
              status: 404, headers: { 'Content-Type': 'application/json' }
            });
          }
    
          // RENAME 恢复：丢弃当前主表，将备份表重命名回主表，并重建索引
          try {
              await env.DB.batch([
                env.DB.prepare('DROP TABLE IF EXISTS todos'),
                env.DB.prepare('DROP TABLE IF EXISTS todo_templates'),
                env.DB.prepare('ALTER TABLE todos_backup RENAME TO todos'),
                env.DB.prepare('ALTER TABLE todo_templates_backup RENAME TO todo_templates'),
                env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_date_del ON todos(date, deleted)'),
                env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)'),
                env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)'),
              ]);
          } catch (e) {
            return new Response(JSON.stringify({
              error: "恢复失败: " + e.message + "，备份数据仍保留，可重试"
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
    
          return new Response(JSON.stringify({
            success: true,
            restored: { todos: hasTodoBak ? 'restored' : 0, templates: hasTplBak ? 'restored' : 0 }
          }), { headers: { 'Content-Type': 'application/json' } });
        }
    
        // 清除备份
        if (action === 'clear') {
          const [todoBakRes, tplBakRes] = await Promise.all([
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todo_templates_backup'").first(),
          ]);
          const hasTodoBak = !!todoBakRes;
          const hasTplBak = !!tplBakRes;
    
          if (!hasTodoBak && !hasTplBak) {
            return new Response(JSON.stringify({ success: true, message: "无残留备份，无需清除" }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
    
          await env.DB.batch([
            env.DB.prepare('DROP TABLE IF EXISTS todos_backup'),
            env.DB.prepare('DROP TABLE IF EXISTS todo_templates_backup'),
          ]);
          return new Response(JSON.stringify({
            success: true,
            message: "备份记录已清除（原始数据未恢复）"
          }), { headers: { 'Content-Type': 'application/json' } });
        }
    
        // 未知操作
        return new Response(JSON.stringify({
          error: "未知操作，可用: query, restore, clear"
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json' }
        });
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

    if (url.pathname === '/api/trash' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM todos WHERE deleted = 1 ORDER BY date DESC LIMIT 100').all();
      return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/trash-action' && request.method === 'POST') {
      const { action, id, ids } = await request.json();
      if (action === 'RESTORE') {
        const t = await env.DB.prepare('SELECT parent_id, date, repeat FROM todos WHERE id = ?').bind(id).first();
        await env.DB.prepare('UPDATE todos SET deleted = 0 WHERE id = ?').bind(id).run();
        if (t && t.repeat === 1) {
            const tpl = await env.DB.prepare('SELECT blacklist FROM todo_templates WHERE parent_id = ?').bind(t.parent_id).first();
            if (tpl && tpl.blacklist) {
                let bl =[]; try { bl = JSON.parse(tpl.blacklist); } catch(e){}
                if (bl.includes(t.date)) {
                    bl = bl.filter(d => d !== t.date);
                    await env.DB.prepare('UPDATE todo_templates SET blacklist = ? WHERE parent_id = ?').bind(JSON.stringify(bl), t.parent_id).run();
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
          const tasks = await env.DB.prepare(`SELECT parent_id, date, repeat FROM todos WHERE id IN (${placeholders})`).bind(...ids).all();
          await env.DB.prepare(`UPDATE todos SET deleted = 0 WHERE id IN (${placeholders})`).bind(...ids).run();
          const blUpdates = {};
          for (const t of tasks.results) {
            if (t.repeat === 1) {
              if (!blUpdates[t.parent_id]) blUpdates[t.parent_id] = [];
              blUpdates[t.parent_id].push(t.date);
            }
          }
          for (const pid of Object.keys(blUpdates)) {
            const tpl = await env.DB.prepare('SELECT blacklist FROM todo_templates WHERE parent_id = ?').bind(pid).first();
            if (tpl && tpl.blacklist) {
              let bl =[]; try { bl = JSON.parse(tpl.blacklist); } catch(e){}
              let changed = false;
              for (const d of blUpdates[pid]) {
                const idx = bl.indexOf(d);
                if (idx !== -1) { bl.splice(idx, 1); changed = true; }
              }
              if (changed) await env.DB.prepare('UPDATE todo_templates SET blacklist = ? WHERE parent_id = ?').bind(JSON.stringify(bl), pid).run();
            }
          }
        }
      } else if (action === 'BATCH_DELETE_PERMANENT') {
        if (ids && ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          await env.DB.prepare(`DELETE FROM todos WHERE id IN (${placeholders})`).bind(...ids).run();
        }
      } else if (action === 'CLEAR_ALL_DATA') {
        await env.DB.prepare('DELETE FROM todos').run();
        await env.DB.prepare('DELETE FROM todo_templates').run();
        await env.DB.prepare('DELETE FROM settings').run();
      }
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/todos' && request.method === 'GET') {
      const date = url.searchParams.get('date'); 
      if (!date) return new Response("Date required", { status: 400 });
      
      let { results } = await env.DB.prepare(
        'SELECT * FROM todos WHERE date = ? AND deleted = 0'
      ).bind(date).all();
      
      const targetDayOfWeek = String(getDayOfWeek(date));
      const targetDayOfMonth = date.slice(8, 10);   // "01"~"31"
      const targetMonthDay   = date.slice(5, 10);   // "01-01"~"12-31"
    
      const templatesReq = await env.DB.prepare(`
        SELECT * FROM todo_templates t
        WHERE t.repeat_type IN ('daily','weekly','monthly','yearly')
        AND t.anchor_date <= ?
        AND NOT EXISTS (
          SELECT 1 FROM todos td
          WHERE td.parent_id = t.parent_id
            AND td.date = ?
            AND td.deleted = 0
        )
        AND (
          t.repeat_type = 'daily'
          OR (t.repeat_type = 'weekly'  AND strftime('%w', t.anchor_date) = ?)
          OR (t.repeat_type = 'monthly' AND substr(t.anchor_date, 9, 2) = ?)
          OR (t.repeat_type = 'yearly'  AND substr(t.anchor_date, 6, 5) = ?)
        )
      `).bind(date, date, targetDayOfWeek, targetDayOfMonth, targetMonthDay).all();
    
      const insertStmts = [];
      let newlyFetchedSearchTerms = null;
    
      if (templatesReq.results && templatesReq.results.length > 0) {
        for (const tpl of templatesReq.results) {
          let parsedBlacklist = [];
          try { if (tpl.blacklist) parsedBlacklist = JSON.parse(tpl.blacklist); } catch(e){}
          if (parsedBlacklist.includes(date)) continue;
    
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
          done: 0, deleted: 0, repeat: 1, 
          subtasks: parsedSubtasks,
          search_terms: parsedSearchTerms
        };
        results.push(newRecord); 
      
        insertStmts.push(env.DB.prepare(
          'INSERT INTO todos (id, parent_id, date, text, time, priority, repeat, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          newId, tpl.parent_id, date, tpl.text, tpl.time || '', tpl.priority || 'low', 1, 
          tpl.desc || '', tpl.url || '', tpl.copy_text || '', 
          JSON.stringify(parsedSubtasks), JSON.stringify(parsedSearchTerms),
          0, 0, tpl.repeat_type || 'none', tpl.repeat_custom || ''  
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
        if (row.repeat === 1 && rType === 'none') rType = 'daily';

        return {
          ...row, 
          parentId: row.parent_id, 
          repeat: row.repeat === 1,
          repeat_type: rType,
          repeat_custom: row.repeat_custom || '',
          isSeries: row.repeat !== 0 || rType !== 'none',
          done: !!row.done,
          subtasks: parsedSubtasks,
          search_terms: parsedSearchTerms
        };
      });
    
      return new Response(JSON.stringify(formatted), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/todo-action' && request.method === 'POST') {
      const { action, date, task, scope, ids, doneStatus } = await request.json();

      try {
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
            const tasks = await env.DB.prepare(`SELECT parent_id, date, repeat FROM todos WHERE id IN (${placeholders})`).bind(...ids).all();
            await env.DB.prepare(`UPDATE todos SET deleted = 1 WHERE id IN (${placeholders})`).bind(...ids).run();
            
            const blUpdates = {};
            for (const t of tasks.results) {
              if (t.repeat === 1) { 
                if (!blUpdates[t.parent_id]) blUpdates[t.parent_id] = [];
                blUpdates[t.parent_id].push(t.date);
              }
            }
            for (const pid of Object.keys(blUpdates)) {
              const tpl = await env.DB.prepare('SELECT blacklist FROM todo_templates WHERE parent_id = ?').bind(pid).first();
              if (tpl) {
                let bl = []; try { bl = JSON.parse(tpl.blacklist || '[]'); } catch(e){}
                let changed = false;
                for (const d of blUpdates[pid]) { if (!bl.includes(d)) { bl.push(d); changed = true; } }
                if (changed) await env.DB.prepare('UPDATE todo_templates SET blacklist = ? WHERE parent_id = ?').bind(JSON.stringify(bl), pid).run();
              }
            }
          }
        }
        else if (action === 'CREATE') {
          const rptType = task.repeat_type || 'none';
          const rpt = rptType !== 'none' ? 1 : 0;
          await env.DB.prepare(
            'INSERT INTO todos (id, parent_id, date, text, time, priority, repeat, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            task.id, task.parentId || task.id, date, task.text, task.time || '', task.priority || 'low', 
            rpt, task.desc || '', task.url || '', task.copyText || '', JSON.stringify(task.subtasks||[]), JSON.stringify(task.search_terms||[]), 
            0, 0, rptType, ''
          ).run();
          
          if (rpt) {
              await env.DB.prepare(
                'INSERT INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, anchor_date, blacklist) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(
                task.parentId || task.id, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', 
                JSON.stringify(task.subtasks||[]), JSON.stringify(task.search_terms||[]), rptType, '', date, '[]'
              ).run();
          }
        }
        else if (action === 'UPDATE') {
          const rptType = task.repeat_type || 'none';
          const rpt = rptType !== 'none' ? 1 : 0;
          const subtasksStr = JSON.stringify(task.subtasks ||[]);
          const searchTermsStr = JSON.stringify(task.search_terms ||[]);
        
          if (scope === 'single' || rptType === 'none') {
            await env.DB.prepare(
              'UPDATE todos SET text=?, time=?, priority=?, repeat=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=? WHERE id=?'
            ).bind(task.text, task.time || '', task.priority || 'low', rpt, task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, rptType, '', task.id).run();
          } else if (scope === 'future') {
            await env.DB.prepare(
              'UPDATE todos SET text=?, time=?, priority=?, repeat=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=? WHERE parent_id=? AND date >= ?'
            ).bind(task.text, task.time || '', task.priority || 'low', rpt, task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, rptType, '', task.parentId, date).run();
          } else if (scope === 'all') {
            await env.DB.prepare(
              'UPDATE todos SET text=?, time=?, priority=?, repeat=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=? WHERE parent_id=?'
            ).bind(task.text, task.time || '', task.priority || 'low', rpt, task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, rptType, '', task.parentId).run();
          }
        
          if (scope === 'future' || scope === 'all') {
              if (rpt) {
                  let existingBlacklist = '[]';
                  try {
                    const existingTpl = await env.DB.prepare(
                      'SELECT blacklist FROM todo_templates WHERE parent_id = ?'
                    ).bind(task.parentId).first();
                    if (existingTpl && existingTpl.blacklist) {
                      existingBlacklist = existingTpl.blacklist;
                    }
                  } catch(e) {}
          
                  await env.DB.prepare(
                    'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, anchor_date, blacklist) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                  ).bind(
                    task.parentId, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', 
                    subtasksStr, searchTermsStr, rptType, '', date, existingBlacklist
                  ).run();
              } else {
                  await env.DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(task.parentId).run();
              }
          }
        }
        else if (action === 'DELETE') {
          if (scope === 'single' || (!task.repeat && !task.isSeries)) {
            await env.DB.prepare('UPDATE todos SET deleted = 1 WHERE id = ?').bind(task.id).run();
            if (task.isSeries) {
              const tpl = await env.DB.prepare('SELECT blacklist FROM todo_templates WHERE parent_id = ?').bind(task.parentId).first();
              if (tpl) {
                let bl = []; try { bl = JSON.parse(tpl.blacklist || '[]'); } catch(e){}
                if (!bl.includes(date)) {
                  bl.push(date);
                  await env.DB.prepare('UPDATE todo_templates SET blacklist = ? WHERE parent_id = ?').bind(JSON.stringify(bl), task.parentId).run();
                }
              }
            }
          } else if (scope === 'future') {
            await env.DB.prepare('UPDATE todos SET deleted = 1 WHERE parent_id=? AND date >= ?').bind(task.parentId, date).run();
            await env.DB.prepare("UPDATE todos SET repeat = -1, repeat_type = 'none', repeat_custom = '' WHERE parent_id=? AND date < ?").bind(task.parentId, date).run();
            await env.DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(task.parentId).run();
          } else if (scope === 'all') {
            await env.DB.prepare('UPDATE todos SET deleted = 1 WHERE parent_id=?').bind(task.parentId).run();
            await env.DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(task.parentId).run();
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }
    
  },
};

// 前端页面
function renderHTML(isAuthorized, customHeader, customContent) {
  let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>MOARA 待办事项</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    /* =========================================
       DEFAULT THEME: DARK BRUTALISM
       ========================================= */
    :root {
      --bg: #0a0a0a;
      --fg: #b0b0b0;
      --accent: #ff3300; 
      --crt: #00ff41;    
      --warn: #ffcc00;   
      --panel: #141414;
      --font-main: 'Courier New', Courier, monospace;
      --app-scale: 1;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; scrollbar-width: none; -ms-overflow-style: none; }
    *::-webkit-scrollbar { display: none; }
    
    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--font-main);
      overflow-x: hidden;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-bottom: 120px;
      zoom: var(--app-scale);
    }

    .scanlines {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(to bottom, rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%);
      background-size: 100% 2px;
      pointer-events: none;
      z-index: 999;
    }
    
    .container { width: 100%; max-width: calc(600px / var(--app-scale)); padding: 15px; position: relative; z-index: 1; }

    .top-actions { position: absolute; top: 15px; right: 15px; display: flex; gap: 8px; z-index: 10; }
    .top-actions-left { position: absolute; top: 15px; left: 15px; display: flex; gap: 8px; z-index: 10; }
    
    .theme-toggle-btn {
      background: #222; color: var(--fg);
      border: 1px solid #333; padding: 4px 8px;
      font-size: 0.75rem; cursor: pointer;
      font-family: var(--font-main);
      transition: 0.2s;
    }
    .theme-toggle-btn:hover { background: var(--fg); color: #000; }

    h1 {
      font-size: 1.5rem; text-transform: uppercase; border-bottom: 2px dashed var(--fg);
      padding-bottom: 10px; margin-bottom: 20px; text-align: center; letter-spacing: 1px;
    }
    h1 span { color: var(--accent); font-weight: bold; }

    button {
      background: #222; color: var(--fg); border: 1px solid var(--fg);
      padding: 8px 12px; font-family: var(--font-main); cursor: pointer;
      text-transform: uppercase; font-size: 0.85rem; transition: 0.2s;
    }
    button:active { background: var(--accent); color: #000; border-color: var(--accent); }
    
    .btn-primary { background: var(--accent); color: #000; border: none; font-weight: bold; }
    .btn-danger { color: var(--accent); border-color: var(--accent); }
    .btn-danger:hover { background: var(--accent); color: #000; }
    .btn-ghost { background: transparent; border: none; color: #666; }
    .btn-ghost:hover { color: var(--fg); }

    input, textarea, select {
      width: 100%; background: #000; border: 1px solid #444; color: var(--crt);
      padding: 12px; font-family: var(--font-main); font-size: 1rem; outline: none; margin-bottom: 10px;
    }
    input:focus, textarea:focus, select:focus { border-color: var(--crt); box-shadow: 0 0 5px rgba(0,255,65,0.3); }
    
    .fake-input {
      width: 100%; background: #000; border: 1px solid #444; color: var(--fg);
      padding: 12px; font-family: var(--font-main); font-size: 1rem; margin-bottom: 10px;
      cursor: pointer; display: flex; justify-content: space-between; align-items: center;
    }
    .fake-input:active { border-color: var(--accent); }
    .fake-input span { pointer-events: none; }

    .date-bar {
      display: flex; justify-content: space-between; align-items: center;
      background: #000; border: 1px solid var(--fg); padding: 8px; margin-bottom: 10px;
    }
    .date-display { text-align: center; cursor: pointer; }
    .date-display .main { font-size: 1.2rem; font-weight: bold; color: var(--crt); }
    .date-display .sub { font-size: 0.8rem; color: #aaa; display: block; }

    .toolbar { display: flex; justify-content: space-between; gap: 4px; margin-bottom: 15px; }
    .toolbar button { 
      flex: 1; font-size: 0.7rem; padding: 6px 2px; text-align: center; 
      border-color: #444; color: #888; white-space: nowrap; 
      overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.5px;
    }
    .toolbar button.active { border-color: var(--crt); color: var(--crt); }

    .todo-item {
      display: flex; align-items: center; background: var(--panel);
      border-left: 4px solid #333; margin-bottom: 10px; padding: 15px;
      cursor: pointer; transition: 0.2s; position: relative;
    }
    .todo-item:active { transform: scale(0.98); }
    
    .checkbox { width: 20px; height: 20px; border: 2px solid var(--fg); margin-right: 15px; flex-shrink: 0; transition: 0.2s; }
    
    .todo-item.done { border-left-color: #444; opacity: 0.45; filter: grayscale(80%); }
    .todo-item.done .item-title { text-decoration: line-through; color: #777; }
    .todo-item.done .checkbox { background: #222; border-color: #555; position: relative; }
    .todo-item.done .checkbox::after { content: '✓'; color: #666; position: absolute; left: 2px; top: -2px; font-size: 16px; font-weight: bold; }

    .todo-item .checkbox.batch-selected { background: var(--accent) !important; border-color: var(--accent) !important; position: relative; filter: none !important; opacity: 1 !important; }
    .todo-item .checkbox.batch-selected::after { content: '✓' !important; color: #000 !important; font-size: 16px; font-weight: bold; position: absolute; top: -2px; left: 2px; }

    .item-meta { display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; }
    .item-title { font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.2s; }
    .item-info { font-size: 0.75rem; color: #666; margin-top: 4px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    
    .badge { padding: 1px 4px; border-radius: 2px; font-size: 0.7rem; color: #000; font-weight: bold; }
    .badge-high { background: var(--accent); }
    .badge-med { background: var(--warn); }
    .badge-low { background: #888; }
    .badge-time { background: #333; color: var(--crt); border: 1px solid #444; }

    .btn-link {
      background: #222; border: 1px solid #444; color: var(--crt);
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      margin-left: 10px; font-size: 0.9rem; text-decoration: none; cursor: pointer; flex-shrink: 0;
    }
    .btn-link:hover { background: var(--crt); color: #000; }

    .fab {
      position: fixed; bottom: 30px; right: 30px; width: 60px; height: 60px;
      background: var(--accent); color: #000; font-size: 2.5rem;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #fff; box-shadow: 4px 4px 0 #000; z-index: 100; cursor: pointer;
    }

    .batch-bar {
      position: fixed; left: 50%;
      top: calc(100dvh - 20px - env(safe-area-inset-bottom, 0px));
      transform: translate(-50%, -100%);
      width: 92%; max-width: 600px;
      background: var(--panel); border: 2px solid var(--accent);
      padding: 10px; border-radius: 8px;
      display: flex; justify-content: space-between; gap: 8px;
      z-index: 150; animation: popupSlide 0.3s forwards;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
    }
    .batch-bar.closing { animation: popupSlideDown 0.3s forwards; }
    @keyframes popupSlide {
      from { transform: translate(-50%, 100%); opacity: 0; }
      to { transform: translate(-50%, -100%); opacity: 1; }
    }
    @keyframes popupSlideDown {
      from { transform: translate(-50%, -100%); opacity: 1; }
      to { transform: translate(-50%, 100%); opacity: 0; }
    }
    .batch-bar button { flex: 1; padding: 10px 2px; font-size: 0.75rem; letter-spacing: -0.5px; white-space: nowrap; }
    
    .modal-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.9); backdrop-filter: blur(4px);
      z-index: 200; display: none; justify-content: center; align-items: center;
    }
    .modal-overlay.active { display: flex; animation: fadeIn 0.2s; }
    .modal-content {
      width: 90%; max-width: 400px; max-height: 90vh; overflow-y: auto; background: #111; border: 1px solid var(--crt);
      padding: 20px; box-shadow: 0 0 30px rgba(0,255,65,0.1); position: relative;
    }

    #modal-time { z-index: 500; }

    .calendar-header { display: flex; justify-content: space-between; margin-bottom: 15px; color: var(--accent); font-weight: bold; align-items: center; }
    .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center; }
    .cal-day-name { color: #666; font-size: 0.8rem; margin-bottom: 5px; }
    .cal-date { padding: 10px 0; cursor: pointer; border: 1px solid transparent; color: var(--fg); }
    .cal-date:hover { border-color: var(--fg); }
    .cal-date.today { color: var(--accent); font-weight: bold; border: 1px dashed var(--accent); }
    .cal-date.selected { background: var(--crt); color: #000; font-weight: bold; box-shadow: 2px 2px 0 #000; }
    .cal-date.empty { pointer-events: none; }
    .cal-title-btn { cursor: pointer; border-bottom: 1px dashed var(--accent); padding: 0 2px; margin: 0 2px; transition: color 0.2s; }
    .cal-title-btn:hover { color: var(--crt); border-color: var(--crt); }

    .time-picker-container { display: flex; height: 200px; gap: 10px; margin-bottom: 15px; }
    .time-col { flex: 1; overflow-y: auto; border: 1px solid #333; display: flex; flex-direction: column; }
    .time-cell { padding: 8px; text-align: center; cursor: pointer; color: #666; font-size: 0.9rem; }
    .time-cell.active { background: var(--crt); color: #000; font-weight: bold; }
    .time-label { text-align: center; font-size: 0.8rem; color: var(--accent); margin-bottom: 5px; }

    .detail-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: #080808; z-index: 300; display: none; flex-direction: column;
      padding: 20px; overflow-y: auto;
    }
    .detail-overlay.active { display: flex; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    .detail-overlay.closing { animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

    .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid #333; padding-bottom: 10px; }
    .detail-label { color: #555; font-size: 0.8rem; margin-bottom: 5px; text-transform: uppercase; }
    .detail-value { 
      color: var(--fg); font-size: 1.1rem; margin-bottom: 20px; 
      border-left: 2px solid #333; padding-left: 10px; min-height: 28px; 
      display: flex; align-items: center; word-break: break-all;
    }
    .detail-value.editable { border-left: 2px solid var(--accent); background: #111; padding: 10px; outline: none; display: block; }
    .detail-value a { text-decoration: none; color: var(--crt); border-bottom: 1px dashed var(--crt); }

    .popover-menu {
      position: absolute; background: #000; border: 2px solid var(--accent);
      padding: 5px; z-index: 400; display: none; flex-direction: column; gap: 5px;
      box-shadow: 4px 4px 0 rgba(255, 62, 0, 0.5); width: max-content; min-width: auto; max-width: 280px; }
    .popover-menu button { text-align: left; border: none; background: transparent; color: var(--fg); padding: 10px; font-size: 0.9rem; letter-spacing: normal; white-space: nowrap; }
    .popover-menu button:hover { background: var(--accent); color: #000; }
    .popover-title { font-size: 0.7rem; color: #666; padding: 5px; border-bottom: 1px solid #333; margin-bottom: 2px; }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes slideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }

    .hidden { display: none !important; }
    .row { display: flex; gap: 10px; }
    .flex-1 { flex: 1; }
    .switch-label { display: flex; align-items: center; gap: 10px; color: var(--crt); cursor: pointer; margin-bottom: 15px; }
    .switch-box { width: 16px; height: 16px; border: 1px solid var(--crt); display: inline-block; position: relative; }
    .switch-box.checked::after { content: ''; position: absolute; top: 2px; left: 2px; right: 2px; bottom: 2px; background: var(--crt); }

    .subtask-view-item {
      display: flex; align-items: center; background: rgba(255,255,255,0.05);
      margin-bottom: 5px; padding: 10px; cursor: pointer; transition: 0.2s;
      border-left: 3px solid var(--fg); border-radius: 2px;
    }
    .subtask-view-item:active { transform: scale(0.98); }
    .subtask-view-item.done { opacity: 0.5; filter: grayscale(80%); border-left-color: #444; }
    .subtask-view-item.done .item-title { text-decoration: line-through; }
    .subtask-view-item .checkbox { width: 16px; height: 16px; margin-right: 12px; }
    .subtask-view-item.done .checkbox { background: #222; border-color: #555; position: relative; }
    .subtask-view-item.done .checkbox::after { content: '✓'; color: #666; position: absolute; left: 1px; top: -3px; font-size: 14px; font-weight: bold; }

    .subtask-edit-item {
      display: flex; align-items: center; gap: 10px; margin-bottom: 5px;
      background: var(--panel); padding: 8px; border: 1px solid #333; border-radius: 2px;
    }

    .search-card {
      background: var(--panel); border: 1px dashed var(--fg); padding: 12px;
      border-radius: 4px; display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; min-height: 50px;
    }
    .search-term-checkbox {
      width: 14px; height: 14px; border: 1px solid var(--fg); margin-right: 5px;
      cursor: pointer; position: relative; flex-shrink: 0;
    }
    .search-term-tag {
      background: #222; border: 1px solid #444; color: var(--crt);
      padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 5px;
      font-size: 0.85rem; transition: 0.2s; word-break: break-all;
    }
    .search-term-tag button {
      padding: 0; border: none; width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.9rem; color: var(--fg); background: transparent; flex-shrink: 0;
    }
    .search-term-tag button:hover { color: var(--accent); }
    .search-term-tag.done { opacity: 0.5; filter: grayscale(80%); border-color: #444; }
    .search-term-tag.done span { text-decoration: line-through; }
    .search-term-tag.done .search-term-checkbox { background: #222; border-color: #555; }
    .search-term-tag.done .search-term-checkbox::after { content: '✓'; position: absolute; left: 1px; top: -3px; font-size: 12px; color: #666; font-weight: bold; }

    .setting-item { display: flex; align-items: center; justify-content: space-between; background: var(--panel); padding: 10px; border: 1px solid #333; margin-bottom: 5px; border-radius: 4px; }
    .setting-item span { font-size: 0.9rem; color: var(--fg); }

    .settings-card { margin-bottom: 20px; background: var(--panel); padding: 15px; border: 1px dashed var(--fg); border-radius: 4px; }
    .settings-card.danger { border: 1px solid var(--accent); }
    .settings-text { font-size: 0.85rem; line-height: 1.6; color: #888; margin-bottom: 0; }
    .settings-text strong { color: var(--crt); }
    
    .md-code { background: #222; padding: 2px 4px; border-radius: 2px; color: var(--crt); font-family: var(--font-main); }
    .md-ul { padding-left: 20px; margin: 5px 0; }
    del { opacity: 0.6; }

    .stats-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
    .stats-row-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .chart-container { background: var(--panel); border: 1px dashed var(--fg); padding: 15px; border-radius: 4px; position: relative; }
    .chart-container-bar { height: 250px; }
    .chart-container-pie { height: 200px; display: flex; justify-content: center; align-items: center; }

    /* =========================================
       ISOLATED THEME: LIGHT CASSETTE FUTURISM
       ========================================= */[data-theme="light"] body { background-color: #F0EEE2; color: #1B1915; }[data-theme="light"] .scanlines { display: none !important; }[data-theme="light"] .theme-toggle-btn {
      background: #E5E5E5; color: #1B1915; border: 2px solid #1B1915;
      box-shadow: 2px 2px 0 #1B1915; font-weight: 900; border-radius: 4px;
    }[data-theme="light"] .theme-toggle-btn:hover { background: #1B1915; color: #F0EEE2; }[data-theme="light"] h1 { border-bottom: 4px solid #1B1915; color: #1B1915; }[data-theme="light"] h1 span {
      background: #1B1915; color: #E1AC07; padding: 0 8px;
      border-radius: 4px; border: 2px solid #1B1915; font-family: sans-serif;
    }[data-theme="light"] button {
      background: #F0F0F0; color: #1B1915; border: 2px solid #1B1915;
      box-shadow: 2px 2px 0 #1B1915; border-radius: 4px; font-weight: bold;
    }[data-theme="light"] button:active {
      transform: translate(2px, 2px); box-shadow: 0 0 0 #1B1915; background: #E5E5E5;
    }[data-theme="light"] .btn-primary { background: #CE2424; color: #FEFEFE; }[data-theme="light"] .btn-primary:active { background: #1B1915; color: #CE2424; }[data-theme="light"] .btn-danger { background: #FEFEFE; color: #CE2424; border: 2px solid #CE2424; box-shadow: 2px 2px 0 #CE2424; }[data-theme="light"] .btn-ghost { background: transparent; border: 2px dashed #E5E5E5; box-shadow: none; color: #1B1915; }[data-theme="light"] input,[data-theme="light"] textarea,[data-theme="light"] select,[data-theme="light"] .fake-input {
      background: #FEFEFE; color: #1B1915; border: 2px solid #1B1915;
      box-shadow: inset 2px 2px 0 #E5E5E5; border-radius: 4px;
    }[data-theme="light"] input:focus,[data-theme="light"] textarea:focus,[data-theme="light"] select:focus {
      border-color: #5C960B; box-shadow: inset 2px 2px 0 #E5E5E5, 0 0 0 3px rgba(92,150,11,0.3);
    }[data-theme="light"] .date-bar {
      background: #F0F0F0; border: 2px solid #1B1915;
      border-radius: 6px; box-shadow: 4px 4px 0 #1B1915; padding: 12px;
    }[data-theme="light"] .date-display .main {
      background: #1B1915; color: #5C960B; padding: 4px 12px;
      border-radius: 4px; border: 2px inset #E5E5E5; font-family: 'Courier New', monospace;
      text-shadow: 0 0 4px rgba(92,150,11,0.4); box-shadow: inset 0 0 10px #1B1915;
    }[data-theme="light"] .date-display .sub { color: #1B1915; font-weight: bold; margin-top: 5px; }[data-theme="light"] .toolbar button { background: #FEFEFE; color: #1B1915; border: 2px solid #1B1915; box-shadow: 2px 2px 0 #E5E5E5; }[data-theme="light"] .todo-item {
      background: #FEFEFE; border: 2px solid #1B1915;
      box-shadow: 4px 4px 0 #E5E5E5; border-left: 8px solid #1B1915; border-radius: 6px;
    }[data-theme="light"] .todo-item.done {
      background: #EAEAEA; border-color: #CCC; border-left-color: #AAA;
      box-shadow: 2px 2px 0 #CCC; opacity: 0.55; filter: grayscale(80%);
    }[data-theme="light"] .todo-item.done .item-title { color: #888; text-decoration: line-through 2px #AAA; }[data-theme="light"] .todo-item.done .checkbox { background: #DDD; border-color: #AAA; box-shadow: none; }[data-theme="light"] .todo-item.done .checkbox::after { color: #888; }[data-theme="light"] .checkbox {
      background: #FEFEFE; border: 2px solid #1B1915;
      box-shadow: inset 2px 2px 0 #E5E5E5; border-radius: 4px;
    }[data-theme="light"] .todo-item .checkbox.batch-selected { background: #5C960B !important; border-color: #1B1915 !important; box-shadow: none !important; }[data-theme="light"] .todo-item .checkbox.batch-selected::after { color: #FEFEFE !important; }[data-theme="light"] .item-info { color: #1B1915; font-weight: bold; }[data-theme="light"] .badge-high { background: #CE2424; color: #FEFEFE; border: 1px solid #1B1915; }[data-theme="light"] .badge-med { background: #E1AC07; color: #1B1915; border: 1px solid #1B1915; }[data-theme="light"] .badge-low { background: #E5E5E5; color: #1B1915; border: 1px solid #1B1915; }[data-theme="light"] .badge-time { background: #1B1915; color: #5C960B; border: 1px solid #1B1915; }[data-theme="light"] .btn-link {
      background: #E5E5E5; color: #1B1915; border: 2px solid #1B1915;
      box-shadow: 2px 2px 0 #1B1915; border-radius: 4px;
    }[data-theme="light"] .btn-link:hover { background: #1B1915; color: #F0EEE2; }
    [data-theme="light"] .batch-bar {
      border: 3px solid #1B1915; box-shadow: 6px 6px 0 #1B1915; background: #F0F0F0; border-top: 3px solid #1B1915;
    }[data-theme="light"] .fab {
      background: #CE2424; color: #FEFEFE; border: 4px solid #1B1915;
      box-shadow: 4px 4px 0 #1B1915; border-radius: 50%;
    }[data-theme="light"] .modal-overlay { background: rgba(27, 25, 21, 0.85); }[data-theme="light"] .modal-content {
      background: #F0F0F0; border: 4px solid #1B1915;
      box-shadow: 8px 8px 0 #1B1915; border-radius: 8px;
    }[data-theme="light"] .modal-content h3 { color: #1B1915; border-bottom: 2px solid #1B1915; }[data-theme="light"] .detail-overlay { background: #F0EEE2; }[data-theme="light"] .detail-header { border-bottom: 2px solid #1B1915; }[data-theme="light"] .detail-header span { background: #1B1915; color: #FEFEFE; padding: 4px 8px; border-radius: 4px; }[data-theme="light"] .detail-label { color: #1B1915; font-weight: bold; }[data-theme="light"] .detail-value {
      border-left: 4px solid #1B1915; background: #FEFEFE; padding: 10px;
      border-radius: 0 4px 4px 0; color: #1B1915; box-shadow: 2px 2px 0 #E5E5E5;
    }[data-theme="light"] .detail-value.editable { border-left: 4px solid #CE2424; box-shadow: inset 2px 2px 0 #E5E5E5; }[data-theme="light"] .detail-value a { color: #CE2424; border-bottom-color: #CE2424; }[data-theme="light"] .popover-menu {
      background: #FEFEFE; border: 3px solid #1B1915;
      box-shadow: 6px 6px 0 #1B1915; border-radius: 4px;
    }[data-theme="light"] .popover-menu button { color: #1B1915; border-bottom: 2px solid #F0F0F0; border-radius: 0; box-shadow: none; }[data-theme="light"] .popover-menu button:hover { background: #1B1915; color: #FEFEFE; }[data-theme="light"] .popover-title { color: #1B1915; font-weight: bold; border-bottom: 2px solid #1B1915; }[data-theme="light"] .calendar-header { color: #1B1915; border-bottom: 2px solid #1B1915; padding-bottom: 10px; }[data-theme="light"] .cal-day-name { color: #1B1915; font-weight: bold; }[data-theme="light"] .cal-date { color: #1B1915; border: 2px solid transparent; border-radius: 4px; }[data-theme="light"] .cal-date:hover { border-color: #1B1915; background: #E5E5E5; }[data-theme="light"] .cal-date.today { border-color: #CE2424; color: #CE2424; }[data-theme="light"] .cal-date.selected { background: #1B1915; color: #5C960B; box-shadow: 2px 2px 0 #5C960B; }[data-theme="light"] .time-col { border: 2px solid #1B1915; background: #FEFEFE; border-radius: 4px; }[data-theme="light"] .time-cell { color: #1B1915; }[data-theme="light"] .time-cell.active { background: #1B1915; color: #5C960B; }[data-theme="light"] .time-label { color: #1B1915; font-weight: bold; }[data-theme="light"] .switch-label { color: #1B1915; font-weight: bold; }[data-theme="light"] .switch-box { border: 2px solid #1B1915; background: #FEFEFE; border-radius: 3px; }[data-theme="light"] .switch-box.checked::after { background: #CE2424; border-radius: 1px; }[data-theme="light"] .subtask-view-item {
      background: rgba(0,0,0,0.03); border-left: 4px solid #1B1915; box-shadow: 2px 2px 0 #E5E5E5;
    }[data-theme="light"] .subtask-view-item.done { border-left-color: #AAA; }[data-theme="light"] .subtask-view-item.done .checkbox { background: #DDD; border-color: #AAA; box-shadow: none; }[data-theme="light"] .subtask-view-item.done .checkbox::after { color: #888; }[data-theme="light"] .subtask-edit-item {
      background: #FEFEFE; border: 2px solid #1B1915; box-shadow: 2px 2px 0 #E5E5E5;
    }[data-theme="light"] .search-card {
      background: #F0F0F0; border: 2px dashed #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5;
    }[data-theme="light"] .search-term-tag {
      background: #FEFEFE; border: 2px solid #1B1915; color: #1B1915; box-shadow: 2px 2px 0 #E5E5E5;
    }[data-theme="light"] .search-term-tag button { color: #1B1915; }[data-theme="light"] .search-term-tag button:hover { color: #CE2424; }[data-theme="light"] .search-term-tag.done { border-color: #AAA; background: #EAEAEA; }[data-theme="light"] .search-term-tag.done .search-term-checkbox { background: #DDD; border-color: #AAA; box-shadow: none; }[data-theme="light"] .search-term-tag.done .search-term-checkbox::after { color: #888; }
    [data-theme="light"] .setting-item { background: #FEFEFE; border-color: #1B1915; box-shadow: 2px 2px 0 #E5E5E5; }
    [data-theme="light"] .setting-item span { color: #1B1915; font-weight: bold; }
    [data-theme="light"] .settings-card { background: #F0F0F0; border: 2px dashed #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5; }[data-theme="light"] .settings-card.danger { border: 2px solid #CE2424; box-shadow: 4px 4px 0 #CE2424; background: #FEFEFE; }
    [data-theme="light"] .settings-text { color: #1B1915; font-weight: bold; }
    [data-theme="light"] .settings-text strong { color: #5C960B; }
    [data-theme="light"] .md-code { background: #E5E5E5; color: #5C960B; border: 1px solid #1B1915; }
    [data-theme="light"] .chart-container { background: #F0F0F0; border: 2px dashed #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5; }
    
    /* === 年度报告样式 === */
    .stats-tabs { display: flex; gap: 0; border: 1px solid var(--fg); overflow: hidden; }
    .stats-tab {
      padding: 5px 14px; font-size: 0.8rem; border: none !important;
      background: transparent !important; color: var(--fg) !important; cursor: pointer;
      text-transform: uppercase; letter-spacing: 0.5px; box-shadow: none !important;
    }
    .stats-tab.active { background: var(--accent) !important; color: #000 !important; font-weight: bold; }

    .annual-year-title {
      text-align: center; margin-bottom: 25px; padding: 12px 0;
      border-bottom: 1px dashed #333;
    }
    .annual-year-title span {
      font-size: 1.2rem; font-weight: bold; color: var(--crt); letter-spacing: 4px;
    }

    .annual-hero {
      text-align: center; padding: 30px 15px; margin-bottom: 25px;
      border: 2px solid var(--accent); background: var(--panel); position: relative; overflow: hidden;
    }
    .annual-hero::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, var(--accent), var(--warn), var(--crt));
    }
    .annual-ending-title {
      font-size: 1.8rem; font-weight: bold; color: var(--accent);
      margin-bottom: 8px; letter-spacing: 3px; text-transform: uppercase;
    }
    .annual-ending-subtitle {
      font-size: 0.75rem; color: #666; margin-bottom: 15px; letter-spacing: 4px;
    }
    .annual-ending-desc {
      font-size: 0.9rem; color: var(--fg); line-height: 1.8;
      border-top: 1px dashed #444; padding-top: 15px; text-align: left;
    }

    .annual-stats-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 25px;
    }
    .annual-stat-card {
      background: var(--panel); border: 1px solid #333; padding: 14px 10px; text-align: center;
    }
    .annual-stat-value { font-size: 1.6rem; font-weight: bold; color: var(--crt); }
    .annual-stat-label { font-size: 0.7rem; color: #666; text-transform: uppercase; margin-top: 4px; letter-spacing: 1px; }

    .annual-section-title {
      font-size: 0.8rem; color: var(--accent); text-transform: uppercase;
      letter-spacing: 2px; margin-bottom: 12px; padding-bottom: 5px;
      border-bottom: 1px dashed #444;
    }

    .annual-month-chart { margin-bottom: 25px; }
    .annual-month-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
    .annual-month-label { font-size: 0.7rem; color: #999; width: 30px; text-align: right; flex-shrink: 0; }
    .annual-month-bar-bg {
      flex: 1; height: 18px; background: #111; position: relative; overflow: hidden; border: 1px solid #222;
    }
    .annual-month-bar-total { height: 100%; position: absolute; top: 0; left: 0; background: rgba(255,255,255,0.06); }
    .annual-month-bar-done { height: 100%; position: absolute; top: 0; left: 0; background: var(--crt); opacity: 0.65; }
    .annual-month-count { font-size: 0.7rem; color: #aaa; width: 30px; flex-shrink: 0; }

    .annual-narrative {
      background: var(--panel); border: 1px dashed var(--fg); padding: 20px;
      line-height: 1.9; color: var(--fg); font-size: 0.9rem; margin-bottom: 20px;
    }
    .annual-narrative strong { color: var(--crt); }
    .annual-narrative em { color: var(--accent); font-style: normal; }
    .annual-narrative .highlight { color: var(--warn); font-weight: bold; border-bottom: 1px dashed var(--warn); }

    .annual-divider { text-align: center; color: #333; margin: 25px 0; letter-spacing: 5px; font-size: 0.8rem; }

    .annual-pri-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .annual-pri-label { font-size: 0.75rem; color: #999; width: 24px; flex-shrink: 0; text-align: right; }
    .annual-pri-bar-bg { flex: 1; height: 12px; background: #111; position: relative; overflow: hidden; border: 1px solid #222; }
    .annual-pri-bar-fill { height: 100%; position: absolute; top: 0; left: 0; }
    .annual-pri-count { font-size: 0.7rem; color: #aaa; width: 30px; flex-shrink: 0; }
    .annual-report-time { margin-top: 25px; padding-top: 15px; border-top: 1px dashed #333; text-align: center; font-size: 0.75rem; color: #666; line-height: 1.8; }

    /* Light theme 年度报告 */
    [data-theme="light"] .stats-tabs { border: 2px solid #1B1915; border-radius: 4px; }
    [data-theme="light"] .stats-tab { color: #1B1915 !important; border-radius: 0 !important; }
    [data-theme="light"] .stats-tab.active { background: #1B1915 !important; color: #5C960B !important; }
    [data-theme="light"] .annual-hero { background: #FEFEFE; border: 3px solid #1B1915; box-shadow: 6px 6px 0 #1B1915; border-radius: 8px; }
    [data-theme="light"] .annual-ending-title { color: #CE2424; }
    [data-theme="light"] .annual-ending-subtitle { color: #1B1915; }
    [data-theme="light"] .annual-ending-desc { border-top-color: #1B1915; color: #1B1915; }
    [data-theme="light"] .annual-stat-card { background: #FEFEFE; border: 2px solid #1B1915; box-shadow: 2px 2px 0 #E5E5E5; border-radius: 4px; }
    [data-theme="light"] .annual-stat-value { color: #5C960B; }
    [data-theme="light"] .annual-stat-label { color: #1B1915; font-weight: bold; }
    [data-theme="light"] .annual-section-title { color: #CE2424; border-bottom-color: #1B1915; }
    [data-theme="light"] .annual-month-bar-bg { background: #F0F0F0; border-color: #CCC; }
    [data-theme="light"] .annual-month-bar-total { background: rgba(0,0,0,0.06); }
    [data-theme="light"] .annual-month-bar-done { background: #5C960B; }
    [data-theme="light"] .annual-month-label { color: #1B1915; }
    [data-theme="light"] .annual-month-count { color: #1B1915; }
    [data-theme="light"] .annual-narrative { background: #FEFEFE; border: 2px dashed #1B1915; color: #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5; }
    [data-theme="light"] .annual-narrative strong { color: #5C960B; }
    [data-theme="light"] .annual-narrative em { color: #CE2424; }
    [data-theme="light"] .annual-divider { color: #CCC; }
    [data-theme="light"] .annual-year-title { border-bottom-color: #1B1915; }
    [data-theme="light"] .annual-year-title span { color: #5C960B; text-shadow: 0 0 4px rgba(92,150,11,0.3); }
    [data-theme="light"] .annual-pri-bar-bg { background: #F0F0F0; border-color: #CCC; }
    [data-theme="light"] .annual-pri-label { color: #1B1915; }
    [data-theme="light"] .annual-pri-count { color: #1B1915; }
    [data-theme="light"] .annual-report-time { border-top-color: #1B1915; color: #666; }
    [data-theme="light"] #custom-header-preview,
    [data-theme="light"] #custom-content-preview {
      background: #FEFEFE; color: #1B1915; border: 2px solid #1B1915;
      box-shadow: inset 2px 2px 0 #E5E5E5; border-radius: 4px;
    }
    
    [data-theme="light"] #preview-notice { background: #E1AC07; color: #1B1915; border-bottom: 2px solid #1B1915; }
    [data-theme="light"] #preview-notice .md-code { background: #1B1915; color: #E1AC07; border: 1px solid #1B1915; }
    
    /* === 显示大小调整 === */
    .scale-control { width: 100%; }
    .scale-slider-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .scale-slider-row .scale-label-sm { font-size: 0.7rem; color: #666; flex-shrink: 0; }
    .scale-slider-row .scale-label-lg { font-size: 1.15rem; color: #666; font-weight: bold; flex-shrink: 0; }
    .scale-slider-row input[type="range"] {
      flex: 1; -webkit-appearance: none; appearance: none;
      height: 6px; background: #222; border-radius: 3px;
      outline: none; margin-bottom: 0; border: none; padding: 0; width: auto;
    }
    .scale-slider-row input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--crt); cursor: pointer;
      border: 2px solid var(--fg);
      box-shadow: 0 0 6px rgba(0,255,65,0.3);
    }
    .scale-slider-row input[type="range"]::-moz-range-thumb {
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--crt); cursor: pointer;
      border: 2px solid var(--fg);
    }
    .scale-slider-row input[type="range"]::-moz-range-track {
      height: 6px; background: #222; border-radius: 3px; border: none;
    }
    .scale-value { 
      font-size: 0.85rem; color: var(--crt); min-width: 44px; text-align: center;
      font-weight: bold; flex-shrink: 0;
    }
    .scale-presets { display: flex; gap: 6px; margin-bottom: 12px; }
    .scale-preset-btn {
      flex: 1; padding: 8px 4px; font-size: 0.8rem;
      text-align: center; cursor: pointer;
      background: #222; border: 1px solid #444; color: var(--fg);
      font-family: var(--font-main); transition: 0.2s;
    }
    .scale-preset-btn.active {
      border-color: var(--crt); color: var(--crt);
      background: rgba(0,255,65,0.08);
    }
    .scale-preset-btn:active { background: var(--crt); color: #000; }
    .scale-preview-wrap {
      border: 1px dashed #444; border-radius: 4px; padding: 10px;
      background: var(--bg);
    }
    .scale-preview-wrap .todo-item { margin-bottom: 5px; pointer-events: none; }

    /* Light 主题 - 显示大小调整 */
    [data-theme="light"] .scale-slider-row input[type="range"] { background: #E5E5E5; }
    [data-theme="light"] .scale-slider-row input[type="range"]::-webkit-slider-thumb {
      background: #5C960B; border-color: #1B1915; box-shadow: 2px 2px 0 #1B1915;
    }
    [data-theme="light"] .scale-slider-row input[type="range"]::-moz-range-thumb {
      background: #5C960B; border-color: #1B1915;
    }
    [data-theme="light"] .scale-slider-row input[type="range"]::-moz-range-track { background: #E5E5E5; }
    [data-theme="light"] .scale-value { color: #5C960B; }
    [data-theme="light"] .scale-preset-btn {
      background: #FEFEFE; border: 2px solid #1B1915; color: #1B1915;
      box-shadow: 2px 2px 0 #E5E5E5; border-radius: 4px; font-weight: bold;
    }
    [data-theme="light"] .scale-preset-btn.active {
      border-color: #5C960B; color: #5C960B; background: rgba(92,150,11,0.08);
      box-shadow: 2px 2px 0 #5C960B;
    }
    [data-theme="light"] .scale-preset-btn:active { background: #5C960B; color: #FEFEFE; }
    [data-theme="light"] .scale-preview-wrap { background: #F0EEE2; border-color: #1B1915; }
    [data-theme="light"] .scale-label-sm,
    [data-theme="light"] .scale-label-lg { color: #1B1915; }
    
    .session-item { display: flex; align-items: center; background: var(--panel); border: 1px solid #333; margin-bottom: 8px; padding: 10px; border-radius: 4px; gap: 10px; flex-wrap: wrap; }
    .session-item.current-session { border-color: var(--crt); }
    .session-ua { flex: 1; font-size: 0.72rem; color: var(--fg); word-break: break-all; line-height: 1.4; min-width: 0; }
    .session-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .session-actions button { padding: 4px 8px; font-size: 0.75rem; }

    [data-theme="light"] .session-item { background: #FEFEFE; border-color: #1B1915; box-shadow: 2px 2px 0 #E5E5E5; border-radius: 4px; }
    [data-theme="light"] .session-item.current-session { border-color: #5C960B; }
    [data-theme="light"] .session-ua { color: #1B1915; }
    
    body:has(.modal-overlay.active, .detail-overlay.active) { overflow: hidden !important; touch-action: none; }
    .modal-overlay.active,
    .detail-overlay.active { overscroll-behavior: contain; }
    .io-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 99000; }
    .io-overlay-high { z-index: 99001; }
    .io-dialog { background: #0a0a0a; border: 1px solid #ff3300; padding: 25px 35px; text-align: center; font-family: Courier New, monospace; max-width: 90vw; min-width: 280px; }
    .io-title { font-size: 1.05rem; font-weight: bold; margin-bottom: 8px; color: #fff; }
    .io-sub { font-size: 0.85rem; color: #888; margin-bottom: 10px; }
    .io-sub-block { margin-bottom: 20px; white-space: pre-line; }
    .io-msg { font-size: 0.95rem; font-weight: bold; margin-bottom: 20px; color: #ff3300; white-space: pre-line; }
    .io-bar-bg { height: 4px; background: #222; border: 1px solid #333; }
    .io-bar-fill { height: 100%; width: 0%; background: #ff3300; transition: width 0.3s; }
    .io-btn-row { display: flex; gap: 10px; justify-content: center; }
    .io-btn { padding: 8px 25px; cursor: pointer; font-family: inherit; font-weight: bold; background: transparent; }
    .io-btn-primary { border: 1px solid #ff3300; color: #ff3300; }
    .io-btn-secondary { border: 1px solid #555; color: #888; }
    [data-theme="light"] .io-overlay { background: rgba(27,25,21,0.85); }
    [data-theme="light"] .io-dialog { background: #F0F0F0; border: 4px solid #1B1915; box-shadow: 8px 8px 0 #1B1915; border-radius: 8px; }
    [data-theme="light"] .io-title { color: #1B1915; }
    [data-theme="light"] .io-sub { color: #666; }
    [data-theme="light"] .io-msg { color: #CE2424; }
    [data-theme="light"] .io-bar-bg { height: 8px; background: #E5E5E5; border: 2px solid #1B1915; }
    [data-theme="light"] .io-bar-fill { background: #CE2424; }
    [data-theme="light"] .io-btn-primary { border: 3px solid #1B1915; color: #1B1915; box-shadow: 2px 2px 0 #1B1915; }
    [data-theme="light"] .io-btn-primary:hover { background: #1B1915; color: #FEFEFE; }
    [data-theme="light"] .io-btn-secondary { border: 2px solid #999; color: #666; }
    [data-theme="light"] .io-btn-secondary:hover { background: #E5E5E5; }
  </style>
  <script>/*CUSTOM_HEADER_PLACEHOLDER*/</script>
</head>
<body>
  <div class="scanlines"></div>
  
  <div id="preview-notice" class="hidden" style="background:var(--warn);color:#000;padding:8px 15px;text-align:center;font-weight:bold;font-size:0.85rem;position:fixed;top:0;left:0;right:0;z-index:1000;">⚠ 前端定制预览状态 — 自定义仅在本地生效 <span class="md-code" style="cursor:pointer;margin-left:8px;background:#000;color:var(--warn);" onclick="restoreAllPreview()">还原</span></div>

  <div class="container">
    <div class="top-actions-left ${isAuthorized ? '' : 'hidden'}">
      <button class="theme-toggle-btn" onclick="openTrash()">回收站</button>
      <button class="theme-toggle-btn" onclick="openStats()">统计</button>
    </div>
    <div class="top-actions ${isAuthorized ? '' : 'hidden'}">
      <button class="theme-toggle-btn" onclick="openSettings()">设置</button>
      <button id="theme-toggle-btn" class="theme-toggle-btn" onclick="toggleTheme()">自动</button>
    </div>
    <h1>待办事项</h1>

    <div id="login-view" class="${isAuthorized ? 'hidden' : ''}">
      <div style="border: 1px solid var(--accent); padding: 20px; text-align: center;">
        <p style="color:var(--accent); margin-bottom:15px;">[ 身份验证请求 ]</p>
        <input type="password" id="password-input" placeholder="输入密钥..." onkeydown="if(event.key==='Enter')login()">
        <button class="btn-primary" style="width:100%" onclick="login()">接入系统</button>
      </div>
    </div>

    <div id="app-view" class="${isAuthorized ? '' : 'hidden'}">
      
      <div class="date-bar">
        <button onclick="changeDate(-1)">&lt;</button>
        <div class="date-display" onclick="openCalendar()">
          <span class="main" id="date-main">LOADING...</span>
          <span class="sub" id="date-sub">点击切换日期</span>
        </div>
        <button onclick="changeDate(1)">&gt;</button>
      </div>

      <div class="toolbar">
        <button id="btn-batch-mode" onclick="toggleBatchMode()">≡ 批量</button>
        <button id="btn-filter-trigger" onclick="toggleFilterMenu(this)">筛选: 全部 ▼</button>
        <button id="btn-sort-trigger" onclick="toggleSortMenu(this)">排序: 时间 ▼</button>
        <button id="btn-sort-order" onclick="toggleSortOrder()">顺序: 正序 ▲</button>
      </div>

      <div id="todo-list"></div>
      
      <div class="fab" onclick="openAddModal()">+</div>
    </div>
  </div>

  <div id="batch-bar" class="batch-bar hidden">
    <button onclick="batchSelectAll()">全选</button>
    <button onclick="batchToggleDone()">批量完成/取消</button>
    <button class="btn-danger" onclick="batchDelete()">批量删除</button>
    <button onclick="exitBatchMode()">退出</button>
  </div>

  <div id="modal-add" class="modal-overlay" onclick="if(event.target===this) closeAddModal()">
    <div class="modal-content">
      <h3 style="margin-bottom:15px; padding-bottom:5px;">>> 新建事项</h3>
      <input type="text" id="add-text" placeholder="事项标题（必填）">
      
      <div class="detail-label" style="margin-top:10px;">子任务</div>
      <div class="row" style="margin-bottom:10px; align-items:stretch;">
        <input type="text" id="add-subtask-input" placeholder="输入子任务（可选）" style="margin-bottom:0; height:42px;" class="flex-1">
        <button onclick="addTempSubtask('add')" style="margin:0; height:42px;">添加</button>
      </div>
      <div id="add-subtasks-list" style="margin-bottom:15px;"></div>

      <div class="switch-label" onclick="toggleAddSearch()">
        <div class="switch-box" id="add-search-box"></div>
        <span>开启每日搜索</span>
      </div>
      <div id="add-search-actions" class="hidden" style="margin-bottom:15px;">
        <div class="row" style="margin-bottom:10px;">
          <div class="fake-input flex-1" id="add-search-provider-trigger" onclick="toggleProviderMenu('add', this)" style="margin-bottom:0; height:46px;">
            <span id="add-search-provider-display">自动 (随机源)</span>
            <span style="font-size:0.8rem; margin-right: 8px;">▼</span>
          </div>
          <button class="btn-ghost flex-1" id="add-search-regenerate-btn" style="margin-bottom:0; height:46px; padding: 0 5px;" onclick="regenerateAddSearchTerms()">获取热搜</button>
        </div>
        <div class="search-card" id="add-search-preview"></div>
      </div>

      <div class="row">
        <div class="fake-input flex-1" onclick="openTimePicker('add')">
          <span id="add-time-display">--:--</span>
          <span style="font-size:0.8rem">▼</span>
        </div>
        <div class="fake-input flex-1" id="add-priority-trigger" onclick="togglePriorityMenu('add', this)">
          <span id="add-priority-display">优先级: 低</span>
          <span style="font-size:0.8rem">▼</span>
        </div>
      </div>
      <input type="url" id="add-url" placeholder="URL / APP Scheme (可选)">
      <input type="text" id="add-copy" placeholder="快捷复制内容（可选）">
      
      <div class="detail-label" style="margin-top:10px;">日期 / 例行</div>
      <div class="row" style="margin-bottom: 10px;">
        <div class="fake-input flex-1" onclick="openCalendarForAdd()" style="margin-bottom:0;">
          <span id="add-date-display">----/--/--</span>
          <span style="font-size:0.8rem">▼</span>
        </div>
        <div class="fake-input flex-1" id="add-repeat-trigger" onclick="toggleRepeatMenu('add', this)" style="margin-bottom:0;">
          <span id="add-repeat-display">重复: 不重复</span>
          <span style="font-size:0.8rem">▼</span>
        </div>
      </div>
      
      <textarea id="add-desc" rows="3" placeholder="输入备注/详细描述（可选）"></textarea>
      <div class="row" style="margin-top:10px;">
        <button class="flex-1" onclick="closeAddModal()">取消</button>
        <button class="flex-1 btn-primary" onclick="confirmAddTask()">添加</button>
      </div>
    </div>
  </div>

  <div id="detail-view" class="detail-overlay">
    <div class="detail-header">
      <button onclick="closeDetail()" style="padding: 4px 8px;">← 返回</button>
      <span style="font-weight:bold; margin-top: 2px;">事项详情</span>
      <button id="btn-edit-toggle" onclick="toggleEditMode()" style="padding: 4px 8px;">编辑</button>
    </div>
    <div id="detail-content"></div>
    <div style="margin-top:auto; display:flex; gap:10px; padding-top:20px;">
      <button class="btn-danger flex-1" id="btn-delete-task">删除事项</button>
      <button class="btn-primary flex-1 hidden" id="btn-save-task">保存变更</button>
    </div>
  </div>

  <div id="trash-overlay" class="detail-overlay">
    <div class="detail-header" style="align-items: center;">
      <button onclick="closeTrash()" style="padding: 4px 8px;">← 返回</button>
      <span style="font-weight:bold;">回收站</span>
      <div style="display:flex; gap:8px;">
        <button id="btn-trash-batch" class="btn-ghost" style="padding:4px 8px; border:1px solid #666;" onclick="toggleTrashBatchMode()">批量</button>
        <button class="btn-danger" style="padding:4px 8px; border:1px solid #666;" onclick="clearTrash()">清空</button>
      </div>
    </div>
    <div id="trash-list" style="flex:1; overflow-y:auto; padding-bottom: 20px;"></div>
    
    <div id="trash-batch-bar" class="batch-bar hidden" style="z-index: 350;">
      <button onclick="batchTrashSelectAll()">全选</button>
      <button onclick="batchTrashRestore()">恢复选中</button>
      <button class="btn-danger" onclick="batchTrashDelete()">彻底删除</button>
      <button onclick="exitTrashBatchMode()">退出</button>
    </div>
  </div>

  <div id="stats-overlay" class="detail-overlay">
    <div class="detail-header" style="align-items: center;">
      <button onclick="closeStats()" style="padding: 4px 8px;">← 返回</button>
      <span style="font-weight:bold;" id="stats-title-text">7天统计</span>
      <button id="stats-switch-btn" class="btn-ghost hidden" style="padding:4px 8px; border:1px solid #666;" onclick="switchStatsTab()">年度报告</button>
    </div>
    <div style="flex:1; overflow-y:auto; padding-bottom: 20px;">
      <div id="stats-weekly">
        <div id="stats-loading" style="text-align:center; padding:40px; color:var(--fg);">数据拉取中...</div>
        <div id="stats-content" class="hidden">
          <div class="stats-grid">
            <div class="chart-container chart-container-bar"><canvas id="chart-bar"></canvas></div>
            <div style="text-align: center; color: var(--crt); font-weight: bold; font-size: 1.1rem; margin: 5px 0;" id="stats-total-info">近7天总完成数: 0</div>
            <div class="stats-row-bottom">
              <div class="chart-container chart-container-pie"><canvas id="chart-pie-priority"></canvas></div>
              <div class="chart-container chart-container-pie"><canvas id="chart-pie-status"></canvas></div>
            </div>
          </div>
        </div>
      </div>
      <div id="stats-annual" class="hidden">
        <div id="annual-loading" style="text-align:center; padding:40px; color:var(--fg);">年度数据加载中...</div>
        <div id="annual-content" class="hidden"></div>
      </div>
    </div>
  </div>

  <div id="settings-overlay" class="detail-overlay">
    <div class="detail-header" style="align-items: center;">
      <button onclick="closeSettings()" style="padding: 4px 8px;">← 返回</button>
      <span style="font-weight:bold;">系统设置</span>
      <button onclick="saveAndCloseSettings()" style="padding: 4px 8px;">保存</button>
    </div>
    <div style="flex:1; overflow-y:auto; padding-bottom: 20px;">
      
      <div class="detail-label">偏好设置</div>
      <div style="margin-bottom: 20px;">
          <div class="setting-item">
              <span class="flex-1">每日搜索源</span>
              <div class="fake-input" onclick="toggleSettingPopover('provider', this)" style="width: 145px; margin-bottom: 0; padding: 6px 8px; justify-content: space-between; border-radius: 4px;">
                  <span id="set-disp-provider">自动 (随机源)</span>
                  <span style="font-size:0.8rem; margin-right: 4px;">▼</span>
              </div>
          </div>
          <div class="setting-item">
              <span class="flex-1">排序方式</span>
              <div class="fake-input" onclick="toggleSettingPopover('sort', this)" style="width: 145px; margin-bottom: 0; padding: 6px 8px; justify-content: space-between; border-radius: 4px;">
                  <span id="set-disp-sort">按时间</span>
                  <span style="font-size:0.8rem; margin-right: 4px;">▼</span>
              </div>
          </div>
          <div class="setting-item">
              <span class="flex-1">排序顺序</span>
              <div class="fake-input" onclick="toggleSettingPopover('sortAsc', this)" style="width: 145px; margin-bottom: 0; padding: 6px 8px; justify-content: space-between; border-radius: 4px;">
                  <span id="set-disp-sort-asc">正序</span>
                  <span style="font-size:0.8rem; margin-right: 4px;">▼</span>
              </div>
          </div>
          <div class="setting-item" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
              <span>显示大小</span>
              <span class="md-code" style="cursor:pointer;margin-left:auto;" onclick="resetScaleBrowserData()">重置</span>
            </div>
            <div class="scale-control">
              <div class="scale-slider-row">
                <span class="scale-label-sm">A</span>
                <input type="range" id="scale-slider" min="0.75" max="1.25" step="0.01" value="1" oninput="onScaleSliderChange(this.value)">
                <span class="scale-label-lg">A</span>
                <span class="scale-value" id="scale-value-display">100%</span>
              </div>
              <div class="scale-presets">
                <button class="scale-preset-btn" data-scale="0.85" onclick="setScalePreset(0.85)">小</button>
                <button class="scale-preset-btn active" data-scale="1.0" onclick="setScalePreset(1.0)">默认</button>
                <button class="scale-preset-btn" data-scale="1.15" onclick="setScalePreset(1.15)">大</button>
              </div>
              <div class="scale-preview-wrap">
                <div id="scale-preview" style="zoom:1;">
                  <div class="todo-item" style="margin-bottom:5px;">
                    <div class="checkbox"></div>
                    <div class="item-meta">
                      <div class="item-title">示例待办事项</div>
                      <div class="item-info">
                        <span class="badge badge-high">高</span>
                        <span class="badge badge-time">09:00</span>
                      </div>
                    </div>
                  </div>
                  <div class="todo-item done">
                    <div class="checkbox"></div>
                    <div class="item-meta">
                      <div class="item-title">已完成的任务</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>
      
      <div class="settings-card">
          <div class="setting-item" style="margin-bottom: 15px; border: none; padding: 0;">
              <span class="settings-text" style="margin:0;"><strong>启用前端定制注入</strong></span>
              <div class="switch-label" onclick="toggleCustomCodeEnabled()" style="margin-bottom: 0;">
                  <div class="switch-box" id="custom-code-enabled-box"></div>
              </div>
          </div>

          <p class="settings-text" style="margin-bottom: 12px;">关闭后将不再注入自定义代码，但代码仍会保留在数据库中。</p>
          
         <div class="detail-label" style="margin-top: 6px;">自定义头部</div>
        <textarea id="custom-header-preview" rows="5"
          style="resize:vertical; font-size:0.8rem; margin-bottom: 12px;"
          placeholder="未配置或已关闭 — 将注入到 &lt;head&gt; 内"></textarea>
          <div class="detail-label">自定义内容</div>
          <textarea id="custom-content-preview" rows="5"
            style="resize:vertical; font-size:0.8rem; margin-bottom: 12px;"
            placeholder="未配置或已关闭 — 将注入到 &lt;/body&gt; 前"></textarea>
          <div id="custom-action-row" style="display:none; gap:10px; margin-bottom:12px;">
              <span class="md-code" style="cursor:pointer; flex:1; text-align:center;" onclick="previewCustomCode()">预览</span>
              <span class="md-code" style="cursor:pointer; flex:1; text-align:center;" onclick="resetCustomCode()">重置</span>
              <span class="md-code" style="cursor:pointer; color:var(--accent); flex:1; text-align:center; display:none;" id="restore-custom-btn" onclick="restoreAllPreview()">还原</span>
          </div>
          <div class="settings-text" style="border-top: 1px dashed #333; padding-top: 10px;">
            <strong>说明：</strong>通过编辑区注入自定义 HTML/CSS/JS，存储在 D1 数据库中。（可留空）<br>
            <strong>自定义头部</strong> — 注入到 <span class="md-code">&lt;head&gt;</span> 内（适合放 <span class="md-code">&lt;style&gt;</span>、外部 CSS、meta 标签等）<br>
            <strong>自定义内容</strong> — 注入到 <span class="md-code">&lt;/body&gt;</span> 前（适合放 <span class="md-code">&lt;script&gt;</span>、HTML 片段等）
          </div>
      </div>

      <div class="detail-label">数据管理 (导入/导出 JSON)</div>
      <div class="settings-card">
          <div class="settings-text" style="margin-bottom: 10px;">即将导出的内容包括：</div>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer;">
            <input type="checkbox" id="export-todos" checked style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">活动与历史待办事项（含重复模板）</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer;">
            <input type="checkbox" id="export-trash" checked style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">仅回收站中的数据（相关的黑名单在重复模板中）</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:15px; cursor:pointer;">
            <input type="checkbox" id="export-settings" checked style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">偏好设置与自定义代码</span>
          </label>
          <div class="row">
              <button class="flex-1" onclick="exportData()">导出数据</button>
              <button class="flex-1" onclick="document.getElementById('import-file').click()">导入数据</button>
              <input type="file" id="import-file" style="display:none" accept=".json" onchange="importData(event)">
          </div>
          <div class="settings-text" style="border-top: 1px dashed #333; padding-top: 10px; margin-top: 15px;">
           <strong>/api/import-backup: </strong>执行覆盖模式导入时，系统会将当前 <span class="md-code">todos、todo_templates</span> 表直接重命名为备份表，然后创建空表接收新数据。导入成功则删除备份表，导入异常将自动把备份表重命名回主表恢复原数据。若自动恢复也失败（极端情况）或存在残留，可在浏览器地址栏访问以下接口手动处理。<br>
           <span class="md-code">?action=query</span> — 查询是否存在备份表<br>
           <span class="md-code">?action=restore</span> — 恢复备份表（当前数据将被覆盖）<br>
           <span class="md-code">?action=clear</span> — 清空备份表
          </div>
      </div>

      <div class="detail-label">登录管理</div>
      <div class="settings-card">
          <p class="settings-text" style="margin-bottom: 12px;">最多支持 <strong>3</strong> 个浏览器UA同时登录。达到上限后新登录将自动替换最早（靠上）登录的会话。</p>
          <div id="sessions-list" style="margin-bottom: 12px;"></div>
          <button class="btn-danger" style="width:100%" onclick="deleteAllSessions()">全部删除</button>
      </div>

      <div class="detail-label">关于 MOARA 待办事项</div>
      <div class="settings-card">
          <p class="settings-text" style="margin-bottom:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><strong>当前版本:</strong> <span id="app-version-display"></span> <span id="update-status"></span> <span class="md-code" style="cursor:pointer;font-size:0.75rem;" onclick="checkUpdate()">检查</span></p>
          <p class="settings-text" style="margin-bottom: 5px;"><strong>底层架构:</strong> Cloudflare Worker + D1 Database</p>
          <p class="settings-text"><strong>项目描述:</strong> 普通的待办事项管理</p>
      </div>

      <div class="detail-label" style="color: var(--accent);">危险区域</div>
      <div class="settings-card danger">
          <div class="settings-text" style="margin-bottom: 10px;">退出当前登录会话，需重新输入密钥接入系统。您的数据不会消失。</div>
          <button class="btn-danger" style="width:100%" onclick="logout()">退出登录</button>
          
          <p class="settings-text" style="margin-bottom: 15px; margin-top: 20px; padding-top: 20px; border-top: 1px dashed var(--accent);">执行此操作将不可逆地清空所有的系统记录、回收站数据并重置偏好设置。建议提前导出备份。</p>
          <button class="btn-danger" style="width:100%" onclick="factoryReset()">恢复出厂设置</button>
      </div>

    </div>
  </div>

  <div id="popover-action" class="popover-menu">
    <div class="popover-title" id="popover-title">选择操作范围:</div>
    <div id="popover-options"></div>
  </div>

  <div id="popover-filter" class="popover-menu">
    <button onclick="setFilterMethod('all')">全部</button>
    <button onclick="setFilterMethod('todo')">未完成</button>
    <button onclick="setFilterMethod('done')">已完成</button>
  </div>

  <div id="popover-priority" class="popover-menu">
    <button onclick="selectPriority('low')">优先级: 低</button>
    <button onclick="selectPriority('med')">优先级: 中</button>
    <button onclick="selectPriority('high')">优先级: 高</button>
  </div>

  <div id="popover-sort" class="popover-menu">
    <button onclick="setSortMethod('time')">按时间</button>
    <button onclick="setSortMethod('priority')">按优先级</button>
  </div>

  <div id="popover-provider" class="popover-menu">
    <button onclick="selectProvider('auto')">自动 (随机源)</button>
    <button onclick="selectProvider('bilibili')">哔哩哔哩</button>
    <button onclick="selectProvider('weibo')">微博热搜</button>
    <button onclick="selectProvider('zhihu')">知乎热榜</button>
    <button onclick="selectProvider('baidu')">百度热搜</button>
  </div>

  <div id="popover-repeat" class="popover-menu">
    <button onclick="selectRepeat('none', '不重复')">不重复</button>
    <button onclick="selectRepeat('daily', '每天')">每天</button>
    <button onclick="selectRepeat('weekly', '每周')">每周</button>
    <button onclick="selectRepeat('monthly', '每月')">每月</button>
    <button onclick="selectRepeat('yearly', '每年')">每年</button>
  </div>

  <div id="popover-set-provider" class="popover-menu">
    <button onclick="selectSetting('provider', 'auto', '自动 (随机源)')">自动 (随机源)</button>
    <button onclick="selectSetting('provider', 'bilibili', '哔哩哔哩')">哔哩哔哩</button>
    <button onclick="selectSetting('provider', 'weibo', '微博热搜')">微博热搜</button>
    <button onclick="selectSetting('provider', 'zhihu', '知乎热榜')">知乎热榜</button>
    <button onclick="selectSetting('provider', 'baidu', '百度热搜')">百度热搜</button>
  </div>
  <div id="popover-set-sort" class="popover-menu">
    <button onclick="selectSetting('sort', 'time', '按时间')">按时间</button>
    <button onclick="selectSetting('sort', 'priority', '按优先级')">按优先级</button>
  </div>
  <div id="popover-set-sortAsc" class="popover-menu">
    <button onclick="selectSetting('sortAsc', 'true', '正序')">正序</button>
    <button onclick="selectSetting('sortAsc', 'false', '倒序')">倒序</button>
  </div>

  <div id="modal-calendar" class="modal-overlay" style="z-index:250;" onclick="if(event.target===this) closeCalendar()">
    <div class="modal-content">
      <div class="calendar-header">
        <span style="cursor:pointer" onclick="calChange(-1)" id="cal-prev">&lt; 上月</span>
        <span id="cal-title"></span>
        <span style="cursor:pointer" onclick="calChange(1)" id="cal-next">下月 &gt;</span>
      </div>
      <div class="calendar-grid" id="cal-grid"></div>
      <button id="cal-action-btn" class="btn-ghost" style="width:100%; margin-top:15px;" onclick="jumpToToday()">返回今日</button>
    </div>
  </div>

  <div id="modal-time" class="modal-overlay" onclick="if(event.target===this) closeTimePicker()">
    <div class="modal-content">
      <h3 style="text-align:center; margin-bottom:10px;">选择时间</h3>
      <div class="row">
        <div class="flex-1"><div class="time-label">时</div></div>
        <div class="flex-1"><div class="time-label">分</div></div>
      </div>
      <div class="time-picker-container">
        <div class="time-col" id="time-col-hour"></div>
        <div class="time-col" id="time-col-min"></div>
      </div>
      <div class="row">
        <button class="flex-1" onclick="clearTime()">清除</button>
        <button class="flex-1 btn-primary" onclick="confirmTime()">确认</button>
      </div>
    </div>
  </div>

  <script>/*CUSTOM_GLOBALS_PLACEHOLDER*/</script>
  <script>
  (function() {
    'use strict';

    function _injectPreview(target, html) {
      if (!html) return;
      var temp = document.createElement('div');
      temp.innerHTML = html;
      var scripts = Array.prototype.slice.call(temp.querySelectorAll('script'));
      var scriptData = scripts.map(function(s) {
        return { src: s.src, text: s.textContent, type: s.type };
      });
      scripts.forEach(function(s) { if (s.parentNode) s.parentNode.removeChild(s); });
      while (temp.firstChild) target.appendChild(temp.firstChild);
      scriptData.forEach(function(s) {
        var el = document.createElement('script');
        if (s.src) el.src = s.src;
        if (s.type) el.type = s.type;
        el.textContent = s.text;
        target.appendChild(el);
      });
    }
    
    var _previewRedirecting = false;
    (function(){
      var ph = localStorage.getItem('preview_custom_header');
      var pc = localStorage.getItem('preview_custom_content');
      var hasPreview = ph !== null || pc !== null;
      if (hasPreview && window.location.search.indexOf('preview=1') === -1) {
        _previewRedirecting = true;
        window.location.href = window.location.pathname + '?preview=1';
        return;
      }
      if (!hasPreview && window.location.search.indexOf('preview=1') !== -1) {
        _previewRedirecting = true;
        window.location.href = window.location.pathname;
        return;
      }
      if (hasPreview) {
        if (ph !== null) { try { _injectPreview(document.head, ph); } catch(e){ console.error('Preview header inject error:', e); } }
        if (pc !== null) { try { _injectPreview(document.body, pc); } catch(e){ console.error('Preview content inject error:', e); } }
        var notice = document.getElementById('preview-notice');
        if (notice) { notice.classList.remove('hidden'); document.body.style.paddingTop = '40px'; }
      }
    })();
    
    async function generateSearchTerms(provider = 'auto') {
      try {
        const res = await fetch(\`/api/hot-search?provider=\${provider}\`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
            const validWords = json.data.filter(w => typeof w === 'string' && w.trim().length > 0);
            return validWords.sort(() => 0.5 - Math.random()).slice(0, 20).map(w => ({ text: w, done: false }));
          }
        }
      } catch (e) { console.error("Hot Search API error:", e); }
      return[];
    }

    function parseMarkdown(text) {
      if (!text) return '';
      let lines = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').split('\\n');
      let html = '';
      let inList = false;

      const formatInline = (str) => {
        return str
          .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
          .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
          .replace(/_([^_]+)_/g, '<em>$1</em>')
          .replace(/~~([^~]+)~~/g, '<del>$1</del>')
          .replace(/\`([^\`]+)\`/g, '<code class="md-code">$1</code>');
      };

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let isList = /^(\\s*[-*]\\s+)(.*)$/.exec(line);
        if (isList) {
          if (!inList) { html += '<ul class="md-ul">'; inList = true; }
          let content = isList[2];
          html += '<li>' + formatInline(content) + '</li>';
          continue;
        } else {
          if (inList) { html += '</ul>'; inList = false; }
        }
        html += formatInline(line) + (i === lines.length - 1 ? '' : '<br>');
      }
      if (inList) html += '</ul>';
      return html;
    }

    let currentThemeMode = localStorage.getItem('themeMode') || 'auto';
    function applyTheme() {
      let isLight = false;
      if (currentThemeMode === 'light') isLight = true;
      else if (currentThemeMode === 'dark') isLight = false;
      else {
        const hour = new Date().getHours();
        isLight = hour >= 6 && hour < 18; 
      }
      if (isLight) document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
      
      const btn = document.getElementById('theme-toggle-btn');
      if (btn) {
        if (currentThemeMode === 'auto') btn.innerText = '自动';
        else if (currentThemeMode === 'light') btn.innerText = '亮色';
        else btn.innerText = '暗色';
      }
    }

    function toggleTheme() {
      if (currentThemeMode === 'auto') currentThemeMode = 'light';
      else if (currentThemeMode === 'light') currentThemeMode = 'dark';
      else currentThemeMode = 'auto';
      localStorage.setItem('themeMode', currentThemeMode);
      applyTheme();
    }
    applyTheme();
    setInterval(applyTheme, 60000); 

    let currentDate = new Date();
    let todos =[];
    let currentDetailIndex = -1;
    let isEditMode = false;
    let pendingAction = null; 
    let filterMethod = 'all'; 
    
    let tempSubtasks =[];
    let tempSearchTerms =[];
    let addSearchState = false;
    let tempSearchProvider = 'auto';

    let tempPriority = 'low'; 
    let tempTime = ''; 
    let tempRepeatType = 'none';
    let tempAddDate = '';
    let calendarMode = 'navigate';
    
    let activeMode = ''; 
    let calDate = new Date(); 
    let calMode = 'date'; 
    let yearPickerStart = new Date().getFullYear() - 4;

    let isBatchMode = false;
    let selectedTasks = new Set();
    
    let trashTodos =[];
    let isTrashBatchMode = false;
    let selectedTrashTasks = new Set();

    let sortMethod = 'time'; 
    let sortAsc = true; 
    let appSettings = {};
    let tempSetProvider = 'auto';
    let tempSetSort = 'time';
    let tempSetSortAsc = true;
    let customCodeEnabled = false;
    
    let sessionsList = [];
    
    var CURRENT_VERSION = 'v2.6.8.2';
    
    function initVersionDisplay() {
      var el = document.getElementById('app-version-display');
      if (el) el.textContent = CURRENT_VERSION;
    }
    
    async function checkUpdate() {
      var s = document.getElementById('update-status');
      if (!s) return;
      s.innerHTML = '<span style="color:#888;font-size:0.8rem;">检查中...</span>';
      try {
        var res = await fetch('https://api.github.com/repos/moaradc/cf-todo/releases/latest', {
          headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var d = await res.json();
        if (!d.tag_name) throw new Error('No tag');
    
        var latest = d.tag_name;
        var cmp = compareVersions(CURRENT_VERSION, latest);
    
        if (cmp < 0) {
          var dl = d.assets && d.assets[0]
            ? ' | <a href="' + d.assets[0].browser_download_url + '" style="color:var(--accent);font-size:0.8rem;text-decoration:none;">下载</a>'
            : '';
          s.innerHTML = '<span style="font-size:0.8rem;font-weight:bold;">→ ' + escapeHtml(latest) + '</span> '
            + '<a href="' + d.html_url + '" target="_blank" style="color:var(--accent);font-size:0.8rem;text-decoration:none;">GitHub</a>' + dl;
        } else {
          s.innerHTML = '<span style="font-size:0.8rem;">已是最新</span>';
        }
      } catch (e) {
        s.innerHTML = '<span style="color:var(--accent);font-size:0.8rem;">检查失败</span>';
      }
    }
    
    function compareVersions(v1, v2) {
      var s1 = v1.replace(/^v/, '').split('.');
      var s2 = v2.replace(/^v/, '').split('.');
      var len = Math.max(s1.length, s2.length);
      for (var i = 0; i < len; i++) {
        var n1 = parseInt(s1[i], 10) || 0;
        var n2 = parseInt(s2[i], 10) || 0;
        if (n1 < n2) return -1;
        if (n1 > n2) return 1;
      }
      return 0;
    }

    function escapeHtml(text) {
      var div = document.createElement('div');
      div.appendChild(document.createTextNode(text));
      return div.innerHTML;
    }

    async function loadSessions() {
      try {
        const res = await fetch('/api/sessions');
        if (res.ok) {
          sessionsList = await res.json();
          renderSessions();
        }
      } catch(e) { console.error('Load sessions error:', e); }
    }

    function renderSessions() {
      const container = document.getElementById('sessions-list');
      if (!container) return;
      if (sessionsList.length === 0) {
        container.innerHTML = '<div class="settings-text" style="text-align:center; padding: 10px;">暂无活跃会话</div>';
        return;
      }
      container.innerHTML = sessionsList.map(function(s, i) {
        var actions = '';
        if (s.isCurrent) {
          actions += '<span style="font-size:0.7rem;color:#666;">当前会话</span>';
        } else {
          actions += '<button class="btn-danger" onclick="deleteSessionByIndex(' + i + ')">删除</button>';
        }
        return '<div class="session-item' + (s.isCurrent ? ' current-session' : '') + '">' +
          '<div class="session-ua">' + escapeHtml(s.ua) + '</div>' +
          '<div class="session-actions">' + actions + '</div>' +
        '</div>';
      }).join('');
    }

    async function deleteSessionByIndex(index) {
      var s = sessionsList[index];
      if (!s || s.isCurrent) return;
      if (!confirm('确认删除该会话？删除后需要重新登录。')) return;
      await fetch('/api/session-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'DELETE', ua: s.ua }),
        headers: { 'Content-Type': 'application/json' }
      });
      loadSessions();
    }

    async function deleteAllSessions() {
      if (!confirm('确认删除全部会话？删除后需要重新登录。')) return;
      await fetch('/api/session-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'DELETE_ALL' }),
        headers: { 'Content-Type': 'application/json' }
      });
      location.reload();
    }
    
    let tempAppScale = 1.0;

    function applyAppScale(scale) {
      document.documentElement.style.setProperty('--app-scale', scale);
    }

    function onScaleSliderChange(val) {
      tempAppScale = parseFloat(val);
      document.getElementById('scale-value-display').innerText = Math.round(tempAppScale * 100) + '%';
      var preview = document.getElementById('scale-preview');
      if (preview) preview.style.zoom = tempAppScale;
      updateScalePresetButtons();
    }

    function setScalePreset(val) {
      tempAppScale = val;
      document.getElementById('scale-slider').value = val;
      document.getElementById('scale-value-display').innerText = Math.round(val * 100) + '%';
      var preview = document.getElementById('scale-preview');
      if (preview) preview.style.zoom = tempAppScale;
      updateScalePresetButtons();
    }

    function updateScalePresetButtons() {
      var btns = document.querySelectorAll('.scale-preset-btn');
      var presets = [0.85, 1.0, 1.15];
      btns.forEach(function(btn, i) {
        if (Math.abs(tempAppScale - presets[i]) < 0.02) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    function createTodoElement(todo, index) {
      var el = document.createElement('div');
      el.className = 'todo-item ' + (todo.done ? 'done' : '');

      var badges = '';
      if (todo.priority === 'high') badges += '<span class="badge badge-high">高</span> ';
      if (todo.priority === 'med')  badges += '<span class="badge badge-med">中</span> ';
      if (todo.time) badges += '<span class="badge badge-time">' + todo.time + '</span> ';

      if (todo.repeat_type && todo.repeat_type !== 'none') {
        var repeatLabel = '';
        if (todo.repeat_type === 'daily') {
          repeatLabel = '每天';
        } else if (todo.repeat_type === 'weekly') {
          var days = ['日','一','二','三','四','五','六'];
          var parts = todo.date.split('-');
          var day = new Date(parts[0], parts[1]-1, parts[2]).getDay();
          repeatLabel = '每周' + days[day];
        } else if (todo.repeat_type === 'monthly') {
          var parts2 = todo.date.split('-');
          repeatLabel = '每月' + parseInt(parts2[2], 10) + '号';
        } else if (todo.repeat_type === 'yearly') {
          var parts3 = todo.date.split('-');
          repeatLabel = '每年' + parseInt(parts3[1], 10) + '月' + parseInt(parts3[2], 10) + '日';
        }
        badges += '<span class="badge" style="background:transparent;border:1px solid var(--fg);color:var(--fg);">' + repeatLabel + '</span> ';
      }

      if (todo.subtasks && todo.subtasks.length > 0) {
        var completed = todo.subtasks.filter(function(st){ return st.done; }).length;
        badges += '<span class="badge" style="background:transparent;border:1px solid var(--fg);color:var(--fg);">' + completed + '/' + todo.subtasks.length + '</span> ';
      }

      var meta = document.createElement('div');
      meta.className = 'item-meta';
      meta.innerHTML = '<div class="item-title">' + todo.text + '</div><div class="item-info">' + badges + '</div>';

      var checkbox = document.createElement('div');
      checkbox.className = 'checkbox' + (isBatchMode && selectedTasks.has(index) ? ' batch-selected' : '');
      checkbox.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isBatchMode) toggleBatchSelect(index);
        else toggleDone(index);
      });

      el.appendChild(checkbox);
      el.appendChild(meta);

      if (!isBatchMode) {
        if (todo.url) {
          var linkBtn = document.createElement('a');
          linkBtn.href = todo.url;
          linkBtn.target = '_blank';
          linkBtn.className = 'btn-link';
          linkBtn.innerText = '↗';
          linkBtn.addEventListener('click', function(e){ e.stopPropagation(); });
          el.appendChild(linkBtn);
        }
        if (todo.copy_text) {
          var copyBtn = document.createElement('button');
          copyBtn.className = 'btn-link';
          copyBtn.innerText = '⎘';
          var textToCopy = todo.copy_text;
          copyBtn.addEventListener('click', function(e){
            e.stopPropagation();
            copyText(textToCopy);
          });
          el.appendChild(copyBtn);
        }
      }

      el.addEventListener('click', function() {
        if (isBatchMode) toggleBatchSelect(index);
        else openDetail(index);
      });

      return el;
    }
    
    function hideAndRescuePopovers() {
      document.querySelectorAll('.popover-menu').forEach(p => {
        p.style.display = 'none';
        document.body.appendChild(p);
      });
    }
    
    async function toggleCustomCodeEnabled() {
        customCodeEnabled = !customCodeEnabled;
        document.getElementById('custom-code-enabled-box').classList.toggle('checked', customCodeEnabled);
        updateCustomCodeUI();
        
        const headerEl = document.getElementById('custom-header-preview');
        const contentEl = document.getElementById('custom-content-preview');
        
        if (customCodeEnabled) {
            if (!window.__CUSTOM_HEADER__ && !window.__CUSTOM_CONTENT__) {
                try {
                    const res = await fetch('/api/custom-code');
                    if (res.ok) {
                        const data = await res.json();
                        if (headerEl) headerEl.value = data.customHeader || '';
                        if (contentEl) contentEl.value = data.customContent || '';
                        window.__CUSTOM_HEADER__ = data.customHeader || '';
                        window.__CUSTOM_CONTENT__ = data.customContent || '';
                    }
                } catch(e) {
                    if (headerEl) headerEl.value = '';
                    if (contentEl) contentEl.value = '';
                }
            } else {
                if (headerEl) headerEl.value = window.__CUSTOM_HEADER__ || '';
                if (contentEl) contentEl.value = window.__CUSTOM_CONTENT__ || '';
            }
        } else {
            if (headerEl) headerEl.value = '';
            if (contentEl) contentEl.value = '';
        }
    }
    
    function updateCustomCodeUI() {
        var headerEl = document.getElementById('custom-header-preview');
        var contentEl = document.getElementById('custom-content-preview');
        var actionRow = document.getElementById('custom-action-row');
        if (headerEl) headerEl.disabled = !customCodeEnabled;
        if (contentEl) contentEl.disabled = !customCodeEnabled;
        if (actionRow) actionRow.style.display = customCodeEnabled ? 'flex' : 'none';
    }
    
    let chartInstanceBar = null;
    let chartInstancePri = null;
    let chartInstanceStat = null;
    let currentStatsTab = 'weekly';
    let annualYear = null;

    async function initSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const saved = await res.json();
          var currentUA = navigator.userAgent || '';
          var scaleByBrowser = Array.isArray(saved.scaleByBrowser) ? saved.scaleByBrowser : [];
          var matchedScale = 1.0;
          for (var i = 0; i < scaleByBrowser.length; i++) {
            if (scaleByBrowser[i].ua === currentUA) {
              matchedScale = parseFloat(scaleByBrowser[i].scale) || 1.0;
              break;
            }
          }
          appSettings = {
            provider: saved.provider || 'auto',
            sortMethod: saved.sortMethod || 'time',
            sortAsc: saved.sortAsc !== undefined ? (saved.sortAsc === 'true' || saved.sortAsc === true) : true,
            customCodeEnabled: saved.customCodeEnabled !== undefined ? (saved.customCodeEnabled === 'true' || saved.customCodeEnabled === true) : false,
            scaleByBrowser: scaleByBrowser
          };
          tempAppScale = matchedScale;
        } else {
          throw new Error('Failed to load DB settings');
        }
      } catch (e) {
        appSettings = { provider: 'auto', sortMethod: 'time', sortAsc: true, customCodeEnabled: false, scaleByBrowser: [] };
        tempAppScale = 1.0;
      }
      
      sortMethod = appSettings.sortMethod;
      sortAsc = appSettings.sortAsc;
      tempSearchProvider = appSettings.provider;

      const label = sortMethod === 'time' ? '时间' : '优先级';
      const orderLabel = sortAsc ? '正序 ▲' : '倒序 ▼';
      const btnSortTrigger = document.getElementById('btn-sort-trigger');
      const btnSortOrder = document.getElementById('btn-sort-order');
      if(btnSortTrigger) btnSortTrigger.innerText = '排序: ' + label + ' ▼';
      if(btnSortOrder) btnSortOrder.innerText = '顺序: ' + orderLabel;
      applyAppScale(tempAppScale);
    }

    async function login() {
      const pwd = document.getElementById('password-input').value;
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          body: JSON.stringify({ password: pwd }),
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) { location.reload(); } 
        else if (res.status === 429) { alert("连续尝试错误次数过多，IP已被锁定，请 15 分钟后再试！"); } 
        else { alert("密钥验证失败 / 访问被拒绝"); }
      } catch (e) { alert("网络连接失败"); }
    }

    function copyText(text) {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(err => fallbackCopyTextToClipboard(text));
      } else { fallbackCopyTextToClipboard(text); }
    }

    function fallbackCopyTextToClipboard(text) {
      var textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0"; textArea.style.left = "0";
      textArea.style.position = "fixed"; textArea.readOnly = true;
      document.body.appendChild(textArea);
      textArea.focus(); textArea.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(textArea);
    }

    function formatDate(date) { 
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + d;
    }
    
    function updateDateHeader(isLoading = false) {
      const str = formatDate(currentDate);
      const todayStr = formatDate(new Date());
      let prefix = "";
      if (str === todayStr) {
        prefix = "今日事项";
      } else if (str < todayStr) {
        prefix = "历史归档";
      } else {
        prefix = "未来计划";
      }
      
      let subText = "";
      if (isLoading) {
        subText = \`[ \${prefix} | 拉取中... ]\`;
      } else {
        const total = todos.length;
        const done = todos.filter(t => t.done).length;
        subText = \`[ \${prefix} | 进度: \${done}/\${total} ]\`;
      }

      document.getElementById('date-main').innerText = str;
      document.getElementById('date-sub').innerText = subText;
    }

    async function loadTodos() {
      const dateStr = formatDate(currentDate);
      updateDateHeader(true);
      document.getElementById('todo-list').innerHTML = '<div style="padding:20px;text-align:center;">数据拉取中...</div>';
      try {
        const res = await fetch(\`/api/todos?date=\${dateStr}\`);
        if (res.ok) {
          todos = await res.json();
          renderTodos();
        }
      } catch (e) { console.error(e); }
    }

    function toggleFilterMenu(triggerEl) {
      if(isBatchMode) return;
      const popover = document.getElementById('popover-filter');
      triggerEl.parentNode.style.position = 'relative';
      triggerEl.parentNode.appendChild(popover);
      popover.style.display = 'flex';
      popover.style.top = (triggerEl.offsetTop + triggerEl.offsetHeight + 5) + 'px'; 
      popover.style.left = triggerEl.offsetLeft + 'px';
      const closeHandler = (e) => {
        if(!popover.contains(e.target) && e.target !== triggerEl) {
          popover.style.display = 'none'; document.removeEventListener('click', closeHandler);
        }
      };
      setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    function setFilterMethod(method) {
      filterMethod = method;
      const labelMap = { 'all': '全部', 'todo': '未完成', 'done': '已完成' };
      document.getElementById('btn-filter-trigger').innerText = '筛选: ' + labelMap[method] + ' ▼';
      document.getElementById('popover-filter').style.display = 'none';
      renderTodos();
    }

    function toggleSortMenu(triggerEl) {
      if(isBatchMode) return;
      const popover = document.getElementById('popover-sort');
      triggerEl.parentNode.style.position = 'relative';
      triggerEl.parentNode.appendChild(popover);
      popover.style.display = 'flex';
      popover.style.top = (triggerEl.offsetTop + triggerEl.offsetHeight + 5) + 'px'; 
      popover.style.left = triggerEl.offsetLeft + 'px';
      const closeHandler = (e) => {
        if(!popover.contains(e.target) && e.target !== triggerEl) {
          popover.style.display = 'none'; document.removeEventListener('click', closeHandler);
        }
      };
      setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    function setSortMethod(method) {
      sortMethod = method;
      if (method === 'priority') sortAsc = false; else sortAsc = true;  
      const label = method === 'time' ? '时间' : '优先级';
      document.getElementById('btn-sort-trigger').innerText = '排序: ' + label + ' ▼';
      const orderLabel = sortAsc ? '正序 ▲' : '倒序 ▼';
      document.getElementById('btn-sort-order').innerText = '顺序: ' + orderLabel;
      document.getElementById('popover-sort').style.display = 'none';
      renderTodos();
    }

    function toggleSortOrder() {
      if(isBatchMode) return;
      sortAsc = !sortAsc;
      const label = sortAsc ? '正序 ▲' : '倒序 ▼';
      document.getElementById('btn-sort-order').innerText = \`顺序: \${label}\`;
      renderTodos();
    }

    function renderTodos() {
      updateDateHeader(false);

      var filteredTodos = todos;
      if (filterMethod === 'todo') filteredTodos = todos.filter(function(t){ return !t.done; });
      else if (filterMethod === 'done') filteredTodos = todos.filter(function(t){ return t.done; });

      var listEl = document.getElementById('todo-list');

      if (filteredTodos.length === 0) {
        listEl.innerHTML = '<div style="padding:40px;text-align:center;border:1px dashed #666;">无数据 // NULL</div>';
        return;
      }

      filteredTodos.sort(function(a, b) {
        if (a.done !== b.done) return a.done ? 1 : -1;
        var valA, valB;
        if (sortMethod === 'time') { valA = a.time || '24:00'; valB = b.time || '24:00'; }
        else { var pMap = { high: 3, med: 2, low: 1 }; valA = pMap[a.priority] || 1; valB = pMap[b.priority] || 1; }
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });

      var frag = document.createDocumentFragment();
      for (var i = 0; i < filteredTodos.length; i++) {
        var todo = filteredTodos[i];
        var idx = todos.indexOf(todo);
        frag.appendChild(createTodoElement(todo, idx));
      }
      listEl.innerHTML = '';
      listEl.appendChild(frag);
    }

    async function toggleDone(index) {
      todos[index].done = !todos[index].done;
      await fetch('/api/todo-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'TOGGLE_DONE', task: { id: todos[index].id, done: todos[index].done } }),
        headers: { 'Content-Type': 'application/json' }
      });
      renderTodos(); 
    }

    async function toggleSubtask(taskIndex, subIndex) {
      const task = todos[taskIndex];
      task.subtasks[subIndex].done = !task.subtasks[subIndex].done;
      renderDetailContent(); 
      await fetch('/api/todo-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'UPDATE_SUBTASKS', task: { id: task.id, subtasks: task.subtasks } }),
        headers: { 'Content-Type': 'application/json' }
      });
      renderTodos();
    }

    function toggleBatchMode() {
      if (isBatchMode) {
        exitBatchMode();
      } else {
        isBatchMode = true;
        selectedTasks.clear();
        const bar = document.getElementById('batch-bar');
        bar.classList.remove('hidden', 'closing');
        document.querySelector('.fab').classList.add('hidden');
        document.getElementById('btn-batch-mode').classList.add('active');
        renderTodos();
      }
    }

    function exitBatchMode() {
      if (!isBatchMode) return;
      isBatchMode = false; selectedTasks.clear();
      const bar = document.getElementById('batch-bar');
      bar.classList.add('closing');
      bar.addEventListener('animationend', function handler() {
        bar.classList.add('hidden');
        bar.classList.remove('closing');
        bar.removeEventListener('animationend', handler);
      });
      document.querySelector('.fab').classList.remove('hidden');
      document.getElementById('btn-batch-mode').classList.remove('active');
      renderTodos();
    }

    function toggleBatchSelect(index) {
      if (selectedTasks.has(index)) selectedTasks.delete(index);
      else selectedTasks.add(index);
      renderTodos();
    }

    function batchSelectAll() {
      let filteredTodos = todos;
      if (filterMethod === 'todo') filteredTodos = todos.filter(t => !t.done);
      else if (filterMethod === 'done') filteredTodos = todos.filter(t => t.done);

      const visibleIndices = filteredTodos.map(t => todos.indexOf(t));
      const allSelected = visibleIndices.length > 0 && visibleIndices.every(idx => selectedTasks.has(idx));

      if (allSelected) {
        visibleIndices.forEach(idx => selectedTasks.delete(idx));
      } else {
        visibleIndices.forEach(idx => selectedTasks.add(idx));
      }
      renderTodos();
    }

    async function batchToggleDone() {
      if (selectedTasks.size === 0) return;
      const allDone = Array.from(selectedTasks).every(idx => todos[idx].done);
      const targetDone = !allDone;
      const ids = Array.from(selectedTasks).map(idx => todos[idx].id);

      Array.from(selectedTasks).forEach(idx => todos[idx].done = targetDone);
      renderTodos();

      await fetch('/api/todo-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'BATCH_TOGGLE_DONE', ids: ids, doneStatus: targetDone }),
        headers: { 'Content-Type': 'application/json' }
      });
      exitBatchMode();
    }

    async function batchDelete() {
      if (selectedTasks.size === 0) return;
      if (!confirm(\`确认删除选中的 \${selectedTasks.size} 个事项吗？(仅删除当天的当前项)\`)) return;
      const ids = Array.from(selectedTasks).map(idx => todos[idx].id);
      await fetch('/api/todo-action', {
        method: 'POST', body: JSON.stringify({ action: 'BATCH_DELETE', ids: ids }),
        headers: { 'Content-Type': 'application/json' }
      });
      exitBatchMode(); loadTodos();
    }

    function openSettings() {
      tempSetProvider = appSettings.provider || 'auto';
      tempSetSort = appSettings.sortMethod || 'time';
      tempSetSortAsc = appSettings.sortAsc !== undefined ? appSettings.sortAsc : true;
      
      customCodeEnabled = appSettings.customCodeEnabled === true;
      
      var currentUA = navigator.userAgent || '';
      var currentScale = 1.0;
      if (Array.isArray(appSettings.scaleByBrowser)) {
        for (var i = 0; i < appSettings.scaleByBrowser.length; i++) {
          if (appSettings.scaleByBrowser[i].ua === currentUA) {
            currentScale = parseFloat(appSettings.scaleByBrowser[i].scale) || 1.0;
            break;
          }
        }
      }
      tempAppScale = currentScale;
      
      var scaleSlider = document.getElementById('scale-slider');
      var scaleDisplay = document.getElementById('scale-value-display');
      var scalePreview = document.getElementById('scale-preview');
      if (scaleSlider) scaleSlider.value = tempAppScale;
      if (scaleDisplay) scaleDisplay.innerText = Math.round(tempAppScale * 100) + '%';
      if (scalePreview) scalePreview.style.zoom = tempAppScale;
      updateScalePresetButtons();
      
      document.getElementById('custom-code-enabled-box').classList.toggle('checked', customCodeEnabled);
      updateCustomCodeUI();
    
      const pMap = {'auto':'自动 (随机源)', 'bilibili':'哔哩哔哩', 'weibo':'微博热搜', 'zhihu':'知乎热榜', 'baidu':'百度热搜'};
      const sMap = {'time':'按时间', 'priority':'按优先级'};
      
      document.getElementById('set-disp-provider').innerText = pMap[tempSetProvider];
      document.getElementById('set-disp-sort').innerText = sMap[tempSetSort];
      document.getElementById('set-disp-sort-asc').innerText = tempSetSortAsc ? '正序' : '倒序';
    
      const headerEl = document.getElementById('custom-header-preview');
      const contentEl = document.getElementById('custom-content-preview');
      var _ph = localStorage.getItem('preview_custom_header');
      var _pc = localStorage.getItem('preview_custom_content');
      var _hasPreview = _ph !== null || _pc !== null;
      
      if (_hasPreview) {
        if (headerEl) headerEl.value = _ph !== null ? _ph : '';
        if (contentEl) contentEl.value = _pc !== null ? _pc : '';
      } else if (customCodeEnabled) {
        if (headerEl) headerEl.value = window.__CUSTOM_HEADER__ || '';
        if (contentEl) contentEl.value = window.__CUSTOM_CONTENT__ || '';
      } else {
        if (headerEl) headerEl.value = '';
        if (contentEl) contentEl.value = '';
      }
      
      var _rcBtn = document.getElementById('restore-custom-btn');
      if (_rcBtn) _rcBtn.style.display = _hasPreview ? '' : 'none';
    
      const view = document.getElementById('settings-overlay');
      view.classList.remove('closing');
      view.classList.add('active');
      loadSessions();
      checkUpdate();
    }

    function closeSettings() {
      const view = document.getElementById('settings-overlay');
      view.classList.add('closing');
      view.addEventListener('animationend', function handler() {
        view.classList.remove('active'); 
        view.classList.remove('closing'); 
        view.removeEventListener('animationend', handler);
      });
    }

    function toggleSettingPopover(type, triggerEl) {
      const popover = document.getElementById(\`popover-set-\${type}\`);
      triggerEl.parentNode.style.position = 'relative';
      triggerEl.parentNode.appendChild(popover);
      popover.style.display = 'flex';
      popover.style.top = (triggerEl.offsetTop + triggerEl.offsetHeight + 5) + 'px';
      popover.style.left = triggerEl.offsetLeft + 'px';
      popover.style.right = 'auto';

      const closeHandler = (e) => {
        if(!popover.contains(e.target) && e.target !== triggerEl && !triggerEl.contains(e.target)) {
          popover.style.display = 'none';
          document.removeEventListener('click', closeHandler);
        }
      };
      setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    function selectSetting(type, value, label) {
      if (type === 'provider') { tempSetProvider = value; document.getElementById('set-disp-provider').innerText = label; }
      else if (type === 'sort') { tempSetSort = value; document.getElementById('set-disp-sort').innerText = label; }
      else if (type === 'sortAsc') { tempSetSortAsc = value === 'true'; document.getElementById('set-disp-sort-asc').innerText = label; }
      document.getElementById(\`popover-set-\${type}\`).style.display = 'none';
    }

    async function saveAndCloseSettings() {
      appSettings.provider = tempSetProvider;
      appSettings.sortMethod = tempSetSort;
      appSettings.sortAsc = tempSetSortAsc;
      appSettings.customCodeEnabled = customCodeEnabled;

      var currentUA = navigator.userAgent || '';
      if (Array.isArray(appSettings.scaleByBrowser)) {
        for (var i = 0; i < appSettings.scaleByBrowser.length; i++) {
          if (appSettings.scaleByBrowser[i].ua === currentUA) {
            appSettings.scaleByBrowser[i].scale = tempAppScale;
            break;
          }
        }
      }
    
      await fetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(appSettings),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (customCodeEnabled) {
        var customHeaderVal = document.getElementById('custom-header-preview') ? document.getElementById('custom-header-preview').value : '';
        var customContentVal = document.getElementById('custom-content-preview') ? document.getElementById('custom-content-preview').value : '';
        await fetch('/api/custom-code', {
          method: 'POST',
          body: JSON.stringify({ customHeader: customHeaderVal, customContent: customContentVal }),
          headers: { 'Content-Type': 'application/json' }
        });
      }
    
      sortMethod = appSettings.sortMethod;
      sortAsc = appSettings.sortAsc;
      tempSearchProvider = appSettings.provider;
    
      const label = sortMethod === 'time' ? '时间' : '优先级';
      const orderLabel = sortAsc ? '正序 ▲' : '倒序 ▼';
      document.getElementById('btn-sort-trigger').innerText = '排序: ' + label + ' ▼';
      document.getElementById('btn-sort-order').innerText = '顺序: ' + orderLabel;
      
      renderTodos();
      restoreAllPreview()
      location.reload();
    }
    
    function previewCustomCode() {
      var headerContent = document.getElementById('custom-header-preview').value;
      var contentContent = document.getElementById('custom-content-preview').value;
      localStorage.setItem('preview_custom_header', headerContent);
      localStorage.setItem('preview_custom_content', contentContent);
      window.location.href = window.location.pathname + '?preview=1';
    }
    
    async function resetCustomCode() {
      if (!confirm('确定要重置自定义代码吗？\\n这将清空所有自定义头部和内容。')) return;
      
      window.__CUSTOM_HEADER__ = '';
      window.__CUSTOM_CONTENT__ = '';
      customCodeEnabled = false;
      appSettings.customCodeEnabled = false;
      
      try {
        await fetch('/api/custom-code', {
          method: 'POST',
          body: JSON.stringify({ customHeader: '', customContent: '' }),
          headers: { 'Content-Type': 'application/json' }
        });
        
        await fetch('/api/settings', {
          method: 'POST',
          body: JSON.stringify(appSettings),
          headers: { 'Content-Type': 'application/json' }
        });
      } catch(e) { 
        console.error('Reset custom code error:', e); 
      }
      
      restoreAllPreview()
      location.reload();
    }
    
    function restoreAllPreview() {
      localStorage.removeItem('preview_custom_header');
      localStorage.removeItem('preview_custom_content');
      window.location.href = window.location.pathname;
    }

    async function exportData() {
      var incTodos = document.getElementById('export-todos').checked;
      var incTrash = document.getElementById('export-trash').checked;
      var incSettings = document.getElementById('export-settings').checked;

      if (!incTodos && !incTrash && !incSettings) return alert('请至少选择一项需要导出的内容。');

      var overlay = document.createElement('div');
      overlay.className = 'io-overlay';
      var box = document.createElement('div');
      box.className = 'io-dialog';
      var titleEl = document.createElement('div');
      titleEl.className = 'io-title';
      var subEl = document.createElement('div');
      subEl.className = 'io-sub';
      var barBg = document.createElement('div');
      barBg.className = 'io-bar-bg';
      var barFill = document.createElement('div');
      barFill.className = 'io-bar-fill';
      barBg.appendChild(barFill); box.appendChild(titleEl); box.appendChild(subEl); box.appendChild(barBg);
      overlay.appendChild(box); document.body.appendChild(overlay);

      var spinChars = ['\\u25D3','\\u25D1','\\u25D2'];
      var spinIdx = 0; var curTitle = '';
      var spinTimer = setInterval(function() { spinIdx = (spinIdx+1)%3; titleEl.textContent = spinChars[spinIdx]+' '+curTitle; }, 100);
      function showProgress(t,s,p) { curTitle=t; subEl.textContent=s||''; if(p!==undefined) barFill.style.width=p+'%'; }
      function closeProgress() { clearInterval(spinTimer); if(overlay.parentNode) overlay.parentNode.removeChild(overlay); }
      function showAlert(msg) {
        return new Promise(function(resolve) {
          var ao=document.createElement('div'); ao.className='io-overlay';
          var ab=document.createElement('div'); ab.className='io-dialog';
          var am=document.createElement('div'); am.className='io-msg'; am.textContent=msg;
          var bo=document.createElement('button'); bo.className='io-btn io-btn-primary'; bo.textContent='确定';
          ab.appendChild(am); ab.appendChild(bo); ao.appendChild(ab); document.body.appendChild(ao);
          bo.onclick=function(){ if(ao.parentNode) ao.parentNode.removeChild(ao); resolve(); };
        });
      }
      function showConfirm(title, msg, btnYesLabel, btnNoLabel) {
        return new Promise(function(resolve) {
          var co=document.createElement('div'); co.className='io-overlay';
          var cb=document.createElement('div'); cb.className='io-dialog';
          var ct=document.createElement('div'); ct.className='io-title'; ct.textContent=title;
          var cm=document.createElement('div'); cm.className='io-sub'; cm.textContent=msg;
          var br=document.createElement('div'); br.className='io-btn-row';
          var by=document.createElement('button'); by.className='io-btn io-btn-primary'; by.textContent=btnYesLabel||'确定';
          var bn=document.createElement('button'); bn.className='io-btn io-btn-secondary'; bn.textContent=btnNoLabel||'取消';
          br.appendChild(bn); br.appendChild(by); cb.appendChild(ct); cb.appendChild(cm); cb.appendChild(br); co.appendChild(cb); document.body.appendChild(co);
          by.onclick=function(){ if(co.parentNode) co.parentNode.removeChild(co); resolve(true); };
          bn.onclick=function(){ if(co.parentNode) co.parentNode.removeChild(co); resolve(false); };
        });
      }

      var sessionId = crypto.randomUUID();
      var totalTodos = 0;
      var totalTemplates = 0;
      var todosReceived = 0;
      var templatesReceived = 0;

      try {
        showProgress('初始化导出会话', '创建会话...', 3);
        var sessionRes = await fetch('/api/export?mode=session&action=create&todos=' + incTodos + '&trash=' + incTrash + '&settings=' + incSettings + '&sessionId=' + sessionId);
        if (!sessionRes.ok) {
          if (sessionRes.status === 409) {
            var conflictData = {};
            try { conflictData = await sessionRes.json(); } catch(ee) {}
            var doAbortExport = await showConfirm("导出会话冲突", '检测到未完成的导出会话 (' + (conflictData.sessionId || '') + ')。\\n可能是上次导出异常中断导致。\\n点击「确定」中止旧会话并重新导出。', "确定", "取消");
            if (doAbortExport) {
              if (conflictData.sessionId) {
                await fetch('/api/export?mode=session&action=abort&sessionId=' + conflictData.sessionId);
              }
              sessionRes = await fetch('/api/export?mode=session&action=create&todos=' + incTodos + '&trash=' + incTrash + '&settings=' + incSettings + '&sessionId=' + sessionId);
              if (!sessionRes.ok) throw new Error('重试创建导出会话失败');
            } else {
              closeProgress();
              return;
            }
          } else {
            throw new Error('创建导出会话失败');
          }
        }
        var sessionData = await sessionRes.json();
        totalTodos = sessionData.totalTodos;
        totalTemplates = sessionData.totalTemplates;
        var totalItems = totalTodos + totalTemplates;

        if (totalItems === 0 && !incSettings) { closeProgress(); await showAlert('没有可导出的数据。'); return; }
        showProgress('准备流式导出', '共 ' + totalItems + ' 条记录，开始下载...', 8);

        var useFileSystemAPI = false;
        var writableStream = null;
        var fileHandle = null;
        var fileName = 'todo_export_' + formatDate(new Date()) + '.json';

        if (window.showSaveFilePicker) {
          try {
            fileHandle = await window.showSaveFilePicker({
              suggestedName: fileName,
              types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
            });
            writableStream = await fileHandle.createWritable();
            useFileSystemAPI = true;
          } catch (pickErr) {
            if (pickErr.name === 'AbortError') { closeProgress(); return; }
            useFileSystemAPI = false;
          }
        }

        var chunks = [];
        var streamUrl = '/api/export?mode=stream&todos=' + incTodos + '&trash=' + incTrash + '&settings=' + incSettings + '&sessionId=' + sessionId;
        var res = await fetch(streamUrl);
        if (!res.ok) throw new Error('流式导出请求失败');

        var totalFromHeader = parseInt(res.headers.get('X-Export-Total-Todos') || '0', 10) + parseInt(res.headers.get('X-Export-Total-Templates') || '0', 10);
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var jsonBuffer = '';
        var estimatedBytes = 0;

        while (true) {
          var _ref = await reader.read();
          var done = _ref.done;
          var value = _ref.value;
          if (done) break;

          if (useFileSystemAPI) {
            await writableStream.write(value);
          } else {
            chunks.push(value);
          }

          var textChunk = decoder.decode(value, { stream: true });
          jsonBuffer += textChunk;
          estimatedBytes += value.byteLength;

          var todoMatches = jsonBuffer.match(/"id"\\s*:/g);
          if (todoMatches) {
            var currentReceived = todoMatches.length;
            if (currentReceived > todosReceived + templatesReceived) {
              var diff = currentReceived - todosReceived - templatesReceived;
              if (todosReceived < totalTodos) {
                todosReceived = Math.min(todosReceived + diff, totalTodos);
              } else {
                templatesReceived += diff;
              }
            }
          }

          var processedItems = todosReceived + templatesReceived;
          var pct = 8 + Math.round((processedItems / Math.max(totalFromHeader, 1)) * 87);
          if (todosReceived < totalTodos) {
            showProgress('流式导出事项', todosReceived + ' / ' + totalTodos + ' 条', pct);
          } else if (templatesReceived < totalTemplates) {
            showProgress('流式导出模板', templatesReceived + ' / ' + totalTemplates + ' 条', pct);
          } else {
            showProgress('流式导出', '已传输 ' + (estimatedBytes / 1024 / 1024).toFixed(1) + ' MB', pct);
          }

          if (jsonBuffer.length > 5 * 1024 * 1024) {
            jsonBuffer = jsonBuffer.slice(-1024 * 512);
          }
        }

        if (useFileSystemAPI) {
          await writableStream.close();
        } else {
          showProgress('生成文件', '组装下载文件...', 96);
          var blob = new Blob(chunks, { type: 'application/json' });
          var blobUrl = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 30000);
          chunks = null;
        }

        try {
          await fetch('/api/export?mode=session&action=done&sessionId=' + sessionId);
        } catch(e) {}

        showProgress('导出完成', (totalTodos || todosReceived) + ' 条事项 ，其中 ' + (totalTemplates || templatesReceived) + ' 条模板', 100);
        setTimeout(closeProgress, 4000);
      } catch (e) {
        try {
          await fetch('/api/export?mode=session&action=abort&sessionId=' + sessionId);
        } catch(ee) {}
        closeProgress();
        await showAlert('导出失败：' + e.message);
      }
    }

    function importData(event) {
      var file = event.target.files[0];
      if (!file) return;

      var UPLOAD_CHUNK_SIZE = 100;
      var importId = crypto.randomUUID();

      var overlay = document.createElement('div');
      overlay.className = 'io-overlay';
      var box = document.createElement('div');
      box.className = 'io-dialog';
      var titleEl = document.createElement('div');
      titleEl.className = 'io-title';
      var subEl = document.createElement('div');
      subEl.className = 'io-sub';
      var barBg = document.createElement('div');
      barBg.className = 'io-bar-bg';
      var barFill = document.createElement('div');
      barFill.className = 'io-bar-fill';
      barBg.appendChild(barFill); box.appendChild(titleEl); box.appendChild(subEl); box.appendChild(barBg);
      overlay.appendChild(box); document.body.appendChild(overlay);

      var spinChars = ['\\u25D3','\\u25D1','\\u25D2'];
      var spinIdx = 0; var curTitle = '';
      var spinTimer = setInterval(function() { spinIdx = (spinIdx+1)%3; titleEl.textContent = spinChars[spinIdx]+' '+curTitle; }, 100);
      function showProgress(t,s,p) { curTitle=t; subEl.textContent=s||''; if(p!==undefined) barFill.style.width=p+'%'; }
      function closeProgress() { clearInterval(spinTimer); if(overlay.parentNode) overlay.parentNode.removeChild(overlay); }
      function showConfirm(title, msg, btnYesLabel, btnNoLabel) {
        return new Promise(function(resolve) {
          var co=document.createElement('div'); co.className='io-overlay io-overlay-high';
          var cb=document.createElement('div'); cb.className='io-dialog';
          var ct=document.createElement('div'); ct.className='io-title'; ct.textContent=title;
          var cm=document.createElement('div'); cm.className='io-sub io-sub-block'; cm.textContent=msg;
          var br=document.createElement('div'); br.className='io-btn-row';
          var by=document.createElement('button'); by.className='io-btn io-btn-primary'; by.textContent=btnYesLabel||'确定';
          var bn=document.createElement('button'); bn.className='io-btn io-btn-secondary'; bn.textContent=btnNoLabel||'取消';
          br.appendChild(bn); br.appendChild(by); cb.appendChild(ct); cb.appendChild(cm); cb.appendChild(br); co.appendChild(cb); document.body.appendChild(co);
          by.onclick=function(){ if(co.parentNode) co.parentNode.removeChild(co); resolve(true); };
          bn.onclick=function(){ if(co.parentNode) co.parentNode.removeChild(co); resolve(false); };
        });
      }
      function showAlert(msg) {
        return new Promise(function(resolve) {
          var ao=document.createElement('div'); ao.className='io-overlay io-overlay-high';
          var ab=document.createElement('div'); ab.className='io-dialog';
          var am=document.createElement('div'); am.className='io-msg'; am.textContent=msg;
          var bo=document.createElement('button'); bo.className='io-btn io-btn-primary'; bo.textContent='确定';
          ab.appendChild(am); ab.appendChild(bo); ao.appendChild(ab); document.body.appendChild(ao);
          bo.onclick=function(){ if(ao.parentNode) ao.parentNode.removeChild(ao); resolve(); };
        });
      }

      (async function() {
        var fileSize = file.size;
        var bytesRead = 0;
        var chunks = [];
        var useStream = typeof file.stream === 'function';

        try {
          showProgress('准备数据', '正在读取文件...', 3);

          if (useStream) {
            var streamReader = file.stream().getReader();
            var decoder = new TextDecoder();
            while (true) {
              var _ref = await streamReader.read();
              if (_ref.done) break;
              chunks.push(decoder.decode(_ref.value, { stream: true }));
              bytesRead += _ref.value.byteLength;
              var readPct = 3 + Math.round((bytesRead / Math.max(fileSize, 1)) * 12);
              showProgress('读取文件', (bytesRead / 1024 / 1024).toFixed(1) + ' MB / ' + (fileSize / 1024 / 1024).toFixed(1) + ' MB', readPct);
            }
          } else {
            showProgress('读取文件', '兼容模式...', 5);
            var fileReader = new FileReader();
            var fileText = await new Promise(function(resolve, reject) {
              fileReader.onload = function(e) { resolve(e.target.result); };
              fileReader.onerror = function() { reject(new Error('文件读取失败')); };
              fileReader.readAsText(file);
            });
            chunks.push(fileText);
            fileText = null;
          }

          showProgress('数据解析', '解析 JSON 中...', 16);
          await new Promise(function(r){ setTimeout(r,30); });

          var rawText = chunks.join('');
          chunks = null;

          var data = JSON.parse(rawText);
          rawText = null;

          var toImport = [];
          if (data.todos) toImport = toImport.concat(data.todos);
          if (data.trash) toImport = toImport.concat(data.trash);
          if (!data.todos && !data.trash && Array.isArray(data)) toImport = data;
          var toImportTemplates = data.todo_templates || [];

          showProgress('数据解析完成', '事项: ' + toImport.length + ' 条 | 其中模板: ' + toImportTemplates.length + ' 条', 18);

          var mode = 'merge';
          if (toImport.length > 0 || toImportTemplates.length > 0) {
            var isOverwrite = await showConfirm("是否使用【覆盖模式】？", "点击确定将清空云端的所有数据，然后完全替换为导入的新数据。\\n请确保导出数据时一定要全部勾选，否则执行时对于可能出现的问题后果自负。\\n点击取消将进入【合并模式】或取消导入操作。");
            if (isOverwrite) { mode = 'overwrite'; }
            else {
              var isMerge = await showConfirm("是否继续使用【合并模式】进行导入？", "将保留现有云端的所有数据，新增并覆盖更新 ID 相同的重叠事项。\\n请确保导出数据时一定要全部勾选，否则执行时对于可能出现的问题后果自负。\\n过程中出现异常将无法恢复。");
              if (!isMerge) { closeProgress(); event.target.value=''; return; }
            }
          } else if (!data.settings && data.custom_header === undefined && data.custom_content === undefined) {
            throw new Error("未在文件中找到有效的待办或设置数据。");
          }

          showProgress('初始化导入会话', mode === 'overwrite' ? '备份并清空云端数据...' : '创建合并会话...', 22);
          await new Promise(function(r){ setTimeout(r,30); });
          var initRes = await fetch('/api/import', {
            method: 'POST',
            body: JSON.stringify({ phase: 'init', mode: mode, importId: importId }),
            headers: { 'Content-Type': 'application/json' }
          });

          if (!initRes.ok) {
            var errData1 = {};
            try { errData1 = await initRes.json(); } catch(ee){}

            if (initRes.status === 409 && errData1.conflict && errData1.importId) {
              var conflictMsg = '检测到未完成的导入会话 (' + errData1.importId + ')\\n\\n';
              if (errData1.mode === 'overwrite') {
                conflictMsg += '该会话为覆写模式，点击「恢复」将中止旧会话并恢复原始数据。\\n';
              } else {
                conflictMsg += '点击「恢复」将清除旧会话记录。\\n';
              }
              conflictMsg += '点击「确定」中止旧会话并继续当前导入。';

              var doAbortOld = await showConfirm("会话冲突", conflictMsg, "确定", "恢复");
              if (doAbortOld) {
                var abortOldRes = await fetch('/api/import', {
                  method: 'POST',
                  body: JSON.stringify({ phase: 'abort', importId: errData1.importId }),
                  headers: { 'Content-Type': 'application/json' }
                });
                if (abortOldRes.ok) {
                  showProgress('重试初始化', mode === 'overwrite' ? '备份并清空云端数据...' : '创建合并会话...', 22);
                  await new Promise(function(r){ setTimeout(r,30); });
                  initRes = await fetch('/api/import', {
                    method: 'POST',
                    body: JSON.stringify({ phase: 'init', mode: mode, importId: importId }),
                    headers: { 'Content-Type': 'application/json' }
                  });
                  if (!initRes.ok) {
                    var errMsg1Retry = '重试初始化失败';
                    try { var ed1r = await initRes.json(); if(ed1r.error) errMsg1Retry+='：'+ed1r.error; } catch(ee){}
                    throw new Error(errMsg1Retry);
                  }
                } else {
                  throw new Error('中止旧会话失败，请刷新页面后重试');
                }
              } else {
                var restoreAbortRes = await fetch('/api/import', {
                  method: 'POST',
                  body: JSON.stringify({ phase: 'abort', importId: errData1.importId }),
                  headers: { 'Content-Type': 'application/json' }
                });
                closeProgress();
                if (restoreAbortRes.ok) {
                  var restoreAbortData = await restoreAbortRes.json();
                  if (errData1.mode === 'overwrite' && restoreAbortData.recovered) {
                    await showAlert('原始数据已成功恢复。');
                  } else if (errData1.mode === 'overwrite') {
                    await showAlert('旧会话已清除，但未检测到备份数据。');
                  } else {
                    await showAlert('旧会话已清除。');
                  }
                } else {
                  await showAlert('恢复操作失败，可手动访问 /api/import-backup?action=restore 尝试恢复。');
                }
                return;
              }
            } else {
              var errMsg1 = '初始化失败';
              if(errData1.error) errMsg1 += '：' + errData1.error;
              throw new Error(errMsg1);
            }
          }

          if (toImport.length > 0) {
            var totalTodoChunks = Math.ceil(toImport.length / UPLOAD_CHUNK_SIZE);
            for (var i = 0; i < toImport.length; i += UPLOAD_CHUNK_SIZE) {
              var chunkIdx = Math.floor(i / UPLOAD_CHUNK_SIZE);
              var chunk = toImport.slice(i, i + UPLOAD_CHUNK_SIZE);
              var pctTodo = 25 + Math.round((i / toImport.length) * 45);
              showProgress('上传待办事项', '分片 ' + (chunkIdx+1) + '/' + totalTodoChunks + ' (' + Math.min(i+UPLOAD_CHUNK_SIZE, toImport.length) + '/' + toImport.length + ')', pctTodo);
              await new Promise(function(r){ setTimeout(r,10); });
              var chunkRes = await fetch('/api/import', {
                method: 'POST',
                body: JSON.stringify({ phase: 'chunk', type: 'todos', data: chunk, importId: importId }),
                headers: { 'Content-Type': 'application/json' }
              });
              if (!chunkRes.ok) {
                var errMsg2 = '上传待办分片 '+(chunkIdx+1)+' 失败';
                try { var ed2 = await chunkRes.json(); if(ed2.error) errMsg2+='：'+ed2.error; } catch(ee){}
                if (mode === 'overwrite') {
                  try {
                    var abortRes2 = await fetch('/api/import', {
                      method: 'POST',
                      body: JSON.stringify({ phase: 'abort', importId: importId }),
                      headers: { 'Content-Type': 'application/json' }
                    });
                    if (abortRes2.ok) {
                      var abortData2 = await abortRes2.json();
                      errMsg2 += abortData2.recovered ? '\\n\\n已自动恢复原始备份数据' : '\\n\\n会话已清除，但未检测到备份数据';
                    } else {
                      errMsg2 += '\\n\\n自动恢复失败，可手动访问 /api/import-backup?action=restore 尝试恢复';
                    }
                  } catch(abortErr2) {
                    errMsg2 += '\\n\\n自动恢复请求异常：' + abortErr2.message;
                  }
                }
                throw new Error(errMsg2);
              }
            }
            toImport = null;
          }

          if (toImportTemplates.length > 0) {
            var totalTplChunks = Math.ceil(toImportTemplates.length / UPLOAD_CHUNK_SIZE);
            for (var j = 0; j < toImportTemplates.length; j += UPLOAD_CHUNK_SIZE) {
              var tplChunkIdx = Math.floor(j / UPLOAD_CHUNK_SIZE);
              var tplChunk = toImportTemplates.slice(j, j + UPLOAD_CHUNK_SIZE);
              var pctTpl = 70 + Math.round((j / toImportTemplates.length) * 15);
              showProgress('上传重复事项模板', '分片 ' + (tplChunkIdx+1) + '/' + totalTplChunks + ' (' + Math.min(j+UPLOAD_CHUNK_SIZE, toImportTemplates.length) + '/' + toImportTemplates.length + ')', pctTpl);
              await new Promise(function(r){ setTimeout(r,10); });
              var tplChunkRes = await fetch('/api/import', {
                method: 'POST',
                body: JSON.stringify({ phase: 'chunk', type: 'templates', data: tplChunk, importId: importId }),
                headers: { 'Content-Type': 'application/json' }
              });
              if (!tplChunkRes.ok) {
                var errMsg3 = '上传模板分片 '+(tplChunkIdx+1)+' 失败';
                try { var ed3 = await tplChunkRes.json(); if(ed3.error) errMsg3+='：'+ed3.error; } catch(ee){}
                if (mode === 'overwrite') {
                  try {
                    var abortRes3 = await fetch('/api/import', {
                      method: 'POST',
                      body: JSON.stringify({ phase: 'abort', importId: importId }),
                      headers: { 'Content-Type': 'application/json' }
                    });
                    if (abortRes3.ok) {
                      var abortData3 = await abortRes3.json();
                      errMsg3 += abortData3.recovered ? '\\n\\n已自动恢复原始备份数据' : '\\n\\n会话已清除，但未检测到备份数据';
                    } else {
                      errMsg3 += '\\n\\n自动恢复失败，可手动访问 /api/import-backup?action=restore 尝试恢复';
                    }
                  } catch(abortErr3) {
                    errMsg3 += '\\n\\n自动恢复请求异常：' + abortErr3.message;
                  }
                }
                throw new Error(errMsg3);
              }
            }
            toImportTemplates = null;
          }

          if (data.settings && document.getElementById('export-settings').checked) {
            showProgress('应用偏好设置', '', 88);
            await new Promise(function(r){ setTimeout(r,30); });
            await fetch('/api/settings', {
              method: 'POST',
              body: JSON.stringify(data.settings),
              headers: { 'Content-Type': 'application/json' }
            });
          }

          showProgress('收尾处理', '清理并完成导入...', 92);
          await new Promise(function(r){ setTimeout(r,30); });
          var finalBody = { phase: 'finalize', mode: mode, importId: importId };
          if (data.custom_header !== undefined && document.getElementById('export-settings').checked) finalBody.custom_header = data.custom_header;
          if (data.custom_content !== undefined && document.getElementById('export-settings').checked) finalBody.custom_content = data.custom_content;
          var finalRes = await fetch('/api/import', {
            method: 'POST',
            body: JSON.stringify(finalBody),
            headers: { 'Content-Type': 'application/json' }
          });
          if (!finalRes.ok) {
            var errMsg4 = '收尾处理失败';
            try { var ed4 = await finalRes.json(); if(ed4.error) errMsg4+='：'+ed4.error; } catch(ee){}
            throw new Error(errMsg4);
          }

          showProgress('导入完成', '界面即将重载...', 100);
          await new Promise(function(r){ setTimeout(r,1000); });
          closeProgress();
          location.reload();
        } catch (err) {
          closeProgress();
          await showAlert('导入失败：' + err.message);
        }
        event.target.value = '';
      })();
    }

    async function factoryReset() {
      if (!confirm("警告：此操作将彻底删除云端所有的待办事项、回收站记录和所有的云端偏好设置！\\n此操作不可逆，强烈建议先导出系统备份！\\n\\n是否继续？")) return;
      if (!confirm("最终确认：真的要彻底清空所有数据吗？")) return;
      
      try {
        await fetch('/api/trash-action', {
          method: 'POST', body: JSON.stringify({ action: 'CLEAR_ALL_DATA' }),
          headers: { 'Content-Type': 'application/json' }
        });
        alert("系统云端已完全清空，即将重置。");
        location.reload();
      } catch (e) {
        alert("数据清理执行失败");
      }
    }

    async function checkInterruptedImport() {
      try {
        var res = await fetch('/api/import', {
          method: 'POST',
          body: JSON.stringify({ phase: 'status' }),
          headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) return;
        var data = await res.json();
        if (!data.active) return;

        if (data.mode === 'overwrite' && data.hasBackup) {
          var doRecover = confirm(
            '检测到上次覆写导入中断，原始数据备份仍在。\\n\\n' +
            '会话 ID: ' + data.importId + '\\n' +
            '启动时间: ' + new Date(data.startedAt).toLocaleString() + '\\n\\n' +
            '点击「确定」恢复原始数据，点击「取消」放弃恢复（当前不完整数据将保留）。'
          );
          if (doRecover) {
            var abortRes = await fetch('/api/import', {
              method: 'POST',
              body: JSON.stringify({ phase: 'abort', importId: data.importId }),
              headers: { 'Content-Type': 'application/json' }
            });
            if (abortRes.ok) {
              var abortData = await abortRes.json();
              if (abortData.recovered) {
                alert('原始数据已成功恢复，页面即将重载。');
                location.reload();
              } else {
                alert('会话已清除。');
              }
            } else {
              alert('恢复操作失败，可手动访问 /api/import-backup?action=restore 尝试恢复。');
            }
          } else {
            await fetch('/api/import', {
              method: 'POST',
              body: JSON.stringify({ phase: 'abort', importId: data.importId }),
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } else {
          var doCleanup = confirm(
            '检测到上次合并导入中断（会话 ID: ' + data.importId + '）。\\n\\n' +
            '合并模式无法自动恢复，部分新数据可能已写入。\\n' +
            '点击「确定」清除该会话记录。'
          );
          if (doCleanup) {
            await fetch('/api/import', {
              method: 'POST',
              body: JSON.stringify({ phase: 'abort', importId: data.importId }),
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
      } catch(e) {
        console.error('Check interrupted import error:', e);
      }
    }
    
    async function openStats() {
      var statsView = document.getElementById('stats-overlay');
      statsView.classList.remove('closing');
      statsView.classList.add('active');
      
      currentStatsTab = 'weekly';
      updateStatsHeader();
      loadWeeklyStats();
    }

    async function loadWeeklyStats() {
      document.getElementById('stats-loading').classList.remove('hidden');
      document.getElementById('stats-content').classList.add('hidden');

      if(chartInstanceBar) chartInstanceBar.destroy();
      if(chartInstancePri) chartInstancePri.destroy();
      if(chartInstanceStat) chartInstanceStat.destroy();

      const endDt = new Date();
      const startDt = new Date();
      startDt.setDate(startDt.getDate() - 6);
      
      const endStr = formatDate(endDt);
      const startStr = formatDate(startDt);

      const datesArray = [];
      let tempDt = new Date(startDt);
      while(tempDt <= endDt) {
        datesArray.push(formatDate(tempDt));
        tempDt.setDate(tempDt.getDate() + 1);
      }

      try {
        const res = await fetch(\`/api/stats?start=\${startStr}&end=\${endStr}\`);
        if(res.ok) {
          const rawData = await res.json();
          renderStatsCharts(rawData, datesArray);
          document.getElementById('stats-loading').classList.add('hidden');
          document.getElementById('stats-content').classList.remove('hidden');
        } else {
          document.getElementById('stats-loading').innerText = '数据拉取失败。';
        }
      } catch(e) {
        document.getElementById('stats-loading').innerText = '网络请求异常。';
      }
    }

    function closeStats() {
      const statsView = document.getElementById('stats-overlay');
      statsView.classList.add('closing');
      statsView.addEventListener('animationend', function handler() {
        statsView.classList.remove('active');
        statsView.classList.remove('closing');
        statsView.removeEventListener('animationend', handler);
      });
    }
    
    function switchStatsTab() {
      if (currentStatsTab === 'weekly') {
        if (getAnnualReportYear() === null) return;
        currentStatsTab = 'annual';
        document.getElementById('stats-weekly').classList.add('hidden');
        document.getElementById('stats-annual').classList.remove('hidden');
        loadAnnualReport();
      } else {
        currentStatsTab = 'weekly';
        document.getElementById('stats-annual').classList.add('hidden');
        document.getElementById('stats-weekly').classList.remove('hidden');
      }
      updateStatsHeader();
    }
    
    // 年度报告出现时间 0=1月, 1=2月, ..., 11=12月
    function getAnnualReportYear() {
      var now = new Date();
      var month = now.getMonth();
      var day = now.getDate();
      if (month === 11 && day === 31) return now.getFullYear();
      if (month === 0 && day >= 1 && day <= 7) return now.getFullYear() - 1;
      return null;
    }

    function updateStatsHeader() {
      var titleEl = document.getElementById('stats-title-text');
      var switchBtn = document.getElementById('stats-switch-btn');
      
      if (currentStatsTab === 'weekly') {
        titleEl.innerText = '7天统计';
        if (getAnnualReportYear() !== null) {
          switchBtn.classList.remove('hidden');
          switchBtn.innerText = '年度报告';
        } else {
          switchBtn.classList.add('hidden');
        }
      } else {
        titleEl.innerText = '年度报告';
        switchBtn.classList.remove('hidden');
        switchBtn.innerText = '7天统计';
      }
    }

    async function loadAnnualReport() {
      var reportYear = getAnnualReportYear();
      if (reportYear === null) return;
      annualYear = reportYear;

      var loading = document.getElementById('annual-loading');
      var content = document.getElementById('annual-content');
      loading.classList.remove('hidden');
      content.classList.add('hidden');
      loading.innerText = '年度数据加载中...';

      var startStr = annualYear + '-01-01';
      var endStr = annualYear + '-12-31';

      try {
        var res = await fetch('/api/stats?start=' + startStr + '&end=' + endStr);
        if (res.ok) {
          var rawData = await res.json();
          renderAnnualReport(rawData);
          loading.classList.add('hidden');
          content.classList.remove('hidden');
        } else {
          loading.innerText = '年度数据拉取失败。';
        }
      } catch(e) {
        loading.innerText = '网络请求异常。';
      }
    }

    function renderAnnualReport(rawData) {
      const content = document.getElementById('annual-content');
      
      const totalTasks = rawData.length;
      const doneTasks = rawData.filter(function(r){ return r.done === 1; }).length;
      const undoneTasks = totalTasks - doneTasks;
      const doneRate = totalTasks > 0 ? (doneTasks / totalTasks * 100) : 0;
      
      const highPri = rawData.filter(function(r){ return r.priority === 'high'; }).length;
      const medPri = rawData.filter(function(r){ return r.priority === 'med'; }).length;
      const lowPri = rawData.filter(function(r){ return r.priority === 'low'; }).length;
      const highPriRate = totalTasks > 0 ? (highPri / totalTasks * 100) : 0;
      const medPriRate = totalTasks > 0 ? (medPri / totalTasks * 100) : 0;
      const lowPriRate = totalTasks > 0 ? (lowPri / totalTasks * 100) : 0;
      
      var monthData = [];
      for (var mi = 0; mi < 12; mi++) monthData.push({ total: 0, done: 0 });
      rawData.forEach(function(r) {
        var month = parseInt(r.date.slice(5, 7)) - 1;
        if (month >= 0 && month < 12) {
          monthData[month].total++;
          if (r.done === 1) monthData[month].done++;
        }
      });
      
      var busiestMonth = 0;
      monthData.forEach(function(m, i) { if (m.total > monthData[busiestMonth].total) busiestMonth = i; });
      
      var dateCount = {};
      rawData.forEach(function(r) { dateCount[r.date] = (dateCount[r.date] || 0) + 1; });
      var busiestDate = '--';
      var busiestDateCount = 0;
      for (var dk in dateCount) {
        if (dateCount[dk] > busiestDateCount) { busiestDate = dk; busiestDateCount = dateCount[dk]; }
      }
      
      var firstHalf = 0, secondHalf = 0;
      monthData.forEach(function(m, i) { if (i < 6) firstHalf += m.total; else secondHalf += m.total; });
      
      var activeDays = Object.keys(dateCount).length;
      
      var ending = determineEnding(totalTasks, doneRate, highPriRate, firstHalf, secondHalf, monthData, activeDays, medPriRate, lowPriRate);
      
      var monthMax = 1;
      monthData.forEach(function(m) { if (m.total > monthMax) monthMax = m.total; });
      var monthLabels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
      
      var monthBarsHtml = '';
      for (var bi = 0; bi < 12; bi++) {
        var m = monthData[bi];
        var totalW = (m.total / monthMax * 100);
        var doneW = (m.done / monthMax * 100);
        monthBarsHtml += '<div class="annual-month-row">' +
          '<div class="annual-month-label">' + monthLabels[bi] + '</div>' +
          '<div class="annual-month-bar-bg">' +
            '<div class="annual-month-bar-total" style="width:' + totalW + '%"></div>' +
            '<div class="annual-month-bar-done" style="width:' + doneW + '%"></div>' +
          '</div>' +
          '<div class="annual-month-count">' + m.total + '</div>' +
        '</div>';
      }

      var priMax = Math.max(highPri, medPri, lowPri, 1);
      var priColors = ['var(--accent)', 'var(--warn)', '#666'];
      var priLabels = ['高', '中', '低'];
      var priValues = [highPri, medPri, lowPri];
      var priRates = [highPriRate, medPriRate, lowPriRate];
      var priBarsHtml = '';
      for (var pi = 0; pi < 3; pi++) {
        priBarsHtml += '<div class="annual-pri-row">' +
          '<div class="annual-pri-label">' + priLabels[pi] + '</div>' +
          '<div class="annual-pri-bar-bg">' +
            '<div class="annual-pri-bar-fill" style="width:' + (priValues[pi] / priMax * 100) + '%; background:' + priColors[pi] + ';"></div>' +
          '</div>' +
          '<div class="annual-pri-count">' + priValues[pi] + ' (' + priRates[pi].toFixed(0) + '%)</div>' +
        '</div>';
      }

      var narrative = generateNarrative(totalTasks, doneTasks, doneRate, busiestMonth, busiestDate, busiestDateCount, highPri, medPri, lowPri, activeDays, firstHalf, secondHalf, monthData, annualYear);

      content.innerHTML = 
        '<div class="annual-year-title"><span>' + annualYear + ' 年度报告</span></div>' +
        '<div class="annual-hero">' +
          '<div class="annual-ending-title">' + ending.title + '</div>' +
          '<div class="annual-ending-subtitle">' + ending.subtitle + '</div>' +
          '<div class="annual-ending-desc">' + ending.desc + '</div>' +
        '</div>' +
        '<div class="annual-divider">◆ ◆ ◆</div>' +
        '<div class="annual-section-title">核心数据</div>' +
        '<div class="annual-stats-grid">' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + totalTasks + '</div><div class="annual-stat-label">总事项数</div></div>' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + doneTasks + '</div><div class="annual-stat-label">已完成</div></div>' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + doneRate.toFixed(1) + '%</div><div class="annual-stat-label">完成率</div></div>' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + activeDays + '</div><div class="annual-stat-label">活跃天数</div></div>' +
        '</div>' +
        '<div class="annual-section-title">月度活跃度</div>' +
        '<div class="annual-month-chart">' + monthBarsHtml + '</div>' +
        '<div class="annual-section-title">优先级分布</div>' +
        '<div style="margin-bottom:25px;">' + priBarsHtml + '</div>' +
        '<div class="annual-divider">◆ ◆ ◆</div>' +
        '<div class="annual-section-title">年度叙事</div>' +
        '<div class="annual-narrative">' + narrative + '<div class="annual-report-time">统计周期：' + annualYear + '-01-01 至 ' + annualYear + '-12-31<br>显示截止：' + getAnnualExpiryTime() + '</div></div>';
    }

    function determineEnding(totalTasks, doneRate, highPriRate, firstHalf, secondHalf, monthData, activeDays, medPriRate, lowPriRate) {
      if (totalTasks < 5) {
        return {
          title: '空白画布',
          subtitle: 'THE BLANK CANVAS',
          desc: '这一年，你选择了留下大片空白。也许是没有什么需要记录，也许是最好的待办就是没有待办。空白不是虚无——它是等待被书写的可能性。下一年，你会落笔吗？'
        };
      }
      if (doneRate >= 80 && totalTasks >= 50) {
        return {
          title: '效率引擎',
          subtitle: 'THE EFFICIENCY ENGINE',
          desc: '你将待办清单视为战场，80%以上的任务被你无情终结。每一条划掉的待办，都是一次对混沌的宣战。你是秩序的信徒，效率的化身。在你面前，没有任何一条待办能活过明天。'
        };
      }
      if (doneRate < 30 && totalTasks >= 20) {
        return {
          title: '拖延哲学家',
          subtitle: 'THE PROCRASTINATION PHILOSOPHER',
          desc: '你不是在拖延——你是在思考。那些未完成的待办，每一个都承载着深邃的犹豫与无限的可能。也许明天，也许下辈子，它们终将被完成。至少，你写下了它们。'
        };
      }
      if (highPriRate > 40 && doneRate >= 60) {
        return {
          title: '战略规划师',
          subtitle: 'THE STRATEGIC PLANNER',
          desc: '你只关注真正重要的事。高优先级是你的武器，完成率是你的战绩。无关紧要的事？不配出现在你的清单上。你不是在做待办——你是在指挥战役。'
        };
      }
      if (totalTasks < 30 && doneRate >= 70) {
        return {
          title: '精准打击者',
          subtitle: 'THE PRECISION STRIKER',
          desc: '少即是多。你不贪多，但每一发都命中靶心。你的待办清单短小精悍，却弹无虚发。真正的高手，从不需要满屏的红点来证明自己的存在。'
        };
      }
      if (totalTasks >= 100 && doneRate < 50) {
        return {
          title: '待办收藏家',
          subtitle: 'THE TODO COLLECTOR',
          desc: '你的待办清单是一座博物馆。每一项都被精心收藏，却鲜有人问津。但谁知道呢？也许某天你会打开它，然后惊叹于自己曾经的野心和想象。'
        };
      }
      if (firstHalf > 0 && secondHalf >= 0 && firstHalf > secondHalf * 2) {
        return {
          title: '开局王者',
          subtitle: 'THE QUICK STARTER',
          desc: '年初的你意气风发，雄心万丈。但时间是最好的稀释剂。你的故事总是从"这次一定"开始，然后以"下次再说"收尾。但至少，你的开局总是漂亮的。'
        };
      }
      if (secondHalf > firstHalf * 2 && firstHalf > 0) {
        return {
          title: '后发制人',
          subtitle: 'THE LATE BLOOMER',
          desc: '上半年还在酝酿，下半年突然爆发。你用实际行动证明了：重要的不是何时开始，而是何时发力。厚积薄发，大器晚成——说的就是你。'
        };
      }
      var priArr = [highPriRate, medPriRate, lowPriRate];
      var maxPriDiff = Math.max.apply(null, priArr) - Math.min.apply(null, priArr);
      if (maxPriDiff < 20 && doneRate >= 55 && doneRate <= 85) {
        return {
          title: '均衡大师',
          subtitle: 'THE BALANCE MASTER',
          desc: '高、中、低优先级在你手中均匀分布。你不偏废，不冒进，以中庸之道驾驭时间。这世上没有你特别在意的事，也没有你愿意放弃的事——也许这就是最大的智慧。'
        };
      }
      if (doneRate >= 50 && doneRate < 80 && totalTasks >= 30 && totalTasks < 100) {
        return {
          title: '从容行者',
          subtitle: 'THE STEADY WALKER',
          desc: '不急不躁，按自己的节奏前行。你完成的每一件事都有分量，未完成的也不过是留给未来的礼物。你不需要被定义——你的待办清单，就是你自己。'
        };
      }
      if (doneRate >= 30 && doneRate < 50 && totalTasks >= 30) {
        return {
          title: '半途旅人',
          subtitle: 'THE HALFWAY TRAVELER',
          desc: '你开始了，但经常没有到达。这不丢人——每一段旅程都有意义，即使没有走到终点。你的清单上写满了"进行中"，而"进行中"本身就是一种态度。'
        };
      }
      return {
        title: '待办探索者',
        subtitle: 'THE TODO EXPLORER',
        desc: '你在待办的世界里漫游，不为征服，只为探索。每一条记录都是一次尝试，每一次完成都是一次惊喜。没有KPI，没有目标——只有你和你的清单。'
      };
    }

    function generateNarrative(totalTasks, doneTasks, doneRate, busiestMonth, busiestDate, busiestDateCount, highPri, medPri, lowPri, activeDays, firstHalf, secondHalf, monthData, year) {
      var monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
      var n = '';

      n += '<strong>' + year + '</strong> 年，你一共创建了 <em>' + totalTasks + '</em> 条待办事项。';

      if (totalTasks === 0) {
        n += '这一年你的清单空空如也。也许你活在当下，从不需要计划——又或者，你本身就是最好的计划。';
        return n;
      }

      n += '其中 <em>' + doneTasks + '</em> 条被你亲手终结，完成率 <em>' + doneRate.toFixed(1) + '%</em>。';

      if (doneRate >= 90) n += '这是一个令人敬畏的数字。你的清单上几乎没有逃脱者。';
      else if (doneRate >= 70) n += '大多数任务没能逃过你的追击，少数幸存者大概在瑟瑟发抖。';
      else if (doneRate >= 50) n += '一半做了，一半没做。这大概是世界上最诚实的比例。';
      else if (doneRate >= 30) n += '虽然完成的不多，但每一条都是诚意之作……大概吧。';
      else n += '你的待办清单更像是一个许愿池——扔进去的硬币，偶尔会发光。';

      n += '<br><br>';
      n += '你在 <em>' + activeDays + '</em> 个不同的日子里打开了这个应用。';

      if (activeDays >= 300) n += '几乎没有一天缺席——你比打卡机还准时。';
      else if (activeDays >= 200) n += '一年三分之二的时间你都在这里，这已经不是习惯，是信仰。';
      else if (activeDays >= 100) n += '三天打鱼两天晒网？不，你只是选择在重要的日子出现。';
      else if (activeDays >= 30) n += '偶尔来看看，确认清单还在，然后离开。这也是一种使用方式。';
      else n += '你来去如风，像一位神秘的访客。清单记得你来过。';

      n += '<br><br>';

      if (busiestMonth >= 0 && monthData[busiestMonth].total > 0) {
        n += '<strong>' + monthNames[busiestMonth] + '</strong> 是你最忙碌的月份，一共 <em>' + monthData[busiestMonth].total + '</em> 条事项涌入';
        var bDoneRate = monthData[busiestMonth].total > 0 ? (monthData[busiestMonth].done / monthData[busiestMonth].total * 100).toFixed(0) : 0;
        n += '，当月完成率 <em>' + bDoneRate + '%</em>。';
        if (monthData[busiestMonth].total >= 30) n += '那段时间你一定忙得不可开措。';
        else if (monthData[busiestMonth].total >= 15) n += '虽然忙碌，但你扛过来了。';
      }

      if (busiestDate !== '--') {
        n += '而 <strong>' + busiestDate + '</strong> 是你最充实的一天，单日创建 <em>' + busiestDateCount + '</em> 条待办。';
      }

      n += '<br><br>';

      var total = highPri + medPri + lowPri;
      if (total > 0) {
        if (highPri > medPri && highPri > lowPri) {
          n += '你的清单中高优先级事项占了 <em>' + (highPri/total*100).toFixed(0) + '%</em>——你总是先处理最紧急的事，或者说，你制造了太多紧急的事。';
        } else if (lowPri > highPri && lowPri > medPri) {
          n += '低优先级事项占了 <em>' + (lowPri/total*100).toFixed(0) + '%</em>——看起来你的大多数待办都"不那么重要"。但谁知道呢，也许"不重要"才是最诚实的标签。';
        } else if (medPri >= highPri && medPri >= lowPri) {
          n += '中优先级事项占据了 <em>' + (medPri/total*100).toFixed(0) + '%</em>——大多数事情既不紧急也不可忽略。这就是生活的真相：平淡而持续。';
        } else {
          n += '高、中、低优先级均匀分布，你对待每一件事都一视同仁……或者说，你对优先级这个功能有些随意。';
        }
      }

      n += '<br><br>';

      if (firstHalf > 0 || secondHalf > 0) {
        if (firstHalf > secondHalf * 1.5 && secondHalf > 0) {
          n += '上半年你意气风发，产出了 <em>' + firstHalf + '</em> 条事项；下半年只有 <em>' + secondHalf + '</em> 条。经典的三分钟热度曲线。';
        } else if (secondHalf > firstHalf * 1.5 && firstHalf > 0) {
          n += '下半年你突然发力，产出了 <em>' + secondHalf + '</em> 条事项，远超上半年的 <em>' + firstHalf + '</em> 条。后发制人，大器晚成。';
        } else if (firstHalf === secondHalf && firstHalf > 0) {
          n += '上下半年各产出 <em>' + firstHalf + '</em> 条事项，节奏稳定如钟。你是时间的朋友。';
        } else if (firstHalf > 0 && secondHalf > 0) {
          n += '上下半年各产出 <em>' + firstHalf + '</em> 和 <em>' + secondHalf + '</em> 条事项，节奏基本稳定。';
        } else if (firstHalf > 0 && secondHalf === 0) {
          n += '所有的事项都集中在上半年。下半年？大概是在享受上半年的劳动成果。';
        } else {
          n += '所有的事项都集中在下半年。上半年？大概是在积蓄力量。';
        }
      }

      n += '<br><br>';

      // 找出有数据的月份数
      var activeMonths = 0;
      monthData.forEach(function(m) { if (m.total > 0) activeMonths++; });
      n += '这一年有 <em>' + activeMonths + '</em> 个月份留下了你的记录。';

      if (activeMonths >= 10) n += '你几乎全年无休，是真正的待办常驻居民。';
      else if (activeMonths >= 6) n += '大半年的时间你都在与清单为伴。';
      else if (activeMonths >= 3) n += '你只在某些时段出现，像候鸟一样有规律地迁徙。';
      else n += '你的记录零星而珍贵，像夜空中偶尔闪过的流星。';

      n += '<br><br>';
      n += '这就是你的 <strong>' + year + '</strong> 年待办故事。无论结局如何，每一条记录都是你认真活过的证据。';

      return n;
    }
    
    function getAnnualExpiryTime() {
      var y = annualYear + 1;
      return y + '-01-07 23:59:59';
    }

    function renderStatsCharts(rawData, datesArray) {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const cText = isLight ? '#111111' : '#ffffff';
      const cBg = isLight ? '#F0EEE2' : '#0a0a0a';
      const cPanel = isLight ? '#E5E5E5' : '#222222';
      const cBorder = isLight ? '#1B1915' : '#555555';
      const cAccent = isLight ? '#CE2424' : '#ff3300';
      const cWarn = isLight ? '#E1AC07' : '#ff9900';
      const cGray = isLight ? '#999999' : '#666666';

      const cFont = getComputedStyle(document.documentElement).getPropertyValue('--font-main').trim() || 'Courier New';

      Chart.defaults.color = cText;
      Chart.defaults.font.family = cFont;
      Chart.defaults.font.weight = 'bold';
      Chart.defaults.plugins.tooltip.backgroundColor = isLight ? '#ffffff' : '#141414';
      Chart.defaults.plugins.tooltip.titleColor = cAccent;
      Chart.defaults.plugins.tooltip.bodyColor = cText;
      Chart.defaults.plugins.tooltip.borderColor = cBorder;
      Chart.defaults.plugins.tooltip.borderWidth = 1;

      let dailyDoneCounts = {};
      let dailyTotalCounts = {};
      datesArray.forEach(d => {
        dailyDoneCounts[d] = 0;
        dailyTotalCounts[d] = 0;
      });
      let totalDone = 0;

      let priCounts = { high: 0, med: 0, low: 0 };
      let statusCounts = { done: 0, undone: 0 };

      rawData.forEach(row => {
        if (row.done === 1) statusCounts.done++;
        else statusCounts.undone++;

        if (row.priority === 'high') priCounts.high++;
        else if (row.priority === 'med') priCounts.med++;
        else priCounts.low++;

        if (dailyTotalCounts[row.date] !== undefined) {
          dailyTotalCounts[row.date]++;
          if (row.done === 1) {
            dailyDoneCounts[row.date]++;
            totalDone++;
          }
        }
      });

      document.getElementById('stats-total-info').innerText = "近7天总完成数: " + totalDone;
      document.getElementById('stats-total-info').style.color = cText;

      // 柱状图 (每日总数 vs 完成数)
      const ctxBar = document.getElementById('chart-bar').getContext('2d');
      chartInstanceBar = new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: datesArray.map(d => d.slice(5)), // 仅显示 MM-DD
          datasets: [
            {
              label: '当日总事项',
              data: datesArray.map(d => dailyTotalCounts[d]),
              backgroundColor: cPanel,
              borderColor: cBorder,
              borderWidth: 1
            },
            {
              label: '当日完成事项',
              data: datesArray.map(d => dailyDoneCounts[d]),
              backgroundColor: cAccent,
              borderColor: cBorder,
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 800, easing: 'easeOutQuart' },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, color: cText }, grid: { color: cPanel } },
            x: { ticks: { color: cText }, grid: { color: cPanel } }
          },
          plugins: {
            legend: { labels: { color: cText, font: { weight: 'bold' } } }
          }
        }
      });

      // 圆环图 (优先级占比)
      const ctxPri = document.getElementById('chart-pie-priority').getContext('2d');
      chartInstancePri = new Chart(ctxPri, {
        type: 'doughnut',
        data: {
          labels: ['高', '中', '低'],
          datasets: [{
            data: [priCounts.high, priCounts.med, priCounts.low],
            backgroundColor: [cAccent, cWarn, cGray],
            borderColor: cBg,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 800, easing: 'easeOutQuart' },
          plugins: {
            legend: { position: 'bottom', labels: { color: cText, padding: 10, boxWidth: 12, font: { weight: 'bold' } } },
            title: { display: true, text: '优先级占比', color: cText, font: { size: 14, weight: 'bold' } },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let dataArr = context.dataset.data;
                  let total = 0;
                  for (let i = 0; i < dataArr.length; i++) {
                    total += dataArr[i];
                  }
                  let percentage = total === 0 ? 0 : Math.round((context.raw / total) * 100);
                  return context.raw + ' (' + percentage + '%)';
                }
              }
            }
          }
        }
      });

      // 圆环图 (完成率占比)
      const ctxStat = document.getElementById('chart-pie-status').getContext('2d');
      chartInstanceStat = new Chart(ctxStat, {
        type: 'doughnut',
        data: {
          labels: ['已完成', '未完成'],
          datasets: [{
            data: [statusCounts.done, statusCounts.undone],
            backgroundColor:[cGray, cAccent],
            borderColor: cBg,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 800, easing: 'easeOutQuart' },
          plugins: {
            legend: { position: 'bottom', labels: { color: cText, padding: 10, boxWidth: 12, font: { weight: 'bold' } } },
            title: { display: true, text: '事项完成率', color: cText, font: { size: 14, weight: 'bold' } },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let dataArr = context.dataset.data;
                  let total = 0;
                  for (let i = 0; i < dataArr.length; i++) {
                    total += dataArr[i];
                  }
                  let percentage = total === 0 ? 0 : Math.round((context.raw / total) * 100);
                  return context.raw + ' (' + percentage + '%)';
                }
              }
            }
          }
        }
      });
    }

    function openTrash() {
      exitTrashBatchMode();
      const trashView = document.getElementById('trash-overlay');
      trashView.classList.remove('closing');
      trashView.classList.add('active');
      loadTrashData();
    }

    function closeTrash() {
      exitTrashBatchMode();
      const trashView = document.getElementById('trash-overlay'); 
      trashView.classList.add('closing');
      trashView.addEventListener('animationend', function handler() {
        trashView.classList.remove('active'); 
        trashView.classList.remove('closing'); 
        trashView.removeEventListener('animationend', handler);
      });
      loadTodos(); 
    }

    async function loadTrashData() {
      const list = document.getElementById('trash-list');
      list.innerHTML = '<div style="padding:20px;text-align:center;">数据拉取中...</div>';
      try {
        const res = await fetch('/api/trash');
        if (res.ok) {
          trashTodos = await res.json();
          renderTrashItems();
        }
      } catch(e) { list.innerHTML = '<div style="color:var(--warn);text-align:center;">加载失败</div>'; }
    }

    function renderTrashItems() {
      const list = document.getElementById('trash-list');
      list.innerHTML = '';
      if (trashTodos.length === 0) {
        list.innerHTML = '<div style="padding:40px;text-align:center;border:1px dashed #666;">回收站为空</div>';
        return;
      }
      trashTodos.forEach((todo, index) => {
        const el = document.createElement('div');
        el.className = 'todo-item';
        
        let checkboxHtml = '';
        let actionsHtml = '';

        if (isTrashBatchMode) {
          const isSelected = selectedTrashTasks.has(index);
          checkboxHtml = \`<div class="checkbox \${isSelected ? 'batch-selected' : ''}" onclick="event.stopPropagation(); toggleTrashBatchSelect(\${index})"></div>\`;
        } else {
          actionsHtml = \`
            <button class="btn-ghost" style="padding:4px 8px; border:1px solid #666;" onclick="event.stopPropagation(); actionTrash('\${todo.id}', 'RESTORE')">恢复</button>
            <button class="btn-danger" style="padding:4px 8px; margin-left:8px;" onclick="event.stopPropagation(); actionTrash('\${todo.id}', 'DELETE_PERMANENT')">删除</button>
          \`;
        }

        el.innerHTML = \`
          \${checkboxHtml}
          <div class="item-meta" style="opacity:0.7;">
            <div class="item-title" style="text-decoration:line-through;">\${todo.text}</div>
            <div class="item-info">原日期: \${todo.date}</div>
          </div>
          \${actionsHtml}
        \`;

        if (isTrashBatchMode) {
            el.onclick = () => toggleTrashBatchSelect(index);
        } else {
            el.style.cursor = 'default';
        }

        list.appendChild(el);
      });
    }

    function toggleTrashBatchMode() {
      if (isTrashBatchMode) {
        exitTrashBatchMode();
      } else {
        isTrashBatchMode = true;
        selectedTrashTasks.clear();
        const bar = document.getElementById('trash-batch-bar');
        bar.classList.remove('hidden', 'closing');
        document.getElementById('btn-trash-batch').classList.add('active');
        renderTrashItems();
      }
    }

    function exitTrashBatchMode() {
      if (!isTrashBatchMode) return;
      isTrashBatchMode = false;
      selectedTrashTasks.clear();
      const bar = document.getElementById('trash-batch-bar');
      bar.classList.add('closing');
      bar.addEventListener('animationend', function handler() {
        bar.classList.add('hidden');
        bar.classList.remove('closing');
        bar.removeEventListener('animationend', handler);
      });
      document.getElementById('btn-trash-batch').classList.remove('active');
      renderTrashItems();
    }

    function toggleTrashBatchSelect(index) {
      if (selectedTrashTasks.has(index)) selectedTrashTasks.delete(index);
      else selectedTrashTasks.add(index);
      renderTrashItems();
    }

    function batchTrashSelectAll() {
      if (selectedTrashTasks.size === trashTodos.length && trashTodos.length > 0) {
        selectedTrashTasks.clear();
      } else {
        trashTodos.forEach((_, i) => selectedTrashTasks.add(i));
      }
      renderTrashItems();
    }

    async function batchTrashRestore() {
      if (selectedTrashTasks.size === 0) return;
      const ids = Array.from(selectedTrashTasks).map(idx => trashTodos[idx].id);
      await fetch('/api/trash-action', {
        method: 'POST', body: JSON.stringify({ action: 'BATCH_RESTORE', ids })
      });
      exitTrashBatchMode();
      loadTrashData();
    }

    async function batchTrashDelete() {
      if (selectedTrashTasks.size === 0) return;
      if (!confirm(\`你会永远失去 \${selectedTrashTasks.size} 个事项！\`)) return;
      const ids = Array.from(selectedTrashTasks).map(idx => trashTodos[idx].id);
      await fetch('/api/trash-action', {
        method: 'POST', body: JSON.stringify({ action: 'BATCH_DELETE_PERMANENT', ids })
      });
      exitTrashBatchMode();
      loadTrashData();
    }

    async function actionTrash(id, action) {
      if (action === 'DELETE_PERMANENT' && !confirm('你会永远失去它，确认？')) return;
      await fetch('/api/trash-action', {
        method: 'POST', body: JSON.stringify({ action, id }),
        headers: { 'Content-Type': 'application/json' }
      });
      loadTrashData();
    }

    async function clearTrash() {
      if (!confirm('确认清空？你会永远失去它们！')) return;
      await fetch('/api/trash-action', {
        method: 'POST', body: JSON.stringify({ action: 'CLEAR_ALL' }),
        headers: { 'Content-Type': 'application/json' }
      });
      loadTrashData();
    }

    function addTempSubtask(mode) {
      const inputId = mode === 'add' ? 'add-subtask-input' : 'edit-subtask-input';
      const input = document.getElementById(inputId);
      const text = input.value.trim();
      if (text) {
        tempSubtasks.push({ text: text, done: false });
        input.value = '';
        renderTempSubtasks(mode);
      }
    }

    function removeTempSubtask(mode, index) {
      tempSubtasks.splice(index, 1);
      renderTempSubtasks(mode);
    }

    function renderTempSubtasks(mode) {
      const listId = mode === 'add' ? 'add-subtasks-list' : 'edit-subtasks-list';
      const list = document.getElementById(listId);
      if (!list) return;
      list.innerHTML = tempSubtasks.map((st, i) => \`
        <div class="subtask-edit-item">
          <span class="flex-1" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${st.text}</span>
          <button class="btn-danger" style="padding:4px 8px;" onclick="removeTempSubtask('\${mode}', \${i})">删</button>
        </div>
      \`).join('');
    }

    async function toggleAddSearch() {
      addSearchState = !addSearchState;
      document.getElementById('add-search-box').classList.toggle('checked', addSearchState);
      const actions = document.getElementById('add-search-actions');
      const preview = document.getElementById('add-search-preview');
      const btn = document.getElementById('add-search-regenerate-btn');
      const provider = tempSearchProvider;
      
      if (addSearchState) {
        actions.classList.remove('hidden');
        preview.innerHTML = '<div style="color:#666; width:100%; text-align:center; padding: 10px 0;">[系统请求中] 正在通过 CF Worker 拉取全网热点...</div>';
        btn.disabled = true;
        tempSearchTerms = await generateSearchTerms(provider);
        btn.disabled = false;
        if(tempSearchTerms.length === 0) {
          preview.innerHTML = '<div style="color:var(--warn); width:100%; text-align:center;">[数据拉取失败] 请重试或稍后再试</div>';
        } else {
          renderAddSearchTerms();
        }
      } else {
        tempSearchTerms =[];
        actions.classList.add('hidden');
      }
    }

    async function regenerateAddSearchTerms() {
      const preview = document.getElementById('add-search-preview');
      const btn = document.getElementById('add-search-regenerate-btn');
      const provider = tempSearchProvider;
      preview.innerHTML = '<div style="color:#666; width:100%; text-align:center; padding: 10px 0;">[系统请求中] 正在通过 CF Worker 重新拉取热点...</div>';
      btn.disabled = true;
      tempSearchTerms = await generateSearchTerms(provider);
      btn.disabled = false;
      if(tempSearchTerms.length === 0) {
        preview.innerHTML = '<div style="color:var(--warn); width:100%; text-align:center;">[数据拉取失败] 请重试或稍后再试</div>';
      } else {
        renderAddSearchTerms();
      }
    }

    function toggleTempSearchTerm(mode, index) {
      tempSearchTerms[index].done = !tempSearchTerms[index].done;
      if (mode === 'add') renderAddSearchTerms();
      else renderEditSearchTerms();
    }

    function copyTempSearchTerm(mode, index, safeText) {
      copyText(decodeURIComponent(safeText));
      tempSearchTerms[index].done = true;
      if (mode === 'add') renderAddSearchTerms();
      else renderEditSearchTerms();
    }

    function renderAddSearchTerms() {
      const preview = document.getElementById('add-search-preview');
      preview.innerHTML = tempSearchTerms.map((termObj, i) => {
        const text = termObj.text;
        const safeText = encodeURIComponent(text).replace(/'/g, "%27");
        return \`<div class="search-term-tag \${termObj.done ? 'done' : ''}">
          <div class="search-term-checkbox" onclick="toggleTempSearchTerm('add', \${i})"></div>
          <span>\${text}</span>
          <button onclick="copyTempSearchTerm('add', \${i}, '\${safeText}')">⎘</button>
        </div>\`;
      }).join('');
    }

    async function toggleEditSearch() {
      const box = document.getElementById('edit-search-box');
      const isOn = box.classList.contains('checked');
      const preview = document.getElementById('edit-search-preview');
      const btn = document.getElementById('edit-search-regenerate-btn');
      const provider = tempSearchProvider;

      if (isOn) {
        box.classList.remove('checked');
        tempSearchTerms =[];
        document.getElementById('edit-search-actions').classList.add('hidden');
      } else {
        box.classList.add('checked');
        document.getElementById('edit-search-actions').classList.remove('hidden');
        preview.innerHTML = '<div style="color:#666; width:100%; text-align:center; padding: 10px 0;">[系统请求中] 正在通过 CF Worker 拉取全网热点...</div>';
        if (btn) btn.disabled = true;
        tempSearchTerms = await generateSearchTerms(provider);
        if (btn) btn.disabled = false;
        if(tempSearchTerms.length === 0) {
          preview.innerHTML = '<div style="color:var(--warn); width:100%; text-align:center;">[数据拉取失败] 请重试或稍后再试</div>';
        } else {
          renderEditSearchTerms();
        }
      }
    }

    async function regenerateEditSearchTerms() {
      const preview = document.getElementById('edit-search-preview');
      const btn = document.getElementById('edit-search-regenerate-btn');
      const provider = tempSearchProvider;

      if (preview) {
        preview.innerHTML = '<div style="color:#666; width:100%; text-align:center; padding: 10px 0;">[系统请求中] 正在通过 CF Worker 重新拉取热点...</div>';
        if (btn) btn.disabled = true;
        tempSearchTerms = await generateSearchTerms(provider);
        if (btn) btn.disabled = false;
        if(tempSearchTerms.length === 0) {
          preview.innerHTML = '<div style="color:var(--warn); width:100%; text-align:center;">[数据拉取失败] 请重试或稍后再试</div>';
        } else {
          renderEditSearchTerms();
        }
      }
    }

    function renderEditSearchTerms() {
      const preview = document.getElementById('edit-search-preview');
      if (preview) {
        preview.innerHTML = tempSearchTerms.map((termObj, i) => {
          const text = termObj.text;
          const safeText = encodeURIComponent(text).replace(/'/g, "%27");
          return \`<div class="search-term-tag \${termObj.done ? 'done' : ''}">
            <div class="search-term-checkbox" onclick="toggleTempSearchTerm('edit', \${i})"></div>
            <span>\${text}</span>
            <button onclick="copyTempSearchTerm('edit', \${i}, '\${safeText}')">⎘</button>
          </div>\`;
        }).join('');
      }
    }

    function toggleRepeatMenu(mode, triggerEl) {
      activeMode = mode; 
      const popover = document.getElementById('popover-repeat'); 
      triggerEl.parentNode.style.position = 'relative';
      triggerEl.parentNode.appendChild(popover);
      popover.style.display = 'flex'; 
      popover.style.top = (triggerEl.offsetTop + triggerEl.offsetHeight + 5) + 'px'; 
      popover.style.left = triggerEl.offsetLeft + 'px';
      const closeHandler = (e) => { 
        if(!popover.contains(e.target) && e.target !== triggerEl && !triggerEl.contains(e.target)) { 
          popover.style.display = 'none'; 
          document.removeEventListener('click', closeHandler); 
        } 
      };
      setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    function selectRepeat(val, label) {
      tempRepeatType = val;
      if (activeMode === 'add') {
        document.getElementById('add-repeat-display').innerText = '重复: ' + label;
      } else if (activeMode === 'edit') {
        document.getElementById('edit-repeat-display').innerText = '重复: ' + label;
      }
      document.getElementById('popover-repeat').style.display = 'none';
    }

    function openAddModal() {
      activeMode = 'add';
      document.getElementById('modal-add').classList.add('active');
      document.getElementById('add-text').value = ''; document.getElementById('add-desc').value = '';
      document.getElementById('add-url').value = ''; document.getElementById('add-copy').value = '';
      tempTime = ''; tempPriority = 'low';
      tempRepeatType = 'none';
      tempAddDate = formatDate(currentDate);
      document.getElementById('add-date-display').innerText = tempAddDate;
      document.getElementById('add-repeat-display').innerText = '重复: 不重复';
      
      tempSubtasks =[]; tempSearchTerms =[]; addSearchState = false; 
      tempSearchProvider = appSettings.provider || 'auto';
      document.getElementById('add-subtask-input').value = '';
      renderTempSubtasks('add');
      
      const pMap = {'auto':'自动 (随机源)', 'bilibili':'哔哩哔哩', 'weibo':'微博热搜', 'zhihu':'知乎热榜', 'baidu':'百度热搜'};
      const providerDisplay = document.getElementById('add-search-provider-display');
      if(providerDisplay) providerDisplay.innerText = pMap[tempSearchProvider];

      document.getElementById('add-search-box').classList.remove('checked');
      document.getElementById('add-search-actions').classList.add('hidden');

      updateAddUI();
    }
    
    function updateAddUI() {
      document.getElementById('add-time-display').innerText = tempTime || '--:--';
      const pMap = {low:'优先级: 低', med:'优先级: 中', high:'优先级: 高'};
      document.getElementById('add-priority-display').innerText = pMap[tempPriority];
    }

    function closeAddModal() {
      hideAndRescuePopovers();
      var modal = document.getElementById('modal-add');
      if (!modal || !modal.classList.contains('active')) return;
      
      var content = modal.querySelector('.modal-content');
      if (!content) { modal.classList.remove('active'); return; }
      
      modal.classList.add('closing-overlay');
      content.classList.add('closing');
      
      var computedStyle = window.getComputedStyle(content);
      var duration = parseFloat(computedStyle.animationDuration);
      var name = computedStyle.animationName;
      
      var closed = false;
      function doClose() {
        if (closed) return;
        closed = true;
        modal.classList.remove('active', 'closing-overlay');
        content.classList.remove('closing');
      }
      
      if (name && name !== 'none' && duration > 0) {
        content.addEventListener('animationend', function handler(e) {
          if (e.target === content) {
            doClose();
            content.removeEventListener('animationend', handler);
          }
        });
        setTimeout(doClose, duration * 1000 + 100);
      } else {
        doClose();
      }
    }

    async function confirmAddTask() {
      const text = document.getElementById('add-text').value.trim();
      if (!text) return;
      const newId = Date.now().toString() + Math.random().toString().slice(2, 6);
      const newTask = {
        id: newId, parentId: newId, text: text, time: tempTime,
        priority: tempPriority, 
        repeat_type: tempRepeatType,
        repeat_custom: '',
        desc: document.getElementById('add-desc').value, url: document.getElementById('add-url').value,
        copyText: document.getElementById('add-copy').value, done: false,
        subtasks: tempSubtasks, search_terms: tempSearchTerms
      };
      closeAddModal();
      await fetch('/api/todo-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'CREATE', date: tempAddDate, task: newTask }),
        headers: { 'Content-Type': 'application/json' }
      });
      loadTodos(); 
    }

    async function toggleSearchTerm(taskIndex, termIndex) {
      const task = todos[taskIndex];
      task.search_terms[termIndex].done = !task.search_terms[termIndex].done;
      renderDetailContent();
      await fetch('/api/todo-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'UPDATE_SEARCH_TERMS', task: { id: task.id, search_terms: task.search_terms } }),
        headers: { 'Content-Type': 'application/json' }
      });
      renderTodos(); 
    }

    async function copySearchTerm(taskIndex, termIndex, safeText) {
      copyText(decodeURIComponent(safeText));
      const task = todos[taskIndex];
      if (!task.search_terms[termIndex].done) {
        task.search_terms[termIndex].done = true;
        renderDetailContent();
        await fetch('/api/todo-action', {
          method: 'POST',
          body: JSON.stringify({ action: 'UPDATE_SEARCH_TERMS', task: { id: task.id, search_terms: task.search_terms } }),
          headers: { 'Content-Type': 'application/json' }
        });
        renderTodos();
      }
    }

    function openDetail(index) {
      currentDetailIndex = index; isEditMode = false;
      const task = todos[index]; tempTime = task.time || ''; tempPriority = task.priority || 'low';
      renderDetailContent();
      
      const btnSave = document.getElementById('btn-save-task'); const btnDel = document.getElementById('btn-delete-task');
      const btnEdit = document.getElementById('btn-edit-toggle');
      btnSave.classList.add('hidden'); btnDel.classList.remove('hidden'); btnEdit.innerText = "编辑";
      btnDel.onclick = (e) => handleActionClick(e, 'delete'); btnSave.onclick = (e) => handleActionClick(e, 'save');

      const detailView = document.getElementById('detail-view');
      detailView.classList.remove('closing'); detailView.classList.add('active');
    }

    function closeDetail() {
      hideAndRescuePopovers();
      const detailView = document.getElementById('detail-view'); detailView.classList.add('closing');
      detailView.addEventListener('animationend', function handler() {
        detailView.classList.remove('active'); detailView.classList.remove('closing'); detailView.removeEventListener('animationend', handler);
      });
    }

    function renderDetailContent() {
      hideAndRescuePopovers();
      const task = todos[currentDetailIndex]; const container = document.getElementById('detail-content');
      const pMap = {low:'低', med:'中', high:'高'};
      const rMap = { none: '不重复', daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' };
      
      if (!isEditMode) {
        let urlSection = '';
        if (task.url) urlSection = \`<div class="detail-label">链接 (URL)</div><div class="detail-value"><a href="\${task.url}" target="_blank">\${task.url}</a></div>\`;

        let copySection = '';
        if (task.copy_text) {
          const safeText = encodeURIComponent(task.copy_text).replace(/'/g, "%27");
          copySection = \`<div class="detail-label">快捷复制内容</div><div class="detail-value" style="display:flex; justify-content:space-between; align-items:center;">
              <span>\${task.copy_text}</span><button class="btn-ghost" style="padding:4px 8px;" onclick="copyText(decodeURIComponent('\${safeText}'))">复制</button>
            </div>\`;
        }

        let descSection = '';
        if (task.desc) {
          const mdHtml = parseMarkdown(task.desc);
          descSection = \`<div class="detail-label">备注</div><div class="detail-value" style="display:block; min-height:30px; line-height:1.5;">\${mdHtml}</div>\`;
        }

        let subtasksSection = '';
        if (task.subtasks && task.subtasks.length > 0) {
          let stHtml = task.subtasks.map((st, i) => \`
            <div class="subtask-view-item \${st.done ? 'done' : ''}" onclick="toggleSubtask(\${currentDetailIndex}, \${i})">
                <div class="checkbox"></div>
                <div class="item-meta"><div class="item-title">\${st.text}</div></div>
            </div>
          \`).join('');
          subtasksSection = \`<div class="detail-label">子任务</div><div style="margin-bottom:20px;">\${stHtml}</div>\`;
        }

        let searchSection = '';
        if (task.search_terms && task.search_terms.length > 0) {
          let stHtml = task.search_terms.map((termObj, i) => {
            const text = termObj.text;
            const safeText = encodeURIComponent(text).replace(/'/g, "%27");
            return \`<div class="search-term-tag \${termObj.done ? 'done' : ''}">
              <div class="search-term-checkbox" onclick="toggleSearchTerm(\${currentDetailIndex}, \${i})"></div>
              <span>\${text}</span>
              <button onclick="copySearchTerm(\${currentDetailIndex}, \${i}, '\${safeText}')">⎘</button>
            </div>\`;
          }).join('');
          searchSection = \`
            <div class="detail-label">网络每日搜索</div>
            <div class="search-card">
              \${stHtml}
            </div>
          \`;
        }

        let rText = '单次任务';
        if (task.repeat_type && task.repeat_type !== 'none') {
            rText = \`重复: \${rMap[task.repeat_type]}\`;
        } else if (task.isSeries) {
            rText = '已停用未来的系列事项';
        }

        container.innerHTML = \`
          <div class="detail-label">事项内容</div><div class="detail-value">\${task.text}</div>
          \${subtasksSection}
          \${searchSection}
          <div class="row">
            <div class="flex-1"><div class="detail-label">时间点</div><div class="detail-value">\${task.time || '--:--'}</div></div>
            <div class="flex-1"><div class="detail-label">优先级</div><div class="detail-value">\${pMap[task.priority]}</div></div>
          </div>
          \${urlSection}\${copySection}
          <div class="detail-label">属性</div><div class="detail-value">\${rText}</div>
          \${descSection}
        \`;
      } else {
        activeMode = 'edit';
        container.innerHTML = \`
          <div class="detail-label">事项内容</div><input type="text" id="edit-text" value="\${task.text}" class="detail-value editable">
          
          <div class="detail-label">子任务</div>
          <div class="row" style="margin-bottom:10px; align-items:stretch;">
            <input type="text" id="edit-subtask-input" placeholder="输入子任务（可选）" style="margin-bottom:0; height:42px;" class="detail-value editable flex-1">
            <button onclick="addTempSubtask('edit')" style="margin:0; height:42px;">添加</button>
          </div>
          <div id="edit-subtasks-list" style="margin-bottom:15px;"></div>
          
          <div class="detail-label">网络每日搜索</div>
          <div class="switch-label" onclick="toggleEditSearch()">
            <div class="switch-box \${tempSearchTerms.length > 0 ? 'checked' : ''}" id="edit-search-box"></div>
            <span>开启每日搜索</span>
          </div>
          <div id="edit-search-actions" class="\${tempSearchTerms.length > 0 ? '' : 'hidden'}" style="margin-bottom:15px;">
            <div class="row" style="margin-bottom:10px;">
              <div class="fake-input flex-1" id="edit-search-provider-trigger" onclick="toggleProviderMenu('edit', this)" style="margin-bottom:0; height:46px;">
                <span id="edit-search-provider-display">自动 (随机源)</span>
                <span style="font-size:0.8rem; margin-right: 8px;">▼</span>
              </div>
              <button class="btn-ghost flex-1" id="edit-search-regenerate-btn" style="margin-bottom:0; height:46px; padding: 0 5px;" onclick="regenerateEditSearchTerms()">获取热搜</button>
            </div>
            <div class="search-card" id="edit-search-preview"></div>
          </div>

          <div class="row">
            <div class="flex-1"><div class="detail-label">时间点</div><div class="fake-input detail-value editable" onclick="openTimePicker('edit')"><span id="edit-time-display">\${tempTime || '--:--'}</span></div></div>
            <div class="flex-1"><div class="detail-label">优先级</div><div class="fake-input detail-value editable" onclick="togglePriorityMenu('edit', this)"><span id="edit-priority-display">\${pMap[tempPriority]}</span></div></div>
          </div>
          <div class="detail-label">链接 (URL)</div><input type="url" id="edit-url" value="\${task.url || ''}" class="detail-value editable" placeholder="https://...">
          <div class="detail-label">快捷复制内容</div><input type="text" id="edit-copy" value="\${task.copy_text || ''}" class="detail-value editable" placeholder="需复制的文本...">
          
          <div class="detail-label">属性</div>
          <div class="fake-input detail-value editable" onclick="toggleRepeatMenu('edit', this)" style="display:flex; justify-content:space-between;">
            <span id="edit-repeat-display">重复: \${rMap[tempRepeatType]}</span>
            <span style="font-size:0.8rem">▼</span>
          </div>
          
          <div class="detail-label">备注</div><textarea id="edit-desc" rows="5" class="detail-value editable">\${task.desc || ''}</textarea>
        \`;
        renderTempSubtasks('edit');
        if (tempSearchTerms.length > 0) renderEditSearchTerms();
      }
    }

    function toggleEditMode() {
      isEditMode = !isEditMode;
      const btnSave = document.getElementById('btn-save-task'); const btnDel = document.getElementById('btn-delete-task'); const btnEdit = document.getElementById('btn-edit-toggle');
      if (isEditMode) {
        btnSave.classList.remove('hidden'); btnDel.classList.add('hidden'); btnEdit.innerText = "取消编辑";
        const task = todos[currentDetailIndex]; 
        tempTime = task.time || ''; tempPriority = task.priority || 'low';
        tempRepeatType = task.repeat_type || 'none';
        tempSubtasks = JSON.parse(JSON.stringify(task.subtasks ||[]));
        tempSearchTerms = JSON.parse(JSON.stringify(task.search_terms ||[]));
        tempSearchProvider = appSettings.provider || 'auto';
        
        setTimeout(() => {
          const pMap = {'auto':'自动 (随机源)', 'bilibili':'哔哩哔哩', 'weibo':'微博热搜', 'zhihu':'知乎热榜', 'baidu':'百度热搜'};
          const el = document.getElementById('edit-search-provider-display');
          if (el) el.innerText = pMap[tempSearchProvider];
        }, 10);
      } else {
        btnSave.classList.add('hidden'); btnDel.classList.remove('hidden'); btnEdit.innerText = "编辑";
      }
      renderDetailContent();
    }

    function toggleProviderMenu(mode, triggerEl) {
      activeMode = mode; 
      const popover = document.getElementById('popover-provider'); 
      triggerEl.parentNode.style.position = 'relative';
      triggerEl.parentNode.appendChild(popover);
      popover.style.display = 'flex'; 
      popover.style.top = (triggerEl.offsetTop + triggerEl.offsetHeight + 5) + 'px'; 
      popover.style.left = triggerEl.offsetLeft + 'px';
      const closeHandler = (e) => { 
        if(!popover.contains(e.target) && e.target !== triggerEl && !triggerEl.contains(e.target)) { 
          popover.style.display = 'none'; 
          document.removeEventListener('click', closeHandler); 
        } 
      };
      setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    function selectProvider(val) {
      tempSearchProvider = val; 
      const pMap = {
        'auto': '自动 (随机源)', 'bilibili': '哔哩哔哩', 'weibo': '微博热搜', 'zhihu': '知乎热榜', 'baidu': '百度热搜'
      };
      if(activeMode === 'add') {
        const el = document.getElementById('add-search-provider-display');
        if(el) el.innerText = pMap[val];
      } else if(activeMode === 'edit') {
        const el = document.getElementById('edit-search-provider-display');
        if(el) el.innerText = pMap[val];
      }
      document.getElementById('popover-provider').style.display = 'none';
    }

    let timePickerHour = 0; let timePickerMin = 0;
    function openTimePicker(mode) {
      activeMode = mode; document.getElementById('modal-time').classList.add('active');
      if(tempTime) { const[h, m] = tempTime.split(':').map(Number); timePickerHour = h; timePickerMin = m; } 
      else { const now = new Date(); timePickerHour = now.getHours(); timePickerMin = now.getMinutes(); }
      const hCol = document.getElementById('time-col-hour'); hCol.innerHTML = '';
      for(let i=0; i<24; i++) {
        const div = document.createElement('div'); div.className = 'time-cell'; div.innerText = String(i).padStart(2, '0');
        div.onclick = () => { timePickerHour = i; updateTimePickerSelection(); }; hCol.appendChild(div);
      }
      const mCol = document.getElementById('time-col-min'); mCol.innerHTML = '';
      for(let i=0; i<60; i++) {
        const div = document.createElement('div'); div.className = 'time-cell'; div.innerText = String(i).padStart(2, '0');
        div.onclick = () => { timePickerMin = i; updateTimePickerSelection(); }; mCol.appendChild(div);
      }
      setTimeout(() => {
        updateTimePickerSelection();
        const activeH = hCol.querySelector('.active'); if(activeH) activeH.scrollIntoView({block: "center"});
        const activeM = mCol.querySelector('.active'); if(activeM) activeM.scrollIntoView({block: "center"});
      }, 10);
    }

    function updateTimePickerSelection() {
      const hCells = document.getElementById('time-col-hour').children; Array.from(hCells).forEach((c, i) => c.className = (i === timePickerHour) ? 'time-cell active' : 'time-cell');
      const mCells = document.getElementById('time-col-min').children; Array.from(mCells).forEach((c, i) => c.className = (i === timePickerMin) ? 'time-cell active' : 'time-cell');
    }

    function confirmTime() {
      tempTime = \`\${String(timePickerHour).padStart(2,'0')}:\${String(timePickerMin).padStart(2,'0')}\`;
      if(activeMode === 'add') updateAddUI(); else if(activeMode === 'edit') document.getElementById('edit-time-display').innerText = tempTime;
      closeTimePicker();
    }

    function clearTime() {
      tempTime = '';
      if(activeMode === 'add') updateAddUI(); else if(activeMode === 'edit') document.getElementById('edit-time-display').innerText = '--:--';
      closeTimePicker();
    }
    function closeTimePicker() { document.getElementById('modal-time').classList.remove('active'); }

    function togglePriorityMenu(mode, triggerEl) {
      activeMode = mode; 
      const popover = document.getElementById('popover-priority'); 
      triggerEl.parentNode.style.position = 'relative';
      triggerEl.parentNode.appendChild(popover);
      popover.style.display = 'flex'; 
      popover.style.top = (triggerEl.offsetTop + triggerEl.offsetHeight + 5) + 'px'; 
      popover.style.left = triggerEl.offsetLeft + 'px';
      const closeHandler = (e) => { 
        if(!popover.contains(e.target) && e.target !== triggerEl) { 
          popover.style.display = 'none'; 
          document.removeEventListener('click', closeHandler); 
        } 
      };
      setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    function selectPriority(val) {
      tempPriority = val; const pMapShort = {low:'低', med:'中', high:'高'};
      if(activeMode === 'add') updateAddUI(); else if(activeMode === 'edit') document.getElementById('edit-priority-display').innerText = pMapShort[val];
      document.getElementById('popover-priority').style.display = 'none';
    }

    function handleActionClick(e, action) {
      const task = todos[currentDetailIndex]; pendingAction = action;
      const popover = document.getElementById('popover-action'); const title = document.getElementById('popover-title'); const options = document.getElementById('popover-options');
      options.innerHTML = '';
      if (action === 'delete') {
        title.innerText = "警告：确认删除？";
        if (task.isSeries) {
          options.innerHTML += \`<button onclick="confirmAction('single')">仅此项</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('future')">此项及以后</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('all')">所有重复项</button>\`;
        } else { options.innerHTML += \`<button onclick="confirmAction('single')">确认删除 (Confirm)</button>\`; }
      } else if (action === 'save') {
        const isRepeatNow = tempRepeatType !== 'none';
        if (task.isSeries || isRepeatNow) {
          title.innerText = "保存为：";
          options.innerHTML += \`<button onclick="confirmAction('single')">仅此项</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('future')">此项及以后</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('all')">所有重复项</button>\`;
        } else { confirmAction('single'); return; }
      }

      const btn = e.target; btn.parentNode.style.position = 'relative'; btn.parentNode.appendChild(popover);
      popover.style.display = 'flex'; popover.style.top = 'auto'; popover.style.bottom = (btn.parentNode.offsetHeight - btn.offsetTop + 5) + 'px';
      if (btn.offsetLeft > btn.parentNode.offsetWidth / 2) { popover.style.right = (btn.parentNode.offsetWidth - btn.offsetLeft - btn.offsetWidth) + 'px'; popover.style.left = 'auto'; } else { popover.style.left = btn.offsetLeft + 'px'; popover.style.right = 'auto'; }

      const closeHandler = (event) => { if (!popover.contains(event.target) && event.target !== e.target) { popover.style.display = 'none'; document.removeEventListener('click', closeHandler); } };
      setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    async function confirmAction(scope) {
      hideAndRescuePopovers();
      const task = todos[currentDetailIndex];
      if (pendingAction === 'delete') {
        closeDetail();
        await fetch('/api/todo-action', { method: 'POST', body: JSON.stringify({ action: 'DELETE', date: formatDate(currentDate), task: task, scope: scope }), headers: { 'Content-Type': 'application/json' } });
        loadTodos();
      } 
      else if (pendingAction === 'save') {
        task.text = document.getElementById('edit-text').value; task.time = tempTime; task.priority = tempPriority;
        task.desc = document.getElementById('edit-desc').value; task.url = document.getElementById('edit-url').value;
        task.copyText = document.getElementById('edit-copy').value; task.copy_text = task.copyText; 
        task.subtasks = tempSubtasks; task.search_terms = tempSearchTerms;
        task.repeat_type = tempRepeatType; task.repeat_custom = '';
        
        toggleEditMode();
        await fetch('/api/todo-action', { method: 'POST', body: JSON.stringify({ action: 'UPDATE', date: formatDate(currentDate), task: task, scope: scope }), headers: { 'Content-Type': 'application/json' } });
        await loadTodos();
        const newIndex = todos.findIndex(t => t.id === task.id);
        if (newIndex !== -1) currentDetailIndex = newIndex; else closeDetail();
      }
    }

    function openCalendar() { calendarMode = 'navigate'; calDate = new Date(currentDate); calMode = 'date'; renderCalendar(); document.getElementById('modal-calendar').classList.add('active'); }
    function calChange(offset) {
      if (calMode === 'date') { calDate.setMonth(calDate.getMonth() + offset); renderCalendar(); } 
      else if (calMode === 'year') { yearPickerStart += offset * 12; openYearPicker(yearPickerStart); } 
      else if (calMode === 'month') { calDate.setFullYear(calDate.getFullYear() + offset); openMonthPicker(); }
    }
    
    function openCalendarForAdd() { calendarMode = 'select'; calDate = new Date(tempAddDate || currentDate); renderCalendar(); document.getElementById('modal-calendar').classList.add('active');
    }

    function renderCalendar() {
      calMode = 'date';
      const year = calDate.getFullYear(); const month = calDate.getMonth();
      const actionBtn = document.getElementById('cal-action-btn'); actionBtn.innerText = '返回今日'; actionBtn.onclick = jumpToToday;
      
      document.getElementById('cal-prev').innerText = '< 上月'; document.getElementById('cal-next').innerText = '下月 >';
      document.getElementById('cal-title').innerHTML = \`<span class="cal-title-btn" onclick="openYearPicker()">\${year}年</span> <span class="cal-title-btn" onclick="openMonthPicker()">\${month + 1}月</span>\`;
      
      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(7, 1fr)'; grid.innerHTML = '';
      const days = ['日','一','二','三','四','五','六']; days.forEach(d => grid.innerHTML += \`<div class="cal-day-name">\${d}</div>\`);
      const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
      const todayStr = formatDate(new Date()); const selectedStr = calendarMode === 'select' ? formatDate(calDate) : formatDate(currentDate);

      for(let i=0; i<firstDay; i++) grid.innerHTML += \`<div class="cal-date empty"></div>\`;
      for(let i=1; i<=daysInMonth; i++) {
        const d = new Date(year, month, i); const dStr = formatDate(d);
        let className = 'cal-date';
        if (dStr === todayStr) className += ' today'; if (dStr === selectedStr) className += ' selected';
        const el = document.createElement('div'); el.className = className; el.innerText = i;
        el.onclick = () => {
          if (calendarMode === 'select') {
            tempAddDate = formatDate(new Date(year, month, i));
            document.getElementById('add-date-display').innerText = tempAddDate;
            document.getElementById('modal-calendar').classList.remove('active');
            calendarMode = 'navigate';
          } else {
            currentDate = new Date(year, month, i);
            document.getElementById('modal-calendar').classList.remove('active');
            exitBatchMode();
            loadTodos();
          }
        };
        grid.appendChild(el);
      }
    }

    function openMonthPicker() {
      calMode = 'month';
      const actionBtn = document.getElementById('cal-action-btn'); actionBtn.innerText = '返回'; actionBtn.onclick = renderCalendar;
      document.getElementById('cal-prev').innerText = '< 上年'; document.getElementById('cal-next').innerText = '下年 >';
      document.getElementById('cal-title').innerHTML = \`<span class="cal-title-btn" onclick="openYearPicker()">\${calDate.getFullYear()}年</span> <span class="cal-title-btn">选择月份</span>\`;
      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(4, 1fr)'; grid.innerHTML = '';
      for(let i=0; i<12; i++) {
        const el = document.createElement('div'); el.className = 'cal-date' + (calDate.getMonth() === i ? ' selected' : ''); el.innerText = (i+1) + '月';
        el.onclick = () => { calDate.setMonth(i); renderCalendar(); }; grid.appendChild(el);
      }
    }

    function openYearPicker(startYear) {
      calMode = 'year';
      if (!startYear) startYear = calDate.getFullYear() - 4; yearPickerStart = startYear;
      const actionBtn = document.getElementById('cal-action-btn'); actionBtn.innerText = '返回'; actionBtn.onclick = renderCalendar;
      document.getElementById('cal-prev').innerText = '< 上页'; document.getElementById('cal-next').innerText = '下页 >';
      document.getElementById('cal-title').innerHTML = \`<span class="cal-title-btn">选择年份</span> <span class="cal-title-btn" onclick="openMonthPicker()">\${calDate.getMonth() + 1}月</span>\`;
      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(4, 1fr)'; grid.innerHTML = '';
      for(let i=0; i<12; i++) {
        const y = startYear + i; const el = document.createElement('div');
        el.className = 'cal-date' + (calDate.getFullYear() === y ? ' selected' : ''); el.innerText = y;
        el.onclick = () => { calDate.setFullYear(y); renderCalendar(); }; grid.appendChild(el);
      }
    }

    function changeDate(offset) { exitBatchMode(); currentDate.setDate(currentDate.getDate() + offset); loadTodos(); }
    function jumpToToday() {
      if (calendarMode === 'select') {
        tempAddDate = formatDate(new Date());
        document.getElementById('add-date-display').innerText = tempAddDate;
        document.getElementById('modal-calendar').classList.remove('active');
        calendarMode = 'navigate';
      } else {
        exitBatchMode();
        currentDate = new Date();
        document.getElementById('modal-calendar').classList.remove('active');
        loadTodos();
      }
    }
    
    function closeCalendar() {
      document.getElementById('modal-calendar').classList.remove('active');
      calendarMode = 'navigate';
    }

    if (!CSS.supports || !CSS.supports('selector(:has(*))')) {
      new MutationObserver(function() {
        var locked = !!document.querySelector('.modal-overlay.active, .detail-overlay.active');
        document.body.style.overflow = locked ? 'hidden' : '';
        document.body.style.touchAction = locked ? 'none' : '';
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    
    async function bootstrap() {
      if (_previewRedirecting) return;
      await initSettings();
      initVersionDisplay();
      if (document.getElementById('login-view').classList.contains('hidden')) {
        loadTodos();
        checkInterruptedImport();
      }
    }
    bootstrap();

    async function resetScaleBrowserData() {
      var currentUA = navigator.userAgent || '';
      if (Array.isArray(appSettings.scaleByBrowser)) {
        for (var i = 0; i < appSettings.scaleByBrowser.length; i++) {
          if (appSettings.scaleByBrowser[i].ua === currentUA) {
            appSettings.scaleByBrowser[i].scale = 1.0;
            break;
          }
        }
      }
      tempAppScale = 1.0;
      var scaleSlider = document.getElementById('scale-slider');
      var scaleDisplay = document.getElementById('scale-value-display');
      var scalePreview = document.getElementById('scale-preview');
      if (scaleSlider) scaleSlider.value = 1.0;
      if (scaleDisplay) scaleDisplay.innerText = '100%';
      if (scalePreview) scalePreview.style.zoom = 1.0;
      updateScalePresetButtons();
      applyAppScale(1.0);
    
      await fetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(appSettings),
        headers: { 'Content-Type': 'application/json' }
      });
    }

    Object.assign(window, {
      // 登录
      login: login,
      logout: async function() {
        await fetch('/api/logout', { method: 'POST' });
        location.reload();
      },
      // 主题
      toggleTheme: toggleTheme,
      // 日期导航
      changeDate: changeDate,
      openCalendar: openCalendar,
      closeCalendar: closeCalendar,
      jumpToToday: jumpToToday,
      calChange: calChange,
      openYearPicker: openYearPicker,
      openMonthPicker: openMonthPicker,
      // 新建事项
      openAddModal: openAddModal,
      closeAddModal: closeAddModal,
      confirmAddTask: confirmAddTask,
      openCalendarForAdd: openCalendarForAdd,
      addTempSubtask: addTempSubtask,
      removeTempSubtask: removeTempSubtask,
      toggleAddSearch: toggleAddSearch,
      regenerateAddSearchTerms: regenerateAddSearchTerms,
      toggleTempSearchTerm: toggleTempSearchTerm,
      copyTempSearchTerm: copyTempSearchTerm,
      toggleProviderMenu: toggleProviderMenu,
      selectProvider: selectProvider,
      toggleRepeatMenu: toggleRepeatMenu,
      selectRepeat: selectRepeat,
      openTimePicker: openTimePicker,
      confirmTime: confirmTime,
      clearTime: clearTime,
      closeTimePicker: closeTimePicker,
      selectPriority: selectPriority,
      togglePriorityMenu: togglePriorityMenu,
      // 筛选/排序
      setFilterMethod: setFilterMethod,
      toggleFilterMenu: toggleFilterMenu,
      toggleSortMenu: toggleSortMenu,
      setSortMethod: setSortMethod,
      toggleSortOrder: toggleSortOrder,
      // 批量操作
      toggleBatchMode: toggleBatchMode,
      batchSelectAll: batchSelectAll,
      batchToggleDone: batchToggleDone,
      batchDelete: batchDelete,
      exitBatchMode: exitBatchMode,
      // 详情
      openDetail: openDetail,
      closeDetail: closeDetail,
      toggleEditMode: toggleEditMode,
      handleActionClick: handleActionClick,
      confirmAction: confirmAction,
      toggleSubtask: toggleSubtask,
      toggleSearchTerm: toggleSearchTerm,
      copySearchTerm: copySearchTerm,
      copyText: copyText,
      toggleEditSearch: toggleEditSearch,
      regenerateEditSearchTerms: regenerateEditSearchTerms,
      // 回收站
      openTrash: openTrash,
      closeTrash: closeTrash,
      actionTrash: actionTrash,
      clearTrash: clearTrash,
      toggleTrashBatchMode: toggleTrashBatchMode,
      exitTrashBatchMode: exitTrashBatchMode,
      batchTrashSelectAll: batchTrashSelectAll,
      batchTrashRestore: batchTrashRestore,
      batchTrashDelete: batchTrashDelete,
      toggleTrashBatchSelect: toggleTrashBatchSelect,
      // 统计
      openStats: openStats,
      closeStats: closeStats,
      switchStatsTab: switchStatsTab,
      loadAnnualReport: loadAnnualReport,
      // 设置
      openSettings: openSettings,
      closeSettings: closeSettings,
      saveAndCloseSettings: saveAndCloseSettings,
      toggleSettingPopover: toggleSettingPopover,
      selectSetting: selectSetting,
      toggleCustomCodeEnabled: toggleCustomCodeEnabled,
      previewCustomCode: previewCustomCode,
      resetCustomCode: resetCustomCode,
      restoreAllPreview: restoreAllPreview,
      // 数据管理
      exportData: exportData,
      importData: importData,
      factoryReset: factoryReset,
      deleteSessionByIndex: deleteSessionByIndex,
      deleteAllSessions: deleteAllSessions,
      onScaleSliderChange: onScaleSliderChange,
      setScalePreset: setScalePreset,
      resetScaleBrowserData: resetScaleBrowserData,
      checkUpdate: checkUpdate,
      compareVersions: compareVersions,
    });

  })();
  </script>
  <script>/*CUSTOM_CONTENT_PLACEHOLDER*/</script>
</body>
</html>
  `;

const safeForScriptTag = (s) => JSON.stringify(s || '').replace(/<\//g, '<\\/');

  html = html.replace(
    '<script>/*CUSTOM_HEADER_PLACEHOLDER*/</script>',
    customHeader || ''
  );
  html = html.replace(
    '<script>/*CUSTOM_GLOBALS_PLACEHOLDER*/</script>',
    `<script>window.__CUSTOM_HEADER__=${safeForScriptTag(customHeader)};window.__CUSTOM_CONTENT__=${safeForScriptTag(customContent)};</script>`
  );
  html = html.replace(
    '<script>/*CUSTOM_CONTENT_PLACEHOLDER*/</script>',
    customContent || ''
  );

  return html;
}
