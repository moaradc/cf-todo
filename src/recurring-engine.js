/**
 * Recurring Event Engine - RFC 5545 Compliant
 *
 * scope 三种操作范围（对齐 Google Calendar / Nylas / DHTMLX Scheduler）:
 * - "this": 仅此实例（创建例外或添加 EXDATE）
 * - "thisAndFuture": 此实例及以后（拆分系列）
 * - "all": 所有实例（修改模板）
 */

import ICAL from 'ical.js';

// ==================== RRULE 构建工具 ====================

const FREQ_MAP = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  yearly: 'YEARLY',
};

// repeat_custom 安全约束：仅允许 DAILY/WEEKLY/MONTHLY/YEARLY（高频 FREQ 会撑爆 Worker CPU），
// 最大长度 500，拒绝控制字符防 CRLF 注入
const ALLOWED_FREQ_IN_CUSTOM = new Set(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);
const REPEAT_CUSTOM_MAX_LEN = 500;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;

/**
 * 规范化并校验 repeat_custom。无效时返回 ""。
 * 自动剥离 RRULE: 前缀，全大写规范化，最终用 ical.js 解析作为终极校验。
 */
export function sanitizeRepeatCustom(raw) {
  if (raw == null) return '';
  if (typeof raw !== 'string') return '';
  let s = raw.trim();
  if (!s) return '';
  if (s.length > REPEAT_CUSTOM_MAX_LEN) return '';
  if (CONTROL_CHAR_RE.test(s)) return '';

  if (s.startsWith('RRULE:')) s = s.slice(6).trim();
  if (!s) return '';
  if (s.includes('RRULE:')) return ''; // 防多 RRULE 注入

  // FREQ 必须是第一个 token
  const parts = s.split(';').filter(p => p.length > 0);
  if (parts.length === 0) return '';
  if (!parts[0].toUpperCase().startsWith('FREQ=')) return '';
  const freqVal = parts[0].split('=')[1]?.toUpperCase();
  if (!freqVal || !ALLOWED_FREQ_IN_CUSTOM.has(freqVal)) return '';

  const canonical = 'FREQ=' + freqVal + (parts.length > 1 ? ';' + parts.slice(1).join(';') : '').toUpperCase();

  try {
    ICAL.Recur.fromString(canonical);
  } catch (e) {
    return '';
  }
  return canonical;
}

/**
 * 处理 repeat_custom 输入：组合 sanitize + 与 repeat_type 的兼容性约束。
 * @param {*} raw - 用户传入的 repeat_custom
 * @param {string} repeatType - 有效的 repeat_type 值
 * @param {object} [opts]
 * @param {boolean} [opts.allowDerive=false] - UPDATE 场景下允许反推，不清空 none/fragment 的 custom
 * @returns {{value: string, error: string|null}} error 非 null 时调用方应返回 400
 */
export function processRepeatCustom(raw, repeatType, opts = {}) {
  const { allowDerive = false } = opts;
  if (raw == null || (typeof raw === 'string' && raw.trim() === '')) {
    return { value: '', error: null };
  }
  if (typeof raw !== 'string') {
    return { value: '', error: 'repeat_custom 必须为字符串' };
  }
  // fragment/none + raw 非空：UPDATE 允许反推，CREATE 静默清空
  if (repeatType === 'none' || repeatType === 'fragment') {
    if (allowDerive) {
      const sanitized = sanitizeRepeatCustom(raw);
      if (!sanitized) {
        return { value: '', error: 'repeat_custom 格式无效：必须为合法 RRULE 字符串，以 FREQ=DAILY/WEEKLY/MONTHLY/YEARLY 开头，长度 ≤ 500，不含换行/控制字符' };
      }
      return { value: sanitized, error: null };
    }
    return { value: '', error: null };
  }
  // 严格校验
  const sanitized = sanitizeRepeatCustom(raw);
  if (!sanitized) {
    return { value: '', error: 'repeat_custom 格式无效：必须为合法 RRULE 字符串，以 FREQ=DAILY/WEEKLY/MONTHLY/YEARLY 开头，长度 ≤ 500，不含换行/控制字符' };
  }
  return { value: sanitized, error: null };
}

// ==================== 联动推导与原子组校验 ====================

/** 从 repeat_custom 的 FREQ 反推 repeat_type，保证 DB 中 type 与展开规则一致。 */
export function deriveRepeatTypeFromCustom(repeatCustom) {
  if (!repeatCustom || !repeatCustom.trim()) return null;
  const m = repeatCustom.match(/^FREQ=([A-Z]+)/);
  if (!m) return null;
  const reverseMap = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' };
  return reverseMap[m[1]] || null;
}

/** 校验 repeat_end 与 repeat_type 兼容性：none/fragment 无 RRULE，repeat_end 应拒绝。 */
export function validateRepeatEndCompat(repeatEnd, repeatType) {
  if (!repeatEnd) return null;
  if (repeatType === 'none' || repeatType === 'fragment') {
    return `repeat_end 仅在 repeat_type 为 daily/weekly/monthly/yearly 时有效，当前 repeat_type=${repeatType}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(repeatEnd)) {
    return `repeat_end 格式应为 YYYY-MM-DD，当前值: ${repeatEnd}`;
  }
  return null;
}

/** 校验 repeat_interval：必须为正整数，>1 时 repeat_type 必须 ∈ {daily,weekly,monthly,yearly}。 */
export function validateRepeatIntervalCompat(repeatInterval, repeatType) {
  if (repeatInterval == null) return null;
  if (typeof repeatInterval !== 'number' || !Number.isInteger(repeatInterval) || repeatInterval < 1) {
    return 'repeat_interval 必须为正整数';
  }
  if (repeatInterval > 1 && (repeatType === 'none' || repeatType === 'fragment')) {
    return `repeat_interval > 1 仅在 repeat_type 为 daily/weekly/monthly/yearly 时有效，当前 repeat_type=${repeatType}`;
  }
  return null;
}

/** 校验日期 YYYY-MM-DD 且真实存在（防 2026-13-45）。 */
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

/** 校验时间 HH:MM（00:00 - 23:59）。 */
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

const DAY_MAP = ['', 'SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

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

/**
 * 构建 RFC 5545 RRULE 字符串。
 * repeatCustom 非空时优先使用，repeatInterval > 1 覆盖 custom 中的 INTERVAL，
 * repeat_end 在 custom 未含 UNTIL 时追加。
 */
function buildRRuleString(repeatType, anchorDate, repeat_end, repeatCustom, repeatInterval) {
  if (repeatCustom && repeatCustom.trim()) {
    let rrule = repeatCustom.trim();
    if (!rrule.startsWith('RRULE:')) rrule = 'RRULE:' + rrule;

    if (repeatInterval && repeatInterval > 1) {
      if (rrule.includes('INTERVAL=')) {
        rrule = rrule.replace(/INTERVAL=\d+/, `INTERVAL=${repeatInterval}`);
      } else {
        rrule = rrule.replace(/(FREQ=[A-Z]+)/, `$1;INTERVAL=${repeatInterval}`);
      }
    }

    if (repeat_end && !rrule.includes('UNTIL')) {
      rrule = rrule + ';UNTIL=' + repeat_end.replace(/-/g, '') + 'T235959Z';
    }
    return rrule;
  }

  if (!repeatType || repeatType === 'none' || !anchorDate) return '';

  const freq = FREQ_MAP[repeatType];
  if (!freq) return '';

  let parts = [`FREQ=${freq}`];
  if (repeatInterval && repeatInterval > 1) parts.push(`INTERVAL=${repeatInterval}`);

  if (repeatType === 'weekly') {
    const d = dateStrToICALTime(anchorDate);
    parts.push(`BYDAY=${DAY_MAP[d.dayOfWeek()]}`);
  }
  if (repeatType === 'monthly') {
    const d = dateStrToICALTime(anchorDate);
    parts.push(`BYMONTHDAY=${d.day}`);
  }
  if (repeatType === 'yearly') {
    const d = dateStrToICALTime(anchorDate);
    parts.push(`BYMONTH=${d.month}`);
    parts.push(`BYMONTHDAY=${d.day}`);
  }

  if (repeat_end) {
    parts.push(`UNTIL=${repeat_end.replace(/-/g, '')}T235959Z`);
  }

  return 'RRULE:' + parts.join(';');
}

function createICALComponent(template) {
  const vcalendar = new ICAL.Component(['vcalendar', [], []]);
  vcalendar.addPropertyWithValue('version', '2.0');
  vcalendar.addPropertyWithValue('prodid', '-//cf-todo//recurring-engine//EN');

  const vevent = new ICAL.Component('vevent');
  vevent.addPropertyWithValue('uid', template.parent_id || 'temp');
  vevent.addPropertyWithValue('dtstart', dateStrToICALTime(template.anchor_date));

  const rruleStr = buildRRuleString(
    template.repeat_type, template.anchor_date, template.repeat_end,
    template.repeat_custom, template.repeat_interval
  );
  if (rruleStr) {
    const rruleProp = new ICAL.Property('rrule', vevent);
    rruleProp.setValue(ICAL.Recur.fromString(rruleStr.replace('RRULE:', '')));
    vevent.addProperty(rruleProp);
  }

  // EXDATE 始终叠加（独立 DB 列，非 RRULE 字符串一部分）
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
 */
export function isOccurrenceOnDate(template, date_str) {
  if (!template.repeat_type || template.repeat_type === 'none') return false;
  if (template.repeat_type === 'fragment') return false;
  if (!template.anchor_date || template.anchor_date > date_str) return false;

  let exdates = [];
  if (template.exdates) {
    try {
      exdates = typeof template.exdates === 'string' ? JSON.parse(template.exdates) : template.exdates;
    } catch (e) { exdates = []; }
  }
  if (Array.isArray(exdates) && exdates.includes(date_str)) return false;

  if (template.repeat_end && date_str > template.repeat_end) return false;

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

/** 降级方案：ical.js 解析失败时用简单规则判断。 */
function simpleIsOccurrence(template, date_str) {
  const anchor = template.anchor_date;
  if (date_str < anchor) return false;
  if (template.repeat_end && date_str > template.repeat_end) return false;

  const [ay, am, ad] = anchor.split('-').map(Number);
  const [dy, dm, dd] = date_str.split('-').map(Number);

  switch (template.repeat_type) {
    case 'daily':
      return true;
    case 'weekly': {
      const anchorDate = new Date(ay, am - 1, ad);
      const targetDate = new Date(dy, dm - 1, dd);
      return anchorDate.getDay() === targetDate.getDay();
    }
    case 'monthly':
      return ad === dd;
    case 'yearly':
      return am === dm && ad === dd;
    default:
      return false;
  }
}

/**
 * 获取两个日期之间的所有发生日期（含 anchor_date，排除 EXDATE）。
 */
export function getOccurrencesBetween(template, startDate, endDate, limit = 365) {
  if (!template.repeat_type || template.repeat_type === 'none') return [];
  if (template.repeat_type === 'fragment') return [];

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

// ==================== CRUD 操作引擎 ====================

/**
 * 计算删除操作的数据库动作。
 * @param {Object} params - { task, date, scope }
 * @returns {Object} 数据库操作描述
 */
export function computeDeleteActions({ task, date, scope }) {
  const parent_id = task.parent_id;
  // 后端不信任外部传入的 is_series，统一从 repeat_type 推导
  const is_series = task.is_series || (task.repeat_type && task.repeat_type !== 'none' && task.repeat_type !== 'fragment');

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
 */
export function computeUpdateActions({ task, date, scope, new_values, new_date }) {
  const parent_id = task.parent_id;
  const is_series = task.is_series || (task.repeat_type && task.repeat_type !== 'none' && task.repeat_type !== 'fragment');
  const rpt_type = new_values.repeat_type || task.repeat_type || 'none';
  const is_recurring = rpt_type !== 'none' && rpt_type !== 'fragment';

  // 检测重复规则变更（频率、间隔、custom）
  const original_repeat_type = task.repeat_type || 'none';
  const original_interval = task.repeat_interval || 1;
  const original_repeat_custom = task.repeat_custom || '';
  const new_interval = new_values.repeat_interval || 1;
  const new_repeat_custom = new_values.repeat_custom || '';
  const recurrence_changed = (original_repeat_type !== rpt_type)
    || (original_interval !== new_interval)
    || (original_repeat_custom !== new_repeat_custom);

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
      // "仅此项"忽略所有重复属性变更，实例脱离系列变为单次（对齐 Google Calendar / RFC 5545）
      actions.currentTodo = {
        ...new_values,
        repeat_type: 'none',
        repeat_custom: '',
        repeat_end: '',
        repeat_interval: 1,
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
          repeat_type: rpt_type,
          repeat_custom: new_values.repeat_custom || '',
          repeat_end: new_values.repeat_end || '',
          end_time: new_values.end_time || '',
          anchor_date: new_date || date,
          exdates: '[]',
          category_id: new_values.category_id || '',
          repeat_interval: new_interval,
        };
      } else {
        // 改为不重复：当前项脱离系列变单次，未来项删除
        actions.currentTodo = { ...new_values, repeat_type: 'none', repeat_custom: '', repeat_end: '', repeat_interval: 1, is_recurring: false, detach_from_series: true };
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
        actions.currentTodo = { ...new_values, repeat_type: 'none', repeat_custom: '', repeat_end: '', repeat_interval: 1, is_recurring: false, detach_from_series: true };
        actions.template = { type: 'delete', parent_id: parent_id };
      }
      break;

    default:
      actions.currentTodo = { ...new_values };
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

/** 获取重复类型的中文标签（对齐 Google Calendar）。 */
export function getRepeatLabel(repeatType, date_str, repeat_end, repeatInterval) {
  if (repeatType === 'fragment') return '碎时记';
  const labels = {
    none: '不重复',
    daily: '每天',
    weekly: '',
    monthly: '',
    yearly: '',
  };

  const n = repeatInterval && repeatInterval > 1 ? repeatInterval : null;

  if (repeatType === 'weekly' && date_str) {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    let label = n ? `每${n}周${days[getDayOfWeek(date_str)]}` : `每周${days[getDayOfWeek(date_str)]}`;
    if (repeat_end) label += `·至${repeat_end}`;
    return label;
  }

  if (repeatType === 'monthly' && date_str) {
    const day = parseInt(date_str.split('-')[2], 10);
    let label = n ? `每${n}月${day}号` : `每月${day}号`;
    if (repeat_end) label += `·至${repeat_end}`;
    return label;
  }

  if (repeatType === 'yearly' && date_str) {
    const parts = date_str.split('-');
    let label = n ? `每${n}年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日` : `每年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
    if (repeat_end) label += `·至${repeat_end}`;
    return label;
  }

  let label = labels[repeatType] || '不重复';
  if (n && repeatType === 'daily') label = `每${n}天`;
  if (repeat_end && repeatType !== 'none') label += `·至${repeat_end}`;
  return label;
}

/** 获取 scope 的中文标签。 */
export function getScopeLabels(action) {
  if (action === 'delete') {
    return { this: '仅此日程', thisAndFuture: '此日程及之后', all: '所有日程' };
  }
  return { this: '仅此日程', thisAndFuture: '此日程及之后', all: '所有日程' };
}
