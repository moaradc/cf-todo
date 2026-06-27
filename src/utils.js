/*
 * Cloudflare Worker + D1 Todo App - Utility Functions & Constants
 */

import versionData from '../version.json';

const APP_VERSION = versionData.version;
const DB_SCHEMA = versionData.db_schema;
const DEFAULT_CATEGORY_COLOR = '#888888';

// ============================================================
// 登录 & 显示 & 字体 限制：最多支持的浏览器 UA 数量
// 登录会话、显示缩放 (scaleByBrowser)、字体大小 (fontSizeByBrowser)、
// 显示大小 (displayScaleByBrowser) 共用此上限。
// 修改这一处即可统一调整所有限制。
// ============================================================
const MAX_BROWSER_UA = 10;

const CHANGELOG = versionData.changelog;

function parseCookies(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const list = {};
  cookieHeader.split(';').forEach(function(cookie) {
    let[name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    if (!value) return;
    try { list[name] = decodeURIComponent(value); } catch(e) { list[name] = value; }
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

function generateSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, c =>
    c === '+' ? '-' : c === '/' ? '_' : ''
  );
}

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

// 健壮性：统一带超时的 fetch，超时或异常返回 null，调用方降级处理
// CF Workers subrequest fetch 90s 硬超时，这里主动 5s 超时避免长时间挂起
const HOT_SEARCH_FETCH_TIMEOUT_MS = 5000;

async function fetchJsonWithTimeout(url) {
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), HOT_SEARCH_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      // 释放响应体避免连接泄漏
      try { res.body && res.body.cancel(); } catch (e) {}
      return null;
    }
    return await res.json();
  } catch (e) {
    // AbortError 或网络错误，返回 null 让调用方降级
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
    // 随机打散顺序，避免单点故障：第一个挂了快速切下一个
    providers.sort(() => Math.random() - 0.5);
  }

  let allWords = [];
  for (const fetcher of providers) {
    // fetcher 内部已 try/catch（fetchJsonWithTimeout 返回 null），不会抛出
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
  apiError
};
