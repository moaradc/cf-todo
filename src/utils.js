// Cloudflare Worker + D1 Todo App - Utility Functions & Constants

import versionData from '../version.json';

const APP_VERSION = versionData.version;
const DB_SCHEMA = versionData.db_schema;
const DEFAULT_CATEGORY_COLOR = '#888888';

// 登录会话、显示缩放、字体大小、显示大小共用此上限
const MAX_BROWSER_UA = 10;

const CHANGELOG = versionData.changelog;

function parseCookies(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const list = {};
  cookieHeader.split(';').forEach(function(cookie) {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    if (!value) return;
    try { list[name] = decodeURIComponent(value); } catch (e) { list[name] = value; }
  });
  return list;
}

async function sign(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verify(data, signature, secret) {
  const expected = await sign(data, secret);
  return expected === signature;
}

function generateSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, c =>
    c === '+' ? '-' : c === '/' ? '_' : ''
  );
}

// 恒定时间字符串比较，防时序攻击（API Key 校验）
async function secureCompare(a, b, secret) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length === 0 || b.length === 0) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign("HMAC", key, encoder.encode(a)),
    crypto.subtle.sign("HMAC", key, encoder.encode(b))
  ]);
  if (sigA.byteLength !== sigB.byteLength) return false;
  const arrA = new Uint8Array(sigA);
  const arrB = new Uint8Array(sigB);
  let result = 0;
  for (let i = 0; i < arrA.length; i++) {
    result |= arrA[i] ^ arrB[i];
  }
  return result === 0;
}

function getDayOfWeek(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length < 3) return 0;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.getDay();
}

function formatDateStr(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function offsetDate(dateStr, days) {
  const parts = dateStr.split('-');
  const d = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateStr(d);
}

// CF Workers subrequest 90s 硬超时，这里 5s 主动超时降级
const HOT_SEARCH_FETCH_TIMEOUT_MS = 5000;

async function fetchJsonWithTimeout(url) {
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), HOT_SEARCH_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      try { res.body && res.body.cancel(); } catch (e) {}
      return null;
    }
    return await res.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchHotSearchData(providerName = 'auto') {
  const fetchers = {
    'bilibili': async () => {
      const json = await fetchJsonWithTimeout('https://uapis.cn/api/v1/misc/hotboard?type=bilibili');
      return json?.list?.map(i => i?.title).filter(Boolean) || [];
    },
    'weibo': async () => {
      const json = await fetchJsonWithTimeout('https://uapis.cn/api/v1/misc/hotboard?type=weibo');
      return json?.list?.map(i => i?.title).filter(Boolean) || [];
    },
    'zhihu': async () => {
      const json = await fetchJsonWithTimeout('https://uapis.cn/api/v1/misc/hotboard?type=zhihu');
      return json?.list?.map(i => i?.title).filter(Boolean) || [];
    },
    'baidu': async () => {
      const json = await fetchJsonWithTimeout('https://top.baidu.com/api/board?platform=pc&tab=realtime');
      return json?.data?.cards?.[0]?.content?.map(i => i?.word).filter(Boolean) || [];
    }
  };

  let providers = [];
  if (providerName && fetchers[providerName]) {
    providers = [fetchers[providerName]];
  } else {
    providers = Object.values(fetchers);
    providers.sort(() => Math.random() - 0.5);
  }

  let allWords = [];
  for (const fetcher of providers) {
    const words = await fetcher();
    if (words.length >= 10) {
      allWords = words;
      break;
    }
  }
  return allWords;
}

function apiError(msg, status = 500, extra = null) {
  const body = extra ? { error: msg, ...extra } : { error: msg };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/** 解析 subtasks/search_terms JSON 字段（数组原样返回、字符串 parse、其他返回空数组） */
function parseJsonField(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val) {
    try { return JSON.parse(val); } catch (e) {}
  }
  return [];
}

/**
 * 规范化优先级：'medium' → 'med'，非法值 → 'low'。
 * 所有 priority 写入点应统一调用，避免 DB 出现非标准值导致 stats 聚合漏统计。
 */
function normalizePriority(val) {
  if (val === 'medium') return 'med';
  if (val === 'low' || val === 'med' || val === 'high') return val;
  return 'low';
}

/**
 * 校验 stats 日期范围（V0/V1 共用）。
 * Free 计划 D1 10ms CPU 限制，大范围 GROUP BY 会超时；
 * 366 天上限覆盖年度报告场景。
 */
function validateStatsDateRange(start, end) {
  if (!start || !end) {
    return { ok: false, error: 'start 和 end 为必填参数 (YYYY-MM-DD)' };
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(start) || !dateRe.test(end)) {
    return { ok: false, error: 'start 和 end 格式应为 YYYY-MM-DD' };
  }
  const sParts = start.split('-').map(Number);
  const eParts = end.split('-').map(Number);
  const sDate = Date.UTC(sParts[0], sParts[1] - 1, sParts[2]);
  const eDate = Date.UTC(eParts[0], eParts[1] - 1, eParts[2]);
  if (isNaN(sDate) || isNaN(eDate)) {
    return { ok: false, error: 'start 或 end 不是有效日期' };
  }
  if (sDate > eDate) {
    return { ok: false, error: 'start 不能晚于 end' };
  }
  const MAX_STATS_RANGE_DAYS = 366;
  const diffDays = (eDate - sDate) / 86400000 + 1;
  if (diffDays > MAX_STATS_RANGE_DAYS) {
    return { ok: false, error: `日期范围不能超过 ${MAX_STATS_RANGE_DAYS} 天（当前 ${diffDays} 天）` };
  }
  return { ok: true };
}

export {
  APP_VERSION,
  DB_SCHEMA,
  CHANGELOG,
  DEFAULT_CATEGORY_COLOR,
  MAX_BROWSER_UA,
  parseCookies,
  sign,
  verify,
  generateSessionToken,
  secureCompare,
  getDayOfWeek,
  formatDateStr,
  offsetDate,
  fetchHotSearchData,
  apiError,
  normalizePriority,
  parseJsonField,
  validateStatsDateRange
};
