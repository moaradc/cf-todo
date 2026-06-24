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

// 同 date 的 GET /api/v1/todos 串行化，避免并发展开重复事项实例。
// 仅同 isolate 内有效；跨 isolate 仍可能漏过。
const _v1TodosDateChains = new Map();
function _withV1TodosDateLock(date, fn) {
  const prev = _v1TodosDateChains.get(date) || Promise.resolve();
  const next = prev.then(fn, fn);
  const tail = next.catch(() => {});
  _v1TodosDateChains.set(date, tail);
  tail.then(() => setTimeout(() => {
    if (_v1TodosDateChains.get(date) === tail) _v1TodosDateChains.delete(date);
  }, 5000));
  return next;
}

/**
 * 获取 API Key 作用域设置
 * 返回: 'v1' | 'v0' | 'all' | 'disabled'
 */
async function getApiKeyScope(DB) {
  try {
    const row = await DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
    if (row && row.value) {
      const obj = JSON.parse(row.value);
      return obj.apiKeyScope || 'v1';
    }
  } catch (e) {}
  return 'v1';
}

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
  const headerKey = request.headers.get('X-API-Key');
  if (headerKey) return headerKey;
  const queryKey = url.searchParams.get('api_key');
  if (queryKey) return queryKey;
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
      const keyId = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
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
 * 字段名与 v0 (Web API /api/todos) 保持一致，均使用 snake_case
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

  // 解析实例级 time_records（每个 todo 独立存储的完成记录）
  // 格式：[{ s: <epoch_ms>, e: <epoch_ms>, p: <paused_ms> }, ...]
  // - s: 开始时间（epoch ms）
  // - e: 结束时间（epoch ms）
  // - p: 暂停累计时长（ms）
  // - 实际耗时 = e - s - p
  // - s === e 表示零耗时（勾选框完成，仅记录完成时刻）
  // - s < e 表示有耗时（计时器完成）
  // FIFO 保留最近 5 条，末尾为最新一次完成记录
  let timeRecords = [];
  try {
    const raw = row.time_records;
    if (Array.isArray(raw)) {
      timeRecords = raw;
    } else if (typeof raw === 'string' && raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) timeRecords = parsed;
    }
  } catch (e) {
    timeRecords = [];
  }

  // 计算字段：取最新一条 record（数组末尾）计算，对应 Web UI 显示的"完成于 X，耗时 Y"
  // 客户端无需自行解析 epoch ms 或计算耗时，直接用这三个字段即可显示
  let lastCompletedAt = null;      // 最新完成时刻（epoch ms），无记录时 null
  let lastDurationMs = null;       // 最新一次实际耗时（ms），零耗时为 0，无记录时 null
  let isZeroDuration = false;      // 最新记录是否零耗时（s===e），无记录时 false
  if (timeRecords.length > 0) {
    const last = timeRecords[timeRecords.length - 1];
    const s = Number(last.s) || 0;
    const e = Number(last.e) || 0;
    const p = Number(last.p) || 0;
    lastCompletedAt = e > 0 ? e : null;
    isZeroDuration = (s === e);
    lastDurationMs = Math.max(0, e - s - p);
  }

  let rType = row.repeat_type || 'none';
  if (rType !== 'none' && !['daily', 'weekly', 'monthly', 'yearly'].includes(rType)) rType = 'daily';

  return {
    id: row.id,
    parent_id: row.parent_id,
    date: row.date,
    text: row.text,
    time: row.time || '',
    priority: normalizePriority(row.priority || 'low'),
    desc: row.desc || '',
    url: row.url || '',
    copy_text: row.copy_text || '',
    subtasks,
    search_terms: searchTerms,
    done: !!row.done,
    deleted: !!row.deleted,
    repeat_type: rType,
    repeat_custom: row.repeat_custom || '',
    repeat_end: row.repeat_end || '',
    end_time: row.end_time || '',
    category_id: row.category_id || '',
    recurrence_id: row.recurrence_id || '',
    is_exception: !!row.is_exception,
    isSeries: rType !== 'none',
    repeat_interval: row.repeat_interval || 1,
    // 原始记录数组（供需要历史/预估的客户端）
    time_records: timeRecords,
    // 计算字段（取最新一条 record，对应 Web UI 显示）
    last_completed_at: lastCompletedAt,
    last_duration_ms: lastDurationMs,
    is_zero_duration: isZeroDuration,
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

    const execGet = async () => {

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
          'INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id, repeat_interval) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          newId, tpl.parent_id, date, tpl.text, tpl.time || '', tpl.priority || 'low',
          tpl.desc || '', tpl.url || '', tpl.copy_text || '',
          JSON.stringify(parsedSubtasks), '[]',
          0, 0, tpl.repeat_type || 'none', tpl.repeat_custom || '', tpl.repeat_end || '', tpl.end_time || '', tpl.category_id || '', tpl.repeat_interval || 1
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
    }; // end execGet

    if (date) return _withV1TodosDateLock(date, execGet);
    return execGet();
  }

  // POST /api/v1/todos - 创建 todo
  // 请求体字段名与 v0 (Web API) 保持一致，均使用 snake_case
  if (request.method === 'POST') {
    const body = await request.json();
    const { date, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_end, end_time, category_id, repeat_interval } = body;

    if (!date || !text) {
      return apiError('date 和 text 为必填项', 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return apiError('date 格式应为 YYYY-MM-DD', 400);
    }

    const id = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const rptType = repeat_type || 'none';
    const catId = category_id || '';
    const rEnd = repeat_end || '';
    const eTime = end_time || '';
    const rInterval = repeat_interval || 1;
    const normPriority = normalizePriority(priority || 'low');
    // 规范化 subtasks：字符串→{text, done:false} 对象
    const normalizedSubtasks = (subtasks || []).map(s => {
      if (typeof s === 'string') return { text: s, done: false };
      if (s && typeof s === 'object' && s.text) return s;
      return null;
    }).filter(Boolean);
    const normalizedSearchTerms = (search_terms || []).map(w => {
      if (typeof w === 'string') return { text: w, done: false };
      if (w && typeof w === 'object' && w.text) return w;
      return null;
    }).filter(Boolean);
    const subtasksStr = JSON.stringify(normalizedSubtasks);
    const searchTermsStr = JSON.stringify(normalizedSearchTerms);

    await DB.prepare(
      'INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id, repeat_interval) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      id, id, date, text, time || '', normPriority,
      desc || '', url || '', copy_text || '', subtasksStr, searchTermsStr,
      0, 0, rptType, '', rEnd, eTime, catId, rInterval
    ).run();

    if (rptType !== 'none') {
      await DB.prepare(
        'INSERT INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id, repeat_interval) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        id, text, time || '', normPriority, desc || '', url || '', copy_text || '',
        subtasksStr, searchTermsStr, rptType, '', rEnd, eTime, date, '[]', catId, rInterval
      ).run();
    }

    return jsonResponse({
      success: true,
      data: { id, date, text, repeat_type: rptType, category_id: catId }
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
// 请求体字段名与 v0 (Web API) 保持一致，均使用 snake_case
async function handleV1TodoPut(request, DB, todoId) {
  const existing = await DB.prepare('SELECT * FROM todos WHERE id = ?').bind(todoId).first();
  if (!existing) return apiError('Todo 不存在', 404);

  const body = await request.json();
  const parentId = existing.parent_id; // 始终使用数据库中的 parent_id，不可被用户篡改
  const isSeries = existing.repeat_type && existing.repeat_type !== 'none';
  // 重复 todo 未指定 scope 时，默认 scope=this（仅更新此实例）
  const scope = isSeries && (!body.scope || body.scope === 'none') ? 'this' : (body.scope || 'none');

  const newValues = {
    text: body.text !== undefined ? body.text : existing.text,
    time: body.time !== undefined ? body.time : (existing.time || ''),
    priority: body.priority !== undefined ? normalizePriority(body.priority) : normalizePriority(existing.priority || 'low'),
    desc: body.desc !== undefined ? body.desc : (existing.desc || ''),
    url: body.url !== undefined ? body.url : (existing.url || ''),
    copy_text: body.copy_text !== undefined ? body.copy_text : (existing.copy_text || ''),
    subtasks: JSON.stringify(body.subtasks !== undefined ? body.subtasks : parseJsonField(existing.subtasks)),
    search_terms: JSON.stringify(body.search_terms !== undefined ? body.search_terms : parseJsonField(existing.search_terms)),
    repeat_type: body.repeat_type !== undefined ? body.repeat_type : (existing.repeat_type || 'none'),
    repeat_custom: '',
    repeat_end: body.repeat_end !== undefined ? body.repeat_end : (existing.repeat_end || ''),
    end_time: body.end_time !== undefined ? body.end_time : (existing.end_time || ''),
    category_id: body.category_id !== undefined ? body.category_id : (existing.category_id || ''),
    date: body.date !== undefined ? body.date : existing.date,
    repeat_interval: body.repeat_interval !== undefined ? body.repeat_interval : (existing.repeat_interval || 1),
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
        'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=?, repeat_interval=? WHERE id=?'
      ).bind(newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copy_text, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newValues.category_id, newValues.repeat_interval, todoId).run();
      await DB.prepare(
        'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id, repeat_interval) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(todoId, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copy_text, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newDate, '[]', newValues.category_id, newValues.repeat_interval).run();
    } else if (parentId && parentId !== todoId) {
      // 重复 → 单次：脱离系列
      await DB.prepare(
        'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', end_time=?, category_id=?, repeat_interval=1 WHERE id=?'
      ).bind(todoId, newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copy_text, subtasksStr, searchTermsStr, newValues.end_time, newValues.category_id, todoId).run();
      const tpl = await DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parentId).first();
      if (tpl) {
        const newExdates = addExdate(tpl.exdates || '[]', date);
        await DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(newExdates, parentId).run();
      }
    } else {
      // 普通更新
      await DB.prepare(
        'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=?, repeat_interval=? WHERE id=?'
      ).bind(newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copy_text, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newValues.category_id, newValues.repeat_interval, todoId).run();
    }
  } else {
    const actions = computeUpdateActions({ task: { ...existing, parent_id: parentId, isSeries }, date, scope, newValues, newDate });

    // Split 系列时生成新 parent_id
    let splitNewPid = null;
    if (actions.currentTodo && actions.currentTodo.splitSeries) {
      splitNewPid = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    }

    if (actions.currentTodo) {
      const cv = actions.currentTodo;
      if (cv.splitSeries) {
        // Split: 脱离旧系列，加入新系列（thisAndFuture + isRecurring）
        await DB.prepare(
          'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=?, repeat_interval=? WHERE id=?'
        ).bind(splitNewPid, newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copy_text, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newValues.category_id, newValues.repeat_interval, todoId).run();
      } else if (cv.detachFromSeries) {
        // 脱离系列，变为单次任务（"仅此项"或 thisAndFuture 改为不重复）
        await DB.prepare(
          'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', end_time=?, category_id=?, repeat_interval=1 WHERE id=?'
        ).bind(todoId, newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copy_text, subtasksStr, searchTermsStr, newValues.end_time, newValues.category_id, todoId).run();
      } else if (cv.isRecurring) {
        await DB.prepare(
          'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=?, repeat_interval=? WHERE id=?'
        ).bind(newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copy_text, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newValues.category_id, newValues.repeat_interval, todoId).run();
      } else {
        await DB.prepare(
          'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', category_id=?, repeat_interval=1 WHERE id=?'
        ).bind(newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copy_text, subtasksStr, searchTermsStr, newValues.category_id, todoId).run();
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
        // Split: 删除旧系列中当前及之后的实例（新模板会重新生成）
        await DB.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND date >= ? AND deleted = 0').bind(parentId, todoId, date).run();
      } else {
        await DB.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND date > ? AND deleted = 0').bind(parentId, todoId, date).run();
      }
    } else if (scope === 'all') {
      if (rptType !== 'none') {
        const tmpl = actions.template;
        // 重复规则变更或日期变更时：删除其他实例，由模板重新生成
        // 仅非重复属性变更时：原地更新其他实例
        if (dateChanged || (tmpl && tmpl.recurrenceChanged)) {
          await DB.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0').bind(parentId, todoId).run();
        } else {
          await DB.prepare(
            'UPDATE todos SET text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=?, repeat_interval=? WHERE parent_id=? AND id != ? AND deleted = 0'
          ).bind(newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copy_text, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newValues.category_id, newValues.repeat_interval, parentId, todoId).run();
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
      } else if (tmpl.type === 'update_all') {
        if (rptType !== 'none') {
          let existingExdates = '[]';
          try {
            const existingTpl = await DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parentId).first();
            if (existingTpl) existingExdates = existingTpl.exdates || '[]';
          } catch (e) {}
          await DB.prepare(
            'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id, repeat_interval) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(parentId, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copy_text, subtasksStr, searchTermsStr, rptType, '', newValues.repeat_end, newValues.end_time, newDate, existingExdates, newValues.category_id, newValues.repeat_interval).run();
        }
      } else if (tmpl.type === 'delete') {
        await DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parentId).run();
      }
    }

    // Execute insertTemplate action (Split: 创建新系列模板)
    if (actions.insertTemplate && splitNewPid) {
      const it = actions.insertTemplate;
      await DB.prepare(
        'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id, repeat_interval) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        splitNewPid, it.text, it.time, it.priority, it.desc, it.url, it.copy_text,
        it.subtasks, it.search_terms, it.repeat_type, it.repeat_custom, it.repeat_end,
        it.end_time, it.anchor_date, it.exdates, it.category_id, it.repeat_interval
      ).run();
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
  const isSeries = existing.repeat_type && existing.repeat_type !== 'none';
  const date = existing.date;

  // 重复 todo 未指定 scope 时，默认 scope=this（仅删除此实例，加 exdate 防止重新生成）
  const effectiveScope = isSeries && !scope ? 'this' : scope;

  if (!isSeries || !effectiveScope) {
    await DB.prepare('UPDATE todos SET deleted = 1 WHERE id = ?').bind(todoId).run();
  } else {
    const actions = computeDeleteActions({ task: { ...existing, parent_id: parentId, isSeries }, date, scope: effectiveScope });

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
        // thisAndFuture: 截断模板，软删除当前及以后实例并脱钩为单次快照
        // 关键修复: 被删实例在回收站中 repeat_type='none', parent_id=id，恢复时不再重新激活循环
        // 对齐 Google Tasks "停止重复后不可再循环" + RFC 5545 RANGE=THISANDFUTURE 语义
        const prevDate = getPreviousDate(date);
        if (tmpl.alsoDeleteFuture) {
          await DB.prepare(
            'UPDATE todos SET deleted = 1, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', repeat_interval=1, parent_id=id WHERE parent_id=? AND date >= ?'
          ).bind(parentId, date).run();
        }
        await DB.prepare('UPDATE todos SET repeat_end=? WHERE parent_id=? AND date < ? AND repeat_type != \'none\'').bind(prevDate, parentId, date).run();
        await DB.prepare('UPDATE todo_templates SET repeat_end=? WHERE parent_id=?').bind(prevDate, parentId).run();
      } else if (tmpl.type === 'delete_all') {
        // all: 软删除所有实例(含回收站同系列项)并脱钩为单次快照，删除模板
        // 关键修复: 避免恢复时从回收站行重建整个循环系列
        await DB.prepare(
          'UPDATE todos SET deleted = 1, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', repeat_interval=1, parent_id=id WHERE parent_id=?'
        ).bind(parentId).run();
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
// 可选 body: { record: { s, e, p } }
// - done 0→1 且 record 合法：写入实例级 time_records（与 /api/todo-action TOGGLE_DONE 一致）
//   - 零耗时（s===e）：仅记录完成时刻，不写模板级（避免污染 predictDuration）
//   - 真实耗时（s<e）：实例级 + 模板级双写（与 TIMER_COMPLETE 一致）
// - done 1→0：清空实例级 time_records（与 /api/todo-action TOGGLE_DONE 一致）
// - 无 record 或 record 非法：仅更新 done 字段（向后兼容）
async function handleV1TodoToggle(request, DB, todoId) {
  const existing = await DB.prepare('SELECT done, parent_id FROM todos WHERE id = ?').bind(todoId).first();
  if (!existing) return apiError('Todo 不存在', 404);
  const newDone = existing.done ? 0 : 1;

  // 解析可选 body（PATCH 可能无 body 或 body 无 record，需容错）
  let record = null;
  try {
    if (request && typeof request.json === 'function') {
      const body = await request.json();
      if (body && typeof body === 'object' && body.record) {
        record = body.record;
      }
    }
  } catch (e) {
    // body 解析失败：忽略 record，仅切换 done（向后兼容）
    record = null;
  }

  if (newDone) {
    // 勾选完成：先更新 done，再尝试写入 time_records
    // 写入失败不影响 done 状态（与 /api/todo-action TOGGLE_DONE 兜底逻辑一致）
    try {
      await DB.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(todoId).run();
    } catch (e) {
      // 极端情况：DB 异常，仍尝试无 time_records 列的兜底（老数据库兼容）
      try { await DB.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(todoId).run(); } catch (e2) {}
    }
    if (record) {
      await writeTimerRecord(DB, todoId, existing.parent_id, record);
    }
  } else {
    // 取消勾选：清空实例级 time_records
    try {
      await DB.prepare('UPDATE todos SET done = 0, time_records = ? WHERE id = ?')
        .bind('[]', todoId).run();
    } catch (e) {
      // 兜底：仅更新 done（极端情况：列不存在等）
      await DB.prepare('UPDATE todos SET done = 0 WHERE id = ?').bind(todoId).run();
    }
  }

  return jsonResponse({ success: true, data: { id: todoId, done: !!newDone } });
}

// ==================== 计时记录写入工具函数 ====================
// 校验并写入 time_records（实例级 + 模板级）
// - 实例级：所有合法 record 都写（FIFO 5）
// - 模板级：仅真实耗时（s<e）写（FIFO 10），零耗时跳过
// 非法 record 静默跳过（不影响调用方主流程）
// 所有 DB 异常吞掉并记录日志，避免影响 done 状态
async function writeTimerRecord(DB, todoId, parentId, record) {
  // 校验
  if (!record || typeof record !== 'object') return;
  if (typeof record.s !== 'number' || typeof record.e !== 'number') return;
  const s = Math.floor(record.s);
  const e = Math.floor(record.e);
  const p = Math.floor(record.p || 0);
  const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
  // 校验：s>0, e>=s, 时长<=7d, paused 合理
  if (!(s > 0 && e >= s && (e - s) <= MAX_DURATION_MS && p >= 0 && p <= (e - s))) {
    return;
  }
  const isZeroDuration = (s === e);

  // 实例级写入
  try {
    const cur = await DB.prepare('SELECT time_records FROM todos WHERE id = ?').bind(todoId).first();
    if (cur) {
      let instArr = [];
      try {
        instArr = typeof cur.time_records === 'string'
          ? JSON.parse(cur.time_records || '[]')
          : cur.time_records;
      } catch (e2) { instArr = []; }
      if (!Array.isArray(instArr)) instArr = [];
      instArr.push({ s, e, p });
      if (instArr.length > 5) instArr = instArr.slice(instArr.length - 5);
      await DB.prepare('UPDATE todos SET time_records = ? WHERE id = ?')
        .bind(JSON.stringify(instArr), todoId).run();
    }
  } catch (eInst) {
    console.error('v1 per-instance record write failed:', eInst);
  }

  // 模板级写入（仅真实耗时，零耗时跳过避免污染 predictDuration）
  if (!isZeroDuration && parentId) {
    try {
      const tpl = await DB.prepare('SELECT time_records FROM todo_templates WHERE parent_id = ?').bind(parentId).first();
      if (tpl) {
        let arr = [];
        try { arr = Array.isArray(tpl.time_records) ? tpl.time_records : JSON.parse(tpl.time_records || '[]'); } catch (e2) { arr = []; }
        if (!Array.isArray(arr)) arr = [];
        arr.push({ s, e, p });
        if (arr.length > 10) arr = arr.slice(arr.length - 10);
        await DB.prepare('UPDATE todo_templates SET time_records = ? WHERE parent_id = ?')
          .bind(JSON.stringify(arr), parentId).run();
      }
    } catch (e3) {
      console.error('v1 template record write failed:', e3);
    }
  }
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

    const id = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
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
// body: { action, ids, doneStatus, timerRecords? }
// timerRecords: [{ id, parentId, record: {s, e, p} }]（可选）
// - BATCH_TOGGLE_DONE + doneStatus=true：
//   - 先批量 UPDATE done=1
//   - 再对 timerRecords 中每条 record 写入 time_records
//     - 真实耗时（s<e）：实例级 + 模板级双写
//     - 零耗时（s===e）：仅实例级
//   - ids 中有但 timerRecords 没有的：done=1 但无 time_records（向后兼容）
// - BATCH_TOGGLE_DONE + doneStatus=false：批量 UPDATE done=0, time_records='[]'
async function handleV1TodoBatch(request, DB) {
  const { action, ids, doneStatus, timerRecords } = await request.json();

  if (action === 'BATCH_TOGGLE_DONE') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError('ids 为必填数组', 400);
    if (ids.length > 100) return apiError('单次最多100条', 400);
    const placeholders = ids.map(() => '?').join(',');

    if (doneStatus) {
      // 批量完成：先更新 done=1
      try {
        await DB.prepare(`UPDATE todos SET done = 1 WHERE id IN (${placeholders})`)
          .bind(...ids).run();
      } catch (e) {
        // 极端情况：DB 异常，仍尝试（老数据库兼容）
        try { await DB.prepare(`UPDATE todos SET done = 1 WHERE id IN (${placeholders})`).bind(...ids).run(); } catch (e2) {}
      }

      // 对带 record 的 todo 写入 time_records（与 /api/todo-action BATCH_TOGGLE_DONE 一致）
      if (Array.isArray(timerRecords) && timerRecords.length > 0) {
        for (const item of timerRecords) {
          if (!item || !item.id || !item.record) continue;
          // 写入失败不影响主流程（writeTimerRecord 内部已 try/catch）
          await writeTimerRecord(DB, item.id, item.parentId, item.record);
        }
      }
    } else {
      // 批量取消完成：done=0 + 清空 time_records
      try {
        await DB.prepare(`UPDATE todos SET done = 0, time_records = ? WHERE id IN (${placeholders})`)
          .bind('[]', ...ids).run();
      } catch (e) {
        // 兜底：仅更新 done（极端情况：列不存在等）
        await DB.prepare(`UPDATE todos SET done = 0 WHERE id IN (${placeholders})`)
          .bind(...ids).run();
      }
    }

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
    // 仅当回收站行仍携带循环属性时才需判定 (this-scope 删除, 或旧版未脱钩的 thisAndFuture/all 行)
    // 新版 thisAndFuture/all 删除已在删除时脱钩为单次快照 (repeat_type='none', parent_id=id)，此处直接跳过。
    // 对齐 RFC 5545 + Google Tasks 标准：停止/删除系列后恢复，实例为单次任务，不再重新激活循环。
    if (t.repeat_type && t.repeat_type !== 'none' && t.parent_id && t.parent_id !== id) {
      // 检查同日期是否已有活跃实例（避免恢复后出现重复）
      const existing = await DB.prepare(
        'SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 AND id != ? LIMIT 1'
      ).bind(t.parent_id, t.date, id).first();
      if (existing) {
        // 同日期已有活跃实例，恢复的实例脱离模板变为单次任务
        await DB.prepare(
          'UPDATE todos SET parent_id=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', repeat_interval=1 WHERE id=?'
        ).bind(id, id).run();
      } else {
        // 以模板的 repeat_end 为准判定系列是否仍覆盖此日期 (旧版按实例 repeat_end 判定，但实例 repeat_end 常为空导致漏判)
        const tpl = await DB.prepare('SELECT repeat_end, exdates FROM todo_templates WHERE parent_id = ?').bind(t.parent_id).first();
        if (tpl && (tpl.repeat_end === '' || tpl.repeat_end == null || tpl.repeat_end >= t.date)) {
          // 模板仍覆盖此日期: 视为"仅此日程"删除的恢复，从EXDATE移除此日期，重新并入系列
          const currentExdates = tpl.exdates || '[]';
          const newExdates = removeExdate(currentExdates, t.date);
          await DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(newExdates, t.parent_id).run();
        } else {
          // 模板已删除(旧版 all)或已截断至此日期之前(旧版 thisAndFuture): 无法并入系列，脱钩为单次任务
          await DB.prepare(
            'UPDATE todos SET parent_id=?, repeat_type=\'none\', repeat_custom=\'\', repeat_end=\'\', repeat_interval=1 WHERE id=?'
          ).bind(id, id).run();
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

  if (action === 'CLEAR_ALL_DATA') {
    await DB.batch([
      DB.prepare('DELETE FROM todos'),
      DB.prepare('DELETE FROM todo_templates'),
      DB.prepare('DELETE FROM settings'),
      DB.prepare('DELETE FROM categories'),
    ]);
    return jsonResponse({ success: true });
  }

  if (action === 'BATCH_RESTORE') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError('ids 为必填数组', 400);
    const placeholders = ids.map(() => '?').join(',');
    const tasks = await DB.prepare(`SELECT id, parent_id, date, repeat_type, repeat_end FROM todos WHERE id IN (${placeholders})`).bind(...ids).all();
    await DB.prepare(`UPDATE todos SET deleted = 0 WHERE id IN (${placeholders})`).bind(...ids).run();
    // 仅回收站行仍携带循环属性的 (this-scope 删除或旧版未脱钩行) 需要判定
    // 新版 thisAndFuture/all 删除时已脱钩为单次 (repeat_type='none', parent_id=id)，跳过
    // 对齐 RFC 5545 + Google Tasks: 模板已删除/截断的，恢复为单次任务，不重建系列
    const detachIds = [];
    const exdateUpdates = {};  // parent_id -> [dates] (并入系列时需从EXDATE移除)
    for (const t of (tasks.results || [])) {
      if (!(t.repeat_type && t.repeat_type !== 'none' && t.parent_id && t.parent_id !== t.id)) continue;
      // 检查同日期是否已有活跃实例
      const existing = await DB.prepare(
        'SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 AND id != ? LIMIT 1'
      ).bind(t.parent_id, t.date, t.id).first();
      if (existing) {
        detachIds.push(t.id);
        continue;
      }
      // 以模板 repeat_end 为准判定系列是否仍覆盖此日期
      const tpl = await DB.prepare('SELECT repeat_end FROM todo_templates WHERE parent_id = ?').bind(t.parent_id).first();
      if (tpl && (tpl.repeat_end === '' || tpl.repeat_end == null || tpl.repeat_end >= t.date)) {
        // 模板仍覆盖此日期: 并入系列，记录需移除的EXDATE
        if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
        exdateUpdates[t.parent_id].push(t.date);
      } else {
        // 模板已删除或已截断至此日期之前: 脱钩为单次任务
        detachIds.push(t.id);
      }
    }
    if (detachIds.length > 0) {
      const ph = detachIds.map(() => '?').join(',');
      await DB.prepare(`UPDATE todos SET parent_id=id, repeat_type='none', repeat_custom='', repeat_end='', repeat_interval=1 WHERE id IN (${ph})`).bind(...detachIds).run();
    }
    for (const pid of Object.keys(exdateUpdates)) {
      const tpl = await DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(pid).first();
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

  return apiError('未知操作，可用: RESTORE, DELETE_PERMANENT, CLEAR_ALL, CLEAR_ALL_DATA, BATCH_RESTORE, BATCH_DELETE_PERMANENT', 400);
}

// ==================== 统计 ====================

// GET /api/v1/stats - 获取统计数据
// 服务端聚合：D1 batch 一次往返跑 6 条 GROUP BY 查询，把数万行原始数据
// 压缩为几十行聚合结果，Worker 内存与网络出口字节下降一个数量级。
// 索引依赖：idx_todos_stats(date, deleted, priority, done, category_id, time)
async function handleV1Stats(DB, url) {
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!start || !end) return apiError('start 和 end 为必填参数 (YYYY-MM-DD)', 400);

  const baseWhere = 'FROM todos WHERE date >= ?1 AND date <= ?2 AND deleted = 0';

  const batchResults = await DB.batch([
    // 1) 按日期聚合：byDate[date] = { total, done }
    DB.prepare(
      `SELECT date, COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done ${baseWhere} GROUP BY date`
    ).bind(start, end),
    // 2) 按分类聚合：byCategory[category_id] = { total, done }（空 category_id 归为 ''）
    DB.prepare(
      `SELECT COALESCE(NULLIF(category_id, ''), '') AS category_id, COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done ${baseWhere} GROUP BY COALESCE(NULLIF(category_id, ''), '')`
    ).bind(start, end),
    // 3) 按优先级 × 完成度聚合
    DB.prepare(
      `SELECT priority, done, COUNT(*) AS cnt ${baseWhere} GROUP BY priority, done`
    ).bind(start, end),
    // 4) 按周日 × 完成度聚合：weekdayCounts[0..6]（0=周日）
    DB.prepare(
      `SELECT CAST(strftime('%w', date) AS INTEGER) AS weekday, done, COUNT(*) AS cnt ${baseWhere} GROUP BY weekday, done`
    ).bind(start, end),
    // 5) 按时段聚合：hourBuckets[0..3]（0=凌晨0-6, 1=上午6-12, 2=下午12-18, 3=晚上18-24）
    DB.prepare(
      `SELECT CASE` +
      ` WHEN time IS NULL OR time = '' THEN -1` +
      ` WHEN CAST(substr(time, 1, 2) AS INTEGER) < 6 THEN 0` +
      ` WHEN CAST(substr(time, 1, 2) AS INTEGER) < 12 THEN 1` +
      ` WHEN CAST(substr(time, 1, 2) AS INTEGER) < 18 THEN 2` +
      ` ELSE 3 END AS bucket,` +
      ` COUNT(*) AS cnt ${baseWhere} GROUP BY bucket`
    ).bind(start, end),
    // 6) 总量汇总
    DB.prepare(
      `SELECT COUNT(*) AS total,` +
      ` SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done,` +
      ` SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END) AS undone,` +
      ` COUNT(DISTINCT date) AS active_days ${baseWhere}`
    ).bind(start, end),
  ]);

  // 组装响应：保持 v1 字段名风格（byDate/byPriority/byCategory），新增更多维度
  const byDate = {};
  for (const r of (batchResults[0].results || [])) {
    byDate[r.date] = { total: r.total, done: r.done };
  }
  const byCategory = {};
  let noCategoryCount = { total: 0, done: 0 };
  for (const r of (batchResults[1].results || [])) {
    if (r.category_id === '') {
      noCategoryCount = { total: r.total, done: r.done };
    } else {
      byCategory[r.category_id] = { total: r.total, done: r.done };
    }
  }
  // 优先级 × 完成度
  const byPriority = { high: 0, med: 0, low: 0 };
  const byPriorityDone = { high: 0, med: 0, low: 0 };
  for (const r of (batchResults[2].results || [])) {
    const p = (r.priority === 'high' || r.priority === 'med' || r.priority === 'low') ? r.priority : 'low';
    byPriority[p] += r.cnt;
    if (r.done === 1) byPriorityDone[p] += r.cnt;
  }
  // 周日分布
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  const byWeekdayDone = [0, 0, 0, 0, 0, 0, 0];
  for (const r of (batchResults[3].results || [])) {
    if (r.weekday >= 0 && r.weekday <= 6) {
      byWeekday[r.weekday] += r.cnt;
      if (r.done === 1) byWeekdayDone[r.weekday] += r.cnt;
    }
  }
  // 时段分布
  const byHourBucket = [0, 0, 0, 0];
  for (const r of (batchResults[4].results || [])) {
    if (r.bucket >= 0 && r.bucket <= 3) byHourBucket[r.bucket] = r.cnt;
  }
  // 总量
  const summary = (batchResults[5].results || [])[0] || { total: 0, done: 0, undone: 0, active_days: 0 };

  const stats = {
    total: summary.total || 0,
    done: summary.done || 0,
    undone: summary.undone || 0,
    activeDays: summary.active_days || 0,
    byDate,
    byCategory,
    noCategoryCount,
    byPriority,
    byPriorityDone,
    byWeekday,
    byWeekdayDone,
    byHourBucket,
  };
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

// ==================== 设置 ====================

// GET /api/v1/settings - 获取应用配置
async function handleV1SettingsGet(DB) {
  const record = await DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
  let settingsObj = {};
  if (record && record.value) {
    try { settingsObj = JSON.parse(record.value); } catch (e) {}
  }
  return jsonResponse({ success: true, data: settingsObj });
}

// POST /api/v1/settings - 保存应用配置（整体覆盖）
async function handleV1SettingsPost(request, DB) {
  const data = await request.json();
  await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)").bind(JSON.stringify(data)).run();
  return jsonResponse({ success: true });
}

// ==================== 自定义代码 ====================

// GET /api/v1/custom-code - 获取自定义头部+内容代码
async function handleV1CustomCodeGet(DB) {
  const headerRecord = await DB.prepare("SELECT value FROM settings WHERE key = 'custom_header'").first();
  const contentRecord = await DB.prepare("SELECT value FROM settings WHERE key = 'custom_content'").first();
  return jsonResponse({
    success: true,
    data: {
      customHeader: headerRecord?.value || '',
      customContent: contentRecord?.value || '',
    }
  });
}

// POST /api/v1/custom-code - 保存自定义代码
async function handleV1CustomCodePost(request, DB) {
  const { customHeader, customContent } = await request.json();
  const stmts = [];
  if (customHeader !== undefined) {
    stmts.push(DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_header', ?)").bind(customHeader));
  }
  if (customContent !== undefined) {
    stmts.push(DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_content', ?)").bind(customContent));
  }
  if (stmts.length > 0) {
    await DB.batch(stmts);
  }
  return jsonResponse({ success: true });
}

// GET /api/v1/custom-header - 获取自定义头部代码（纯文本）
async function handleV1CustomHeaderGet(DB) {
  const record = await DB.prepare("SELECT value FROM settings WHERE key = 'custom_header'").first();
  return new Response(record?.value || '', { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
}

// GET /api/v1/custom-content - 获取自定义内容代码（纯文本）
async function handleV1CustomContentGet(DB) {
  const record = await DB.prepare("SELECT value FROM settings WHERE key = 'custom_content'").first();
  return new Response(record?.value || '', { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
}

// ==================== 自定义颜色 ====================

// GET /api/v1/custom-colors - 获取自定义颜色列表
async function handleV1CustomColorsGet(DB) {
  const record = await DB.prepare("SELECT value FROM settings WHERE key = 'customColors'").first();
  let customColors = [];
  if (record && record.value) {
    try { customColors = JSON.parse(record.value); } catch (e) {}
  }
  return jsonResponse({ success: true, data: customColors });
}

// POST /api/v1/custom-colors - 保存自定义颜色列表
async function handleV1CustomColorsPost(request, DB) {
  const { colors } = await request.json();
  if (!Array.isArray(colors)) {
    return apiError('colors 必须为数组', 400);
  }
  await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('customColors', ?)").bind(JSON.stringify(colors)).run();
  return jsonResponse({ success: true, data: colors });
}

// ==================== Todo 子任务/搜索词独立更新 ====================

// PATCH /api/v1/todos/:id/subtasks - 更新子任务
async function handleV1TodoSubtasks(request, DB, todoId) {
  const { subtasks } = await request.json();
  if (!Array.isArray(subtasks)) return apiError('subtasks 必须为数组', 400);
  const existing = await DB.prepare('SELECT id FROM todos WHERE id = ?').bind(todoId).first();
  if (!existing) return apiError('待办不存在', 404);
  await DB.prepare('UPDATE todos SET subtasks = ? WHERE id = ?').bind(JSON.stringify(subtasks), todoId).run();
  return jsonResponse({ success: true });
}

// PATCH /api/v1/todos/:id/search-terms - 更新搜索词
// 请求体字段名与 v0 保持一致：search_terms
async function handleV1TodoSearchTerms(request, DB, todoId) {
  const { search_terms } = await request.json();
  if (!Array.isArray(search_terms)) return apiError('search_terms 必须为数组', 400);
  const existing = await DB.prepare('SELECT id FROM todos WHERE id = ?').bind(todoId).first();
  if (!existing) return apiError('待办不存在', 404);
  await DB.prepare('UPDATE todos SET search_terms = ? WHERE id = ?').bind(JSON.stringify(search_terms), todoId).run();
  return jsonResponse({ success: true });
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
    // 检查 API Key 作用域
    const scope = await getApiKeyScope(env.DB);
    if (scope === 'disabled') return apiError('API Key 已被禁用', 403);
    if (scope === 'v0') return apiError('API Key 仅允许访问 v0 接口', 403);
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
    return handleV1TodoToggle(request, env.DB, toggleMatch[1]);
  }

  // /api/v1/todos/:id/subtasks
  const subtasksMatch = path.match(/^\/api\/v1\/todos\/([a-zA-Z0-9_-]+)\/subtasks$/);
  if (subtasksMatch && request.method === 'PATCH') {
    return handleV1TodoSubtasks(request, env.DB, subtasksMatch[1]);
  }

  // /api/v1/todos/:id/search-terms
  const searchTermsMatch = path.match(/^\/api\/v1\/todos\/([a-zA-Z0-9_-]+)\/search-terms$/);
  if (searchTermsMatch && request.method === 'PATCH') {
    return handleV1TodoSearchTerms(request, env.DB, searchTermsMatch[1]);
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

  // ---- Settings 路由 ----
  if (path === '/api/v1/settings') {
    if (request.method === 'GET') return handleV1SettingsGet(env.DB);
    if (request.method === 'POST') return handleV1SettingsPost(request, env.DB);
    return apiError('Method Not Allowed', 405);
  }

  // ---- Custom Code 路由 ----
  if (path === '/api/v1/custom-code') {
    if (request.method === 'GET') return handleV1CustomCodeGet(env.DB);
    if (request.method === 'POST') return handleV1CustomCodePost(request, env.DB);
    return apiError('Method Not Allowed', 405);
  }

  // ---- Custom Header/Content/Colors 路由 ----
  if (path === '/api/v1/custom-header' && request.method === 'GET') {
    return handleV1CustomHeaderGet(env.DB);
  }
  if (path === '/api/v1/custom-content' && request.method === 'GET') {
    return handleV1CustomContentGet(env.DB);
  }
  if (path === '/api/v1/custom-colors') {
    if (request.method === 'GET') return handleV1CustomColorsGet(env.DB);
    if (request.method === 'POST') return handleV1CustomColorsPost(request, env.DB);
    return apiError('Method Not Allowed', 405);
  }

  return null; // 不匹配，返回 null 让主路由继续处理
}

// 导出 verifyApiKey 供外部使用
export { verifyApiKey, extractApiKey, getApiKeyScope };
