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

  // 检测重复规则是否变更（频率、间隔）
  const original_repeat_type = task.repeat_type || 'none';
  const original_interval = task.repeat_interval || 1;
  const new_interval = new_values.repeat_interval || 1;
  const recurrence_changed = (original_repeat_type !== rpt_type) || (original_interval !== new_interval);

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
          repeat_custom: '',
          repeat_end: new_values.repeat_end || '',
          end_time: new_values.end_time || '',
          anchor_date: new_date || date,
          exdates: '[]',
          category_id: new_values.category_id || '',
          repeat_interval: new_interval,
        };
      } else {
        // 改为不重复: 当前项脱离系列变单次，未来项删除，模板保留并设repeat_end
        actions.currentTodo = { ...new_values, repeat_type: 'none', repeat_interval: 1, is_recurring: false, detach_from_series: true };
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
        actions.currentTodo = { ...new_values, repeat_type: 'none', repeat_interval: 1, is_recurring: false, detach_from_series: true };
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
