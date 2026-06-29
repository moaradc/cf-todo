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
  normalizePriority,
  parseJsonField,
  validateStatsDateRange,
} from './utils.js';

async function safeParseJson(request) {
  try {
    return await request.json();
  } catch (e) {
    return null; // 调用方检查 null 即可
  }
}

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

import {
  isOccurrenceOnDate,
  computeDeleteActions,
  computeUpdateActions,
  addExdate,
  removeExdate,
  getPreviousDate,
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
    const parsed = await safeParseJson(request);
    if (!parsed) return apiError('请求体不是有效的 JSON', 400);
    const { action, id, name } = parsed;

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

// parseJsonField 已抽到 utils.js，供 V0 / V1 共享

// normalizePriority 已抽到 utils.js，供 V0 / V1 共享

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

  // 解析实例级 time_records
  // 格式：[{ s, e, p }, ...]，实际耗时 = e - s - p
  // - s === e：零耗时（勾选框完成，仅记录完成时刻）
  // - s < e：有耗时（计时器完成）
  // 截断规则：碎时记不截断（保留全部 session），普通 todo FIFO 5
  let time_records = [];
  try {
    const raw = row.time_records;
    if (Array.isArray(raw)) {
      time_records = raw;
    } else if (typeof raw === 'string' && raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) time_records = parsed;
    }
  } catch (e) {
    time_records = [];
  }

  // 计算字段：取最新一条 record（末尾）计算，对应 Web UI 显示
  let last_completed_at = null;      // 最新完成时刻（epoch ms）
  let last_duration_ms = null;       // 最新一次实际耗时（ms），零耗时为 0
  let is_zero_duration = false;      // 最新记录是否零耗时（s===e）
  if (time_records.length > 0) {
    const last = time_records[time_records.length - 1];
    const s = Number(last.s) || 0;
    const e = Number(last.e) || 0;
    const p = Number(last.p) || 0;
    last_completed_at = e > 0 ? e : null;
    is_zero_duration = (s === e);
    last_duration_ms = Math.max(0, e - s - p);
  }

  // v3.0 响应序列化：type 三态 + rrule + anchor_date + exdates
  let type = row.type || 'none';
  if (type !== 'none' && type !== 'fragment' && type !== 'recurring') type = 'none';

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
    // v3.0 规范字段
    type: type,
    rrule: row.rrule || '',
    anchor_date: row.anchor_date || '',
    exdates: row.exdates || '[]',
    end_time: row.end_time || '',
    category_id: row.category_id || '',
    recurrence_id: row.recurrence_id || '',
    is_exception: !!row.is_exception,
    // is_series: 派生字段（type === 'recurring'）
    is_series: type === 'recurring',
    // 原始记录数组（供需要历史/预估的客户端）
    time_records: time_records,
    // 计算字段（取最新一条 record，对应 Web UI 显示）
    last_completed_at: last_completed_at,
    last_duration_ms: last_duration_ms,
    is_zero_duration: is_zero_duration,
    // fragment_anchor: 碎时记起始日期（权威副本，不受完成/取消完成影响）
    fragment_anchor: row.fragment_anchor || '',
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
  const DB = request.method === 'GET' && env.DB.withSession
    ? env.DB.withSession('first-primary')
    : env.DB;

  // GET /api/v1/todos - 查询 todo 列表
  if (request.method === 'GET') {
    const date = url.searchParams.get('date');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const category_id = url.searchParams.get('category_id');
    const done = url.searchParams.get('done'); // 'true' | 'false' | 不传=全部
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 500);
    // Free 计划依据：D1 是单线程，OFFSET N 需扫描并丢弃前 N 行，大 offset 显著增加 SQL duration 和 CPU 10ms 预算消耗；
    // 10000 / 500(最大 limit) = 20 页，覆盖任何合理分页场景
    const offset = Math.min(Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0), 10000);
    // 适用场景：程序化调用方需降低 Worker CPU time（Free 10ms 限制），或需自定义展开逻辑
    // 默认 true（向后兼容）；仅在 date 查询时有效，范围查询本就不展开
    const expand = url.searchParams.get('expand') !== 'false';

    const execGet = async () => {

    let conditions = ['deleted = 0'];
    let params = [];

    if (date) {
      // 按日期查询：碎时记 todo 的可见性规则
      // - 普通 todo: date = ?
      // - 碎时记已完成: date = ?（完成时冻结）
      // - 碎时记未完成: date = '' OR date <= ?（任意日期或开始日期 <= 当前日期）
      conditions.push(`(
        (type != 'fragment' AND date = ?)
        OR (type = 'fragment' AND done = 1 AND date = ?)
        OR (type = 'fragment' AND done = 0 AND (date = '' OR date <= ?))
      )`);
      params.push(date, date, date);
    } else if (startDate && endDate) {
      // 日期范围查询：碎时记也需应用可见性规则
      // - 普通 todo: date 在 [start, end] 范围内
      // - 碎时记已完成: date（完成日期）在 [start, end] 范围内
      // - 碎时记未完成: date=''（任意日期可见，含范围内）OR date 在 [start, end] 范围内
      //   注意：未完成碎时记若起始日期 < start 但仍活跃（date <= end），也应包含
      //   简化：未完成碎时记只要 date='' OR date <= end 即在范围内可见
      conditions.push(`(
        (type != 'fragment' AND date >= ? AND date <= ?)
        OR (type = 'fragment' AND done = 1 AND date >= ? AND date <= ?)
        OR (type = 'fragment' AND done = 0 AND (date = '' OR date <= ?))
      )`);
      params.push(startDate, endDate, startDate, endDate, endDate);
    } else if (startDate) {
      // 仅 start_date：碎时记未完成只要 date='' OR date >= start（起始在 start 之后仍可见）
      conditions.push(`(
        (type != 'fragment' AND date >= ?)
        OR (type = 'fragment' AND done = 1 AND date >= ?)
        OR (type = 'fragment' AND done = 0 AND (date = '' OR date >= ?))
      )`);
      params.push(startDate, startDate, startDate);
    } else if (endDate) {
      // 仅 end_date：碎时记未完成只要 date='' OR date <= end
      conditions.push(`(
        (type != 'fragment' AND date <= ?)
        OR (type = 'fragment' AND done = 1 AND date <= ?)
        OR (type = 'fragment' AND done = 0 AND (date = '' OR date <= ?))
      )`);
      params.push(endDate, endDate, endDate);
    }

    if (category_id) {
      conditions.push('category_id = ?');
      params.push(category_id);
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
    let templates = []; // expand=false 时返回给调用方自算
    if (date) {
      if (expand) {
        // 默认行为：服务端展开 RRULE（向后兼容）
        // v3.0：模板展开，仅查 type='recurring' 模板
        // rrule 内的 UNTIL 由 ical.js 在 isOccurrenceOnDate 中判断，无需 SQL 过滤
        const templatesReq = await DB.prepare(`
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
        for (const tpl of (templatesReq.results || [])) {
          let templateForEngine = { ...tpl, exdates: tpl.exdates || '[]' };
          if (!isOccurrenceOnDate(templateForEngine, date)) continue;

          const new_id = crypto.randomUUID();
          let parsedSubtasks = parseJsonField(tpl.subtasks);
          parsedSubtasks.forEach(st => st.done = false);

          const newRecord = {
            ...tpl, id: new_id, date, parent_id: tpl.parent_id,
            done: 0, deleted: 0,
            subtasks: parsedSubtasks,
            search_terms: [],
            time_records: '[]'
          };
          recurringResults.push(newRecord);

          insertStmts.push(DB.prepare(
            'INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, type, end_time, category_id, recurrence_id, is_exception, time_records, fragment_anchor, rrule, anchor_date, exdates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            new_id, tpl.parent_id, date, tpl.text, tpl.time || '', tpl.priority || 'low',
            tpl.desc || '', tpl.url || '', tpl.copy_text || '',
            JSON.stringify(parsedSubtasks), '[]',
            0, 0, 'recurring', tpl.end_time || '', tpl.category_id || '',
            '', 0,  // recurrence_id, is_exception
            '[]',   // time_records
            '',     // fragment_anchor
            tpl.rrule || '', date, '[]'  // rrule, anchor_date, exdates
          ));
        }
        if (insertStmts.length > 0) {
          for (let i = 0; i < insertStmts.length; i += 100) {
            await DB.batch(insertStmts.slice(i, i + 100));
          }
        }
      } else {
        // expand=false：跳过服务端 RRULE 计算和 INSERT，仅返回 templates 供调用方自算
        const templatesReq = await DB.prepare(`
          SELECT * FROM todo_templates t
          WHERE t.type = 'recurring'
          AND t.anchor_date <= ?
        `).bind(date).all();
        templates = (templatesReq.results || []).map(t => ({
          ...t,
          exdates: t.exdates || '[]',
          subtasks: parseJsonField(t.subtasks),
        }));
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
      },
      // expand=false 时附带 templates，调用方自算 RRULE
      ...(expand ? {} : { templates, expand: false }),
    });
    }; // end execGet

    if (date && expand) return _withV1TodosDateLock(date, execGet);
    return execGet();
  }

  // POST /api/v1/todos - 创建 todo（v3.0）
  // 请求体字段：type + rrule + anchor_date + exdates（替代旧 repeat_type/repeat_custom/repeat_interval/repeat_end）
  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch(e) {
      return apiError('请求体不是有效的 JSON', 400);
    }
    const { date, text, time, priority, desc, url, copy_text, subtasks, search_terms, type: bodyType, end_time, category_id, rrule: bodyRRule, anchor_date: bodyAnchorDate, exdates: bodyExdates } = body;

    // v3.0 拒绝旧字段
    if (body.repeat_type !== undefined || body.repeat_custom !== undefined ||
        body.repeat_interval !== undefined || body.repeat_end !== undefined) {
      return apiError('v3.0 已废弃 repeat_type / repeat_custom / repeat_interval / repeat_end 字段，请改用 type + rrule + anchor_date + exdates', 400);
    }

    // type 校验
    let type = bodyType || 'none';
    if (type !== 'none' && type !== 'fragment' && type !== 'recurring') {
      return apiError(`无效的 type: ${type}，v3.0 有效值: none / fragment / recurring`, 400);
    }

    // rrule 校验
    const rruleResult = processRRule(bodyRRule, type, { allowDerive: true });
    if (rruleResult.error) return apiError(rruleResult.error, 400);
    let final_rrule = rruleResult.value;
    if (type === 'recurring' && !final_rrule) {
      return apiError('type=recurring 时 rrule 不能为空，请提供合法 RFC 5545 RRULE 字符串', 400);
    }
    if (type === 'none' || type === 'fragment') {
      final_rrule = '';
    }

    // exdates 校验
    const exdatesResult = validateExdates(bodyExdates);
    if (exdatesResult.error) return apiError(exdatesResult.error, 400);
    const final_exdates = exdatesResult.value;

    // 碎时记特殊约束
    const is_fragment = (type === 'fragment');
    if ((!date && !is_fragment) || !text) {
      return apiError('date 和 text 为必填项（碎时记允许 date 为空）', 400);
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return apiError('date 格式应为 YYYY-MM-DD', 400);
    }

    const id = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const catId = category_id || '';
    const eTime = is_fragment ? '' : (end_time || '');
    const effectiveTime = is_fragment ? '' : (time || '');
    const effective_date = is_fragment ? (date || '') : date;
    const normPriority = normalizePriority(priority || 'low');

    // 日期校验
    if (effective_date) {
      const dateErr = validateDateFormat(effective_date);
      if (dateErr) return apiError(dateErr, 400);
    }
    if (effectiveTime) {
      const tfErr = validateTimeFormat(effectiveTime);
      if (tfErr) return apiError(tfErr, 400);
    }
    if (eTime) {
      const etErr = validateTimeFormat(eTime);
      if (etErr) return apiError(etErr, 400);
    }

    // 规范化 subtasks
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
    const subtasks_str = JSON.stringify(normalizedSubtasks);
    const search_terms_str = JSON.stringify(normalizedSearchTerms);

    const effective_fragment_anchor = is_fragment ? effective_date : '';
    const anchor_date = (type === 'recurring') ? (bodyAnchorDate || effective_date) : '';

    await DB.prepare(
      'INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, type, end_time, category_id, recurrence_id, is_exception, time_records, fragment_anchor, rrule, anchor_date, exdates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      id, id, effective_date, text, effectiveTime, normPriority,
      desc || '', url || '', copy_text || '', subtasks_str, search_terms_str,
      0, 0, type, eTime, catId,
      '', 0, '[]', effective_fragment_anchor,
      final_rrule, anchor_date, final_exdates
    ).run();

    // 仅 type=recurring 才创建模板
    if (type === 'recurring') {
      await DB.prepare(
        'INSERT INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        id, text, effectiveTime, normPriority, desc || '', url || '', copy_text || '',
        subtasks_str, search_terms_str, 'recurring', eTime, anchor_date, final_exdates, catId, '[]', final_rrule
      ).run();
    }

    const created = await DB.prepare('SELECT * FROM todos WHERE id = ?').bind(id).first();
    return jsonResponse({
      success: true,
      data: formatTodo(created)
    }, 201);
  }

  return apiError('Method Not Allowed', 405);
}

// GET /api/v1/todos/:id - 获取单个 todo
async function handleV1TodoGet(DB, todo_id) {
  const row = await DB.prepare('SELECT * FROM todos WHERE id = ?').bind(todo_id).first();
  if (!row) return apiError('Todo 不存在', 404);
  return jsonResponse({ success: true, data: formatTodo(row) });
}

// PUT /api/v1/todos/:id - 更新 todo（v3.0）
// 请求体字段：type + rrule + anchor_date + exdates（替代旧 repeat_type/repeat_custom/repeat_interval/repeat_end）
async function handleV1TodoPut(request, DB, todo_id) {
  const existing = await DB.prepare('SELECT * FROM todos WHERE id = ?').bind(todo_id).first();
  if (!existing) return apiError('Todo 不存在', 404);

  let body;
  try {
    body = await request.json();
  } catch(e) {
    return apiError('请求体不是有效的 JSON', 400);
  }
  const parent_id = existing.parent_id; // 始终使用数据库中的 parent_id，不可被用户篡改

  // v3.0 拒绝旧字段
  if (body.repeat_type !== undefined || body.repeat_custom !== undefined ||
      body.repeat_interval !== undefined || body.repeat_end !== undefined) {
    return apiError('v3.0 已废弃 repeat_type / repeat_custom / repeat_interval / repeat_end 字段，请改用 type + rrule + anchor_date + exdates', 400);
  }
  // type 校验
  if (body.type !== undefined && body.type !== 'none' && body.type !== 'fragment' && body.type !== 'recurring') {
    return apiError(`无效的 type: ${body.type}，v3.0 有效值: none / fragment / recurring`, 400);
  }
  if (body.scope !== undefined && body.scope !== 'none') {
    const VALID_SCOPES = ['this', 'thisAndFuture', 'all'];
    if (!VALID_SCOPES.includes(body.scope)) {
      return apiError(`无效的 scope: ${body.scope}，有效值: ${VALID_SCOPES.join(', ')}`, 400);
    }
  }

  // PATCH 语义：body.type 未传时从 DB 回退
  let patchType = body.type !== undefined ? body.type : (existing.type || 'none');
  let patchRRule = existing.rrule || '';
  let patchAnchorDate = existing.anchor_date || '';
  let patchExdates = existing.exdates || '[]';

  // ====== rrule 处理（PATCH 语义）======
  if (body.rrule !== undefined) {
    if (body.rrule === null || ('' + body.rrule).trim() === '') {
      patchRRule = '';
      if (body.type === undefined) patchType = 'none';
    } else {
      const rruleResult = processRRule(body.rrule, patchType, { allowDerive: true });
      if (rruleResult.error) return apiError(rruleResult.error, 400);
      patchRRule = rruleResult.value;
      if (patchRRule && patchType === 'none') {
        patchType = 'recurring';
      }
    }
  }

  // ====== anchor_date 处理（PATCH 语义）======
  if (body.anchor_date !== undefined) {
    patchAnchorDate = body.anchor_date;
  }

  // ====== exdates 处理（PATCH 语义）======
  if (body.exdates !== undefined) {
    const exdatesResult = validateExdates(body.exdates);
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
    if (!patchAnchorDate) patchAnchorDate = body.date || existing.date || '';
    if (!patchAnchorDate) {
      return apiError('type=recurring 时 anchor_date 不能为空', 400);
    }
  }

  // is_series：原任务是系列 + 新类型不是 fragment
  const is_series = existing.type === 'recurring' && patchType !== 'fragment';

  // 重复 todo 未指定 scope 时，默认 scope=this
  const scope = is_series && (!body.scope || body.scope === 'none') ? 'this' : (body.scope || 'none');

  // PATCH 语义构建 new_values
  const new_values = {
    text: body.text !== undefined ? body.text : existing.text,
    time: body.time !== undefined ? body.time : (existing.time || ''),
    priority: body.priority !== undefined ? normalizePriority(body.priority) : normalizePriority(existing.priority || 'low'),
    desc: body.desc !== undefined ? body.desc : (existing.desc || ''),
    url: body.url !== undefined ? body.url : (existing.url || ''),
    copy_text: body.copy_text !== undefined ? body.copy_text : (existing.copy_text || ''),
    subtasks: JSON.stringify(body.subtasks !== undefined ? body.subtasks : parseJsonField(existing.subtasks)),
    search_terms: JSON.stringify(body.search_terms !== undefined ? body.search_terms : parseJsonField(existing.search_terms)),
    type: patchType,
    rrule: patchRRule,
    anchor_date: patchAnchorDate,
    exdates: patchExdates,
    end_time: body.end_time !== undefined ? body.end_time : (existing.end_time || ''),
    category_id: body.category_id !== undefined ? body.category_id : (existing.category_id || ''),
    date: body.date !== undefined ? body.date : existing.date,
  };

  // 碎时记强制约束
  if (new_values.type === 'fragment') {
    new_values.time = '';
    new_values.end_time = '';
  }

  // 原子组校验
  if (new_values.date) {
    const dateErr = validateDateFormat(new_values.date);
    if (dateErr) return apiError(dateErr, 400);
  }
  if (new_values.time) {
    const tfErr = validateTimeFormat(new_values.time);
    if (tfErr) return apiError(tfErr, 400);
  }
  if (new_values.end_time) {
    const etErr = validateTimeFormat(new_values.end_time);
    if (etErr) return apiError(etErr, 400);
  }
  if (new_values.anchor_date) {
    const adErr = validateDateFormat(new_values.anchor_date);
    if (adErr) return apiError(adErr, 400);
  }

  const date = existing.date;
  const subtasks_str = new_values.subtasks;
  const search_terms_str = new_values.search_terms;
  let new_date = new_values.date;
  if (new_values.type !== 'fragment' && !new_date) {
    new_date = date;
  }
  const date_changed = new_date !== date;
  const type = new_values.type;
  const end_time = new_values.end_time;
  const category_id = new_values.category_id;

  if (!is_series || !scope || scope === 'none') {
    if (type === 'recurring') {
      // 单次 → 重复
      await DB.prepare(
        'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?'
      ).bind(new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, todo_id).run();
      await DB.prepare(
        'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(todo_id, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'recurring', end_time, patchAnchorDate, patchExdates, category_id, '[]', patchRRule).run();
    } else if (type === 'fragment' && parent_id && parent_id !== todo_id) {
      // 重复 → 碎时记：脱离旧系列，给旧模板加 exdate
      let effective_update_date = new_date;
      let effective_fragment_anchor = new_date;
      if (existing.done === 1) {
        effective_update_date = existing.date || '';
        effective_fragment_anchor = existing.fragment_anchor || '';
      }
      await DB.prepare(
        'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=?, fragment_anchor=? WHERE id=?'
      ).bind(todo_id, effective_update_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, '', '', '[]', effective_fragment_anchor, todo_id).run();
      const tpl = await DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first();
      if (tpl) {
        const new_exdates = addExdate(tpl.exdates || '[]', date);
        await DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, parent_id).run();
      }
    } else if (parent_id && parent_id !== todo_id && type !== 'fragment') {
      // 重复 → 单次：脱离系列
      await DB.prepare(
        'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=?, fragment_anchor=? WHERE id=?'
      ).bind(todo_id, new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'none', end_time, category_id, '', '', '[]', '', todo_id).run();
      const tpl = await DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first();
      if (tpl) {
        const new_exdates = addExdate(tpl.exdates || '[]', date);
        await DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, parent_id).run();
      }
    } else {
      // 普通更新（none 或 fragment→fragment 或 fragment→none）
      let effective_update_date = new_date;
      let effective_fragment_anchor = (type === 'fragment') ? new_date : '';
      if (type === 'fragment' && existing.done === 1) {
        effective_update_date = existing.date || '';
        effective_fragment_anchor = existing.fragment_anchor || '';
      }
      await DB.prepare(
        'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=?, fragment_anchor=? WHERE id=?'
      ).bind(effective_update_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, effective_fragment_anchor, todo_id).run();
      // 原任务是系列主实例且新类型为 fragment/none 时，删除旧模板
      if ((type === 'fragment' || type === 'none') && existing.type === 'recurring' && existing.parent_id === todo_id) {
        try {
          await DB.prepare('DELETE FROM todo_templates WHERE parent_id = ?').bind(todo_id).run();
        } catch (e) {}
      }
    }
  } else {
    const actions = computeUpdateActions({ task: { ...existing, parent_id, type: existing.type, is_series }, date, scope, new_values, new_date });

    let split_new_pid = null;
    if (actions.currentTodo && actions.currentTodo.split_series) {
      split_new_pid = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    }

    if (actions.currentTodo) {
      const cv = actions.currentTodo;
      if (cv.split_series) {
        await DB.prepare(
          'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?'
        ).bind(split_new_pid, new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, todo_id).run();
      } else if (cv.detach_from_series) {
        await DB.prepare(
          'UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?'
        ).bind(todo_id, new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'none', end_time, category_id, '', '', '[]', todo_id).run();
      } else if (cv.is_recurring) {
        await DB.prepare(
          'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?'
        ).bind(new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, todo_id).run();
      } else {
        await DB.prepare(
          'UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE id=?'
        ).bind(new_date, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'none', end_time, category_id, '', '', '[]', todo_id).run();
      }
    }

    // v3.0：pastTodos 的 set_repeat_end 不再设置 repeat_end 列（已删除），简化为不做

    if (scope === 'thisAndFuture') {
      if (type === 'recurring') {
        await DB.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND date >= ? AND deleted = 0').bind(parent_id, todo_id, date).run();
      } else {
        await DB.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND date > ? AND deleted = 0').bind(parent_id, todo_id, date).run();
      }
    } else if (scope === 'all') {
      if (type === 'recurring') {
        const tmpl = actions.template;
        if (date_changed || (tmpl && tmpl.recurrence_changed)) {
          await DB.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0').bind(parent_id, todo_id).run();
        } else {
          await DB.prepare(
            'UPDATE todos SET text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, type=?, end_time=?, category_id=?, rrule=?, anchor_date=?, exdates=? WHERE parent_id=? AND id != ? AND deleted = 0'
          ).bind(new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, type, end_time, category_id, patchRRule, patchAnchorDate, patchExdates, parent_id, todo_id).run();
        }
      } else {
        await DB.prepare('DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0').bind(parent_id, todo_id).run();
      }
    }

    if (actions.template) {
      const tmpl = actions.template;
      if (tmpl.type === 'add_exdate') {
        const tpl = await DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first();
        if (tpl) {
          const new_exdates = addExdate(tpl.exdates || '[]', date);
          await DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, parent_id).run();
        }
      } else if (tmpl.type === 'set_repeat_end') {
        // v3.0：给模板 rrule 追加 UNTIL
        const prev_date = getPreviousDate(date);
        try {
          const tpl_row = await DB.prepare('SELECT rrule FROM todo_templates WHERE parent_id = ?').bind(parent_id).first();
          if (tpl_row && tpl_row.rrule) {
            let rrule = tpl_row.rrule.replace(/;UNTIL=[^;]+/i, '');
            rrule = rrule + ';UNTIL=' + prev_date.replace(/-/g, '') + 'T235959Z';
            const sanitized = sanitizeRRule(rrule);
            if (sanitized) {
              await DB.prepare('UPDATE todo_templates SET rrule = ? WHERE parent_id = ?').bind(sanitized, parent_id).run();
            }
          }
        } catch (e) {}
      } else if (tmpl.type === 'update_all') {
        if (type === 'recurring') {
          let existing_exdates = '[]';
          let existing_time_records = '[]';
          try {
            const existing_tpl = await DB.prepare('SELECT exdates, time_records FROM todo_templates WHERE parent_id = ?').bind(parent_id).first();
            if (existing_tpl) {
              existing_exdates = existing_tpl.exdates || '[]';
              existing_time_records = existing_tpl.time_records || '[]';
            }
          } catch (e) {}
          await DB.prepare(
            'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(parent_id, new_values.text, new_values.time, new_values.priority, new_values.desc, new_values.url, new_values.copy_text, subtasks_str, search_terms_str, 'recurring', end_time, patchAnchorDate, existing_exdates, category_id, existing_time_records, patchRRule).run();
        }
      } else if (tmpl.type === 'delete') {
        await DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parent_id).run();
      }
    }

    if (actions.insertTemplate && split_new_pid) {
      const it = actions.insertTemplate;
      await DB.prepare(
        'INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, type, end_time, anchor_date, exdates, category_id, time_records, rrule) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        split_new_pid, it.text, it.time, it.priority, it.desc, it.url, it.copy_text,
        it.subtasks, it.search_terms, 'recurring', it.end_time, it.anchor_date, it.exdates, it.category_id, '[]', it.rrule || ''
      ).run();
    }
  }

  const updated = await DB.prepare('SELECT * FROM todos WHERE id = ?').bind(todo_id).first();
  return jsonResponse({ success: true, data: formatTodo(updated) });
}

// DELETE /api/v1/todos/:id - 删除 todo（v3.0）
async function handleV1TodoDelete(DB, todo_id, scope) {
  const existing = await DB.prepare('SELECT * FROM todos WHERE id = ?').bind(todo_id).first();
  if (!existing) return apiError('Todo 不存在', 404);

  const parent_id = existing.parent_id;
  // v3.0：从 type 判断 is_series
  const is_series = existing.type === 'recurring';
  const date = existing.date;

  // 重复 todo 未指定 scope 时，默认 scope=this
  const effective_scope = is_series && !scope ? 'this' : scope;

  if (!is_series || !effective_scope) {
    await DB.prepare('UPDATE todos SET deleted = 1 WHERE id = ?').bind(todo_id).run();
  } else {
    const actions = computeDeleteActions({ task: { ...existing, parent_id: parent_id, type: 'recurring', is_series }, date, scope: effective_scope });

    if (actions.deleteTodoIds && actions.deleteTodoIds.length > 0) {
      for (const id of actions.deleteTodoIds) {
        await DB.prepare('UPDATE todos SET deleted = 1 WHERE id = ?').bind(id).run();
      }
    }

    if (actions.updateTemplate) {
      const tmpl = actions.updateTemplate;
      if (tmpl.type === 'add_exdate') {
        const tpl = await DB.prepare('SELECT exdates FROM todo_templates WHERE parent_id = ?').bind(parent_id).first();
        if (tpl) {
          const new_exdates = addExdate(tpl.exdates || '[]', date);
          await DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, parent_id).run();
        }
      } else if (tmpl.type === 'set_repeat_end') {
        // thisAndFuture: 软删除当前及以后实例，脱钩为单次快照，给模板 rrule 追加 UNTIL
        const prev_date = getPreviousDate(date);
        if (tmpl.also_delete_future) {
          await DB.prepare(
            'UPDATE todos SET deleted = 1, type=?, rrule=?, anchor_date=?, exdates=?, parent_id=id, time_records=? WHERE parent_id=? AND date >= ?'
          ).bind('none', '', '', '[]', '[]', parent_id, date).run();
        }
        // 给模板 rrule 追加 UNTIL
        try {
          const tpl_row = await DB.prepare('SELECT rrule FROM todo_templates WHERE parent_id = ?').bind(parent_id).first();
          if (tpl_row && tpl_row.rrule) {
            let rrule = tpl_row.rrule.replace(/;UNTIL=[^;]+/i, '');
            rrule = rrule + ';UNTIL=' + prev_date.replace(/-/g, '') + 'T235959Z';
            const sanitized = sanitizeRRule(rrule);
            if (sanitized) {
              await DB.prepare('UPDATE todo_templates SET rrule = ? WHERE parent_id = ?').bind(sanitized, parent_id).run();
            }
          }
        } catch (e) {}
      } else if (tmpl.type === 'delete_all') {
        // all: 软删除所有实例并脱钩为单次快照，删除模板
        await DB.prepare(
          'UPDATE todos SET deleted = 1, type=?, rrule=?, anchor_date=?, exdates=?, parent_id=id, time_records=? WHERE parent_id=?'
        ).bind('none', '', '', '[]', '[]', parent_id).run();
        await DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parent_id).run();
      }
    }

    if (actions.deleteTemplate) {
      await DB.prepare('DELETE FROM todo_templates WHERE parent_id=?').bind(parent_id).run();
    }
  }

  return jsonResponse({ success: true });
}

// PATCH /api/v1/todos/:id/toggle - 切换完成状态
// 可选 body: { record: { s, e, p }, date }
// - done 0→1：碎时记冻结 date 到 body.date（或现有 date）；可选 record 写入实例级 time_records
//   - 零耗时（s===e）：仅写实例级（避免污染 predictDuration）
//   - 真实耗时（s<e）：实例级 + 模板级双写（与 TIMER_COMPLETE 一致）
// - done 1→0：清空实例级 time_records；碎时记 date 从 fragment_anchor 恢复
// - 无 record：仅更新 done（向后兼容）
async function handleV1TodoToggle(request, DB, todo_id) {
  const existing = await DB.prepare('SELECT done, parent_id, type, date, fragment_anchor FROM todos WHERE id = ?').bind(todo_id).first();
  if (!existing) return apiError('Todo 不存在', 404);
  const new_done = existing.done ? 0 : 1;
  const is_fragment = (existing.type === "fragment");

  // 解析可选 body（PATCH 可能无 body 或 body 无 record，需容错）
  // 碎时记完成时需要 body.date 作为冻结日期（当前查看日期）
  let record = null;
  let body_date = null;
  try {
    if (request && typeof request.json === 'function') {
      const body = await request.json();
      if (body && typeof body === 'object') {
        if (body.record) record = body.record;
        if (body.date) body_date = body.date;
      }
    }
  } catch (e) {
    // body 解析失败：忽略 record，仅切换 done（向后兼容）
    record = null;
  }

  if (is_fragment && new_done && body_date) {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (body_date > todayStr) {
      body_date = todayStr; // 纠正为今天，而非拒绝请求（保持幂等）
    }
  }

  if (new_done) {
    // 勾选完成
    // 碎时记：冻结 date 为完成日期（body.date 或现有 date），fragment_anchor 不变（始终保留起始日期）
    if (is_fragment) {
      const freeze_date = body_date || existing.date || '';
      try {
        await DB.prepare('UPDATE todos SET done = 1, date = ? WHERE id = ?')
          .bind(freeze_date, todo_id).run();
      } catch (e) {
        try { await DB.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(todo_id).run(); } catch (e2) {}
      }
    } else {
      try {
        await DB.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(todo_id).run();
      } catch (e) {
        try { await DB.prepare('UPDATE todos SET done = 1 WHERE id = ?').bind(todo_id).run(); } catch (e2) {}
      }
    }
    if (record) {
      await writeTimerRecord(DB, todo_id, existing.parent_id, record, is_fragment);
    }
  } else {
    // 取消勾选
    // 碎时记：清空 time_records，done=0，date 从 fragment_anchor 恢复（保留用户设置的起始日期）
    // 注意：v1 toggle 是简单切换接口，无 keep_records 参数；
    //       "继续计时"保留累计的路径在 v0 Web API（continueAfterDone → keep_records=true）
    if (is_fragment) {
      const saved_anchor = existing.fragment_anchor || '';
      try {
        await DB.prepare('UPDATE todos SET done = 0, date = ?, time_records = ? WHERE id = ?')
          .bind(saved_anchor, '[]', todo_id).run();
      } catch (e) {
        await DB.prepare('UPDATE todos SET done = 0 WHERE id = ?').bind(todo_id).run();
      }
    } else {
      // 普通 todo：清空实例级 time_records
      try {
        await DB.prepare('UPDATE todos SET done = 0, time_records = ? WHERE id = ?')
          .bind('[]', todo_id).run();
      } catch (e) {
        await DB.prepare('UPDATE todos SET done = 0 WHERE id = ?').bind(todo_id).run();
      }
    }
  }

  const updated_todo = await DB.prepare('SELECT date, time_records FROM todos WHERE id = ?').bind(todo_id).first();
  const response_data = { id: todo_id, done: !!new_done };
  if (updated_todo) {
    if (new_done && updated_todo.date) response_data.date = updated_todo.date;
    try {
      const tr = typeof updated_todo.time_records === 'string' ? JSON.parse(updated_todo.time_records || '[]') : (updated_todo.time_records || []);
      if (Array.isArray(tr) && tr.length > 0) response_data.time_records = tr;
    } catch(e) {}
  }
  return jsonResponse({ success: true, data: response_data });
}

// ==================== 计时记录写入工具函数 ====================
// 校验并写入 time_records（实例级 + 模板级）
// - 实例级：
//   - 碎时记：保留全部 session（不 FIFO），用于多 session 累计统计
//   - 普通 todo：FIFO 5（复刻 v0 bd3f88d 行为，避免无限增长）
// - 模板级：仅真实耗时（s<e）且非碎时记写（FIFO 10，供 predictDuration 中位数预估）
//   碎时记无模板，零耗时跳过（避免污染中位数）
// 与 /api/todo-action TIMER_COMPLETE 写入策略保持一致
async function writeTimerRecord(DB, todo_id, parent_id, record, is_fragment) {
  // 校验
  if (!record || typeof record !== 'object') return;
  if (typeof record.s !== 'number' || typeof record.e !== 'number') return;
  const s = Math.floor(record.s);
  const e = Math.floor(record.e);
  const p = Math.floor(record.p || 0);
  const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
  if (!(s > 0 && e >= s && (e - s) <= MAX_DURATION_MS && p >= 0 && p <= (e - s))) {
    return;
  }
  const is_zero_duration = (s === e);

  // 实例级写入
  try {
    const cur = await DB.prepare('SELECT time_records FROM todos WHERE id = ?').bind(todo_id).first();
    if (cur) {
      let inst_arr = [];
      try {
        inst_arr = typeof cur.time_records === 'string'
          ? JSON.parse(cur.time_records || '[]')
          : cur.time_records;
      } catch (e2) { inst_arr = []; }
      if (!Array.isArray(inst_arr)) inst_arr = [];
      inst_arr.push({ s, e, p });
      // 碎时记：不截断（保留全部 session）
      // 普通 todo：FIFO 5
      if (!is_fragment && inst_arr.length > 5) inst_arr = inst_arr.slice(inst_arr.length - 5);
      await DB.prepare('UPDATE todos SET time_records = ? WHERE id = ?')
        .bind(JSON.stringify(inst_arr), todo_id).run();
    }
  } catch (eInst) {
    console.error('v1 per-instance record write failed:', eInst);
  }

  // 模板级写入（仅真实耗时 + 非碎时记，FIFO 10；零耗时和碎时记都跳过）
  if (!is_zero_duration && !is_fragment && parent_id) {
    try {
      const tpl = await DB.prepare('SELECT time_records FROM todo_templates WHERE parent_id = ?').bind(parent_id).first();
      if (tpl) {
        let arr = [];
        try { arr = Array.isArray(tpl.time_records) ? tpl.time_records : JSON.parse(tpl.time_records || '[]'); } catch (e2) { arr = []; }
        if (!Array.isArray(arr)) arr = [];
        arr.push({ s, e, p });
        if (arr.length > 10) arr = arr.slice(arr.length - 10);
        await DB.prepare('UPDATE todo_templates SET time_records = ? WHERE parent_id = ?')
          .bind(JSON.stringify(arr), parent_id).run();
      }
    } catch (e3) {
      console.error('v1 template record write failed:', e3);
    }
  }
}

// ==================== v1 Category CRUD ====================

async function handleV1Categories(request, env, url) {
  const DB = request.method === 'GET' && env.DB.withSession
    ? env.DB.withSession('first-primary')
    : env.DB;

  // GET /api/v1/categories - 列出所有分类
  if (request.method === 'GET') {
    const { results } = await DB.prepare('SELECT id, name, color FROM categories ORDER BY id').all();
    return jsonResponse({ success: true, data: (results || []).map(formatCategory) });
  }

  // POST /api/v1/categories - 创建分类
  if (request.method === 'POST') {
    const catParsed = await safeParseJson(request);
    if (!catParsed) return apiError('请求体不是有效的 JSON', 400);
    const { name, color } = catParsed;
    if (!name || !name.trim()) return apiError('name 为必填项', 400);

    const existing = await DB.prepare("SELECT id FROM categories WHERE LOWER(name) = ?").bind(name.trim().toLowerCase()).first();
    if (existing) return apiError('分类名称已存在', 400);

    const id = Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const cat_color = (color && color.trim()) ? color.trim() : DEFAULT_CATEGORY_COLOR;
    await DB.prepare("INSERT INTO categories (id, name, color) VALUES (?, ?, ?)").bind(id, name.trim(), cat_color).run();
    return jsonResponse({ success: true, data: { id, name: name.trim(), color: cat_color } }, 201);
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

  const body = await safeParseJson(request);
  if (!body) return apiError('请求体不是有效的 JSON', 400);
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
// body: { action, ids, done_status, timer_records? }
// timer_records: [{ id, parent_id, record: {s, e, p} }]（可选）
// - BATCH_TOGGLE_DONE + done_status=true：
//   - 先批量 UPDATE done=1
//   - 再对 timer_records 中每条 record 写入 time_records
//     - 真实耗时（s<e）：实例级 + 模板级双写
//     - 零耗时（s===e）：仅实例级
//   - ids 中有但 timer_records 没有的：done=1 但无 time_records（向后兼容）
// - BATCH_TOGGLE_DONE + done_status=false：批量 UPDATE done=0, time_records='[]'
async function handleV1TodoBatch(request, DB) {
  let batchBody;
  try {
    batchBody = await request.json();
  } catch(e) {
    return apiError('请求体不是有效的 JSON', 400);
  }
  const { action, ids, done_status, timer_records, date } = batchBody;

  if (action === 'BATCH_TOGGLE_DONE') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError('ids 为必填数组', 400);

    let totalAffected = 0;
    const all_fragment_ids = [];
    const all_fragment_id_set = new Set();
    const all_plain_ids = [];

    // 自动分片查询 repeat_type，汇总 fragment/plain 分类
    for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
      const ph = sqlPlaceholders(chunk.length);
      const rows = await DB.prepare(`SELECT id, type FROM todos WHERE id IN (${ph})`).bind(...chunk).all();
      for (const r of (rows.results || [])) {
        if (r.type === 'fragment') {
          all_fragment_ids.push(r.id);
          all_fragment_id_set.add(r.id);
        } else {
          all_plain_ids.push(r.id);
        }
      }
    }

    if (done_status) {
      // 自动分片批量完成
      const runFragmentComplete = async () => {
        let affected = 0;
        for (const chunk of chunkArray(all_fragment_ids, BATCH_CHUNK_SIZE)) {
          const ph = sqlPlaceholders(chunk.length);
          try {
            const r = await DB.prepare(`UPDATE todos SET done = 1, date = ? WHERE id IN (${ph}) AND done = 0`)
              .bind(date || '', ...chunk).run();
            affected += (r.meta?.changes || 0);
          } catch (e) {
            // date 列可能不存在等边界场景，降级为仅切换 done
            try {
              const r2 = await DB.prepare(`UPDATE todos SET done = 1 WHERE id IN (${ph}) AND done = 0`).bind(...chunk).run();
              affected += (r2.meta?.changes || 0);
            } catch (e2) {}
          }
        }
        return affected;
      };
      const runPlainComplete = async () => {
        let affected = 0;
        for (const chunk of chunkArray(all_plain_ids, BATCH_CHUNK_SIZE)) {
          const ph = sqlPlaceholders(chunk.length);
          try {
            const r = await DB.prepare(`UPDATE todos SET done = 1 WHERE id IN (${ph}) AND done = 0`)
              .bind(...chunk).run();
            affected += (r.meta?.changes || 0);
          } catch (e) {
            // 单片失败不阻断整体流程
          }
        }
        return affected;
      };
      // 并发执行 fragment + plain（D1 单库单线程，但 Worker 端可减少串行 await 等待）
      const [fragAffected, plainAffected] = await Promise.all([
        runFragmentComplete(),
        runPlainComplete(),
      ]);
      totalAffected += fragAffected + plainAffected;

      // 对带 record 的 todo 写入 time_records（与 /api/todo-action BATCH_TOGGLE_DONE 一致）
      if (Array.isArray(timer_records) && timer_records.length > 0) {
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
            is_fragment: all_fragment_id_set.has(item.id),
            is_zero_duration: s === e,
            s, e, p,
          });
        }

        // 批量预取实例级 time_records
        const instIds = [...new Set(valid_items.map(it => it.id))];
        const inst_time_records_map = new Map(); // id -> current time_records array
        for (const chunk of chunkArray(instIds, BATCH_CHUNK_SIZE)) {
          const ph = sqlPlaceholders(chunk.length);
          try {
            const rows = await DB.prepare(`SELECT id, time_records FROM todos WHERE id IN (${ph})`).bind(...chunk).all();
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

        // 批量预取模板级 time_records（仅非零耗时 + 非碎时记 + 有 parent_id 的）
        const tpl_parent_ids = [...new Set(
          valid_items
            .filter(it => !it.is_zero_duration && !it.is_fragment && it.parent_id)
            .map(it => it.parent_id)
        )];
        const tpl_time_records_map = new Map(); // parent_id -> current time_records array
        for (const chunk of chunkArray(tpl_parent_ids, BATCH_CHUNK_SIZE)) {
          const ph = sqlPlaceholders(chunk.length);
          try {
            const rows = await DB.prepare(`SELECT parent_id, time_records FROM todo_templates WHERE parent_id IN (${ph})`).bind(...chunk).all();
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

        // Worker 内 merge：每个实例 push record + FIFO 5（普通）/ 不截断（碎时记）
        const inst_updates = []; // { id, time_records }
        for (const it of valid_items) {
          const arr = inst_time_records_map.get(it.id);
          if (!arr) continue; // 实例不存在，跳过
          arr.push({ s: it.s, e: it.e, p: it.p });
          if (!it.is_fragment && arr.length > 5) {
            // 普通todo FIFO 5（原地修改，避免额外分配）
            arr.splice(0, arr.length - 5);
          }
          inst_updates.push({ id: it.id, time_records: JSON.stringify(arr) });
        }
        // 模板级 merge：仅真实耗时 + 非碎时记，FIFO 10
        const tpl_updates = new Map(); // parent_id -> time_records array（同一 parent 多 record 累加）
        for (const it of valid_items) {
          if (it.is_zero_duration || it.is_fragment || !it.parent_id) continue;
          const arr = tpl_time_records_map.get(it.parent_id);
          if (!arr) continue; // 模板不存在，跳过
          let target = tpl_updates.get(it.parent_id);
          if (!target) {
            // 复制一份避免污染预取 map
            target = arr.slice();
            tpl_updates.set(it.parent_id, target);
          }
          target.push({ s: it.s, e: it.e, p: it.p });
          if (target.length > 10) target.splice(0, target.length - 10);
        }

        // 分片 UPDATE 实例级
        for (const chunk of chunkArray(inst_updates, BATCH_CHUNK_SIZE)) {
          try {
            const stmts = chunk.map(u => DB.prepare('UPDATE todos SET time_records = ? WHERE id = ?').bind(u.time_records, u.id));
            await DB.batch(stmts);
          } catch (e) {
            console.error('v1 batch timer record inst update failed:', e);
          }
        }
        // 分片 UPDATE 模板级
        const tplUpdateArr = Array.from(tpl_updates.entries()).map(([pid, arr]) => ({ pid, time_records: JSON.stringify(arr) }));
        for (const chunk of chunkArray(tplUpdateArr, BATCH_CHUNK_SIZE)) {
          try {
            const stmts = chunk.map(u => DB.prepare('UPDATE todo_templates SET time_records = ? WHERE parent_id = ?').bind(u.time_records, u.pid));
            await DB.batch(stmts);
          } catch (e) {
            console.error('v1 batch timer record tpl update failed:', e);
          }
        }
      }
    } else {
      // 自动分片批量取消完成
      const runFragmentUncomplete = async () => {
        let affected = 0;
        for (const chunk of chunkArray(all_fragment_ids, BATCH_CHUNK_SIZE)) {
          const ph = sqlPlaceholders(chunk.length);
          try {
            const r = await DB.prepare(`UPDATE todos SET done = 0, date = fragment_anchor, time_records = ? WHERE id IN (${ph})`)
              .bind('[]', ...chunk).run();
            affected += (r.meta?.changes || 0);
          } catch (e) {
            try {
              const r2 = await DB.prepare(`UPDATE todos SET done = 0 WHERE id IN (${ph})`).bind(...chunk).run();
              affected += (r2.meta?.changes || 0);
            } catch (e2) {}
          }
        }
        return affected;
      };
      const runPlainUncomplete = async () => {
        let affected = 0;
        for (const chunk of chunkArray(all_plain_ids, BATCH_CHUNK_SIZE)) {
          const ph = sqlPlaceholders(chunk.length);
          try {
            const r = await DB.prepare(`UPDATE todos SET done = 0, time_records = ? WHERE id IN (${ph})`)
              .bind('[]', ...chunk).run();
            affected += (r.meta?.changes || 0);
          } catch (e) {
            try {
              const r2 = await DB.prepare(`UPDATE todos SET done = 0 WHERE id IN (${ph})`)
                .bind(...chunk).run();
              affected += (r2.meta?.changes || 0);
            } catch (e2) {}
          }
        }
        return affected;
      };
      const [fragAffected, plainAffected] = await Promise.all([
        runFragmentUncomplete(),
        runPlainUncomplete(),
      ]);
      totalAffected += fragAffected + plainAffected;
    }
    return jsonResponse({ success: true, data: { affected: totalAffected, done: !!done_status, chunked: ids.length > BATCH_CHUNK_SIZE, chunkCount: Math.ceil(ids.length / BATCH_CHUNK_SIZE) } });
  }

  if (action === 'BATCH_DELETE') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError('ids 为必填数组', 400);

    // 自动分片查询重复任务信息（用于 exdate 维护）
    const tasks = [];
    for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
      const ph = sqlPlaceholders(chunk.length);
      try {
        const rows = await DB.prepare(`SELECT parent_id, date, type FROM todos WHERE id IN (${ph})`).bind(...chunk).all();
        for (const r of (rows.results || [])) tasks.push(r);
      } catch (e) {
        // 单片查询失败不阻断整体流程，剩余 exdate 维护跳过
      }
    }

    // 自动分片标记软删除，累加实际 changes
    let totalAffected = 0;
    for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
      const ph = sqlPlaceholders(chunk.length);
      try {
        const r = await DB.prepare(`UPDATE todos SET deleted = 1 WHERE id IN (${ph})`).bind(...chunk).run();
        totalAffected += (r.meta?.changes || 0);
      } catch (e) {
        // 单片失败不阻断整体流程；调用方可通过返回的 chunked/chunkCount 自查
      }
    }

    // 为重复任务添加 exdate（碎时记无模板，跳过）
    // v3.0：从 type 判断 recurring
    const exdateUpdates = {};
    for (const t of tasks) {
      if (t.type === 'recurring' && t.parent_id) {
        if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
        exdateUpdates[t.parent_id].push(t.date);
      }
    }
    const parentIds = Object.keys(exdateUpdates);
    const tplExdatesMap = new Map(); // parent_id -> exdates (string)
    for (const chunk of chunkArray(parentIds, BATCH_CHUNK_SIZE)) {
      const ph = sqlPlaceholders(chunk.length);
      try {
        const rows = await DB.prepare(`SELECT parent_id, exdates FROM todo_templates WHERE parent_id IN (${ph})`).bind(...chunk).all();
        for (const r of (rows.results || [])) tplExdatesMap.set(r.parent_id, r.exdates || '[]');
      } catch (e) {
        // 单片查询失败不阻断整体流程
      }
    }
    // DB.batch([N statements]) 只算 1 个 internal subrequest（D1 文档：batch 内每条 statement 独立受限，但整体是单次 RPC）
    const exdateStmts = [];
    for (const pid of parentIds) {
      const currentExdates = tplExdatesMap.get(pid);
      if (currentExdates === undefined) continue; // 模板不存在，跳过
      let new_exdates = currentExdates;
      let changed = false;
      for (const d of exdateUpdates[pid]) {
        const next = addExdate(new_exdates, d);
        if (next !== new_exdates) { new_exdates = next; changed = true; }
      }
      if (changed) exdateStmts.push(DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, pid));
    }
    for (const chunk of chunkArray(exdateStmts, BATCH_CHUNK_SIZE)) {
      try { await DB.batch(chunk); } catch (e) {
        // 单批 exdate 维护失败不阻断整体流程
      }
    }
    return jsonResponse({ success: true, data: { affected: totalAffected, chunked: ids.length > BATCH_CHUNK_SIZE, chunkCount: Math.ceil(ids.length / BATCH_CHUNK_SIZE) } });
  }

  return apiError('未知操作，可用: BATCH_TOGGLE_DONE, BATCH_DELETE', 400);
}

// ==================== 回收站 ====================

// GET /api/v1/trash - 获取回收站列表
async function handleV1TrashList(DB, url) {
  // V1 trash: 手动分页（limit/offset），第三方客户端负责翻页
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 500);
  const offset = Math.min(Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0), 10000);
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
  let trashBody;
  try {
    trashBody = await request.json();
  } catch(e) {
    return apiError('请求体不是有效的 JSON', 400);
  }
  const { action, id, ids } = trashBody;

  if (action === 'RESTORE') {
    if (!id) return apiError('缺少 id', 400);
    const t = await DB.prepare('SELECT parent_id, date, type FROM todos WHERE id = ?').bind(id).first();
    if (!t) return apiError('待办不存在', 404);
    await DB.prepare('UPDATE todos SET deleted = 0 WHERE id = ?').bind(id).run();
    // 仅当回收站行仍携带循环属性时才需判定 (this-scope 删除, 或旧版未脱钩的 thisAndFuture/all 行)
    // 新版 thisAndFuture/all 删除已在删除时脱钩为单次快照 (repeat_type='none', parent_id=id)，此处直接跳过。
    // 碎时记 (fragment) 无模板，直接恢复即可。
    // 对齐 RFC 5545 + Google Tasks 标准：停止/删除系列后恢复，实例为单次任务，不再重新激活循环。
    if (t.type === 'recurring' && t.parent_id && t.parent_id !== id) {
      // 检查同日期是否已有活跃实例（避免恢复后出现重复）
      const existing = await DB.prepare(
        'SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 AND id != ? LIMIT 1'
      ).bind(t.parent_id, t.date, id).first();
      if (existing) {
        // 同日期已有活跃实例，恢复的实例脱离模板变为单次任务
        await DB.prepare(
          'UPDATE todos SET parent_id=?, type=?, rrule=?, anchor_date=?, exdates=? WHERE id=?'
        ).bind(id, 'none', '', '', '[]', id).run();
      } else {
        const tpl = await DB.prepare('SELECT rrule, exdates FROM todo_templates WHERE parent_id = ?').bind(t.parent_id).first();
        // v3.0：检查模板 rrule 非空即视为覆盖
        if (tpl && tpl.rrule) {
          // 模板仍覆盖此日期: 视为"仅此日程"删除的恢复，从EXDATE移除此日期，重新并入系列
          const currentExdates = tpl.exdates || '[]';
          const new_exdates = removeExdate(currentExdates, t.date);
          await DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(new_exdates, t.parent_id).run();
        } else {
          // 模板已删除或 rrule 为空: 无法并入系列，脱钩为单次任务
          await DB.prepare(
            'UPDATE todos SET parent_id=?, type=?, rrule=?, anchor_date=?, exdates=? WHERE id=?'
          ).bind(id, 'none', '', '', '[]', id).run();
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

    // 自动分片查询
    const tasks = [];
    for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
      const ph = sqlPlaceholders(chunk.length);
      try {
        const rows = await DB.prepare(`SELECT id, parent_id, date, type FROM todos WHERE id IN (${ph})`).bind(...chunk).all();
        for (const r of (rows.results || [])) tasks.push(r);
      } catch (e) {
        // 单片查询失败不阻断整体流程
      }
    }

    // 自动分片恢复，累加实际 changes
    let totalRestored = 0;
    for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
      const ph = sqlPlaceholders(chunk.length);
      try {
        const r = await DB.prepare(`UPDATE todos SET deleted = 0 WHERE id IN (${ph})`).bind(...chunk).run();
        totalRestored += (r.meta?.changes || 0);
      } catch (e) {
        // 单片失败不阻断整体流程
      }
    }

    // 仅回收站行仍携带循环属性的 (this-scope 删除或旧版未脱钩行) 需要判定
    // v3.0：从 type 判断 recurring
    const candidateTasks = tasks.filter(t =>
      t.type === 'recurring' && t.parent_id && t.parent_id !== t.id
    );
    const uniqueParentIds = [...new Set(candidateTasks.map(t => t.parent_id))];
    // 批量预取 templates（rrule + exdates 一次性拿）
    const tplMap = new Map(); // parent_id -> { rrule, exdates }
    for (const chunk of chunkArray(uniqueParentIds, BATCH_CHUNK_SIZE)) {
      const ph = sqlPlaceholders(chunk.length);
      try {
        const rows = await DB.prepare(`SELECT parent_id, rrule, exdates FROM todo_templates WHERE parent_id IN (${ph})`).bind(...chunk).all();
        for (const r of (rows.results || [])) tplMap.set(r.parent_id, r);
      } catch (e) {
        // 单片查询失败不阻断整体流程
      }
    }
    // 批量预取 existing（同 parent_id + 同 date + 未删除 + 非自身）
    // 用 GROUP BY 一次性查所有候选 (parent_id, date) 对
    const existingKeys = new Set(); // "parent_id|date" -> true
    for (const t of candidateTasks) {
      existingKeys.add(`${t.parent_id}|${t.date}`);
    }
    // 由于 D1 不支持多列 IN 元组，用 UNION ALL 拼接（每片 ≤99 个候选对）
    const existingKeyArr = Array.from(existingKeys);
    for (const chunk of chunkArray(existingKeyArr, BATCH_CHUNK_SIZE)) {
      try {
        // 每对用一条 SELECT 1 拼接 UNION ALL，避免逐行 query
        const unions = chunk.map(k => {
          const [pid, dt] = k.split('|');
          return `SELECT '${pid.replace(/'/g, "''")}' AS pid, '${dt.replace(/'/g, "''")}' AS dt, EXISTS(SELECT 1 FROM todos WHERE parent_id = '${pid.replace(/'/g, "''")}' AND date = '${dt.replace(/'/g, "''")}' AND deleted = 0) AS has_existing`;
        }).join(' UNION ALL ');
        const rows = await DB.prepare(`SELECT * FROM (${unions})`).all();
        for (const r of (rows.results || [])) {
          if (r.has_existing) existingKeys.add(`${r.pid}|${r.dt}`);
          else existingKeys.delete(`${r.pid}|${r.dt}`); // 没有的删掉，剩下的都是 has_existing=true
        }
      } catch (e) {
        // 批量预取失败：降级为逐行查询（仅在 chunk 失败时）
        for (const k of chunk) {
          const [pid, dt] = k.split('|');
          try {
            const ex = await DB.prepare('SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 LIMIT 1').bind(pid, dt).first();
            if (!ex) existingKeys.delete(k);
          } catch (e2) {
            // 查询失败保留 key（视为有 existing，安全降级为脱钩）
          }
        }
      }
    }

    const detachIds = [];
    const exdateUpdates = {};  // parent_id -> [dates] (并入系列时需从EXDATE移除)
    for (const t of candidateTasks) {
      // 检查同日期是否已有活跃实例（用预取结果，注意要排除自身 id 但批量查询没排除——
      // 由于这些 t 来自回收站（deleted=1 刚恢复为 0），恢复前的 deleted=0 查询不会包含自身，
      // 即使包含也安全：视为有 existing 会走脱钩，不会重复并入系列）
      if (existingKeys.has(`${t.parent_id}|${t.date}`)) {
        detachIds.push(t.id);
        continue;
      }
      // v3.0：以模板 rrule 非空为准判定系列是否仍覆盖此日期
      const tpl = tplMap.get(t.parent_id);
      if (tpl && tpl.rrule) {
        // 模板仍覆盖此日期: 并入系列，记录需移除的EXDATE
        if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
        exdateUpdates[t.parent_id].push(t.date);
      } else {
        // 模板已删除或 rrule 为空: 脱钩为单次任务
        detachIds.push(t.id);
      }
    }

    // 自动分片执行脱钩
    for (const chunk of chunkArray(detachIds, BATCH_CHUNK_SIZE)) {
      const ph = sqlPlaceholders(chunk.length);
      try {
        await DB.prepare(`UPDATE todos SET parent_id=id, type='none', rrule='', anchor_date='', exdates='[]' WHERE id IN (${ph})`).bind(...chunk).run();
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
      if (changed) exdateStmts.push(DB.prepare('UPDATE todo_templates SET exdates = ? WHERE parent_id = ?').bind(currentExdates, pid));
    }
    for (const chunk of chunkArray(exdateStmts, BATCH_CHUNK_SIZE)) {
      try { await DB.batch(chunk); } catch (e) {
        // 单批 exdate 维护失败不阻断整体流程
      }
    }
    return jsonResponse({ success: true, data: { restored: totalRestored, chunked: ids.length > BATCH_CHUNK_SIZE, chunkCount: Math.ceil(ids.length / BATCH_CHUNK_SIZE) } });
  }

  if (action === 'BATCH_DELETE_PERMANENT') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError('ids 为必填数组', 400);
    let totalDeleted = 0;
    for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
      const ph = sqlPlaceholders(chunk.length);
      try {
        const r = await DB.prepare(`DELETE FROM todos WHERE id IN (${ph})`).bind(...chunk).run();
        totalDeleted += (r.meta?.changes || 0);
      } catch (e) {
        // 单片失败不阻断整体流程
      }
    }
    return jsonResponse({ success: true, data: { deleted: totalDeleted, chunked: ids.length > BATCH_CHUNK_SIZE, chunkCount: Math.ceil(ids.length / BATCH_CHUNK_SIZE) } });
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
  const rangeCheck = validateStatsDateRange(start, end);
  if (!rangeCheck.ok) return apiError(rangeCheck.error, 400);

  // 统计 WHERE 子句（优化版，语义与原版完全等价）
  // 原版 3 个 OR 子句触发 SQLite MULTI-INDEX OR（5 次索引扫描），50k 行 47ms 超 Free 10ms 限制
  // 优化：合并普通 todo + fragment 已完成（都是 date 在范围），fragment 未完成浮动单独 OR
  // 等价证明：
  //   原版可见集 = {普通 todo: date 在范围} ∪ {frag 完成: date 在范围} ∪ {frag 未完成: date='' OR date 在范围}
  //   优化版    = {date 在范围} ∪ {date='' AND frag AND 未完成}
  //   - 普通 todo: date 在范围 → 两个版本都可见 ✓
  //   - frag 完成: date 在范围 → 两个版本都可见（优化版第一子句覆盖）✓
  //   - frag 未完成 date 在范围 → 两个版本都可见（优化版第一子句覆盖）✓
  //   - frag 未完成 date='' → 原版第三子句可见，优化版第二子句可见 ✓
  //   - frag 未完成 date > end → 两个版本都不可见 ✓
  // 实测 50k 行年度报告：47ms → 13ms（72% 提升），结果完全一致
  const baseWhere = `FROM todos WHERE deleted = 0 AND (
    (date >= ?1 AND date <= ?2)
    OR (date = '' AND type = 'fragment' AND done = 0)
  )`;

  const batchResults = await DB.batch([
    // 1) 按日期聚合：byDate[date] = { total, done }
    // 碎时记 date='' 的归到 end 日（浮动事项在 end 日可见）
    DB.prepare(
      `SELECT COALESCE(NULLIF(date, ''), ?2) AS date, COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done ${baseWhere} GROUP BY COALESCE(NULLIF(date, ''), ?2)`
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
    // 碎时记 date='' 的归到 end 日对应的周日
    DB.prepare(
      `SELECT CAST(strftime('%w', COALESCE(NULLIF(date, ''), ?2)) AS INTEGER) AS weekday, done, COUNT(*) AS cnt ${baseWhere} GROUP BY weekday, done`
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
    // 6) 总量汇总：active_days 排除 date='' 的浮动碎时记（它们不属于具体日期）
    DB.prepare(
      `SELECT COUNT(*) AS total,` +
      ` SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done,` +
      ` SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END) AS undone,` +
      ` COUNT(DISTINCT CASE WHEN date = '' THEN NULL ELSE date END) AS active_days ${baseWhere}`
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
  const catBatchParsed = await safeParseJson(request);
  if (!catBatchParsed) return apiError('请求体不是有效的 JSON', 400);
  const { action, ids } = catBatchParsed;
  if (!action) return apiError('action 为必填字段', 400);

  if (action === 'BATCH_DELETE') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError('ids 为必填数组', 400);

    // 自动分片：每片内 categories 删除 + todos/todo_templates category_id 清空原子提交
    // 累加实际删除的分类数（取 batch 第一个语句 DELETE FROM categories 的 changes）
    let totalDeleted = 0;
    for (const chunk of chunkArray(ids, BATCH_CHUNK_SIZE)) {
      const ph = sqlPlaceholders(chunk.length);
      try {
        const results = await DB.batch([
          DB.prepare(`DELETE FROM categories WHERE id IN (${ph})`).bind(...chunk),
          DB.prepare(`UPDATE todos SET category_id = '' WHERE category_id IN (${ph})`).bind(...chunk),
          DB.prepare(`UPDATE todo_templates SET category_id = '' WHERE category_id IN (${ph})`).bind(...chunk),
        ]);
        // D1 DB.batch 返回 ExecutedResult[]，取第一条（DELETE categories）的 changes
        if (Array.isArray(results) && results[0] && results[0].meta) {
          totalDeleted += (results[0].meta.changes || 0);
        }
      } catch (e) {
        // 单片失败不阻断整体流程；调用方可通过返回的 chunked/chunkCount 自查
      }
    }
    return jsonResponse({ success: true, data: { deleted: totalDeleted, chunked: ids.length > BATCH_CHUNK_SIZE, chunkCount: Math.ceil(ids.length / BATCH_CHUNK_SIZE) } });
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
  const data = await safeParseJson(request);
  if (!data || typeof data !== 'object') return apiError('请求体不是有效的 JSON 对象', 400);
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
  const ccParsed = await safeParseJson(request);
  if (!ccParsed) return apiError('请求体不是有效的 JSON', 400);
  const { customHeader, customContent } = ccParsed;
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
  const colorsParsed = await safeParseJson(request);
  if (!colorsParsed) return apiError('请求体不是有效的 JSON', 400);
  const { colors } = colorsParsed;
  if (!Array.isArray(colors)) {
    return apiError('colors 必须为数组', 400);
  }
  await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('customColors', ?)").bind(JSON.stringify(colors)).run();
  return jsonResponse({ success: true, data: colors });
}

// ==================== Todo 子任务/搜索词独立更新 ====================

// PATCH /api/v1/todos/:id/subtasks - 更新子任务
async function handleV1TodoSubtasks(request, DB, todo_id) {
  const subParsed = await safeParseJson(request);
  if (!subParsed) return apiError('请求体不是有效的 JSON', 400);
  const { subtasks } = subParsed;
  if (!Array.isArray(subtasks)) return apiError('subtasks 必须为数组', 400);
  const existing = await DB.prepare('SELECT id FROM todos WHERE id = ?').bind(todo_id).first();
  if (!existing) return apiError('待办不存在', 404);
  await DB.prepare('UPDATE todos SET subtasks = ? WHERE id = ?').bind(JSON.stringify(subtasks), todo_id).run();
  return jsonResponse({ success: true });
}

// PATCH /api/v1/todos/:id/search-terms - 更新搜索词
// 请求体字段名与 v0 保持一致：search_terms
async function handleV1TodoSearchTerms(request, DB, todo_id) {
  const stParsed = await safeParseJson(request);
  if (!stParsed) return apiError('请求体不是有效的 JSON', 400);
  const { search_terms } = stParsed;
  if (!Array.isArray(search_terms)) return apiError('search_terms 必须为数组', 400);
  const existing = await DB.prepare('SELECT id FROM todos WHERE id = ?').bind(todo_id).first();
  if (!existing) return apiError('待办不存在', 404);
  await DB.prepare('UPDATE todos SET search_terms = ? WHERE id = ?').bind(JSON.stringify(search_terms), todo_id).run();
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
  // 写请求仍走 primary 保证强一致
  // first-primary: 第一查询走 primary (保证刚写入的数据可见)，后续走 replica
  const readDB = env.DB.withSession && env.DB.withSession('first-primary') || env.DB;
  if (path === '/api/v1/todos') {
    return handleV1Todos(request, env, url);
  }

  if (path === '/api/v1/todos/batch' && request.method === 'POST') {
    return handleV1TodoBatch(request, env.DB);
  }

  // /api/v1/todos/:id
  const todoMatch = path.match(/^\/api\/v1\/todos\/([a-zA-Z0-9_-]+)$/);
  if (todoMatch) {
    const todo_id = todoMatch[1];
    if (request.method === 'GET') return handleV1TodoGet(readDB, todo_id);
    if (request.method === 'PUT') return handleV1TodoPut(request, env.DB, todo_id);
    if (request.method === 'DELETE') {
      const scope = url.searchParams.get('scope') || undefined;
      if (scope && !['this', 'thisAndFuture', 'all'].includes(scope)) {
        return apiError(`无效的 scope: ${scope}，有效值: this, thisAndFuture, all`, 400);
      }
      return handleV1TodoDelete(env.DB, todo_id, scope);
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
    return handleV1TrashList(readDB, url);
  }
  if (path === '/api/v1/trash-action' && request.method === 'POST') {
    return handleV1TrashAction(request, env.DB);
  }

  // ---- Stats 路由 ----
  if (path === '/api/v1/stats' && request.method === 'GET') {
    return handleV1Stats(readDB, url);
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
    if (request.method === 'GET') return handleV1CategoryGet(readDB, catId);
    if (request.method === 'PUT') return handleV1CategoryPut(request, env.DB, catId);
    if (request.method === 'DELETE') return handleV1CategoryDelete(env.DB, catId);
    return apiError('Method Not Allowed', 405);
  }

  // ---- Settings 路由 ----
  if (path === '/api/v1/settings') {
    if (request.method === 'GET') return handleV1SettingsGet(readDB);
    if (request.method === 'POST') return handleV1SettingsPost(request, env.DB);
    return apiError('Method Not Allowed', 405);
  }

  // ---- Custom Code 路由 ----
  if (path === '/api/v1/custom-code') {
    if (request.method === 'GET') return handleV1CustomCodeGet(readDB);
    if (request.method === 'POST') return handleV1CustomCodePost(request, env.DB);
    return apiError('Method Not Allowed', 405);
  }

  // ---- Custom Header/Content/Colors 路由 ----
  if (path === '/api/v1/custom-header' && request.method === 'GET') {
    return handleV1CustomHeaderGet(readDB);
  }
  if (path === '/api/v1/custom-content' && request.method === 'GET') {
    return handleV1CustomContentGet(readDB);
  }
  if (path === '/api/v1/custom-colors') {
    if (request.method === 'GET') return handleV1CustomColorsGet(readDB);
    if (request.method === 'POST') return handleV1CustomColorsPost(request, env.DB);
    return apiError('Method Not Allowed', 405);
  }

  return null; // 不匹配，返回 null 让主路由继续处理
}

// 导出 verifyApiKey 供外部使用
export { verifyApiKey, extractApiKey, getApiKeyScope };
