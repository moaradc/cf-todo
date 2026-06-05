/*
 * Cloudflare Worker + D1 Todo App - Utility Functions & Constants
 */

import versionData from '../version.json';

const APP_VERSION = versionData.version;
const DEFAULT_CATEGORY_COLOR = '#888888';

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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function offsetDate(dateStr, days) {
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setDate(d.getDate() + days);
  return formatDateStr(d);
}

async function fetchHotSearchData(providerName = 'auto') {
  const fetchers = {
    'bilibili': async () => { 
      const res = await fetch('https://uapis.cn/api/v1/misc/hotboard?type=bilibili');
      const json = await res.json();
      return json?.list?.map(i => i?.title).filter(Boolean) ||[];
    },
    'weibo': async () => { 
      const res = await fetch('https://uapis.cn/api/v1/misc/hotboard?type=weibo');
      const json = await res.json();
      return json?.list?.map(i => i?.title).filter(Boolean) ||[];
    },
    'zhihu': async () => { 
      const res = await fetch('https://uapis.cn/api/v1/misc/hotboard?type=zhihu');
      const json = await res.json();
      return json?.list?.map(i => i?.title).filter(Boolean) ||[];
    },
    'baidu': async () => { 
      const res = await fetch('https://top.baidu.com/api/board?platform=pc&tab=realtime');
      const json = await res.json();
      return json?.data?.cards?.[0]?.content?.map(i => i?.word).filter(Boolean) ||[];
    }
  };

  let providers =[];
  if (providerName && fetchers[providerName]) {
    providers =[fetchers[providerName]];
  } else {
    providers = Object.values(fetchers);
    providers.sort(() => Math.random() - 0.5); 
  }
  
  let allWords =[];
  for (const fetcher of providers) {
    try {
      const words = await fetcher();
      if (words.length >= 10) {
        allWords = words;
        break; 
      }
    } catch(e) { console.error("Fetch API error:", e); }
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
  CHANGELOG,
  DEFAULT_CATEGORY_COLOR,
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
