/*
 * Cloudflare Worker + D1 Todo App - API v1 (RESTful + API Key Auth)
 *
 * 供 OpenClaw / 外部程序 / 网页安全调用的 RESTful API
 * 鉴权方式: API Key (Header: X-API-Key 或 Query: api_key)
 */

import {
  DEFAULT_CATEGORY_COLOR,
  secureCompare,
  getDayOfWeek,
  apiError,
  parseCookies,
  verify as verifySig,
} from './utils.js';
import {
  isOccurrenceOnDate,
  computeDeleteActions,
  computeUpdateActions,
  addExdate,
  removeExdate,
  getPreviousDate,
} from './recurring-engine.js';

// ==================== API Key 管理 ====================

const API_KEYS_SETTINGS_KEY = 'api_keys';

/**
 * 生成 API Key (前缀 cfk_ + 32字节随机)
 */
function generateApiKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = btoa(String.fromCharCode(...bytes))
    .replace(/[+/=]/g, c => c === '+' ? '-' : c === '/' ? '_' : '');
  return 'cfk_' + raw;
}

/**
 * 从 D1 读取所有 API Keys
 */
async function getApiKeys(DB) {
  const record = await DB.prepare(
    "SELECT value FROM settings WHERE key = ?"
  ).bind(API_KEYS_SETTINGS_KEY).first();
  if (!record || !record.value) return [];
  try {
    const parsed = JSON.parse(record.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * 保存所有 API Keys
 */
async function saveApiKeys(DB, keys) {
  await DB.prepare(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
  ).bind(API_KEYS_SETTINGS_KEY, JSON.stringify(keys)).run();
}

/**
 * 验证 API Key (恒定时间比较)
 */
async function verifyApiKey(DB, providedKey, jwtSecret) {
  if (!providedKey || typeof providedKey !== 'string') return false;
  const keys = await getApiKeys(DB);
  for (const k of keys) {
    if (k.disabled) continue;
    // 使用恒定时间比较防止时序攻击，secret 必须为常量
    const match = await secureCompare(providedKey, k.key, jwtSecret);
    if (match) return true;
  }
  return false;
}

/**
 * 从请求中提取 API Key
 */
function extractApiKey(request, url) {
  // 1. Header: X-API-Key
  const headerKey = request.headers.get('X-API-Key');
  if (headerKey) return headerKey;
  // 2. Query: api_key
  const queryKey = url.searchParams.get('api_key');
  if (queryKey) return queryKey;
  // 3. Authorization: Bearer cfk_...
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith('cfk_')) return token;
  }
  return null;
}

// ==================== API Key 管理端点 ====================

/**
 * Cookie 鉴权（用于 /api/v1/keys 等仅允许网页端操作的端点）
 */
async function verifyCookieAuth(request, env) {
  const cookies = parseCookies(request);
  if (!cookies.auth_token || !cookies.auth_sig) {
    return apiError('Cookie authentication required', 401);
  }
  const sigValid = await verifySig(cookies.auth_token, cookies.auth_sig, env.JWT_SECRET);
  if (!sigValid) return apiError('Invalid cookie auth', 401);

  const record = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'active_session_token'"
  ).first();
  if (!record || !record.value) return apiError('UNAUTHORIZED', 401);

  let sessions;
  try {
    sessions = JSON.parse(record.value);
    if (!Array.isArray(sessions)) return apiError('UNAUTHORIZED', 401);
  } catch (e) { return apiError('UNAUTHORIZED', 401); }

  const matched = sessions.find(s => s.token === cookies.auth_token);
  if (!matched) return apiError('UNAUTHORIZED', 401);

  return null; // 鉴权通过
}

async function handleApiKeys(request, env, url) {
  // 这些端点需要 cookie 鉴权
  const authErr = await verifyCookieAuth(request, env);
  if (authErr) return authErr;

  if (request.method === 'GET') {
    const keys = await getApiKeys(env.DB);
    // 返回时隐藏完整 key，只显示前8位 + 掩码
    const safe = keys.map(k => ({
      id: k.id,
      name: k.name || '',
      keyPrefix: k.key.slice(0, 8) + '...' + k.key.slice(-4),
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt || null,
      disabled: k.disabled || false,
    }));
    return new Response(JSON.stringify(safe), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'POST') {
    const { action, id, name } = await request.json();

    if (action === 'CREATE') {
      const keys = await getApiKeys(env.DB);
      if (keys.length >= 10) {
        return apiError('最多创建10个API Key', 400);
      }
      const newKey = generateApiKey();
      const keyId = Date.now().toString() + Math.random().toString().slice(2, 6);
      const record = {
        id: keyId,
        key: newKey,
        name: (name || '').trim().slice(0, 50) || 'Default',
        createdAt: Date.now(),
        lastUsedAt: null,
        disabled: false,
      };
      keys.push(record);
      await saveApiKeys(env.DB, keys);
      // 仅在创建时返回完整 key
      return new Response(JSON.stringify({
        success: true,
        id: keyId,
        key: newKey,
        name: record.name,
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'DELETE') {
      if (!id) return apiError('缺少 id', 400);
      let keys = await getApiKeys(env.DB);
      keys = keys.filter(k => k.id !== id);
      await saveApiKeys(env.DB, keys);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'TOGGLE') {
      if (!id) return apiError('缺少 id', 400);
      const keys = await getApiKeys(env.DB);
      const target = keys.find(k => k.id === id);
      if (!target) return apiError('Key 不存在', 404);
      target.disabled = !target.disabled;
      await saveApiKeys(env.DB, keys);
      return new Response(JSON.stringify({ success: true, disabled: target.disabled }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'RENAME') {
      if (!id) return apiError('缺少 id', 400);
      const keys = await getApiKeys(env.DB);
      const target = keys.find(k => k.id === id);
      if (!target) return apiError('Key 不存在', 404);
      target.name = (name || '').trim().slice(0, 50) || 'Default';
      await saveApiKeys(env.DB, keys);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return apiError('未知操作，可用: CREATE, DELETE, TOGGLE, RENAME', 400);
  }

  return apiError('Method Not Allowed', 405);
}

// ==================== 辅助函数 ====================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    }
  });
}

/**
 * 更新 API Key 最后使用时间（限频）
 */
async function touchApiKeyLastUsed(DB, apiKey) {
  try {
    const keys = await getApiKeys(DB);
    const target = keys.find(k => k.key === apiKey);
    if (target) {
      const now = Date.now();
      // 每5分钟最多更新一次
      if (!target.lastUsedAt || now - target.lastUsedAt > 5 * 60 * 1000) {
        target.lastUsedAt = now;
        await saveApiKeys(DB, keys);
      }
    }
  } catch (e) {}
}

/**
 * 解析 subtasks/search_terms JSON 字段
 */
function parseJsonField(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val) {
    try { return JSON.parse(val); } catch (e) {}
  }
  return [];
}

/**
 * 规范化优先级值（前端使用 med，API 同时接受 medium 和 med）
 */
function normalizePriority(val) {
  if (val === 'medium') return 'med';
  if (['low', 'med', 'high'].includes(val)) return val;
  return 'low';
}

/**
 * 格式化 todo 记录为 API 响应格式
 */
function formatTodo(row) {
  const subtasks = parseJsonField(row.subtasks).map(s => {
    if (typeof s === 'string' && s.trim()) return { text: s, done: false };
    if (s && typeof s === 'object' && s.text) return s;
    return null;
  }).filter(Boolean);
  const searchTerms = parseJsonField(row.search_terms).map(w => {
    if (typeof w === 'string' && w.trim()) return { text: w, done: false };
    if (w && typeof w === 'object' && w.text) return w;
    return null;
  }).filter(Boolean);

  let rType = row.repeat_type || 'none';
  if (rType !== 'none' && !['daily', 'weekly', 'monthly', 'yearly'].includes(rType)) rType = 'daily';

  return {
    id: row.id,
    parentId: row.parent_id,
    date: row.date,
    text: row.text,
    time: row.time || '',
    priority: normalizePriority(row.priority || 'low'),
    desc: row.desc || '',
    url: row.url || '',
    copyText: row.copy_text || '',
    subtasks,
    searchTerms,
    done: !!row.done,
    deleted: !!row.deleted,
    repeatType: rType,
    repeatCustom: row.repeat_custom || '',
    repeatEnd: row.repeat_end || '',
    endTime: row.end_time || '',
    categoryId: row.category_id || '',
    recurrenceId: row.recurrence_id || '',
    isException: !!row.is_exception,
    isSeries: rType !== 'none',
  };
}

/**
 * 格式化 category 记录
 */
function formatCategory(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color || DEFAULT_CATEGORY_COLOR,
  };
}

// ==================== v1 Todo CRUD ====================

async function handleV1Todos(request, env, url) {
  const DB = env.DB;

  // GET /api/v1/todos - 查询 todo 列表
  if (request.method === 'GET') {
    const date = url.searchParams.get('date');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const categoryId = url.searchParams.get('category_id');
    const done = url.searchParams.get('done'); // 'true' | 'false' | 不传=全部
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 500);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);

    let conditions = ['deleted = 0'];
    let params = [];

    if (date) {
      conditions.push('date = ?');
      params.push(date);
    } else if (startDate && endDate) {
      conditions.push('date >= ? AND date <= ?');
      params.push(startDate, endDate);
    } else if (startDate) {
      conditions.push('date >= ?');
      params.push(startDate);
    } else if (endDate) {
      conditions.push('date <= ?');
      params.push(endDate);
    }

    if (categoryId) {
      conditions.push('category_id = ?');
      params.push(categoryId);
    }

    if (done === 'true') {
      conditions.push('done = 1');
    } else if (done === 'false') {
      conditions.push('done = 0');
    }

    const whereClause = conditions.join(' AND ');
    const countRes = await DB.prepare(
      `SELECT COUNT(*) as total FROM todos WHERE ${whereClause}`
    ).bind(...params).first();

    const { results } = await DB.prepare(
      `SELECT * FROM todos WHERE ${whereClause} ORDER BY date ASC, id ASC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    // 如果按日期查询，还需要处理重复任务模板
    let recurringResults = [];
    if (date) {
      const templatesReq = await DB.prepare(`
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
      for (const tpl of (templatesReq.results || [])) {
        let templateForEngine = { ...tpl, exdates: tpl.exdates || '[]' };
        if (!isOccurrenceOnDate(templateForEngine, date)) continue;

        const newId = crypto.randomUUID();
        let parsedSubtasks = parseJsonField(tpl.subtasks);
        parsedSubtasks.forEach(st => st.done = false);

        const newRecord = {
          ...tpl, id: newId, date, parent_id: tpl.parent_id,
          done: 0, deleted: 0,
          subtasks: parsedSubtasks,
          search_terms: [],
        };
        recurringResults.push(newRecord);

        insertStmts.push(DB.prepare(
          'INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          newId, tpl.parent_id, date, tpl.text, tpl.time || '', tpl.priority || 'low',
          tpl.desc || '', tpl.url || '', tpl.copy_text || '',
          JSON.stringify(parsedSubtasks), '[]',
          0, 0, tpl.repeat_type || 'none', tpl.repeat_custom || '', tpl.repeat_end || '', tpl.end_time || '', tpl.category_id || ''
        ));
      }
      if (insertStmts.length > 0) {
        for (let i = 0; i < insertStmts.length; i += 100) {
          await DB.batch(insertStmts.slice(i, i + 100));
        }
      }
    }

    const allResults = [...(results || []), ...recurringResults];
    const formatted = allResults.map(formatTodo);

    return jsonResponse({
      success: true,
      data: formatted,
      pagination: {
        total: (countRes?.total || 0) + recurringResults.length,
        limit,
        offset,
      }
    });
  }

  // POST /api/v1/todos - 创建 todo
  if (request.method === 'POST') {
    const body = await request.json();
    const { date, text, time, priority, desc, url, copyText, subtasks, searchTerms, repeatType, repeatEnd, endTime, categoryId } = body;

    if (!date || !text) {
      return apiError('date 和 text 为必填项', 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return apiError('date 格式应为 YYYY-MM-DD', 400);
    }

    const id = crypto.randomUUID();
    const rptType = repeatType || 'none';
    const catId = categoryId || '';
    const rEnd = repeatEnd || '';
    const eTime = endTime || '';
    const normPriority = normalizePriority(priority || 'low');
    // 规范化 subtasks：字符串→{text, done:false} 对象
    const normalizedSubtasks = (subtasks || []).map(s => {
      if (typeof s === 'string') return { text: s, done: false };
      if (s && typeof s === 'object' && s.text) return s;
      return null;
    }).filter(Boolean);
    const normalizedSearchTerms = (searchTerms || []).map(w => {
      if (typeof w === 'string') return { text: w, done: false };
      if (w && typeof w === 'object' && w.text) return w;
      return null;
    }).filter(Boolean);
    const subtasksStr = JSON.stringify(normalizedSubtasks);
    const searchTermsStr = JSON.stringify(normalizedSearchTerms);

    await DB.prepare(
      'INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      id, id, date, text, time || '', normPriority,
      desc || '', url || '', copyText || '', subtasksStr, searchTermsStr,
      0, 0, rptType, '', rEnd, eTime, catId
    ).run();

    if (rptType !== 'none') {
      await DB.prepare(
        'INSERT INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        id, text, time || '', normPriority, desc || '', url || '', copyText || '',
        subtasksStr, searchTermsStr, rptType, '', rEnd, eTime, date, '[]', catId
      ).run();
    }

    return jsonResponse({
      success: true,
      data: { id, date, text, repeatType: rptType, categoryId: catId }
    }, 201);
  }

  return apiError('Method Not Allowed', 405);
}

// GET /api/v1/todos/:id - 获取单个 todo
async function handleV1TodoGet(DB, todoId) {
  const row = await DB.prepare('SELECT * FROM todos WHERE id = ?').bind(todoId).first();
  if (!row) return apiError('Todo 不存在', 404);
  return jsonResponse({ success: true, data: formatTodo(row) });
}

// PUT /api/v1/todos/:id - 更新 todo
async function handleV1TodoPut(request, DB, todoId) {
  const existing = await DB.prepare('SELECT * FROM todos WHERE id = ?').bind(todoId).first();
  if (!existing) return apiError('Todo 不存在', 404);

  const body = await request.json();
  const parentId = existing.parent_id; // 始终使用数据库中的 parent_id，不可被用户篡改
  const isSeries = existing.repeat_type && existing.repeat_type !== 'none' && parentId && parentId !== existing.id;
  // 重复 todo 未指定 scope 时，默认 scope=this（仅更新此实例）
  const scope = isSeries && (!body.scope || body.scope === 'none') ? 'this' : (body.scope || 'none');

  const newValues = {
    text: body.text !== undefined ? body.text : existing.text,
    time: body.time !== undefined ? body.time : (existing.time || ''),
    priority: body.priority !== undefined ? normalizePriority(body.priority) : normalizePriority(existing.priority || 'low'),
    desc: body.desc !== undefined ? body.desc : (existing.desc || ''),
    url: body.url !== undefined ? body.url : (existing.url || ''),
    copyText: body.copyText !== undefined ? body.copyText : (existing.copy_text || ''),
    subtasks: JSON.stringify(body.subtasks !== undefined ? body.subtasks : parseJsonField(existing.subtasks)),
    search_terms: JSON.stringify(body.searchTerms !== undefined ? body.searchTerms : parseJsonField(existing.search_terms)),
    repeat_type: body.repeatType !== undefined ? body.repeatType : (existing.repeat_type || 'none'),
    repeat_custom: '',
    repeat_end: body.repeatEnd !== undefined ? body.repeatEnd : (existing.repeat_end || ''),
    end_time: body.endTime !== undefined ? body.endTime : (existing.end_time || ''),
    category_id: body.categoryId !== undefined ? body.categoryId : (existing.category_id || ''),
    date: body.date !== undefined ? body.date : existing.date,
  };

  const date = existing.date;
  const rptType = newValues.repeat_type;
  const subtasksStr = newValues.subtasks;
  const searchTermsStr = newValues.search_terms;
  const newDate = newValues.date;
  const dateChanged = newDate !== date;

  if (!isSeries || !scope || scope === 'none') {
    if (rptType !== 'none') {
      // 单次 → 重复
      await DB.prepare(
        'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?'
      ).bind(newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newValues.category_id, todoId).run();
      await DB.prepare(
        'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(todoId, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newDate, '[]', newValues.category_id).run();
    } else if (parentId && parentId !== todoId) {
      // 重复 → 单次：脱离系列
      await DB.prepare(
        'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', end_time=?, category_id=? WHERE id=?'
      ).bind(todoId, newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, newValues.end_time, newValues.category_id, todoId).run();
      const tpl = await DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parentId).first();
      if (tpl) {
        const newExdates = addExdate(tpl.exdates || '[]', date);
        await DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(newExdates, parentId).run();
      }
    } else {
      // 普通更新
      await DB.prepare(
        'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?'
      ).bind(newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newValues.category_id, todoId).run();
    }
  } else {
    const actions = computeUpdateActions({ task: { ...existing, parentId, isSeries }, date, scope, newValues });

    if (actions.currentTodo) {
      const cv = actions.currentTodo;
      if (cv.detachFromSeries) {
        if (cv.newSeries) {
          await DB.prepare(
            'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?'
          ).bind(todoId, newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newValues.category_id, todoId).run();
          await DB.prepare(
            'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(todoId, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newDate, '[]', newValues.category_id).run();
        } else {
          await DB.prepare(
            'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', end_time=?, category_id=? WHERE id=?'
          ).bind(todoId, newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, newValues.end_time, newValues.category_id, todoId).run();
        }
      } else if (cv.isRecurring) {
        await DB.prepare(
          'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?'
        ).bind(newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newValues.category_id, todoId).run();
      } else {
        await DB.prepare(
          'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', category_id=? WHERE id=?'
        ).bind(newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, newValues.category_id, todoId).run();
      }
    }

    if (actions.pastTodos) {
      const pt = actions.pastTodos;
      if (pt.type === 'set_repeat_end') {
        const prevDate = getPreviousDate(date);
        await DB.prepare(
          'UPDATE todos SET repeat_end=? WHERE parent_id=? AND date < ? AND repeat_type != \'none\' AND (repeat_end = \'\' OR repeat_end IS NULL) AND deleted = 0'
        ).bind(prevDate, parentId, date).run();
      }
    }

    if (scope === 'thisAndFuture') {
      if (rptType !== 'none') {
        if (dateChanged) {
          await DB.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND date >= ? AND deleted = 0').bind(parentId, todoId, date).run();
        } else {
          await DB.prepare(
            'UPDATE todos SET text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE parent_id=? AND id != ? AND date >= ? AND deleted = 0'
          ).bind(newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newValues.category_id, parentId, todoId, date).run();
        }
      } else {
        await DB.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND date > ? AND deleted = 0').bind(parentId, todoId, date).run();
      }
    } else if (scope === 'all') {
      if (rptType !== 'none') {
        if (dateChanged) {
          await DB.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0').bind(parentId, todoId).run();
        } else {
          await DB.prepare(
            'UPDATE todos SET text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE parent_id=? AND id != ? AND deleted = 0'
          ).bind(newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newValues.category_id, parentId, todoId).run();
        }
      } else {
        await DB.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0').bind(parentId, todoId).run();
      }
    }

    if (actions.template) {
      const tmpl = actions.template;
      if (tmpl.type === 'add_exdate') {
        const tpl = await DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parentId).first();
        if (tpl) {
          const newExdates = addExdate(tpl.exdates || '[]', date);
          await DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(newExdates, parentId).run();
        }
      } else if (tmpl.type === 'set_repeat_end') {
        const prevDate = getPreviousDate(date);
        await DB.prepare('UPDATE todo_templates SET repeat_end=? WHERE parent_id=?').bind(prevDate, parentId).run();
      } else if (tmpl.type === 'update_from_date' || tmpl.type === 'update_all') {
        if (rptType !== 'none') {
          let existingExdates = '[]';
          try {
            const existingTpl = await DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parentId).first();
            if (existingTpl) existingExdates = existingTpl.exdates || '[]';
          } catch (e) {}
          await DB.prepare(
            'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(parentId, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newDate, existingExdates, newValues.category_id).run();
        }
      } else if (tmpl.type === 'delete') {
        await DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parentId).run();
      }
    }
  }

  const updated = await DB.prepare('SELECT * FROM todos WHERE id = ?').bind(todoId).first();
  return jsonResponse({ success: true, data: formatTodo(updated) });
}

// DELETE /api/v1/todos/:id - 删除 todo
async function handleV1TodoDelete(DB, todoId, scope) {
  const existing = await DB.prepare('SELECT * FROM todos WHERE id = ?').bind(todoId).first();
  if (!existing) return apiError('Todo 不存在', 404);

  const parentId = existing.parent_id;
  const isSeries = existing.repeat_type && existing.repeat_type !== 'none' && parentId && parentId !== todoId;
  const date = existing.date;

  // 重复 todo 未指定 scope 时，默认 scope=this（仅删除此实例，加 exdate 防止重新生成）
  const effectiveScope = isSeries && !scope ? 'this' : scope;

  if (!isSeries || !effectiveScope) {
    await DB.prepare('UPDATE todos SET deleted = 1 WHERE id = ?').bind(todoId).run();
  } else {
    const actions = computeDeleteActions({ task: { ...existing, parentId, isSeries }, date, scope: effectiveScope });

    if (actions.deleteTodoIds && actions.deleteTodoIds.length > 0) {
      for (const id of actions.deleteTodoIds) {
        await DB.prepare('UPDATE todos SET deleted = 1 WHERE id = ?').bind(id).run();
      }
    }

    if (actions.updateTemplate) {
      const tmpl = actions.updateTemplate;
      if (tmpl.type === 'add_exdate') {
        const tpl = await DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parentId).first();
        if (tpl) {
          const newExdates = addExdate(tpl.exdates || '[]', date);
          await DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(newExdates, parentId).run();
        }
      } else if (tmpl.type === 'set_repeat_end') {
        const prevDate = getPreviousDate(date);
        if (tmpl.alsoDeleteFuture) {
          await DB.prepare('UPDATE todos SET deleted = 1 WHERE parent_id=? AND date >= ?').bind(parentId, date).run();
        }
        await DB.prepare('UPDATE todos SET repeat_end=? WHERE parent_id=? AND date < ? AND repeat_type != \'none\'').bind(prevDate, parentId, date).run();
        await DB.prepare('UPDATE todo_templates SET repeat_end=? WHERE parent_id=?').bind(prevDate, parentId).run();
      } else if (tmpl.type === 'delete_all') {
        await DB.prepare('UPDATE todos SET deleted = 1 WHERE parent_id=?').bind(parentId).run();
        await DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parentId).run();
      }
    }

    if (actions.deleteTemplate) {
      await DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parentId).run();
    }
  }

  return jsonResponse({ success: true });
}

// PATCH /api/v1/todos/:id/toggle - 切换完成状态
async function handleV1TodoToggle(DB, todoId) {
  const existing = await DB.prepare('SELECT done FROM todos WHERE id = ?').bind(todoId).first();
  if (!existing) return apiError('Todo 不存在', 404);
  const newDone = existing.done ? 0 : 1;
  await DB.prepare('UPDATE todos SET done = ? WHERE id = ?').bind(newDone, todoId).run();
  return jsonResponse({ success: true, data: { id: todoId, done: !!newDone } });
}

// ==================== v1 Category CRUD ====================

async function handleV1Categories(request, env, url) {
  const DB = env.DB;

  // GET /api/v1/categories - 列出所有分类
  if (request.method === 'GET') {
    const { results } = await DB.prepare('SELECT id, name, color FROM categories ORDER BY id').all();
    return jsonResponse({ success: true, data: (results || []).map(formatCategory) });
  }

  // POST /api/v1/categories - 创建分类
  if (request.method === 'POST') {
    const { name, color } = await request.json();
    if (!name || !name.trim()) return apiError('name 为必填项', 400);

    const existing = await DB.prepare("SELECT id FROM categories WHERE LOWER(name) = ?").bind(name.trim().toLowerCase()).first();
    if (existing) return apiError('分类名称已存在', 400);

    const id = Date.now().toString() + Math.random().toString().slice(2, 6);
    const catColor = (color && color.trim()) ? color.trim() : DEFAULT_CATEGORY_COLOR;
    await DB.prepare("INSERT INTO categories (id, name, color) VALUES (?, ?, ?)").bind(id, name.trim(), catColor).run();
    return jsonResponse({ success: true, data: { id, name: name.trim(), color: catColor } }, 201);
  }

  return apiError('Method Not Allowed', 405);
}

// GET /api/v1/categories/:id
async function handleV1CategoryGet(DB, catId) {
  const row = await DB.prepare('SELECT id, name, color FROM categories WHERE id = ?').bind(catId).first();
  if (!row) return apiError('分类不存在', 404);
  return jsonResponse({ success: true, data: formatCategory(row) });
}

// PUT /api/v1/categories/:id - 更新分类
async function handleV1CategoryPut(request, DB, catId) {
  const existing = await DB.prepare('SELECT id FROM categories WHERE id = ?').bind(catId).first();
  if (!existing) return apiError('分类不存在', 404);

  const body = await request.json();
  const sets = [];
  const vals = [];

  if (body.name !== undefined && body.name.trim()) {
    const dup = await DB.prepare("SELECT id FROM categories WHERE LOWER(name) = ? AND id != ?").bind(body.name.trim().toLowerCase(), catId).first();
    if (dup) return apiError('分类名称已存在', 400);
    sets.push("name = ?");
    vals.push(body.name.trim());
  }
  if (body.color !== undefined && body.color.trim()) {
    sets.push("color = ?");
    vals.push(body.color.trim());
  }

  if (sets.length > 0) {
    vals.push(catId);
    await DB.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  }

  const updated = await DB.prepare('SELECT id, name, color FROM categories WHERE id = ?').bind(catId).first();
  return jsonResponse({ success: true, data: formatCategory(updated) });
}

// DELETE /api/v1/categories/:id - 删除分类
async function handleV1CategoryDelete(DB, catId) {
  const existing = await DB.prepare('SELECT id FROM categories WHERE id = ?').bind(catId).first();
  if (!existing) return apiError('分类不存在', 404);

  await DB.batch([
    DB.prepare('DELETE FROM categories WHERE id = ?').bind(catId),
    DB.prepare("UPDATE todos SET category_id = '' WHERE category_id = ?").bind(catId),
    DB.prepare("UPDATE todo_templates SET category_id = '' WHERE category_id = ?").bind(catId),
  ]);
  return jsonResponse({ success: true });
}

// ==================== 批量操作 ====================

// POST /api/v1/todos/batch - 批量操作
async function handleV1TodoBatch(request, DB) {
  const { action, ids, doneStatus } = await request.json();

  if (action === 'BATCH_TOGGLE_DONE') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError('ids 为必填数组', 400);
    if (ids.length > 100) return apiError('单次最多100条', 400);
    const placeholders = ids.map(() => '?').join(',');
    await DB.prepare(`UPDATE todos SET done = ? WHERE id IN (${placeholders})`)
      .bind(doneStatus ? 1 : 0, ...ids).run();
    return jsonResponse({ success: true, data: { affected: ids.length, done: !!doneStatus } });
  }

  if (action === 'BATCH_DELETE') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError('ids 为必填数组', 400);
    if (ids.length > 100) return apiError('单次最多100条', 400);
    const placeholders = ids.map(() => '?').join(',');
    const tasks = await DB.prepare(`SELECT parent_id, date, repeat_type FROM todos WHERE id IN (${placeholders})`).bind(...ids).all();
    await DB.prepare(`UPDATE todos SET deleted = 1 WHERE id IN (${placeholders})`).bind(...ids).run();

    // 为重复任务添加 exdate
    const exdateUpdates = {};
    for (const t of (tasks.results || [])) {
      if (t.repeat_type && t.repeat_type !== 'none' && t.parent_id) {
        if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
        exdateUpdates[t.parent_id].push(t.date);
      }
    }
    for (const pid of Object.keys(exdateUpdates)) {
      const tpl = await DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(pid).first();
      if (tpl) {
        let currentExdates = tpl.exdates || '[]';
        let changed = false;
        for (const d of exdateUpdates[pid]) {
          const newExdates = addExdate(currentExdates, d);
          if (newExdates !== currentExdates) { currentExdates = newExdates; changed = true; }
        }
        if (changed) await DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(currentExdates, pid).run();
      }
    }
    return jsonResponse({ success: true, data: { affected: ids.length } });
  }

  return apiError('未知操作，可用: BATCH_TOGGLE_DONE, BATCH_DELETE', 400);
}

// ==================== 回收站 ====================

// GET /api/v1/trash - 获取回收站列表
async function handleV1TrashList(DB, url) {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 500);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);
  const { results } = await DB.prepare('SELECT * FROM todos WHERE deleted = 1 ORDER BY date DESC LIMIT ? OFFSET ?').bind(limit, offset).all();
  const countRes = await DB.prepare('SELECT COUNT(*) as total FROM todos WHERE deleted = 1').first();
  return jsonResponse({
    success: true,
    data: (results || []).map(formatTodo),
    pagination: { total: countRes?.total || 0, limit, offset }
  });
}

// POST /api/v1/trash-action - 回收站操作
async function handleV1TrashAction(request, DB) {
  const { action, id, ids } = await request.json();

  if (action === 'RESTORE') {
    if (!id) return apiError('缺少 id', 400);
    const t = await DB.prepare('SELECT parent_id, date, repeat_type, repeat_end FROM todos WHERE id = ?').bind(id).first();
    if (!t) return apiError('待办不存在', 404);
    await DB.prepare('UPDATE todos SET deleted = 0 WHERE id = ?').bind(id).run();
    if (t.repeat_type && t.repeat_type !== 'none' && t.parent_id) {
      const existing = await DB.prepare(
        'SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 AND id != ? LIMIT 1'
      ).bind(t.parent_id, t.date, id).first();
      if (existing) {
        await DB.prepare('UPDATE todos SET parent_id=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\' WHERE id=?').bind(id, id).run();
      } else if (t.repeat_end && t.repeat_end !== '') {
        const tpl = await DB.prepare('SELECT repeat_end FROM todo_templates WHERE parent_id = ?').bind(t.parent_id).first();
        if (tpl && tpl.repeat_end && tpl.repeat_end < t.date) {
          await DB.prepare('UPDATE todos SET parent_id=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\' WHERE id=?').bind(id, id).run();
        } else {
          await DB.prepare('UPDATE todos SET repeat_end=\'\' WHERE id=?').bind(id).run();
        }
      }
      const tpl = await DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(t.parent_id).first();
      if (tpl) {
        const newExdates = removeExdate(tpl.exdates || '[]', t.date);
        await DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(newExdates, t.parent_id).run();
      } else if (!tpl && t.repeat_type && t.repeat_type !== 'none') {
        const task = await DB.prepare('SELECT text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, end_time, category_id FROM todos WHERE id=?').bind(id).first();
        if (task) {
          await DB.prepare(
            'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
          ).bind(t.parent_id, task.text, task.time, task.priority, task.desc, task.url, task.copy_text, task.subtasks, task.search_terms, task.repeat_type, task.repeat_custom || '', '', task.end_time, t.date, '[]', task.category_id).run();
        }
      }
    }
    return jsonResponse({ success: true });
  }

  if (action === 'DELETE_PERMANENT') {
    if (!id) return apiError('缺少 id', 400);
    await DB.prepare('DELETE FROM todos WHERE id = ?').bind(id).run();
    return jsonResponse({ success: true });
  }

  if (action === 'CLEAR_ALL') {
    await DB.prepare('DELETE FROM todos WHERE deleted = 1').run();
    return jsonResponse({ success: true });
  }

  if (action === 'BATCH_RESTORE') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError('ids 为必填数组', 400);
    const placeholders = ids.map(() => '?').join(',');
    const tasks = await DB.prepare(`SELECT id, parent_id, date, repeat_type, repeat_end FROM todos WHERE id IN (${placeholders})`).bind(...ids).all();
    await DB.prepare(`UPDATE todos SET deleted = 0 WHERE id IN (${placeholders})`).bind(...ids).run();

    const reviveIds = [];
    const detachIds = [];
    for (const t of (tasks.results || [])) {
      if (t.repeat_type && t.repeat_type !== 'none' && t.repeat_end && t.repeat_end !== '') {
        const existing = await DB.prepare('SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 AND id != ? LIMIT 1').bind(t.parent_id, t.date, t.id).first();
        if (existing) { detachIds.push(t.id); }
        else {
          const tpl = await DB.prepare('SELECT repeat_end FROM todo_templates WHERE parent_id = ?').bind(t.parent_id).first();
          if (tpl && tpl.repeat_end && tpl.repeat_end < t.date) { detachIds.push(t.id); }
          else { reviveIds.push(t.id); }
        }
      }
    }
    if (reviveIds.length > 0) {
      const ph = reviveIds.map(() => '?').join(',');
      await DB.prepare(`UPDATE todos SET repeat_end='' WHERE id IN (${ph})`).bind(...reviveIds).run();
    }
    if (detachIds.length > 0) {
      const ph = detachIds.map(() => '?').join(',');
      await DB.prepare(`UPDATE todos SET parent_id=id, repeat_type='none', repeat_custom='', repeat_end='' WHERE id IN (${ph})`).bind(...detachIds).run();
    }
    const exdateUpdates = {};
    for (const t of (tasks.results || [])) {
      if (t.repeat_type && t.repeat_type !== 'none' && t.parent_id) {
        if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
        exdateUpdates[t.parent_id].push(t.date);
      }
    }
    for (const pid of Object.keys(exdateUpdates)) {
      const tpl = await DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(pid).first();
      if (tpl) {
        let currentExdates = tpl.exdates || '[]';
        let changed = false;
        for (const d of exdateUpdates[pid]) {
          const newExdates = removeExdate(currentExdates, d);
          if (newExdates !== currentExdates) { currentExdates = newExdates; changed = true; }
        }
        if (changed) await DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(currentExdates, pid).run();
      }
    }
    return jsonResponse({ success: true, data: { restored: ids.length } });
  }

  if (action === 'BATCH_DELETE_PERMANENT') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError('ids 为必填数组', 400);
    const placeholders = ids.map(() => '?').join(',');
    await DB.prepare(`DELETE FROM todos WHERE id IN (${placeholders})`).bind(...ids).run();
    return jsonResponse({ success: true, data: { deleted: ids.length } });
  }

  return apiError('未知操作，可用: RESTORE, DELETE_PERMANENT, CLEAR_ALL, BATCH_RESTORE, BATCH_DELETE_PERMANENT', 400);
}

// ==================== 统计 ====================

// GET /api/v1/stats - 获取统计数据
async function handleV1Stats(DB, url) {
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!start || !end) return apiError('start 和 end 为必填参数 (YYYY-MM-DD)', 400);

  const { results } = await DB.prepare(
    'SELECT date, priority, done FROM todos WHERE date >= ? AND date <= ? AND deleted = 0'
  ).bind(start, end).all();

  const stats = {
    total: results.length,
    done: results.filter(r => r.done).length,
    undone: results.filter(r => !r.done).length,
    byPriority: {
      low: results.filter(r => r.priority === 'low').length,
      med: results.filter(r => r.priority === 'med').length,
      high: results.filter(r => r.priority === 'high').length,
    },
    byDate: {},
  };
  for (const r of results) {
    if (!stats.byDate[r.date]) stats.byDate[r.date] = { total: 0, done: 0 };
    stats.byDate[r.date].total++;
    if (r.done) stats.byDate[r.date].done++;
  }
  return jsonResponse({ success: true, data: stats });
}

// ==================== 分类批量删除 ====================

// POST /api/v1/categories/batch - 批量操作
async function handleV1CategoryBatch(request, DB) {
  const { action, ids } = await request.json();

  if (action === 'BATCH_DELETE') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError('ids 为必填数组', 400);
    const placeholders = ids.map(() => '?').join(',');
    await DB.batch([
      DB.prepare(`DELETE FROM categories WHERE id IN (${placeholders})`).bind(...ids),
      DB.prepare(`UPDATE todos SET category_id = '' WHERE category_id IN (${placeholders})`).bind(...ids),
      DB.prepare(`UPDATE todo_templates SET category_id = '' WHERE category_id IN (${placeholders})`).bind(...ids),
    ]);
    return jsonResponse({ success: true, data: { deleted: ids.length } });
  }

  return apiError('未知操作，可用: BATCH_DELETE', 400);
}

// ==================== 路由分发 ====================

export async function handleV1Request(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // API Key 管理（需要 cookie 鉴权，不走 API Key 鉴权）
  if (path === '/api/v1/keys') {
    return handleApiKeys(request, env, url);
  }

  // 以下端点支持 API Key 鉴权
  const apiKey = extractApiKey(request, url);
  if (apiKey) {
    const valid = await verifyApiKey(env.DB, apiKey, env.JWT_SECRET);
    if (!valid) return apiError('Invalid API Key', 401);
    // 更新最后使用时间（异步）
    ctx.waitUntil(touchApiKeyLastUsed(env.DB, apiKey));
  } else {
    // 没有 API Key，尝试 cookie 鉴权
    const authErr = await verifyCookieAuth(request, env);
    if (authErr) return authErr;
  }

  // ---- Todo 路由 ----
  if (path === '/api/v1/todos') {
    return handleV1Todos(request, env, url);
  }

  // POST /api/v1/todos/batch - 批量操作（必须在 :id 正则之前，否则 "batch" 会被当作 :id 拦截）
  if (path === '/api/v1/todos/batch' && request.method === 'POST') {
    return handleV1TodoBatch(request, env.DB);
  }

  // /api/v1/todos/:id
  const todoMatch = path.match(/^\/api\/v1\/todos\/([a-zA-Z0-9_-]+)$/);
  if (todoMatch) {
    const todoId = todoMatch[1];
    if (request.method === 'GET') return handleV1TodoGet(env.DB, todoId);
    if (request.method === 'PUT') return handleV1TodoPut(request, env.DB, todoId);
    if (request.method === 'DELETE') {
      const scope = url.searchParams.get('scope') || undefined;
      return handleV1TodoDelete(env.DB, todoId, scope);
    }
    return apiError('Method Not Allowed', 405);
  }

  // /api/v1/todos/:id/toggle
  const toggleMatch = path.match(/^\/api\/v1\/todos\/([a-zA-Z0-9_-]+)\/toggle$/);
  if (toggleMatch && request.method === 'PATCH') {
    return handleV1TodoToggle(env.DB, toggleMatch[1]);
  }

  // ---- Trash 路由 ----
  if (path === '/api/v1/trash' && request.method === 'GET') {
    return handleV1TrashList(env.DB, url);
  }
  if (path === '/api/v1/trash-action' && request.method === 'POST') {
    return handleV1TrashAction(request, env.DB);
  }

  // ---- Stats 路由 ----
  if (path === '/api/v1/stats' && request.method === 'GET') {
    return handleV1Stats(env.DB, url);
  }

  // ---- Category 路由 ----
  if (path === '/api/v1/categories') {
    return handleV1Categories(request, env, url);
  }

  // POST /api/v1/categories/batch - 批量操作
  if (path === '/api/v1/categories/batch' && request.method === 'POST') {
    return handleV1CategoryBatch(request, env.DB);
  }

  const catMatch = path.match(/^\/api\/v1\/categories\/([a-zA-Z0-9_.-]+)$/);
  if (catMatch) {
    const catId = catMatch[1];
    if (request.method === 'GET') return handleV1CategoryGet(env.DB, catId);
    if (request.method === 'PUT') return handleV1CategoryPut(request, env.DB, catId);
    if (request.method === 'DELETE') return handleV1CategoryDelete(env.DB, catId);
    return apiError('Method Not Allowed', 405);
  }

  return null; // 不匹配，返回 null 让主路由继续处理
}

// 导出 verifyApiKey 供外部使用
export { verifyApiKey, extractApiKey };
