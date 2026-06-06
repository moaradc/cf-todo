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
function dateStrToICALTime(dateStr) {
  const parts = dateStr.split('-');
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
 * @param {string} [repeatEnd] - 结束日期 YYYY-MM-DD
 * @param {string} [repeatCustom] - 自定义RRULE字符串
 * @returns {string} RRULE字符串
 */
function buildRRuleString(repeatType, anchorDate, repeatEnd, repeatCustom) {
  if (repeatCustom && repeatCustom.trim()) {
    let rrule = repeatCustom.trim();
    if (!rrule.startsWith('RRULE:')) rrule = 'RRULE:' + rrule;
    if (repeatEnd && !rrule.includes('UNTIL')) {
      const untilStr = repeatEnd.replace(/-/g, '') + 'T235959Z';
      rrule = rrule + ';UNTIL=' + untilStr;
    }
    return rrule;
  }

  if (!repeatType || repeatType === 'none' || !anchorDate) return '';

  const freq = FREQ_MAP[repeatType];
  if (!freq) return '';

  let parts = [`FREQ=${freq}`];

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

  if (repeatEnd) {
    const untilStr = repeatEnd.replace(/-/g, '') + 'T235959Z';
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
    template.repeat_custom
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
 * @param {Object} template - 模板对象
 * @param {string} dateStr - 目标日期 YYYY-MM-DD
 * @returns {boolean}
 */
export function isOccurrenceOnDate(template, dateStr) {
  if (!template.repeat_type || template.repeat_type === 'none') return false;
  if (!template.anchor_date || template.anchor_date > dateStr) return false;

  // 检查是否在EXDATE中
  let exdates = [];
  if (template.exdates) {
    try {
      exdates = typeof template.exdates === 'string' ? JSON.parse(template.exdates) : template.exdates;
    } catch (e) { exdates = []; }
  }
  if (Array.isArray(exdates) && exdates.includes(dateStr)) return false;

  // 检查repeat_end
  if (template.repeat_end && dateStr > template.repeat_end) return false;

  // 使用ICAL.js计算
  try {
    const vcalendar = createICALComponent(template);
    const vevent = vcalendar.getFirstSubcomponent('vevent');
    const event = new ICAL.Event(vevent);
    const targetTime = dateStrToICALTime(dateStr);
    const targetMs = targetTime.toUnixTime() * 1000;

    // 使用迭代器检查目标日期是否为发生日期
    const iterator = event.iterator();
    let next;
    // 最多迭代1000次防止无限循环
    let count = 0;
    while ((next = iterator.next()) && count < 1000) {
      const nextStr = icalTimeToDateStr(next);
      if (nextStr === dateStr) return true;
      if (nextStr > dateStr) return false;
      count++;
    }
    return false;
  } catch (e) {
    // 降级: 使用简单规则判断
    return simpleIsOccurrence(template, dateStr);
  }
}

/**
 * 简单规则判断（降级方案）
 */
function simpleIsOccurrence(template, dateStr) {
  const anchor = template.anchor_date;
  if (dateStr < anchor) return false;
  if (template.repeat_end && dateStr > template.repeat_end) return false;

  const [ay, am, ad] = anchor.split('-').map(Number);
  const [dy, dm, dd] = dateStr.split('-').map(Number);

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
 * @param {Object} template - 模板对象
 * @param {string} startDate - 起始日期
 * @param {string} endDate - 结束日期
 * @param {number} [limit=365] - 最大返回数量
 * @returns {string[]} 日期字符串数组
 */
export function getOccurrencesBetween(template, startDate, endDate, limit = 365) {
  if (!template.repeat_type || template.repeat_type === 'none') return [];

  try {
    const vcalendar = createICALComponent(template);
    const vevent = vcalendar.getFirstSubcomponent('vevent');
    const event = new ICAL.Event(vevent);
    const iterator = event.iterator();

    const results = [];
    let next;
    let count = 0;
    while ((next = iterator.next()) && count < limit) {
      const nextStr = icalTimeToDateStr(next);
      if (nextStr > endDate) break;
      if (nextStr >= startDate) {
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
 * 删除循环事件实例
 * @param {Object} params
 * @param {Object} params.task - 当前任务实例
 * @param {string} params.date - 当前日期
 * @param {string} params.scope - 操作范围: "this" | "thisAndFuture" | "all"
 * @param {Function} params.db - D1数据库操作辅助函数
 * @returns {Object} 数据库操作语句数组
 */
export function computeDeleteActions({ task, date, scope }) {
  const parentId = task.parentId || task.parent_id;
  const isSeries = task.isSeries || (parentId && parentId !== task.id);

  const actions = {
    deleteTodoIds: [],
    updateTodos: [],
    updateTemplate: null,
    deleteTemplate: false,
    insertTemplate: null,
  };

  if (!isSeries) {
    // 非循环任务: 直接删除
    actions.deleteTodoIds.push(task.id);
    return actions;
  }

  switch (scope) {
    case 'this': {
      // 仅删除此实例: 软删除当前实例 + 添加EXDATE到模板
      actions.deleteTodoIds.push(task.id);
      actions.updateTemplate = { type: 'add_exdate', date: date, parentId: parentId };
      break;
    }

    case 'thisAndFuture': {
      // 删除此实例及以后: 软删除当前及以后的实例 + 设置模板repeat_end为当前日期前一天
      actions.deleteTodoIds.push(task.id);
      actions.updateTemplate = { type: 'set_repeat_end', date: date, parentId: parentId, alsoDeleteFuture: true };
      break;
    }

    case 'all': {
      // 删除所有实例: 软删除所有实例 + 删除模板
      actions.deleteTemplate = true;
      actions.updateTemplate = { type: 'delete_all', parentId: parentId };
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
 * @param {Object} params.newValues - 新值
 * @returns {Object} 操作描述
 */
export function computeUpdateActions({ task, date, scope, newValues }) {
  const parentId = task.parentId || task.parent_id;
  const isSeries = task.isSeries || (parentId && parentId !== task.id);
  const rptType = newValues.repeat_type || task.repeat_type || 'none';
  const isRecurring = rptType !== 'none';

  const actions = {
    currentTodo: null,
    futureTodos: null,
    pastTodos: null,
    template: null,
    deleteTemplate: false,
    insertTemplate: null,
  };

  if (!isSeries) {
    // 非循环任务: 直接更新
    actions.currentTodo = { ...newValues, isRecurring: false };
    return actions;
  }

  switch (scope) {
    case 'this': {
      // 仅修改此实例: 脱离模板，变为单次任务 + 添加EXDATE到模板
      actions.currentTodo = {
        ...newValues,
        repeat_type: 'none',
        isRecurring: false,
        detachFromSeries: true,
      };
      actions.template = { type: 'add_exdate', date: date, parentId: parentId };
      break;
    }

    case 'thisAndFuture': {
      // 修改此实例及以后: 更新模板的anchor_date和属性
      // 过去的实例保持不变，但设置repeat_end
      if (isRecurring) {
        actions.currentTodo = { ...newValues, isRecurring: true };
        actions.pastTodos = { type: 'set_repeat_end', date: date, parentId: parentId };
        actions.template = { type: 'update_from_date', date: date, parentId: parentId, newValues: newValues };
      } else {
        // 改为不重复: 当前项变单次，未来项删除
        actions.currentTodo = { ...newValues, repeat_type: 'none', isRecurring: false };
        actions.pastTodos = { type: 'set_repeat_end', date: date, parentId: parentId };
        actions.template = { type: 'delete', parentId: parentId };
      }
      break;
    }

    case 'all': {
      // 修改所有实例: 更新模板
      if (isRecurring) {
        actions.currentTodo = { ...newValues, isRecurring: true };
        actions.template = { type: 'update_all', parentId: parentId, newValues: newValues };
      } else {
        actions.currentTodo = { ...newValues, repeat_type: 'none', isRecurring: false };
        actions.template = { type: 'delete', parentId: parentId };
      }
      break;
    }

    default:
      actions.currentTodo = { ...newValues };
  }

  return actions;
}

// ==================== EXDATE 管理 ====================

/**
 * 向模板添加EXDATE
 * @param {string} currentExdates - 当前EXDATE JSON字符串
 * @param {string} dateStr - 要排除的日期
 * @returns {string} 新的EXDATE JSON字符串
 */
export function addExdate(currentExdates, dateStr) {
  let exdates = [];
  try {
    exdates = typeof currentExdates === 'string' ? JSON.parse(currentExdates || '[]') : (Array.isArray(currentExdates) ? currentExdates : []);
  } catch (e) { exdates = []; }
  if (!exdates.includes(dateStr)) {
    exdates.push(dateStr);
  }
  return JSON.stringify(exdates);
}

/**
 * 从模板移除EXDATE
 * @param {string} currentExdates - 当前EXDATE JSON字符串
 * @param {string} dateStr - 要恢复的日期
 * @returns {string} 新的EXDATE JSON字符串
 */
export function removeExdate(currentExdates, dateStr) {
  let exdates = [];
  try {
    exdates = typeof currentExdates === 'string' ? JSON.parse(currentExdates || '[]') : (Array.isArray(currentExdates) ? currentExdates : []);
  } catch (e) { exdates = []; }
  exdates = exdates.filter(d => d !== dateStr);
  return JSON.stringify(exdates);
}

// ==================== 日期工具 ====================

/**
 * 获取某日期的前一天
 */
export function getPreviousDate(dateStr) {
  const parts = dateStr.split('-');
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
export function getNextDate(dateStr) {
  const parts = dateStr.split('-');
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
export function getDayOfWeek(dateStr) {
  const parts = dateStr.split('-');
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
export function offsetDate(dateStr, days) {
  const parts = dateStr.split('-');
  const d = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateStr(d);
}

// ==================== 重复类型标签 ====================

/**
 * 获取重复类型的中文标签 (对齐Google Calendar)
 */
export function getRepeatLabel(repeatType, dateStr, repeatEnd) {
  const labels = {
    none: '不重复',
    daily: '每天',
    weekly: '',
    monthly: '',
    yearly: '',
  };

  if (repeatType === 'weekly' && dateStr) {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const dayOfWeek = getDayOfWeek(dateStr);
    return `每周${days[dayOfWeek]}`;
  }

  if (repeatType === 'monthly' && dateStr) {
    const day = parseInt(dateStr.split('-')[2], 10);
    return `每月${day}号`;
  }

  if (repeatType === 'yearly' && dateStr) {
    const parts = dateStr.split('-');
    return `每年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
  }

  let label = labels[repeatType] || '不重复';
  if (repeatEnd && repeatType !== 'none') {
    label += `·至${repeatEnd}`;
  }
  return label;
}

/**
 * 获取scope的中文标签 (对齐Google Calendar)
 */
export function getScopeLabels(action) {
  if (action === 'delete') {
    return {
      this: '删除此事件',
      thisAndFuture: '删除此事件及之后的事件',
      all: '删除整个系列',
    };
  }
  return {
    this: '仅此事件',
    thisAndFuture: '此事件及之后的事件',
    all: '整个系列的所有事件',
  };
}
