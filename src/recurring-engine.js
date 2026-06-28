/**
 * Recurring Event Engine - RFC 5545 Compliant
 *
 * 对齐业界标准:
 * - RFC 5545 (iCalendar): RRULE, EXDATE, RDATE, RECURRENCE-ID
 * - Google Calendar: this / thisAndFuture / all
 * - Nylas API: single / future / all
 * - DHTMLX Scheduler: this / series / all
 *
 * 统一为3种操作范围 (scope):
 * - "this": 仅此实例 (创建例外或添加EXDATE)
 * - "thisAndFuture": 此实例及以后 (拆分系列)
 * - "all": 所有实例 (修改模板)
 */

import ICAL from 'ical.js';

// ==================== RRULE 构建工具 ====================

const FREQ_MAP = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  yearly: 'YEARLY',
};

// repeat_custom 安全约束
// - 仅允许 DAILY/WEEKLY/MONTHLY/YEARLY（SECONDLY/MINUTELY/HOURLY 会在引擎迭代器里
//   产生天文级实例数，可能撑爆 Worker CPU / D1 写入；BYSETPOS 等不受限）
// - 最大长度 500 字符（足够覆盖 FREQ + INTERVAL + COUNT/UNTIL + BYxxx 组合）
// - 拒绝任何控制字符（CR/LF/TAB/NULL 等），避免 CRLF 注入到 iCalendar 文本
const ALLOWED_FREQ_IN_CUSTOM = new Set(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);
const REPEAT_CUSTOM_MAX_LEN = 500;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;

/**
 * 规范化并校验 repeat_custom（用户提供的自定义 RRULE 字符串）
 *
 * 接受值：
 *   - "" / null / undefined  → 返回 ""（视为未设置）
 *   - "FREQ=WEEKLY;BYDAY=MO,WE,FR"
 *   - "RRULE:FREQ=DAILY;INTERVAL=2"
 *   - "freq=weekly;byday=mo"  （大小写不敏感，整体规范化为大写）
 *
 * 拒绝值（返回 ""）：
 *   - 长度超 500
 *   - 含控制字符（CR/LF/TAB 等）
 *   - 缺少 FREQ= token
 *   - FREQ 值非 DAILY/WEEKLY/MONTHLY/YEARLY
 *   - ical.js 解析失败
 *   - 含第二个 RRULE: 前缀（防多 RRULE 注入）
 *
 * @param {*} raw - 用户输入
 * @returns {string} 规范化后的 RRULE 字符串（不含 RRULE: 前缀，全大写），无效时返回 ""
 */
export function sanitizeRepeatCustom(raw) {
  if (raw == null) return '';
  if (typeof raw !== 'string') return '';
  let s = raw.trim();
  if (!s) return '';
  if (s.length > REPEAT_CUSTOM_MAX_LEN) return '';
  if (CONTROL_CHAR_RE.test(s)) return '';

  // 剥离可选的 RRULE: 前缀（buildRRuleString 会重新加）
  if (s.startsWith('RRULE:')) s = s.slice(6).trim();
  if (!s) return '';
  // 防御：剥离前缀后不应再有 RRULE: 子串（多 RRULE 注入）
  if (s.includes('RRULE:')) return '';

  // 拆分 token，必须以 FREQ= 开头（RFC 5545 要求 FREQ 是 RRULE 的第一个 token）
  const parts = s.split(';').filter(p => p.length > 0);
  if (parts.length === 0) return '';
  const freqIdx = parts.findIndex(p => p.toUpperCase().startsWith('FREQ='));
  if (freqIdx !== 0) return ''; // FREQ 必须是第一个 token
  const freqVal = parts[0].split('=')[1]?.toUpperCase();
  if (!freqVal || !ALLOWED_FREQ_IN_CUSTOM.has(freqVal)) return '';

  // 全量大写规范化（RFC 5545 所有 token 名与值都大小写不敏感，
  // RRULE 内不存在必须小写的元素，全大写最安全，避免 ical.js 对 lowercase BYDAY 等的严格拒绝）
  const canonical = 'FREQ=' + freqVal + (parts.length > 1 ? ';' + parts.slice(1).join(';') : '').toUpperCase();

  // 终极校验：ical.js 能否解析
  try {
    ICAL.Recur.fromString(canonical);
  } catch (e) {
    return '';
  }
  return canonical;
}

/**
 * 处理 repeat_custom 输入：组合 sanitize + 与 repeat_type 的兼容性约束
 *
 * 与 repeat_type 的兼容性矩阵：
 *   - repeat_type ∈ {none, fragment} + raw 为空 → 返回 ""（静默清空）
 *   - repeat_type ∈ {none, fragment} + raw 非空：
 *       - allowDerive=true（UPDATE 场景）：仅 sanitize，不清空，让调用方尝试 deriveRepeatTypeFromCustom 反推
 *       - allowDerive=false（CREATE 场景）：静默清空为 ""（兼容旧行为）
 *   - repeat_type ∈ {daily, weekly, monthly, yearly} → 允许非空 repeat_custom，严格校验
 *
 * @param {*} raw - 用户传入的 repeat_custom
 * @param {string} repeatType - 有效的 repeat_type 值
 * @param {object} [opts] - 选项
 * @param {boolean} [opts.allowDerive=false] - UPDATE 场景下允许反推，不清空 none/fragment 的 custom
 * @returns {{value: string, error: string|null}}
 *   - value: 规范化后的 repeat_custom（永远为 string）
 *   - error: 非 null 时表示用户传入非空但校验失败，调用方应返回 400
 */
export function processRepeatCustom(raw, repeatType, opts = {}) {
  const { allowDerive = false } = opts;
  // null/undefined/'' → 视为未设置
  if (raw == null || (typeof raw === 'string' && raw.trim() === '')) {
    return { value: '', error: null };
  }
  // 类型校验：必须是字符串
  if (typeof raw !== 'string') {
    return { value: '', error: 'repeat_custom 必须为字符串' };
  }
  // repeat_type 兼容性：fragment/none 处理
  if (repeatType === 'none' || repeatType === 'fragment') {
    if (allowDerive) {
      // UPDATE 场景：sanitize 后返回，让调用方尝试 deriveRepeatTypeFromCustom 反推 repeat_type
      const sanitized = sanitizeRepeatCustom(raw);
      if (!sanitized) {
        return {
          value: '',
          error: 'repeat_custom 格式无效：必须为合法 RRULE 字符串，以 FREQ=DAILY/WEEKLY/MONTHLY/YEARLY 开头，长度 ≤ 500，不含换行/控制字符',
        };
      }
      return { value: sanitized, error: null };
    }
    // CREATE 场景：静默清空（匹配既有 fragment-clear 模式）
    return { value: '', error: null };
  }
  // 非空 + 非 fragment/none → 严格校验
  const sanitized = sanitizeRepeatCustom(raw);
  if (!sanitized) {
    return {
      value: '',
      error: 'repeat_custom 格式无效：必须为合法 RRULE 字符串，以 FREQ=DAILY/WEEKLY/MONTHLY/YEARLY 开头，长度 ≤ 500，不含换行/控制字符',
    };
  }
  return { value: sanitized, error: null };
}

// ==================== 联动推导与原子组校验 ====================

/**
 * 从 repeat_custom 反推 repeat_type
 *
 * 当调用方传了 repeat_custom（非空），但未传 repeat_type 或 repeat_type 与 custom 的 FREQ 不一致时，
 * 服务端用 custom 的 FREQ 反推 repeat_type，保证 DB 中 repeat_type 与实际展开规则一致。
 *
 * 反推规则：
 *   FREQ=DAILY   → daily
 *   FREQ=WEEKLY  → weekly
 *   FREQ=MONTHLY → monthly
 *   FREQ=YEARLY  → yearly
 *
 * @param {string} repeatCustom - 已 sanitize 的 repeat_custom 字符串
 * @returns {string|null} 反推出的 repeat_type，或 null（custom 为空或无法解析）
 */
export function deriveRepeatTypeFromCustom(repeatCustom) {
  if (!repeatCustom || !repeatCustom.trim()) return null;
  const m = repeatCustom.match(/^FREQ=([A-Z]+)/);
  if (!m) return null;
  const freq = m[1];
  const reverseMap = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' };
  return reverseMap[freq] || null;
}

/**
 * 校验 time 与 end_time 的时序一致性
 *
 * 规则：若 time 和 end_time 都非空且在同一天，time 不能晚于 end_time。
 * 允许 end_time 为空（表示无结束时间）。
 * 允许 time == end_time（零耗时，勾选完成场景）。
 *
 * @param {string} time - HH:MM 格式
 * @param {string} endTime - HH:MM 格式
 * @returns {string|null} 错误消息，null 表示通过
 */
export function validateTimeRange(time, endTime) {
  if (!time || !endTime) return null;
  const timeRe = /^\d{2}:\d{2}$/;
  if (!timeRe.test(time) || !timeRe.test(endTime)) return null; // 格式不符交给其他校验
  if (time > endTime) {
    return `time (${time}) 不能晚于 end_time (${endTime})`;
  }
  return null;
}

/**
 * 校验 repeat_end 与 repeat_type 的兼容性（原子组）
 *
 * 规则：repeat_end 非空时，repeat_type 必须是 daily/weekly/monthly/yearly。
 * none/fragment 类型无 RRULE，repeat_end 无意义，应拒绝。
 * 同时校验 repeat_end 格式为 YYYY-MM-DD。
 *
 * @param {string} repeatEnd - YYYY-MM-DD 或空
 * @param {string} repeatType - none/daily/weekly/monthly/yearly/fragment
 * @returns {string|null} 错误消息，null 表示通过
 */
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

/**
 * 校验 repeat_interval 与 repeat_type 的兼容性
 *
 * 规则：repeat_interval > 1 时，repeat_type 必须是 daily/weekly/monthly/yearly。
 * none/fragment 类型 repeat_interval 强制为 1，传 > 1 应拒绝（防止数据不一致）。
 * 同时校验 repeat_interval 为正整数。
 *
 * @param {number} repeatInterval
 * @param {string} repeatType
 * @returns {string|null} 错误消息，null 表示通过
 */
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

/**
 * 校验日期格式 YYYY-MM-DD
 * @param {string} dateStr
 * @returns {string|null} 错误消息，null 表示通过
 */
export function validateDateFormat(dateStr) {
  if (!dateStr) return null; // 空值由其他校验处理（如 fragment 允许空）
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `日期格式应为 YYYY-MM-DD，当前值: ${dateStr}`;
  }
  // 校验真实日期（防 2026-13-45）
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return `日期无效: ${dateStr}`;
  }
  return null;
}

/**
 * 校验时间格式 HH:MM（00:00 - 23:59）
 * @param {string} timeStr
 * @returns {string|null} 错误消息，null 表示通过
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

const DAY_MAP = ['', 'SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
// ical.js dayOfWeek() 返回 1(周日)-7(周六)，DAY_MAP[1]='SU', DAY_MAP[2]='MO', ...

/**
 * 将日期字符串转为 ICAL Time
 */
function dateStrToICALTime(date_str) {
  const parts = date_str.split('-');
  return new ICAL.Time({
    year: parseInt(parts[0]),
    month: parseInt(parts[1]),
    day: parseInt(parts[2]),
    isDate: true,
  });
}

/**
 * 将 ICAL Time 转为日期字符串
 */
function icalTimeToDateStr(time) {
  const y = time.year;
  const m = String(time.month).padStart(2, '0');
  const d = String(time.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 构建RFC 5545 RRULE字符串
 * @param {string} repeatType - daily/weekly/monthly/yearly
 * @param {string} anchorDate - 起始日期 YYYY-MM-DD
 * @param {string} [repeat_end] - 结束日期 YYYY-MM-DD
 * @param {string} [repeatCustom] - 自定义RRULE字符串
 * @param {number} [repeatInterval] - 重复间隔
 * @returns {string} RRULE字符串
 */
function buildRRuleString(repeatType, anchorDate, repeat_end, repeatCustom, repeatInterval) {
  if (repeatCustom && repeatCustom.trim()) {
    let rrule = repeatCustom.trim();
    if (!rrule.startsWith('RRULE:')) rrule = 'RRULE:' + rrule;

    // repeatInterval 参数覆盖 repeatCustom 中的 INTERVAL
    if (repeatInterval && repeatInterval > 1) {
      if (rrule.includes('INTERVAL=')) {
        rrule = rrule.replace(/INTERVAL=\d+/, `INTERVAL=${repeatInterval}`);
      } else {
        // 在 FREQ 之后插入 INTERVAL
        rrule = rrule.replace(/(FREQ=[A-Z]+)/, `$1;INTERVAL=${repeatInterval}`);
      }
    }

    if (repeat_end && !rrule.includes('UNTIL')) {
      const untilStr = repeat_end.replace(/-/g, '') + 'T235959Z';
      rrule = rrule + ';UNTIL=' + untilStr;
    }
    return rrule;
  }

  if (!repeatType || repeatType === 'none' || !anchorDate) return '';

  const freq = FREQ_MAP[repeatType];
  if (!freq) return '';

  let parts = [`FREQ=${freq}`];

  // INTERVAL 紧跟 FREQ（RFC 5545 标准顺序）
  if (repeatInterval && repeatInterval > 1) {
    parts.push(`INTERVAL=${repeatInterval}`);
  }

  // weekly: 添加BYDAY
  if (repeatType === 'weekly') {
    const d = dateStrToICALTime(anchorDate);
    parts.push(`BYDAY=${DAY_MAP[d.dayOfWeek()]}`);
  }

  // monthly: 添加BYMONTHDAY
  if (repeatType === 'monthly') {
    const d = dateStrToICALTime(anchorDate);
    parts.push(`BYMONTHDAY=${d.day}`);
  }

  // yearly: 添加BYMONTH和BYMONTHDAY
  if (repeatType === 'yearly') {
    const d = dateStrToICALTime(anchorDate);
    parts.push(`BYMONTH=${d.month}`);
    parts.push(`BYMONTHDAY=${d.day}`);
  }

  if (repeat_end) {
    const untilStr = repeat_end.replace(/-/g, '') + 'T235959Z';
    parts.push(`UNTIL=${untilStr}`);
  }

  return 'RRULE:' + parts.join(';');
}

/**
 * 创建ICAL Event组件用于计算重复日期
 */
function createICALComponent(template) {
  const vcalendar = new ICAL.Component(['vcalendar', [], []]);
  vcalendar.addPropertyWithValue('version', '2.0');
  vcalendar.addPropertyWithValue('prodid', '-//cf-todo//recurring-engine//EN');

  const vevent = new ICAL.Component('vevent');
  vevent.addPropertyWithValue('uid', template.parent_id || 'temp');
  vevent.addPropertyWithValue('dtstart', dateStrToICALTime(template.anchor_date));

  const rruleStr = buildRRuleString(
    template.repeat_type,
    template.anchor_date,
    template.repeat_end,
    template.repeat_custom,
    template.repeat_interval
  );
  if (rruleStr) {
    // ical.js: RRULE属性需要使用ICAL.Recur对象
    const rruleProp = new ICAL.Property('rrule', vevent);
    rruleProp.setValue(ICAL.Recur.fromString(rruleStr.replace('RRULE:', '')));
    vevent.addProperty(rruleProp);
  }

  // 添加EXDATE
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
 * 判断某日期是否为重复事件的发生日期
 *
 * RFC 5545 规定: DTSTART 始终是第一个实例，即使不匹配 RRULE。
 * ical.js 的行为: 仅当 DTSTART 匹配 RRULE 时才包含，否则跳过。
 * 此函数对齐 RFC 5545 标准，确保 anchor_date (DTSTART) 始终被视为发生日期。
 *
 * @param {Object} template - 模板对象
 * @param {string} date_str - 目标日期 YYYY-MM-DD
 * @returns {boolean}
 */
export function isOccurrenceOnDate(template, date_str) {
  if (!template.repeat_type || template.repeat_type === 'none') return false;
  // 碎时记 (fragment) 无模板，永远不会通过模板扩展生成实例
  if (template.repeat_type === 'fragment') return false;
  if (!template.anchor_date || template.anchor_date > date_str) return false;

  // 检查是否在EXDATE中
  let exdates = [];
  if (template.exdates) {
    try {
      exdates = typeof template.exdates === 'string' ? JSON.parse(template.exdates) : template.exdates;
    } catch (e) { exdates = []; }
  }
  if (Array.isArray(exdates) && exdates.includes(date_str)) return false;

  // 检查repeat_end
  if (template.repeat_end && date_str > template.repeat_end) return false;

  // RFC 5545: DTSTART 始终是第一个实例，即使不匹配 RRULE
  if (date_str === template.anchor_date) return true;

  // 使用ICAL.js计算后续实例
  try {
    const vcalendar = createICALComponent(template);
    const vevent = vcalendar.getFirstSubcomponent('vevent');
    const event = new ICAL.Event(vevent);

    // 使用迭代器检查目标日期是否为发生日期
    const iterator = event.iterator();
    let next;
    // 最多迭代1000次防止无限循环
    let count = 0;
    while ((next = iterator.next()) && count < 1000) {
      const nextStr = icalTimeToDateStr(next);
      if (nextStr === date_str) return true;
      if (nextStr > date_str) return false;
      count++;
    }
    return false;
  } catch (e) {
    // 降级: 使用简单规则判断
    return simpleIsOccurrence(template, date_str);
  }
}

/**
 * 简单规则判断（降级方案）
 */
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
 * 获取两个日期之间的所有发生日期
 *
 * RFC 5545: DTSTART 始终是第一个实例。ical.js 可能跳过不匹配 RRULE 的 DTSTART，
 * 因此需要显式确保 anchor_date 被包含。
 *
 * @param {Object} template - 模板对象
 * @param {string} startDate - 起始日期
 * @param {string} endDate - 结束日期
 * @param {number} [limit=365] - 最大返回数量
 * @returns {string[]} 日期字符串数组
 */
export function getOccurrencesBetween(template, startDate, endDate, limit = 365) {
  if (!template.repeat_type || template.repeat_type === 'none') return [];
  // 碎时记 (fragment) 无模板，不会通过模板扩展生成实例
  if (template.repeat_type === 'fragment') return [];

  const results = [];

  // RFC 5545: DTSTART 始终是第一个实例
  const anchor = template.anchor_date;
  if (anchor && anchor >= startDate && anchor <= endDate) {
    // 检查 anchor_date 是否在 EXDATE 中
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
    let count = results.length; // 已包含 anchor，计入 limit
    while ((next = iterator.next()) && count < limit) {
      const nextStr = icalTimeToDateStr(next);
      if (nextStr > endDate) break;
      if (nextStr >= startDate) {
        // 避免重复添加 anchor_date（ical.js 可能已包含）
        if (nextStr !== anchor || !results.includes(nextStr)) {
          results.push(nextStr);
        }
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
 * 删除循环事件实例
 * @param {Object} params
 * @param {Object} params.task - 当前任务实例
 * @param {string} params.date - 当前日期
 * @param {string} params.scope - 操作范围: "this" | "thisAndFuture" | "all"
 * @param {Function} params.db - D1数据库操作辅助函数
 * @returns {Object} 数据库操作语句数组
 */
export function computeDeleteActions({ task, date, scope }) {
  const parent_id = task.parent_id;
  // 碎时记 (fragment) 不算重复系列，直接软删除
  // 后端不信任外部传入的 is_series，统一从 DB repeat_type 推导
  const is_series = task.is_series || (task.repeat_type && task.repeat_type !== 'none' && task.repeat_type !== 'fragment');

  const actions = {
    deleteTodoIds: [],
    updateTodos: [],
    updateTemplate: null,
    deleteTemplate: false,
    insertTemplate: null,
  };

  if (!is_series) {
    // 非循环任务: 直接删除
    actions.deleteTodoIds.push(task.id);
    return actions;
  }

  switch (scope) {
    case 'this': {
      // 仅删除此实例: 软删除当前实例 + 添加EXDATE到模板
      actions.deleteTodoIds.push(task.id);
      actions.updateTemplate = { type: 'add_exdate', date: date, parent_id: parent_id };
      break;
    }

    case 'thisAndFuture': {
      // 删除此实例及以后: 软删除当前及以后的实例 + 设置模板repeat_end为当前日期前一天
      actions.deleteTodoIds.push(task.id);
      actions.updateTemplate = { type: 'set_repeat_end', date: date, parent_id: parent_id, also_delete_future: true };
      break;
    }

    case 'all': {
      // 删除所有实例: 软删除所有实例 + 删除模板
      actions.deleteTemplate = true;
      actions.updateTemplate = { type: 'delete_all', parent_id: parent_id };
      break;
    }

    default:
      actions.deleteTodoIds.push(task.id);
  }

  return actions;
}

/**
 * 更新循环事件实例
 * @param {Object} params
 * @param {Object} params.task - 当前任务实例（含修改后的字段）
 * @param {string} params.date - 原始日期
 * @param {string} params.scope - 操作范围: "this" | "thisAndFuture" | "all"
 * @param {Object} params.new_values - 新值
 * @returns {Object} 操作描述
 */
export function computeUpdateActions({ task, date, scope, new_values, new_date }) {
  const parent_id = task.parent_id;
  // 碎时记 (fragment) 不算重复系列
  // 后端不信任外部传入的 is_series，统一从 DB repeat_type 推导
  const is_series = task.is_series || (task.repeat_type && task.repeat_type !== 'none' && task.repeat_type !== 'fragment');
  const rpt_type = new_values.repeat_type || task.repeat_type || 'none';
  // 碎时记不算 recurring（不会创建模板、不会分裂系列）
  const is_recurring = rpt_type !== 'none' && rpt_type !== 'fragment';

  // 检测重复规则是否变更（频率、间隔、自定义 RRULE）
  // - repeat_custom 变更纳入检测：custom 非空时实际展开规则完全由它决定，
  //   若用户改了 custom 但 type/interval 未变，旧实例仍需删除并由模板重新生成
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
    // 非循环任务: 直接更新
    actions.currentTodo = { ...new_values, is_recurring: false };
    return actions;
  }

  switch (scope) {
    case 'this': {
      // 仅修改此实例: 脱离模板，变为非重复单次事项
      // 遵循标准规则（Google Calendar / RFC 5545）：
      // "仅此项"忽略所有重复属性变更（间隔、频率、截止），实例脱离系列变为单次
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
    }

    case 'thisAndFuture': {
      // 标准规则（CalConnect / RFC 5545 Split）：
      // 系列分裂为两个独立系列：
      //   - 旧系列：截断（设置 repeat_end 到当前日期前一天）
      //   - 新系列：从当前日期开始，使用新的重复属性（频率、间隔、截止等）
      if (is_recurring) {
        actions.currentTodo = {
          ...new_values,
          is_recurring: true,
          detach_from_series: true,
          split_series: true,
        };
        actions.pastTodos = { type: 'set_repeat_end', date: date, parent_id: parent_id };
        // 旧模板：截断
        actions.template = { type: 'set_repeat_end', date: date, parent_id: parent_id };
        // 新模板：api.js 负责生成 newParentId 并创建
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
        // 改为不重复: 当前项脱离系列变单次，未来项删除，模板保留并设repeat_end
        actions.currentTodo = { ...new_values, repeat_type: 'none', repeat_custom: '', repeat_end: '', repeat_interval: 1, is_recurring: false, detach_from_series: true };
        actions.pastTodos = { type: 'set_repeat_end', date: date, parent_id: parent_id };
        actions.template = { type: 'set_repeat_end', date: date, parent_id: parent_id };
      }
      break;
    }

    case 'all': {
      // 修改所有实例: 更新模板
      if (is_recurring) {
        actions.currentTodo = { ...new_values, is_recurring: true };
        // 传递 recurrence_changed 标志，让 api.js 决定是否需要删除旧实例重新生成
        actions.template = { type: 'update_all', parent_id: parent_id, new_values: new_values, recurrence_changed: recurrence_changed };
      } else {
        // 改为不重复: 当前项脱离系列变单次，所有其他实例删除，模板删除
        actions.currentTodo = { ...new_values, repeat_type: 'none', repeat_custom: '', repeat_end: '', repeat_interval: 1, is_recurring: false, detach_from_series: true };
        actions.template = { type: 'delete', parent_id: parent_id };
      }
      break;
    }

    default:
      actions.currentTodo = { ...new_values };
  }

  return actions;
}

// ==================== EXDATE 管理 ====================

/**
 * 向模板添加EXDATE
 * @param {string} currentExdates - 当前EXDATE JSON字符串
 * @param {string} date_str - 要排除的日期
 * @returns {string} 新的EXDATE JSON字符串
 */
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

/**
 * 从模板移除EXDATE
 * @param {string} currentExdates - 当前EXDATE JSON字符串
 * @param {string} date_str - 要恢复的日期
 * @returns {string} 新的EXDATE JSON字符串
 */
export function removeExdate(currentExdates, date_str) {
  let exdates = [];
  try {
    exdates = typeof currentExdates === 'string' ? JSON.parse(currentExdates || '[]') : (Array.isArray(currentExdates) ? currentExdates : []);
  } catch (e) { exdates = []; }
  exdates = exdates.filter(d => d !== date_str);
  return JSON.stringify(exdates);
}

// ==================== 日期工具 ====================

/**
 * 获取某日期的前一天
 */
export function getPreviousDate(date_str) {
  const parts = date_str.split('-');
  const d = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * 获取某日期的后一天
 */
export function getNextDate(date_str) {
  const parts = date_str.split('-');
  const d = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
  d.setUTCDate(d.getUTCDate() + 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * 获取星期几 (0=日, 1=一, ..., 6=六)
 */
export function getDayOfWeek(date_str) {
  const parts = date_str.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return d.getDay();
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDateStr(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 日期偏移
 */
export function offsetDate(date_str, days) {
  const parts = date_str.split('-');
  const d = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateStr(d);
}

// ==================== 重复类型标签 ====================

/**
 * 获取重复类型的中文标签 (对齐Google Calendar)
 */
export function getRepeatLabel(repeatType, date_str, repeat_end, repeatInterval) {
  // 碎时记 (fragment): 一次性浮动事项，固定显示"碎时记"
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
    const dayOfWeek = getDayOfWeek(date_str);
    let label = n ? `每${n}周${days[dayOfWeek]}` : `每周${days[dayOfWeek]}`;
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
  if (n && repeatType === 'daily') {
    label = `每${n}天`;
  }
  if (repeat_end && repeatType !== 'none') {
    label += `·至${repeat_end}`;
  }
  return label;
}

/**
 * 获取scope的中文标签 (对齐Google Calendar)
 */
export function getScopeLabels(action) {
  if (action === 'delete') {
    return {
      this: '仅此日程',
      thisAndFuture: '此日程及之后',
      all: '所有日程',
    };
  }
  return {
    this: '仅此日程',
    thisAndFuture: '此日程及之后',
    all: '所有日程',
  };
}
