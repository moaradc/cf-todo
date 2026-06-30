/**
 * Recurring Event Engine - RFC 5545 Compliant
 *
 * 重复规则唯一规范字段：rrule + anchor_date + exdates
 * type 三态：none / fragment / recurring（仅作分类，不参与 RRULE 展开）
 * fragment 永不参与 RRULE 展开（碎时记有独立生命周期）
 *
 * scope 三种操作范围：
 * - "this": 仅此实例（创建例外或添加 EXDATE）
 * - "thisAndFuture": 此实例及以后（拆分系列）
 * - "all": 所有实例（修改模板）
 */

import ICAL from 'ical.js';

// ==================== RRULE 校验 ====================

// SECONDLY/MINUTELY/HOURLY 会撑爆 Worker CPU（10ms 限制），仅允许 DAILY/WEEKLY/MONTHLY/YEARLY
const ALLOWED_FREQ = new Set(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);

// 拒绝 BYHOUR/BYMINUTE/BYSECOND（时间段语义，项目无此场景）
const FORBIDDEN_TOKEN_RE = /;(BYHOUR|BYMINUTE|BYSECOND)=/i;

// RRULE token 白名单，拒绝 RSCALE 等扩展
const ALLOWED_RRULE_TOKENS = new Set([
  'FREQ', 'INTERVAL', 'UNTIL', 'COUNT', 'BYDAY', 'BYMONTHDAY', 'BYMONTH',
  'BYWEEKNO', 'BYYEARDAY', 'BYSETPOS', 'WKST',
]);

const RRULE_MAX_LEN = 500;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;

/**
 * 规范化并校验 RRULE 字符串。无效时返回 ""。
 *
 * 校验规则：
 * 1. 自动剥离 RRULE: 前缀，全大写规范化
 * 2. FREQ 必须是第一个 token 且 ∈ {DAILY, WEEKLY, MONTHLY, YEARLY}
 * 3. 拒绝 BYHOUR/BYMINUTE/BYSECOND
 * 4. token 白名单：FREQ/INTERVAL/UNTIL/COUNT/BYDAY/BYMONTHDAY/BYMONTH/BYWEEKNO/BYYEARDAY/BYSETPOS/WKST
 * 5. 长度 ≤ 500，无控制字符
 * 6. 不允许多 RRULE 注入
 * 7. UNTIL 与 COUNT 互斥；INTERVAL/COUNT 必须为正整数
 * 8. 最终用 ical.js 解析作为终极校验
 *
 * @param {string|undefined|null} raw
 * @returns {string} 规范化后的 RRULE（不含 RRULE: 前缀）；无效时返回 ""
 */
export function sanitizeRRule(raw) {
  if (raw == null) return '';
  if (typeof raw !== 'string') return '';
  let s = raw.trim();
  if (!s) return '';
  if (s.length > RRULE_MAX_LEN) return '';
  if (CONTROL_CHAR_RE.test(s)) return '';

  if (s.startsWith('RRULE:')) s = s.slice(6).trim();
  if (!s) return '';
  if (s.includes('RRULE:')) return ''; // 防多 RRULE 注入

  // FREQ 必须是第一个 token
  const parts = s.split(';').filter(p => p.length > 0);
  if (parts.length === 0) return '';
  if (!parts[0].toUpperCase().startsWith('FREQ=')) return '';
  const freqVal = parts[0].split('=')[1]?.toUpperCase();
  if (!freqVal || !ALLOWED_FREQ.has(freqVal)) return '';

  // 拒绝时间段语义 token
  if (FORBIDDEN_TOKEN_RE.test(s)) return '';

  // token 白名单校验：拒绝任意非白名单 token
  for (let i = 1; i < parts.length; i++) {
    const tokenName = parts[i].split('=')[0].toUpperCase();
    if (!ALLOWED_RRULE_TOKENS.has(tokenName)) return '';
  }

  // RFC 5545 §3.3.10: UNTIL 和 COUNT 互斥，不能同时出现
  const hasUntil = parts.some(p => p.toUpperCase().startsWith('UNTIL='));
  const hasCount = parts.some(p => p.toUpperCase().startsWith('COUNT='));
  if (hasUntil && hasCount) return '';

  // RFC 5545 §3.3.10: INTERVAL 必须为正整数（≥1）
  const intervalPart = parts.find(p => p.toUpperCase().startsWith('INTERVAL='));
  if (intervalPart) {
    const intervalVal = parseInt(intervalPart.split('=')[1], 10);
    if (!Number.isInteger(intervalVal) || intervalVal < 1) return '';
  }

  // RFC 5545 §3.3.10: COUNT 必须为正整数（≥1）
  const countPart = parts.find(p => p.toUpperCase().startsWith('COUNT='));
  if (countPart) {
    const countVal = parseInt(countPart.split('=')[1], 10);
    if (!Number.isInteger(countVal) || countVal < 1) return '';
  }

  const canonical = 'FREQ=' + freqVal + (parts.length > 1 ? ';' + parts.slice(1).join(';') : '').toUpperCase();

  try {
    ICAL.Recur.fromString(canonical);
  } catch (e) {
    return '';
  }
  return canonical;
}

/**
 * 处理 rrule 输入：组合 sanitize + 与 type 的兼容性约束。
 *
 * @param {*} raw - 用户传入的 rrule
 * @param {string} type - 'none' | 'fragment' | 'recurring'
 * @param {object} [opts]
 * @param {boolean} [opts.allowDerive=false] - UPDATE 场景下允许 type=none/fragment + rrule 非空时反推 type=recurring
 * @returns {{value: string, error: string|null}} error 非 null 时调用方应返回 400
 */
export function processRRule(raw, type, opts = {}) {
  const { allowDerive = false } = opts;
  if (raw == null || (typeof raw === 'string' && raw.trim() === '')) {
    return { value: '', error: null };
  }
  if (typeof raw !== 'string') {
    return { value: '', error: 'rrule 必须为字符串' };
  }
  // none/fragment + rrule 非空：UPDATE 允许反推，CREATE 静默清空
  if (type === 'none' || type === 'fragment') {
    if (allowDerive) {
      const sanitized = sanitizeRRule(raw);
      if (!sanitized) {
        return { value: '', error: 'rrule 格式无效：必须为合法 RFC 5545 RRULE，以 FREQ=DAILY/WEEKLY/MONTHLY/YEARLY 开头，允许 INTERVAL/UNTIL/COUNT/BYDAY/BYMONTHDAY/BYMONTH，长度 ≤ 500，不含换行/控制字符，拒绝 BYHOUR/BYMINUTE/BYSECOND' };
      }
      return { value: sanitized, error: null };
    }
    return { value: '', error: null };
  }
  // recurring：严格校验
  const sanitized = sanitizeRRule(raw);
  if (!sanitized) {
    return { value: '', error: 'rrule 格式无效：必须为合法 RFC 5545 RRULE，以 FREQ=DAILY/WEEKLY/MONTHLY/YEARLY 开头，允许 INTERVAL/UNTIL/COUNT/BYDAY/BYMONTHDAY/BYMONTH，长度 ≤ 500，不含换行/控制字符，拒绝 BYHOUR/BYMINUTE/BYSECOND' };
  }
  return { value: sanitized, error: null };
}

// ==================== 迁移工具（内部使用，不再导出）====================

// 数据迁移：从旧字段（repeat_type / repeat_interval / repeat_end / repeat_custom / anchor_date）
// 合成 rrule。仅在迁移工具/导入旧导出文件时使用，业务代码不应调用。
const FREQ_MAP = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  yearly: 'YEARLY',
};

const DAY_MAP = ['', 'SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * 从旧字段合成 rrule（仅用于 DB 迁移，业务代码不调用）。
 * 已导出供 migrate.js 迁移逻辑使用，但不应在 API handler 中调用。
 */
export function rruleFromLegacyFields({ repeat_type, repeat_interval = 1, repeat_end = '', repeat_custom = '', anchor_date = '' }) {
  if (!repeat_type || repeat_type === 'none' || repeat_type === 'fragment') return '';

  // 优先用 repeat_custom
  if (repeat_custom && repeat_custom.trim()) {
    let rrule = repeat_custom.trim();
    if (rrule.startsWith('RRULE:')) rrule = rrule.slice(6);
    if (repeat_interval && repeat_interval > 1) {
      if (rrule.includes('INTERVAL=')) {
        rrule = rrule.replace(/INTERVAL=\d+/, `INTERVAL=${repeat_interval}`);
      } else {
        rrule = rrule.replace(/(FREQ=[A-Z]+)/, `$1;INTERVAL=${repeat_interval}`);
      }
    }
    if (repeat_end && /^\d{4}-\d{2}-\d{2}$/.test(repeat_end) && !rrule.includes('UNTIL')) {
      rrule = rrule + ';UNTIL=' + repeat_end.replace(/-/g, '') + 'T235959Z';
    }
    return sanitizeRRule(rrule);
  }

  // 无 custom：从 repeat_type + interval + repeat_end + anchor_date 合成
  const freq = FREQ_MAP[repeat_type];
  if (!freq) return '';

  const parts = [`FREQ=${freq}`];
  if (repeat_interval && repeat_interval > 1) parts.push(`INTERVAL=${repeat_interval}`);

  if (anchor_date && /^\d{4}-\d{2}-\d{2}$/.test(anchor_date)) {
    const d = dateStrToICALTime(anchor_date);
    if (repeat_type === 'weekly') parts.push(`BYDAY=${DAY_MAP[d.dayOfWeek()]}`);
    if (repeat_type === 'monthly') parts.push(`BYMONTHDAY=${d.day}`);
    if (repeat_type === 'yearly') {
      parts.push(`BYMONTH=${d.month}`);
      parts.push(`BYMONTHDAY=${d.day}`);
    }
  }

  if (repeat_end && /^\d{4}-\d{2}-\d{2}$/.test(repeat_end)) {
    parts.push(`UNTIL=${repeat_end.replace(/-/g, '')}T235959Z`);
  }

  return sanitizeRRule(parts.join(';'));
}

/**
 * 从 rrule 反推旧字段（仅供迁移工具/调试使用，业务代码不应调用）。
 */
export function deriveLegacyFieldsFromRRule(rrule) {
  const empty = { repeat_type: 'none', repeat_interval: 1, repeat_end: '', repeat_custom: '' };
  if (!rrule || !rrule.trim()) return empty;

  const tok = {};
  rrule.split(';').forEach(p => {
    const idx = p.indexOf('=');
    if (idx > 0) tok[p.slice(0, idx).toUpperCase()] = p.slice(idx + 1);
  });

  const freqMap = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' };
  const repeat_type = freqMap[tok.FREQ] || 'none';
  if (repeat_type === 'none') return empty;

  const repeat_interval = tok.INTERVAL ? Math.max(1, parseInt(tok.INTERVAL, 10) || 1) : 1;

  let repeat_end = '';
  if (tok.UNTIL) {
    const m = tok.UNTIL.match(/^(\d{4})(\d{2})(\d{2})/);
    if (m) repeat_end = `${m[1]}-${m[2]}-${m[3]}`;
  }

  return { repeat_type, repeat_interval, repeat_end, repeat_custom: rrule };
}

// ==================== 日期工具 ====================

function dateStrToICALTime(date_str) {
  const parts = date_str.split('-');
  return new ICAL.Time({
    year: parseInt(parts[0]),
    month: parseInt(parts[1]),
    day: parseInt(parts[2]),
    isDate: true,
  });
}

function icalTimeToDateStr(time) {
  const y = time.year;
  const m = String(time.month).padStart(2, '0');
  const d = String(time.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ==================== ical.js 组件构建 ====================

/**
 * 构建 ical.js VCALENDAR/VEVENT 组件用于 RRULE 展开。
 *
 * 简化设计：仅依赖 rrule + anchor_date + exdates 三个字段。
 * - rrule：RFC 5545 RRULE 字符串（已 sanitize，不含 RRULE: 前缀）
 * - anchor_date：DTSTART 等价物（YYYY-MM-DD）
 * - exdates：JSON 数组字符串或数组，如 ["2026-07-04"]
 */
function createICALComponent(template) {
  const vcalendar = new ICAL.Component(['vcalendar', [], []]);
  vcalendar.addPropertyWithValue('version', '2.0');
  vcalendar.addPropertyWithValue('prodid', '-//cf-todo//recurring-engine//EN');

  const vevent = new ICAL.Component('vevent');
  vevent.addPropertyWithValue('uid', template.parent_id || 'temp');
  vevent.addPropertyWithValue('dtstart', dateStrToICALTime(template.anchor_date));

  // rrule 属性（唯一规范字段）
  if (template.rrule && template.rrule.trim()) {
    try {
      const rruleProp = new ICAL.Property('rrule', vevent);
      rruleProp.setValue(ICAL.Recur.fromString(template.rrule));
      vevent.addProperty(rruleProp);
    } catch (e) {
      // rrule 已通过 sanitizeRRule 校验，此处异常不应发生
      // 静默跳过，调用方按无 rrule 处理（仅 anchor_date 当天出现）
    }
  }

  // EXDATE 始终叠加（独立属性，非 RRULE 字符串一部分）
  let exdates = [];
  if (template.exdates) {
    try {
      exdates = typeof template.exdates === 'string' ? JSON.parse(template.exdates) : template.exdates;
    } catch (e) { exdates = []; }
  }
  if (Array.isArray(exdates) && exdates.length > 0) {
    const exdateValues = exdates
      .filter(d => d && typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}$/))
      .map(d => dateStrToICALTime(d));
    if (exdateValues.length > 0) {
      const exdateProp = new ICAL.Property('exdate', vevent);
      exdateProp.setValues(exdateValues);
      vevent.addProperty(exdateProp);
    }
  }

  vcalendar.addSubcomponent(vevent);
  return vcalendar;
}

// ==================== 核心判断函数 ====================

/**
 * 判断某日期是否为重复事件的发生日期。
 * 对齐 RFC 5545：DTSTART 始终是第一个实例（即使不匹配 RRULE）。
 *
 * 判定依据：
 * - fragment 永不参与 RRULE 判定
 * - rrule 非空 → 按 rrule 展开
 * - rrule 为空 → 非系列（单次），仅 anchor_date 当天匹配
 */
export function isOccurrenceOnDate(template, date_str) {
  // fragment 永远不参与 RRULE 判定
  if (template.type === 'fragment') return false;

  // 非系列判定：无 rrule 或 type=none
  const has_rrule = !!(template.rrule && template.rrule.trim());
  if (!has_rrule) return false;
  if (!template.anchor_date || template.anchor_date > date_str) return false;

  // EXDATE 排除
  let exdates = [];
  if (template.exdates) {
    try {
      exdates = typeof template.exdates === 'string' ? JSON.parse(template.exdates) : template.exdates;
    } catch (e) { exdates = []; }
  }
  if (Array.isArray(exdates) && exdates.includes(date_str)) return false;

  // RFC 5545: DTSTART 始终是第一个实例
  if (date_str === template.anchor_date) return true;

  try {
    const vcalendar = createICALComponent(template);
    const vevent = vcalendar.getFirstSubcomponent('vevent');
    const event = new ICAL.Event(vevent);

    const iterator = event.iterator();
    let next;
    let count = 0; // 防无限循环
    while ((next = iterator.next()) && count < 1000) {
      const nextStr = icalTimeToDateStr(next);
      if (nextStr === date_str) return true;
      if (nextStr > date_str) return false;
      count++;
    }
    return false;
  } catch (e) {
    return simpleIsOccurrence(template, date_str);
  }
}

/** 降级方案：ical.js 解析失败时用简单规则判断（仅按 rrule 的 FREQ 粗略匹配）。 */
function simpleIsOccurrence(template, date_str) {
  const anchor = template.anchor_date;
  if (date_str < anchor) return false;

  const [ay, am, ad] = anchor.split('-').map(Number);
  const [dy, dm, dd] = date_str.split('-').map(Number);

  const rrule = template.rrule || '';
  const freqMatch = rrule.match(/^FREQ=([A-Z]+)/);
  if (!freqMatch) return false;
  const freq = freqMatch[1];

  switch (freq) {
    case 'DAILY':
      return true;
    case 'WEEKLY': {
      const anchorDate = new Date(ay, am - 1, ad);
      const targetDate = new Date(dy, dm - 1, dd);
      return anchorDate.getDay() === targetDate.getDay();
    }
    case 'MONTHLY':
      return ad === dd;
    case 'YEARLY':
      return am === dm && ad === dd;
    default:
      return false;
  }
}

/**
 * 获取两个日期之间的所有发生日期（含 anchor_date，排除 EXDATE）。
 *
 * 判定依据：与 isOccurrenceOnDate 一致，按 rrule 展开。
 */
export function getOccurrencesBetween(template, startDate, endDate, limit = 365) {
  // fragment 永远不参与 RRULE 展开
  if (template.type === 'fragment') return [];

  const has_rrule = !!(template.rrule && template.rrule.trim());
  if (!has_rrule) return [];

  const results = [];

  const anchor = template.anchor_date;
  if (anchor && anchor >= startDate && anchor <= endDate) {
    let exdates = [];
    if (template.exdates) {
      try {
        exdates = typeof template.exdates === 'string' ? JSON.parse(template.exdates) : template.exdates;
      } catch (e) { exdates = []; }
    }
    if (!Array.isArray(exdates) || !exdates.includes(anchor)) {
      results.push(anchor);
    }
  }

  try {
    const vcalendar = createICALComponent(template);
    const vevent = vcalendar.getFirstSubcomponent('vevent');
    const event = new ICAL.Event(vevent);
    const iterator = event.iterator();

    let next;
    let count = results.length;
    while ((next = iterator.next()) && count < limit) {
      const nextStr = icalTimeToDateStr(next);
      if (nextStr > endDate) break;
      if (nextStr >= startDate && (nextStr !== anchor || !results.includes(nextStr))) {
        results.push(nextStr);
      }
      count++;
    }
    return results;
  } catch (e) {
    return [];
  }
}

/**
 * 预览未来 N 次实例日期（用于 UI 显示）。
 * @param {Object} template - { rrule, anchor_date, exdates }
 * @param {number} [count=5] - 预览数量
 * @param {string} [startDate] - 起始日期（默认 anchor_date）
 * @returns {string[]} 日期数组（YYYY-MM-DD）
 */
export function previewOccurrences(template, count = 5, startDate) {
  if (!template.rrule || !template.anchor_date) return [];
  if (template.type === 'fragment') return [];

  const start = startDate || template.anchor_date;
  const results = [];

  // anchor_date 本身（如未被排除）
  let exdates = [];
  if (template.exdates) {
    try {
      exdates = typeof template.exdates === 'string' ? JSON.parse(template.exdates) : template.exdates;
    } catch (e) { exdates = []; }
  }
  if (!Array.isArray(exdates) || !exdates.includes(template.anchor_date)) {
    if (template.anchor_date >= start) results.push(template.anchor_date);
  }

  try {
    const vcalendar = createICALComponent(template);
    const vevent = vcalendar.getFirstSubcomponent('vevent');
    const event = new ICAL.Event(vevent);
    const iterator = event.iterator();

    let next;
    let safetyCount = 0;
    while ((next = iterator.next()) && results.length < count && safetyCount < 1000) {
      const nextStr = icalTimeToDateStr(next);
      if (nextStr >= start && !results.includes(nextStr) && (!Array.isArray(exdates) || !exdates.includes(nextStr))) {
        results.push(nextStr);
      }
      safetyCount++;
    }
    return results.slice(0, count);
  } catch (e) {
    return results.slice(0, count);
  }
}

// ==================== CRUD 操作引擎 ====================

/**
 * 计算删除操作的数据库动作。
 * @param {Object} params - { task, date, scope }
 * @returns {Object} 数据库操作描述
 */
export function computeDeleteActions({ task, date, scope }) {
  const parent_id = task.parent_id;
  // 后端不信任外部传入的 is_series，统一从 type 推导
  const is_series = task.type === 'recurring';

  const actions = {
    deleteTodoIds: [],
    updateTodos: [],
    updateTemplate: null,
    deleteTemplate: false,
    insertTemplate: null,
  };

  if (!is_series) {
    actions.deleteTodoIds.push(task.id);
    return actions;
  }

  switch (scope) {
    case 'this':
      actions.deleteTodoIds.push(task.id);
      actions.updateTemplate = { type: 'add_exdate', date: date, parent_id: parent_id };
      break;
    case 'thisAndFuture':
      actions.deleteTodoIds.push(task.id);
      actions.updateTemplate = { type: 'set_repeat_end', date: date, parent_id: parent_id, also_delete_future: true };
      break;
    case 'all':
      actions.deleteTemplate = true;
      actions.updateTemplate = { type: 'delete_all', parent_id: parent_id };
      break;
    default:
      actions.deleteTodoIds.push(task.id);
  }

  return actions;
}

/**
 * 计算更新操作的数据库动作（含系列拆分逻辑）。
 * @param {Object} params - { task, date, scope, new_values, new_date }
 * @returns {Object} 操作描述
 *
 * 简化：recurrence_changed 仅对比 rrule 字符串是否变化。
 */
export function computeUpdateActions({ task, date, scope, new_values, new_date }) {
  const parent_id = task.parent_id;
  const is_series = task.type === 'recurring';
  const new_type = new_values.type || task.type || 'none';
  const is_recurring = new_type === 'recurring';

  // 检测重复规则变更：仅对比 rrule 字符串
  const original_rrule = task.rrule || '';
  const new_rrule = new_values.rrule || '';
  const recurrence_changed = original_rrule !== new_rrule;

  const actions = {
    currentTodo: null,
    futureTodos: null,
    pastTodos: null,
    template: null,
    deleteTemplate: false,
    insertTemplate: null,
  };

  if (!is_series) {
    actions.currentTodo = { ...new_values, is_recurring: false };
    return actions;
  }

  switch (scope) {
    case 'this':
      // "仅此项"忽略所有重复属性变更，实例脱离系列变为单次（RFC 5545 语义）
      actions.currentTodo = {
        ...new_values,
        type: 'none',
        rrule: '',
        anchor_date: '',
        exdates: '[]',
        is_recurring: false,
        detach_from_series: true,
      };
      actions.template = { type: 'add_exdate', date: date, parent_id: parent_id };
      break;

    case 'thisAndFuture':
      // 系列分裂：旧系列截断 + 新系列从当前日期开始
      if (is_recurring) {
        actions.currentTodo = {
          ...new_values,
          is_recurring: true,
          detach_from_series: true,
          split_series: true,
        };
        actions.pastTodos = { type: 'set_repeat_end', date: date, parent_id: parent_id };
        actions.template = { type: 'set_repeat_end', date: date, parent_id: parent_id };
        actions.insertTemplate = {
          text: new_values.text,
          time: new_values.time,
          priority: new_values.priority,
          desc: new_values.desc,
          url: new_values.url,
          copy_text: new_values.copy_text !== undefined ? new_values.copy_text : '',
          subtasks: new_values.subtasks,
          search_terms: new_values.search_terms,
          type: 'recurring',
          rrule: new_values.rrule || '',
          anchor_date: new_date || date,
          exdates: '[]',
          end_time: new_values.end_time || '',
          category_id: new_values.category_id || '',
        };
      } else {
        // 改为不重复：当前项脱离系列变单次，未来项删除
        actions.currentTodo = {
          ...new_values,
          type: 'none',
          rrule: '',
          anchor_date: '',
          exdates: '[]',
          is_recurring: false,
          detach_from_series: true,
        };
        actions.pastTodos = { type: 'set_repeat_end', date: date, parent_id: parent_id };
        actions.template = { type: 'set_repeat_end', date: date, parent_id: parent_id };
      }
      break;

    case 'all':
      if (is_recurring) {
        actions.currentTodo = { ...new_values, is_recurring: true };
        actions.template = { type: 'update_all', parent_id: parent_id, new_values: new_values, recurrence_changed: recurrence_changed };
      } else {
        // 改为不重复：当前项脱离系列变单次，其他实例删除，模板删除
        actions.currentTodo = {
          ...new_values,
          type: 'none',
          rrule: '',
          anchor_date: '',
          exdates: '[]',
          is_recurring: false,
          detach_from_series: true,
        };
        actions.template = { type: 'delete', parent_id: parent_id };
      }
      break;

    default:
      // scope 未指定或 'none'，原地更新当前实例
      // 保持原重复属性（is_recurring 由 new_values.type 决定）
      actions.currentTodo = {
        ...new_values,
        is_recurring: new_values.type === 'recurring',
      };
  }

  return actions;
}

// ==================== EXDATE 管理 ====================

/** 向模板添加 EXDATE（去重）。 */
export function addExdate(currentExdates, date_str) {
  let exdates = [];
  try {
    exdates = typeof currentExdates === 'string' ? JSON.parse(currentExdates || '[]') : (Array.isArray(currentExdates) ? currentExdates : []);
  } catch (e) { exdates = []; }
  if (!exdates.includes(date_str)) {
    exdates.push(date_str);
  }
  return JSON.stringify(exdates);
}

/** 从模板移除 EXDATE。 */
export function removeExdate(currentExdates, date_str) {
  let exdates = [];
  try {
    exdates = typeof currentExdates === 'string' ? JSON.parse(currentExdates || '[]') : (Array.isArray(currentExdates) ? currentExdates : []);
  } catch (e) { exdates = []; }
  return JSON.stringify(exdates.filter(d => d !== date_str));
}

// ==================== 日期工具 ====================

export function getPreviousDate(date_str) {
  const parts = date_str.split('-');
  const d = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function getNextDate(date_str) {
  const parts = date_str.split('-');
  const d = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function getDayOfWeek(date_str) {
  const parts = date_str.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return d.getDay();
}

export function formatDateStr(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function offsetDate(date_str, days) {
  const parts = date_str.split('-');
  const d = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateStr(d);
}

// ==================== 重复类型标签 ====================

/**
 * 获取重复类型的中文标签（按 type 分流）。
 * 详细 RRULE 中文翻译由前端 _rruleToZhLabel 处理，此函数仅作 fallback。
 */
export function getRepeatLabel(type, date_str, rrule) {
  if (type === 'fragment') return '碎时记';
  if (!type || type === 'none') return '不重复';
  if (type === 'recurring') {
    // 简化标签，详细翻译由前端 _rruleToZhLabel 处理
    return '重复';
  }
  return '不重复';
}

/** 获取 scope 的中文标签。 */
export function getScopeLabel(action) {
  if (action === 'delete') {
    return { this: '仅此日程', thisAndFuture: '此日程及之后', all: '所有日程' };
  }
  return { this: '仅此日程', thisAndFuture: '此日程及之后', all: '所有日程' };
}

// ==================== 校验工具 ====================

/**
 * 校验 type 字段合法性。
 * @param {*} type
 * @returns {string|null} 合法 type 或 null
 */
export function validateType(type) {
  if (type === 'none' || type === 'fragment' || type === 'recurring') return type;
  return null;
}

/**
 * 校验 anchor_date 格式（YYYY-MM-DD 且真实存在）。
 * @param {string} dateStr
 * @returns {string|null} 错误消息，null 表示通过
 */
export function validateDateFormat(dateStr) {
  if (!dateStr) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `日期格式应为 YYYY-MM-DD，当前值: ${dateStr}`;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return `日期无效: ${dateStr}`;
  }
  return null;
}

/**
 * 校验时间 HH:MM（00:00 - 23:59）。
 */
export function validateTimeFormat(timeStr) {
  if (!timeStr) return null;
  if (!/^\d{2}:\d{2}$/.test(timeStr)) {
    return `时间格式应为 HH:MM，当前值: ${timeStr}`;
  }
  const [h, m] = timeStr.split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return `时间范围无效（HH: 00-23, MM: 00-59），当前值: ${timeStr}`;
  }
  return null;
}

/**
 * 校验 exdates 数组格式（YYYY-MM-DD 列表）。
 * @param {string|Array} exdates
 * @returns {{value: string, error: string|null}} value 是 JSON 字符串
 */
export function validateExdates(exdates) {
  if (exdates == null) return { value: '[]', error: null };
  let arr;
  if (typeof exdates === 'string') {
    if (!exdates.trim()) return { value: '[]', error: null };
    try {
      arr = JSON.parse(exdates);
    } catch (e) {
      return { value: '[]', error: 'exdates 必须是 JSON 数组字符串' };
    }
  } else if (Array.isArray(exdates)) {
    arr = exdates;
  } else {
    return { value: '[]', error: 'exdates 必须是数组或 JSON 数组字符串' };
  }
  if (!Array.isArray(arr)) {
    return { value: '[]', error: 'exdates 必须是数组' };
  }
  for (const d of arr) {
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return { value: '[]', error: `exdates 元素必须是 YYYY-MM-DD 格式，当前值: ${d}` };
    }
  }
  return { value: JSON.stringify(arr), error: null };
}
