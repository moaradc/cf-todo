/*
 * Cloudflare Worker + D1 Todo App - API Handler
 */

import {
  APP_VERSION,
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
import { RRule } from 'rrule';

let isDbInitialized = false;

const DAY_MAP = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];

function makeUTCDate(dateStr) {
  const p = dateStr.split('-');
  return new Date(Date.UTC(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2])));
}

function buildRRule(repeatType, anchorDate, repeatEnd, repeatCustom) {
  if (repeatCustom) {
    try {
      const opts = RRule.parseString(repeatCustom);
      if (anchorDate && !opts.dtstart) {
        opts.dtstart = makeUTCDate(anchorDate);
      }
      if (repeatEnd && !opts.until) {
        opts.until = new Date(makeUTCDate(repeatEnd).getTime() + 86399999);
      }
      return new RRule(opts);
    } catch(e) {}
  }
  if (!repeatType || repeatType === 'none' || !anchorDate) return null;
  const dtstart = makeUTCDate(anchorDate);
  const options = { dtstart, freq: RRule.DAILY };
  switch (repeatType) {
    case 'daily': options.freq = RRule.DAILY; break;
    case 'weekly':
      options.freq = RRule.WEEKLY;
      options.byweekday = [DAY_MAP[dtstart.getUTCDay()]];
      break;
    case 'monthly':
      options.freq = RRule.MONTHLY;
      options.bymonthday = [dtstart.getUTCDate()];
      break;
    case 'yearly':
      options.freq = RRule.YEARLY;
      options.bymonth = [dtstart.getUTCMonth() + 1];
      options.bymonthday = [dtstart.getUTCDate()];
      break;
    default: return null;
  }
  if (repeatEnd) {
    options.until = new Date(makeUTCDate(repeatEnd).getTime() + 86399999);
  }
  return new RRule(options);
}

function isOccurrenceOnDate(rule, dateStr) {
  if (!rule) return false;
  const target = makeUTCDate(dateStr);
  const prev = new Date(target.getTime() - 86400000);
  const next = rule.after(prev, false);
  if (!next) return false;
  return formatDateStr(next) === dateStr;
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
        let marker = null;
        try {
          marker = await env.DB.prepare("SELECT value FROM settings WHERE key = 'db_schema_version'").first();
        } catch (e) {}
        if (marker && marker.value === APP_VERSION) {
          isDbInitialized = true;
          return;
        }
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
              repeat_custom TEXT DEFAULT '',
              repeat_end TEXT DEFAULT '',
              end_time TEXT DEFAULT '',
              category_id TEXT DEFAULT ''
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
              blacklist TEXT DEFAULT '[]',
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
        try { await env.DB.prepare(`ALTER TABLE todo_templates ADD COLUMN blacklist TEXT DEFAULT '[]'`).run(); } catch (e) {}
        try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN category_id TEXT DEFAULT ''`).run(); } catch (e) {}
        try { await env.DB.prepare(`ALTER TABLE todo_templates ADD COLUMN category_id TEXT DEFAULT ''`).run(); } catch (e) {}
        
        // 自动迁移老版本
        try {
          const c = await env.DB.prepare("SELECT COUNT(*) as c FROM todo_templates").first();
          if (c && c.c === 0) {
            await env.DB.prepare(`
              INSERT OR IGNORE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, blacklist)
              SELECT parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, 
                CASE WHEN (repeat_type IS NULL OR repeat_type = 'none' OR repeat_type = '') THEN 'daily' ELSE repeat_type END,
                repeat_custom, '', '', date, '[]'
              FROM todos t1
              WHERE repeat = 1 AND deleted = 0 
              AND date = (SELECT MAX(date) FROM todos t2 WHERE t2.parent_id = t1.parent_id AND t2.repeat = 1 AND t2.deleted = 0)
            `).run();
          }
        } catch (e) {}

        await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('db_schema_version', ?)").bind(APP_VERSION).run();
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
        return apiError("UNAUTHORIZED", 401);
      }
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
      headers.append('Set-Cookie', `auth_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
      headers.append('Set-Cookie', `auth_sig=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (url.pathname === '/' && request.method === 'GET') {
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

      const buildTodoStmts = (items) => (items || []).map((t, idx) => {
        const label = t.text && t.id ? `${t.text} (id:${t.id})` : (t.text || t.id || `第 ${idx + 1} 条`);
        if (!t.id) throw new Error(`事项 "${label}" 缺少必填字段 id`);
        if (!t.parent_id) throw new Error(`事项 "${label}" 缺少必填字段 parent_id`);
        if (!t.date) throw new Error(`事项 "${label}" 缺少必填字段 date`);
        if (!t.text) throw new Error(`事项 id:${t.id} 缺少必填字段 text`);
        return env.DB.prepare(
          `INSERT OR REPLACE INTO todos
          (id, parent_id, date, text, time, priority, repeat, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          t.id, t.parent_id, t.date, t.text, t.time || '', t.priority || 'low',
          t.repeat !== undefined ? t.repeat : ((t.repeat_type && t.repeat_type !== 'none') ? 1 : 0),
          t.desc || '', t.url || '', t.copy_text || '',
          safeStringify(t.subtasks), safeStringify(t.search_terms), t.done || 0, t.deleted || 0,
          t.repeat_type || 'none', t.repeat_custom || '', t.repeat_end || '', t.end_time || '', t.category_id || ''
        );
      });

      const buildTemplateStmts = (items) => (items || []).map((t, idx) => {
        const label = t.text || t.parent_id || `第 ${idx + 1} 条`;
        if (!t.parent_id) throw new Error(`模板 "${label}" 缺少必填字段 parent_id`);
        return env.DB.prepare(
          `INSERT OR REPLACE INTO todo_templates
          (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, blacklist, category_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          t.parent_id, t.text || '', t.time || '', t.priority || 'low', t.desc || '', t.url || '', t.copy_text || '',
          safeStringify(t.subtasks), safeStringify(t.search_terms), t.repeat_type || 'none', t.repeat_custom || '', t.repeat_end || '', t.end_time || '', t.anchor_date || '', t.blacklist || '[]', t.category_id || ''
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
            env.DB.prepare('DROP TABLE IF EXISTS categories_backup'),
          ]);
        } catch (e) { console.error("Failed to drop backup tables:", e); }
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
          if (!importId) return apiError('importId required', 400);

          const session = await env.DB.prepare('SELECT * FROM import_sessions WHERE id = ?').bind(importId).first();
          if (!session) return apiError('会话不存在', 400);

          if (session.mode === 'overwrite') {
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

          await env.DB.prepare('DELETE FROM import_sessions WHERE id = ?').bind(importId).run();
          return new Response(JSON.stringify({ success: true, recovered: session.mode === 'overwrite' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (phase === 'init') {
          const importId = body.importId;
          const mode = body.mode || 'merge';
          if (!importId) return apiError('importId required', 400);

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
                    repeat INTEGER NOT NULL DEFAULT 0,
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
                    category_id TEXT DEFAULT ''
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
                    blacklist TEXT DEFAULT '[]',
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
            await clearBackupTables();
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
        const t = await env.DB.prepare('SELECT parent_id, date, repeat, repeat_type, repeat_end FROM todos WHERE id = ?').bind(id).first();
        await env.DB.prepare('UPDATE todos SET deleted = 0 WHERE id = ?').bind(id).run();
        if (t && t.repeat !== 0 && t.parent_id) {
          if (t.repeat === -1 && t.repeat_type && t.repeat_type !== 'none') {
            // 恢复被终止的系列项：重新激活重复
            await env.DB.prepare('UPDATE todos SET repeat=1, repeat_end=\'\' WHERE id=?').bind(id).run();
          }
          const tpl = await env.DB.prepare('SELECT blacklist FROM todo_templates WHERE parent_id = ?').bind(t.parent_id).first();
          if (tpl && tpl.blacklist) {
            let bl =[]; try { bl = JSON.parse(tpl.blacklist); } catch(e){}
            if (bl.includes(t.date)) {
              bl = bl.filter(d => d !== t.date);
              await env.DB.prepare('UPDATE todo_templates SET blacklist = ? WHERE parent_id = ?').bind(JSON.stringify(bl), t.parent_id).run();
            }
          } else if (!tpl && t.repeat_type && t.repeat_type !== 'none') {
            // 模板不存在时重建（删除scope=future/all时模板被删了）
            const task = await env.DB.prepare('SELECT text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, end_time, category_id FROM todos WHERE id=?').bind(id).first();
            if (task) {
              await env.DB.prepare(
                'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, blacklist, category_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
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
          const tasks = await env.DB.prepare(`SELECT id, parent_id, date, repeat, repeat_type, repeat_end FROM todos WHERE id IN (${placeholders})`).bind(...ids).all();
          await env.DB.prepare(`UPDATE todos SET deleted = 0 WHERE id IN (${placeholders})`).bind(...ids).run();
          // 恢复被终止的系列项
          const reviveIds = tasks.results.filter(t => t.repeat === -1 && t.repeat_type && t.repeat_type !== 'none').map(t => t.id);
          if (reviveIds.length > 0) {
            const ph = reviveIds.map(() => '?').join(',');
            await env.DB.prepare(`UPDATE todos SET repeat=1, repeat_end='' WHERE id IN (${ph})`).bind(...reviveIds).run();
          }
          const blUpdates = {};
          for (const t of tasks.results) {
            if (t.repeat !== 0 && t.parent_id) {
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
            } else if (!tpl) {
              // 模板不存在时从第一个有效任务重建
              const firstTask = tasks.results.find(t => t.parent_id === pid && t.repeat_type && t.repeat_type !== 'none');
              if (firstTask) {
                const task = await env.DB.prepare('SELECT text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, end_time, category_id FROM todos WHERE id=?').bind(firstTask.id).first();
                if (task) {
                  await env.DB.prepare(
                    'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, blacklist, category_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
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
    
      // 使用 rrule.js 计算重复事件，替代纯 SQL 匹配
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
          let parsedBlacklist = [];
          try { if (tpl.blacklist) parsedBlacklist = JSON.parse(tpl.blacklist); } catch(e){}
          if (parsedBlacklist.includes(date)) continue;
    
          // 使用 rrule.js 判断此模板是否在目标日期生成实例
          const rule = buildRRule(tpl.repeat_type, tpl.anchor_date, tpl.repeat_end, tpl.repeat_custom);
          if (!isOccurrenceOnDate(rule, date)) continue;
    
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
          'INSERT INTO todos (id, parent_id, date, text, time, priority, repeat, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          newId, tpl.parent_id, date, tpl.text, tpl.time || '', tpl.priority || 'low', 1, 
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
        if (row.repeat === 1 && rType === 'none') rType = 'daily';

        return {
          ...row, 
          parentId: row.parent_id, 
          repeat: row.repeat === 1,
          repeat_type: rType,
          repeat_custom: row.repeat_custom || '',
          repeat_end: row.repeat_end || '',
          end_time: row.end_time || '',
          isSeries: row.repeat !== 0,
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
          const categoryId = task.category_id || '';
          const repeatEnd = task.repeat_end || '';
          const endTime = task.end_time || '';
          await env.DB.prepare(
            'INSERT INTO todos (id, parent_id, date, text, time, priority, repeat, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            task.id, task.parentId || task.id, date, task.text, task.time || '', task.priority || 'low', 
            rpt, task.desc || '', task.url || '', task.copyText || '', JSON.stringify(task.subtasks||[]), JSON.stringify(task.search_terms||[]), 
            0, 0, rptType, '', repeatEnd, endTime, categoryId
          ).run();
          
          if (rpt) {
              await env.DB.prepare(
                'INSERT INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, blacklist, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(
                task.parentId || task.id, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', 
                JSON.stringify(task.subtasks||[]), JSON.stringify(task.search_terms||[]), rptType, '', repeatEnd, endTime, date, '[]', categoryId
              ).run();
          }
        }
        else if (action === 'UPDATE') {
          const rptType = task.repeat_type || 'none';
          const rpt = rptType !== 'none' ? 1 : 0;
          const subtasksStr = JSON.stringify(task.subtasks ||[]);
          const searchTermsStr = JSON.stringify(task.search_terms ||[]);
          const categoryId = task.category_id || '';
          const repeatEnd = task.repeat_end || '';
          const endTime = task.end_time || '';
        
          if (scope === 'single') {
            // 脱离重复模板，变为单次任务
            const isSeriesTask = task.isSeries || (task.parentId && task.parentId !== task.id);
            await env.DB.prepare(
              'UPDATE todos SET parent_id=?, text=?, time=?, priority=?, repeat=0, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', end_time=?, category_id=? WHERE id=?'
            ).bind(task.id, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, endTime, categoryId, task.id).run();
            // 将当前日期加入模板黑名单，防止模板重新生成此实例
            if (isSeriesTask && task.parentId) {
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
            // 此项及以后：更新内容（忽略时间），过去项加 repeat_end
            if (rptType !== 'none') {
              await env.DB.prepare(
                'UPDATE todos SET text=?, priority=?, repeat=1, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, category_id=? WHERE parent_id=? AND date >= ?'
              ).bind(task.text, task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, rptType, '', repeatEnd, categoryId, task.parentId, date).run();
            } else {
              // 改为不重复：当前项变单次任务，未来项真删除
              await env.DB.prepare(
                'UPDATE todos SET text=?, priority=?, repeat=0, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', category_id=? WHERE id=?'
              ).bind(task.text, task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, categoryId, task.id).run();
              await env.DB.prepare(
                'DELETE FROM todos WHERE parent_id=? AND date > ?'
              ).bind(task.parentId, date).run();
            }
            // 过去项：保留 repeat_type，设置 repeat_end=当前日期 和 repeat=-1
            await env.DB.prepare(
              'UPDATE todos SET repeat=-1, repeat_end=? WHERE parent_id=? AND date < ? AND repeat_type != \'none\''
            ).bind(date, task.parentId, date).run();
          } else if (scope === 'future_repeat') {
            // 以后：更新内容（忽略时间），当前及过去项加 repeat_end
            if (rptType !== 'none') {
              await env.DB.prepare(
                'UPDATE todos SET text=?, priority=?, repeat=1, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, category_id=? WHERE parent_id=? AND date > ?'
              ).bind(task.text, task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, rptType, '', repeatEnd, categoryId, task.parentId, date).run();
            } else {
              // 改为不重复：未来项真删除
              await env.DB.prepare(
                'DELETE FROM todos WHERE parent_id=? AND date > ?'
              ).bind(task.parentId, date).run();
            }
            // 当前及过去项：保留 repeat_type，设置 repeat_end=当前日期 和 repeat=-1
            await env.DB.prepare(
              'UPDATE todos SET repeat=-1, repeat_end=? WHERE parent_id=? AND date <= ? AND repeat_type != \'none\''
            ).bind(date, task.parentId, date).run();
          } else if (scope === 'all') {
            // 所有：更新内容（忽略时间）
            if (rptType !== 'none') {
              await env.DB.prepare(
                'UPDATE todos SET text=?, priority=?, repeat=1, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, category_id=? WHERE parent_id=?'
              ).bind(task.text, task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, rptType, '', repeatEnd, categoryId, task.parentId).run();
            } else {
              // 改为不重复：当前项变单次任务，未来项删除
              await env.DB.prepare(
                'UPDATE todos SET text=?, priority=?, repeat=0, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', category_id=? WHERE id=?'
              ).bind(task.text, task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, categoryId, task.id).run();
              await env.DB.prepare(
                'DELETE FROM todos WHERE parent_id=? AND date > ?'
              ).bind(task.parentId, date).run();
              // 过去项：保留 repeat_type，设置 repeat_end=当前日期 和 repeat=-1
              await env.DB.prepare(
                'UPDATE todos SET repeat=-1, repeat_end=? WHERE parent_id=? AND date < ? AND repeat_type != \'none\''
              ).bind(date, task.parentId, date).run();
            }
          } else {
            // 非重复任务的普通更新
            await env.DB.prepare(
              'UPDATE todos SET text=?, time=?, priority=?, repeat=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?'
            ).bind(task.text, task.time || '', task.priority || 'low', rpt, task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, categoryId, task.id).run();
          }
        
          if (scope === 'future' || scope === 'all' || scope === 'future_repeat') {
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
                    'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, blacklist, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                  ).bind(
                    task.parentId, task.text, task.time || '', task.priority || 'low', task.desc || '', task.url || '', task.copyText || '', 
                    subtasksStr, searchTermsStr, rptType, '', repeatEnd, endTime, date, existingBlacklist, categoryId
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
            // 过去项：保留 repeat_type，设置 repeat_end=当前日期 和 repeat=-1
            await env.DB.prepare('UPDATE todos SET repeat=-1, repeat_end=? WHERE parent_id=? AND date < ? AND repeat_type != \'none\'').bind(date, task.parentId, date).run();
            await env.DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(task.parentId).run();
          } else if (scope === 'future_repeat') {
            await env.DB.prepare('UPDATE todos SET deleted = 1 WHERE parent_id=? AND date > ?').bind(task.parentId, date).run();
            // 当前及过去项：保留 repeat_type，设置 repeat_end 和 repeat=-1
            await env.DB.prepare('UPDATE todos SET repeat=-1, repeat_end=? WHERE parent_id=? AND date <= ? AND repeat_type != \'none\'').bind(date, task.parentId, date).run();
            await env.DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(task.parentId).run();
          } else if (scope === 'all') {
            await env.DB.prepare('UPDATE todos SET deleted = 1 WHERE parent_id=?').bind(task.parentId).run();
            await env.DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(task.parentId).run();
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
