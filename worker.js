/*
 * Cloudflare Worker + D1 Todo App (v2.6.0-beta3: Import Mode, Stream Export, Cloud Settings)
 * Features: Filter, Trash Bin, Smart Sorting, Security Lockout, Batch Manage, Sub-tasks, Server-Side Multi-Source Search, Selectable Search Provider, Settings & Data Backup
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

function cryptoTimingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < aBuf.length; i++) {
    result |= aBuf[i] ^ bBuf[i];
  }
  return result === 0;
}

async function fetchHotSearchData(providerName = 'auto') {
  const fetchers = {
    'bilibili': async () => { 
      const res = await fetch('https://api.bilibili.com/x/web-interface/search/square?limit=50', { headers: {'User-Agent': 'Mozilla/5.0'} });
      const json = await res.json();
      return json?.data?.trending?.list?.map(i => i?.keyword).filter(Boolean) ||[];
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
      const res = await fetch('https://top.baidu.com/api/board?platform=pc&tab=realtime', { headers: {'User-Agent': 'Mozilla/5.0'} });
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
      if (!cookies.auth_token || !cookies.auth_sig) return false;
      return await verify(cookies.auth_token, cookies.auth_sig, env.JWT_SECRET);
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
              deleted INTEGER NOT NULL DEFAULT 0
            )
          `),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_date ON todos(date)`),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_parent_id ON todos(parent_id)`),
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
          `)
        ]);
        
        try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN copy_text TEXT`).run(); } catch (e) {}
        try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN subtasks TEXT`).run(); } catch (e) {}
        try { await env.DB.prepare(`ALTER TABLE todos ADD COLUMN search_terms TEXT`).run(); } catch (e) {}
        
        isDbInitialized = true;
      } catch (e) {
        console.error("DB Init error:", e);
      }
    };

    if (url.pathname === '/api/login' && request.method === 'POST') {
      await initDb();
      const now = Date.now();
      
      const attemptRecord = await env.DB.prepare('SELECT * FROM login_attempts WHERE ip = ?').bind(clientIp).first();
      if (attemptRecord && attemptRecord.lock_until > now) {
        return new Response(JSON.stringify({ error: "ACCOUNT LOCKED" }), { status: 429 });
      }

      const { password } = await request.json();
      const isAdmin = cryptoTimingSafeEqual(password, env.ADMIN_PASSWORD);

      if (isAdmin) {
        if (attemptRecord) {
          await env.DB.prepare('UPDATE login_attempts SET attempts = 0, lock_until = 0 WHERE ip = ?').bind(clientIp).run();
        }
        const token = "admin_session";
        const sig = await sign(token, env.JWT_SECRET);
        const headers = new Headers();
        headers.append('Set-Cookie', `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
        headers.append('Set-Cookie', `auth_sig=${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
        return new Response(JSON.stringify({ success: true }), { headers });
      } else {
        const newAttempts = (attemptRecord ? attemptRecord.attempts : 0) + 1;
        const lockUntil = newAttempts >= 5 ? now + (15 * 60 * 1000) : 0; 
        await env.DB.prepare(`
          INSERT INTO login_attempts (ip, attempts, lock_until) VALUES (?, ?, ?) 
          ON CONFLICT(ip) DO UPDATE SET attempts = excluded.attempts, lock_until = excluded.lock_until
        `).bind(clientIp, newAttempts, lockUntil).run();
        
        return new Response(JSON.stringify({ error: "ACCESS DENIED" }), { status: 401 });
      }
    }

    if (url.pathname === '/' && request.method === 'GET') {
      const authorized = await isAuthorized();
      if (authorized) await initDb();
      return new Response(renderHTML(authorized), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    if (!(await isAuthorized())) {
      return new Response("UNAUTHORIZED PROTOCOL", { status: 401 });
    }

    await initDb();

    if (url.pathname === '/api/hot-search' && request.method === 'GET') {
      const provider = url.searchParams.get('provider') || 'auto';
      const allWords = await fetchHotSearchData(provider);
      return new Response(JSON.stringify({ success: true, data: allWords }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/export' && request.method === 'GET') {
      const incTodos = url.searchParams.get('todos') === 'true';
      const incTrash = url.searchParams.get('trash') === 'true';
      const incSettings = url.searchParams.get('settings') === 'true';

      let condition = "1=0";
      if (incTodos && incTrash) condition = "1=1";
      else if (incTodos) condition = "deleted = 0";
      else if (incTrash) condition = "deleted = 1";

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('{\n"settings": '));
          
          if (incSettings) {
            const record = await env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
            controller.enqueue(encoder.encode(record && record.value ? record.value : '{}'));
          } else {
            controller.enqueue(encoder.encode('{}'));
          }
          
          controller.enqueue(encoder.encode(',\n"todos":[\n'));
          
          const countRow = await env.DB.prepare(`SELECT COUNT(*) as total FROM todos WHERE ${condition}`).first();
          const total = countRow ? (countRow.total || 0) : 0;
          const limit = 1000;
          let isFirstRow = true;
          
          for (let offset = 0; offset < total; offset += limit) {
            const { results } = await env.DB.prepare(`SELECT * FROM todos WHERE ${condition} LIMIT ? OFFSET ?`).bind(limit, offset).all();
            for (const row of results) {
              if (!isFirstRow) {
                controller.enqueue(encoder.encode(',\n'));
              }
              controller.enqueue(encoder.encode(JSON.stringify(row)));
              isFirstRow = false;
            }
          }
          
          controller.enqueue(encoder.encode('\n]\n}'));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="moara_todo_export_${Date.now()}.json"`
        }
      });
    }

    if (url.pathname === '/api/import' && request.method === 'POST') {
      const { todos, mode } = await request.json();
      
      if (mode === 'overwrite') {
        await env.DB.prepare('DELETE FROM todos').run();
      }

      if (todos && todos.length > 0) {
        const stmts = todos.map(t => {
          return env.DB.prepare(
            `INSERT OR REPLACE INTO todos 
            (id, parent_id, date, text, time, priority, repeat, desc, url, copy_text, subtasks, search_terms, done, deleted) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            t.id, t.parent_id || t.id, t.date, t.text, t.time || '', t.priority || 'low', 
            t.repeat || 0, t.desc || '', t.url || '', t.copy_text || '', 
            t.subtasks || '[]', t.search_terms || '[]', t.done || 0, t.deleted || 0
          );
        });
        for (let i = 0; i < stmts.length; i += 100) {
          await env.DB.batch(stmts.slice(i, i + 100));
        }
      }
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
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
        await env.DB.prepare('UPDATE todos SET deleted = 0 WHERE id = ?').bind(id).run();
      } else if (action === 'DELETE_PERMANENT') {
        await env.DB.prepare('DELETE FROM todos WHERE id = ?').bind(id).run();
      } else if (action === 'CLEAR_ALL') {
        await env.DB.prepare('DELETE FROM todos WHERE deleted = 1').run();
      } else if (action === 'BATCH_RESTORE') {
        if (ids && ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          await env.DB.prepare(`UPDATE todos SET deleted = 0 WHERE id IN (${placeholders})`).bind(...ids).run();
        }
      } else if (action === 'BATCH_DELETE_PERMANENT') {
        if (ids && ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          await env.DB.prepare(`DELETE FROM todos WHERE id IN (${placeholders})`).bind(...ids).run();
        }
      } else if (action === 'CLEAR_ALL_DATA') {
        await env.DB.prepare('DELETE FROM todos').run();
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
      
      const queryMissing = `
        SELECT t1.* 
        FROM todos t1
        INNER JOIN (
          SELECT parent_id, MAX(date) as max_date
          FROM todos
          WHERE repeat = 1 AND deleted = 0 AND date < ?
          GROUP BY parent_id
        ) t2 ON t1.parent_id = t2.parent_id AND t1.date = t2.max_date
        WHERE NOT EXISTS (
          SELECT 1 FROM todos t3 WHERE t3.parent_id = t1.parent_id AND t3.date = ?
        )
      `;
      const missingRecords = await env.DB.prepare(queryMissing).bind(date, date).all();
      
      let newlyFetchedSearchTerms = null;

      if (missingRecords.results.length > 0) {
        const insertStmts =[];
        
        for (const prev of missingRecords.results) {
          const newId = Date.now().toString() + Math.random().toString().slice(2, 6);
          
          let parsedSubtasks =[];
          if (prev.subtasks) {
            try {
              parsedSubtasks = JSON.parse(prev.subtasks);
              parsedSubtasks.forEach(st => st.done = false); 
            } catch(e) {}
          }

          let parsedSearchTerms =[];
          if (prev.search_terms) {
            try {
              const oldTerms = JSON.parse(prev.search_terms);
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

          const newRecord = { ...prev, id: newId, date: date, done: 0, deleted: 0, repeat: 1, subtasks: JSON.stringify(parsedSubtasks), search_terms: JSON.stringify(parsedSearchTerms) };
          results.push(newRecord); 
          
          insertStmts.push(env.DB.prepare(
            'INSERT INTO todos (id, parent_id, date, text, time, priority, repeat, desc, url, copy_text, subtasks, search_terms, done, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            newId, prev.parent_id, date, prev.text, prev.time || '', prev.priority || 'low', 1, prev.desc || '', prev.url || '', prev.copy_text || '', JSON.stringify(parsedSubtasks), JSON.stringify(parsedSearchTerms), 0, 0  
          ));
        }
        await env.DB.batch(insertStmts);
      }
    
      const formatted = results.map(row => {
        let parsedSubtasks =[];
        let parsedSearchTerms =[];
        try { if (row.subtasks) parsedSubtasks = JSON.parse(row.subtasks); } catch(e){}
        try { if (row.search_terms) parsedSearchTerms = JSON.parse(row.search_terms); } catch(e){}
        
        parsedSearchTerms = parsedSearchTerms.map(w => {
            if (typeof w === 'string' && w.trim()) return { text: w, done: false };
            if (w && typeof w === 'object' && w.text) return w;
            return null;
        }).filter(Boolean);

        return {
          ...row, 
          parentId: row.parent_id, 
          repeat: row.repeat === 1,
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
            await env.DB.prepare(`UPDATE todos SET deleted = 1 WHERE id IN (${placeholders})`)
              .bind(...ids).run();
          }
        }
        else if (action === 'CREATE') {
          await env.DB.prepare(
            'INSERT INTO todos (id, parent_id, date, text, time, priority, repeat, desc, url, copy_text, subtasks, search_terms, done, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            task.id, task.parentId || task.id, date, task.text, task.time || '', task.priority || 'low', task.repeat ? 1 : 0, task.desc || '', task.url || '', task.copyText || '', JSON.stringify(task.subtasks||[]), JSON.stringify(task.search_terms||[]), 0, 0
          ).run();
        }
        else if (action === 'UPDATE') {
          const rpt = task.repeat ? 1 : 0;
          const subtasksStr = JSON.stringify(task.subtasks ||[]);
          const searchTermsStr = JSON.stringify(task.search_terms ||[]);

          if (scope === 'single' || !task.repeat) {
            await env.DB.prepare(
              'UPDATE todos SET text=?, time=?, priority=?, repeat=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=? WHERE id=?'
            ).bind(task.text, task.time || '', task.priority || 'low', rpt, task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, task.id).run();
          } else if (scope === 'future') {
            await env.DB.prepare(
              'UPDATE todos SET text=?, time=?, priority=?, repeat=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=? WHERE parent_id=? AND date >= ?'
            ).bind(task.text, task.time || '', task.priority || 'low', rpt, task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, task.parentId, date).run();
          } else if (scope === 'all') {
            await env.DB.prepare(
              'UPDATE todos SET text=?, time=?, priority=?, repeat=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=? WHERE parent_id=?'
            ).bind(task.text, task.time || '', task.priority || 'low', rpt, task.desc || '', task.url || '', task.copyText || '', subtasksStr, searchTermsStr, task.parentId).run();
          }
        } 
        else if (action === 'DELETE') {
          if (scope === 'single' || (!task.repeat && !task.isSeries)) {
            await env.DB.prepare('UPDATE todos SET deleted = 1 WHERE id = ?').bind(task.id).run();
          } else if (scope === 'future') {
            await env.DB.prepare('UPDATE todos SET deleted = 1 WHERE parent_id=? AND date >= ?').bind(task.parentId, date).run();
            await env.DB.prepare('UPDATE todos SET repeat = -1 WHERE parent_id=? AND date < ?').bind(task.parentId, date).run();
          } else if (scope === 'all') {
            await env.DB.prepare('UPDATE todos SET deleted = 1 WHERE parent_id=?').bind(task.parentId).run();
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    return new Response("NOT FOUND", { status: 404 });
  },
};

// 前端页面
function renderHTML(isAuthorized) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>MOARA 待办事项</title>
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
    }

    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    
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
    }

    .scanlines {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(to bottom, rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%);
      background-size: 100% 2px;
      pointer-events: none;
      z-index: 999;
    }
    
    .container { width: 100%; max-width: 600px; padding: 15px; position: relative; z-index: 1; }

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
    .date-display .sub { font-size: 0.7rem; color: #666; display: block; }

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
    .item-info { font-size: 0.75rem; color: #666; margin-top: 4px; display: flex; gap: 10px; align-items: center; }
    
    .badge { padding: 1px 4px; border-radius: 2px; font-size: 0.7rem; color: #000; font-weight: bold; }
    .badge-high { background: var(--accent); }
    .badge-med { background: var(--warn); }
    .badge-low { background: #888; }
    .badge-time { background: #333; color: var(--crt); border: 1px solid #444; }

    .btn-link {
      background: #222; border: 1px solid #444; color: var(--crt);
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      margin-left: 10px; font-size: 0.9rem; text-decoration: none; cursor: pointer;
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

    /* 设置页扩展卡片样式 */
    .settings-card { margin-bottom: 20px; background: var(--panel); padding: 15px; border: 1px dashed var(--fg); border-radius: 4px; }
    .settings-card.danger { border: 1px solid var(--accent); }
    .settings-text { font-size: 0.85rem; line-height: 1.6; color: #888; margin-bottom: 0; }
    .settings-text strong { color: var(--crt); }
    
    /* Markdown 渲染样式 */
    .md-code { background: #222; padding: 2px 4px; border-radius: 2px; color: var(--crt); font-family: var(--font-main); }
    .md-ul { padding-left: 20px; margin: 5px 0; }
    del { opacity: 0.6; }

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
    }[data-theme="light"] .btn-primary { background: #CE2424; color: #FEFEFE; }[data-theme="light"] .btn-primary:active { background: #1B1915; color: #CE2424; }[data-theme="light"] .btn-danger { background: #F0F0F0; color: #CE2424; border-color: #CE2424; }[data-theme="light"] .btn-ghost { background: transparent; border: 2px dashed #E5E5E5; box-shadow: none; color: #1B1915; }[data-theme="light"] input,[data-theme="light"] textarea,[data-theme="light"] select,[data-theme="light"] .fake-input {
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
  </style>
</head>
<body>
  <div class="scanlines"></div>

  <div class="container">
    <div class="top-actions-left">
      <button class="theme-toggle-btn" onclick="openTrash()">回收站</button>
    </div>
    <div class="top-actions">
      <button class="theme-toggle-btn" onclick="openSettings()">设置</button>
      <button id="theme-toggle-btn" class="theme-toggle-btn" onclick="toggleTheme()">自动</button>
    </div>
    <h1>待办事项</h1>

    <div id="login-view" class="${isAuthorized ? 'hidden' : ''}">
      <div style="border: 1px solid var(--accent); padding: 20px; text-align: center;">
        <p style="color:var(--accent); margin-bottom:15px;">[ 身份验证请求 ]</p>
        <input type="password" id="password-input" placeholder="输入密钥...">
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

  <!-- 新建事项模态框 -->
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
      <div class="switch-label" onclick="toggleAddRepeat()">
        <div class="switch-box" id="add-repeat-box"></div>
        <span>每天 (Daily Reset)</span>
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

  <!-- 回收站视图 -->
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

  <!-- 设置页面视图 -->
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
      </div>

      <div class="detail-label">数据管理 (导入/导出 JSON)</div>
      <div class="settings-card">
          <div class="settings-text" style="margin-bottom: 10px;">即将导出的内容包括：</div>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer;">
            <input type="checkbox" id="export-todos" checked style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">活动与历史待办事项</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer;">
            <input type="checkbox" id="export-trash" checked style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">回收站中的数据</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:15px; cursor:pointer;">
            <input type="checkbox" id="export-settings" checked style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">系统偏好设置</span>
          </label>
          <div class="row">
              <button class="flex-1" onclick="exportData()">导出数据</button>
              <button class="flex-1" onclick="document.getElementById('import-file').click()">导入/恢复</button>
              <input type="file" id="import-file" style="display:none" accept=".json" onchange="importData(event)">
          </div>
      </div>

      <div class="detail-label">关于 MOARA 待办事项</div>
      <div class="settings-card">
          <p class="settings-text" style="margin-bottom: 5px;"><strong>当前版本:</strong> v2.6.0-beta3</p>
          <p class="settings-text" style="margin-bottom: 5px;"><strong>底层架构:</strong> Cloudflare Worker + D1 Database</p>
          <p class="settings-text"><strong>项目描述:</strong> 普通的待办事项管理</p>
      </div>

      <div class="detail-label" style="color: var(--accent);">危险区域</div>
      <div class="settings-card danger">
          <p class="settings-text" style="margin-bottom: 15px;">执行此操作将不可逆转地清空所有的系统记录、回收站数据并重置偏好设置。建议提前导出备份。</p>
          <button class="btn-danger" style="width:100%" onclick="factoryReset()">恢复出厂设置 (清空所有数据)</button>
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

  <div id="modal-calendar" class="modal-overlay" onclick="if(event.target===this) document.getElementById('modal-calendar').classList.remove('active')">
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

  <script>
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

    // 简单的Markdown解析器 支持加粗 (**text**)、斜体 (*text*)、删除线 (~~text~~)
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
    let addRepeatState = false;
    
    let tempSubtasks =[];
    let tempSearchTerms =[];
    let addSearchState = false;
    let tempSearchProvider = 'auto';

    let tempPriority = 'low'; 
    let tempTime = ''; 
    let activeMode = ''; 
    let calDate = new Date(); 
    let calMode = 'date'; 
    let yearPickerStart = new Date().getFullYear() - 4;

    let isBatchMode = false;
    let selectedTasks = new Set();
    
    // 回收站状态
    let trashTodos =[];
    let isTrashBatchMode = false;
    let selectedTrashTasks = new Set();

    // 偏好设置管理
    let sortMethod = 'time'; 
    let sortAsc = true; 
    let appSettings = {};
    // 设置页面暂存状态
    let tempSetProvider = 'auto';
    let tempSetSort = 'time';
    let tempSetSortAsc = true;

    async function initSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const saved = await res.json();
          appSettings = {
            provider: saved.provider || 'auto',
            sortMethod: saved.sortMethod || 'time',
            sortAsc: saved.sortAsc !== undefined ? (saved.sortAsc === 'true' || saved.sortAsc === true) : true
          };
        } else {
          throw new Error('Failed to load DB settings');
        }
      } catch (e) {
        appSettings = { provider: 'auto', sortMethod: 'time', sortAsc: true };
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
      const list = document.getElementById('todo-list');
      list.innerHTML = '';
      
      let filteredTodos = todos;
      if (filterMethod === 'todo') filteredTodos = todos.filter(t => !t.done);
      else if (filterMethod === 'done') filteredTodos = todos.filter(t => t.done);

      if (filteredTodos.length === 0) {
        list.innerHTML = '<div style="padding:40px;text-align:center;border:1px dashed #666;">无数据 // NULL</div>';
        return;
      }

      filteredTodos.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        let valA, valB;
        if (sortMethod === 'time') { valA = a.time || '24:00'; valB = b.time || '24:00'; } 
        else { const pMap = { high: 3, med: 2, low: 1 }; valA = pMap[a.priority] || 1; valB = pMap[b.priority] || 1; }
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });

      filteredTodos.forEach((todo) => {
        const index = todos.indexOf(todo);
        const el = document.createElement('div');
        el.className = \`todo-item \${todo.done ? 'done' : ''}\`;
        
        let badges = '';
        if (todo.priority === 'high') badges += '<span class="badge badge-high">高</span> ';
        if (todo.priority === 'med') badges += '<span class="badge badge-med">中</span> ';
        if (todo.time) badges += \`<span class="badge badge-time">\${todo.time}</span> \`;

        if (todo.subtasks && todo.subtasks.length > 0) {
          const completed = todo.subtasks.filter(st => st.done).length;
          badges += \`<span class="badge" style="background:transparent;border:1px solid var(--fg);color:var(--fg);">\${completed}/\${todo.subtasks.length}</span> \`;
        }

        let linkBtn = '';
        if (todo.url) linkBtn = \`<a href="\${todo.url}" target="_blank" class="btn-link" onclick="event.stopPropagation()">↗</a>\`;
        
        let copyBtn = '';
        if (todo.copy_text) {
          const safeText = encodeURIComponent(todo.copy_text).replace(/'/g, "%27");
          copyBtn = \`<button class="btn-link" onclick="event.stopPropagation(); copyText(decodeURIComponent('\${safeText}'))">⎘</button>\`;
        }

        let checkboxHtml = '';
        if (isBatchMode) {
          const isSelected = selectedTasks.has(index);
          checkboxHtml = \`<div class="checkbox \${isSelected ? 'batch-selected' : ''}" onclick="event.stopPropagation(); toggleBatchSelect(\${index})"></div>\`;
        } else {
          checkboxHtml = \`<div class="checkbox" onclick="event.stopPropagation(); toggleDone(\${index})"></div>\`;
        }
        
        let actionsHtml = isBatchMode ? '' : \`\${copyBtn}\${linkBtn}\`;

        el.innerHTML = \`
          \${checkboxHtml}
          <div class="item-meta">
            <div class="item-title">\${todo.text}</div>
            <div class="item-info">\${badges}</div>
          </div>
          \${actionsHtml}
        \`;

        el.onclick = () => {
          if (isBatchMode) toggleBatchSelect(index);
          else openDetail(index);
        };
        list.appendChild(el);
      });
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

    // --- 设置与导入导出相关逻辑 ---
    function openSettings() {
      tempSetProvider = appSettings.provider || 'auto';
      tempSetSort = appSettings.sortMethod || 'time';
      tempSetSortAsc = appSettings.sortAsc !== undefined ? appSettings.sortAsc : true;

      const pMap = {'auto':'自动 (随机源)', 'bilibili':'哔哩哔哩', 'weibo':'微博热搜', 'zhihu':'知乎热榜', 'baidu':'百度热搜'};
      const sMap = {'time':'按时间', 'priority':'按优先级'};
      
      document.getElementById('set-disp-provider').innerText = pMap[tempSetProvider] || pMap['auto'];
      document.getElementById('set-disp-sort').innerText = sMap[tempSetSort] || sMap['time'];
      document.getElementById('set-disp-sort-asc').innerText = tempSetSortAsc ? '正序' : '倒序';

      const view = document.getElementById('settings-overlay');
      view.classList.remove('closing');
      view.classList.add('active');
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

      await fetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(appSettings),
        headers: { 'Content-Type': 'application/json' }
      });

      sortMethod = appSettings.sortMethod;
      sortAsc = appSettings.sortAsc;
      tempSearchProvider = appSettings.provider;

      const label = sortMethod === 'time' ? '时间' : '优先级';
      const orderLabel = sortAsc ? '正序 ▲' : '倒序 ▼';
      document.getElementById('btn-sort-trigger').innerText = '排序: ' + label + ' ▼';
      document.getElementById('btn-sort-order').innerText = '顺序: ' + orderLabel;

      renderTodos();
      closeSettings();
    }

    function exportData() {
      const incTodos = document.getElementById('export-todos').checked;
      const incTrash = document.getElementById('export-trash').checked;
      const incSettings = document.getElementById('export-settings').checked;

      if (!incTodos && !incTrash && !incSettings) return alert('请至少选择一项需要导出的内容。');

      const dlUrl = \`/api/export?todos=\${incTodos}&trash=\${incTrash}&settings=\${incSettings}\`;
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = \`moara_todo_export_\${formatDate(new Date())}.json\`;
      document.body.appendChild(a); 
      a.click();
      document.body.removeChild(a);
    }

    function importData(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          let toImport =[];
          if (data.todos) toImport = toImport.concat(data.todos);
          if (data.trash) toImport = toImport.concat(data.trash);
          if (!data.todos && Array.isArray(data)) toImport = data;

          let mode = 'merge';
          if (toImport.length > 0) {
            if (confirm("是否使用【覆盖模式】？\\n点击“确定”将清空云端的所有数据，然后完全替换为导入的新数据。\\n点击“取消”将进入【合并模式】或取消导入操作。")) {
                mode = 'overwrite';
            } else {
                if (!confirm("是否继续使用【合并模式】进行导入？\\n将保留现有云端的所有数据，仅覆盖更新 ID 相同的重叠事项。")) {
                    event.target.value = '';
                    return;
                }
            }
          } else if (!data.settings) {
            throw new Error("未在文件中找到有效的待办或设置数据。");
          }

          if (toImport.length > 0 || mode === 'overwrite') {
            const res = await fetch('/api/import', {
              method: 'POST',
              body: JSON.stringify({ todos: toImport, mode: mode }),
              headers: { 'Content-Type': 'application/json' }
            });
            if (!res.ok) throw new Error('云端合并/覆盖恢复操作执行异常');
          }

          if (data.settings && document.getElementById('export-settings').checked) {
            await fetch('/api/settings', {
              method: 'POST',
              body: JSON.stringify(data.settings),
              headers: { 'Content-Type': 'application/json' }
            });
          }

          alert('导入及系统设置应用成功，界面重载中...');
          location.reload();
        } catch (err) {
          alert('导入失败：' + err.message);
        }
        event.target.value = ''; 
      };
      reader.readAsText(file);
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

    // 回收站相关逻辑
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

    // 子任务与网络搜索逻辑
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

    function openAddModal() {
      activeMode = 'add';
      document.getElementById('modal-add').classList.add('active');
      document.getElementById('add-text').value = ''; document.getElementById('add-desc').value = '';
      document.getElementById('add-url').value = ''; document.getElementById('add-copy').value = '';
      tempTime = ''; tempPriority = 'low'; addRepeatState = false;
      
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
      const box = document.getElementById('add-repeat-box');
      if(addRepeatState) box.classList.add('checked'); else box.classList.remove('checked');
    }

    function closeAddModal() { document.getElementById('modal-add').classList.remove('active'); }
    function toggleAddRepeat() { addRepeatState = !addRepeatState; updateAddUI(); }

    async function confirmAddTask() {
      const text = document.getElementById('add-text').value.trim();
      if (!text) return;
      const newId = Date.now().toString() + Math.random().toString().slice(2, 6);
      const newTask = {
        id: newId, parentId: newId, text: text, time: tempTime,
        priority: tempPriority, repeat: addRepeatState,
        desc: document.getElementById('add-desc').value, url: document.getElementById('add-url').value,
        copyText: document.getElementById('add-copy').value, done: false,
        subtasks: tempSubtasks, search_terms: tempSearchTerms
      };
      closeAddModal();
      await fetch('/api/todo-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'CREATE', date: formatDate(currentDate), task: newTask }),
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
      const detailView = document.getElementById('detail-view'); detailView.classList.add('closing');
      detailView.addEventListener('animationend', function handler() {
        detailView.classList.remove('active'); detailView.classList.remove('closing'); detailView.removeEventListener('animationend', handler);
      });
      document.getElementById('popover-action').style.display = 'none';
    }

    function renderDetailContent() {
      const task = todos[currentDetailIndex]; const container = document.getElementById('detail-content');
      const pMap = {low:'低', med:'中', high:'高'};
      
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

        container.innerHTML = \`
          <div class="detail-label">事项内容</div><div class="detail-value">\${task.text}</div>
          \${subtasksSection}
          \${searchSection}
          <div class="row">
            <div class="flex-1"><div class="detail-label">时间点</div><div class="detail-value">\${task.time || '--:--'}</div></div>
            <div class="flex-1"><div class="detail-label">优先级</div><div class="detail-value">\${pMap[task.priority]}</div></div>
          </div>
          \${urlSection}\${copySection}
          <div class="detail-label">属性</div><div class="detail-value">\${task.repeat ? '每天 (Daily Reset)' : (task.isSeries ? '已停用未来的系列事项' : '单次任务')}</div>
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
          <div class="switch-label" onclick="document.getElementById('edit-repeat-box').classList.toggle('checked')">
            <div class="switch-box \${task.repeat?'checked':''}" id="edit-repeat-box"></div><span>每天 (Daily Reset)</span>
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
        const isRepeatNow = document.getElementById('edit-repeat-box').classList.contains('checked');
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
      document.getElementById('popover-action').style.display = 'none';
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
        task.repeat = document.getElementById('edit-repeat-box').classList.contains('checked');
        toggleEditMode();
        await fetch('/api/todo-action', { method: 'POST', body: JSON.stringify({ action: 'UPDATE', date: formatDate(currentDate), task: task, scope: scope }), headers: { 'Content-Type': 'application/json' } });
        await loadTodos();
        const newIndex = todos.findIndex(t => t.id === task.id);
        if (newIndex !== -1) currentDetailIndex = newIndex; else closeDetail();
      }
    }

    function openCalendar() { calDate = new Date(currentDate); calMode = 'date'; renderCalendar(); document.getElementById('modal-calendar').classList.add('active'); }
    function calChange(offset) {
      if (calMode === 'date') { calDate.setMonth(calDate.getMonth() + offset); renderCalendar(); } 
      else if (calMode === 'year') { yearPickerStart += offset * 12; openYearPicker(yearPickerStart); } 
      else if (calMode === 'month') { calDate.setFullYear(calDate.getFullYear() + offset); openMonthPicker(); }
    }

    function renderCalendar() {
      calMode = 'date';
      const year = calDate.getFullYear(); const month = calDate.getMonth();
      const actionBtn = document.getElementById('cal-action-btn'); actionBtn.innerText = '返回今日'; actionBtn.onclick = jumpToToday;
      
      document.getElementById('cal-prev').innerText = '< 上月'; document.getElementById('cal-next').innerText = '下月 >';
      document.getElementById('cal-title').innerHTML = \`<span class="cal-title-btn" onclick="openYearPicker()">\${year}年</span> <span class="cal-title-btn" onclick="openMonthPicker()">\${month + 1}月</span>\`;
      
      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(7, 1fr)'; grid.innerHTML = '';
      const days =['日','一','二','三','四','五','六']; days.forEach(d => grid.innerHTML += \`<div class="cal-day-name">\${d}</div>\`);
      const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
      const todayStr = formatDate(new Date()); const selectedStr = formatDate(currentDate);

      for(let i=0; i<firstDay; i++) grid.innerHTML += \`<div class="cal-date empty"></div>\`;
      for(let i=1; i<=daysInMonth; i++) {
        const d = new Date(year, month, i); const dStr = formatDate(d);
        let className = 'cal-date';
        if (dStr === todayStr) className += ' today'; if (dStr === selectedStr) className += ' selected';
        const el = document.createElement('div'); el.className = className; el.innerText = i;
        el.onclick = () => { currentDate = new Date(year, month, i); document.getElementById('modal-calendar').classList.remove('active'); exitBatchMode(); loadTodos(); };
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
      document.getElementById('cal-title').innerHTML = \`<span class="cal-title-btn">选择年份</span>\`;
      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(4, 1fr)'; grid.innerHTML = '';
      for(let i=0; i<12; i++) {
        const y = startYear + i; const el = document.createElement('div');
        el.className = 'cal-date' + (calDate.getFullYear() === y ? ' selected' : ''); el.innerText = y;
        el.onclick = () => { calDate.setFullYear(y); renderCalendar(); }; grid.appendChild(el);
      }
    }

    function changeDate(offset) { exitBatchMode(); currentDate.setDate(currentDate.getDate() + offset); loadTodos(); }
    function jumpToToday() { exitBatchMode(); currentDate = new Date(); document.getElementById('modal-calendar').classList.remove('active'); loadTodos(); }

    async function bootstrap() {
      await initSettings();
      if (document.getElementById('login-view').classList.contains('hidden')) loadTodos();
    }
    bootstrap();

  </script>
</body>
</html>
  `;
}