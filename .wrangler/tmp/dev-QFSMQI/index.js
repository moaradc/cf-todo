var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// version.json
var version_default = {
  version: "2.7.4",
  db_schema: 3,
  changelog: [
    { version: "2.7.4", date: "2026-06-12", notes: "\u65B0\u589E RESTful API v1\uFF08/api/v1/\uFF09\uFF0C\u652F\u6301 API Key \u9274\u6743\uFF08X-API-Key / Bearer / Query\uFF09\u53CA Cookie \u9274\u6743\n\u65B0\u589E API Key \u7BA1\u7406\u529F\u80FD\uFF08\u521B\u5EFA/\u5220\u9664/\u542F\u7528/\u7981\u7528/\u91CD\u547D\u540D\uFF0C\u6700\u591A10\u4E2A\uFF0C\u6052\u5B9A\u65F6\u95F4\u6BD4\u8F83\u9632\u65F6\u5E8F\u653B\u51FB\uFF09\n\u65B0\u589E Todo CRUD\n\u8BBE\u7F6E\u9875\u9762\u65B0\u589E API \u5BC6\u94A5\u7BA1\u7406\u9762\u677F\n\u65B0\u589E API_Wiki.md\n\u65B0\u589E OpenClaw Skill" },
    { version: "2.7.3", date: "2025-06-07", notes: "\u8986\u76D6\u6A21\u5F0F\u5BFC\u5165\u540E\u5907\u4EFD\u4FDD\u755910\u5206\u949F\u4F9B\u624B\u52A8\u6062\u590D\uFF0C\u5230\u671F\u81EA\u52A8\u6E05\u9664\n\u79FB\u9664\u5BFC\u5165\u5B57\u6BB5\u6821\u9A8C\uFF08\u7531\u6570\u636E\u5E93\u7EA6\u675F\u515C\u5E95\uFF09\n\u5BFC\u5165\u4E2D\u65AD\u6062\u590D\u652F\u6301\u4FDD\u7559\u5907\u4EFD\uFF08keepBackup\uFF09\u6216\u4E22\u5F03\u5907\u4EFD\uFF08discard\uFF09\n\u4FEE\u590D\u4E2D\u65AD\u6062\u590D\u5F39\u7A97\u70B9\u53D6\u6D88\u65F6\u9519\u8BEF\u6062\u590D\u5907\u4EFD\u7684bug" },
    { version: "2.7.2", date: "2025-06-06", notes: "RFC 5545 \u5927\u578B\u91CD\u6784\nical.js \u66FF\u6362 rrule.js\uFF0C\u5B8C\u6574\u652F\u6301 RRULE/EXDATE/RDATE\n\u5FAA\u73AF\u4E8B\u4EF6\u64CD\u4F5C\u5BF9\u9F50 Google Calendar \u6807\u51C6\uFF1A\u4EC5\u6B64\u4E8B\u4EF6/\u6B64\u4E8B\u4EF6\u53CA\u4E4B\u540E/\u6574\u4E2A\u7CFB\u5217\n\u4FEE\u590D ical.js DTSTART \u4E0D\u5339\u914D RRULE \u65F6\u8DF3\u8FC7\u9996\u5B9E\u4F8B\u7684\u95EE\u9898\n\u7248\u672C\u5316\u589E\u91CF\u6570\u636E\u5E93\u8FC1\u79FB\uFF0C\u5F7B\u5E95\u79FB\u9664\u5197\u4F59 blacklist/repeat \u5217\n\u4FEE\u590D repeat=-1 \u4F46 repeat_type=none \u7684\u810F\u6570\u636E" },
    { version: "2.7.1", date: "2025-06-05", notes: '\u96C6\u6210rrule.js\u66FF\u6362SQL\u5339\u914D\n\u4EC5\u6B64\u9879\uFF1A\n\u7F16\u8F91\u91CD\u590D\u4EFB\u52A1\u8131\u79BB\u6A21\u677F\u53D8\u4E3A\u5355\u6B21\u4EFB\u52A1\n\u6B64\u9879\u53CA\u4EE5\u540E/\u4EE5\u540E/\u6240\u6709\uFF1A\n\u7F16\u8F91/\u5220\u9664\u91CD\u590D\u4EFB\u52A1\u5FFD\u7565\u65F6\u95F4\u4FEE\u6539\uFF0C\u8FC7\u53BB\u9879\u663E\u793A"\u6BCF\u5929\xB7\u81F3\u65E5\u671F"\n\u7F16\u8F91\u4E3A\u4E0D\u91CD\u590D\u65F6\u5F53\u524D\u9879\u53D8\u5355\u6B21\u4EFB\u52A1\uFF0C\u672A\u6765\u9879\u771F\u5220\u9664\n\u6062\u590D\u56DE\u6536\u7AD9\u4E2D\u7684\u91CD\u590D\u4E8B\u9879\u65F6\u91CD\u65B0\u6FC0\u6D3B\u91CD\u590D\u5E76\u91CD\u5EFA\u6A21\u677F\n\u65E5\u671F\u65F6\u533A\u7EDF\u4E00UTC\n\u4FEE\u590D\u6761\u4EF6\u5206\u652F\u987A\u5E8F\u548CisSeries\u8BA1\u7B97\u7B49\u903B\u8F91\u95EE\u9898' },
    { version: "2.7.0", date: "2025-06-05", notes: "\u9879\u76EE\u62C6\u5206\n\u4F18\u5316\u66F4\u65B0\u68C0\u67E5\u673A\u5236\n\u65B0\u589E\u66F4\u65B0\u65E5\u5FD7\u529F\u80FD\n\u5355\u6587\u4EF6\u7248\u672C\u5C06\u4FDD\u7559\u5728Releases\uFF0C\u4F46\u4E0D\u518D\u66F4\u65B0" },
    { version: "2.6.9.3", date: "2025-06.01", notes: "\u65B0\u589E\u53EF\u9009\u5FAA\u73AF\u622A\u6B62\u65F6\u95F4\u548C\u53EF\u9009\u7ED3\u675F\u65F6\u95F4\n\u4FEE\u6539\u90E8\u5206UI\u6392\u7248" },
    { version: "2.6.9.2", date: "2025-05-30", notes: "\u4F18\u5316\u5BFC\u5165/\u5BFC\u51FA\u903B\u8F91" },
    { version: "2.6.9", date: "2025-05-23", notes: "\u6DFB\u52A0\u5206\u7C7B\u529F\u80FD\n\u51FA\u4E8E\u6027\u80FD\u8003\u8651\uFF0C\u5BFC\u51FA\u65F6\u79FB\u9664\u4E86\u7CBE\u786E\u7684\u6570\u91CF\u663E\u793A" },
    { version: "2.6.8.2", date: "2025-05-16", notes: "\u4FEE\u590D\u4E86\u8FDB\u5165\u9884\u89C8\u6A21\u5F0F\u65F6\u56E0\u9875\u9762\u91CD\u5B9A\u5411\u5F15\u53D1\u5E76\u53D1\u8BF7\u6C42\uFF0C\u5BFC\u81F4\u5F53\u5929\u5F85\u529E\u4E8B\u9879\u53EF\u80FD\u88AB\u91CD\u590D\u751F\u6210\u7684\u95EE\u9898\n\u79FB\u9664\u865A\u62DF\u6EDA\u52A8\u673A\u5236\n\u4F18\u5316\u5BFC\u5165/\u5BFC\u51FA\u903B\u8F91" },
    { version: "2.6.8", date: "2025-05-08", notes: "\u4FEE\u590D\u5DF2\u77E5\u95EE\u9898\n\u5C06\u524D\u7AEF\u5B9A\u5236\u6CE8\u5165\u4ECE\u73AF\u5883\u53D8\u91CF\u6539\u4E3AD1\u6570\u636E\u5E93" },
    { version: "2.6.7.1", date: "2025-05-02", notes: "\u589E\u52A0\u68C0\u67E5\u66F4\u65B0\u529F\u80FD\n\u4FEE\u590D\u65B0\u589E\u91CD\u590D\u4E8B\u9879\u65F6\u8FC7\u5F80\u65E5\u671F\u4E5F\u751F\u6210\u7684\u95EE\u9898" }
  ]
};

// src/utils.js
var APP_VERSION = version_default.version;
var DB_SCHEMA = version_default.db_schema;
var DEFAULT_CATEGORY_COLOR = "#888888";
var CHANGELOG = version_default.changelog;
function parseCookies(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const list = {};
  cookieHeader.split(";").forEach(function(cookie) {
    let [name, ...rest] = cookie.split("=");
    name = name?.trim();
    if (!name) return;
    const value = rest.join("=").trim();
    if (!value) return;
    try {
      list[name] = decodeURIComponent(value);
    } catch (e) {
      list[name] = value;
    }
  });
  return list;
}
__name(parseCookies, "parseCookies");
async function sign(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
__name(sign, "sign");
async function verify(data, signature, secret) {
  const expected = await sign(data, secret);
  return expected === signature;
}
__name(verify, "verify");
function generateSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(
    /[+/=]/g,
    (c) => c === "+" ? "-" : c === "/" ? "_" : ""
  );
}
__name(generateSessionToken, "generateSessionToken");
async function secureCompare(a, b, secret) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length === 0) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
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
__name(secureCompare, "secureCompare");
function getDayOfWeek(dateStr) {
  const parts = dateStr.split("-");
  if (parts.length < 3) return 0;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.getDay();
}
__name(getDayOfWeek, "getDayOfWeek");
async function fetchHotSearchData(providerName = "auto") {
  const fetchers = {
    "bilibili": /* @__PURE__ */ __name(async () => {
      const res = await fetch("https://uapis.cn/api/v1/misc/hotboard?type=bilibili");
      const json = await res.json();
      return json?.list?.map((i) => i?.title).filter(Boolean) || [];
    }, "bilibili"),
    "weibo": /* @__PURE__ */ __name(async () => {
      const res = await fetch("https://uapis.cn/api/v1/misc/hotboard?type=weibo");
      const json = await res.json();
      return json?.list?.map((i) => i?.title).filter(Boolean) || [];
    }, "weibo"),
    "zhihu": /* @__PURE__ */ __name(async () => {
      const res = await fetch("https://uapis.cn/api/v1/misc/hotboard?type=zhihu");
      const json = await res.json();
      return json?.list?.map((i) => i?.title).filter(Boolean) || [];
    }, "zhihu"),
    "baidu": /* @__PURE__ */ __name(async () => {
      const res = await fetch("https://top.baidu.com/api/board?platform=pc&tab=realtime");
      const json = await res.json();
      return json?.data?.cards?.[0]?.content?.map((i) => i?.word).filter(Boolean) || [];
    }, "baidu")
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
    try {
      const words = await fetcher();
      if (words.length >= 10) {
        allWords = words;
        break;
      }
    } catch (e) {
      console.error("Fetch API error:", e);
    }
  }
  return allWords;
}
__name(fetchHotSearchData, "fetchHotSearchData");
function apiError(msg, status = 500, extra = null) {
  const body = extra ? { error: msg, ...extra } : { error: msg };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(apiError, "apiError");

// src/html/css.js
var css = `
    /* =========================================
       DEFAULT THEME: DARK BRUTALISM
       ========================================= */
    :root {
      --bg: #0a0a0a;
      --fg: #b0b0b0;
      --accent: #ff3300; 
      --crt: #00ff41;    
      --warn: #ffcc00;   
      --panel: #141414;
      --font-main: 'Courier New', Courier, monospace;
      --app-scale: 1;
      --cat-color-default: #888888;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; scrollbar-width: none; -ms-overflow-style: none; }
    *::-webkit-scrollbar { display: none; }
    
    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--font-main);
      overflow-x: hidden;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-bottom: 120px;
      zoom: var(--app-scale);
    }

    .scanlines {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(to bottom, rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%);
      background-size: 100% 2px;
      pointer-events: none;
      z-index: 100;
    }

    .container { width: 100%; max-width: calc(600px / var(--app-scale)); padding: 15px; position: relative; z-index: 1; }

    .top-actions { position: absolute; top: 15px; right: 15px; display: flex; gap: 8px; z-index: 10; }
    .top-actions-left { position: absolute; top: 15px; left: 15px; display: flex; gap: 8px; z-index: 10; }
    
    .theme-toggle-btn {
      background: #222; color: var(--fg);
      border: 1px solid #333; padding: 4px 8px;
      font-size: 0.75rem; cursor: pointer;
      font-family: var(--font-main);
      transition: 0.2s;
    }
    .theme-toggle-btn:hover { background: var(--fg); color: #000; }

    h1 {
      font-size: 1.5rem; text-transform: uppercase; border-bottom: 2px dashed var(--fg);
      padding-bottom: 10px; margin-bottom: 20px; text-align: center; letter-spacing: 1px;
    }
    h1 span { color: var(--accent); font-weight: bold; }

    button {
      background: #222; color: var(--fg); border: 1px solid var(--fg);
      padding: 8px 12px; font-family: var(--font-main); cursor: pointer;
      text-transform: uppercase; font-size: 0.85rem; transition: 0.2s;
    }
    button:active { background: var(--accent); color: #000; border-color: var(--accent); }
    
    .btn-primary { background: var(--accent); color: #000; border: none; font-weight: bold; }
    .btn-danger { color: var(--accent); border-color: var(--accent); }
    .btn-danger:hover { background: var(--accent); color: #000; }
    .btn-ghost { background: transparent; border: none; color: #666; }
    .btn-ghost:hover { color: var(--fg); }

    input, textarea, select {
      width: 100%; background: #000; border: 1px solid #444; color: var(--crt);
      padding: 8px 10px; font-family: var(--font-main); font-size: 1rem; outline: none; margin-bottom: 10px;
    }
    textarea { resize: vertical; scrollbar-width: thin; }
    textarea::-webkit-scrollbar { display: initial; }
    input:focus, textarea:focus, select:focus { border-color: var(--crt); box-shadow: 0 0 5px rgba(0,255,65,0.3); }
    
    .fake-input {
      width: 100%; background: #000; border: 1px solid #444; color: var(--fg);
      padding: 8px 10px; font-family: var(--font-main); font-size: 1rem; margin-bottom: 10px;
      cursor: pointer; display: flex; justify-content: space-between; align-items: center;
    }
    .fake-input:active { border-color: var(--accent); }
    .fake-input span { pointer-events: none; }
    #add-category-display, #edit-category-display { min-width: 0; word-break: break-all; }

    .date-bar {
      display: flex; justify-content: space-between; align-items: center;
      background: #000; border: 1px solid var(--fg); padding: 8px; margin-bottom: 10px;
    }
    .date-display { text-align: center; cursor: pointer; }
    .date-display .main { font-size: 1.2rem; font-weight: bold; color: var(--crt); }
    .date-display .sub { font-size: 0.8rem; color: #aaa; display: block; }

    .toolbar { display: flex; align-items: center; gap: 6px; margin-bottom: 15px; }
    .toolbar button { 
      flex: none; font-size: 0.7rem; padding: 6px 8px; text-align: center; 
      border-color: #444; color: #888; white-space: nowrap;
    }
    .toolbar button.active { border-color: var(--crt); color: var(--crt); }
    .view-tags { flex: 1; display: flex; align-items: center; gap: 4px; overflow: hidden; cursor: pointer; min-width: 0; }
    .view-tag { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .toolbar .view-tag-shrink { flex-shrink: 1; min-width: 0; }

    .todo-item {
      display: flex; align-items: center; background: var(--panel);
      border-left: 4px solid #333; margin-bottom: 10px; padding: 15px;
      cursor: pointer; transition: 0.2s; position: relative;
    }
    .todo-item:active { transform: scale(0.98); }
    
    .checkbox { width: 20px; height: 20px; border: 2px solid var(--fg); margin-right: 15px; flex-shrink: 0; transition: 0.2s; }
    .todo-item.pri-high .checkbox { border-color: var(--accent); }
    .todo-item.pri-med .checkbox { border-color: var(--warn); }
    
    .todo-item.done { border-left-color: #444; opacity: 0.45; filter: grayscale(80%); }
    .todo-item.done .item-title { text-decoration: line-through; color: #777; }
    .todo-item.done .checkbox { background: #222; border-color: #555; position: relative; }
    .todo-item.done .checkbox::after { content: '\u2713'; color: #666; position: absolute; left: 2px; top: -2px; font-size: 16px; font-weight: bold; }

    .todo-item .checkbox.batch-selected { background: var(--accent) !important; border-color: var(--accent) !important; position: relative; filter: none !important; opacity: 1 !important; }
    .todo-item .checkbox.batch-selected::after { content: '\u2713' !important; color: #000 !important; font-size: 16px; font-weight: bold; position: absolute; top: -2px; left: 2px; }

    .item-meta { display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; }
    .item-title { font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.2s; }
    .item-info { font-size: 0.75rem; color: #666; margin-top: 4px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    
    .badge { padding: 1px 4px; border-radius: 2px; font-size: 0.7rem; color: #000; font-weight: bold; }
    .badge-high { background: var(--accent); }
    .badge-med { background: var(--warn); }
    .badge-low { background: #888; }
    .badge-time { background: #333; color: var(--crt); border: 1px solid #444; }
    .badge-overdue { background: #8B0000; color: #FF6B6B; border: 1px solid #FF6B6B; }
    .badge-warning { background: #4A3000; color: #FFD93D; border: 1px solid #FFD93D; }
    .badge-category { display: inline-flex; align-items: center; padding: 6px 12px; color: var(--fg); font-size: 0.85rem; border: 1px solid #333; background: transparent; gap: 6px; max-width: 100%; }
    .badge-category-icon { width: 8px; height: 8px; border-radius: 2px; background: var(--cat-color-default); display: inline-block; flex-shrink: 0; }
    .badge-category .cat-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .category-new-input { width: 100%; background: #000; border: 1px solid var(--crt); color: var(--crt); padding: 8px; font-family: var(--font-main); font-size: 0.85rem; outline: none; margin: 4px 0; }
    .category-new-input:focus { box-shadow: 0 0 5px rgba(0,255,65,0.3); }
    .category-modal-list { max-height: 50vh; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start; }
    .category-modal-body { overflow: hidden; margin: 0 -20px; padding: 0 20px; transition: height 0.3s ease; }
    .category-modal-item { display: inline-flex; align-items: center; padding: 6px 12px; cursor: pointer; color: var(--fg); font-size: 0.85rem; border: 1px solid #333; background: transparent; transition: background 0.15s, border-color 0.15s; gap: 6px; max-width: 100%; }
    .category-modal-item:hover { background: var(--accent); color: #000; border-color: var(--accent); }
    .category-modal-item.selected { background: var(--crt); color: #000; font-weight: bold; border-color: var(--crt); }
    .category-modal-item .badge-category-icon { flex-shrink: 0; }
    .category-modal-item .cat-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cat-highlight { color: var(--accent); font-weight: bold; }
    .category-modal-divider { border-top: 1px solid #333; margin: 10px 0; padding-top: 10px; }
    .category-color-presets { display: flex; flex-wrap: wrap; gap: 10px; padding: 8px 0; align-items: center; }
    .category-color-circle { width: 28px; height: 28px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: border-color 0.15s, transform 0.15s; flex-shrink: 0; }
    .category-color-circle:hover { transform: scale(1.15); }
    .category-color-circle.selected { border-color: var(--crt); box-shadow: 0 0 6px rgba(0,255,65,0.4); }
    .category-color-custom { width: 28px; height: 28px; border-radius: 50%; cursor: pointer; border: 2px dashed #555; display: flex; align-items: center; justify-content: center; transition: border-color 0.15s, transform 0.15s; flex-shrink: 0; position: relative; }
    .category-color-custom:hover { transform: scale(1.15); }
    .category-color-custom.selected { border-color: var(--crt); border-style: solid; box-shadow: 0 0 6px rgba(0,255,65,0.4); }
    .category-color-custom svg { pointer-events: none; }

    .btn-link {
      background: #222; border: 1px solid #444; color: var(--crt);
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      margin-left: 10px; font-size: 0.9rem; text-decoration: none; cursor: pointer; flex-shrink: 0;
    }
    .btn-link:hover { background: var(--crt); color: #000; }

    .fab {
      position: fixed; bottom: 30px; right: 30px; width: 60px; height: 60px;
      background: var(--accent); color: #000; font-size: 2.5rem;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #fff; box-shadow: 4px 4px 0 #000; z-index: 20; cursor: pointer;
    }

    .batch-bar {
      position: fixed; left: 50%;
      top: calc(100dvh - 20px - env(safe-area-inset-bottom, 0px));
      transform: translate(-50%, -100%);
      width: 92%; max-width: 600px;
      background: var(--panel); border: 2px solid var(--accent);
      padding: 10px; border-radius: 8px;
      display: flex; justify-content: space-between; gap: 8px;
      z-index: 30; animation: popupSlide 0.3s forwards;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
    }
    .batch-bar.closing { animation: popupSlideDown 0.3s forwards; }
    @keyframes popupSlide {
      from { transform: translate(-50%, 100%); opacity: 0; }
      to { transform: translate(-50%, -100%); opacity: 1; }
    }
    @keyframes popupSlideDown {
      from { transform: translate(-50%, -100%); opacity: 1; }
      to { transform: translate(-50%, 100%); opacity: 0; }
    }
    .batch-bar button { flex: 1; padding: 10px 2px; font-size: 0.75rem; letter-spacing: -0.5px; white-space: nowrap; }
    
    .modal-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.9); backdrop-filter: blur(4px);
      z-index: 40; display: none; justify-content: center; align-items: center;
    }
    .modal-overlay.active { display: flex; animation: fadeIn 0.2s; }
    .modal-content {
      width: 90%; max-width: 400px; max-height: 90vh; overflow-y: auto; background: #111; border: 1px solid var(--crt);
      padding: 20px; box-shadow: 0 0 30px rgba(0,255,65,0.1); position: relative;
    }

    #modal-time { z-index: 90; }

    .calendar-header { display: flex; justify-content: space-between; margin-bottom: 15px; color: var(--accent); font-weight: bold; align-items: center; }
    .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center; }
    .cal-day-name { color: #666; font-size: 0.8rem; margin-bottom: 5px; }
    .cal-date { padding: 10px 0; cursor: pointer; border: 1px solid transparent; color: var(--fg); }
    .cal-date:hover { border-color: var(--fg); }
    .cal-date.today { color: var(--accent); font-weight: bold; border: 1px dashed var(--accent); }
    .cal-date.selected { background: var(--crt); color: #000; font-weight: bold; box-shadow: 2px 2px 0 #000; }
    .cal-date.empty { pointer-events: none; }
    .cal-title-btn { cursor: pointer; border-bottom: 1px dashed var(--accent); padding: 0 2px; margin: 0 2px; transition: color 0.2s; }
    .cal-title-btn:hover { color: var(--crt); border-color: var(--crt); }

    .time-picker-container { display: flex; height: 200px; gap: 10px; margin-bottom: 15px; }
    .time-col { flex: 1; overflow-y: auto; border: 1px solid #333; display: flex; flex-direction: column; }
    .time-cell { padding: 8px; text-align: center; cursor: pointer; color: #666; font-size: 0.9rem; }
    .time-cell.active { background: var(--crt); color: #000; font-weight: bold; }
    .time-label { text-align: center; font-size: 0.8rem; color: var(--accent); margin-bottom: 5px; }

    .detail-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: #080808; z-index: 60; display: none; flex-direction: column;
      padding: 20px; overflow-y: auto;
    }
    .detail-overlay.active { display: flex; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    .detail-overlay.closing { animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

    .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid #333; padding-bottom: 10px; }
    .detail-label { color: #555; font-size: 0.8rem; margin-bottom: 5px; text-transform: uppercase; }
    .detail-value { 
      color: var(--fg); font-size: 1.1rem; margin-bottom: 20px; 
      border-left: 2px solid #333; padding-left: 10px; min-height: 28px; 
      display: flex; align-items: center; word-break: break-all;
    }
    .detail-value.editable { border-left: 2px solid var(--accent); background: #111; padding: 8px 10px; outline: none; }
    .fake-input.detail-value.editable { display: flex; justify-content: space-between; }
    .detail-value a { text-decoration: none; color: var(--crt); border-bottom: 1px dashed var(--crt); }

    .popover-menu {
      position: absolute; background: #000; border: 2px solid var(--accent);
      padding: 5px; z-index: 80; display: none; flex-direction: column; gap: 5px;
      box-shadow: 4px 4px 0 rgba(255, 62, 0, 0.5); width: max-content; min-width: auto; max-width: 280px; }
    .popover-menu button { text-align: left; border: none; background: transparent; color: var(--fg); padding: 10px; font-size: 0.9rem; letter-spacing: normal; white-space: nowrap; }
    .popover-menu button:hover { background: var(--accent); color: #000; }
    .popover-title { font-size: 0.7rem; color: #666; padding: 5px; border-bottom: 1px solid #333; margin-bottom: 2px; }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes slideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }

    .hidden { display: none !important; }
    .row { display: flex; gap: 10px; }
    .flex-1 { flex: 1; }
    .switch-label { display: flex; align-items: center; gap: 10px; color: var(--crt); cursor: pointer; margin-bottom: 15px; }
    .switch-box { width: 16px; height: 16px; border: 1px solid var(--crt); display: inline-block; position: relative; }
    .switch-box.checked::after { content: ''; position: absolute; top: 2px; left: 2px; right: 2px; bottom: 2px; background: var(--crt); }

    .modal-section { margin-top: 10px; }
    .modal-row { margin-bottom: 10px; }
    .modal-row .fake-input { margin-bottom: 0; }
    .modal-row .detail-value.editable { margin-bottom: 0; }
    .modal-subtask-row { margin-bottom: 10px; align-items: stretch; }
    .modal-subtask-row input { margin-bottom: 0; height: 42px; }
    .modal-subtask-row button { margin: 0; height: 42px; }
    .fake-input .arrow { font-size: 0.8rem; }
    .fake-input .arrow-r { font-size: 0.8rem; margin-right: 8px; }

    .subtask-view-item {
      display: flex; align-items: center; background: rgba(255,255,255,0.05);
      margin-bottom: 5px; padding: 10px; cursor: pointer; transition: 0.2s;
      border-left: 3px solid var(--fg); border-radius: 2px;
    }
    .subtask-view-item:active { transform: scale(0.98); }
    .subtask-view-item.done { opacity: 0.5; filter: grayscale(80%); border-left-color: #444; }
    .subtask-view-item.done .item-title { text-decoration: line-through; }
    .subtask-view-item .checkbox { width: 16px; height: 16px; margin-right: 12px; }
    .subtask-view-item.done .checkbox { background: #222; border-color: #555; position: relative; }
    .subtask-view-item.done .checkbox::after { content: '\u2713'; color: #666; position: absolute; left: 1px; top: -3px; font-size: 14px; font-weight: bold; }

    .subtask-edit-item {
      display: flex; align-items: center; gap: 10px; margin-bottom: 5px;
      background: var(--panel); padding: 8px; border: 1px solid #333; border-radius: 2px;
    }

    .search-card {
      background: var(--panel); border: 1px dashed var(--fg); padding: 12px;
      border-radius: 4px; display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; min-height: 50px;
    }
    .search-term-checkbox {
      width: 14px; height: 14px; border: 1px solid var(--fg); margin-right: 5px;
      cursor: pointer; position: relative; flex-shrink: 0;
    }
    .search-term-tag {
      background: #222; border: 1px solid #444; color: var(--crt);
      padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 5px;
      font-size: 0.85rem; transition: 0.2s; word-break: break-all;
    }
    .search-term-tag button {
      padding: 0; border: none; width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.9rem; color: var(--fg); background: transparent; flex-shrink: 0;
    }
    .search-term-tag button:hover { color: var(--accent); }
    .search-term-tag.done { opacity: 0.5; filter: grayscale(80%); border-color: #444; }
    .search-term-tag.done span { text-decoration: line-through; }
    .search-term-tag.done .search-term-checkbox { background: #222; border-color: #555; }
    .search-term-tag.done .search-term-checkbox::after { content: '\u2713'; position: absolute; left: 1px; top: -3px; font-size: 12px; color: #666; font-weight: bold; }

    .setting-item { display: flex; align-items: center; justify-content: space-between; background: var(--panel); padding: 10px; border: 1px solid #333; margin-bottom: 5px; border-radius: 4px; }
    .setting-item span { font-size: 0.9rem; color: var(--fg); }

    .settings-card { margin-bottom: 20px; background: var(--panel); padding: 15px; border: 1px dashed var(--fg); border-radius: 4px; }
    .settings-card.danger { border: 1px solid var(--accent); }
    .settings-text { font-size: 0.85rem; line-height: 1.6; color: #888; margin-bottom: 0; }
    .settings-text strong { color: var(--crt); }
    
    .md-code { background: #222; padding: 2px 4px; border-radius: 2px; color: var(--crt); font-family: var(--font-main); }
    .md-ul { padding-left: 20px; margin: 5px 0; }
    del { opacity: 0.6; }

    .stats-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
    .stats-row-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .chart-container { background: var(--panel); border: 1px dashed var(--fg); padding: 15px; border-radius: 4px; position: relative; }
    .chart-container-bar { height: 250px; }
    .chart-container-pie { height: 200px; display: flex; justify-content: center; align-items: center; }

    /* =========================================
       ISOLATED THEME: LIGHT CASSETTE FUTURISM
       ========================================= */[data-theme="light"] body { background-color: #F0EEE2; color: #1B1915; }[data-theme="light"] .scanlines { display: none !important; }[data-theme="light"] .theme-toggle-btn {
      background: #E5E5E5; color: #1B1915; border: 2px solid #1B1915;
      box-shadow: 2px 2px 0 #1B1915; font-weight: 900; border-radius: 4px;
    }[data-theme="light"] .theme-toggle-btn:hover { background: #1B1915; color: #F0EEE2; }[data-theme="light"] h1 { border-bottom: 4px solid #1B1915; color: #1B1915; }[data-theme="light"] h1 span {
      background: #1B1915; color: #E1AC07; padding: 0 8px;
      border-radius: 4px; border: 2px solid #1B1915; font-family: sans-serif;
    }[data-theme="light"] button {
      background: #F0F0F0; color: #1B1915; border: 2px solid #1B1915;
      box-shadow: 2px 2px 0 #1B1915; border-radius: 4px; font-weight: bold;
    }[data-theme="light"] button:active {
      transform: translate(2px, 2px); box-shadow: 0 0 0 #1B1915; background: #E5E5E5;
    }[data-theme="light"] .btn-primary { background: #CE2424; color: #FEFEFE; }[data-theme="light"] .btn-primary:active { background: #1B1915; color: #CE2424; }[data-theme="light"] .btn-danger { background: #FEFEFE; color: #CE2424; border: 2px solid #CE2424; box-shadow: 2px 2px 0 #CE2424; }[data-theme="light"] .btn-ghost { background: transparent; border: 2px dashed #E5E5E5; box-shadow: none; color: #1B1915; }[data-theme="light"] input,[data-theme="light"] textarea,[data-theme="light"] select,[data-theme="light"] .fake-input {
      background: #FEFEFE; color: #1B1915; border: 2px solid #1B1915;
      box-shadow: inset 2px 2px 0 #E5E5E5; border-radius: 4px;
    }[data-theme="light"] input:focus,[data-theme="light"] textarea:focus,[data-theme="light"] select:focus {
      border-color: #5C960B; box-shadow: inset 2px 2px 0 #E5E5E5, 0 0 0 3px rgba(92,150,11,0.3);
    }[data-theme="light"] .date-bar {
      background: #F0F0F0; border: 2px solid #1B1915;
      border-radius: 6px; box-shadow: 4px 4px 0 #1B1915; padding: 12px;
    }[data-theme="light"] .date-display .main {
      background: #1B1915; color: #5C960B; padding: 4px 12px;
      border-radius: 4px; border: 2px inset #E5E5E5; font-family: 'Courier New', monospace;
      text-shadow: 0 0 4px rgba(92,150,11,0.4); box-shadow: inset 0 0 10px #1B1915;
    }[data-theme="light"] .date-display .sub { color: #1B1915; font-weight: bold; margin-top: 5px; }[data-theme="light"] .toolbar button { background: #FEFEFE; color: #1B1915; border: 2px solid #1B1915; box-shadow: 2px 2px 0 #E5E5E5; }[data-theme="light"] .todo-item {
      background: #FEFEFE; border: 2px solid #1B1915;
      box-shadow: 4px 4px 0 #E5E5E5; border-left: 8px solid #1B1915; border-radius: 6px;
    }[data-theme="light"] .todo-item.done {
      background: #EAEAEA; border-color: #CCC; border-left-color: #AAA;
      box-shadow: 2px 2px 0 #CCC; opacity: 0.55; filter: grayscale(80%);
    }[data-theme="light"] .todo-item.done .item-title { color: #888; text-decoration: line-through 2px #AAA; }[data-theme="light"] .todo-item.done .checkbox { background: #DDD; border-color: #AAA; box-shadow: none; }[data-theme="light"] .todo-item.done .checkbox::after { color: #888; }[data-theme="light"] .checkbox {
      background: #FEFEFE; border: 2px solid #1B1915;
      box-shadow: inset 2px 2px 0 #E5E5E5; border-radius: 4px;
    }[data-theme="light"] .todo-item.pri-high .checkbox { border-color: #CE2424; }
    [data-theme="light"] .todo-item.pri-med .checkbox { border-color: #E1AC07; }[data-theme="light"] .todo-item .checkbox.batch-selected { background: #5C960B !important; border-color: #1B1915 !important; box-shadow: none !important; }[data-theme="light"] .todo-item .checkbox.batch-selected::after { color: #FEFEFE !important; }[data-theme="light"] .item-info { color: #1B1915; font-weight: bold; }[data-theme="light"] .badge-high { background: #CE2424; color: #FEFEFE; border: 1px solid #1B1915; }[data-theme="light"] .badge-med { background: #E1AC07; color: #1B1915; border: 1px solid #1B1915; }[data-theme="light"] .badge-low { background: #E5E5E5; color: #1B1915; border: 1px solid #1B1915; }[data-theme="light"] .badge-time { background: #1B1915; color: #5C960B; border: 1px solid #1B1915; }[data-theme="light"] .badge-overdue { background: #CE2424; color: #FEFEFE; border: 1px solid #1B1915; }[data-theme="light"] .badge-warning { background: #E1AC07; color: #1B1915; border: 1px solid #1B1915; }[data-theme="light"] .badge-category { color: #1B1915; border-color: #1B1915; }[data-theme="light"] .badge-category-icon { background: var(--cat-color-default); }[data-theme="light"] .category-new-input { background: #FEFEFE; border-color: #1B1915; color: #1B1915; }[data-theme="light"] .category-modal-item { color: #1B1915; border-color: #1B1915; }[data-theme="light"] .category-modal-item:hover { background: #1B1915; color: #FEFEFE; border-color: #1B1915; }[data-theme="light"] .category-modal-item.selected { background: #1B1915; color: #5C960B; border-color: #1B1915; }[data-theme="light"] .category-modal-divider { border-top-color: #1B1915; }[data-theme="light"] .category-color-circle.selected { border-color: #1B1915; box-shadow: 0 0 6px rgba(27,25,21,0.3); }[data-theme="light"] .category-color-custom { border-color: #888; }[data-theme="light"] .category-color-custom.selected { border-color: #1B1915; box-shadow: 0 0 6px rgba(27,25,21,0.3); }[data-theme="light"] .cat-highlight { color: #CE2424; }[data-theme="light"] #category-toggle-btn,[data-theme="light"] #category-toggle-btn-2 { border-color: #1B1915 !important; color: #1B1915 !important; }[data-theme="light"] .btn-link {
      background: #E5E5E5; color: #1B1915; border: 2px solid #1B1915;
      box-shadow: 2px 2px 0 #1B1915; border-radius: 4px;
    }[data-theme="light"] .btn-link:hover { background: #1B1915; color: #F0EEE2; }
    [data-theme="light"] .batch-bar {
      border: 3px solid #1B1915; box-shadow: 6px 6px 0 #1B1915; background: #F0F0F0; border-top: 3px solid #1B1915;
    }[data-theme="light"] .fab {
      background: #CE2424; color: #FEFEFE; border: 4px solid #1B1915;
      box-shadow: 4px 4px 0 #1B1915; border-radius: 50%;
    }[data-theme="light"] .modal-overlay { background: rgba(27, 25, 21, 0.85); }[data-theme="light"] .modal-content {
      background: #F0F0F0; border: 4px solid #1B1915;
      box-shadow: 8px 8px 0 #1B1915; border-radius: 8px;
    }[data-theme="light"] .modal-content h3 { color: #1B1915; border-bottom: 2px solid #1B1915; }[data-theme="light"] .detail-overlay { background: #F0EEE2; }[data-theme="light"] .detail-header { border-bottom: 2px solid #1B1915; }[data-theme="light"] .detail-header span { background: #1B1915; color: #FEFEFE; padding: 4px 8px; border-radius: 4px; }[data-theme="light"] .detail-label { color: #1B1915; font-weight: bold; }[data-theme="light"] .detail-value {
      border-left: 4px solid #1B1915; background: #FEFEFE; padding: 10px;
      border-radius: 0 4px 4px 0; color: #1B1915; box-shadow: 2px 2px 0 #E5E5E5;
    }[data-theme="light"] .detail-value.editable { border-left: 4px solid #CE2424; box-shadow: inset 2px 2px 0 #E5E5E5; }[data-theme="light"] .detail-value a { color: #CE2424; border-bottom-color: #CE2424; }[data-theme="light"] .popover-menu {
      background: #FEFEFE; border: 3px solid #1B1915;
      box-shadow: 6px 6px 0 #1B1915; border-radius: 4px;
    }[data-theme="light"] .popover-menu button { color: #1B1915; border-bottom: 2px solid #F0F0F0; border-radius: 0; box-shadow: none; }[data-theme="light"] .popover-menu button:hover { background: #1B1915; color: #FEFEFE; }[data-theme="light"] .popover-title { color: #1B1915; font-weight: bold; border-bottom: 2px solid #1B1915; }[data-theme="light"] .calendar-header { color: #1B1915; border-bottom: 2px solid #1B1915; padding-bottom: 10px; }[data-theme="light"] .cal-day-name { color: #1B1915; font-weight: bold; }[data-theme="light"] .cal-date { color: #1B1915; border: 2px solid transparent; border-radius: 4px; }[data-theme="light"] .cal-date:hover { border-color: #1B1915; background: #E5E5E5; }[data-theme="light"] .cal-date.today { border-color: #CE2424; color: #CE2424; }[data-theme="light"] .cal-date.selected { background: #1B1915; color: #5C960B; box-shadow: 2px 2px 0 #5C960B; }[data-theme="light"] .time-col { border: 2px solid #1B1915; background: #FEFEFE; border-radius: 4px; }[data-theme="light"] .time-cell { color: #1B1915; }[data-theme="light"] .time-cell.active { background: #1B1915; color: #5C960B; }[data-theme="light"] .time-label { color: #1B1915; font-weight: bold; }[data-theme="light"] .switch-label { color: #1B1915; font-weight: bold; }[data-theme="light"] .switch-box { border: 2px solid #1B1915; background: #FEFEFE; border-radius: 3px; }[data-theme="light"] .switch-box.checked::after { background: #CE2424; border-radius: 1px; }[data-theme="light"] .subtask-view-item {
      background: rgba(0,0,0,0.03); border-left: 4px solid #1B1915; box-shadow: 2px 2px 0 #E5E5E5;
    }[data-theme="light"] .subtask-view-item.done { border-left-color: #AAA; }[data-theme="light"] .subtask-view-item.done .checkbox { background: #DDD; border-color: #AAA; box-shadow: none; }[data-theme="light"] .subtask-view-item.done .checkbox::after { color: #888; }[data-theme="light"] .subtask-edit-item {
      background: #FEFEFE; border: 2px solid #1B1915; box-shadow: 2px 2px 0 #E5E5E5;
    }[data-theme="light"] .search-card {
      background: #F0F0F0; border: 2px dashed #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5;
    }[data-theme="light"] .search-term-tag {
      background: #FEFEFE; border: 2px solid #1B1915; color: #1B1915; box-shadow: 2px 2px 0 #E5E5E5;
    }[data-theme="light"] .search-term-tag button { color: #1B1915; }[data-theme="light"] .search-term-tag button:hover { color: #CE2424; }[data-theme="light"] .search-term-tag.done { border-color: #AAA; background: #EAEAEA; }[data-theme="light"] .search-term-tag.done .search-term-checkbox { background: #DDD; border-color: #AAA; box-shadow: none; }[data-theme="light"] .search-term-tag.done .search-term-checkbox::after { color: #888; }
    [data-theme="light"] .setting-item { background: #FEFEFE; border-color: #1B1915; box-shadow: 2px 2px 0 #E5E5E5; }
    [data-theme="light"] .setting-item span { color: #1B1915; font-weight: bold; }
    [data-theme="light"] .settings-card { background: #F0F0F0; border: 2px dashed #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5; }[data-theme="light"] .settings-card.danger { border: 2px solid #CE2424; box-shadow: 4px 4px 0 #CE2424; background: #FEFEFE; }
    [data-theme="light"] .settings-text { color: #1B1915; font-weight: bold; }
    [data-theme="light"] .settings-text strong,
    [data-theme="light"] .apikey-status { color: #5C960B; }
    [data-theme="light"] .md-code { background: #E5E5E5; color: #5C960B; border: 1px solid #1B1915; }
    [data-theme="light"] .chart-container { background: #F0F0F0; border: 2px dashed #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5; }
    
    /* === \u5E74\u5EA6\u62A5\u544A\u6837\u5F0F === */
    .stats-tabs { display: flex; gap: 0; border: 1px solid var(--fg); overflow: hidden; }
    .stats-tab {
      padding: 5px 14px; font-size: 0.8rem; border: none !important;
      background: transparent !important; color: var(--fg) !important; cursor: pointer;
      text-transform: uppercase; letter-spacing: 0.5px; box-shadow: none !important;
    }
    .stats-tab.active { background: var(--accent) !important; color: #000 !important; font-weight: bold; }

    .annual-year-title {
      text-align: center; margin-bottom: 25px; padding: 12px 0;
      border-bottom: 1px dashed #333;
    }
    .annual-year-title span {
      font-size: 1.2rem; font-weight: bold; color: var(--crt); letter-spacing: 4px;
    }

    .annual-hero {
      text-align: center; padding: 30px 15px; margin-bottom: 25px;
      border: 2px solid var(--accent); background: var(--panel); position: relative; overflow: hidden;
    }
    .annual-hero::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, var(--accent), var(--warn), var(--crt));
    }
    .annual-ending-title {
      font-size: 1.8rem; font-weight: bold; color: var(--accent);
      margin-bottom: 8px; letter-spacing: 3px; text-transform: uppercase;
    }
    .annual-ending-subtitle {
      font-size: 0.75rem; color: #666; margin-bottom: 15px; letter-spacing: 4px;
    }
    .annual-ending-desc {
      font-size: 0.9rem; color: var(--fg); line-height: 1.8;
      border-top: 1px dashed #444; padding-top: 15px; text-align: left;
    }

    .annual-stats-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 25px;
    }
    .annual-stat-card {
      background: var(--panel); border: 1px solid #333; padding: 14px 10px; text-align: center;
    }
    .annual-stat-value { font-size: 1.6rem; font-weight: bold; color: var(--crt); }
    .annual-stat-label { font-size: 0.7rem; color: #666; text-transform: uppercase; margin-top: 4px; letter-spacing: 1px; }

    .annual-section-title {
      font-size: 0.8rem; color: var(--accent); text-transform: uppercase;
      letter-spacing: 2px; margin-bottom: 12px; padding-bottom: 5px;
      border-bottom: 1px dashed #444;
    }

    .annual-month-chart { margin-bottom: 25px; }
    .annual-month-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
    .annual-month-label { font-size: 0.7rem; color: #999; width: 30px; text-align: right; flex-shrink: 0; }
    .annual-month-bar-bg {
      flex: 1; height: 18px; background: #111; position: relative; overflow: hidden; border: 1px solid #222;
    }
    .annual-month-bar-total { height: 100%; position: absolute; top: 0; left: 0; background: rgba(255,255,255,0.06); }
    .annual-month-bar-done { height: 100%; position: absolute; top: 0; left: 0; background: var(--crt); opacity: 0.65; }
    .annual-month-count { font-size: 0.7rem; color: #aaa; width: 30px; flex-shrink: 0; }

    .annual-narrative {
      background: var(--panel); border: 1px dashed var(--fg); padding: 20px;
      line-height: 1.9; color: var(--fg); font-size: 0.9rem; margin-bottom: 20px;
    }
    .annual-narrative strong { color: var(--crt); }
    .annual-narrative em { color: var(--accent); font-style: normal; }
    .annual-narrative .highlight { color: var(--warn); font-weight: bold; border-bottom: 1px dashed var(--warn); }

    .annual-divider { text-align: center; color: #333; margin: 25px 0; letter-spacing: 5px; font-size: 0.8rem; }

    .annual-pri-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .annual-pri-label { font-size: 0.75rem; color: #999; width: 24px; flex-shrink: 0; text-align: right; }
    .annual-pri-bar-bg { flex: 1; height: 12px; background: #111; position: relative; overflow: hidden; border: 1px solid #222; }
    .annual-pri-bar-fill { height: 100%; position: absolute; top: 0; left: 0; }
    .annual-pri-count { font-size: 0.7rem; color: #aaa; width: 30px; flex-shrink: 0; }
    .annual-report-time { margin-top: 25px; padding-top: 15px; border-top: 1px dashed #333; text-align: center; font-size: 0.75rem; color: #666; line-height: 1.8; }

    /* Light theme \u5E74\u5EA6\u62A5\u544A */
    [data-theme="light"] .stats-tabs { border: 2px solid #1B1915; border-radius: 4px; }
    [data-theme="light"] .stats-tab { color: #1B1915 !important; border-radius: 0 !important; }
    [data-theme="light"] .stats-tab.active { background: #1B1915 !important; color: #5C960B !important; }
    [data-theme="light"] .annual-hero { background: #FEFEFE; border: 3px solid #1B1915; box-shadow: 6px 6px 0 #1B1915; border-radius: 8px; }
    [data-theme="light"] .annual-ending-title { color: #CE2424; }
    [data-theme="light"] .annual-ending-subtitle { color: #1B1915; }
    [data-theme="light"] .annual-ending-desc { border-top-color: #1B1915; color: #1B1915; }
    [data-theme="light"] .annual-stat-card { background: #FEFEFE; border: 2px solid #1B1915; box-shadow: 2px 2px 0 #E5E5E5; border-radius: 4px; }
    [data-theme="light"] .annual-stat-value { color: #5C960B; }
    [data-theme="light"] .annual-stat-label { color: #1B1915; font-weight: bold; }
    [data-theme="light"] .annual-section-title { color: #CE2424; border-bottom-color: #1B1915; }
    [data-theme="light"] .annual-month-bar-bg { background: #F0F0F0; border-color: #CCC; }
    [data-theme="light"] .annual-month-bar-total { background: rgba(0,0,0,0.06); }
    [data-theme="light"] .annual-month-bar-done { background: #5C960B; }
    [data-theme="light"] .annual-month-label { color: #1B1915; }
    [data-theme="light"] .annual-month-count { color: #1B1915; }
    [data-theme="light"] .annual-narrative { background: #FEFEFE; border: 2px dashed #1B1915; color: #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5; }
    [data-theme="light"] .annual-narrative strong { color: #5C960B; }
    [data-theme="light"] .annual-narrative em { color: #CE2424; }
    [data-theme="light"] .annual-divider { color: #CCC; }
    [data-theme="light"] .annual-year-title { border-bottom-color: #1B1915; }
    [data-theme="light"] .annual-year-title span { color: #5C960B; text-shadow: 0 0 4px rgba(92,150,11,0.3); }
    [data-theme="light"] .annual-pri-bar-bg { background: #F0F0F0; border-color: #CCC; }
    [data-theme="light"] .annual-pri-label { color: #1B1915; }
    [data-theme="light"] .annual-pri-count { color: #1B1915; }
    [data-theme="light"] .annual-report-time { border-top-color: #1B1915; color: #666; }
    [data-theme="light"] #custom-header-preview,
    [data-theme="light"] #custom-content-preview {
      background: #FEFEFE; color: #1B1915; border: 2px solid #1B1915;
      box-shadow: inset 2px 2px 0 #E5E5E5; border-radius: 4px;
    }

    [data-theme="light"] #preview-notice { background: #E1AC07; color: #1B1915; border-bottom: 2px solid #1B1915; }
    [data-theme="light"] #preview-notice .md-code { background: #1B1915; color: #E1AC07; border: 1px solid #1B1915; }
    
    /* === \u663E\u793A\u5927\u5C0F\u8C03\u6574 === */
    .scale-control { width: 100%; }
    .scale-slider-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .scale-slider-row .scale-label-sm { font-size: 0.7rem; color: #666; flex-shrink: 0; }
    .scale-slider-row .scale-label-lg { font-size: 1.15rem; color: #666; font-weight: bold; flex-shrink: 0; }
    .scale-slider-row input[type="range"] {
      flex: 1; -webkit-appearance: none; appearance: none;
      height: 6px; background: #222; border-radius: 3px;
      outline: none; margin-bottom: 0; border: none; padding: 0; width: auto;
    }
    .scale-slider-row input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--crt); cursor: pointer;
      border: 2px solid var(--fg);
      box-shadow: 0 0 6px rgba(0,255,65,0.3);
    }
    .scale-slider-row input[type="range"]::-moz-range-thumb {
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--crt); cursor: pointer;
      border: 2px solid var(--fg);
    }
    .scale-slider-row input[type="range"]::-moz-range-track {
      height: 6px; background: #222; border-radius: 3px; border: none;
    }
    .scale-value { 
      font-size: 0.85rem; color: var(--crt); min-width: 44px; text-align: center;
      font-weight: bold; flex-shrink: 0;
    }
    .scale-presets { display: flex; gap: 6px; margin-bottom: 12px; }
    .scale-preset-btn {
      flex: 1; padding: 8px 4px; font-size: 0.8rem;
      text-align: center; cursor: pointer;
      background: #222; border: 1px solid #444; color: var(--fg);
      font-family: var(--font-main); transition: 0.2s;
    }
    .scale-preset-btn.active {
      border-color: var(--crt); color: var(--crt);
      background: rgba(0,255,65,0.08);
    }
    .scale-preset-btn:active { background: var(--crt); color: #000; }
    .scale-preview-wrap {
      border: 1px dashed #444; border-radius: 4px; padding: 10px;
      background: var(--bg);
    }
    .scale-preview-wrap .todo-item { margin-bottom: 5px; pointer-events: none; }

    /* Light \u4E3B\u9898 - \u663E\u793A\u5927\u5C0F\u8C03\u6574 */
    [data-theme="light"] .scale-slider-row input[type="range"] { background: #E5E5E5; }
    [data-theme="light"] .scale-slider-row input[type="range"]::-webkit-slider-thumb {
      background: #5C960B; border-color: #1B1915; box-shadow: 2px 2px 0 #1B1915;
    }
    [data-theme="light"] .scale-slider-row input[type="range"]::-moz-range-thumb {
      background: #5C960B; border-color: #1B1915;
    }
    [data-theme="light"] .scale-slider-row input[type="range"]::-moz-range-track { background: #E5E5E5; }
    [data-theme="light"] .scale-value { color: #5C960B; }
    [data-theme="light"] .scale-preset-btn {
      background: #FEFEFE; border: 2px solid #1B1915; color: #1B1915;
      box-shadow: 2px 2px 0 #E5E5E5; border-radius: 4px; font-weight: bold;
    }
    [data-theme="light"] .scale-preset-btn.active {
      border-color: #5C960B; color: #5C960B; background: rgba(92,150,11,0.08);
      box-shadow: 2px 2px 0 #5C960B;
    }
    [data-theme="light"] .scale-preset-btn:active { background: #5C960B; color: #FEFEFE; }
    [data-theme="light"] .scale-preview-wrap { background: #F0EEE2; border-color: #1B1915; }
    [data-theme="light"] .scale-label-sm,
    [data-theme="light"] .scale-label-lg { color: #1B1915; }
    
    .apikey-create-row { display: flex; gap: 8px; margin-bottom: 12px; align-items: stretch; }
    .apikey-create-row input { flex: 1; margin-bottom: 0; }
    .apikey-create-btn { padding: 8px 14px; white-space: nowrap; }

    .apikey-status { font-size: 0.7rem; margin-left: 6px; color: var(--crt); }
    .apikey-status.disabled { color: var(--accent); }
    [data-theme="light"] .apikey-status.disabled { color: #CE2424; }

    #apikey-created-box { display: none; background: var(--panel); border: 1px solid var(--crt); border-radius: 4px; padding: 12px; margin-bottom: 12px; }
    #apikey-created-box .apikey-created-text { margin: 0 0 8px 0; color: var(--crt); }
    #apikey-created-box .apikey-created-row { display: flex; gap: 8px; align-items: center; }
    #apikey-created-value { flex: 1; word-break: break-all; font-size: 0.8rem; padding: 8px; margin-bottom: 0; cursor: text; }
    #apikey-created-box .apikey-copy-btn { padding: 6px 10px; white-space: nowrap; }

    [data-theme="light"] #apikey-created-box { background: #F0F0F0; border: 2px solid #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5; }
    [data-theme="light"] #apikey-created-box .apikey-created-text { color: #5C960B; }
    [data-theme="light"] #apikey-created-value { background: #FEFEFE; border: 2px solid #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5; color: #1B1915; }

    .session-item { display: flex; align-items: center; background: var(--panel); border: 1px solid #333; margin-bottom: 8px; padding: 10px; border-radius: 4px; gap: 10px; flex-wrap: wrap; }
    .session-item.current-session { border-color: var(--crt); }
    .session-ua { flex: 1; font-size: 0.72rem; color: var(--fg); word-break: break-all; line-height: 1.4; min-width: 0; }
    .session-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .session-actions button { padding: 4px 8px; font-size: 0.75rem; }

    [data-theme="light"] .session-item { background: #FEFEFE; border-color: #1B1915; box-shadow: 2px 2px 0 #E5E5E5; border-radius: 4px; }
    [data-theme="light"] .session-item.current-session { border-color: #5C960B; }
    [data-theme="light"] .session-ua { color: #1B1915; }
    
    body:has(.modal-overlay.active, .detail-overlay.active) { overflow: hidden !important; touch-action: none; }
    .modal-overlay.active,
    .detail-overlay.active { overscroll-behavior: contain; }
    .io-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 120; }
    .io-overlay-high { z-index: 130; }
    .io-dialog { background: #0a0a0a; border: 1px solid #ff3300; padding: 25px 35px; text-align: center; font-family: Courier New, monospace; max-width: 90vw; min-width: 280px; }
    .io-title { font-size: 1.05rem; font-weight: bold; margin-bottom: 8px; color: #fff; }
    .io-sub { font-size: 0.85rem; color: #888; margin-bottom: 10px; }
    .io-sub-block { margin-bottom: 20px; white-space: pre-line; }
    .io-msg { font-size: 0.95rem; font-weight: bold; margin-bottom: 20px; color: #ff3300; white-space: pre-line; }
    .io-bar-bg { height: 4px; background: #222; border: 1px solid #333; }
    .io-bar-fill { height: 100%; width: 0%; background: #ff3300; transition: width 0.3s; }
    .io-btn-row { display: flex; gap: 10px; justify-content: center; }
    .io-btn { padding: 8px 25px; cursor: pointer; font-family: inherit; font-weight: bold; background: transparent; }
    .io-btn-primary { border: 1px solid #ff3300; color: #ff3300; }
    .io-btn-secondary { border: 1px solid #555; color: #888; }
    [data-theme="light"] .io-overlay { background: rgba(27,25,21,0.85); }
    [data-theme="light"] .io-dialog { background: #F0F0F0; border: 4px solid #1B1915; box-shadow: 8px 8px 0 #1B1915; border-radius: 8px; }
    [data-theme="light"] .io-title { color: #1B1915; }
    [data-theme="light"] .io-sub { color: #666; }
    [data-theme="light"] .io-msg { color: #CE2424; }
    [data-theme="light"] .io-bar-bg { height: 8px; background: #E5E5E5; border: 2px solid #1B1915; }
    [data-theme="light"] .io-bar-fill { background: #CE2424; }
    [data-theme="light"] .io-btn-primary { border: 3px solid #1B1915; color: #1B1915; box-shadow: 2px 2px 0 #1B1915; }
    [data-theme="light"] .io-btn-primary:hover { background: #1B1915; color: #FEFEFE; }
    [data-theme="light"] .io-btn-secondary { border: 2px solid #999; color: #666; }
    [data-theme="light"] .io-btn-secondary:hover { background: #E5E5E5; }

    .changelog-entry { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dashed #333; }
    .changelog-entry:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .changelog-version { font-size: 0.9rem; font-weight: bold; color: var(--crt); margin-bottom: 2px; }
    .changelog-date { font-size: 0.7rem; color: #666; margin-bottom: 4px; }
    .changelog-notes { font-size: 0.8rem; color: var(--fg); line-height: 1.5; }
    .changelog-new { border-left: 3px solid var(--accent); padding-left: 10px; border-bottom: none; }
    .changelog-new .changelog-version { color: var(--accent); }
    .changelog-section-title { font-size: 0.7rem; color: #555; text-transform: uppercase; margin: 12px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #333; letter-spacing: 1px; }
    [data-theme="light"] .changelog-entry { border-bottom-color: #1B1915; }
    [data-theme="light"] .changelog-version { color: #5C960B; }
    [data-theme="light"] .changelog-date { color: #666; }
    [data-theme="light"] .changelog-notes { color: #1B1915; }
    [data-theme="light"] .changelog-new { border-left-color: #CE2424; }
    [data-theme="light"] .changelog-new .changelog-version { color: #CE2424; }
    [data-theme="light"] .changelog-section-title { color: #1B1915; border-bottom-color: #1B1915; }
`;

// src/html/body.js
function getBody(isAuthorized) {
  return `
<body>
  <div class="scanlines"></div>
  
  <div id="preview-notice" class="hidden" style="background:var(--warn);color:#000;padding:8px 15px;text-align:center;font-weight:bold;font-size:0.85rem;position:fixed;top:0;left:0;right:0;z-index:110;">\u26A0 \u524D\u7AEF\u5B9A\u5236\u9884\u89C8\u72B6\u6001 \u2014 \u81EA\u5B9A\u4E49\u4EC5\u5728\u672C\u5730\u751F\u6548 <span class="md-code" style="cursor:pointer;margin-left:8px;background:#000;color:var(--warn);" onclick="restoreAllPreview()">\u8FD8\u539F</span></div>

  <div class="container">
    <div class="top-actions-left ${isAuthorized ? "" : "hidden"}">
      <button class="theme-toggle-btn" onclick="openTrash()">\u56DE\u6536\u7AD9</button>
      <button class="theme-toggle-btn" onclick="openStats()">\u7EDF\u8BA1</button>
    </div>
    <div class="top-actions ${isAuthorized ? "" : "hidden"}">
      <button class="theme-toggle-btn" onclick="openSettings()">\u8BBE\u7F6E</button>
      <button id="theme-toggle-btn" class="theme-toggle-btn" onclick="toggleTheme()">\u81EA\u52A8</button>
    </div>
    <h1>\u5F85\u529E\u4E8B\u9879</h1>

    <div id="login-view" class="${isAuthorized ? "hidden" : ""}">
      <div style="border: 1px solid var(--accent); padding: 20px; text-align: center;">
        <p style="color:var(--accent); margin-bottom:15px;">[ \u8EAB\u4EFD\u9A8C\u8BC1\u8BF7\u6C42 ]</p>
        <input type="password" id="password-input" placeholder="\u8F93\u5165\u5BC6\u94A5..." onkeydown="if(event.key==='Enter')login()">
        <button class="btn-primary" style="width:100%" onclick="login()">\u63A5\u5165\u7CFB\u7EDF</button>
      </div>
    </div>

    <div id="app-view" class="${isAuthorized ? "" : "hidden"}">
      
      <div class="date-bar">
        <button onclick="changeDate(-1)">&lt;</button>
        <div class="date-display" onclick="openCalendar()">
          <span class="main" id="date-main">LOADING...</span>
          <span class="sub" id="date-sub">\u70B9\u51FB\u5207\u6362\u65E5\u671F</span>
        </div>
        <button onclick="changeDate(1)">&gt;</button>
      </div>

      <div class="toolbar">
        <button id="btn-batch-mode" onclick="toggleBatchMode()">\u2261 \u6279\u91CF</button>
        <div class="view-tags" onclick="openViewModal()">
          <button class="view-tag" id="view-tag-filter">\u5168\u90E8</button>
          <button class="view-tag view-tag-shrink" id="view-tag-category">\u5168\u90E8\u5206\u7C7B</button>
          <button class="view-tag" id="view-tag-sort">\u65F6\u95F4\xB7\u6B63\u5E8F</button>
          <button class="view-tag" onclick="event.stopPropagation();openCategoryManage()">\u5206\u7C7B\u7BA1\u7406</button>
        </div>
      </div>

      <div id="todo-list"></div>
      
      <div class="fab" onclick="openAddModal()">+</div>
    </div>
  </div>

  <div id="batch-bar" class="batch-bar hidden">
    <button onclick="batchSelectAll()">\u5168\u9009</button>
    <button onclick="batchToggleDone()">\u6279\u91CF\u5B8C\u6210/\u53D6\u6D88</button>
    <button class="btn-danger" onclick="batchDelete()">\u6279\u91CF\u5220\u9664</button>
    <button onclick="exitBatchMode()">\u9000\u51FA</button>
  </div>

  <div id="modal-add" class="modal-overlay" onclick="if(event.target===this) closeAddModal()">
    <div class="modal-content">
      <h3 style="margin-bottom:15px; padding-bottom:5px;">>> \u65B0\u5EFA\u4E8B\u9879</h3>
      <input type="text" id="add-text" placeholder="\u4E8B\u9879\u6807\u9898\uFF08\u5FC5\u586B\uFF09">
      
      <div class="detail-label modal-section">\u5B50\u4EFB\u52A1</div>
      <div class="row modal-subtask-row">
        <input type="text" id="add-subtask-input" placeholder="\u8F93\u5165\u5B50\u4EFB\u52A1\uFF08\u53EF\u9009\uFF09" class="flex-1">
        <button onclick="addTempSubtask('add')">\u6DFB\u52A0</button>
      </div>
      <div id="add-subtasks-list" style="margin-bottom:15px;"></div>

      <div class="detail-label modal-section">\u65F6\u95F4\u4E0E\u91CD\u590D</div>
      <div class="row modal-row">
        <div class="fake-input flex-1" onclick="openCalendarForAdd()">
          <span id="add-date-display">----/--/--</span>
          <span class="arrow">\u25BC</span>
        </div>
        <div class="fake-input flex-1" id="add-repeat-trigger" onclick="toggleRepeatMenu('add', this)">
          <span id="add-repeat-display">\u91CD\u590D: \u4E0D\u91CD\u590D</span>
          <span class="arrow">\u25BC</span>
        </div>
      </div>
      <div id="add-repeat-end-row" class="modal-row" style="display:none;">
        <div class="fake-input" onclick="openCalendarForRepeatEnd('add')">
          <span id="add-repeat-end-display">\u5FAA\u73AF\u622A\u6B62: \u6C38\u4E0D</span>
          <span class="arrow">\u25BC</span>
        </div>
      </div>
      <div class="row modal-row">
        <div class="fake-input flex-1" onclick="openTimePicker('add','start')">
          <span id="add-time-display">\u5F00\u59CB --:--</span>
          <span class="arrow">\u25BC</span>
        </div>
        <div class="fake-input flex-1" onclick="openTimePicker('add','end')">
          <span id="add-endtime-display">\u7ED3\u675F --:--</span>
          <span class="arrow">\u25BC</span>
        </div>
      </div>

      <div class="detail-label modal-section">\u5C5E\u6027\u4E0E\u94FE\u63A5</div>
      <div class="row modal-row">
        <div class="fake-input flex-1" id="add-category-trigger" onclick="toggleCategoryMenu('add', this)">
          <span id="add-category-display">\u5206\u7C7B: \u65E0</span>
          <span class="arrow-r">\u25BC</span>
        </div>
        <div class="fake-input flex-1" id="add-priority-trigger" onclick="togglePriorityMenu('add', this)">
          <span id="add-priority-display">\u4F18\u5148\u7EA7: \u4F4E</span>
          <span class="arrow">\u25BC</span>
        </div>
      </div>
      <input type="url" id="add-url" placeholder="URL / APP Scheme (\u53EF\u9009)">
      <input type="text" id="add-copy" placeholder="\u5FEB\u6377\u590D\u5236\u5185\u5BB9\uFF08\u53EF\u9009\uFF09">

      <div class="detail-label modal-section">\u5176\u4ED6</div>
      <div class="switch-label" onclick="toggleAddSearch()">
        <div class="switch-box" id="add-search-box"></div>
        <span>\u542F\u7528\u6BCF\u65E5\u641C\u7D22</span>
      </div>
      <div id="add-search-actions" class="hidden" style="margin-bottom:15px;">
        <div class="row modal-row">
          <div class="fake-input flex-1" id="add-search-provider-trigger" onclick="toggleProviderMenu('add', this)" style="height:46px;">
            <span id="add-search-provider-display">\u81EA\u52A8 (\u968F\u673A\u6E90)</span>
            <span class="arrow-r">\u25BC</span>
          </div>
          <button class="btn-ghost flex-1" id="add-search-regenerate-btn" style="height:46px; padding: 0 5px;" onclick="regenerateAddSearchTerms()">\u83B7\u53D6\u70ED\u641C</button>
        </div>
        <div class="search-card" id="add-search-preview"></div>
      </div>

      <textarea id="add-desc" rows="3" placeholder="\u8F93\u5165\u5907\u6CE8/\u8BE6\u7EC6\u63CF\u8FF0\uFF08\u53EF\u9009\uFF09"></textarea>
      <div class="row" style="margin-top:10px;">
        <button class="flex-1" onclick="closeAddModal()">\u53D6\u6D88</button>
        <button class="flex-1 btn-primary" onclick="confirmAddTask()">\u6DFB\u52A0</button>
      </div>
    </div>
  </div>

  <div id="detail-view" class="detail-overlay">
    <div class="detail-header">
      <div style="display:flex; align-items:center; gap:6px;">
        <button onclick="closeDetail()" style="padding: 4px 8px;">\u2190</button>
        <span style="font-weight:bold;">\u4E8B\u9879\u8BE6\u60C5</span>
      </div>
      <button id="btn-edit-toggle" onclick="toggleEditMode()" style="padding: 4px 8px;">\u7F16\u8F91</button>
    </div>
    <div id="detail-content"></div>
    <div style="margin-top:auto; display:flex; gap:10px; padding-top:20px;">
      <button class="btn-danger flex-1" id="btn-delete-task">\u5220\u9664\u4E8B\u9879</button>
      <button class="btn-primary flex-1 hidden" id="btn-save-task">\u4FDD\u5B58\u53D8\u66F4</button>
    </div>
  </div>

  <div id="trash-overlay" class="detail-overlay">
    <div class="detail-header" style="align-items: center;">
      <div style="display:flex; align-items:center; gap:6px;">
        <button onclick="closeTrash()" style="padding: 4px 8px;">\u2190</button>
        <span style="font-weight:bold;">\u56DE\u6536\u7AD9</span>
      </div>
      <div style="display:flex; gap:8px;">
        <button id="btn-trash-batch" style="padding:4px 8px;" onclick="toggleTrashBatchMode()">\u6279\u91CF</button>
        <button class="btn-danger" style="padding:4px 8px; border:1px solid #666;" onclick="clearTrash()">\u6E05\u7A7A</button>
      </div>
    </div>
    <div id="trash-list" style="flex:1; overflow-y:auto; padding-bottom: 20px;"></div>
    
    <div id="trash-batch-bar" class="batch-bar hidden" style="z-index: 70;">
      <button onclick="batchTrashSelectAll()">\u5168\u9009</button>
      <button onclick="batchTrashRestore()">\u6062\u590D\u9009\u4E2D</button>
      <button class="btn-danger" onclick="batchTrashDelete()">\u5F7B\u5E95\u5220\u9664</button>
      <button onclick="exitTrashBatchMode()">\u9000\u51FA</button>
    </div>
  </div>

  <div id="stats-overlay" class="detail-overlay">
    <div class="detail-header" style="align-items: center;">
      <div style="display:flex; align-items:center; gap:6px;">
        <button onclick="closeStats()" style="padding: 4px 8px;">\u2190</button>
        <span style="font-weight:bold;" id="stats-title-text">7\u5929\u7EDF\u8BA1</span>
      </div>
      <button id="stats-switch-btn" class="btn-ghost hidden" style="padding:4px 8px; border:1px solid #666;" onclick="switchStatsTab()">\u5E74\u5EA6\u62A5\u544A</button>
    </div>
    <div style="flex:1; overflow-y:auto; padding-bottom: 20px;">
      <div id="stats-weekly">
        <div id="stats-loading" style="text-align:center; padding:40px; color:var(--fg);">\u6570\u636E\u62C9\u53D6\u4E2D...</div>
        <div id="stats-content" class="hidden">
          <div class="stats-grid">
            <div class="chart-container chart-container-bar"><canvas id="chart-bar"></canvas></div>
            <div style="text-align: center; color: var(--crt); font-weight: bold; font-size: 1.1rem; margin: 5px 0;" id="stats-total-info">\u8FD17\u5929\u603B\u5B8C\u6210\u6570: 0</div>
            <div class="stats-row-bottom">
              <div class="chart-container chart-container-pie"><canvas id="chart-pie-priority"></canvas></div>
              <div class="chart-container chart-container-pie"><canvas id="chart-pie-status"></canvas></div>
            </div>
          </div>
        </div>
      </div>
      <div id="stats-annual" class="hidden">
        <div id="annual-loading" style="text-align:center; padding:40px; color:var(--fg);">\u5E74\u5EA6\u6570\u636E\u52A0\u8F7D\u4E2D...</div>
        <div id="annual-content" class="hidden"></div>
      </div>
    </div>
  </div>

  <div id="settings-overlay" class="detail-overlay">
    <div class="detail-header" style="align-items: center;">
      <div style="display:flex; align-items:center; gap:6px;">
        <button onclick="closeSettings()" style="padding: 4px 8px;">\u2190</button>
        <span style="font-weight:bold;">\u7CFB\u7EDF\u8BBE\u7F6E</span>
      </div>
      <button onclick="saveAndCloseSettings()" style="padding: 4px 8px;">\u4FDD\u5B58</button>
    </div>
    <div style="flex:1; overflow-y:auto; padding-bottom: 20px;">
      
      <div class="detail-label">\u504F\u597D\u8BBE\u7F6E</div>
      <div style="margin-bottom: 20px;">
          <div class="setting-item">
              <span class="flex-1">\u6BCF\u65E5\u641C\u7D22\u6E90</span>
              <div class="fake-input" onclick="toggleSettingPopover('provider', this)" style="width: 145px; margin-bottom: 0; padding: 6px 8px; justify-content: space-between; border-radius: 4px;">
                  <span id="set-disp-provider">\u81EA\u52A8 (\u968F\u673A\u6E90)</span>
                  <span style="font-size:0.8rem; margin-right: 4px;">\u25BC</span>
              </div>
          </div>
          <div class="setting-item">
              <span class="flex-1">\u6392\u5E8F\u65B9\u5F0F</span>
              <div class="fake-input" onclick="toggleSettingPopover('sort', this)" style="width: 145px; margin-bottom: 0; padding: 6px 8px; justify-content: space-between; border-radius: 4px;">
                  <span id="set-disp-sort">\u6309\u65F6\u95F4</span>
                  <span style="font-size:0.8rem; margin-right: 4px;">\u25BC</span>
              </div>
          </div>
          <div class="setting-item">
              <span class="flex-1">\u6392\u5E8F\u987A\u5E8F</span>
              <div class="fake-input" onclick="toggleSettingPopover('sortAsc', this)" style="width: 145px; margin-bottom: 0; padding: 6px 8px; justify-content: space-between; border-radius: 4px;">
                  <span id="set-disp-sort-asc">\u6B63\u5E8F</span>
                  <span style="font-size:0.8rem; margin-right: 4px;">\u25BC</span>
              </div>
          </div>
          <div class="setting-item" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
              <span>\u663E\u793A\u5927\u5C0F</span>
              <span class="md-code" style="cursor:pointer;margin-left:auto;" onclick="resetScaleBrowserData()">\u91CD\u7F6E</span>
            </div>
            <div class="scale-control">
              <div class="scale-slider-row">
                <span class="scale-label-sm">A</span>
                <input type="range" id="scale-slider" min="0.75" max="1.25" step="0.01" value="1" oninput="onScaleSliderChange(this.value)">
                <span class="scale-label-lg">A</span>
                <span class="scale-value" id="scale-value-display">100%</span>
              </div>
              <div class="scale-presets">
                <button class="scale-preset-btn" data-scale="0.85" onclick="setScalePreset(0.85)">\u5C0F</button>
                <button class="scale-preset-btn active" data-scale="1.0" onclick="setScalePreset(1.0)">\u9ED8\u8BA4</button>
                <button class="scale-preset-btn" data-scale="1.15" onclick="setScalePreset(1.15)">\u5927</button>
              </div>
              <div class="scale-preview-wrap">
                <div id="scale-preview" style="zoom:1;">
                  <div class="todo-item" style="margin-bottom:5px;">
                    <div class="checkbox"></div>
                    <div class="item-meta">
                      <div class="item-title">\u793A\u4F8B\u5F85\u529E\u4E8B\u9879</div>
                      <div class="item-info">
                        <span class="badge badge-high">\u9AD8</span>
                        <span class="badge badge-time">09:00</span>
                      </div>
                    </div>
                  </div>
                  <div class="todo-item done">
                    <div class="checkbox"></div>
                    <div class="item-meta">
                      <div class="item-title">\u5DF2\u5B8C\u6210\u7684\u4EFB\u52A1</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>
      
      <div class="settings-card">
          <div class="setting-item" style="margin-bottom: 15px; border: none; padding: 0;">
              <span class="settings-text" style="margin:0;"><strong>\u542F\u7528\u524D\u7AEF\u5B9A\u5236\u6CE8\u5165</strong></span>
              <div class="switch-label" onclick="toggleCustomCodeEnabled()" style="margin-bottom: 0;">
                  <div class="switch-box" id="custom-code-enabled-box"></div>
              </div>
          </div>

          <p class="settings-text" style="margin-bottom: 12px;">\u5173\u95ED\u540E\u5C06\u4E0D\u518D\u6CE8\u5165\u81EA\u5B9A\u4E49\u4EE3\u7801\uFF0C\u4F46\u4EE3\u7801\u4ECD\u4F1A\u4FDD\u7559\u5728\u6570\u636E\u5E93\u4E2D\u3002</p>
          
         <div class="detail-label" style="margin-top: 6px;">\u81EA\u5B9A\u4E49\u5934\u90E8</div>
        <textarea id="custom-header-preview" rows="5"
          style="resize:vertical; font-size:0.8rem; margin-bottom: 12px;"
          placeholder="\u672A\u914D\u7F6E\u6216\u5DF2\u5173\u95ED \u2014 \u5C06\u6CE8\u5165\u5230 &lt;head&gt; \u5185"></textarea>
          <div class="detail-label">\u81EA\u5B9A\u4E49\u5185\u5BB9</div>
          <textarea id="custom-content-preview" rows="5"
            style="resize:vertical; font-size:0.8rem; margin-bottom: 12px;"
            placeholder="\u672A\u914D\u7F6E\u6216\u5DF2\u5173\u95ED \u2014 \u5C06\u6CE8\u5165\u5230 &lt;/body&gt; \u524D"></textarea>
          <div id="custom-action-row" style="display:none; gap:10px; margin-bottom:12px;">
              <span class="md-code" style="cursor:pointer; flex:1; text-align:center;" onclick="previewCustomCode()">\u9884\u89C8</span>
              <span class="md-code" style="cursor:pointer; flex:1; text-align:center;" onclick="resetCustomCode()">\u91CD\u7F6E</span>
              <span class="md-code" style="cursor:pointer; color:var(--accent); flex:1; text-align:center; display:none;" id="restore-custom-btn" onclick="restoreAllPreview()">\u8FD8\u539F</span>
          </div>
          <div class="settings-text" style="border-top: 1px dashed #333; padding-top: 10px;">
            <strong>\u8BF4\u660E\uFF1A</strong>\u901A\u8FC7\u7F16\u8F91\u533A\u6CE8\u5165\u81EA\u5B9A\u4E49 HTML/CSS/JS\uFF0C\u5B58\u50A8\u5728 D1 \u6570\u636E\u5E93\u4E2D\u3002\uFF08\u53EF\u7559\u7A7A\uFF09<br>
            <strong>\u81EA\u5B9A\u4E49\u5934\u90E8</strong> \u2014 \u6CE8\u5165\u5230 <span class="md-code">&lt;head&gt;</span> \u5185\uFF08\u9002\u5408\u653E <span class="md-code">&lt;style&gt;</span>\u3001\u5916\u90E8 CSS\u3001meta \u6807\u7B7E\u7B49\uFF09<br>
            <strong>\u81EA\u5B9A\u4E49\u5185\u5BB9</strong> \u2014 \u6CE8\u5165\u5230 <span class="md-code">&lt;/body&gt;</span> \u524D\uFF08\u9002\u5408\u653E <span class="md-code">&lt;script&gt;</span>\u3001HTML \u7247\u6BB5\u7B49\uFF09
          </div>
      </div>

      <div class="detail-label">\u6570\u636E\u7BA1\u7406 (\u5BFC\u5165/\u5BFC\u51FA JSON)</div>
      <div class="settings-card">
          <div class="settings-text" style="margin-bottom: 10px;">\u5373\u5C06\u5BFC\u51FA\u7684\u5185\u5BB9\u5305\u62EC\uFF1A</div>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer;">
            <input type="checkbox" id="export-todos" checked style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">\u6D3B\u52A8\u4E0E\u5386\u53F2\u5F85\u529E\u4E8B\u9879\uFF08\u542B\u91CD\u590D\u6A21\u677F\uFF09</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer;">
            <input type="checkbox" id="export-trash" checked style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">\u4EC5\u56DE\u6536\u7AD9\u4E2D\u7684\u6570\u636E\uFF08\u76F8\u5173\u7684\u9ED1\u540D\u5355\u5728\u91CD\u590D\u6A21\u677F\u4E2D\uFF09</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer;">
            <input type="checkbox" id="export-settings" checked style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">\u4E2A\u6027\u5316\u6570\u636E</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:15px; cursor:pointer;">
            <input type="checkbox" id="export-categories" checked style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">\u5206\u7C7B\u6570\u636E</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:15px; cursor:pointer;">
            <input type="checkbox" id="chunked-mode" style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">\u4F7F\u7528\u5206\u7247\u6A21\u5F0F\uFF08\u63A8\u8350\u5927\u6570\u636E\u4F7F\u7528\uFF09</span>
          </label>
          <div class="row">
              <button class="flex-1" onclick="exportData()">\u5BFC\u51FA\u6570\u636E</button>
              <button class="flex-1" onclick="document.getElementById('import-file').click()">\u5BFC\u5165\u6570\u636E</button>
              <input type="file" id="import-file" style="display:none" accept=".json" onchange="importData(event)">
          </div>
          <div class="settings-text" style="border-top: 1px dashed #333; padding-top: 10px; margin-top: 15px;">
           <strong>/api/import-backup: </strong>\u6267\u884C\u8986\u76D6\u6A21\u5F0F\u5BFC\u5165\u65F6\uFF0C\u7CFB\u7EDF\u4F1A\u5C06\u5F53\u524D <span class="md-code">todos\u3001todo_templates\u3001categories</span> \u8868\u76F4\u63A5\u91CD\u547D\u540D\u4E3A\u5907\u4EFD\u8868\uFF0C\u7136\u540E\u521B\u5EFA\u7A7A\u8868\u63A5\u6536\u65B0\u6570\u636E\u3002\u5BFC\u5165\u6210\u529F\u540E\u5907\u4EFD\u8868\u4FDD\u755910\u5206\u949F\u4F9B\u624B\u52A8\u6062\u590D\uFF0C\u5230\u671F\u81EA\u52A8\u6E05\u9664\u3002\u5BFC\u5165\u5F02\u5E38\u5C06\u81EA\u52A8\u628A\u5907\u4EFD\u8868\u91CD\u547D\u540D\u56DE\u4E3B\u8868\u6062\u590D\u539F\u6570\u636E\u3002\u82E5\u81EA\u52A8\u6062\u590D\u4E5F\u5931\u8D25\uFF08\u6781\u7AEF\u60C5\u51B5\uFF09\u6216\u5B58\u5728\u6B8B\u7559\uFF0C\u53EF\u5728\u6D4F\u89C8\u5668\u5730\u5740\u680F\u8BBF\u95EE\u4EE5\u4E0B\u63A5\u53E3\u624B\u52A8\u5904\u7406\u3002<br>
           <span class="md-code">?action=query</span> \u2014 \u67E5\u8BE2\u662F\u5426\u5B58\u5728\u5907\u4EFD\u8868<br>
           <span class="md-code">?action=restore</span> \u2014 \u6062\u590D\u5907\u4EFD\u8868\uFF08\u5F53\u524D\u6570\u636E\u5C06\u88AB\u8986\u76D6\uFF09<br>
           <span class="md-code">?action=clear</span> \u2014 \u6E05\u7A7A\u5907\u4EFD\u8868
          </div>
      </div>

      <div class="detail-label">API \u5BC6\u94A5\u7BA1\u7406</div>
      <div class="settings-card">
          <p class="settings-text" style="margin-bottom: 12px;">API \u5BC6\u94A5\u7528\u4E8E\u5916\u90E8\u7A0B\u5E8F\uFF08\u5982 OpenClaw\u3001\u811A\u672C\u7B49\uFF09\u901A\u8FC7 RESTful API \u5B89\u5168\u8BBF\u95EE\u5F85\u529E\u6570\u636E\u3002\u6700\u591A <strong>10</strong> \u4E2A\u5BC6\u94A5\u3002</p>
          <div id="apikeys-list" style="margin-bottom: 12px;"></div>
          <div class="apikey-create-row">
            <input type="text" id="apikey-name-input" placeholder="\u5BC6\u94A5\u540D\u79F0\uFF08\u53EF\u9009\uFF09">
            <button class="apikey-create-btn" onclick="createApiKey()">+</button>
          </div>
          <div id="apikey-created-box">
            <p class="settings-text apikey-created-text"><strong>\u5BC6\u94A5\u5DF2\u521B\u5EFA\uFF01\u8BF7\u7ACB\u5373\u590D\u5236\uFF0C\u6B64\u5BC6\u94A5\u4EC5\u663E\u793A\u4E00\u6B21\uFF1A</strong></p>
            <div class="apikey-created-row">
              <input type="text" id="apikey-created-value" readonly onclick="this.select()">
              <button class="apikey-copy-btn" onclick="copyText(document.getElementById('apikey-created-value').value)">\u590D\u5236</button>
            </div>
          </div>
          <div class="settings-text" style="border-top: 1px dashed #333; padding-top: 10px;">
            <strong>\u4F7F\u7528\u65B9\u5F0F\uFF1A</strong>\u5728\u8BF7\u6C42\u5934\u4E2D\u6DFB\u52A0 <span class="md-code">X-API-Key: cfk_xxx</span>\uFF0C\u6216\u4F7F\u7528 <span class="md-code">?api_key=cfk_xxx</span> \u67E5\u8BE2\u53C2\u6570\u3002
          </div>
      </div>

      <div class="detail-label">\u767B\u5F55\u7BA1\u7406</div>
      <div class="settings-card">
          <p class="settings-text" style="margin-bottom: 12px;">\u6700\u591A\u652F\u6301 <strong>3</strong> \u4E2A\u6D4F\u89C8\u5668UA\u540C\u65F6\u767B\u5F55\u3002\u8FBE\u5230\u4E0A\u9650\u540E\u65B0\u767B\u5F55\u5C06\u81EA\u52A8\u66FF\u6362\u6700\u65E9\uFF08\u9760\u4E0A\uFF09\u767B\u5F55\u7684\u4F1A\u8BDD\u3002</p>
          <div id="sessions-list" style="margin-bottom: 12px;"></div>
          <button class="btn-danger" style="width:100%" onclick="deleteAllSessions()">\u5168\u90E8\u5220\u9664</button>
      </div>

      <div class="detail-label">\u5173\u4E8E MOARA \u5F85\u529E\u4E8B\u9879</div>
      <div class="settings-card">
          <p class="settings-text" style="margin-bottom:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><strong>\u5F53\u524D\u7248\u672C:</strong> <span id="app-version-display"></span> <span id="update-status"></span> <span class="md-code" style="font-size:0.75rem;"><a href="https://github.com/moaradc/cf-todo" target="_blank" style="color:inherit;text-decoration:none;">GitHub</a></span> <span class="md-code" style="cursor:pointer;font-size:0.75rem;" onclick="checkUpdate()">\u68C0\u67E5</span></p>
          <p class="settings-text" style="margin-bottom: 5px;"><strong>\u5E95\u5C42\u67B6\u6784:</strong> Cloudflare Worker + D1 Database</p>
          <p class="settings-text"><strong>\u9879\u76EE\u63CF\u8FF0:</strong> \u666E\u901A\u7684\u5F85\u529E\u4E8B\u9879\u7BA1\u7406</p>
      </div>

      <div class="detail-label" style="color: var(--accent);">\u5371\u9669\u533A\u57DF</div>
      <div class="settings-card danger">
          <div class="settings-text" style="margin-bottom: 10px;">\u9000\u51FA\u5F53\u524D\u767B\u5F55\u4F1A\u8BDD\uFF0C\u9700\u91CD\u65B0\u8F93\u5165\u5BC6\u94A5\u63A5\u5165\u7CFB\u7EDF\u3002\u60A8\u7684\u6570\u636E\u4E0D\u4F1A\u6D88\u5931\u3002</div>
          <button class="btn-danger" style="width:100%" onclick="logout()">\u9000\u51FA\u767B\u5F55</button>
          
          <p class="settings-text" style="margin-bottom: 15px; margin-top: 20px; padding-top: 20px; border-top: 1px dashed var(--accent);">\u6267\u884C\u6B64\u64CD\u4F5C\u5C06\u4E0D\u53EF\u9006\u5730\u6E05\u7A7A\u6240\u6709\u7684\u7CFB\u7EDF\u8BB0\u5F55\u3001\u56DE\u6536\u7AD9\u6570\u636E\u5E76\u91CD\u7F6E\u504F\u597D\u8BBE\u7F6E\u3002\u5EFA\u8BAE\u63D0\u524D\u5BFC\u51FA\u5907\u4EFD\u3002</p>
          <button class="btn-danger" style="width:100%" onclick="factoryReset()">\u6062\u590D\u51FA\u5382\u8BBE\u7F6E</button>
      </div>

    </div>
  </div>

  <div id="popover-action" class="popover-menu">
    <div class="popover-title" id="popover-title">\u9009\u62E9\u64CD\u4F5C\u8303\u56F4:</div>
    <div id="popover-options"></div>
  </div>

  <div id="popover-priority" class="popover-menu">
    <button onclick="selectPriority('low')">\u4F18\u5148\u7EA7: \u4F4E</button>
    <button onclick="selectPriority('med')">\u4F18\u5148\u7EA7: \u4E2D</button>
    <button onclick="selectPriority('high')">\u4F18\u5148\u7EA7: \u9AD8</button>
  </div>

  <div id="popover-provider" class="popover-menu">
    <button onclick="selectProvider('auto')">\u81EA\u52A8 (\u968F\u673A\u6E90)</button>
    <button onclick="selectProvider('bilibili')">\u54D4\u54E9\u54D4\u54E9</button>
    <button onclick="selectProvider('weibo')">\u5FAE\u535A\u70ED\u641C</button>
    <button onclick="selectProvider('zhihu')">\u77E5\u4E4E\u70ED\u699C</button>
    <button onclick="selectProvider('baidu')">\u767E\u5EA6\u70ED\u641C</button>
  </div>

  <div id="popover-repeat" class="popover-menu">
    <button onclick="selectRepeat('none', '\u4E0D\u91CD\u590D')">\u4E0D\u91CD\u590D</button>
    <button onclick="selectRepeat('daily', '\u6BCF\u5929')">\u6BCF\u5929</button>
    <button onclick="selectRepeat('weekly', '\u6BCF\u5468')">\u6BCF\u5468</button>
    <button onclick="selectRepeat('monthly', '\u6BCF\u6708')">\u6BCF\u6708</button>
    <button onclick="selectRepeat('yearly', '\u6BCF\u5E74')">\u6BCF\u5E74</button>
  </div>

  <div id="modal-category" class="modal-overlay" style="z-index:85;" onclick="if(event.target===this) closeCategoryModal()">
    <div class="modal-content" style="max-width:350px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:5px;">
        <h3 id="category-modal-title" style="margin:0;">>> \u9009\u62E9\u5206\u7C7B</h3>
        <button id="cat-batch-btn" onclick="toggleCatBatch()" style="display:none;font-size:1rem;padding:2px 6px;border:1px solid var(--crt);background:transparent;color:var(--crt);cursor:pointer;">\u2261</button>
      </div>
      <div id="category-modal-body" class="category-modal-body">
        <div id="category-modal-list" class="category-modal-list"></div>
        <div id="category-color-presets" class="category-color-presets" style="display:none;"></div>
      </div>
      <div class="category-modal-divider">
        <div id="category-search-row" style="display:flex;gap:6px;align-items:stretch;">
          <input type="text" id="category-new-name" class="category-new-input" placeholder="\u641C\u7D22\u6216\u5FEB\u6377\u65B0\u5EFA\u5206\u7C7B..." style="margin:0;flex:1;" oninput="onCategorySearchInput()" onkeydown="if(event.key==='Enter'&&!event.isComposing)onCategorySearchEnter()">
          <button id="category-toggle-btn" onclick="toggleCategoryMode()" style="width:36px;border:1px solid var(--crt);background:transparent;color:var(--crt);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;">
            <svg id="category-toggle-icon-plus" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;transition:opacity 0.3s ease,transform 0.3s ease;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <svg id="category-toggle-icon-search" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;opacity:0;transform:rotate(-90deg);transition:opacity 0.3s ease,transform 0.3s ease;"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </div>
        <div id="category-edit-preview" style="display:none;padding:4px 0;"></div>
        <div id="category-create-row" style="display:none;gap:6px;align-items:stretch;">
          <input type="text" id="category-create-name" class="category-new-input" placeholder="\u65B0\u5EFA\u5206\u7C7B..." style="margin:0;flex:1;" oninput="onCategoryCreateInput()" onkeydown="if(event.key==='Enter'&&!event.isComposing)onCategoryCreateEnter()">
          <button id="category-toggle-btn-2" onclick="toggleCategoryMode()" style="width:36px;border:1px solid var(--crt);background:transparent;color:var(--crt);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </div>
        <div style="margin-top:6px;display:flex;gap:6px;">
          <button class="flex-1" onclick="closeCategoryModal()" style="font-size:0.8rem;padding:8px;">\u53D6\u6D88</button>
          <button id="category-confirm-btn" class="flex-1" onclick="onCategoryCreateBtnClick()" style="font-size:0.8rem;padding:8px;">\u521B\u5EFA</button>
        </div>
      </div>
      <div id="cat-batch-bar" style="display:none;margin-top:6px;gap:6px;">
        <button class="flex-1" onclick="catBatchSelectAll()" style="font-size:0.8rem;padding:8px;">\u5168\u9009</button>
        <button class="flex-1 btn-danger" onclick="catBatchDelete()" style="font-size:0.8rem;padding:8px;">\u5220\u9664</button>
        <button class="flex-1" onclick="toggleCatBatch()" style="font-size:0.8rem;padding:8px;">\u53D6\u6D88</button>
      </div>
    </div>
  </div>

  <div id="modal-view" class="modal-overlay" style="z-index:80;" onclick="if(event.target===this) closeViewModal()">
    <div class="modal-content" style="max-width:340px;">
      <h3 style="margin-bottom:12px; padding-bottom:5px;">>> \u89C6\u56FE</h3>
      <div class="detail-label" style="margin-top:0;">\u7B5B\u9009</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;" id="view-filter-btns">
        <div class="category-modal-item selected" data-val="all" onclick="setViewFilter('all')"><span class="cat-name">\u5168\u90E8</span></div>
        <div class="category-modal-item" data-val="todo" onclick="setViewFilter('todo')"><span class="cat-name">\u672A\u5B8C\u6210</span></div>
        <div class="category-modal-item" data-val="done" onclick="setViewFilter('done')"><span class="cat-name">\u5DF2\u5B8C\u6210</span></div>
      </div>
      <div class="detail-label">\u5206\u7C7B</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;max-height:120px;overflow-y:auto;" id="view-category-btns"></div>
      <div class="detail-label">\u6392\u5E8F</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;" id="view-sort-btns">
        <div class="category-modal-item selected" data-val="time" onclick="setViewSort('time')"><span class="cat-name">\u65F6\u95F4</span></div>
        <div class="category-modal-item" data-val="priority" onclick="setViewSort('priority')"><span class="cat-name">\u4F18\u5148\u7EA7</span></div>
      </div>
      <div class="detail-label">\u987A\u5E8F</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;" id="view-order-btns">
        <div class="category-modal-item selected" data-val="asc" onclick="setViewOrder(true)"><span class="cat-name">\u6B63\u5E8F</span></div>
        <div class="category-modal-item" data-val="desc" onclick="setViewOrder(false)"><span class="cat-name">\u5012\u5E8F</span></div>
      </div>
      <button onclick="closeViewModal()" style="width:100%;font-size:0.85rem;padding:8px;">\u5B8C\u6210</button>
    </div>
  </div>

  <div id="popover-set-provider" class="popover-menu">
    <button onclick="selectSetting('provider', 'auto', '\u81EA\u52A8 (\u968F\u673A\u6E90)')">\u81EA\u52A8 (\u968F\u673A\u6E90)</button>
    <button onclick="selectSetting('provider', 'bilibili', '\u54D4\u54E9\u54D4\u54E9')">\u54D4\u54E9\u54D4\u54E9</button>
    <button onclick="selectSetting('provider', 'weibo', '\u5FAE\u535A\u70ED\u641C')">\u5FAE\u535A\u70ED\u641C</button>
    <button onclick="selectSetting('provider', 'zhihu', '\u77E5\u4E4E\u70ED\u699C')">\u77E5\u4E4E\u70ED\u699C</button>
    <button onclick="selectSetting('provider', 'baidu', '\u767E\u5EA6\u70ED\u641C')">\u767E\u5EA6\u70ED\u641C</button>
  </div>
  <div id="popover-set-sort" class="popover-menu">
    <button onclick="selectSetting('sort', 'time', '\u6309\u65F6\u95F4')">\u6309\u65F6\u95F4</button>
    <button onclick="selectSetting('sort', 'priority', '\u6309\u4F18\u5148\u7EA7')">\u6309\u4F18\u5148\u7EA7</button>
  </div>
  <div id="popover-set-sortAsc" class="popover-menu">
    <button onclick="selectSetting('sortAsc', 'true', '\u6B63\u5E8F')">\u6B63\u5E8F</button>
    <button onclick="selectSetting('sortAsc', 'false', '\u5012\u5E8F')">\u5012\u5E8F</button>
  </div>

  <div id="modal-calendar" class="modal-overlay" style="z-index:65;" onclick="if(event.target===this) closeCalendar()">
    <div class="modal-content">
      <div class="calendar-header">
        <span style="cursor:pointer" onclick="calChange(-1)" id="cal-prev">&lt; \u4E0A\u6708</span>
        <span id="cal-title"></span>
        <span style="cursor:pointer" onclick="calChange(1)" id="cal-next">\u4E0B\u6708 &gt;</span>
      </div>
      <div class="calendar-grid" id="cal-grid"></div>
      <button id="cal-action-btn" class="btn-ghost" style="width:100%; margin-top:15px;" onclick="jumpToToday()">\u8FD4\u56DE\u4ECA\u65E5</button>
    </div>
  </div>

  <div id="modal-time" class="modal-overlay" onclick="if(event.target===this) closeTimePicker()">
    <div class="modal-content">
      <h3 id="time-picker-title" style="text-align:center; margin-bottom:10px;">\u9009\u62E9\u65F6\u95F4</h3>
      <div class="row">
        <div class="flex-1"><div class="time-label">\u65F6</div></div>
        <div class="flex-1"><div class="time-label">\u5206</div></div>
      </div>
      <div class="time-picker-container">
        <div class="time-col" id="time-col-hour"></div>
        <div class="time-col" id="time-col-min"></div>
      </div>
      <div class="row">
        <button class="flex-1" onclick="clearTime()">\u6E05\u9664</button>
        <button class="flex-1 btn-primary" onclick="confirmTime()">\u786E\u8BA4</button>
      </div>
    </div>
  </div>

  <div id="modal-changelog" class="modal-overlay" style="z-index:75;" onclick="if(event.target===this) closeChangelogModal()">
    <div class="modal-content" style="max-width:400px; display:flex; flex-direction:column;">
      <h3 style="margin-bottom:12px; padding-bottom:5px; flex-shrink:0;">>> \u66F4\u65B0\u65E5\u5FD7</h3>
      <div id="changelog-body" style="max-height:50vh; overflow-y:auto;"></div>
      <button onclick="closeChangelogModal()" style="width:100%; margin-top:12px; flex-shrink:0;">\u5173\u95ED</button>
    </div>
  </div>

  `;
}
__name(getBody, "getBody");

// src/html/js/core.js
var core = `
    function _injectPreview(target, html) {
      if (!html) return;
      var temp = document.createElement('div');
      temp.innerHTML = html;
      var scripts = Array.prototype.slice.call(temp.querySelectorAll('script'));
      var scriptData = scripts.map(function(s) {
        return { src: s.src, text: s.textContent, type: s.type };
      });
      scripts.forEach(function(s) { if (s.parentNode) s.parentNode.removeChild(s); });
      while (temp.firstChild) target.appendChild(temp.firstChild);
      scriptData.forEach(function(s) {
        var el = document.createElement('script');
        if (s.src) el.src = s.src;
        if (s.type) el.type = s.type;
        el.textContent = s.text;
        target.appendChild(el);
      });
    }
    
    var _previewRedirecting = false;
    (function(){
      var ph = localStorage.getItem('preview_custom_header');
      var pc = localStorage.getItem('preview_custom_content');
      var hasPreview = ph !== null || pc !== null;
      if (hasPreview && window.location.search.indexOf('preview=1') === -1) {
        _previewRedirecting = true;
        window.location.href = window.location.pathname + '?preview=1';
        return;
      }
      if (!hasPreview && window.location.search.indexOf('preview=1') !== -1) {
        _previewRedirecting = true;
        window.location.href = window.location.pathname;
        return;
      }
      if (hasPreview) {
        if (ph !== null) { try { _injectPreview(document.head, ph); } catch(e){ console.error('Preview header inject error:', e); } }
        if (pc !== null) { try { _injectPreview(document.body, pc); } catch(e){ console.error('Preview content inject error:', e); } }
        var notice = document.getElementById('preview-notice');
        if (notice) { notice.classList.remove('hidden'); document.body.style.paddingTop = '40px'; }
      }
    })();
    
    async function generateSearchTerms(provider = 'auto') {
      try {
        const res = await fetch(\`/api/hot-search?provider=\${provider}\`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
            const validWords = json.data.filter(w => typeof w === 'string' && w.trim().length > 0);
            return validWords.sort(() => 0.5 - Math.random()).slice(0, 20).map(w => ({ text: w, done: false }));
          }
        }
      } catch (e) { console.error("Hot Search API error:", e); }
      return[];
    }

    function parseMarkdown(text) {
      if (!text) return '';
      let lines = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').split('\\n');
      let html = '';
      let inList = false;

      const formatInline = (str) => {
        return str
          .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
          .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
          .replace(/_([^_]+)_/g, '<em>$1</em>')
          .replace(/~~([^~]+)~~/g, '<del>$1</del>')
          .replace(/\`([^\`]+)\`/g, '<code class="md-code">$1</code>');
      };

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let isList = /^(\\s*[-*]\\s+)(.*)$/.exec(line);
        if (isList) {
          if (!inList) { html += '<ul class="md-ul">'; inList = true; }
          let content = isList[2];
          html += '<li>' + formatInline(content) + '</li>';
          continue;
        } else {
          if (inList) { html += '</ul>'; inList = false; }
        }
        html += formatInline(line) + (i === lines.length - 1 ? '' : '<br>');
      }
      if (inList) html += '</ul>';
      return html;
    }

    let currentThemeMode = localStorage.getItem('themeMode') || 'auto';
    function applyTheme() {
      let isLight = false;
      if (currentThemeMode === 'light') isLight = true;
      else if (currentThemeMode === 'dark') isLight = false;
      else {
        const hour = new Date().getHours();
        isLight = hour >= 6 && hour < 18; 
      }
      if (isLight) document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
      
      const btn = document.getElementById('theme-toggle-btn');
      if (btn) {
        if (currentThemeMode === 'auto') btn.innerText = '\u81EA\u52A8';
        else if (currentThemeMode === 'light') btn.innerText = '\u4EAE\u8272';
        else btn.innerText = '\u6697\u8272';
      }
    }

    function toggleTheme() {
      if (currentThemeMode === 'auto') currentThemeMode = 'light';
      else if (currentThemeMode === 'light') currentThemeMode = 'dark';
      else currentThemeMode = 'auto';
      localStorage.setItem('themeMode', currentThemeMode);
      applyTheme();
    }
    applyTheme();
    setInterval(applyTheme, 60000); 
    setInterval(function() { if (todos.some(function(t){ return !t.done && t.end_time && t.time && t.date; })) renderTodos(); }, 60000);

    let currentDate = new Date();
    let todos =[];
    let currentDetailIndex = -1;
    let isEditMode = false;
    let pendingAction = null; 
    let filterMethod = 'all'; 
    let filterCategoryId = '';
    
    let tempSubtasks =[];
    let tempSearchTerms =[];
    let addSearchState = false;
    let tempSearchProvider = 'auto';

    let tempPriority = 'low'; 
    let tempTime = ''; 
    let tempEndTime = '';
    let tempRepeatType = 'none';
    let tempRepeatEnd = '';
    let tempAddDate = '';
    let tempEditDate = '';
    let tempCategoryId = '';
    let categoriesList = [];
    let categoriesMap = new Map();
    let categoriesNameMap = new Map();
    function rebuildCategoriesMap() {
      categoriesMap.clear();
      categoriesNameMap.clear();
      for (var i = 0; i < categoriesList.length; i++) {
        categoriesMap.set(categoriesList[i].id, categoriesList[i]);
        categoriesNameMap.set(categoriesList[i].name.toLowerCase(), categoriesList[i]);
      }
    }
    let calendarMode = 'navigate';
    
    let activeMode = ''; 
    let calDate = new Date(); 
    let calMode = 'date'; 
    let yearPickerStart = new Date().getFullYear() - 4;

    let isBatchMode = false;
    let selectedTasks = new Set();
    
    let trashTodos =[];
    let isTrashBatchMode = false;
    let selectedTrashTasks = new Set();

    let sortMethod = 'time'; 
    let sortAsc = true; 
    let appSettings = {};
    let tempSetProvider = 'auto';
    let tempSetSort = 'time';
    let tempSetSortAsc = true;
    let customCodeEnabled = false;
    
    let sessionsList = [];
    
    var CURRENT_VERSION = 'v\${APP_VERSION}';
    var LOCAL_CHANGELOG = \${CHANGELOG_JSON};
    var remoteUpdateInfo = null;
    
    function initVersionDisplay() {
      var el = document.getElementById('app-version-display');
      if (el) {
        el.textContent = CURRENT_VERSION;
        el.style.cursor = 'pointer';
        el.onclick = function() { openChangelogModal(); };
      }
    }
    
    async function checkUpdate() {
      var s = document.getElementById('update-status');
      if (!s) return;
      s.innerHTML = '<span style="color:#888;font-size:0.8rem;">\u68C0\u67E5\u4E2D...</span>';
      try {
        var res = await fetch('https://raw.githubusercontent.com/moaradc/cf-todo/main/version.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var d = await res.json();
        if (!d.version) throw new Error('No version');
    
        var latest = d.version;
        var cmp = compareVersions(CURRENT_VERSION, latest);
    
        if (cmp < 0) {
          var remoteChangelog = (d.changelog && Array.isArray(d.changelog))
            ? d.changelog
            : [{ version: latest, date: d.date || '', notes: d.notes || '' }];
          remoteUpdateInfo = { version: latest, changelog: remoteChangelog };
          s.innerHTML = '<span style="font-size:0.8rem;font-weight:bold;cursor:pointer;color:var(--accent);" onclick="openChangelogModal()">\u2192 v' + escapeHtml(latest) + '</span>';
        } else {
          remoteUpdateInfo = null;
          s.innerHTML = '<span style="font-size:0.8rem;">\u5DF2\u662F\u6700\u65B0</span>';
        }
      } catch (e) {
        remoteUpdateInfo = null;
        s.innerHTML = '<span style="color:var(--accent);font-size:0.8rem;">\u68C0\u67E5\u5931\u8D25</span>';
      }
    }
    
    function compareVersions(v1, v2) {
      var s1 = v1.replace(/^v/, '').split('.');
      var s2 = v2.replace(/^v/, '').split('.');
      var len = Math.max(s1.length, s2.length);
      for (var i = 0; i < len; i++) {
        var n1 = parseInt(s1[i], 10) || 0;
        var n2 = parseInt(s2[i], 10) || 0;
        if (n1 < n2) return -1;
        if (n1 > n2) return 1;
      }
      return 0;
    }

    function escapeHtml(text) {
      var div = document.createElement('div');
      div.appendChild(document.createTextNode(text));
      return div.innerHTML;
    }

    function openChangelogModal() {
      var overlay = document.getElementById('modal-changelog');
      if (!overlay) return;
      var body = document.getElementById('changelog-body');
      if (!body) return;
      var html = '';
      var latestRemote = null;
      var olderRemote = [];
      if (remoteUpdateInfo && remoteUpdateInfo.changelog) {
        for (var i = 0; i < remoteUpdateInfo.changelog.length; i++) {
          var entry = remoteUpdateInfo.changelog[i];
          if (compareVersions(CURRENT_VERSION, 'v' + entry.version) >= 0) continue;
          if (!latestRemote) {
            latestRemote = entry;
          } else {
            olderRemote.push(entry);
          }
        }
      }
      if (latestRemote) {
        html += '<div class="changelog-entry changelog-new">';
        html += '<div class="changelog-version">v' + escapeHtml(latestRemote.version) + ' <span style="font-size:0.7rem;color:var(--accent);">\u65B0\u7248\u672C\u53EF\u7528</span></div>';
        if (latestRemote.date) html += '<div class="changelog-date">' + escapeHtml(latestRemote.date) + '</div>';
        if (latestRemote.notes) html += '<div class="changelog-notes">' + parseMarkdown(latestRemote.notes) + '</div>';
        html += '</div>';
      }
      var hasHistory = olderRemote.length > 0 || (LOCAL_CHANGELOG && LOCAL_CHANGELOG.length > 0);
      if (hasHistory) {
        html += '<div class="changelog-section-title">\u5386\u53F2\u66F4\u65B0</div>';
        for (var k = 0; k < olderRemote.length; k++) {
          var r = olderRemote[k];
          html += '<div class="changelog-entry">';
          html += '<div class="changelog-version">v' + escapeHtml(r.version) + '</div>';
          if (r.date) html += '<div class="changelog-date">' + escapeHtml(r.date) + '</div>';
          if (r.notes) html += '<div class="changelog-notes">' + parseMarkdown(r.notes) + '</div>';
          html += '</div>';
        }
        if (LOCAL_CHANGELOG) {
          for (var j = 0; j < LOCAL_CHANGELOG.length; j++) {
            var e = LOCAL_CHANGELOG[j];
            html += '<div class="changelog-entry">';
            html += '<div class="changelog-version">v' + escapeHtml(e.version) + (j === 0 ? ' <span style="font-size:0.7rem;color:#666;">\u5F53\u524D\u7248\u672C</span>' : '') + '</div>';
            if (e.date) html += '<div class="changelog-date">' + escapeHtml(e.date) + '</div>';
            if (e.notes) html += '<div class="changelog-notes">' + parseMarkdown(e.notes) + '</div>';
            html += '</div>';
          }
        }
      }
      if (!html) html = '<div style="text-align:center;color:#888;padding:20px;">\u6682\u65E0\u66F4\u65B0\u65E5\u5FD7</div>';
      body.innerHTML = html;
      overlay.classList.add('active');
    }

    function closeChangelogModal() {
      var overlay = document.getElementById('modal-changelog');
      if (overlay) overlay.classList.remove('active');
    }

    async function loadSessions() {
      try {
        const res = await fetch('/api/sessions');
        if (res.ok) {
          sessionsList = await res.json();
          renderSessions();
        }
      } catch(e) { console.error('Load sessions error:', e); }
    }

    function renderSessions() {
      const container = document.getElementById('sessions-list');
      if (!container) return;
      if (sessionsList.length === 0) {
        container.innerHTML = '<div class="settings-text" style="text-align:center; padding: 10px;">\u6682\u65E0\u6D3B\u8DC3\u4F1A\u8BDD</div>';
        return;
      }
      container.innerHTML = sessionsList.map(function(s, i) {
        var actions = '';
        if (s.isCurrent) {
          actions += '<span style="font-size:0.7rem;color:#666;">\u5F53\u524D\u4F1A\u8BDD</span>';
        } else {
          actions += '<button class="btn-danger" onclick="deleteSessionByIndex(' + i + ')">\u5220\u9664</button>';
        }
        return '<div class="session-item' + (s.isCurrent ? ' current-session' : '') + '">' +
          '<div class="session-ua">' + escapeHtml(s.ua) + '</div>' +
          '<div class="session-actions">' + actions + '</div>' +
        '</div>';
      }).join('');
    }

    async function deleteSessionByIndex(index) {
      var s = sessionsList[index];
      if (!s || s.isCurrent) return;
      if (!confirm('\u786E\u8BA4\u5220\u9664\u8BE5\u4F1A\u8BDD\uFF1F\u5220\u9664\u540E\u9700\u8981\u91CD\u65B0\u767B\u5F55\u3002')) return;
      await fetch('/api/session-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'DELETE', ua: s.ua }),
        headers: { 'Content-Type': 'application/json' }
      });
      loadSessions();
    }

    async function deleteAllSessions() {
      if (!confirm('\u786E\u8BA4\u5220\u9664\u5168\u90E8\u4F1A\u8BDD\uFF1F\u5220\u9664\u540E\u9700\u8981\u91CD\u65B0\u767B\u5F55\u3002')) return;
      await fetch('/api/session-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'DELETE_ALL' }),
        headers: { 'Content-Type': 'application/json' }
      });
      location.reload();
    }

    // ==================== API Key \u7BA1\u7406 ====================

    let apiKeysList = [];

    async function loadApiKeys() {
      try {
        const res = await fetch('/api/v1/keys');
        if (res.ok) {
          apiKeysList = await res.json();
          renderApiKeys();
        }
      } catch(e) { console.error('Load API keys error:', e); }
    }

    function renderApiKeys() {
      const container = document.getElementById('apikeys-list');
      if (!container) return;
      if (apiKeysList.length === 0) {
        container.innerHTML = '<div class="settings-text" style="text-align:center; padding: 10px;">\u6682\u65E0 API \u5BC6\u94A5</div>';
        return;
      }
      container.innerHTML = apiKeysList.map(function(k, i) {
        var statusTag = k.disabled ? '<span class="apikey-status disabled">\u5DF2\u7981\u7528</span>' : '<span class="apikey-status">\u6D3B\u8DC3</span>';
        var lastUsed = k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '\u4ECE\u672A\u4F7F\u7528';
        return '<div class="session-item' + (k.disabled ? '' : '') + '">' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">' +
              '<span style="font-weight:bold;font-size:0.85rem;">' + escapeHtml(k.name || '\u672A\u547D\u540D') + '</span>' +
              statusTag +
            '</div>' +
            '<div style="font-size:0.75rem;color:#666;margin-top:3px;font-family:monospace;">' + escapeHtml(k.keyPrefix) + '</div>' +
            '<div style="font-size:0.7rem;color:#555;margin-top:2px;">\u6700\u540E\u4F7F\u7528: ' + lastUsed + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:4px;flex-shrink:0;">' +
            '<button style="padding:4px 8px;font-size:0.75rem;" onclick="toggleApiKey(' + i + ')">' + (k.disabled ? '\u542F\u7528' : '\u7981\u7528') + '</button>' +
            '<button class="btn-danger" style="padding:4px 8px;font-size:0.75rem;" onclick="deleteApiKey(' + i + ')">\u5220\u9664</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    async function createApiKey() {
      var nameInput = document.getElementById('apikey-name-input');
      var name = nameInput ? nameInput.value.trim() : '';
      try {
        const res = await fetch('/api/v1/keys', {
          method: 'POST',
          body: JSON.stringify({ action: 'CREATE', name: name || 'Default' }),
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.key) {
            var createdBox = document.getElementById('apikey-created-box');
            var createdValue = document.getElementById('apikey-created-value');
            if (createdBox && createdValue) {
              createdValue.value = data.key;
              createdBox.style.display = 'block';
            }
            if (nameInput) nameInput.value = '';
            await loadApiKeys();
          } else {
            alert(data.error || '\u521B\u5EFA\u5931\u8D25');
          }
        } else {
          const err = await res.json();
          alert(err.error || '\u521B\u5EFA\u5931\u8D25');
        }
      } catch(e) {
        alert('\u521B\u5EFA\u5931\u8D25: ' + e.message);
      }
    }

    async function deleteApiKey(index) {
      var k = apiKeysList[index];
      if (!k) return;
      if (!confirm('\u786E\u8BA4\u5220\u9664\u5BC6\u94A5 "' + (k.name || '\u672A\u547D\u540D') + '"\uFF1F\u5220\u9664\u540E\u4F7F\u7528\u6B64\u5BC6\u94A5\u7684\u7A0B\u5E8F\u5C06\u65E0\u6CD5\u8BBF\u95EE\u3002')) return;
      try {
        await fetch('/api/v1/keys', {
          method: 'POST',
          body: JSON.stringify({ action: 'DELETE', id: k.id }),
          headers: { 'Content-Type': 'application/json' }
        });
        await loadApiKeys();
      } catch(e) {
        alert('\u5220\u9664\u5931\u8D25: ' + e.message);
      }
    }

    async function toggleApiKey(index) {
      var k = apiKeysList[index];
      if (!k) return;
      try {
        await fetch('/api/v1/keys', {
          method: 'POST',
          body: JSON.stringify({ action: 'TOGGLE', id: k.id }),
          headers: { 'Content-Type': 'application/json' }
        });
        await loadApiKeys();
      } catch(e) {
        alert('\u64CD\u4F5C\u5931\u8D25: ' + e.message);
      }
    }
    
    let tempAppScale = 1.0;

    function applyAppScale(scale) {
      document.documentElement.style.setProperty('--app-scale', scale);
    }

    function onScaleSliderChange(val) {
      tempAppScale = parseFloat(val);
      document.getElementById('scale-value-display').innerText = Math.round(tempAppScale * 100) + '%';
      var preview = document.getElementById('scale-preview');
      if (preview) preview.style.zoom = tempAppScale;
      updateScalePresetButtons();
    }

    function setScalePreset(val) {
      tempAppScale = val;
      document.getElementById('scale-slider').value = val;
      document.getElementById('scale-value-display').innerText = Math.round(val * 100) + '%';
      var preview = document.getElementById('scale-preview');
      if (preview) preview.style.zoom = tempAppScale;
      updateScalePresetButtons();
    }

    function updateScalePresetButtons() {
      var btns = document.querySelectorAll('.scale-preset-btn');
      var presets = [0.85, 1.0, 1.15];
      btns.forEach(function(btn, i) {
        if (Math.abs(tempAppScale - presets[i]) < 0.02) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    function createTodoElement(todo, index) {
      var el = document.createElement('div');
      el.className = 'todo-item ' + (todo.done ? 'done' : '') + (todo.priority === 'high' ? ' pri-high' : todo.priority === 'med' ? ' pri-med' : ' pri-low');

      var badges = '';
      if (todo.time) {
        var timeLabel = todo.time;
        if (todo.end_time) timeLabel += '-' + todo.end_time;
        badges += '<span class="badge badge-time">' + timeLabel + '</span> ';
      }

      if (!todo.done && todo.end_time && todo.time && todo.date) {
        var now = new Date();
        var dateStr = todo.date;
        var endMs = new Date(dateStr + 'T' + todo.end_time + ':00').getTime();
        var startMs = new Date(dateStr + 'T' + todo.time + ':00').getTime();
        var nowMs = now.getTime();
        if (nowMs > endMs) {
          badges += '<span class="badge badge-overdue">\u5DF2\u903E\u671F</span> ';
        } else if (endMs - nowMs <= 30 * 60 * 1000 && nowMs >= startMs) {
          var remainMin = Math.ceil((endMs - nowMs) / 60000);
          badges += '<span class="badge badge-warning">\u5269\u4F59' + remainMin + '\u5206\u949F</span> ';
        }
      }

      if (todo.repeat_type && todo.repeat_type !== 'none') {
        var repeatLabel = '';
        if (todo.repeat_type === 'daily') {
          repeatLabel = '\u6BCF\u5929';
        } else if (todo.repeat_type === 'weekly') {
          var days = ['\u65E5','\u4E00','\u4E8C','\u4E09','\u56DB','\u4E94','\u516D'];
          var parts = todo.date.split('-');
          var day = new Date(parts[0], parts[1]-1, parts[2]).getDay();
          repeatLabel = '\u6BCF\u5468' + days[day];
        } else if (todo.repeat_type === 'monthly') {
          var parts2 = todo.date.split('-');
          repeatLabel = '\u6BCF\u6708' + parseInt(parts2[2], 10) + '\u53F7';
        } else if (todo.repeat_type === 'yearly') {
          var parts3 = todo.date.split('-');
          repeatLabel = '\u6BCF\u5E74' + parseInt(parts3[1], 10) + '\u6708' + parseInt(parts3[2], 10) + '\u65E5';
        }
        if (todo.repeat_end) repeatLabel += '\xB7\u81F3' + todo.repeat_end;
        badges += '<span class="badge" style="background:transparent;border:1px solid var(--fg);color:var(--fg);">' + repeatLabel + '</span> ';
      }

      if (todo.subtasks && todo.subtasks.length > 0) {
        var completed = todo.subtasks.filter(function(st){ return st.done; }).length;
        badges += '<span class="badge" style="background:transparent;border:1px solid var(--fg);color:var(--fg);">' + completed + '/' + todo.subtasks.length + '</span> ';
      }



      var meta = document.createElement('div');
      meta.className = 'item-meta';
      meta.innerHTML = '<div class="item-title">' + todo.text + '</div><div class="item-info">' + badges + '</div>';

      var checkbox = document.createElement('div');
      checkbox.className = 'checkbox' + (isBatchMode && selectedTasks.has(index) ? ' batch-selected' : '');
      checkbox.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isBatchMode) toggleBatchSelect(index);
        else toggleDone(index);
      });

      el.appendChild(checkbox);
      el.appendChild(meta);

      if (!isBatchMode) {
        if (todo.url) {
          var linkBtn = document.createElement('a');
          linkBtn.href = todo.url;
          linkBtn.target = '_blank';
          linkBtn.className = 'btn-link';
          linkBtn.innerText = '\u2197';
          linkBtn.addEventListener('click', function(e){ e.stopPropagation(); });
          el.appendChild(linkBtn);
        }
        if (todo.copy_text) {
          var copyBtn = document.createElement('button');
          copyBtn.className = 'btn-link';
          copyBtn.innerText = '\u2398';
          var textToCopy = todo.copy_text;
          copyBtn.addEventListener('click', function(e){
            e.stopPropagation();
            copyText(textToCopy);
          });
          el.appendChild(copyBtn);
        }
      }

      el.addEventListener('click', function() {
        if (isBatchMode) toggleBatchSelect(index);
        else openDetail(index);
      });

      return el;
    }
    
    function hideAndRescuePopovers() {
      document.querySelectorAll('.popover-menu').forEach(p => {
        p.style.display = 'none';
        document.body.appendChild(p);
      });
    }
    
    async function toggleCustomCodeEnabled() {
        customCodeEnabled = !customCodeEnabled;
        document.getElementById('custom-code-enabled-box').classList.toggle('checked', customCodeEnabled);
        updateCustomCodeUI();
        
        const headerEl = document.getElementById('custom-header-preview');
        const contentEl = document.getElementById('custom-content-preview');
        
        if (customCodeEnabled) {
            if (!window.__CUSTOM_HEADER__ && !window.__CUSTOM_CONTENT__) {
                try {
                    const res = await fetch('/api/custom-code');
                    if (res.ok) {
                        const data = await res.json();
                        if (headerEl) headerEl.value = data.customHeader || '';
                        if (contentEl) contentEl.value = data.customContent || '';
                        window.__CUSTOM_HEADER__ = data.customHeader || '';
                        window.__CUSTOM_CONTENT__ = data.customContent || '';
                    }
                } catch(e) {
                    if (headerEl) headerEl.value = '';
                    if (contentEl) contentEl.value = '';
                }
            } else {
                if (headerEl) headerEl.value = window.__CUSTOM_HEADER__ || '';
                if (contentEl) contentEl.value = window.__CUSTOM_CONTENT__ || '';
            }
        } else {
            if (headerEl) headerEl.value = '';
            if (contentEl) contentEl.value = '';
        }
    }
    
    function updateCustomCodeUI() {
        var headerEl = document.getElementById('custom-header-preview');
        var contentEl = document.getElementById('custom-content-preview');
        var actionRow = document.getElementById('custom-action-row');
        if (headerEl) headerEl.disabled = !customCodeEnabled;
        if (contentEl) contentEl.disabled = !customCodeEnabled;
        if (actionRow) actionRow.style.display = customCodeEnabled ? 'flex' : 'none';
    }
    
    let chartInstanceBar = null;
    let chartInstancePri = null;
    let chartInstanceStat = null;
    let currentStatsTab = 'weekly';
    let annualYear = null;

    function getScaleForUA(arr, ua) {
      if (!Array.isArray(arr)) return 1.0;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].ua === ua) return parseFloat(arr[i].scale) || 1.0;
      }
      return 1.0;
    }

    function setScaleForUA(ua, scale) {
      if (!Array.isArray(appSettings.scaleByBrowser)) return;
      for (var i = 0; i < appSettings.scaleByBrowser.length; i++) {
        if (appSettings.scaleByBrowser[i].ua === ua) {
          appSettings.scaleByBrowser[i].scale = scale;
          return;
        }
      }
    }

    async function initSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const saved = await res.json();
          var currentUA = navigator.userAgent || '';
          var scaleByBrowser = Array.isArray(saved.scaleByBrowser) ? saved.scaleByBrowser : [];
          var matchedScale = getScaleForUA(scaleByBrowser, currentUA);
          appSettings = {
            provider: saved.provider || 'auto',
            sortMethod: saved.sortMethod || 'time',
            sortAsc: saved.sortAsc !== undefined ? (saved.sortAsc === 'true' || saved.sortAsc === true) : true,
            customCodeEnabled: saved.customCodeEnabled !== undefined ? (saved.customCodeEnabled === 'true' || saved.customCodeEnabled === true) : false,
            scaleByBrowser: scaleByBrowser
          };
          tempAppScale = matchedScale;
        } else {
          throw new Error('Failed to load DB settings');
        }
      } catch (e) {
        appSettings = { provider: 'auto', sortMethod: 'time', sortAsc: true, customCodeEnabled: false, scaleByBrowser: [] };
        tempAppScale = 1.0;
      }
      
      sortMethod = appSettings.sortMethod;
      sortAsc = appSettings.sortAsc;
      tempSearchProvider = appSettings.provider;

      updateViewBtnLabel();
      applyAppScale(tempAppScale);
      loadCategories();
      loadCustomColors();
    }

    async function login() {
      const pwd = document.getElementById('password-input').value;
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          body: JSON.stringify({ password: pwd }),
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) { location.reload(); } 
        else if (res.status === 429) { alert("\u8FDE\u7EED\u5C1D\u8BD5\u9519\u8BEF\u6B21\u6570\u8FC7\u591A\uFF0CIP\u5DF2\u88AB\u9501\u5B9A\uFF0C\u8BF7 15 \u5206\u949F\u540E\u518D\u8BD5\uFF01"); } 
        else { alert("\u5BC6\u94A5\u9A8C\u8BC1\u5931\u8D25 / \u8BBF\u95EE\u88AB\u62D2\u7EDD"); }
      } catch (e) { alert("\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25"); }
    }
`;

// src/html/js/todos.js
var todos = `
    function copyText(text) {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(err => fallbackCopyTextToClipboard(text));
      } else { fallbackCopyTextToClipboard(text); }
    }

    function fallbackCopyTextToClipboard(text) {
      var textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0"; textArea.style.left = "0";
      textArea.style.position = "fixed"; textArea.readOnly = true;
      document.body.appendChild(textArea);
      textArea.focus(); textArea.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(textArea);
    }

    function formatDate(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + d;
    }
    
    function updateDateHeader(isLoading = false) {
      const str = formatDate(currentDate);
      const todayStr = formatDate(new Date());
      let prefix = "";
      if (str === todayStr) {
        prefix = "\u4ECA\u65E5\u4E8B\u9879";
      } else if (str < todayStr) {
        prefix = "\u5386\u53F2\u5F52\u6863";
      } else {
        prefix = "\u672A\u6765\u8BA1\u5212";
      }
      
      let subText = "";
      if (isLoading) {
        subText = \`[ \${prefix} | \u62C9\u53D6\u4E2D... ]\`;
      } else {
        const total = todos.length;
        const done = todos.filter(t => t.done).length;
        subText = \`[ \${prefix} | \u8FDB\u5EA6: \${done}/\${total} ]\`;
      }

      document.getElementById('date-main').innerText = str;
      document.getElementById('date-sub').innerText = subText;
    }

    async function loadTodos() {
      const dateStr = formatDate(currentDate);
      updateDateHeader(true);
      document.getElementById('todo-list').innerHTML = '<div style="padding:20px;text-align:center;">\u6570\u636E\u62C9\u53D6\u4E2D...</div>';
      try {
        const res = await fetch(\`/api/todos?date=\${dateStr}\`);
        if (res.ok) {
          todos = await res.json();
          renderTodos();
        }
      } catch (e) { console.error(e); }
    }

    function updateViewBtnLabel() {
      var fMap = { 'all': '\u5168\u90E8', 'todo': '\u672A\u5B8C\u6210', 'done': '\u5DF2\u5B8C\u6210' };
      var sMap = { 'time': '\u65F6\u95F4', 'priority': '\u4F18\u5148\u7EA7' };
      var catLabel = filterCategoryId ? getCategoryName(filterCategoryId) : '\u5168\u90E8\u5206\u7C7B';
      var el;
      el = document.getElementById('view-tag-filter');
      if (el) el.textContent = fMap[filterMethod];
      el = document.getElementById('view-tag-category');
      if (el) el.textContent = catLabel;
      el = document.getElementById('view-tag-sort');
      if (el) el.textContent = sMap[sortMethod] + '\xB7' + (sortAsc ? '\u6B63\u5E8F' : '\u5012\u5E8F');
    }

    function renderViewCategoryBtns() {
      var container = document.getElementById('view-category-btns');
      if (!container) return;
      container.innerHTML = '';
      var allBtn = document.createElement('div');
      allBtn.className = 'category-modal-item' + (!filterCategoryId ? ' selected' : '');
      allBtn.innerHTML = '<span class="cat-name">\u5168\u90E8</span>';
      allBtn.onclick = function() { setViewCategory(''); };
      container.appendChild(allBtn);
      for (var i = 0; i < categoriesList.length; i++) {
        var cat = categoriesList[i];
        var btn = document.createElement('div');
        btn.className = 'category-modal-item' + (filterCategoryId === cat.id ? ' selected' : '');
        btn.innerHTML = '<span class="badge-category-icon" style="background:' + (cat.color || CATEGORY_COLOR_PRESETS[0]) + '"></span><span class="cat-name">' + escapeHtml(cat.name) + '</span>';
        btn.onclick = (function(cid) { return function() { setViewCategory(cid); }; })(cat.id);
        container.appendChild(btn);
      }
    }

    function activateBtnGroup(containerId, val) {
      var btns = document.getElementById(containerId);
      if (!btns) return;
      var children = btns.children;
      for (var i = 0; i < children.length; i++) {
        children[i].classList.toggle('selected', children[i].getAttribute('data-val') === val);
      }
    }

    function openViewModal() {
      if (isBatchMode) return;
      activateBtnGroup('view-filter-btns', filterMethod);
      renderViewCategoryBtns();
      activateBtnGroup('view-sort-btns', sortMethod);
      activateBtnGroup('view-order-btns', sortAsc ? 'asc' : 'desc');
      document.getElementById('modal-view').classList.add('active');
    }

    function closeViewModal() {
      document.getElementById('modal-view').classList.remove('active');
    }

    function setViewFilter(method) {
      filterMethod = method;
      activateBtnGroup('view-filter-btns', method);
      updateViewBtnLabel();
      renderTodos();
    }

    function setViewCategory(catId) {
      filterCategoryId = catId || '';
      renderViewCategoryBtns();
      updateViewBtnLabel();
      renderTodos();
    }

    function setViewSort(method) {
      sortMethod = method;
      if (method === 'priority') sortAsc = false; else sortAsc = true;
      activateBtnGroup('view-sort-btns', method);
      activateBtnGroup('view-order-btns', sortAsc ? 'asc' : 'desc');
      updateViewBtnLabel();
      renderTodos();
    }

    function setViewOrder(asc) {
      sortAsc = asc;
      activateBtnGroup('view-order-btns', asc ? 'asc' : 'desc');
      updateViewBtnLabel();
      renderTodos();
    }

    function renderTodos() {
      updateDateHeader(false);

      var filteredTodos = todos;
      if (filterMethod === 'todo') filteredTodos = todos.filter(function(t){ return !t.done; });
      else if (filterMethod === 'done') filteredTodos = todos.filter(function(t){ return t.done; });
      if (filterCategoryId) filteredTodos = filteredTodos.filter(function(t){ return t.category_id === filterCategoryId; });

      var listEl = document.getElementById('todo-list');

      if (filteredTodos.length === 0) {
        listEl.innerHTML = '<div style="padding:40px;text-align:center;border:1px dashed #666;">\u65E0\u6570\u636E // NULL</div>';
        return;
      }

      filteredTodos.sort(function(a, b) {
        if (a.done !== b.done) return a.done ? 1 : -1;
        var valA, valB;
        if (sortMethod === 'time') { valA = a.time || '24:00'; valB = b.time || '24:00'; }
        else { var pMap = { high: 3, med: 2, low: 1 }; valA = pMap[a.priority] || 1; valB = pMap[b.priority] || 1; }
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });

      var frag = document.createDocumentFragment();
      for (var i = 0; i < filteredTodos.length; i++) {
        var todo = filteredTodos[i];
        var idx = todos.indexOf(todo);
        frag.appendChild(createTodoElement(todo, idx));
      }
      listEl.innerHTML = '';
      listEl.appendChild(frag);
    }

    async function toggleDone(index) {
      todos[index].done = !todos[index].done;
      await fetch('/api/todo-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'TOGGLE_DONE', task: { id: todos[index].id, done: todos[index].done } }),
        headers: { 'Content-Type': 'application/json' }
      });
      renderTodos(); 
    }

    async function toggleSubtask(taskIndex, subIndex) {
      const task = todos[taskIndex];
      task.subtasks[subIndex].done = !task.subtasks[subIndex].done;
      renderDetailContent(); 
      await fetch('/api/todo-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'UPDATE_SUBTASKS', task: { id: task.id, subtasks: task.subtasks } }),
        headers: { 'Content-Type': 'application/json' }
      });
      renderTodos();
    }

    function toggleBatchMode() {
      if (isBatchMode) {
        exitBatchMode();
      } else {
        isBatchMode = true;
        selectedTasks.clear();
        const bar = document.getElementById('batch-bar');
        bar.classList.remove('hidden', 'closing');
        document.querySelector('.fab').classList.add('hidden');
        document.getElementById('btn-batch-mode').classList.add('active');
        renderTodos();
      }
    }

    function exitBatchMode() {
      if (!isBatchMode) return;
      isBatchMode = false; selectedTasks.clear();
      const bar = document.getElementById('batch-bar');
      bar.classList.add('closing');
      bar.addEventListener('animationend', function handler() {
        bar.classList.add('hidden');
        bar.classList.remove('closing');
        bar.removeEventListener('animationend', handler);
      });
      document.querySelector('.fab').classList.remove('hidden');
      document.getElementById('btn-batch-mode').classList.remove('active');
      renderTodos();
    }

    function toggleBatchSelect(index) {
      if (selectedTasks.has(index)) selectedTasks.delete(index);
      else selectedTasks.add(index);
      renderTodos();
    }

    function batchSelectAll() {
      let filteredTodos = todos;
      if (filterMethod === 'todo') filteredTodos = todos.filter(t => !t.done);
      else if (filterMethod === 'done') filteredTodos = todos.filter(t => t.done);
      if (filterCategoryId) filteredTodos = filteredTodos.filter(t => t.category_id === filterCategoryId);

      const visibleIndices = filteredTodos.map(t => todos.indexOf(t));
      const allSelected = visibleIndices.length > 0 && visibleIndices.every(idx => selectedTasks.has(idx));

      if (allSelected) {
        visibleIndices.forEach(idx => selectedTasks.delete(idx));
      } else {
        visibleIndices.forEach(idx => selectedTasks.add(idx));
      }
      renderTodos();
    }

    async function batchToggleDone() {
      if (selectedTasks.size === 0) return;
      const allDone = Array.from(selectedTasks).every(idx => todos[idx].done);
      const targetDone = !allDone;
      const ids = Array.from(selectedTasks).map(idx => todos[idx].id);

      Array.from(selectedTasks).forEach(idx => todos[idx].done = targetDone);
      renderTodos();

      await fetch('/api/todo-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'BATCH_TOGGLE_DONE', ids: ids, doneStatus: targetDone }),
        headers: { 'Content-Type': 'application/json' }
      });
      exitBatchMode();
    }

    async function batchDelete() {
      if (selectedTasks.size === 0) return;
      if (!confirm(\`\u786E\u8BA4\u5220\u9664\u9009\u4E2D\u7684 \${selectedTasks.size} \u4E2A\u4E8B\u9879\u5417\uFF1F(\u4EC5\u5220\u9664\u5F53\u5929\u7684\u5F53\u524D\u9879)\`)) return;
      const ids = Array.from(selectedTasks).map(idx => todos[idx].id);
      await fetch('/api/todo-action', {
        method: 'POST', body: JSON.stringify({ action: 'BATCH_DELETE', ids: ids }),
        headers: { 'Content-Type': 'application/json' }
      });
      exitBatchMode(); loadTodos();
    }
`;

// src/html/js/settings.js
var settings = `
    function openSettings() {
      tempSetProvider = appSettings.provider || 'auto';
      tempSetSort = appSettings.sortMethod || 'time';
      tempSetSortAsc = appSettings.sortAsc !== undefined ? appSettings.sortAsc : true;
      
      customCodeEnabled = appSettings.customCodeEnabled === true;
      
      var currentUA = navigator.userAgent || '';
      tempAppScale = getScaleForUA(appSettings.scaleByBrowser, currentUA);
      
      var scaleSlider = document.getElementById('scale-slider');
      var scaleDisplay = document.getElementById('scale-value-display');
      var scalePreview = document.getElementById('scale-preview');
      if (scaleSlider) scaleSlider.value = tempAppScale;
      if (scaleDisplay) scaleDisplay.innerText = Math.round(tempAppScale * 100) + '%';
      if (scalePreview) scalePreview.style.zoom = tempAppScale;
      updateScalePresetButtons();
      
      document.getElementById('custom-code-enabled-box').classList.toggle('checked', customCodeEnabled);
      updateCustomCodeUI();
    
      const pMap = {'auto':'\u81EA\u52A8 (\u968F\u673A\u6E90)', 'bilibili':'\u54D4\u54E9\u54D4\u54E9', 'weibo':'\u5FAE\u535A\u70ED\u641C', 'zhihu':'\u77E5\u4E4E\u70ED\u699C', 'baidu':'\u767E\u5EA6\u70ED\u641C'};
      const sMap = {'time':'\u6309\u65F6\u95F4', 'priority':'\u6309\u4F18\u5148\u7EA7'};
      
      document.getElementById('set-disp-provider').innerText = pMap[tempSetProvider];
      document.getElementById('set-disp-sort').innerText = sMap[tempSetSort];
      document.getElementById('set-disp-sort-asc').innerText = tempSetSortAsc ? '\u6B63\u5E8F' : '\u5012\u5E8F';
    
      const headerEl = document.getElementById('custom-header-preview');
      const contentEl = document.getElementById('custom-content-preview');
      var _ph = localStorage.getItem('preview_custom_header');
      var _pc = localStorage.getItem('preview_custom_content');
      var _hasPreview = _ph !== null || _pc !== null;
      
      if (_hasPreview) {
        if (headerEl) headerEl.value = _ph !== null ? _ph : '';
        if (contentEl) contentEl.value = _pc !== null ? _pc : '';
      } else if (customCodeEnabled) {
        if (headerEl) headerEl.value = window.__CUSTOM_HEADER__ || '';
        if (contentEl) contentEl.value = window.__CUSTOM_CONTENT__ || '';
      } else {
        if (headerEl) headerEl.value = '';
        if (contentEl) contentEl.value = '';
      }
      
      var _rcBtn = document.getElementById('restore-custom-btn');
      if (_rcBtn) _rcBtn.style.display = _hasPreview ? '' : 'none';
    
      const view = document.getElementById('settings-overlay');
      view.classList.remove('closing');
      view.classList.add('active');
      var createdBox = document.getElementById('apikey-created-box');
      if (createdBox) createdBox.style.display = 'none';
      loadSessions();
      loadApiKeys();
      checkUpdate();
    }

    function closeSettings() {
      const view = document.getElementById('settings-overlay');
      view.classList.add('closing');
      view.addEventListener('animationend', function handler() {
        view.classList.remove('active'); 
        view.classList.remove('closing'); 
        view.removeEventListener('animationend', handler);
      });
    }

    function showPopover(popoverId, triggerEl, checkTriggerChildren) {
      const popover = document.getElementById(popoverId);
      triggerEl.parentNode.style.position = 'relative';
      triggerEl.parentNode.appendChild(popover);
      popover.style.display = 'flex';
      popover.style.top = (triggerEl.offsetTop + triggerEl.offsetHeight + 5) + 'px';
      popover.style.left = triggerEl.offsetLeft + 'px';
      popover.style.right = 'auto';
      const closeHandler = (e) => {
        const outsidePopover = !popover.contains(e.target);
        const isTrigger = e.target === triggerEl;
        const insideTrigger = checkTriggerChildren && triggerEl.contains(e.target);
        if (outsidePopover && !isTrigger && !insideTrigger) {
          popover.style.display = 'none';
          document.removeEventListener('click', closeHandler);
        }
      };
      setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    function toggleSettingPopover(type, triggerEl) {
      showPopover(\`popover-set-\${type}\`, triggerEl, true);
    }

    function selectSetting(type, value, label) {
      if (type === 'provider') { tempSetProvider = value; document.getElementById('set-disp-provider').innerText = label; }
      else if (type === 'sort') { tempSetSort = value; document.getElementById('set-disp-sort').innerText = label; }
      else if (type === 'sortAsc') { tempSetSortAsc = value === 'true'; document.getElementById('set-disp-sort-asc').innerText = label; }
      document.getElementById(\`popover-set-\${type}\`).style.display = 'none';
    }

    async function saveAndCloseSettings() {
      appSettings.provider = tempSetProvider;
      appSettings.sortMethod = tempSetSort;
      appSettings.sortAsc = tempSetSortAsc;
      appSettings.customCodeEnabled = customCodeEnabled;

      var currentUA = navigator.userAgent || '';
      setScaleForUA(currentUA, tempAppScale);
    
      await fetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(appSettings),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (customCodeEnabled) {
        var customHeaderVal = document.getElementById('custom-header-preview') ? document.getElementById('custom-header-preview').value : '';
        var customContentVal = document.getElementById('custom-content-preview') ? document.getElementById('custom-content-preview').value : '';
        await fetch('/api/custom-code', {
          method: 'POST',
          body: JSON.stringify({ customHeader: customHeaderVal, customContent: customContentVal }),
          headers: { 'Content-Type': 'application/json' }
        });
      }
    
      sortMethod = appSettings.sortMethod;
      sortAsc = appSettings.sortAsc;
      tempSearchProvider = appSettings.provider;
    
      updateViewBtnLabel();
      
      renderTodos();
      restoreAllPreview()
      location.reload();
    }
    
    function previewCustomCode() {
      var headerContent = document.getElementById('custom-header-preview').value;
      var contentContent = document.getElementById('custom-content-preview').value;
      localStorage.setItem('preview_custom_header', headerContent);
      localStorage.setItem('preview_custom_content', contentContent);
      window.location.href = window.location.pathname + '?preview=1';
    }
    
    async function resetCustomCode() {
      if (!confirm('\u786E\u5B9A\u8981\u91CD\u7F6E\u81EA\u5B9A\u4E49\u4EE3\u7801\u5417\uFF1F\\n\u8FD9\u5C06\u6E05\u7A7A\u6240\u6709\u81EA\u5B9A\u4E49\u5934\u90E8\u548C\u5185\u5BB9\u3002')) return;
      
      window.__CUSTOM_HEADER__ = '';
      window.__CUSTOM_CONTENT__ = '';
      customCodeEnabled = false;
      appSettings.customCodeEnabled = false;
      
      try {
        await fetch('/api/custom-code', {
          method: 'POST',
          body: JSON.stringify({ customHeader: '', customContent: '' }),
          headers: { 'Content-Type': 'application/json' }
        });
        
        await fetch('/api/settings', {
          method: 'POST',
          body: JSON.stringify(appSettings),
          headers: { 'Content-Type': 'application/json' }
        });
      } catch(e) { 
        console.error('Reset custom code error:', e); 
      }
      
      restoreAllPreview()
      location.reload();
    }
    
    function restoreAllPreview() {
      localStorage.removeItem('preview_custom_header');
      localStorage.removeItem('preview_custom_content');
      window.location.href = window.location.pathname;
    }
`;

// src/html/js/io.js
var io = `
    async function exportData() {
      var incTodos = document.getElementById('export-todos').checked;
      var incTrash = document.getElementById('export-trash').checked;
      var incSettings = document.getElementById('export-settings').checked;
      var incCategories = document.getElementById('export-categories').checked;
      var useChunked = document.getElementById('chunked-mode').checked;

      if (!incTodos && !incTrash && !incSettings && !incCategories) return alert('\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u9879\u9700\u8981\u5BFC\u51FA\u7684\u5185\u5BB9\u3002');

      var overlay = document.createElement('div');
      overlay.className = 'io-overlay';
      var box = document.createElement('div');
      box.className = 'io-dialog';
      var titleEl = document.createElement('div');
      titleEl.className = 'io-title';
      var subEl = document.createElement('div');
      subEl.className = 'io-sub';
      var barBg = document.createElement('div');
      barBg.className = 'io-bar-bg';
      var barFill = document.createElement('div');
      barFill.className = 'io-bar-fill';
      barBg.appendChild(barFill); box.appendChild(titleEl); box.appendChild(subEl); box.appendChild(barBg);
      overlay.appendChild(box); document.body.appendChild(overlay);

      var spinChars = ['\\u28FE','\\u28F7','\\u28EF','\\u28DF','\\u287F','\\u28BF','\\u28FB','\\u28FD'];
      var spinIdx = 0; var curTitle = ''; var targetPct = 0; var curPct = 0;
      var spinTimer = setInterval(function() { spinIdx = (spinIdx+1)%8; titleEl.textContent = spinChars[spinIdx]+' '+curTitle; if(curPct<targetPct){curPct=targetPct>=100?targetPct:curPct+Math.max(1,Math.round((targetPct-curPct)*0.1));if(curPct>targetPct)curPct=targetPct;barFill.style.width=Math.min(curPct,100)+'%';} }, 80);
      function showProgress(t,s,p) { curTitle=t; subEl.textContent=s||''; if(p!==undefined) targetPct=Math.min(Math.max(p,0),100); }
      function closeProgress() { clearInterval(spinTimer); if(overlay.parentNode) overlay.parentNode.removeChild(overlay); }
      function showAlert(msg) {
        return new Promise(function(resolve) {
          var ao=document.createElement('div'); ao.className='io-overlay';
          var ab=document.createElement('div'); ab.className='io-dialog';
          var am=document.createElement('div'); am.className='io-msg'; am.textContent=msg;
          var bo=document.createElement('button'); bo.className='io-btn io-btn-primary'; bo.textContent='\u786E\u5B9A';
          ab.appendChild(am); ab.appendChild(bo); ao.appendChild(ab); document.body.appendChild(ao);
          bo.onclick=function(){ if(ao.parentNode) ao.parentNode.removeChild(ao); resolve(); };
        });
      }
      function showConfirm(title, msg, btnYesLabel, btnNoLabel) {
        return new Promise(function(resolve) {
          var co=document.createElement('div'); co.className='io-overlay';
          var cb=document.createElement('div'); cb.className='io-dialog';
          var ct=document.createElement('div'); ct.className='io-title'; ct.textContent=title;
          var cm=document.createElement('div'); cm.className='io-sub'; cm.textContent=msg;
          var br=document.createElement('div'); br.className='io-btn-row';
          var by=document.createElement('button'); by.className='io-btn io-btn-primary'; by.textContent=btnYesLabel||'\u786E\u5B9A';
          var bn=document.createElement('button'); bn.className='io-btn io-btn-secondary'; bn.textContent=btnNoLabel||'\u53D6\u6D88';
          br.appendChild(bn); br.appendChild(by); cb.appendChild(ct); cb.appendChild(cm); cb.appendChild(br); co.appendChild(cb); document.body.appendChild(co);
          by.onclick=function(){ if(co.parentNode) co.parentNode.removeChild(co); resolve(true); };
          bn.onclick=function(){ if(co.parentNode) co.parentNode.removeChild(co); resolve(false); };
        });
      }

      var sessionId = crypto.randomUUID();

      try {
        showProgress('\u521D\u59CB\u5316\u5BFC\u51FA\u4F1A\u8BDD', '\u521B\u5EFA\u4F1A\u8BDD...', 8);
        var sessionRes = await fetch('/api/export?mode=session&action=create&todos=' + incTodos + '&trash=' + incTrash + '&settings=' + incSettings + '&categories=' + incCategories + '&sessionId=' + sessionId);
        if (!sessionRes.ok) {
          if (sessionRes.status === 409) {
            var conflictData = {};
            try { conflictData = await sessionRes.json(); } catch(ee) {}
            var doAbortExport = await showConfirm("\u5BFC\u51FA\u4F1A\u8BDD\u51B2\u7A81", '\u68C0\u6D4B\u5230\u672A\u5B8C\u6210\u7684\u5BFC\u51FA\u4F1A\u8BDD (' + (conflictData.sessionId || '') + ')\u3002\\n\u53EF\u80FD\u662F\u4E0A\u6B21\u5BFC\u51FA\u5F02\u5E38\u4E2D\u65AD\u5BFC\u81F4\u3002\\n\u70B9\u51FB\u300C\u786E\u5B9A\u300D\u4E2D\u6B62\u65E7\u4F1A\u8BDD\u5E76\u91CD\u65B0\u5BFC\u51FA\u3002\\n\u70B9\u51FB\u300C\u6E05\u7406\u300D\u4EC5\u6E05\u9664\u65E7\u4F1A\u8BDD\u3002', "\u786E\u5B9A", "\u6E05\u7406");
            if (doAbortExport) {
              if (conflictData.sessionId) {
                await fetch('/api/export?mode=session&action=abort&sessionId=' + conflictData.sessionId);
              }
              sessionRes = await fetch('/api/export?mode=session&action=create&todos=' + incTodos + '&trash=' + incTrash + '&settings=' + incSettings + '&categories=' + incCategories + '&sessionId=' + sessionId);
              if (!sessionRes.ok) throw new Error('\u91CD\u8BD5\u521B\u5EFA\u5BFC\u51FA\u4F1A\u8BDD\u5931\u8D25');
            } else {
              if (conflictData.sessionId) {
                await fetch('/api/export?mode=session&action=abort&sessionId=' + conflictData.sessionId);
              }
              closeProgress();
              return;
            }
          } else {
            throw new Error('\u521B\u5EFA\u5BFC\u51FA\u4F1A\u8BDD\u5931\u8D25');
          }
        }
        var sessionData = await sessionRes.json();
        if (!sessionData.hasData) {
          try { await fetch('/api/export?mode=session&action=abort&sessionId=' + sessionId); } catch(e) {}
          closeProgress(); await showAlert('\u6CA1\u6709\u53EF\u5BFC\u51FA\u7684\u6570\u636E\u3002'); return;
        }

        showProgress('\u51C6\u5907\u5BFC\u51FA', '\u5F00\u59CB\u4E0B\u8F7D...', 15);

        var exportStrategy = null;
        var writableStream = null;
        var fileHandle = null;
        var opfsFileHandle = null;
        var opfsRoot = null;
        var now = new Date();
        var fileName = 'todo_export_' + now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + '-' + String(now.getHours()).padStart(2,'0') + '-' + String(now.getMinutes()).padStart(2,'0') + '-' + String(now.getSeconds()).padStart(2,'0') + '.json';

        var EXPORT_STRATEGIES = [
          'fileSystemAPI',
          'opfs',
          'memoryBlob'
        ];

        for (var si = 0; si < EXPORT_STRATEGIES.length; si++) {
          var strategy = EXPORT_STRATEGIES[si];

          if (strategy === 'fileSystemAPI') {
            if (!window.showSaveFilePicker) continue;
            try {
              fileHandle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
              });
              writableStream = await fileHandle.createWritable();
              exportStrategy = 'fileSystemAPI';
              break;
            } catch (pickErr) {
              if (pickErr.name === 'AbortError') {
                try { await fetch('/api/export?mode=session&action=abort&sessionId=' + sessionId); } catch(e) {}
                closeProgress(); return;
              }
              fileHandle = null; writableStream = null;
            }
          }

          if (strategy === 'opfs') {
            if (!(navigator.storage && navigator.storage.getDirectory)) continue;
            try {
              opfsRoot = await navigator.storage.getDirectory();
              opfsFileHandle = await opfsRoot.getFileHandle(fileName, { create: true });
              writableStream = await opfsFileHandle.createWritable();
              exportStrategy = 'opfs';
              break;
            } catch (opfsErr) {
              opfsRoot = null; opfsFileHandle = null; writableStream = null;
            }
          }

          if (strategy === 'memoryBlob') {
            exportStrategy = 'memoryBlob';
            break;
          }
        }

        var useStreamWrite = exportStrategy === 'fileSystemAPI' || exportStrategy === 'opfs';
        var chunks = [];
        var encoder = new TextEncoder();
        var writeQueue = Promise.resolve();
        function writeLine(line) {
          var bytes = encoder.encode(line + '\\n');
          if (useStreamWrite) {
            writeQueue = writeQueue.then(function() { return writableStream.write(bytes); });
          } else {
            chunks.push(bytes);
          }
        }

        if (useChunked) {
          writeLine('ndjson');

          if (incSettings) {
            showProgress('\u5206\u7247\u5BFC\u51FA', '\u83B7\u53D6\u8BBE\u7F6E...', 25);
            var settingsRes = await fetch('/api/settings');
            if (settingsRes.ok) {
              var settingsObj = await settingsRes.json();
              writeLine(JSON.stringify({ _type: 'settings', data: settingsObj }));
            }
            var headerRes = await fetch('/api/custom-header');
            if (headerRes.ok) {
              var headerVal = await headerRes.text();
              writeLine(JSON.stringify({ _type: 'custom_header', data: headerVal }));
            }
            var contentRes = await fetch('/api/custom-content');
            if (contentRes.ok) {
              var contentVal = await contentRes.text();
              writeLine(JSON.stringify({ _type: 'custom_content', data: contentVal }));
            }
            var colorsRes = await fetch('/api/custom-colors');
            if (colorsRes.ok) {
              var colorsVal = await colorsRes.json();
              writeLine(JSON.stringify({ _type: 'customColors', data: colorsVal }));
            }
          }

          if (incCategories) {
            showProgress('\u5206\u7247\u5BFC\u51FA', '\u83B7\u53D6\u5206\u7C7B...', 30);
            var catRes = await fetch('/api/categories');
            if (catRes.ok) {
              var catData = await catRes.json();
              writeLine(JSON.stringify({ _type: 'categories', data: catData }));
            }
          }

          if (incTodos || incTrash) {
            var hasTemplates = incTodos;
            var todosCursor = '';
            var todosPage = 0;
            var todosPct = 35;
            var isFinalTodo = !hasTemplates;
            var todosBaseUrl = '/api/export?mode=page&type=todos&todos=' + incTodos + '&trash=' + incTrash + '&sessionId=' + (isFinalTodo ? sessionId : '') + (isFinalTodo ? '&final=true' : '');
            var pagePromise = fetch(todosBaseUrl + '&cursor=').then(function(r) { if (!r.ok) throw new Error('\u5206\u9875\u83B7\u53D6\u5F85\u529E\u5931\u8D25'); return r.text(); });
            while (true) {
              var pageText = await pagePromise;
              var pageLines = pageText.split('\\n').filter(function(l) { return l.trim(); });
              var pageInfo = null;
              for (var li = 0; li < pageLines.length; li++) {
                if (pageLines[li].trim() === 'ndjson') continue;
                try {
                  var parsed = JSON.parse(pageLines[li]);
                  if (parsed._type === 'page_info') { pageInfo = parsed; continue; }
                } catch(e) {}
                writeLine(pageLines[li]);
              }
              if (pageInfo && pageInfo.hasMore) {
                pagePromise = fetch(todosBaseUrl + '&cursor=' + encodeURIComponent(pageInfo.cursor)).then(function(r) { if (!r.ok) throw new Error('\u5206\u9875\u83B7\u53D6\u5F85\u529E\u5931\u8D25'); return r.text(); });
              }
              if (!pageInfo || !pageInfo.hasMore) break;
              todosCursor = pageInfo.cursor;
              todosPage++;
              todosPct += ((hasTemplates ? 55 : 60) - todosPct) * 0.15;
              showProgress('\u5206\u7247\u5BFC\u51FA', '\u83B7\u53D6\u5F85\u529E\u7B2C ' + todosPage + ' \u9875...', Math.round(todosPct));
              if (todosPage % 5 === 0) {
                await fetch('/api/export?mode=session&action=update&sessionId=' + sessionId + '&todosCursor=' + encodeURIComponent(todosCursor));
              }
            }

            if (hasTemplates) {
              var tplCursor = '';
              var tplPage = 0;
              var tplPct = Math.round(todosPct) + 5;
              var tplBaseUrl = '/api/export?mode=page&type=templates&todos=true&trash=false&sessionId=' + sessionId + '&final=true';
              var tplPromise = fetch(tplBaseUrl + '&cursor=').then(function(r) { if (!r.ok) throw new Error('\u5206\u9875\u83B7\u53D6\u6A21\u677F\u5931\u8D25'); return r.text(); });
              while (true) {
                var tplText = await tplPromise;
                var tplLines = tplText.split('\\n').filter(function(l) { return l.trim(); });
                var tplPageInfo = null;
                for (var tli = 0; tli < tplLines.length; tli++) {
                  if (tplLines[tli].trim() === 'ndjson') continue;
                  try {
                    var tplParsed = JSON.parse(tplLines[tli]);
                    if (tplParsed._type === 'page_info') { tplPageInfo = tplParsed; continue; }
                  } catch(e) {}
                  writeLine(tplLines[tli]);
                }
                if (tplPageInfo && tplPageInfo.hasMore) {
                  tplPromise = fetch(tplBaseUrl + '&cursor=' + encodeURIComponent(tplPageInfo.cursor)).then(function(r) { if (!r.ok) throw new Error('\u5206\u9875\u83B7\u53D6\u6A21\u677F\u5931\u8D25'); return r.text(); });
                }
                if (!tplPageInfo || !tplPageInfo.hasMore) break;
                tplCursor = tplPageInfo.cursor;
                tplPage++;
                tplPct += (90 - tplPct) * 0.15;
                showProgress('\u5206\u7247\u5BFC\u51FA', '\u83B7\u53D6\u6A21\u677F\u7B2C ' + tplPage + ' \u9875...', Math.round(tplPct));
                if (tplPage % 5 === 0) {
                  await fetch('/api/export?mode=session&action=update&sessionId=' + sessionId + '&templatesCursor=' + encodeURIComponent(tplCursor));
                }
              }
            }
          } else {
            try { await fetch('/api/export?mode=session&action=done&sessionId=' + sessionId); } catch(e) {}
          }

          if (useStreamWrite) {
            await writeQueue;
            await writableStream.close();
            if (exportStrategy === 'opfs') {
              showProgress('\u751F\u6210\u6587\u4EF6', '\u51C6\u5907\u4E0B\u8F7D...', 96);
              var opfsFile = await opfsFileHandle.getFile();
              var opfsUrl = URL.createObjectURL(opfsFile);
              var a = document.createElement('a');
              a.href = opfsUrl; a.download = fileName;
              document.body.appendChild(a); a.click(); document.body.removeChild(a);
              setTimeout(function() {
                URL.revokeObjectURL(opfsUrl);
                try { opfsRoot.removeEntry(fileName); } catch(e) {}
              }, 30000);
            }
          } else {
            showProgress('\u751F\u6210\u6587\u4EF6', '\u7EC4\u88C5\u4E0B\u8F7D\u6587\u4EF6...', 96);
            var blob = new Blob(chunks, { type: 'application/json' });
            var blobUrl = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = blobUrl; a.download = fileName;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 30000);
            chunks = null;
          }

          showProgress('\u5BFC\u51FA\u5B8C\u6210', '\u6587\u4EF6\u5DF2\u4FDD\u5B58', 100);
          try { await fetch('/api/export?mode=session&action=done&sessionId=' + sessionId); } catch(e) {}
          setTimeout(closeProgress, 2000);
        } else {
          if (exportStrategy === 'opfs') {
            showProgress('OPFS \u5BFC\u51FA', '\u521D\u59CB\u5316\u7F13\u5B58\u5199\u5165...', 15);
          } else if (exportStrategy === 'fileSystemAPI') {
            showProgress('File System API \u5BFC\u51FA', '\u521D\u59CB\u5316\u6D41\u5F0F\u5199\u5165...', 15);
          } else {
            showProgress('\u5185\u5B58\u5BFC\u51FA', '\u5927\u6570\u636E\u91CF\u65F6\u53EF\u80FD\u8F83\u6162\uFF0C\u5EFA\u8BAE\u4F7F\u7528 Chrome/Edge \u6D4F\u89C8\u5668', 15);
          }
          var streamBaseUrl = '/api/export?mode=stream&todos=' + incTodos + '&trash=' + incTrash + '&settings=' + incSettings + '&categories=' + incCategories + '&sessionId=' + sessionId;
          var streamTodosCursor = '';
          var streamTemplatesCursor = '';
          var streamSkipHeader = false;
          var streamBytes = 0;
          var streamPct = 15;
          var continuationRound = 0;
          var streamLabel = exportStrategy === 'fileSystemAPI' ? 'File System API' : (exportStrategy === 'opfs' ? 'OPFS' : '\u5185\u5B58');
          var streamSubLabel = exportStrategy === 'fileSystemAPI' ? '\u5DF2\u5199\u5165' : (exportStrategy === 'opfs' ? '\u5DF2\u7F13\u5B58' : '\u5DF2\u8BFB\u53D6');

          while (true) {
            var extraParams = '';
            if (streamTodosCursor) extraParams += '&todosCursor=' + encodeURIComponent(streamTodosCursor);
            if (streamTemplatesCursor) extraParams += '&templatesCursor=' + encodeURIComponent(streamTemplatesCursor);
            if (streamSkipHeader) extraParams += '&skipHeader=true';
            var streamUrl = streamBaseUrl + extraParams;
            var res = await fetch(streamUrl);
            if (!res.ok) throw new Error('\u6D41\u5F0F\u5BFC\u51FA\u8BF7\u6C42\u5931\u8D25');

            var reader = res.body.getReader();
            var decoder = new TextDecoder();
            var lineBuffer = '';
            var continuationInfo = null;

            while (true) {
              var _ref = await reader.read();
              var done = _ref.done;
              var value = _ref.value;
              if (done) break;

              var text = decoder.decode(value, { stream: true });
              lineBuffer += text;
              var lines = lineBuffer.split('\\n');
              lineBuffer = lines.pop();

              var pendingLines = [];
              for (var li = 0; li < lines.length; li++) {
                var line = lines[li];
                if (!line.trim()) continue;

                var isContinuation = false;
                try {
                  var parsed = JSON.parse(line);
                  if (parsed._type === 'continuation') {
                    continuationInfo = parsed;
                    isContinuation = true;
                  }
                } catch(e) {}

                if (isContinuation) continue;

                if (useStreamWrite) {
                  var lineBytes = encoder.encode(line + '\\n');
                  await writableStream.write(lineBytes);
                  streamBytes += lineBytes.byteLength;
                } else {
                  pendingLines.push(line + '\\n');
                  if (pendingLines.length >= 64) {
                    var batchBytes = encoder.encode(pendingLines.join(''));
                    chunks.push(batchBytes);
                    streamBytes += batchBytes.byteLength;
                    pendingLines = [];
                  }
                }
              }
              if (!useStreamWrite && pendingLines.length > 0) {
                var batchBytes = encoder.encode(pendingLines.join(''));
                chunks.push(batchBytes);
                streamBytes += batchBytes.byteLength;
              }
              streamPct += (90 - streamPct) * 0.03;
              showProgress(streamLabel, streamSubLabel + ' ' + (streamBytes / 1024 / 1024).toFixed(1) + ' MB', Math.round(streamPct));
            }

            if (lineBuffer.trim()) {
              var isLastContinuation = false;
              try {
                var lastParsed = JSON.parse(lineBuffer.trim());
                if (lastParsed._type === 'continuation') {
                  continuationInfo = lastParsed;
                  isLastContinuation = true;
                }
              } catch(e) {}

              if (!isLastContinuation) {
                var lastLineBytes = encoder.encode(lineBuffer.trim() + '\\n');
                if (useStreamWrite) {
                  await writableStream.write(lastLineBytes);
                } else {
                  chunks.push(lastLineBytes);
                }
                streamBytes += lastLineBytes.byteLength;
              }
            }

            if (continuationInfo) {
              continuationRound++;
              streamTodosCursor = continuationInfo.todosCursor || '';
              streamTemplatesCursor = continuationInfo.templatesCursor || '';
              streamSkipHeader = true;
              showProgress(streamLabel, '\u7EED\u4F20\u7B2C ' + continuationRound + ' \u8F6E...', Math.round(streamPct));
            } else {
              break;
            }
          }

          if (useStreamWrite) {
            await writableStream.close();
            if (exportStrategy === 'opfs') {
              showProgress('\u751F\u6210\u6587\u4EF6', '\u51C6\u5907\u4E0B\u8F7D...', 96);
              var opfsFile = await opfsFileHandle.getFile();
              var opfsUrl = URL.createObjectURL(opfsFile);
              var a = document.createElement('a');
              a.href = opfsUrl; a.download = fileName;
              document.body.appendChild(a); a.click(); document.body.removeChild(a);
              setTimeout(function() {
                URL.revokeObjectURL(opfsUrl);
                try { opfsRoot.removeEntry(fileName); } catch(e) {}
              }, 30000);
            }
          } else {
            showProgress('\u751F\u6210\u6587\u4EF6', '\u7EC4\u88C5\u4E0B\u8F7D\u6587\u4EF6...', 96);
            var blob = new Blob(chunks, { type: 'application/json' });
            var blobUrl = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = blobUrl; a.download = fileName;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 30000);
            chunks = null;
          }

          try {
            await fetch('/api/export?mode=session&action=done&sessionId=' + sessionId);
          } catch(e) {}

          showProgress('\u5BFC\u51FA\u5B8C\u6210', '\u6587\u4EF6\u5DF2\u4FDD\u5B58', 100);
          setTimeout(closeProgress, 2000);
        }
      } catch (e) {
        if (writableStream) {
          try { await writableStream.abort(); } catch(we) {}
        }
        if (opfsRoot && fileName) {
          try { opfsRoot.removeEntry(fileName); } catch(re) {}
        }
        closeProgress();
        await showAlert('\u5BFC\u51FA\u5931\u8D25\uFF1A' + e.message);
      }
    }

    function importData(event) {
      var file = event.target.files[0];
      if (!file) return;

      var importId = crypto.randomUUID();

      var overlay = document.createElement('div');
      overlay.className = 'io-overlay';
      var box = document.createElement('div');
      box.className = 'io-dialog';
      var titleEl = document.createElement('div');
      titleEl.className = 'io-title';
      var subEl = document.createElement('div');
      subEl.className = 'io-sub';
      var barBg = document.createElement('div');
      barBg.className = 'io-bar-bg';
      var barFill = document.createElement('div');
      barFill.className = 'io-bar-fill';
      barBg.appendChild(barFill); box.appendChild(titleEl); box.appendChild(subEl); box.appendChild(barBg);
      overlay.appendChild(box); document.body.appendChild(overlay);

      var spinChars = ['\\u28FE','\\u28F7','\\u28EF','\\u28DF','\\u287F','\\u28BF','\\u28FB','\\u28FD'];
      var spinIdx = 0; var curTitle = ''; var targetPct = 0; var curPct = 0;
      var spinTimer = setInterval(function() { spinIdx = (spinIdx+1)%8; titleEl.textContent = spinChars[spinIdx]+' '+curTitle; if(curPct<targetPct){curPct=targetPct>=100?targetPct:curPct+Math.max(1,Math.round((targetPct-curPct)*0.1));if(curPct>targetPct)curPct=targetPct;barFill.style.width=Math.min(curPct,100)+'%';} }, 80);
      function showProgress(t,s,p) { curTitle=t; subEl.textContent=s||''; if(p!==undefined) targetPct=Math.min(Math.max(p,0),100); }
      function closeProgress() { clearInterval(spinTimer); if(overlay.parentNode) overlay.parentNode.removeChild(overlay); }
      function showConfirm(title, msg, btnYesLabel, btnNoLabel) {
        return new Promise(function(resolve) {
          var co=document.createElement('div'); co.className='io-overlay io-overlay-high';
          var cb=document.createElement('div'); cb.className='io-dialog';
          var ct=document.createElement('div'); ct.className='io-title'; ct.textContent=title;
          var cm=document.createElement('div'); cm.className='io-sub io-sub-block'; cm.textContent=msg;
          var br=document.createElement('div'); br.className='io-btn-row';
          var by=document.createElement('button'); by.className='io-btn io-btn-primary'; by.textContent=btnYesLabel||'\u786E\u5B9A';
          var bn=document.createElement('button'); bn.className='io-btn io-btn-secondary'; bn.textContent=btnNoLabel||'\u53D6\u6D88';
          br.appendChild(bn); br.appendChild(by); cb.appendChild(ct); cb.appendChild(cm); cb.appendChild(br); co.appendChild(cb); document.body.appendChild(co);
          by.onclick=function(){ if(co.parentNode) co.parentNode.removeChild(co); resolve(true); };
          bn.onclick=function(){ if(co.parentNode) co.parentNode.removeChild(co); resolve(false); };
        });
      }
      function showAlert(msg) {
        return new Promise(function(resolve) {
          var ao=document.createElement('div'); ao.className='io-overlay io-overlay-high';
          var ab=document.createElement('div'); ab.className='io-dialog';
          var am=document.createElement('div'); am.className='io-msg'; am.textContent=msg;
          var bo=document.createElement('button'); bo.className='io-btn io-btn-primary'; bo.textContent='\u786E\u5B9A';
          ab.appendChild(am); ab.appendChild(bo); ao.appendChild(ab); document.body.appendChild(ao);
          bo.onclick=function(){ if(ao.parentNode) ao.parentNode.removeChild(ao); resolve(); };
        });
      }

      (async function() {
        try {
          var mode = 'merge';
          var isOverwrite = await showConfirm("\u662F\u5426\u4F7F\u7528\u3010\u8986\u76D6\u6A21\u5F0F\u3011\uFF1F", "\u70B9\u51FB\u786E\u5B9A\u5C06\u6E05\u7A7A\u4E91\u7AEF\u7684\u6240\u6709\u6570\u636E\uFF0C\u7136\u540E\u5B8C\u5168\u66FF\u6362\u4E3A\u5BFC\u5165\u7684\u65B0\u6570\u636E\u3002\\n\u7CFB\u7EDF\u4F1A\u81EA\u52A8\u5907\u4EFD\u5F53\u524D\u7684\u5F85\u529E\u4E8B\u9879\u3001\u6A21\u677F\u548C\u5206\u7C7B\uFF0C\u5907\u4EFD\u4FDD\u755910\u5206\u949F\u540E\u81EA\u52A8\u6E05\u9664\u3002\\n\u5982\u5BFC\u5165\u540E\u6570\u636E\u4E0D\u5B8C\u6574\uFF0C\u53EF\u8BBF\u95EE /api/import-backup?action=restore \u624B\u52A8\u6062\u590D\u3002\\n\u8BF7\u786E\u4FDD\u5BFC\u51FA\u6570\u636E\u65F6\u4E00\u5B9A\u8981\u5168\u90E8\u52FE\u9009\uFF0C\u5426\u5219\u6267\u884C\u65F6\u5BF9\u4E8E\u53EF\u80FD\u51FA\u73B0\u7684\u95EE\u9898\u540E\u679C\u81EA\u8D1F\u3002\\n\u70B9\u51FB\u53D6\u6D88\u5C06\u8FDB\u5165\u3010\u5408\u5E76\u6A21\u5F0F\u3011\u6216\u53D6\u6D88\u5BFC\u5165\u64CD\u4F5C\u3002");
          if (isOverwrite) { mode = 'overwrite'; }
          else {
            var isMerge = await showConfirm("\u662F\u5426\u7EE7\u7EED\u4F7F\u7528\u3010\u5408\u5E76\u6A21\u5F0F\u3011\u8FDB\u884C\u5BFC\u5165\uFF1F", "\u5C06\u4FDD\u7559\u73B0\u6709\u4E91\u7AEF\u7684\u6240\u6709\u6570\u636E\uFF0C\u65B0\u589E\u5E76\u8986\u76D6\u66F4\u65B0 ID \u76F8\u540C\u7684\u91CD\u53E0\u4E8B\u9879\u3002\\n\u5408\u5E76\u6A21\u5F0F\u4E0D\u521B\u5EFA\u5907\u4EFD\uFF0C\u5982\u5BFC\u5165\u540E\u6570\u636E\u5F02\u5E38\u5C06\u65E0\u6CD5\u6062\u590D\u3002\\n\u8BF7\u786E\u4FDD\u5BFC\u51FA\u6570\u636E\u65F6\u4E00\u5B9A\u8981\u5168\u90E8\u52FE\u9009\uFF0C\u5426\u5219\u6267\u884C\u65F6\u5BF9\u4E8E\u53EF\u80FD\u51FA\u73B0\u7684\u95EE\u9898\u540E\u679C\u81EA\u8D1F\u3002");
            if (!isMerge) { closeProgress(); event.target.value=''; return; }
          }

          showProgress('\u521D\u59CB\u5316\u5BFC\u5165\u4F1A\u8BDD', mode === 'overwrite' ? '\u5907\u4EFD\u5E76\u6E05\u7A7A\u4E91\u7AEF\u6570\u636E...' : '\u521B\u5EFA\u5408\u5E76\u4F1A\u8BDD...', 8);
          await new Promise(function(r){ setTimeout(r,30); });
          var initRes = await fetch('/api/import', {
            method: 'POST',
            body: JSON.stringify({ phase: 'init', mode: mode, importId: importId }),
            headers: { 'Content-Type': 'application/json' }
          });

          if (!initRes.ok) {
            var errData1 = {};
            try { errData1 = await initRes.json(); } catch(ee){}

            if (initRes.status === 409 && errData1.conflict && errData1.importId) {
              var conflictMsg = '\u68C0\u6D4B\u5230\u672A\u5B8C\u6210\u7684\u5BFC\u5165\u4F1A\u8BDD (' + errData1.importId + ')\\n\\n';
              if (errData1.mode === 'overwrite') {
                conflictMsg += '\u8BE5\u4F1A\u8BDD\u4E3A\u8986\u5199\u6A21\u5F0F\uFF0C\u70B9\u51FB\u300C\u6062\u590D\u300D\u5C06\u4E2D\u6B62\u65E7\u4F1A\u8BDD\u5E76\u6062\u590D\u539F\u59CB\u5907\u4EFD\u6570\u636E\u3002\\n';
              } else {
                conflictMsg += '\u70B9\u51FB\u300C\u6062\u590D\u300D\u5C06\u6E05\u9664\u65E7\u4F1A\u8BDD\u8BB0\u5F55\u3002\\n';
              }
              conflictMsg += '\u70B9\u51FB\u300C\u786E\u5B9A\u300D\u4E2D\u6B62\u65E7\u4F1A\u8BDD\u5E76\u7EE7\u7EED\u5F53\u524D\u5BFC\u5165\u3002';

              var doAbortOld = await showConfirm("\u4F1A\u8BDD\u51B2\u7A81", conflictMsg, "\u786E\u5B9A", "\u6062\u590D");
              if (doAbortOld) {
                var abortOldRes = await fetch('/api/import', {
                  method: 'POST',
                  body: JSON.stringify({ phase: 'abort', importId: errData1.importId }),
                  headers: { 'Content-Type': 'application/json' }
                });
                if (abortOldRes.ok) {
                  showProgress('\u91CD\u8BD5\u521D\u59CB\u5316', mode === 'overwrite' ? '\u5907\u4EFD\u5E76\u6E05\u7A7A\u4E91\u7AEF\u6570\u636E...' : '\u521B\u5EFA\u5408\u5E76\u4F1A\u8BDD...', 8);
                  await new Promise(function(r){ setTimeout(r,30); });
                  initRes = await fetch('/api/import', {
                    method: 'POST',
                    body: JSON.stringify({ phase: 'init', mode: mode, importId: importId }),
                    headers: { 'Content-Type': 'application/json' }
                  });
                  if (!initRes.ok) {
                    var errMsg1Retry = '\u91CD\u8BD5\u521D\u59CB\u5316\u5931\u8D25';
                    try { var ed1r = await initRes.json(); if(ed1r.error) errMsg1Retry+='\uFF1A'+ed1r.error; } catch(ee){}
                    throw new Error(errMsg1Retry);
                  }
                } else {
                  throw new Error('\u4E2D\u6B62\u65E7\u4F1A\u8BDD\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5');
                }
              } else {
                var restoreAbortRes = await fetch('/api/import', {
                  method: 'POST',
                  body: JSON.stringify({ phase: 'abort', importId: errData1.importId }),
                  headers: { 'Content-Type': 'application/json' }
                });
                closeProgress();
                if (restoreAbortRes.ok) {
                  var restoreAbortData = await restoreAbortRes.json();
                  if (errData1.mode === 'overwrite' && restoreAbortData.recovered) {
                    await showAlert('\u539F\u59CB\u6570\u636E\u5DF2\u6210\u529F\u6062\u590D\u3002');
                  } else if (errData1.mode === 'overwrite') {
                    await showAlert('\u65E7\u4F1A\u8BDD\u5DF2\u6E05\u9664\uFF0C\u4F46\u672A\u68C0\u6D4B\u5230\u5907\u4EFD\u6570\u636E\u3002');
                  } else {
                    await showAlert('\u65E7\u4F1A\u8BDD\u5DF2\u6E05\u9664\u3002');
                  }
                } else {
                  await showAlert('\u6062\u590D\u64CD\u4F5C\u5931\u8D25\uFF0C\u53EF\u624B\u52A8\u8BBF\u95EE /api/import-backup?action=restore \u5C1D\u8BD5\u6062\u590D\u3002');
                }
                return;
              }
            } else {
              var errMsg1 = '\u521D\u59CB\u5316\u5931\u8D25';
              if(errData1.error) errMsg1 += '\uFF1A' + errData1.error;
              throw new Error(errMsg1);
            }
          }

          var abortAndThrow = async function(msg) {
            if (mode === 'overwrite') {
              try {
                var abortRes = await fetch('/api/import', {
                  method: 'POST',
                  body: JSON.stringify({ phase: 'abort', importId: importId }),
                  headers: { 'Content-Type': 'application/json' }
                });
                if (abortRes.ok) {
                  var abortData = await abortRes.json();
                  msg += abortData.recovered ? '\\n\\n\u5DF2\u81EA\u52A8\u6062\u590D\u539F\u59CB\u5907\u4EFD\u6570\u636E' : '\\n\\n\u4F1A\u8BDD\u5DF2\u6E05\u9664\uFF0C\u4F46\u672A\u68C0\u6D4B\u5230\u5907\u4EFD\u6570\u636E';
                } else {
                  msg += '\\n\\n\u81EA\u52A8\u6062\u590D\u5931\u8D25\uFF0C\u53EF\u624B\u52A8\u8BBF\u95EE /api/import-backup?action=restore \u5C1D\u8BD5\u6062\u590D';
                }
              } catch(abortErr) {
                msg += '\\n\\n\u81EA\u52A8\u6062\u590D\u8BF7\u6C42\u5F02\u5E38\uFF1A' + abortErr.message;
              }
            }
            throw new Error(msg);
          };

          showProgress('\u8BFB\u53D6\u6587\u4EF6', '\u6B63\u5728\u8BFB\u53D6...', 15);

          var useStream = typeof file.stream === 'function';
          var useChunked = document.getElementById('chunked-mode').checked;
          var isNdjson = false;
          var settingsBuf = {};
          var categoriesBuf = null;
          var customColorsBuf = null;

          if (useChunked) {
            var firstChunk = file.slice(0, 1024);
            var firstText = await new Promise(function(resolve) {
              var r = new FileReader();
              r.onload = function(e) { resolve(e.target.result); };
              r.onerror = function() { resolve(''); };
              r.readAsText(firstChunk);
            });
            var firstTrimmed = firstText.trim();
            if (firstTrimmed.startsWith('{') || firstTrimmed.startsWith('[')) {
              useChunked = false;
            }
          }

          if (useChunked) {
            var chunkBuf = [];
            var CHUNK_LINES = 500;
            var chunkIdx = 0;
            var uploadPct = 42;
            var streamReader = file.stream().getReader();
            var decoder = new TextDecoder();
            var lineBuffer = '';
            var firstLineChecked = false;
            var bytesRead = 0;
            var fileSize = file.size;

            async function flushChunk() {
              if (chunkBuf.length === 0) return;
              chunkIdx++;
              uploadPct += (88 - uploadPct) * 0.12;
              showProgress('\u5206\u7247\u5BFC\u5165', '\u4E0A\u4F20\u7B2C ' + chunkIdx + ' \u7247...', Math.round(uploadPct));
              var chunkBody = chunkBuf.join('\\n') + '\\n';
              chunkBuf.length = 0;
              var chunkRes = await fetch('/api/import?importId=' + importId, {
                method: 'POST',
                body: chunkBody,
                headers: { 'Content-Type': 'application/x-ndjson' }
              });
              chunkBody = null;
              if (!chunkRes.ok) {
                var chunkErr = '\u7B2C ' + chunkIdx + ' \u7247\u4E0A\u4F20\u5931\u8D25';
                try { var ced = await chunkRes.json(); if (ced.error) chunkErr += '\uFF1A' + ced.error; } catch(cee) {}
                await abortAndThrow(chunkErr);
              }
            }

            while (true) {
              var _cref = await streamReader.read();
              if (_cref.done) break;
              bytesRead += _cref.value.byteLength;
              var readPct = 15 + Math.round((bytesRead / Math.max(fileSize, 1)) * 25);
              showProgress('\u5206\u7247\u5BFC\u5165', '\u8BFB\u53D6 ' + (bytesRead / 1024 / 1024).toFixed(1) + ' / ' + (fileSize / 1024 / 1024).toFixed(1) + ' MB', readPct);

              lineBuffer += decoder.decode(_cref.value, { stream: true });
              var lines = lineBuffer.split('\\n');
              lineBuffer = lines.pop() || '';

              for (var cli = 0; cli < lines.length; cli++) {
                var trimmed = lines[cli];
                lines[cli] = null;
                trimmed = trimmed.trim();
                if (!trimmed) continue;
                if (!firstLineChecked) {
                  firstLineChecked = true;
                  if (trimmed === 'ndjson') { isNdjson = true; continue; }
                }
                if (isNdjson && trimmed.indexOf('"_type"') !== -1) {
                  try {
                    var cobj = JSON.parse(trimmed);
                    if (cobj._type === 'settings') { settingsBuf.settings = cobj.data; continue; }
                    if (cobj._type === 'custom_header') { settingsBuf.custom_header = cobj.data; continue; }
                    if (cobj._type === 'custom_content') { settingsBuf.custom_content = cobj.data; continue; }
                    if (cobj._type === 'customColors') { customColorsBuf = cobj.data; continue; }
                    if (cobj._type === 'categories') { categoriesBuf = cobj.data; continue; }
                  } catch(cpe) {}
                }
                chunkBuf.push(trimmed);
                if (chunkBuf.length >= CHUNK_LINES) {
                  await flushChunk();
                }
              }
            }

            if (lineBuffer.trim()) {
              var trimmed = lineBuffer.trim();
              if (!firstLineChecked && trimmed === 'ndjson') {
              } else if (isNdjson && trimmed.indexOf('"_type"') !== -1) {
                try {
                  var cobj = JSON.parse(trimmed);
                  if (cobj._type === 'settings') { settingsBuf.settings = cobj.data; }
                  else if (cobj._type === 'custom_header') { settingsBuf.custom_header = cobj.data; }
                  else if (cobj._type === 'custom_content') { settingsBuf.custom_content = cobj.data; }
                  else if (cobj._type === 'customColors') { customColorsBuf = cobj.data; }
                  else if (cobj._type === 'categories') { categoriesBuf = cobj.data; }
                  else { chunkBuf.push(trimmed); }
                } catch(cpe) { chunkBuf.push(trimmed); }
              } else {
                chunkBuf.push(trimmed);
              }
            }

            await flushChunk();
          } else if (useStream) {
            var ts = new TransformStream();
            var writer = ts.writable.getWriter();
            var encoder = new TextEncoder();

            var uploadPromise = fetch('/api/import?importId=' + importId, {
              method: 'POST',
              body: ts.readable,
              headers: { 'Content-Type': 'application/x-ndjson' },
              duplex: 'half'
            });

            var streamReader = file.stream().getReader();
            var decoder = new TextDecoder();
            var lineBuffer = '';
            var firstLineChecked = false;
            var bytesRead = 0;
            var fileSize = file.size;

            while (true) {
              var _ref = await streamReader.read();
              if (_ref.done) break;
              bytesRead += _ref.value.byteLength;
            var readPct = 15 + Math.round((bytesRead / Math.max(fileSize, 1)) * 25);
              showProgress('\u6D41\u5F0F\u5BFC\u5165', '\u8BFB\u53D6 ' + (bytesRead / 1024 / 1024).toFixed(1) + ' / ' + (fileSize / 1024 / 1024).toFixed(1) + ' MB', readPct);

              lineBuffer += decoder.decode(_ref.value, { stream: true });
              var lines = lineBuffer.split('\\n');
              lineBuffer = lines.pop() || '';

              var output = '';
              for (var li = 0; li < lines.length; li++) {
                var trimmed = lines[li];
                lines[li] = null;
                trimmed = trimmed.trim();
                if (!trimmed) continue;

                if (!firstLineChecked) {
                  firstLineChecked = true;
                  if (trimmed === 'ndjson') { isNdjson = true; continue; }
                }

                if (isNdjson && trimmed.indexOf('"_type"') !== -1) {
                  try {
                    var obj = JSON.parse(trimmed);
                    if (obj._type === 'settings') { settingsBuf.settings = obj.data; continue; }
                    if (obj._type === 'custom_header') { settingsBuf.custom_header = obj.data; continue; }
                    if (obj._type === 'custom_content') { settingsBuf.custom_content = obj.data; continue; }
                    if (obj._type === 'customColors') { customColorsBuf = obj.data; continue; }
                    if (obj._type === 'categories') { categoriesBuf = obj.data; continue; }
                  } catch(pe) {}
                }

                output += trimmed + '\\n';
              }

              if (output) {
                await writer.write(encoder.encode(output));
              }
            }

            if (lineBuffer.trim()) {
              var trimmed = lineBuffer.trim();
              if (!firstLineChecked && trimmed === 'ndjson') {
                // skip
              } else if (isNdjson && trimmed.indexOf('"_type"') !== -1) {
                try {
                  var obj = JSON.parse(trimmed);
                  if (obj._type === 'settings') { settingsBuf.settings = obj.data; }
                  else if (obj._type === 'custom_header') { settingsBuf.custom_header = obj.data; }
                  else if (obj._type === 'custom_content') { settingsBuf.custom_content = obj.data; }
                  else if (obj._type === 'customColors') { customColorsBuf = obj.data; }
                  else if (obj._type === 'categories') { categoriesBuf = obj.data; }
                  else { await writer.write(encoder.encode(trimmed + '\\n')); }
                } catch(pe) { await writer.write(encoder.encode(trimmed + '\\n')); }
              } else {
                await writer.write(encoder.encode(trimmed + '\\n'));
              }
            }

            await writer.close();
            showProgress('\u6D41\u5F0F\u5BFC\u5165', '\u4E0A\u4F20\u6570\u636E\u4E2D...', 42);
            var uploadRes = await uploadPromise;
            if (!uploadRes.ok) {
              var errMsg2 = '\u4E0A\u4F20\u6570\u636E\u5931\u8D25';
              try { var ed2 = await uploadRes.json(); if(ed2.error) errMsg2+='\uFF1A'+ed2.error; } catch(ee){}
              await abortAndThrow(errMsg2);
            }
          } else {
            showProgress('\u8BFB\u53D6\u6587\u4EF6', '\u517C\u5BB9\u6A21\u5F0F...', 15);
            var fileReader = new FileReader();
            var rawText = await new Promise(function(resolve, reject) {
              fileReader.onload = function(e) { resolve(e.target.result); };
              fileReader.onerror = function() { reject(new Error('\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25')); };
              fileReader.readAsText(file);
            });

            showProgress('\u6570\u636E\u89E3\u6790', '\u89E3\u6790 JSON \u4E2D...', 40);

            var data;
            var firstLine = rawText.split('\\n')[0].trim();

            if (firstLine === 'ndjson') {
              isNdjson = true;
              var lines = rawText.split('\\n');
              var todos = [];
              var templates = [];
              data = {};
              for (var li = 1; li < lines.length; li++) {
                var line = lines[li].trim();
                if (!line) continue;
                var item = JSON.parse(line);
                if (item._type === 'template') { var tpl = Object.assign({}, item); delete tpl._type; templates.push(tpl); }
                else if (item._type === 'settings') { data.settings = item.data; }
                else if (item._type === 'custom_header') { data.custom_header = item.data; }
                else if (item._type === 'custom_content') { data.custom_content = item.data; }
                else if (item._type === 'customColors') { data.customColors = item.data; }
                else if (item._type === 'categories') { data.categories = item.data; }
                else { todos.push(item); }
              }
              data.todos = todos;
              data.todo_templates = templates;
            } else {
              data = JSON.parse(rawText);
            }
            rawText = null;

            var toImport = [];
            if (data.todos) toImport = toImport.concat(data.todos);
            if (data.trash) toImport = toImport.concat(data.trash);
            if (!data.todos && !data.trash && Array.isArray(data)) toImport = data;
            var toImportTemplates = data.todo_templates || [];

            if (toImport.length === 0 && toImportTemplates.length === 0 && !data.settings && data.custom_header === undefined && data.custom_content === undefined && !data.categories) {
              throw new Error("\u672A\u5728\u6587\u4EF6\u4E2D\u627E\u5230\u6709\u6548\u7684\u5F85\u529E\u6216\u8BBE\u7F6E\u6570\u636E\u3002");
            }

            showProgress('\u4E0A\u4F20\u6570\u636E', '', 45);
            var mixedItems = [];
            for (var mi = 0; mi < toImport.length; mi++) { mixedItems.push(toImport[mi]); }
            for (var ti = 0; ti < toImportTemplates.length; ti++) {
              var tplObj = Object.assign({ _type: 'template' }, toImportTemplates[ti]);
              mixedItems.push(tplObj);
            }
            toImport = null;
            toImportTemplates = null;

            var mIdx = 0;
            var mixedStream = new ReadableStream({
              pull: function(controller) {
                if (mIdx >= mixedItems.length) { controller.close(); return; }
                var chunk = '';
                for (var i = 0; i < 50 && mIdx < mixedItems.length; i++, mIdx++) {
                  chunk += JSON.stringify(mixedItems[mIdx]) + '\\n';
                }
                controller.enqueue(new TextEncoder().encode(chunk));
              }
            });
            mixedItems = null;

            var uploadRes = await fetch('/api/import?importId=' + importId, {
              method: 'POST',
              body: mixedStream,
              headers: { 'Content-Type': 'application/x-ndjson' },
              duplex: 'half'
            });
            if (!uploadRes.ok) {
              var errMsg2b = '\u4E0A\u4F20\u6570\u636E\u5931\u8D25';
              try { var ed2b = await uploadRes.json(); if(ed2b.error) errMsg2b+='\uFF1A'+ed2b.error; } catch(ee){}
              await abortAndThrow(errMsg2b);
            }

            settingsBuf.settings = data.settings;
            settingsBuf.custom_header = data.custom_header;
            settingsBuf.custom_content = data.custom_content;
            categoriesBuf = data.categories;
            customColorsBuf = data.customColors;
          }

          if (settingsBuf.settings && document.getElementById('export-settings').checked) {
            showProgress('\u5E94\u7528\u504F\u597D\u8BBE\u7F6E', '', 85);
            await fetch('/api/settings', {
              method: 'POST',
              body: JSON.stringify(settingsBuf.settings),
              headers: { 'Content-Type': 'application/json' }
            });
          }

          showProgress('\u6536\u5C3E\u5904\u7406', '\u6E05\u7406\u5E76\u5B8C\u6210\u5BFC\u5165...', 90);
          var finalBody = { phase: 'finalize', mode: mode, importId: importId };
          if (settingsBuf.custom_header !== undefined && document.getElementById('export-settings').checked) finalBody.custom_header = settingsBuf.custom_header;
          if (settingsBuf.custom_content !== undefined && document.getElementById('export-settings').checked) finalBody.custom_content = settingsBuf.custom_content;
          if (categoriesBuf && Array.isArray(categoriesBuf) && document.getElementById('export-categories').checked) finalBody.categories = categoriesBuf;
          if (customColorsBuf && Array.isArray(customColorsBuf) && document.getElementById('export-settings').checked) finalBody.customColors = customColorsBuf;
          var finalRes = await fetch('/api/import', {
            method: 'POST',
            body: JSON.stringify(finalBody),
            headers: { 'Content-Type': 'application/json' }
          });
          if (!finalRes.ok) {
            var errMsg4 = '\u6536\u5C3E\u5904\u7406\u5931\u8D25';
            try { var ed4 = await finalRes.json(); if(ed4.error) errMsg4+='\uFF1A'+ed4.error; } catch(ee){}
            throw new Error(errMsg4);
          }

          showProgress('\u5BFC\u5165\u5B8C\u6210', mode === 'overwrite' ? '\u539F\u59CB\u6570\u636E\u5907\u4EFD\u4FDD\u755910\u5206\u949F\uFF0C\u53EF\u624B\u52A8\u6062\u590D\u3002\u754C\u9762\u5373\u5C06\u91CD\u8F7D...' : '\u754C\u9762\u5373\u5C06\u91CD\u8F7D...', 100);
          await new Promise(function(r){ setTimeout(r,1000); });
          closeProgress();
          location.reload();
        } catch (err) {
          closeProgress();
          await showAlert('\u5BFC\u5165\u5931\u8D25\uFF1A' + err.message);
        }
        event.target.value = '';
      })();
    }

    async function factoryReset() {
      if (!confirm("\u8B66\u544A\uFF1A\u6B64\u64CD\u4F5C\u5C06\u5F7B\u5E95\u5220\u9664\u4E91\u7AEF\u6240\u6709\u7684\u5F85\u529E\u4E8B\u9879\u3001\u56DE\u6536\u7AD9\u8BB0\u5F55\u548C\u6240\u6709\u7684\u4E91\u7AEF\u504F\u597D\u8BBE\u7F6E\uFF01\\n\u6B64\u64CD\u4F5C\u4E0D\u53EF\u9006\uFF0C\u5F3A\u70C8\u5EFA\u8BAE\u5148\u5BFC\u51FA\u7CFB\u7EDF\u5907\u4EFD\uFF01\\n\\n\u662F\u5426\u7EE7\u7EED\uFF1F")) return;
      if (!confirm("\u6700\u7EC8\u786E\u8BA4\uFF1A\u771F\u7684\u8981\u5F7B\u5E95\u6E05\u7A7A\u6240\u6709\u6570\u636E\u5417\uFF1F")) return;
      
      try {
        await fetch('/api/trash-action', {
          method: 'POST', body: JSON.stringify({ action: 'CLEAR_ALL_DATA' }),
          headers: { 'Content-Type': 'application/json' }
        });
        alert("\u7CFB\u7EDF\u4E91\u7AEF\u5DF2\u5B8C\u5168\u6E05\u7A7A\uFF0C\u5373\u5C06\u91CD\u7F6E\u3002");
        location.reload();
      } catch (e) {
        alert("\u6570\u636E\u6E05\u7406\u6267\u884C\u5931\u8D25");
      }
    }

    async function checkInterruptedImport() {
      try {
        var res = await fetch('/api/import', {
          method: 'POST',
          body: JSON.stringify({ phase: 'status' }),
          headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) return;
        var data = await res.json();
        if (!data.active) return;

        if (data.mode === 'overwrite' && data.hasBackup) {
          var doRecover = confirm(
            '\u68C0\u6D4B\u5230\u4E0A\u6B21\u8986\u5199\u5BFC\u5165\u4E2D\u65AD\uFF0C\u539F\u59CB\u6570\u636E\u5907\u4EFD\u4ECD\u5728\uFF08\u4FDD\u755910\u5206\u949F\u540E\u81EA\u52A8\u6E05\u9664\uFF09\u3002\\n\\n' +
            '\u4F1A\u8BDD ID: ' + data.importId + '\\n' +
            '\u542F\u52A8\u65F6\u95F4: ' + new Date(data.startedAt).toLocaleString() + '\\n\\n' +
            '\u70B9\u51FB\u300C\u786E\u5B9A\u300D\u6062\u590D\u539F\u59CB\u6570\u636E\uFF0C\u70B9\u51FB\u300C\u53D6\u6D88\u300D\u653E\u5F03\u6062\u590D\uFF08\u5F53\u524D\u4E0D\u5B8C\u6574\u6570\u636E\u5C06\u4FDD\u7559\uFF09\u3002\\n' +
            '\u4E5F\u53EF\u7A0D\u540E\u8BBF\u95EE /api/import-backup?action=restore \u624B\u52A8\u6062\u590D\u3002'
          );
          if (doRecover) {
            var abortRes = await fetch('/api/import', {
              method: 'POST',
              body: JSON.stringify({ phase: 'abort', importId: data.importId }),
              headers: { 'Content-Type': 'application/json' }
            });
            if (abortRes.ok) {
              var abortData = await abortRes.json();
              if (abortData.recovered) {
                alert('\u539F\u59CB\u6570\u636E\u5DF2\u6210\u529F\u6062\u590D\uFF0C\u9875\u9762\u5373\u5C06\u91CD\u8F7D\u3002');
                location.reload();
              } else {
                alert('\u4F1A\u8BDD\u5DF2\u6E05\u9664\u3002');
              }
            } else {
              alert('\u6062\u590D\u64CD\u4F5C\u5931\u8D25\uFF0C\u53EF\u624B\u52A8\u8BBF\u95EE /api/import-backup?action=restore \u5C1D\u8BD5\u6062\u590D\u3002');
            }
          } else {
            await fetch('/api/import', {
              method: 'POST',
              body: JSON.stringify({ phase: 'abort', importId: data.importId, keepBackup: true }),
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } else {
          var doCleanup = confirm(
            '\u68C0\u6D4B\u5230\u4E0A\u6B21\u5408\u5E76\u5BFC\u5165\u4E2D\u65AD\uFF08\u4F1A\u8BDD ID: ' + data.importId + '\uFF09\u3002\\n\\n' +
            '\u5408\u5E76\u6A21\u5F0F\u65E0\u6CD5\u81EA\u52A8\u6062\u590D\uFF0C\u90E8\u5206\u65B0\u6570\u636E\u53EF\u80FD\u5DF2\u5199\u5165\u3002\\n' +
            '\u70B9\u51FB\u300C\u786E\u5B9A\u300D\u6E05\u9664\u8BE5\u4F1A\u8BDD\u8BB0\u5F55\u3002'
          );
          if (doCleanup) {
            await fetch('/api/import', {
              method: 'POST',
              body: JSON.stringify({ phase: 'abort', importId: data.importId }),
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
      } catch(e) {
        console.error('Check interrupted import error:', e);
      }
    }
`;

// src/html/js/stats.js
var stats = `
    async function openStats() {
      var statsView = document.getElementById('stats-overlay');
      statsView.classList.remove('closing');
      statsView.classList.add('active');
      
      currentStatsTab = 'weekly';
      updateStatsHeader();
      loadWeeklyStats();
    }

    async function loadWeeklyStats() {
      document.getElementById('stats-loading').classList.remove('hidden');
      document.getElementById('stats-content').classList.add('hidden');

      if(chartInstanceBar) chartInstanceBar.destroy();
      if(chartInstancePri) chartInstancePri.destroy();
      if(chartInstanceStat) chartInstanceStat.destroy();

      const endDt = new Date();
      const startDt = new Date();
      startDt.setDate(startDt.getDate() - 6);
      
      const endStr = formatDate(endDt);
      const startStr = formatDate(startDt);

      const datesArray = [];
      let tempDt = new Date(startDt);
      while(tempDt <= endDt) {
        datesArray.push(formatDate(tempDt));
        tempDt.setDate(tempDt.getDate() + 1);
      }

      try {
        const res = await fetch(\`/api/stats?start=\${startStr}&end=\${endStr}\`);
        if(res.ok) {
          const rawData = await res.json();
          renderStatsCharts(rawData, datesArray);
          document.getElementById('stats-loading').classList.add('hidden');
          document.getElementById('stats-content').classList.remove('hidden');
        } else {
          document.getElementById('stats-loading').innerText = '\u6570\u636E\u62C9\u53D6\u5931\u8D25\u3002';
        }
      } catch(e) {
        document.getElementById('stats-loading').innerText = '\u7F51\u7EDC\u8BF7\u6C42\u5F02\u5E38\u3002';
      }
    }

    function closeStats() {
      const statsView = document.getElementById('stats-overlay');
      statsView.classList.add('closing');
      statsView.addEventListener('animationend', function handler() {
        statsView.classList.remove('active');
        statsView.classList.remove('closing');
        statsView.removeEventListener('animationend', handler);
      });
    }
    
    function switchStatsTab() {
      if (currentStatsTab === 'weekly') {
        if (getAnnualReportYear() === null) return;
        currentStatsTab = 'annual';
        document.getElementById('stats-weekly').classList.add('hidden');
        document.getElementById('stats-annual').classList.remove('hidden');
        loadAnnualReport();
      } else {
        currentStatsTab = 'weekly';
        document.getElementById('stats-annual').classList.add('hidden');
        document.getElementById('stats-weekly').classList.remove('hidden');
      }
      updateStatsHeader();
    }
    
    // \u5E74\u5EA6\u62A5\u544A\u51FA\u73B0\u65F6\u95F4 0=1\u6708, 1=2\u6708, ..., 11=12\u6708
    function getAnnualReportYear() {
      var now = new Date();
      var month = now.getMonth();
      var day = now.getDate();
      if (month === 11 && day === 31) return now.getFullYear();
      if (month === 0 && day >= 1 && day <= 7) return now.getFullYear() - 1;
      return null;
    }

    function updateStatsHeader() {
      var titleEl = document.getElementById('stats-title-text');
      var switchBtn = document.getElementById('stats-switch-btn');
      
      if (currentStatsTab === 'weekly') {
        titleEl.innerText = '7\u5929\u7EDF\u8BA1';
        if (getAnnualReportYear() !== null) {
          switchBtn.classList.remove('hidden');
          switchBtn.innerText = '\u5E74\u5EA6\u62A5\u544A';
        } else {
          switchBtn.classList.add('hidden');
        }
      } else {
        titleEl.innerText = '\u5E74\u5EA6\u62A5\u544A';
        switchBtn.classList.remove('hidden');
        switchBtn.innerText = '7\u5929\u7EDF\u8BA1';
      }
    }

    async function loadAnnualReport() {
      var reportYear = getAnnualReportYear();
      if (reportYear === null) return;
      annualYear = reportYear;

      var loading = document.getElementById('annual-loading');
      var content = document.getElementById('annual-content');
      loading.classList.remove('hidden');
      content.classList.add('hidden');
      loading.innerText = '\u5E74\u5EA6\u6570\u636E\u52A0\u8F7D\u4E2D...';

      var startStr = annualYear + '-01-01';
      var endStr = annualYear + '-12-31';

      try {
        var res = await fetch('/api/stats?start=' + startStr + '&end=' + endStr);
        if (res.ok) {
          var rawData = await res.json();
          renderAnnualReport(rawData);
          loading.classList.add('hidden');
          content.classList.remove('hidden');
        } else {
          loading.innerText = '\u5E74\u5EA6\u6570\u636E\u62C9\u53D6\u5931\u8D25\u3002';
        }
      } catch(e) {
        loading.innerText = '\u7F51\u7EDC\u8BF7\u6C42\u5F02\u5E38\u3002';
      }
    }

    function renderAnnualReport(rawData) {
      const content = document.getElementById('annual-content');
      
      const totalTasks = rawData.length;
      const doneTasks = rawData.filter(function(r){ return r.done === 1; }).length;
      const undoneTasks = totalTasks - doneTasks;
      const doneRate = totalTasks > 0 ? (doneTasks / totalTasks * 100) : 0;
      
      const highPri = rawData.filter(function(r){ return r.priority === 'high'; }).length;
      const medPri = rawData.filter(function(r){ return r.priority === 'med'; }).length;
      const lowPri = rawData.filter(function(r){ return r.priority === 'low'; }).length;
      const highPriRate = totalTasks > 0 ? (highPri / totalTasks * 100) : 0;
      const medPriRate = totalTasks > 0 ? (medPri / totalTasks * 100) : 0;
      const lowPriRate = totalTasks > 0 ? (lowPri / totalTasks * 100) : 0;
      
      var monthData = [];
      for (var mi = 0; mi < 12; mi++) monthData.push({ total: 0, done: 0 });
      rawData.forEach(function(r) {
        var month = parseInt(r.date.slice(5, 7)) - 1;
        if (month >= 0 && month < 12) {
          monthData[month].total++;
          if (r.done === 1) monthData[month].done++;
        }
      });
      
      var busiestMonth = 0;
      monthData.forEach(function(m, i) { if (m.total > monthData[busiestMonth].total) busiestMonth = i; });
      
      var dateCount = {};
      rawData.forEach(function(r) { dateCount[r.date] = (dateCount[r.date] || 0) + 1; });
      var busiestDate = '--';
      var busiestDateCount = 0;
      for (var dk in dateCount) {
        if (dateCount[dk] > busiestDateCount) { busiestDate = dk; busiestDateCount = dateCount[dk]; }
      }
      
      var firstHalf = 0, secondHalf = 0;
      monthData.forEach(function(m, i) { if (i < 6) firstHalf += m.total; else secondHalf += m.total; });
      
      var activeDays = Object.keys(dateCount).length;
      
      var ending = determineEnding(totalTasks, doneRate, highPriRate, firstHalf, secondHalf, monthData, activeDays, medPriRate, lowPriRate);
      
      var monthMax = 1;
      monthData.forEach(function(m) { if (m.total > monthMax) monthMax = m.total; });
      var monthLabels = ['1\u6708','2\u6708','3\u6708','4\u6708','5\u6708','6\u6708','7\u6708','8\u6708','9\u6708','10\u6708','11\u6708','12\u6708'];
      
      var monthBarsHtml = '';
      for (var bi = 0; bi < 12; bi++) {
        var m = monthData[bi];
        var totalW = (m.total / monthMax * 100);
        var doneW = (m.done / monthMax * 100);
        monthBarsHtml += '<div class="annual-month-row">' +
          '<div class="annual-month-label">' + monthLabels[bi] + '</div>' +
          '<div class="annual-month-bar-bg">' +
            '<div class="annual-month-bar-total" style="width:' + totalW + '%"></div>' +
            '<div class="annual-month-bar-done" style="width:' + doneW + '%"></div>' +
          '</div>' +
          '<div class="annual-month-count">' + m.total + '</div>' +
        '</div>';
      }

      var priMax = Math.max(highPri, medPri, lowPri, 1);
      var priColors = ['var(--accent)', 'var(--warn)', '#666'];
      var priLabels = ['\u9AD8', '\u4E2D', '\u4F4E'];
      var priValues = [highPri, medPri, lowPri];
      var priRates = [highPriRate, medPriRate, lowPriRate];
      var priBarsHtml = '';
      for (var pi = 0; pi < 3; pi++) {
        priBarsHtml += '<div class="annual-pri-row">' +
          '<div class="annual-pri-label">' + priLabels[pi] + '</div>' +
          '<div class="annual-pri-bar-bg">' +
            '<div class="annual-pri-bar-fill" style="width:' + (priValues[pi] / priMax * 100) + '%; background:' + priColors[pi] + ';"></div>' +
          '</div>' +
          '<div class="annual-pri-count">' + priValues[pi] + ' (' + priRates[pi].toFixed(0) + '%)</div>' +
        '</div>';
      }

      var narrative = generateNarrative(totalTasks, doneTasks, doneRate, busiestMonth, busiestDate, busiestDateCount, highPri, medPri, lowPri, activeDays, firstHalf, secondHalf, monthData, annualYear);

      content.innerHTML = 
        '<div class="annual-year-title"><span>' + annualYear + ' \u5E74\u5EA6\u62A5\u544A</span></div>' +
        '<div class="annual-hero">' +
          '<div class="annual-ending-title">' + ending.title + '</div>' +
          '<div class="annual-ending-subtitle">' + ending.subtitle + '</div>' +
          '<div class="annual-ending-desc">' + ending.desc + '</div>' +
        '</div>' +
        '<div class="annual-divider">\u25C6 \u25C6 \u25C6</div>' +
        '<div class="annual-section-title">\u6838\u5FC3\u6570\u636E</div>' +
        '<div class="annual-stats-grid">' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + totalTasks + '</div><div class="annual-stat-label">\u603B\u4E8B\u9879\u6570</div></div>' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + doneTasks + '</div><div class="annual-stat-label">\u5DF2\u5B8C\u6210</div></div>' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + doneRate.toFixed(1) + '%</div><div class="annual-stat-label">\u5B8C\u6210\u7387</div></div>' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + activeDays + '</div><div class="annual-stat-label">\u6D3B\u8DC3\u5929\u6570</div></div>' +
        '</div>' +
        '<div class="annual-section-title">\u6708\u5EA6\u6D3B\u8DC3\u5EA6</div>' +
        '<div class="annual-month-chart">' + monthBarsHtml + '</div>' +
        '<div class="annual-section-title">\u4F18\u5148\u7EA7\u5206\u5E03</div>' +
        '<div style="margin-bottom:25px;">' + priBarsHtml + '</div>' +
        '<div class="annual-divider">\u25C6 \u25C6 \u25C6</div>' +
        '<div class="annual-section-title">\u5E74\u5EA6\u53D9\u4E8B</div>' +
        '<div class="annual-narrative">' + narrative + '<div class="annual-report-time">\u7EDF\u8BA1\u5468\u671F\uFF1A' + annualYear + '-01-01 \u81F3 ' + annualYear + '-12-31<br>\u663E\u793A\u622A\u6B62\uFF1A' + getAnnualExpiryTime() + '</div></div>';
    }

    function determineEnding(totalTasks, doneRate, highPriRate, firstHalf, secondHalf, monthData, activeDays, medPriRate, lowPriRate) {
      if (totalTasks < 5) {
        return {
          title: '\u7A7A\u767D\u753B\u5E03',
          subtitle: 'THE BLANK CANVAS',
          desc: '\u8FD9\u4E00\u5E74\uFF0C\u4F60\u9009\u62E9\u4E86\u7559\u4E0B\u5927\u7247\u7A7A\u767D\u3002\u4E5F\u8BB8\u662F\u6CA1\u6709\u4EC0\u4E48\u9700\u8981\u8BB0\u5F55\uFF0C\u4E5F\u8BB8\u662F\u6700\u597D\u7684\u5F85\u529E\u5C31\u662F\u6CA1\u6709\u5F85\u529E\u3002\u7A7A\u767D\u4E0D\u662F\u865A\u65E0\u2014\u2014\u5B83\u662F\u7B49\u5F85\u88AB\u4E66\u5199\u7684\u53EF\u80FD\u6027\u3002\u4E0B\u4E00\u5E74\uFF0C\u4F60\u4F1A\u843D\u7B14\u5417\uFF1F'
        };
      }
      if (doneRate >= 80 && totalTasks >= 50) {
        return {
          title: '\u6548\u7387\u5F15\u64CE',
          subtitle: 'THE EFFICIENCY ENGINE',
          desc: '\u4F60\u5C06\u5F85\u529E\u6E05\u5355\u89C6\u4E3A\u6218\u573A\uFF0C80%\u4EE5\u4E0A\u7684\u4EFB\u52A1\u88AB\u4F60\u65E0\u60C5\u7EC8\u7ED3\u3002\u6BCF\u4E00\u6761\u5212\u6389\u7684\u5F85\u529E\uFF0C\u90FD\u662F\u4E00\u6B21\u5BF9\u6DF7\u6C8C\u7684\u5BA3\u6218\u3002\u4F60\u662F\u79E9\u5E8F\u7684\u4FE1\u5F92\uFF0C\u6548\u7387\u7684\u5316\u8EAB\u3002\u5728\u4F60\u9762\u524D\uFF0C\u6CA1\u6709\u4EFB\u4F55\u4E00\u6761\u5F85\u529E\u80FD\u6D3B\u8FC7\u660E\u5929\u3002'
        };
      }
      if (doneRate < 30 && totalTasks >= 20) {
        return {
          title: '\u62D6\u5EF6\u54F2\u5B66\u5BB6',
          subtitle: 'THE PROCRASTINATION PHILOSOPHER',
          desc: '\u4F60\u4E0D\u662F\u5728\u62D6\u5EF6\u2014\u2014\u4F60\u662F\u5728\u601D\u8003\u3002\u90A3\u4E9B\u672A\u5B8C\u6210\u7684\u5F85\u529E\uFF0C\u6BCF\u4E00\u4E2A\u90FD\u627F\u8F7D\u7740\u6DF1\u9083\u7684\u72B9\u8C6B\u4E0E\u65E0\u9650\u7684\u53EF\u80FD\u3002\u4E5F\u8BB8\u660E\u5929\uFF0C\u4E5F\u8BB8\u4E0B\u8F88\u5B50\uFF0C\u5B83\u4EEC\u7EC8\u5C06\u88AB\u5B8C\u6210\u3002\u81F3\u5C11\uFF0C\u4F60\u5199\u4E0B\u4E86\u5B83\u4EEC\u3002'
        };
      }
      if (highPriRate > 40 && doneRate >= 60) {
        return {
          title: '\u6218\u7565\u89C4\u5212\u5E08',
          subtitle: 'THE STRATEGIC PLANNER',
          desc: '\u4F60\u53EA\u5173\u6CE8\u771F\u6B63\u91CD\u8981\u7684\u4E8B\u3002\u9AD8\u4F18\u5148\u7EA7\u662F\u4F60\u7684\u6B66\u5668\uFF0C\u5B8C\u6210\u7387\u662F\u4F60\u7684\u6218\u7EE9\u3002\u65E0\u5173\u7D27\u8981\u7684\u4E8B\uFF1F\u4E0D\u914D\u51FA\u73B0\u5728\u4F60\u7684\u6E05\u5355\u4E0A\u3002\u4F60\u4E0D\u662F\u5728\u505A\u5F85\u529E\u2014\u2014\u4F60\u662F\u5728\u6307\u6325\u6218\u5F79\u3002'
        };
      }
      if (totalTasks < 30 && doneRate >= 70) {
        return {
          title: '\u7CBE\u51C6\u6253\u51FB\u8005',
          subtitle: 'THE PRECISION STRIKER',
          desc: '\u5C11\u5373\u662F\u591A\u3002\u4F60\u4E0D\u8D2A\u591A\uFF0C\u4F46\u6BCF\u4E00\u53D1\u90FD\u547D\u4E2D\u9776\u5FC3\u3002\u4F60\u7684\u5F85\u529E\u6E05\u5355\u77ED\u5C0F\u7CBE\u608D\uFF0C\u5374\u5F39\u65E0\u865A\u53D1\u3002\u771F\u6B63\u7684\u9AD8\u624B\uFF0C\u4ECE\u4E0D\u9700\u8981\u6EE1\u5C4F\u7684\u7EA2\u70B9\u6765\u8BC1\u660E\u81EA\u5DF1\u7684\u5B58\u5728\u3002'
        };
      }
      if (totalTasks >= 100 && doneRate < 50) {
        return {
          title: '\u5F85\u529E\u6536\u85CF\u5BB6',
          subtitle: 'THE TODO COLLECTOR',
          desc: '\u4F60\u7684\u5F85\u529E\u6E05\u5355\u662F\u4E00\u5EA7\u535A\u7269\u9986\u3002\u6BCF\u4E00\u9879\u90FD\u88AB\u7CBE\u5FC3\u6536\u85CF\uFF0C\u5374\u9C9C\u6709\u4EBA\u95EE\u6D25\u3002\u4F46\u8C01\u77E5\u9053\u5462\uFF1F\u4E5F\u8BB8\u67D0\u5929\u4F60\u4F1A\u6253\u5F00\u5B83\uFF0C\u7136\u540E\u60CA\u53F9\u4E8E\u81EA\u5DF1\u66FE\u7ECF\u7684\u91CE\u5FC3\u548C\u60F3\u8C61\u3002'
        };
      }
      if (firstHalf > 0 && secondHalf >= 0 && firstHalf > secondHalf * 2) {
        return {
          title: '\u5F00\u5C40\u738B\u8005',
          subtitle: 'THE QUICK STARTER',
          desc: '\u5E74\u521D\u7684\u4F60\u610F\u6C14\u98CE\u53D1\uFF0C\u96C4\u5FC3\u4E07\u4E08\u3002\u4F46\u65F6\u95F4\u662F\u6700\u597D\u7684\u7A00\u91CA\u5242\u3002\u4F60\u7684\u6545\u4E8B\u603B\u662F\u4ECE"\u8FD9\u6B21\u4E00\u5B9A"\u5F00\u59CB\uFF0C\u7136\u540E\u4EE5"\u4E0B\u6B21\u518D\u8BF4"\u6536\u5C3E\u3002\u4F46\u81F3\u5C11\uFF0C\u4F60\u7684\u5F00\u5C40\u603B\u662F\u6F02\u4EAE\u7684\u3002'
        };
      }
      if (secondHalf > firstHalf * 2 && firstHalf > 0) {
        return {
          title: '\u540E\u53D1\u5236\u4EBA',
          subtitle: 'THE LATE BLOOMER',
          desc: '\u4E0A\u534A\u5E74\u8FD8\u5728\u915D\u917F\uFF0C\u4E0B\u534A\u5E74\u7A81\u7136\u7206\u53D1\u3002\u4F60\u7528\u5B9E\u9645\u884C\u52A8\u8BC1\u660E\u4E86\uFF1A\u91CD\u8981\u7684\u4E0D\u662F\u4F55\u65F6\u5F00\u59CB\uFF0C\u800C\u662F\u4F55\u65F6\u53D1\u529B\u3002\u539A\u79EF\u8584\u53D1\uFF0C\u5927\u5668\u665A\u6210\u2014\u2014\u8BF4\u7684\u5C31\u662F\u4F60\u3002'
        };
      }
      var priArr = [highPriRate, medPriRate, lowPriRate];
      var maxPriDiff = Math.max.apply(null, priArr) - Math.min.apply(null, priArr);
      if (maxPriDiff < 20 && doneRate >= 55 && doneRate <= 85) {
        return {
          title: '\u5747\u8861\u5927\u5E08',
          subtitle: 'THE BALANCE MASTER',
          desc: '\u9AD8\u3001\u4E2D\u3001\u4F4E\u4F18\u5148\u7EA7\u5728\u4F60\u624B\u4E2D\u5747\u5300\u5206\u5E03\u3002\u4F60\u4E0D\u504F\u5E9F\uFF0C\u4E0D\u5192\u8FDB\uFF0C\u4EE5\u4E2D\u5EB8\u4E4B\u9053\u9A7E\u9A6D\u65F6\u95F4\u3002\u8FD9\u4E16\u4E0A\u6CA1\u6709\u4F60\u7279\u522B\u5728\u610F\u7684\u4E8B\uFF0C\u4E5F\u6CA1\u6709\u4F60\u613F\u610F\u653E\u5F03\u7684\u4E8B\u2014\u2014\u4E5F\u8BB8\u8FD9\u5C31\u662F\u6700\u5927\u7684\u667A\u6167\u3002'
        };
      }
      if (doneRate >= 50 && doneRate < 80 && totalTasks >= 30 && totalTasks < 100) {
        return {
          title: '\u4ECE\u5BB9\u884C\u8005',
          subtitle: 'THE STEADY WALKER',
          desc: '\u4E0D\u6025\u4E0D\u8E81\uFF0C\u6309\u81EA\u5DF1\u7684\u8282\u594F\u524D\u884C\u3002\u4F60\u5B8C\u6210\u7684\u6BCF\u4E00\u4EF6\u4E8B\u90FD\u6709\u5206\u91CF\uFF0C\u672A\u5B8C\u6210\u7684\u4E5F\u4E0D\u8FC7\u662F\u7559\u7ED9\u672A\u6765\u7684\u793C\u7269\u3002\u4F60\u4E0D\u9700\u8981\u88AB\u5B9A\u4E49\u2014\u2014\u4F60\u7684\u5F85\u529E\u6E05\u5355\uFF0C\u5C31\u662F\u4F60\u81EA\u5DF1\u3002'
        };
      }
      if (doneRate >= 30 && doneRate < 50 && totalTasks >= 30) {
        return {
          title: '\u534A\u9014\u65C5\u4EBA',
          subtitle: 'THE HALFWAY TRAVELER',
          desc: '\u4F60\u5F00\u59CB\u4E86\uFF0C\u4F46\u7ECF\u5E38\u6CA1\u6709\u5230\u8FBE\u3002\u8FD9\u4E0D\u4E22\u4EBA\u2014\u2014\u6BCF\u4E00\u6BB5\u65C5\u7A0B\u90FD\u6709\u610F\u4E49\uFF0C\u5373\u4F7F\u6CA1\u6709\u8D70\u5230\u7EC8\u70B9\u3002\u4F60\u7684\u6E05\u5355\u4E0A\u5199\u6EE1\u4E86"\u8FDB\u884C\u4E2D"\uFF0C\u800C"\u8FDB\u884C\u4E2D"\u672C\u8EAB\u5C31\u662F\u4E00\u79CD\u6001\u5EA6\u3002'
        };
      }
      return {
        title: '\u5F85\u529E\u63A2\u7D22\u8005',
        subtitle: 'THE TODO EXPLORER',
        desc: '\u4F60\u5728\u5F85\u529E\u7684\u4E16\u754C\u91CC\u6F2B\u6E38\uFF0C\u4E0D\u4E3A\u5F81\u670D\uFF0C\u53EA\u4E3A\u63A2\u7D22\u3002\u6BCF\u4E00\u6761\u8BB0\u5F55\u90FD\u662F\u4E00\u6B21\u5C1D\u8BD5\uFF0C\u6BCF\u4E00\u6B21\u5B8C\u6210\u90FD\u662F\u4E00\u6B21\u60CA\u559C\u3002\u6CA1\u6709KPI\uFF0C\u6CA1\u6709\u76EE\u6807\u2014\u2014\u53EA\u6709\u4F60\u548C\u4F60\u7684\u6E05\u5355\u3002'
      };
    }

    function generateNarrative(totalTasks, doneTasks, doneRate, busiestMonth, busiestDate, busiestDateCount, highPri, medPri, lowPri, activeDays, firstHalf, secondHalf, monthData, year) {
      var monthNames = ['\u4E00\u6708','\u4E8C\u6708','\u4E09\u6708','\u56DB\u6708','\u4E94\u6708','\u516D\u6708','\u4E03\u6708','\u516B\u6708','\u4E5D\u6708','\u5341\u6708','\u5341\u4E00\u6708','\u5341\u4E8C\u6708'];
      var n = '';

      n += '<strong>' + year + '</strong> \u5E74\uFF0C\u4F60\u4E00\u5171\u521B\u5EFA\u4E86 <em>' + totalTasks + '</em> \u6761\u5F85\u529E\u4E8B\u9879\u3002';

      if (totalTasks === 0) {
        n += '\u8FD9\u4E00\u5E74\u4F60\u7684\u6E05\u5355\u7A7A\u7A7A\u5982\u4E5F\u3002\u4E5F\u8BB8\u4F60\u6D3B\u5728\u5F53\u4E0B\uFF0C\u4ECE\u4E0D\u9700\u8981\u8BA1\u5212\u2014\u2014\u53C8\u6216\u8005\uFF0C\u4F60\u672C\u8EAB\u5C31\u662F\u6700\u597D\u7684\u8BA1\u5212\u3002';
        return n;
      }

      n += '\u5176\u4E2D <em>' + doneTasks + '</em> \u6761\u88AB\u4F60\u4EB2\u624B\u7EC8\u7ED3\uFF0C\u5B8C\u6210\u7387 <em>' + doneRate.toFixed(1) + '%</em>\u3002';

      if (doneRate >= 90) n += '\u8FD9\u662F\u4E00\u4E2A\u4EE4\u4EBA\u656C\u754F\u7684\u6570\u5B57\u3002\u4F60\u7684\u6E05\u5355\u4E0A\u51E0\u4E4E\u6CA1\u6709\u9003\u8131\u8005\u3002';
      else if (doneRate >= 70) n += '\u5927\u591A\u6570\u4EFB\u52A1\u6CA1\u80FD\u9003\u8FC7\u4F60\u7684\u8FFD\u51FB\uFF0C\u5C11\u6570\u5E78\u5B58\u8005\u5927\u6982\u5728\u745F\u745F\u53D1\u6296\u3002';
      else if (doneRate >= 50) n += '\u4E00\u534A\u505A\u4E86\uFF0C\u4E00\u534A\u6CA1\u505A\u3002\u8FD9\u5927\u6982\u662F\u4E16\u754C\u4E0A\u6700\u8BDA\u5B9E\u7684\u6BD4\u4F8B\u3002';
      else if (doneRate >= 30) n += '\u867D\u7136\u5B8C\u6210\u7684\u4E0D\u591A\uFF0C\u4F46\u6BCF\u4E00\u6761\u90FD\u662F\u8BDA\u610F\u4E4B\u4F5C\u2026\u2026\u5927\u6982\u5427\u3002';
      else n += '\u4F60\u7684\u5F85\u529E\u6E05\u5355\u66F4\u50CF\u662F\u4E00\u4E2A\u8BB8\u613F\u6C60\u2014\u2014\u6254\u8FDB\u53BB\u7684\u786C\u5E01\uFF0C\u5076\u5C14\u4F1A\u53D1\u5149\u3002';

      n += '<br><br>';
      n += '\u4F60\u5728 <em>' + activeDays + '</em> \u4E2A\u4E0D\u540C\u7684\u65E5\u5B50\u91CC\u6253\u5F00\u4E86\u8FD9\u4E2A\u5E94\u7528\u3002';

      if (activeDays >= 300) n += '\u51E0\u4E4E\u6CA1\u6709\u4E00\u5929\u7F3A\u5E2D\u2014\u2014\u4F60\u6BD4\u6253\u5361\u673A\u8FD8\u51C6\u65F6\u3002';
      else if (activeDays >= 200) n += '\u4E00\u5E74\u4E09\u5206\u4E4B\u4E8C\u7684\u65F6\u95F4\u4F60\u90FD\u5728\u8FD9\u91CC\uFF0C\u8FD9\u5DF2\u7ECF\u4E0D\u662F\u4E60\u60EF\uFF0C\u662F\u4FE1\u4EF0\u3002';
      else if (activeDays >= 100) n += '\u4E09\u5929\u6253\u9C7C\u4E24\u5929\u6652\u7F51\uFF1F\u4E0D\uFF0C\u4F60\u53EA\u662F\u9009\u62E9\u5728\u91CD\u8981\u7684\u65E5\u5B50\u51FA\u73B0\u3002';
      else if (activeDays >= 30) n += '\u5076\u5C14\u6765\u770B\u770B\uFF0C\u786E\u8BA4\u6E05\u5355\u8FD8\u5728\uFF0C\u7136\u540E\u79BB\u5F00\u3002\u8FD9\u4E5F\u662F\u4E00\u79CD\u4F7F\u7528\u65B9\u5F0F\u3002';
      else n += '\u4F60\u6765\u53BB\u5982\u98CE\uFF0C\u50CF\u4E00\u4F4D\u795E\u79D8\u7684\u8BBF\u5BA2\u3002\u6E05\u5355\u8BB0\u5F97\u4F60\u6765\u8FC7\u3002';

      n += '<br><br>';

      if (busiestMonth >= 0 && monthData[busiestMonth].total > 0) {
        n += '<strong>' + monthNames[busiestMonth] + '</strong> \u662F\u4F60\u6700\u5FD9\u788C\u7684\u6708\u4EFD\uFF0C\u4E00\u5171 <em>' + monthData[busiestMonth].total + '</em> \u6761\u4E8B\u9879\u6D8C\u5165';
        var bDoneRate = monthData[busiestMonth].total > 0 ? (monthData[busiestMonth].done / monthData[busiestMonth].total * 100).toFixed(0) : 0;
        n += '\uFF0C\u5F53\u6708\u5B8C\u6210\u7387 <em>' + bDoneRate + '%</em>\u3002';
        if (monthData[busiestMonth].total >= 30) n += '\u90A3\u6BB5\u65F6\u95F4\u4F60\u4E00\u5B9A\u5FD9\u5F97\u4E0D\u53EF\u5F00\u63AA\u3002';
        else if (monthData[busiestMonth].total >= 15) n += '\u867D\u7136\u5FD9\u788C\uFF0C\u4F46\u4F60\u625B\u8FC7\u6765\u4E86\u3002';
      }

      if (busiestDate !== '--') {
        n += '\u800C <strong>' + busiestDate + '</strong> \u662F\u4F60\u6700\u5145\u5B9E\u7684\u4E00\u5929\uFF0C\u5355\u65E5\u521B\u5EFA <em>' + busiestDateCount + '</em> \u6761\u5F85\u529E\u3002';
      }

      n += '<br><br>';

      var total = highPri + medPri + lowPri;
      if (total > 0) {
        if (highPri > medPri && highPri > lowPri) {
          n += '\u4F60\u7684\u6E05\u5355\u4E2D\u9AD8\u4F18\u5148\u7EA7\u4E8B\u9879\u5360\u4E86 <em>' + (highPri/total*100).toFixed(0) + '%</em>\u2014\u2014\u4F60\u603B\u662F\u5148\u5904\u7406\u6700\u7D27\u6025\u7684\u4E8B\uFF0C\u6216\u8005\u8BF4\uFF0C\u4F60\u5236\u9020\u4E86\u592A\u591A\u7D27\u6025\u7684\u4E8B\u3002';
        } else if (lowPri > highPri && lowPri > medPri) {
          n += '\u4F4E\u4F18\u5148\u7EA7\u4E8B\u9879\u5360\u4E86 <em>' + (lowPri/total*100).toFixed(0) + '%</em>\u2014\u2014\u770B\u8D77\u6765\u4F60\u7684\u5927\u591A\u6570\u5F85\u529E\u90FD"\u4E0D\u90A3\u4E48\u91CD\u8981"\u3002\u4F46\u8C01\u77E5\u9053\u5462\uFF0C\u4E5F\u8BB8"\u4E0D\u91CD\u8981"\u624D\u662F\u6700\u8BDA\u5B9E\u7684\u6807\u7B7E\u3002';
        } else if (medPri >= highPri && medPri >= lowPri) {
          n += '\u4E2D\u4F18\u5148\u7EA7\u4E8B\u9879\u5360\u636E\u4E86 <em>' + (medPri/total*100).toFixed(0) + '%</em>\u2014\u2014\u5927\u591A\u6570\u4E8B\u60C5\u65E2\u4E0D\u7D27\u6025\u4E5F\u4E0D\u53EF\u5FFD\u7565\u3002\u8FD9\u5C31\u662F\u751F\u6D3B\u7684\u771F\u76F8\uFF1A\u5E73\u6DE1\u800C\u6301\u7EED\u3002';
        } else {
          n += '\u9AD8\u3001\u4E2D\u3001\u4F4E\u4F18\u5148\u7EA7\u5747\u5300\u5206\u5E03\uFF0C\u4F60\u5BF9\u5F85\u6BCF\u4E00\u4EF6\u4E8B\u90FD\u4E00\u89C6\u540C\u4EC1\u2026\u2026\u6216\u8005\u8BF4\uFF0C\u4F60\u5BF9\u4F18\u5148\u7EA7\u8FD9\u4E2A\u529F\u80FD\u6709\u4E9B\u968F\u610F\u3002';
        }
      }

      n += '<br><br>';

      if (firstHalf > 0 || secondHalf > 0) {
        if (firstHalf > secondHalf * 1.5 && secondHalf > 0) {
          n += '\u4E0A\u534A\u5E74\u4F60\u610F\u6C14\u98CE\u53D1\uFF0C\u4EA7\u51FA\u4E86 <em>' + firstHalf + '</em> \u6761\u4E8B\u9879\uFF1B\u4E0B\u534A\u5E74\u53EA\u6709 <em>' + secondHalf + '</em> \u6761\u3002\u7ECF\u5178\u7684\u4E09\u5206\u949F\u70ED\u5EA6\u66F2\u7EBF\u3002';
        } else if (secondHalf > firstHalf * 1.5 && firstHalf > 0) {
          n += '\u4E0B\u534A\u5E74\u4F60\u7A81\u7136\u53D1\u529B\uFF0C\u4EA7\u51FA\u4E86 <em>' + secondHalf + '</em> \u6761\u4E8B\u9879\uFF0C\u8FDC\u8D85\u4E0A\u534A\u5E74\u7684 <em>' + firstHalf + '</em> \u6761\u3002\u540E\u53D1\u5236\u4EBA\uFF0C\u5927\u5668\u665A\u6210\u3002';
        } else if (firstHalf === secondHalf && firstHalf > 0) {
          n += '\u4E0A\u4E0B\u534A\u5E74\u5404\u4EA7\u51FA <em>' + firstHalf + '</em> \u6761\u4E8B\u9879\uFF0C\u8282\u594F\u7A33\u5B9A\u5982\u949F\u3002\u4F60\u662F\u65F6\u95F4\u7684\u670B\u53CB\u3002';
        } else if (firstHalf > 0 && secondHalf > 0) {
          n += '\u4E0A\u4E0B\u534A\u5E74\u5404\u4EA7\u51FA <em>' + firstHalf + '</em> \u548C <em>' + secondHalf + '</em> \u6761\u4E8B\u9879\uFF0C\u8282\u594F\u57FA\u672C\u7A33\u5B9A\u3002';
        } else if (firstHalf > 0 && secondHalf === 0) {
          n += '\u6240\u6709\u7684\u4E8B\u9879\u90FD\u96C6\u4E2D\u5728\u4E0A\u534A\u5E74\u3002\u4E0B\u534A\u5E74\uFF1F\u5927\u6982\u662F\u5728\u4EAB\u53D7\u4E0A\u534A\u5E74\u7684\u52B3\u52A8\u6210\u679C\u3002';
        } else {
          n += '\u6240\u6709\u7684\u4E8B\u9879\u90FD\u96C6\u4E2D\u5728\u4E0B\u534A\u5E74\u3002\u4E0A\u534A\u5E74\uFF1F\u5927\u6982\u662F\u5728\u79EF\u84C4\u529B\u91CF\u3002';
        }
      }

      n += '<br><br>';

      // \u627E\u51FA\u6709\u6570\u636E\u7684\u6708\u4EFD\u6570
      var activeMonths = 0;
      monthData.forEach(function(m) { if (m.total > 0) activeMonths++; });
      n += '\u8FD9\u4E00\u5E74\u6709 <em>' + activeMonths + '</em> \u4E2A\u6708\u4EFD\u7559\u4E0B\u4E86\u4F60\u7684\u8BB0\u5F55\u3002';

      if (activeMonths >= 10) n += '\u4F60\u51E0\u4E4E\u5168\u5E74\u65E0\u4F11\uFF0C\u662F\u771F\u6B63\u7684\u5F85\u529E\u5E38\u9A7B\u5C45\u6C11\u3002';
      else if (activeMonths >= 6) n += '\u5927\u534A\u5E74\u7684\u65F6\u95F4\u4F60\u90FD\u5728\u4E0E\u6E05\u5355\u4E3A\u4F34\u3002';
      else if (activeMonths >= 3) n += '\u4F60\u53EA\u5728\u67D0\u4E9B\u65F6\u6BB5\u51FA\u73B0\uFF0C\u50CF\u5019\u9E1F\u4E00\u6837\u6709\u89C4\u5F8B\u5730\u8FC1\u5F99\u3002';
      else n += '\u4F60\u7684\u8BB0\u5F55\u96F6\u661F\u800C\u73CD\u8D35\uFF0C\u50CF\u591C\u7A7A\u4E2D\u5076\u5C14\u95EA\u8FC7\u7684\u6D41\u661F\u3002';

      n += '<br><br>';
      n += '\u8FD9\u5C31\u662F\u4F60\u7684 <strong>' + year + '</strong> \u5E74\u5F85\u529E\u6545\u4E8B\u3002\u65E0\u8BBA\u7ED3\u5C40\u5982\u4F55\uFF0C\u6BCF\u4E00\u6761\u8BB0\u5F55\u90FD\u662F\u4F60\u8BA4\u771F\u6D3B\u8FC7\u7684\u8BC1\u636E\u3002';

      return n;
    }
    
    function getAnnualExpiryTime() {
      var y = annualYear + 1;
      return y + '-01-07 23:59:59';
    }

    function renderStatsCharts(rawData, datesArray) {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const cText = isLight ? '#111111' : '#ffffff';
      const cBg = isLight ? '#F0EEE2' : '#0a0a0a';
      const cPanel = isLight ? '#E5E5E5' : '#222222';
      const cBorder = isLight ? '#1B1915' : '#555555';
      const cAccent = isLight ? '#CE2424' : '#ff3300';
      const cWarn = isLight ? '#E1AC07' : '#ff9900';
      const cGray = isLight ? '#999999' : '#666666';

      const cFont = getComputedStyle(document.documentElement).getPropertyValue('--font-main').trim() || 'Courier New';

      Chart.defaults.color = cText;
      Chart.defaults.font.family = cFont;
      Chart.defaults.font.weight = 'bold';
      Chart.defaults.plugins.tooltip.backgroundColor = isLight ? '#ffffff' : '#141414';
      Chart.defaults.plugins.tooltip.titleColor = cAccent;
      Chart.defaults.plugins.tooltip.bodyColor = cText;
      Chart.defaults.plugins.tooltip.borderColor = cBorder;
      Chart.defaults.plugins.tooltip.borderWidth = 1;

      let dailyDoneCounts = {};
      let dailyTotalCounts = {};
      datesArray.forEach(d => {
        dailyDoneCounts[d] = 0;
        dailyTotalCounts[d] = 0;
      });
      let totalDone = 0;

      let priCounts = { high: 0, med: 0, low: 0 };
      let statusCounts = { done: 0, undone: 0 };

      rawData.forEach(row => {
        if (row.done === 1) statusCounts.done++;
        else statusCounts.undone++;

        if (row.priority === 'high') priCounts.high++;
        else if (row.priority === 'med') priCounts.med++;
        else priCounts.low++;

        if (dailyTotalCounts[row.date] !== undefined) {
          dailyTotalCounts[row.date]++;
          if (row.done === 1) {
            dailyDoneCounts[row.date]++;
            totalDone++;
          }
        }
      });

      document.getElementById('stats-total-info').innerText = "\u8FD17\u5929\u603B\u5B8C\u6210\u6570: " + totalDone;
      document.getElementById('stats-total-info').style.color = cText;

      // \u67F1\u72B6\u56FE (\u6BCF\u65E5\u603B\u6570 vs \u5B8C\u6210\u6570)
      const ctxBar = document.getElementById('chart-bar').getContext('2d');
      chartInstanceBar = new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: datesArray.map(d => d.slice(5)), // \u4EC5\u663E\u793A MM-DD
          datasets: [
            {
              label: '\u5F53\u65E5\u603B\u4E8B\u9879',
              data: datesArray.map(d => dailyTotalCounts[d]),
              backgroundColor: cPanel,
              borderColor: cBorder,
              borderWidth: 1
            },
            {
              label: '\u5F53\u65E5\u5B8C\u6210\u4E8B\u9879',
              data: datesArray.map(d => dailyDoneCounts[d]),
              backgroundColor: cAccent,
              borderColor: cBorder,
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 800, easing: 'easeOutQuart' },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, color: cText }, grid: { color: cPanel } },
            x: { ticks: { color: cText }, grid: { color: cPanel } }
          },
          plugins: {
            legend: { labels: { color: cText, font: { weight: 'bold' } } }
          }
        }
      });

      // \u5706\u73AF\u56FE (\u4F18\u5148\u7EA7\u5360\u6BD4)
      const ctxPri = document.getElementById('chart-pie-priority').getContext('2d');
      chartInstancePri = new Chart(ctxPri, {
        type: 'doughnut',
        data: {
          labels: ['\u9AD8', '\u4E2D', '\u4F4E'],
          datasets: [{
            data: [priCounts.high, priCounts.med, priCounts.low],
            backgroundColor: [cAccent, cWarn, cGray],
            borderColor: cBg,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 800, easing: 'easeOutQuart' },
          plugins: {
            legend: { position: 'bottom', labels: { color: cText, padding: 10, boxWidth: 12, font: { weight: 'bold' } } },
            title: { display: true, text: '\u4F18\u5148\u7EA7\u5360\u6BD4', color: cText, font: { size: 14, weight: 'bold' } },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let dataArr = context.dataset.data;
                  let total = 0;
                  for (let i = 0; i < dataArr.length; i++) {
                    total += dataArr[i];
                  }
                  let percentage = total === 0 ? 0 : Math.round((context.raw / total) * 100);
                  return context.raw + ' (' + percentage + '%)';
                }
              }
            }
          }
        }
      });

      // \u5706\u73AF\u56FE (\u5B8C\u6210\u7387\u5360\u6BD4)
      const ctxStat = document.getElementById('chart-pie-status').getContext('2d');
      chartInstanceStat = new Chart(ctxStat, {
        type: 'doughnut',
        data: {
          labels: ['\u5DF2\u5B8C\u6210', '\u672A\u5B8C\u6210'],
          datasets: [{
            data: [statusCounts.done, statusCounts.undone],
            backgroundColor:[cGray, cAccent],
            borderColor: cBg,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 800, easing: 'easeOutQuart' },
          plugins: {
            legend: { position: 'bottom', labels: { color: cText, padding: 10, boxWidth: 12, font: { weight: 'bold' } } },
            title: { display: true, text: '\u4E8B\u9879\u5B8C\u6210\u7387', color: cText, font: { size: 14, weight: 'bold' } },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let dataArr = context.dataset.data;
                  let total = 0;
                  for (let i = 0; i < dataArr.length; i++) {
                    total += dataArr[i];
                  }
                  let percentage = total === 0 ? 0 : Math.round((context.raw / total) * 100);
                  return context.raw + ' (' + percentage + '%)';
                }
              }
            }
          }
        }
      });
    }
`;

// src/html/js/trash.js
var trash = `
    function openTrash() {
      exitTrashBatchMode();
      const trashView = document.getElementById('trash-overlay');
      trashView.classList.remove('closing');
      trashView.classList.add('active');
      loadTrashData();
    }

    function closeTrash() {
      exitTrashBatchMode();
      const trashView = document.getElementById('trash-overlay'); 
      trashView.classList.add('closing');
      trashView.addEventListener('animationend', function handler() {
        trashView.classList.remove('active'); 
        trashView.classList.remove('closing'); 
        trashView.removeEventListener('animationend', handler);
      });
      loadTodos(); 
    }

    async function loadTrashData() {
      const list = document.getElementById('trash-list');
      list.innerHTML = '<div style="padding:20px;text-align:center;">\u6570\u636E\u62C9\u53D6\u4E2D...</div>';
      try {
        const res = await fetch('/api/trash');
        if (res.ok) {
          trashTodos = await res.json();
          renderTrashItems();
        }
      } catch(e) { list.innerHTML = '<div style="color:var(--warn);text-align:center;">\u52A0\u8F7D\u5931\u8D25</div>'; }
    }

    function renderTrashItems() {
      const list = document.getElementById('trash-list');
      list.innerHTML = '';
      if (trashTodos.length === 0) {
        list.innerHTML = '<div style="padding:40px;text-align:center;border:1px dashed #666;">\u56DE\u6536\u7AD9\u4E3A\u7A7A</div>';
        return;
      }
      trashTodos.forEach((todo, index) => {
        const el = document.createElement('div');
        el.className = 'todo-item';
        
        let checkboxHtml = '';
        let actionsHtml = '';

        if (isTrashBatchMode) {
          const isSelected = selectedTrashTasks.has(index);
          checkboxHtml = \`<div class="checkbox \${isSelected ? 'batch-selected' : ''}" onclick="event.stopPropagation(); toggleTrashBatchSelect(\${index})"></div>\`;
        } else {
          actionsHtml = \`
            <button class="btn-ghost" style="padding:4px 8px; border:1px solid #666;" onclick="event.stopPropagation(); actionTrash('\${todo.id}', 'RESTORE')">\u6062\u590D</button>
            <button class="btn-danger" style="padding:4px 8px; margin-left:8px;" onclick="event.stopPropagation(); actionTrash('\${todo.id}', 'DELETE_PERMANENT')">\u5220\u9664</button>
          \`;
        }

        el.innerHTML = \`
          \${checkboxHtml}
          <div class="item-meta" style="opacity:0.7;">
            <div class="item-title" style="text-decoration:line-through;">\${todo.text}</div>
            <div class="item-info">\u539F\u65E5\u671F: \${todo.date}</div>
          </div>
          \${actionsHtml}
        \`;

        if (isTrashBatchMode) {
            el.onclick = () => toggleTrashBatchSelect(index);
        } else {
            el.style.cursor = 'default';
        }

        list.appendChild(el);
      });
    }

    function toggleTrashBatchMode() {
      if (isTrashBatchMode) {
        exitTrashBatchMode();
      } else {
        isTrashBatchMode = true;
        selectedTrashTasks.clear();
        const bar = document.getElementById('trash-batch-bar');
        bar.classList.remove('hidden', 'closing');
        document.getElementById('btn-trash-batch').classList.add('active');
        renderTrashItems();
      }
    }

    function exitTrashBatchMode() {
      if (!isTrashBatchMode) return;
      isTrashBatchMode = false;
      selectedTrashTasks.clear();
      const bar = document.getElementById('trash-batch-bar');
      bar.classList.add('closing');
      bar.addEventListener('animationend', function handler() {
        bar.classList.add('hidden');
        bar.classList.remove('closing');
        bar.removeEventListener('animationend', handler);
      });
      document.getElementById('btn-trash-batch').classList.remove('active');
      renderTrashItems();
    }

    function toggleTrashBatchSelect(index) {
      if (selectedTrashTasks.has(index)) selectedTrashTasks.delete(index);
      else selectedTrashTasks.add(index);
      renderTrashItems();
    }

    function batchTrashSelectAll() {
      if (selectedTrashTasks.size === trashTodos.length && trashTodos.length > 0) {
        selectedTrashTasks.clear();
      } else {
        trashTodos.forEach((_, i) => selectedTrashTasks.add(i));
      }
      renderTrashItems();
    }

    async function batchTrashRestore() {
      if (selectedTrashTasks.size === 0) return;
      const ids = Array.from(selectedTrashTasks).map(idx => trashTodos[idx].id);
      await fetch('/api/trash-action', {
        method: 'POST', body: JSON.stringify({ action: 'BATCH_RESTORE', ids })
      });
      exitTrashBatchMode();
      loadTrashData();
    }

    async function batchTrashDelete() {
      if (selectedTrashTasks.size === 0) return;
      if (!confirm(\`\u4F60\u4F1A\u6C38\u8FDC\u5931\u53BB \${selectedTrashTasks.size} \u4E2A\u4E8B\u9879\uFF01\`)) return;
      const ids = Array.from(selectedTrashTasks).map(idx => trashTodos[idx].id);
      await fetch('/api/trash-action', {
        method: 'POST', body: JSON.stringify({ action: 'BATCH_DELETE_PERMANENT', ids })
      });
      exitTrashBatchMode();
      loadTrashData();
    }

    async function actionTrash(id, action) {
      if (action === 'DELETE_PERMANENT' && !confirm('\u4F60\u4F1A\u6C38\u8FDC\u5931\u53BB\u5B83\uFF0C\u786E\u8BA4\uFF1F')) return;
      await fetch('/api/trash-action', {
        method: 'POST', body: JSON.stringify({ action, id }),
        headers: { 'Content-Type': 'application/json' }
      });
      loadTrashData();
    }

    async function clearTrash() {
      if (!confirm('\u786E\u8BA4\u6E05\u7A7A\uFF1F\u4F60\u4F1A\u6C38\u8FDC\u5931\u53BB\u5B83\u4EEC\uFF01')) return;
      await fetch('/api/trash-action', {
        method: 'POST', body: JSON.stringify({ action: 'CLEAR_ALL' }),
        headers: { 'Content-Type': 'application/json' }
      });
      loadTrashData();
    }

`;

// src/html/js/categories.js
var categories = `
    function addTempSubtask(mode) {
      const inputId = mode === 'add' ? 'add-subtask-input' : 'edit-subtask-input';
      const input = document.getElementById(inputId);
      const text = input.value.trim();
      if (text) {
        tempSubtasks.push({ text: text, done: false });
        input.value = '';
        renderTempSubtasks(mode);
      }
    }

    function removeTempSubtask(mode, index) {
      tempSubtasks.splice(index, 1);
      renderTempSubtasks(mode);
    }

    function renderTempSubtasks(mode) {
      const listId = mode === 'add' ? 'add-subtasks-list' : 'edit-subtasks-list';
      const list = document.getElementById(listId);
      if (!list) return;
      list.innerHTML = tempSubtasks.map((st, i) => \`
        <div class="subtask-edit-item">
          <span class="flex-1" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${st.text}</span>
          <button class="btn-danger" style="padding:4px 8px;" onclick="removeTempSubtask('\${mode}', \${i})">\u5220</button>
        </div>
      \`).join('');
    }

    function renderSearchTerms(mode) {
      const preview = document.getElementById(mode + '-search-preview');
      if (!preview) return;
      preview.innerHTML = tempSearchTerms.map((termObj, i) => {
        const text = termObj.text;
        const safeText = encodeURIComponent(text).replace(/'/g, "%27");
        return \`<div class="search-term-tag \${termObj.done ? 'done' : ''}">
          <div class="search-term-checkbox" onclick="toggleTempSearchTerm('\${mode}', \${i})"></div>
          <span>\${text}</span>
          <button onclick="copyTempSearchTerm('\${mode}', \${i}, '\${safeText}')">\u2398</button>
        </div>\`;
      }).join('');
    }

    async function regenerateSearchTerms(mode, isRefresh) {
      const preview = document.getElementById(mode + '-search-preview');
      const btn = document.getElementById(mode + '-search-regenerate-btn');
      if (!preview) return;
      const msg = isRefresh ? '\u91CD\u65B0\u62C9\u53D6\u70ED\u70B9' : '\u62C9\u53D6\u5168\u7F51\u70ED\u70B9';
      preview.innerHTML = '<div style="color:#666; width:100%; text-align:center; padding: 10px 0;">[\u7CFB\u7EDF\u8BF7\u6C42\u4E2D] \u6B63\u5728\u901A\u8FC7 CF Worker ' + msg + '...</div>';
      if (btn) btn.disabled = true;
      tempSearchTerms = await generateSearchTerms(tempSearchProvider);
      if (btn) btn.disabled = false;
      if (tempSearchTerms.length === 0) {
        preview.innerHTML = '<div style="color:var(--warn); width:100%; text-align:center;">[\u6570\u636E\u62C9\u53D6\u5931\u8D25] \u8BF7\u91CD\u8BD5\u6216\u7A0D\u540E\u518D\u8BD5</div>';
      } else {
        renderSearchTerms(mode);
      }
    }

    async function toggleSearch(mode) {
      const box = document.getElementById(mode + '-search-box');
      const actions = document.getElementById(mode + '-search-actions');
      const isOn = box.classList.contains('checked');

      if (isOn) {
        box.classList.remove('checked');
        tempSearchTerms = [];
        actions.classList.add('hidden');
        if (mode === 'add') addSearchState = false;
      } else {
        box.classList.add('checked');
        actions.classList.remove('hidden');
        if (mode === 'add') addSearchState = true;
        await regenerateSearchTerms(mode, false);
      }
    }

    function toggleAddSearch() { toggleSearch('add'); }
    function toggleEditSearch() { toggleSearch('edit'); }
    function regenerateAddSearchTerms() { regenerateSearchTerms('add', true); }
    function regenerateEditSearchTerms() { regenerateSearchTerms('edit', true); }

    function toggleTempSearchTerm(mode, index) {
      tempSearchTerms[index].done = !tempSearchTerms[index].done;
      renderSearchTerms(mode);
    }

    function copyTempSearchTerm(mode, index, safeText) {
      copyText(decodeURIComponent(safeText));
      tempSearchTerms[index].done = true;
      renderSearchTerms(mode);
    }

    function toggleRepeatMenu(mode, triggerEl) {
      activeMode = mode; 
      showPopover('popover-repeat', triggerEl, true);
    }

    function selectRepeat(val, label) {
      tempRepeatType = val;
      if (activeMode === 'add') {
        document.getElementById('add-repeat-display').innerText = '\u91CD\u590D: ' + label;
        var endRow = document.getElementById('add-repeat-end-row');
        if (endRow) endRow.style.display = (val !== 'none') ? '' : 'none';
      } else if (activeMode === 'edit') {
        document.getElementById('edit-repeat-display').innerText = '\u91CD\u590D: ' + label;
        var endRow = document.getElementById('edit-repeat-end-row');
        if (endRow) endRow.style.display = (val !== 'none') ? '' : 'none';
      }
      document.getElementById('popover-repeat').style.display = 'none';
    }

    async function loadCategories() {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          categoriesList = await res.json();
          rebuildCategoriesMap();
        }
      } catch(e) { categoriesList = []; categoriesMap.clear(); categoriesNameMap.clear(); }
    }

    function getCategoryName(catId) {
      if (!catId) return '';
      const cat = categoriesMap.get(catId);
      return cat ? cat.name : '';
    }

    function getCategoryColor(catId) {
      if (!catId) return CATEGORY_COLOR_PRESETS[0];
      const cat = categoriesMap.get(catId);
      return cat && cat.color ? cat.color : CATEGORY_COLOR_PRESETS[0];
    }

    let categorySearchQuery = '';
    let categoryMode = 'search';
    let editingCategoryId = '';
    let editingCategoryName = '';
    let isCatBatchMode = false;
    let selectedCatIds = new Set();
    let isColorBatchMode = false;
    let selectedColors = new Set();
    let categorySelectedColor = '';
    let categoryCustomColor = '';
    let customColorsList = [];
    const CATEGORY_COLOR_PRESETS = ['#888888','#F44336','#E91E63','#9C27B0','#3F51B5','#03A9F4','#4CAF50','#FF9800','#795548','#607D8B'];

    async function loadCustomColors() {
      try {
        const res = await fetch('/api/custom-colors');
        if (res.ok) {
          customColorsList = await res.json();
        }
      } catch(e) { customColorsList = []; }
    }

    function renderCategoryColorPresets() {
      const container = document.getElementById('category-color-presets');
      if (!container) return;
      container.innerHTML = '';
      CATEGORY_COLOR_PRESETS.forEach(function(color) {
        const circle = document.createElement('div');
        circle.className = 'category-color-circle' + (isColorBatchMode ? '' : (categorySelectedColor === color ? ' selected' : ''));
        if (isColorBatchMode) { circle.style.opacity = '0.35'; circle.style.cursor = 'not-allowed'; }
        circle.style.background = color;
        if (!isColorBatchMode) {
          circle.onclick = function() {
            categorySelectedColor = color;
            categoryCustomColor = '';
            var customInput = document.getElementById('category-create-name');
            if (customInput) {
              customInput.placeholder = activeMode === 'manage' && editingCategoryId ? '\u7F16\u8F91\u5206\u7C7B\u540D\u79F0...' : '\u65B0\u5EFA\u5206\u7C7B...';
              if (activeMode === 'manage' && editingCategoryId) customInput.value = editingCategoryName;
            }
            renderCategoryColorPresets();
          };
        }
        container.appendChild(circle);
      });
      customColorsList.forEach(function(color) {
        const circle = document.createElement('div');
        circle.className = 'category-color-circle' + (isColorBatchMode ? (selectedColors.has(color) ? ' selected' : '') : (categorySelectedColor === color ? ' selected' : ''));
        circle.style.background = color;
        if (isColorBatchMode) {
          circle.onclick = function() {
            selectedColors.has(color) ? selectedColors.delete(color) : selectedColors.add(color);
            renderCategoryColorPresets();
          };
        } else {
          circle.onclick = function() {
            categorySelectedColor = color;
            categoryCustomColor = '';
            var customInput = document.getElementById('category-create-name');
            if (customInput) {
              customInput.placeholder = activeMode === 'manage' && editingCategoryId ? '\u7F16\u8F91\u5206\u7C7B\u540D\u79F0...' : '\u65B0\u5EFA\u5206\u7C7B...';
              if (activeMode === 'manage' && editingCategoryId) customInput.value = editingCategoryName;
            }
            renderCategoryColorPresets();
          };
        }
        container.appendChild(circle);
      });
      if (!isColorBatchMode) {
        var customCircle = document.createElement('div');
        customCircle.className = 'category-color-custom' + (categorySelectedColor === 'custom' ? ' selected' : '');
        if (categorySelectedColor === 'custom' && categoryCustomColor) {
          customCircle.style.background = categoryCustomColor;
          customCircle.style.borderStyle = 'solid';
        }
        customCircle.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="' + (categorySelectedColor === 'custom' && categoryCustomColor ? '#fff' : 'currentColor') + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        customCircle.onclick = function() {
          categorySelectedColor = 'custom';
          categoryCustomColor = '';
          var customInput = document.getElementById('category-create-name');
          if (customInput) {
            customInput.placeholder = '#\u81EA\u5B9A\u4E49\u989C\u8272...';
            customInput.value = '';
          }
          renderCategoryColorPresets();
        };
        container.appendChild(customCircle);
      }
      if (activeMode === 'manage' && editingCategoryId) updateCategoryEditPreview();
    }

    function highlightMatch(text, query) {
      if (!query) return escapeHtml(text);
      const escaped = escapeHtml(text);
      const escapedQuery = escapeHtml(query);
      const idx = escaped.toLowerCase().indexOf(escapedQuery.toLowerCase());
      if (idx === -1) return escaped;
      return escaped.substring(0, idx) + '<span class="cat-highlight">' + escaped.substring(idx, idx + escapedQuery.length) + '</span>' + escaped.substring(idx + escapedQuery.length);
    }

    let _cachedMatchedIds = null;
    let _cachedSearchQuery = null;
    let _cachedSelectedId = null;

    function renderCategoryModalList(force) {
      const listEl = document.getElementById('category-modal-list');
      if (!listEl) return;
      const q = categorySearchQuery.trim().toLowerCase();
      const selId = activeMode === 'manage' ? '' : (tempCategoryId || '');
      if (!force && _cachedSearchQuery === q && _cachedSelectedId === selId && _cachedMatchedIds !== null) return;
      let matched = categoriesList;
      if (q) {
        matched = categoriesList.filter(c => c.name.toLowerCase().includes(q));
      }
      var newIds = matched.map(function(c) { return c.id; });
      if (!force && _cachedMatchedIds !== null && _cachedSelectedId === selId && newIds.length === _cachedMatchedIds.length && newIds.every(function(id, i) { return id === _cachedMatchedIds[i]; })) return;
      _cachedMatchedIds = newIds;
      _cachedSearchQuery = q;
      _cachedSelectedId = selId;
      listEl.innerHTML = '';
      if (!isCatBatchMode) {
        const noCatItem = document.createElement('div');
        noCatItem.className = 'category-modal-item' + (!selId ? ' selected' : '');
        noCatItem.innerHTML = '<span class="cat-name">\u65E0\u5206\u7C7B</span>';
        noCatItem.onclick = function() { selectCategory(''); };
        listEl.appendChild(noCatItem);
      }
      for (const cat of matched) {
        const item = document.createElement('div');
        if (isCatBatchMode) {
          item.className = 'category-modal-item' + (selectedCatIds.has(cat.id) ? ' selected' : '');
          item.innerHTML = '<span class="badge-category-icon" style="background:' + (cat.color || CATEGORY_COLOR_PRESETS[0]) + '"></span><span class="cat-name">' + highlightMatch(cat.name, categorySearchQuery.trim()) + '</span>';
          item.onclick = function() { selectedCatIds.has(cat.id) ? selectedCatIds.delete(cat.id) : selectedCatIds.add(cat.id); renderCategoryModalList(true); };
        } else {
          item.className = 'category-modal-item' + (selId === cat.id ? ' selected' : '');
          item.innerHTML = '<span class="badge-category-icon" style="background:' + (cat.color || CATEGORY_COLOR_PRESETS[0]) + '"></span><span class="cat-name">' + highlightMatch(cat.name, categorySearchQuery.trim()) + '</span>';
          item.onclick = function() { selectCategory(cat.id); };
        }
        listEl.appendChild(item);
      }
    }

    function onCategorySearchInput() {
      const input = document.getElementById('category-new-name');
      categorySearchQuery = input.value;
      renderCategoryModalList();
    }

    function onCategorySearchEnter() {
      const input = document.getElementById('category-new-name');
      const val = input.value.trim();
      if (!val) { categorySearchQuery = ''; renderCategoryModalList(); return; }
      const match = categoriesNameMap.get(val.toLowerCase());
      if (match) {
        selectCategory(match.id);
      } else {
        createCategoryFromModal();
      }
    }

    function openCategoryManage() {
      toggleCategoryMenu('manage');
    }

    function applyCatBatchUI() {
      var batchBtn = document.getElementById('cat-batch-btn');
      var batchBar = document.getElementById('cat-batch-bar');
      var searchRow = document.getElementById('category-search-row');
      var bottomBtns = document.querySelector('#modal-category .category-modal-divider > div:last-child');
      var createRow = document.getElementById('category-create-row');
      if (isCatBatchMode || isColorBatchMode) {
        if (batchBtn) batchBtn.classList.add('active');
        if (batchBar) batchBar.style.display = 'flex';
        if (searchRow) searchRow.style.display = 'none';
        if (bottomBtns) bottomBtns.style.display = 'none';
        if (isColorBatchMode && createRow) createRow.style.display = 'none';
      } else {
        if (batchBtn) batchBtn.classList.remove('active');
        if (batchBar) batchBar.style.display = 'none';
        if (bottomBtns) bottomBtns.style.display = 'flex';
        if (categoryMode === 'search') {
          if (searchRow) searchRow.style.display = 'flex';
        } else {
          if (createRow) createRow.style.display = 'flex';
        }
      }
    }

    function toggleCatBatch() {
      if (categoryMode === 'create') {
        toggleColorBatchMode();
      } else {
        toggleCatBatchMode();
      }
    }

    function toggleCatBatchMode() {
      isCatBatchMode = !isCatBatchMode;
      selectedCatIds.clear();
      applyCatBatchUI();
      renderCategoryModalList(true);
    }

    function catBatchSelectAll() {
      if (isColorBatchMode) {
        if (selectedColors.size === customColorsList.length) {
          selectedColors.clear();
        } else {
          customColorsList.forEach(function(c) { selectedColors.add(c); });
        }
        renderCategoryColorPresets();
      } else {
        if (selectedCatIds.size === categoriesList.length) {
          selectedCatIds.clear();
        } else {
          categoriesList.forEach(function(c) { selectedCatIds.add(c.id); });
        }
        renderCategoryModalList(true);
      }
    }

    function catBatchDelete() {
      if (isColorBatchMode) {
        batchDeleteCustomColors();
      } else {
        batchDeleteCategories();
      }
    }

    function toggleColorBatchMode() {
      isColorBatchMode = !isColorBatchMode;
      selectedColors.clear();
      applyCatBatchUI();
      renderCategoryColorPresets();
    }

    async function batchDeleteCategories() {
      if (selectedCatIds.size === 0) return;
      if (!confirm('\u786E\u8BA4\u5220\u9664\u9009\u4E2D\u7684 ' + selectedCatIds.size + ' \u4E2A\u5206\u7C7B\uFF1F')) return;
      var ids = Array.from(selectedCatIds);
      var backupList = categoriesList.slice();
      var backupMap = new Map(categoriesMap);
      var backupNameMap = new Map(categoriesNameMap);
      categoriesList = categoriesList.filter(function(c) { return !selectedCatIds.has(c.id); });
      selectedCatIds.forEach(function(id) {
        var cat = categoriesMap.get(id);
        if (cat) categoriesNameMap.delete(cat.name.toLowerCase());
        categoriesMap.delete(id);
      });
      selectedCatIds.clear();
      isCatBatchMode = false;
      applyCatBatchUI();
      renderCategoryModalList(true);
      try {
        await fetch('/api/category-action', {
          method: 'POST',
          body: JSON.stringify({ action: 'BATCH_DELETE', ids: ids }),
          headers: { 'Content-Type': 'application/json' }
        });
      } catch(e) {
        categoriesList = backupList;
        categoriesMap = backupMap;
        categoriesNameMap = backupNameMap;
        renderCategoryModalList(true);
      }
    }

    async function batchDeleteCustomColors() {
      if (selectedColors.size === 0) return;
      if (!confirm('\u786E\u8BA4\u5220\u9664\u9009\u4E2D\u7684 ' + selectedColors.size + ' \u4E2A\u81EA\u5B9A\u4E49\u989C\u8272\uFF1F')) return;
      var toDelete = Array.from(selectedColors);
      customColorsList = customColorsList.filter(function(c) { return !selectedColors.has(c); });
      if (selectedColors.has(categorySelectedColor)) categorySelectedColor = CATEGORY_COLOR_PRESETS[0];
      selectedColors.clear();
      isColorBatchMode = false;
      applyCatBatchUI();
      renderCategoryColorPresets();
      try {
        await fetch('/api/custom-colors', {
          method: 'POST',
          body: JSON.stringify({ colors: customColorsList }),
          headers: { 'Content-Type': 'application/json' }
        });
      } catch(e) {
        customColorsList = customColorsList.concat(toDelete);
        renderCategoryColorPresets();
      }
    }

    function toggleCategoryMenu(mode, triggerEl) {
      activeMode = mode;
      categorySearchQuery = '';
      categoryMode = 'search';
      editingCategoryId = '';
      editingCategoryName = '';
      isCatBatchMode = false;
      selectedCatIds.clear();
      isColorBatchMode = false;
      selectedColors.clear();
      categorySelectedColor = '';
      categoryCustomColor = '';
      var input = document.getElementById('category-new-name');
      if (input) input.value = '';
      var createInput = document.getElementById('category-create-name');
      if (createInput) { createInput.value = ''; createInput.placeholder = '\u65B0\u5EFA\u5206\u7C7B...'; }
      var batchBtn = document.getElementById('cat-batch-btn');
      if (batchBtn) batchBtn.style.display = activeMode === 'manage' ? 'inline-block' : 'none';
      applyCatBatchUI();
      var bodyEl = document.getElementById('category-modal-body');
      if (bodyEl) { bodyEl.style.setProperty('transition','none','important'); bodyEl.style.height = 'auto'; }
      applyCategoryModeUI();
      renderCategoryModalList();
      document.getElementById('modal-category').classList.add('active');
      requestAnimationFrame(function() {
        var listEl = document.getElementById('category-modal-list');
        if (listEl) listEl.scrollTop = 0;
        var contentEl = document.querySelector('#modal-category .modal-content');
        if (contentEl) contentEl.scrollTop = 0;
      });
      if (bodyEl) { requestAnimationFrame(function() { bodyEl.style.removeProperty('transition'); }); }
    }

    function toggleCategoryMode() {
      if (categoryMode === 'search') {
        categoryMode = 'create';
        categorySelectedColor = CATEGORY_COLOR_PRESETS[0];
        categoryCustomColor = '';
      } else {
        categoryMode = 'search';
        categorySelectedColor = '';
        categoryCustomColor = '';
        editingCategoryId = '';
        editingCategoryName = '';
      }
      isColorBatchMode = false;
      selectedColors.clear();
      applyCategoryModeUI();
    }

    function updateCategoryEditPreview() {
      var preview = document.getElementById('category-edit-preview');
      if (!preview || activeMode !== 'manage' || !editingCategoryId) return;
      var cat = categoriesMap.get(editingCategoryId);
      var color = categorySelectedColor === 'custom' ? (categoryCustomColor || (cat ? cat.color : '')) : (categorySelectedColor || (cat ? cat.color : ''));
      if (!color) color = CATEGORY_COLOR_PRESETS[0];
      var name = categorySelectedColor === 'custom' ? editingCategoryName : (editingCategoryName || (cat ? cat.name : ''));
      preview.innerHTML = '<div class="category-modal-item" style="cursor:default;"><span class="badge-category-icon" style="background:' + color + '"></span><span class="cat-name">' + escapeHtml(name) + '</span></div>';
    }

    function applyCategoryModeUI() {
      var searchInput = document.getElementById('category-new-name');
      var createInput = document.getElementById('category-create-name');
      var iconPlus = document.getElementById('category-toggle-icon-plus');
      var iconSearch = document.getElementById('category-toggle-icon-search');
      var colorPresets = document.getElementById('category-color-presets');
      var listEl = document.getElementById('category-modal-list');
      var titleEl = document.getElementById('category-modal-title');
      var bodyEl = document.getElementById('category-modal-body');
      var searchRow = document.getElementById('category-search-row');
      var createRow = document.getElementById('category-create-row');

      if (bodyEl) {
        bodyEl.removeEventListener('transitionend', categoryBodyTransitionEnd);
        var curH = bodyEl.offsetHeight;
        bodyEl.style.height = curH + 'px';
      }

      var preview = document.getElementById('category-edit-preview');
      var confirmBtn = document.getElementById('category-confirm-btn');

      if (categoryMode === 'create') {
        if (searchRow) searchRow.style.display = 'none';
        if (createRow) createRow.style.display = 'flex';
        if (iconPlus) { iconPlus.style.opacity = '0'; iconPlus.style.transform = 'rotate(90deg)'; }
        if (iconSearch) { iconSearch.style.opacity = '1'; iconSearch.style.transform = 'rotate(0deg)'; }
        if (listEl) listEl.style.display = 'none';
        if (colorPresets) { colorPresets.style.display = 'flex'; renderCategoryColorPresets(); }
        categorySearchQuery = '';
        if (searchInput) searchInput.value = '';
        var batchBtn = document.getElementById('cat-batch-btn');
        if (batchBtn) batchBtn.style.display = activeMode === 'manage' ? 'inline-block' : 'none';
        if (activeMode === 'manage' && editingCategoryId) {
          if (titleEl) titleEl.textContent = '>> \u7F16\u8F91\u5206\u7C7B';
          if (createInput) createInput.placeholder = '\u7F16\u8F91\u5206\u7C7B\u540D\u79F0...';
          if (preview) { preview.style.display = 'block'; updateCategoryEditPreview(); }
          if (confirmBtn) confirmBtn.textContent = '\u4FDD\u5B58';
        } else {
          if (titleEl) titleEl.textContent = '>> \u65B0\u5EFA\u5206\u7C7B';
          if (createInput) createInput.placeholder = '\u65B0\u5EFA\u5206\u7C7B...';
          if (preview) preview.style.display = 'none';
          if (confirmBtn) confirmBtn.textContent = '\u521B\u5EFA';
        }
      } else {
        if (searchRow) searchRow.style.display = 'flex';
        if (createRow) createRow.style.display = 'none';
        if (iconPlus) { iconPlus.style.opacity = '1'; iconPlus.style.transform = 'rotate(0deg)'; }
        if (iconSearch) { iconSearch.style.opacity = '0'; iconSearch.style.transform = 'rotate(-90deg)'; }
        if (listEl) listEl.style.display = 'flex';
        if (colorPresets) colorPresets.style.display = 'none';
        if (titleEl) titleEl.textContent = '>> \u9009\u62E9\u5206\u7C7B';
        if (createInput) { createInput.value = ''; createInput.placeholder = '\u65B0\u5EFA\u5206\u7C7B...'; }
        if (preview) preview.style.display = 'none';
        if (confirmBtn) confirmBtn.textContent = '\u521B\u5EFA';
        if (activeMode === 'manage') {
          var batchBtn = document.getElementById('cat-batch-btn');
          if (batchBtn) batchBtn.style.display = 'inline-block';
        }
        renderCategoryModalList();
      }

      if (bodyEl) {
        requestAnimationFrame(function() {
          bodyEl.style.height = 'auto';
          var newH = bodyEl.offsetHeight;
          bodyEl.style.height = curH + 'px';
          requestAnimationFrame(function() {
            bodyEl.style.height = newH + 'px';
            bodyEl.addEventListener('transitionend', categoryBodyTransitionEnd, { once: true });
          });
        });
      }
    }

    function categoryBodyTransitionEnd(e) {
      if (e.propertyName !== 'height') return;
      var bodyEl = document.getElementById('category-modal-body');
      if (bodyEl) bodyEl.style.height = 'auto';
    }

    function categoryBodyViewportChange() {
      var bodyEl = document.getElementById('category-modal-body');
      if (bodyEl && bodyEl.style.height && bodyEl.style.height !== 'auto') {
        bodyEl.style.setProperty('transition','none','important');
        bodyEl.style.height = 'auto';
        requestAnimationFrame(function() { bodyEl.style.removeProperty('transition'); });
      }
    }

    window.addEventListener('resize', categoryBodyViewportChange);

    function onCategoryCreateInput() {
      if (activeMode === 'manage' && editingCategoryId) {
        if (categorySelectedColor !== 'custom') {
          var ci = document.getElementById('category-create-name');
          editingCategoryName = ci ? ci.value : editingCategoryName;
        }
        updateCategoryEditPreview();
      }
      if (categorySelectedColor !== 'custom') return;
      var createInput = document.getElementById('category-create-name');
      var val = createInput ? createInput.value.trim() : '';
      if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
        categoryCustomColor = val.length === 4 ? '#' + val[1]+val[1]+val[2]+val[2]+val[3]+val[3] : val;
        renderCategoryColorPresets();
      } else {
        categoryCustomColor = '';
        renderCategoryColorPresets();
      }
    }

    function onCategoryCreateEnter() {
      var createInput = document.getElementById('category-create-name');
      var val = createInput ? createInput.value.trim() : '';
      if (categorySelectedColor === 'custom') {
        if (!val) return;
        if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) return;
        var normalizedColor = val.length === 4 ? '#' + val[1]+val[1]+val[2]+val[2]+val[3]+val[3] : val;
        if (CATEGORY_COLOR_PRESETS.includes(normalizedColor) || customColorsList.includes(normalizedColor)) {
          categorySelectedColor = normalizedColor;
          categoryCustomColor = '';
          createInput.value = activeMode === 'manage' && editingCategoryId ? editingCategoryName : '';
          createInput.placeholder = activeMode === 'manage' && editingCategoryId ? '\u7F16\u8F91\u5206\u7C7B\u540D\u79F0...' : '\u65B0\u5EFA\u5206\u7C7B...';
          renderCategoryColorPresets();
          return;
        }
        customColorsList.push(normalizedColor);
        categorySelectedColor = normalizedColor;
        categoryCustomColor = '';
        createInput.value = activeMode === 'manage' && editingCategoryId ? editingCategoryName : '';
        createInput.placeholder = activeMode === 'manage' && editingCategoryId ? '\u7F16\u8F91\u5206\u7C7B\u540D\u79F0...' : '\u65B0\u5EFA\u5206\u7C7B...';
        fetch('/api/custom-colors', {
          method: 'POST',
          body: JSON.stringify({ colors: customColorsList }),
          headers: { 'Content-Type': 'application/json' }
        }).catch(function() {
          customColorsList = customColorsList.filter(function(c) { return c !== normalizedColor; });
        });
        renderCategoryColorPresets();
        return;
      }
      if (activeMode === 'manage' && editingCategoryId) return;
      if (!val) return;
      var match = categoriesNameMap.get(val.toLowerCase());
      if (match) {
        selectCategory(match.id);
      } else {
        createCategoryFromModal('create');
      }
    }

    function onCategoryCreateBtnClick() {
      if (activeMode === 'manage' && editingCategoryId) {
        saveCategoryEdit();
        return;
      }
      if (categoryMode === 'create') {
        onCategoryCreateEnter();
      } else {
        onCategorySearchEnter();
      }
    }

    function closeCategoryModal() {
      document.getElementById('modal-category').classList.remove('active');
      categoryMode = 'search';
      editingCategoryId = '';
      editingCategoryName = '';
      isCatBatchMode = false;
      selectedCatIds.clear();
      isColorBatchMode = false;
      selectedColors.clear();
      categorySelectedColor = '';
      categoryCustomColor = '';
      var searchInput = document.getElementById('category-new-name');
      if (searchInput) searchInput.value = '';
      var createInput = document.getElementById('category-create-name');
      if (createInput) { createInput.value = ''; createInput.placeholder = '\u65B0\u5EFA\u5206\u7C7B...'; }
      var searchRow = document.getElementById('category-search-row');
      var createRow = document.getElementById('category-create-row');
      var listEl = document.getElementById('category-modal-list');
      var colorPresets = document.getElementById('category-color-presets');
      var iconPlus = document.getElementById('category-toggle-icon-plus');
      var iconSearch = document.getElementById('category-toggle-icon-search');
      var titleEl = document.getElementById('category-modal-title');
      var preview = document.getElementById('category-edit-preview');
      var confirmBtn = document.getElementById('category-confirm-btn');
      var batchBtn = document.getElementById('cat-batch-btn');
      if (searchRow) searchRow.style.display = 'flex';
      if (createRow) createRow.style.display = 'none';
      if (listEl) listEl.style.display = 'flex';
      if (colorPresets) colorPresets.style.display = 'none';
      if (iconPlus) { iconPlus.style.opacity = '1'; iconPlus.style.transform = 'rotate(0deg)'; }
      if (iconSearch) { iconSearch.style.opacity = '0'; iconSearch.style.transform = 'rotate(-90deg)'; }
      if (titleEl) titleEl.textContent = '>> \u9009\u62E9\u5206\u7C7B';
      if (preview) preview.style.display = 'none';
      if (confirmBtn) confirmBtn.textContent = '\u521B\u5EFA';
      if (batchBtn) batchBtn.style.display = 'none';
      applyCatBatchUI();
      var bodyEl = document.getElementById('category-modal-body');
      if (bodyEl) { bodyEl.style.setProperty('transition','none','important'); bodyEl.style.height = 'auto'; }
    }

    function selectCategory(catId) {
      if (activeMode === 'manage') {
        if (!catId) { closeCategoryModal(); return; }
        editingCategoryId = catId;
        var cat = categoriesMap.get(catId);
        if (!cat) return;
        editingCategoryName = cat.name;
        categoryMode = 'create';
        categorySelectedColor = cat.color || CATEGORY_COLOR_PRESETS[0];
        categoryCustomColor = '';
        applyCategoryModeUI();
        var createInput = document.getElementById('category-create-name');
        if (createInput) createInput.value = cat.name;
        updateCategoryEditPreview();
        return;
      }
      tempCategoryId = catId || '';
      const displayName = catId ? getCategoryName(catId) : '\u65E0';
      if (activeMode === 'add') {
        document.getElementById('add-category-display').innerText = '\u5206\u7C7B: ' + displayName;
      } else if (activeMode === 'edit') {
        document.getElementById('edit-category-display').innerText = '\u5206\u7C7B: ' + displayName;
      }
      closeCategoryModal();
    }

    async function saveCategoryEdit() {
      var cat = categoriesMap.get(editingCategoryId);
      if (!cat) return;
      var createInput = document.getElementById('category-create-name');
      var newName = createInput ? createInput.value.trim() : '';
      if (!newName) return;
      var newColor = categorySelectedColor === 'custom' ? (categoryCustomColor || cat.color) : (categorySelectedColor || cat.color);
      try {
        const res = await fetch('/api/category-action', {
          method: 'POST',
          body: JSON.stringify({ action: 'UPDATE', id: editingCategoryId, name: newName, color: newColor }),
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          var oldName = cat.name;
          cat.name = newName;
          cat.color = newColor;
          if (oldName.toLowerCase() !== newName.toLowerCase()) {
            categoriesNameMap.delete(oldName.toLowerCase());
          }
          categoriesNameMap.set(newName.toLowerCase(), cat);
          editingCategoryId = '';
          editingCategoryName = '';
          toggleCategoryMode();
          renderCategoryModalList(true);
        }
      } catch(e) {}
    }

    async function createCategoryFromModal(source) {
      var inputId = source === 'create' ? 'category-create-name' : 'category-new-name';
      const input = document.getElementById(inputId);
      const name = input.value.trim();
      if (!name) return;
      var match = categoriesNameMap.get(name.toLowerCase());
      if (match) {
        selectCategory(match.id);
        return;
      }
      try {
        const res = await fetch('/api/category-action', {
          method: 'POST',
          body: JSON.stringify({ action: 'CREATE', name: name, color: categorySelectedColor || CATEGORY_COLOR_PRESETS[0] }),
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          var newCat = { id: data.id, name: data.name, color: data.color };
          categoriesList.push(newCat);
          categoriesMap.set(data.id, newCat);
          categoriesNameMap.set(data.name.toLowerCase(), newCat);
          input.value = '';
          categorySearchQuery = '';
          renderCategoryModalList(true);
          if (activeMode === 'manage') {
            if (source === 'create') toggleCategoryMode();
          } else {
            selectCategory(data.id);
          }
        }
      } catch(e) {}
    }

`;

// src/html/js/detail.js
var detail = `
    function openAddModal() {
      activeMode = 'add';
      document.getElementById('modal-add').classList.add('active');
      document.getElementById('add-text').value = ''; document.getElementById('add-desc').value = '';
      document.getElementById('add-url').value = ''; document.getElementById('add-copy').value = '';
      tempTime = ''; tempPriority = 'low';
      tempEndTime = ''; tempRepeatType = 'none';
      tempRepeatEnd = ''; tempCategoryId = '';
      tempAddDate = formatDate(currentDate);
      document.getElementById('add-date-display').innerText = tempAddDate;
      document.getElementById('add-repeat-display').innerText = '\u91CD\u590D: \u4E0D\u91CD\u590D';
      document.getElementById('add-category-display').innerText = '\u5206\u7C7B: \u65E0';
      document.getElementById('add-endtime-display').innerText = '\u7ED3\u675F --:--';
      document.getElementById('add-repeat-end-display').innerText = '\u5FAA\u73AF\u622A\u6B62: \u6C38\u4E0D';
      document.getElementById('add-repeat-end-row').style.display = 'none';
      
      tempSubtasks =[]; tempSearchTerms =[]; addSearchState = false; 
      tempSearchProvider = appSettings.provider || 'auto';
      document.getElementById('add-subtask-input').value = '';
      renderTempSubtasks('add');
      
      const pMap = {'auto':'\u81EA\u52A8 (\u968F\u673A\u6E90)', 'bilibili':'\u54D4\u54E9\u54D4\u54E9', 'weibo':'\u5FAE\u535A\u70ED\u641C', 'zhihu':'\u77E5\u4E4E\u70ED\u699C', 'baidu':'\u767E\u5EA6\u70ED\u641C'};
      const providerDisplay = document.getElementById('add-search-provider-display');
      if(providerDisplay) providerDisplay.innerText = pMap[tempSearchProvider];

      document.getElementById('add-search-box').classList.remove('checked');
      document.getElementById('add-search-actions').classList.add('hidden');

      updateAddUI();
    }
    
    function updateAddUI() {
      document.getElementById('add-time-display').innerText = tempTime ? ('\u5F00\u59CB ' + tempTime) : '\u5F00\u59CB --:--';
      document.getElementById('add-endtime-display').innerText = tempEndTime ? ('\u7ED3\u675F ' + tempEndTime) : '\u7ED3\u675F --:--';
      const pMap = {low:'\u4F18\u5148\u7EA7: \u4F4E', med:'\u4F18\u5148\u7EA7: \u4E2D', high:'\u4F18\u5148\u7EA7: \u9AD8'};
      document.getElementById('add-priority-display').innerText = pMap[tempPriority];
    }

    function closeAddModal() {
      hideAndRescuePopovers();
      closeCategoryModal();
      var modal = document.getElementById('modal-add');
      if (!modal || !modal.classList.contains('active')) return;
      
      var content = modal.querySelector('.modal-content');
      if (!content) { modal.classList.remove('active'); return; }
      
      modal.classList.add('closing-overlay');
      content.classList.add('closing');
      
      var computedStyle = window.getComputedStyle(content);
      var duration = parseFloat(computedStyle.animationDuration);
      var name = computedStyle.animationName;
      
      var closed = false;
      function doClose() {
        if (closed) return;
        closed = true;
        modal.classList.remove('active', 'closing-overlay');
        content.classList.remove('closing');
      }
      
      if (name && name !== 'none' && duration > 0) {
        content.addEventListener('animationend', function handler(e) {
          if (e.target === content) {
            doClose();
            content.removeEventListener('animationend', handler);
          }
        });
        setTimeout(doClose, duration * 1000 + 100);
      } else {
        doClose();
      }
    }

    async function confirmAddTask() {
      const text = document.getElementById('add-text').value.trim();
      if (!text) return;
      const newId = Date.now().toString() + Math.random().toString().slice(2, 6);
      const newTask = {
        id: newId, parentId: newId, text: text, time: tempTime,
        end_time: tempEndTime,
        priority: tempPriority, 
        repeat_type: tempRepeatType,
        repeat_custom: '',
        repeat_end: tempRepeatEnd,
        category_id: tempCategoryId,
        desc: document.getElementById('add-desc').value, url: document.getElementById('add-url').value,
        copyText: document.getElementById('add-copy').value, done: false,
        subtasks: tempSubtasks, search_terms: tempSearchTerms
      };
      closeAddModal();
      await fetch('/api/todo-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'CREATE', date: tempAddDate, task: newTask }),
        headers: { 'Content-Type': 'application/json' }
      });
      loadTodos(); 
    }

    async function toggleSearchTerm(taskIndex, termIndex) {
      const task = todos[taskIndex];
      task.search_terms[termIndex].done = !task.search_terms[termIndex].done;
      renderDetailContent();
      await fetch('/api/todo-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'UPDATE_SEARCH_TERMS', task: { id: task.id, search_terms: task.search_terms } }),
        headers: { 'Content-Type': 'application/json' }
      });
      renderTodos(); 
    }

    async function copySearchTerm(taskIndex, termIndex, safeText) {
      copyText(decodeURIComponent(safeText));
      const task = todos[taskIndex];
      if (!task.search_terms[termIndex].done) {
        task.search_terms[termIndex].done = true;
        renderDetailContent();
        await fetch('/api/todo-action', {
          method: 'POST',
          body: JSON.stringify({ action: 'UPDATE_SEARCH_TERMS', task: { id: task.id, search_terms: task.search_terms } }),
          headers: { 'Content-Type': 'application/json' }
        });
        renderTodos();
      }
    }

    function openDetail(index) {
      currentDetailIndex = index; isEditMode = false;
      const task = todos[index]; tempEditDate = task.date || '';
      tempTime = task.time || ''; tempPriority = task.priority || 'low';
      tempCategoryId = task.category_id || '';
      renderDetailContent();
      
      const btnSave = document.getElementById('btn-save-task'); const btnDel = document.getElementById('btn-delete-task');
      const btnEdit = document.getElementById('btn-edit-toggle');
      btnSave.classList.add('hidden'); btnDel.classList.remove('hidden'); btnEdit.innerText = "\u7F16\u8F91";
      btnDel.onclick = (e) => handleActionClick(e, 'delete'); btnSave.onclick = (e) => handleActionClick(e, 'save');

      const detailView = document.getElementById('detail-view');
      detailView.classList.remove('closing'); detailView.classList.add('active');
    }

    function closeDetail() {
      hideAndRescuePopovers();
      closeCategoryModal();
      const detailView = document.getElementById('detail-view'); detailView.classList.add('closing');
      detailView.addEventListener('animationend', function handler() {
        detailView.classList.remove('active'); detailView.classList.remove('closing'); detailView.removeEventListener('animationend', handler);
      });
    }

    function renderDetailContent() {
      hideAndRescuePopovers();
      const task = todos[currentDetailIndex]; const container = document.getElementById('detail-content');
      const pMap = {low:'\u4F18\u5148\u7EA7: \u4F4E', med:'\u4F18\u5148\u7EA7: \u4E2D', high:'\u4F18\u5148\u7EA7: \u9AD8'};
      const rMap = { none: '\u4E0D\u91CD\u590D', daily: '\u6BCF\u5929', weekly: '\u6BCF\u5468', monthly: '\u6BCF\u6708', yearly: '\u6BCF\u5E74' };
      
      if (!isEditMode) {
        let urlSection = '';
        if (task.url) urlSection = \`<div class="detail-label">\u94FE\u63A5 (URL)</div><div class="detail-value"><a href="\${task.url}" target="_blank">\${task.url}</a></div>\`;

        let copySection = '';
        if (task.copy_text) {
          const safeText = encodeURIComponent(task.copy_text).replace(/'/g, "%27");
          copySection = \`<div class="detail-label">\u5FEB\u6377\u590D\u5236\u5185\u5BB9</div><div class="detail-value" style="display:flex; justify-content:space-between; align-items:center;">
              <span>\${task.copy_text}</span><button class="btn-ghost" style="padding:4px 8px;" onclick="copyText(decodeURIComponent('\${safeText}'))">\u590D\u5236</button>
            </div>\`;
        }

        let descSection = '';
        if (task.desc) {
          const mdHtml = parseMarkdown(task.desc);
          descSection = \`<div class="detail-label">\u5907\u6CE8</div><div class="detail-value" style="display:block; min-height:30px; line-height:1.5;">\${mdHtml}</div>\`;
        }

        let subtasksSection = '';
        if (task.subtasks && task.subtasks.length > 0) {
          let stHtml = task.subtasks.map((st, i) => \`
            <div class="subtask-view-item \${st.done ? 'done' : ''}" onclick="toggleSubtask(\${currentDetailIndex}, \${i})">
                <div class="checkbox"></div>
                <div class="item-meta"><div class="item-title">\${st.text}</div></div>
            </div>
          \`).join('');
          subtasksSection = \`<div class="detail-label">\u5B50\u4EFB\u52A1</div><div style="margin-bottom:20px;">\${stHtml}</div>\`;
        }

        let searchSection = '';
        if (task.search_terms && task.search_terms.length > 0) {
          let stHtml = task.search_terms.map((termObj, i) => {
            const text = termObj.text;
            const safeText = encodeURIComponent(text).replace(/'/g, "%27");
            return \`<div class="search-term-tag \${termObj.done ? 'done' : ''}">
              <div class="search-term-checkbox" onclick="toggleSearchTerm(\${currentDetailIndex}, \${i})"></div>
              <span>\${text}</span>
              <button onclick="copySearchTerm(\${currentDetailIndex}, \${i}, '\${safeText}')">\u2398</button>
            </div>\`;
          }).join('');
          searchSection = \`
            <div class="detail-label">\u7F51\u7EDC\u6BCF\u65E5\u641C\u7D22</div>
            <div class="search-card">
              \${stHtml}
            </div>
          \`;
        }

        let rText = '\u4E0D\u91CD\u590D';
        if (task.repeat_type && task.repeat_type !== 'none') {
            var days = ['\u65E5','\u4E00','\u4E8C','\u4E09','\u56DB','\u4E94','\u516D'];
            if (task.repeat_type === 'daily') rText = '\u6BCF\u5929';
            else if (task.repeat_type === 'weekly') {
              var dp = (task.date || '').split('-');
              if (dp.length === 3) { var dw = new Date(dp[0], dp[1]-1, dp[2]).getDay(); rText = '\u6BCF\u5468' + days[dw]; }
              else rText = '\u6BCF\u5468';
            } else if (task.repeat_type === 'monthly') {
              var mp = (task.date || '').split('-');
              rText = mp.length === 3 ? '\u6BCF\u6708' + parseInt(mp[2], 10) + '\u53F7' : '\u6BCF\u6708';
            } else if (task.repeat_type === 'yearly') {
              var yp = (task.date || '').split('-');
              rText = yp.length === 3 ? '\u6BCF\u5E74' + parseInt(yp[1], 10) + '\u6708' + parseInt(yp[2], 10) + '\u65E5' : '\u6BCF\u5E74';
            }
            if (task.repeat_end) rText += '\xB7\u81F3' + task.repeat_end;
        } else if (task.isSeries) {
            rText = '\u5DF2\u505C\u6B62\u91CD\u590D';
        }

        let catSection = '';
        if (task.category_id) {
          var catName = getCategoryName(task.category_id);
          var catColor = getCategoryColor(task.category_id);
          if (catName) {
            catSection = \`<div class="detail-label">\u5206\u7C7B</div><div class="detail-value"><span class="badge-category"><span class="badge-category-icon" style="background:\${catColor}"></span><span class="cat-name">\${escapeHtml(catName)}</span></span></div>\`;
          }
        }

        container.innerHTML = \`
          <div class="detail-label">\u4E8B\u9879\u5185\u5BB9</div><div class="detail-value">\${task.text}</div>
          \${subtasksSection}
          \${searchSection}
          <div class="row">
            <div class="flex-1"><div class="detail-label">\u65F6\u95F4\u70B9</div><div class="detail-value">\${task.time || '--:--'}\${task.end_time ? ' - ' + task.end_time : ''}</div></div>
            <div class="flex-1"><div class="detail-label">\u4F18\u5148\u7EA7</div><div class="detail-value">\${pMap[task.priority]}</div></div>
          </div>
          \${urlSection}\${copySection}
          \${catSection}
          <div class="detail-label">\u5C5E\u6027</div><div class="detail-value">\${rText}</div>
          \${descSection}
        \`;
      } else {
        activeMode = 'edit';
        container.innerHTML = \`
          <input type="text" id="edit-text" value="\${task.text}" class="detail-value editable" placeholder="\u4E8B\u9879\u6807\u9898\uFF08\u5FC5\u586B\uFF09">
          
          <div class="detail-label modal-section">\u5B50\u4EFB\u52A1</div>
          <div class="row modal-subtask-row">
            <input type="text" id="edit-subtask-input" placeholder="\u8F93\u5165\u5B50\u4EFB\u52A1\uFF08\u53EF\u9009\uFF09" class="detail-value editable flex-1">
            <button onclick="addTempSubtask('edit')">\u6DFB\u52A0</button>
          </div>
          <div id="edit-subtasks-list" style="margin-bottom:15px;"></div>

          <div class="detail-label modal-section">\u65F6\u95F4\u4E0E\u91CD\u590D</div>
          <div class="row modal-row">
            <div class="fake-input detail-value editable flex-1" onclick="openCalendarForEdit()">
              <span id="edit-date-display">\${tempEditDate || '----/--/--'}</span>
              <span class="arrow">\u25BC</span>
            </div>
            <div class="fake-input detail-value editable flex-1" onclick="toggleRepeatMenu('edit', this)">
              <span id="edit-repeat-display">\u91CD\u590D: \${rMap[tempRepeatType]}</span>
              <span class="arrow">\u25BC</span>
            </div>
          </div>
          <div id="edit-repeat-end-row" class="modal-row" \${tempRepeatType !== 'none' ? '' : 'style="display:none;"'}>
            <div class="fake-input detail-value editable" onclick="openCalendarForRepeatEnd('edit')">
              <span id="edit-repeat-end-display">\u5FAA\u73AF\u622A\u6B62: \${tempRepeatEnd || '\u6C38\u4E0D'}</span>
              <span class="arrow">\u25BC</span>
            </div>
          </div>
          <div class="row modal-row">
            <div class="fake-input detail-value editable flex-1" onclick="openTimePicker('edit','start')"><span id="edit-time-display">\${tempTime ? '\u5F00\u59CB ' + tempTime : '\u5F00\u59CB --:--'}</span></div>
            <div class="fake-input detail-value editable flex-1" onclick="openTimePicker('edit','end')"><span id="edit-endtime-display">\${tempEndTime ? '\u7ED3\u675F ' + tempEndTime : '\u7ED3\u675F --:--'}</span></div>
          </div>

          <div class="detail-label modal-section">\u5C5E\u6027\u4E0E\u94FE\u63A5</div>
          <div class="row modal-row">
            <div class="fake-input detail-value editable flex-1" id="edit-category-trigger" onclick="toggleCategoryMenu('edit', this)">
              <span id="edit-category-display">\u5206\u7C7B: \${getCategoryName(tempCategoryId) || '\u65E0'}</span>
              <span class="arrow-r">\u25BC</span>
            </div>
            <div class="fake-input detail-value editable flex-1" onclick="togglePriorityMenu('edit', this)">
              <span id="edit-priority-display">\${pMap[tempPriority]}</span>
              <span class="arrow">\u25BC</span>
            </div>
          </div>
          <input type="url" id="edit-url" value="\${task.url || ''}" class="detail-value editable" placeholder="URL / APP Scheme (\u53EF\u9009)">
          <input type="text" id="edit-copy" value="\${task.copy_text || ''}" class="detail-value editable" placeholder="\u5FEB\u6377\u590D\u5236\u5185\u5BB9\uFF08\u53EF\u9009\uFF09">

          <div class="detail-label modal-section">\u5176\u4ED6</div>
          <div class="switch-label" onclick="toggleEditSearch()">
            <div class="switch-box \${tempSearchTerms.length > 0 ? 'checked' : ''}" id="edit-search-box"></div>
            <span>\u542F\u7528\u6BCF\u65E5\u641C\u7D22</span>
          </div>
          <div id="edit-search-actions" class="\${tempSearchTerms.length > 0 ? '' : 'hidden'}" style="margin-bottom:15px;">
            <div class="row modal-row">
              <div class="fake-input flex-1" id="edit-search-provider-trigger" onclick="toggleProviderMenu('edit', this)" style="height:46px;">
                <span id="edit-search-provider-display">\u81EA\u52A8 (\u968F\u673A\u6E90)</span>
                <span class="arrow-r">\u25BC</span>
              </div>
              <button class="btn-ghost flex-1" id="edit-search-regenerate-btn" style="height:46px; padding: 0 5px;" onclick="regenerateEditSearchTerms()">\u83B7\u53D6\u70ED\u641C</button>
            </div>
            <div class="search-card" id="edit-search-preview"></div>
          </div>
          
          <textarea id="edit-desc" rows="3" class="detail-value editable" placeholder="\u8F93\u5165\u5907\u6CE8/\u8BE6\u7EC6\u63CF\u8FF0\uFF08\u53EF\u9009\uFF09">\${task.desc || ''}</textarea>
        \`;
        renderTempSubtasks('edit');
        if (tempSearchTerms.length > 0) renderSearchTerms('edit');
      }
    }

    function toggleEditMode() {
      isEditMode = !isEditMode;
      const btnSave = document.getElementById('btn-save-task'); const btnDel = document.getElementById('btn-delete-task'); const btnEdit = document.getElementById('btn-edit-toggle');
      if (isEditMode) {
        btnSave.classList.remove('hidden'); btnDel.classList.add('hidden'); btnEdit.innerText = "\u53D6\u6D88\u7F16\u8F91";
        const task = todos[currentDetailIndex]; 
        tempEditDate = task.date || '';
        tempTime = task.time || ''; tempPriority = task.priority || 'low';
        tempEndTime = task.end_time || '';
        tempRepeatType = task.repeat_type || 'none';
        tempRepeatEnd = task.repeat_end || '';
        tempSubtasks = JSON.parse(JSON.stringify(task.subtasks ||[]));
        tempSearchTerms = JSON.parse(JSON.stringify(task.search_terms ||[]));
        tempSearchProvider = appSettings.provider || 'auto';
        
        setTimeout(() => {
          const pMap = {'auto':'\u81EA\u52A8 (\u968F\u673A\u6E90)', 'bilibili':'\u54D4\u54E9\u54D4\u54E9', 'weibo':'\u5FAE\u535A\u70ED\u641C', 'zhihu':'\u77E5\u4E4E\u70ED\u699C', 'baidu':'\u767E\u5EA6\u70ED\u641C'};
          const el = document.getElementById('edit-search-provider-display');
          if (el) el.innerText = pMap[tempSearchProvider];
        }, 10);
      } else {
        btnSave.classList.add('hidden'); btnDel.classList.remove('hidden'); btnEdit.innerText = "\u7F16\u8F91";
      }
      renderDetailContent();
    }

    function toggleProviderMenu(mode, triggerEl) {
      activeMode = mode; 
      showPopover('popover-provider', triggerEl, true);
    }

    function selectProvider(val) {
      tempSearchProvider = val; 
      const pMap = {
        'auto': '\u81EA\u52A8 (\u968F\u673A\u6E90)', 'bilibili': '\u54D4\u54E9\u54D4\u54E9', 'weibo': '\u5FAE\u535A\u70ED\u641C', 'zhihu': '\u77E5\u4E4E\u70ED\u699C', 'baidu': '\u767E\u5EA6\u70ED\u641C'
      };
      if(activeMode === 'add') {
        const el = document.getElementById('add-search-provider-display');
        if(el) el.innerText = pMap[val];
      } else if(activeMode === 'edit') {
        const el = document.getElementById('edit-search-provider-display');
        if(el) el.innerText = pMap[val];
      }
      document.getElementById('popover-provider').style.display = 'none';
    }

    let timePickerHour = 0; let timePickerMin = 0; let timePickerTarget = 'start';
    function openTimePicker(mode, target) {
      activeMode = mode; timePickerTarget = target || 'start';
      var titleEl = document.getElementById('time-picker-title');
      if (titleEl) titleEl.textContent = (target === 'end') ? '\u9009\u62E9\u7ED3\u675F\u65F6\u95F4' : '\u9009\u62E9\u5F00\u59CB\u65F6\u95F4';
      document.getElementById('modal-time').classList.add('active');
      var refTime = (target === 'end') ? tempEndTime : tempTime;
      if (target === 'end' && !tempEndTime && tempTime) {
        var parts = tempTime.split(':').map(Number);
        parts[1] += 30;
        if (parts[1] >= 60) { parts[0] += 1; parts[1] -= 60; }
        if (parts[0] >= 24) parts[0] = 23;
        timePickerHour = parts[0]; timePickerMin = parts[1];
      } else if (refTime) { const[h, m] = refTime.split(':').map(Number); timePickerHour = h; timePickerMin = m; } 
      else { const now = new Date(); timePickerHour = now.getHours(); timePickerMin = now.getMinutes(); }
      const hCol = document.getElementById('time-col-hour'); hCol.innerHTML = '';
      for(let i=0; i<24; i++) {
        const div = document.createElement('div'); div.className = 'time-cell'; div.innerText = String(i).padStart(2, '0');
        div.onclick = () => { timePickerHour = i; updateTimePickerSelection(); }; hCol.appendChild(div);
      }
      const mCol = document.getElementById('time-col-min'); mCol.innerHTML = '';
      for(let i=0; i<60; i++) {
        const div = document.createElement('div'); div.className = 'time-cell'; div.innerText = String(i).padStart(2, '0');
        div.onclick = () => { timePickerMin = i; updateTimePickerSelection(); }; mCol.appendChild(div);
      }
      setTimeout(() => {
        updateTimePickerSelection();
        const activeH = hCol.querySelector('.active'); if(activeH) activeH.scrollIntoView({block: "center"});
        const activeM = mCol.querySelector('.active'); if(activeM) activeM.scrollIntoView({block: "center"});
      }, 10);
    }

    function updateTimePickerSelection() {
      const hCells = document.getElementById('time-col-hour').children; Array.from(hCells).forEach((c, i) => c.className = (i === timePickerHour) ? 'time-cell active' : 'time-cell');
      const mCells = document.getElementById('time-col-min').children; Array.from(mCells).forEach((c, i) => c.className = (i === timePickerMin) ? 'time-cell active' : 'time-cell');
    }

    function confirmTime() {
      var selectedTime = \`\${String(timePickerHour).padStart(2,'0')}:\${String(timePickerMin).padStart(2,'0')}\`;
      if (timePickerTarget === 'end') {
        tempEndTime = selectedTime;
        if(activeMode === 'add') updateAddUI();
        else if(activeMode === 'edit') document.getElementById('edit-endtime-display').innerText = '\u7ED3\u675F ' + tempEndTime;
      } else {
        tempTime = selectedTime;
        if (!tempEndTime && activeMode !== 'edit') {
          var parts = [timePickerHour, timePickerMin + 30];
          if (parts[1] >= 60) { parts[0] += 1; parts[1] -= 60; }
          if (parts[0] >= 24) parts[0] = 23;
          tempEndTime = \`\${String(parts[0]).padStart(2,'0')}:\${String(parts[1]).padStart(2,'0')}\`;
        }
        if(activeMode === 'add') updateAddUI(); else if(activeMode === 'edit') document.getElementById('edit-time-display').innerText = '\u5F00\u59CB ' + tempTime;
      }
      closeTimePicker();
    }

    function clearTime() {
      if (timePickerTarget === 'end') {
        tempEndTime = '';
        if(activeMode === 'add') updateAddUI();
        else if(activeMode === 'edit') document.getElementById('edit-endtime-display').innerText = '\u7ED3\u675F --:--';
      } else {
        tempTime = '';
        if(activeMode === 'add') updateAddUI(); else if(activeMode === 'edit') document.getElementById('edit-time-display').innerText = '\u5F00\u59CB --:--';
      }
      closeTimePicker();
    }
    function closeTimePicker() { document.getElementById('modal-time').classList.remove('active'); }

    function togglePriorityMenu(mode, triggerEl) {
      activeMode = mode; 
      showPopover('popover-priority', triggerEl, false);
    }

    function selectPriority(val) {
      tempPriority = val; const pMapShort = {low:'\u4F18\u5148\u7EA7: \u4F4E', med:'\u4F18\u5148\u7EA7: \u4E2D', high:'\u4F18\u5148\u7EA7: \u9AD8'};
      if(activeMode === 'add') updateAddUI(); else if(activeMode === 'edit') document.getElementById('edit-priority-display').innerText = pMapShort[val];
      document.getElementById('popover-priority').style.display = 'none';
    }

    function handleActionClick(e, action) {
      const task = todos[currentDetailIndex]; pendingAction = action;
      const popover = document.getElementById('popover-action'); const title = document.getElementById('popover-title'); const options = document.getElementById('popover-options');
      options.innerHTML = '';
      if (action === 'delete') {
        title.innerText = "\u786E\u8BA4\u5220\u9664";
        if (task.isSeries) {
          options.innerHTML += \`<button onclick="confirmAction('this')">\u4EC5\u6B64\u65E5\u7A0B</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('thisAndFuture')">\u6B64\u65E5\u7A0B\u53CA\u4E4B\u540E</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('all')">\u6240\u6709\u65E5\u7A0B</button>\`;
        } else { options.innerHTML += \`<button onclick="confirmAction('this')">\u786E\u8BA4\u5220\u9664</button>\`; }
      } else if (action === 'save') {
        if (task.isSeries) {
          title.innerText = "\u4FDD\u5B58\u8303\u56F4\uFF1A";
          options.innerHTML += \`<button onclick="confirmAction('this')">\u4EC5\u6B64\u65E5\u7A0B</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('thisAndFuture')">\u6B64\u65E5\u7A0B\u53CA\u4E4B\u540E</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('all')">\u6240\u6709\u65E5\u7A0B</button>\`;
        } else { confirmAction('this'); return; }
      }

      const btn = e.target; btn.parentNode.style.position = 'relative'; btn.parentNode.appendChild(popover);
      popover.style.display = 'flex'; popover.style.top = 'auto'; popover.style.bottom = (btn.parentNode.offsetHeight - btn.offsetTop + 5) + 'px';
      if (btn.offsetLeft > btn.parentNode.offsetWidth / 2) { popover.style.right = (btn.parentNode.offsetWidth - btn.offsetLeft - btn.offsetWidth) + 'px'; popover.style.left = 'auto'; } else { popover.style.left = btn.offsetLeft + 'px'; popover.style.right = 'auto'; }

      const closeHandler = (event) => { if (!popover.contains(event.target) && event.target !== e.target) { popover.style.display = 'none'; document.removeEventListener('click', closeHandler); } };
      setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    async function confirmAction(scope) {
      hideAndRescuePopovers();
      const task = todos[currentDetailIndex];
      if (pendingAction === 'delete') {
        closeDetail();
        await fetch('/api/todo-action', { method: 'POST', body: JSON.stringify({ action: 'DELETE', date: formatDate(currentDate), task: task, scope: scope }), headers: { 'Content-Type': 'application/json' } });
        loadTodos();
      } 
      else if (pendingAction === 'save') {
        // \u4FDD\u5B58\u539F\u59CB\u65E5\u671F\uFF0C\u540E\u7AEF\u9700\u8981\u5B83\u5B9A\u4F4D\u5F53\u524D\u5B9E\u4F8B
        const originalDate = task.date || formatDate(currentDate);
        task.date = tempEditDate;
        task.text = document.getElementById('edit-text').value; task.time = tempTime; task.priority = tempPriority;
        task.end_time = tempEndTime;
        task.desc = document.getElementById('edit-desc').value; task.url = document.getElementById('edit-url').value;
        task.copyText = document.getElementById('edit-copy').value; task.copy_text = task.copyText; 
        task.subtasks = tempSubtasks; task.search_terms = tempSearchTerms;
        task.category_id = tempCategoryId;
        
        // scope='this' \u65F6\uFF1A\u8131\u79BB\u65E7\u7CFB\u5217
        if (scope === 'this' && task.isSeries) {
          task.repeat_type = tempRepeatType;
          task.repeat_custom = '';
          task.repeat_end = tempRepeatEnd;
          if (tempRepeatType === 'none') {
            task.isSeries = false;
          }
        } else {
          task.repeat_type = tempRepeatType;
          task.repeat_custom = '';
          task.repeat_end = tempRepeatEnd;
          if (tempRepeatType === 'none') {
            task.isSeries = false;
          }
        }
        
        // \u7CFB\u5217\u4EFB\u52A1\uFF1A\u76F4\u63A5\u5173\u95ED\u8BE6\u60C5\uFF1B\u975E\u7CFB\u5217\u4EFB\u52A1\uFF1A\u5207\u56DE\u67E5\u770B\u6A21\u5F0F\u4FDD\u7559\u8BE6\u60C5
        if (task.isSeries) {
          closeDetail();
        } else {
          toggleEditMode();
        }
        
        await fetch('/api/todo-action', { method: 'POST', body: JSON.stringify({ action: 'UPDATE', date: originalDate, task: task, scope: scope }), headers: { 'Content-Type': 'application/json' } });
        await loadTodos();
        
        if (!task.isSeries) {
          const newIndex = todos.findIndex(t => t.id === task.id);
          if (newIndex !== -1) { currentDetailIndex = newIndex; renderDetailContent(); }
          else closeDetail();
        }
      }
    }

`;

// src/html/js/calendar.js
var calendar = `
    function openCalendar() { calendarMode = 'navigate'; calDate = new Date(currentDate); calMode = 'date'; renderCalendar(); document.getElementById('modal-calendar').classList.add('active'); }
    function calChange(offset) {
      if (calendarMode === 'repeat_end') { calDate.setMonth(calDate.getMonth() + offset); renderCalendarForRepeatEnd(); return; }
      if (calMode === 'date') { calDate.setMonth(calDate.getMonth() + offset); renderCalendar(); } 
      else if (calMode === 'year') { yearPickerStart += offset * 12; openYearPicker(yearPickerStart); } 
      else if (calMode === 'month') { calDate.setFullYear(calDate.getFullYear() + offset); openMonthPicker(); }
    }
    
    function openCalendarForAdd() { calendarMode = 'select'; calDate = new Date(tempAddDate || currentDate); renderCalendar(); document.getElementById('modal-calendar').classList.add('active');
    }
    function openCalendarForEdit() { calendarMode = 'edit_date'; calDate = new Date(tempEditDate || currentDate); renderCalendar(); document.getElementById('modal-calendar').classList.add('active'); }

    let calendarRepeatEndTarget = '';
    function openCalendarForRepeatEnd(mode) {
      calendarRepeatEndTarget = mode;
      calendarMode = 'repeat_end';
      calDate = tempRepeatEnd ? new Date(tempRepeatEnd) : new Date(tempAddDate || currentDate);
      renderCalendarForRepeatEnd();
      document.getElementById('modal-calendar').classList.add('active');
    }

    function renderCalendarForRepeatEnd() {
      calMode = 'date';
      const year = calDate.getFullYear(); const month = calDate.getMonth();
      const actionBtn = document.getElementById('cal-action-btn');
      actionBtn.innerText = '\u6E05\u9664\u622A\u6B62\u65E5\u671F'; actionBtn.onclick = function() {
        tempRepeatEnd = '';
        if (calendarRepeatEndTarget === 'add') {
          document.getElementById('add-repeat-end-display').innerText = '\u5FAA\u73AF\u622A\u6B62: \u6C38\u4E0D';
        } else {
          document.getElementById('edit-repeat-end-display').innerText = '\u5FAA\u73AF\u622A\u6B62: \u6C38\u4E0D';
        }
        document.getElementById('modal-calendar').classList.remove('active');
      };
      document.getElementById('cal-prev').innerText = '< \u4E0A\u6708'; document.getElementById('cal-next').innerText = '\u4E0B\u6708 >';
      document.getElementById('cal-title').innerHTML = \`<span class="cal-title-btn" onclick="openYearPicker()">\${year}\u5E74</span> <span class="cal-title-btn" onclick="openMonthPicker()">\${month + 1}\u6708</span>\`;
      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(7, 1fr)'; grid.innerHTML = '';
      const days = ['\u65E5','\u4E00','\u4E8C','\u4E09','\u56DB','\u4E94','\u516D']; days.forEach(d => grid.innerHTML += \`<div class="cal-day-name">\${d}</div>\`);
      const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
      const selectedStr = tempRepeatEnd || '';
      for(let i=0; i<firstDay; i++) grid.innerHTML += \`<div class="cal-date empty"></div>\`;
      for(let i=1; i<=daysInMonth; i++) {
        const d = new Date(year, month, i); const dStr = formatDate(d);
        let className = 'cal-date';
        if (dStr === selectedStr) className += ' selected';
        const el = document.createElement('div'); el.className = className; el.innerText = i;
        el.onclick = () => {
          tempRepeatEnd = formatDate(new Date(year, month, i));
          if (calendarRepeatEndTarget === 'add') {
            document.getElementById('add-repeat-end-display').innerText = '\u5FAA\u73AF\u622A\u6B62: ' + tempRepeatEnd;
          } else {
            document.getElementById('edit-repeat-end-display').innerText = '\u5FAA\u73AF\u622A\u6B62: ' + tempRepeatEnd;
          }
          document.getElementById('modal-calendar').classList.remove('active');
        };
        grid.appendChild(el);
      }
    }

    function renderCalendar() {
      calMode = 'date';
      const year = calDate.getFullYear(); const month = calDate.getMonth();
      const actionBtn = document.getElementById('cal-action-btn'); actionBtn.innerText = '\u8FD4\u56DE\u4ECA\u65E5'; actionBtn.onclick = jumpToToday;
      
      document.getElementById('cal-prev').innerText = '< \u4E0A\u6708'; document.getElementById('cal-next').innerText = '\u4E0B\u6708 >';
      document.getElementById('cal-title').innerHTML = \`<span class="cal-title-btn" onclick="openYearPicker()">\${year}\u5E74</span> <span class="cal-title-btn" onclick="openMonthPicker()">\${month + 1}\u6708</span>\`;
      
      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(7, 1fr)'; grid.innerHTML = '';
      const days = ['\u65E5','\u4E00','\u4E8C','\u4E09','\u56DB','\u4E94','\u516D']; days.forEach(d => grid.innerHTML += \`<div class="cal-day-name">\${d}</div>\`);
      const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
      const todayStr = formatDate(new Date()); const selectedStr = (calendarMode === 'select' || calendarMode === 'edit_date') ? formatDate(calDate) : formatDate(currentDate);

      for(let i=0; i<firstDay; i++) grid.innerHTML += \`<div class="cal-date empty"></div>\`;
      for(let i=1; i<=daysInMonth; i++) {
        const d = new Date(year, month, i); const dStr = formatDate(d);
        let className = 'cal-date';
        if (dStr === todayStr) className += ' today'; if (dStr === selectedStr) className += ' selected';
        const el = document.createElement('div'); el.className = className; el.innerText = i;
        el.onclick = () => {
          if (calendarMode === 'select') {
            tempAddDate = formatDate(new Date(year, month, i));
            document.getElementById('add-date-display').innerText = tempAddDate;
            document.getElementById('modal-calendar').classList.remove('active');
            calendarMode = 'navigate';
          } else if (calendarMode === 'edit_date') {
            tempEditDate = formatDate(new Date(year, month, i));
            document.getElementById('edit-date-display').innerText = tempEditDate;
            document.getElementById('modal-calendar').classList.remove('active');
            calendarMode = 'navigate';
          } else {
            currentDate = new Date(year, month, i);
            document.getElementById('modal-calendar').classList.remove('active');
            exitBatchMode();
            loadTodos();
          }
        };
        grid.appendChild(el);
      }
    }

    function openMonthPicker() {
      calMode = 'month';
      var backFn = (calendarMode === 'repeat_end') ? renderCalendarForRepeatEnd : renderCalendar;
      const actionBtn = document.getElementById('cal-action-btn'); actionBtn.innerText = '\u8FD4\u56DE'; actionBtn.onclick = backFn;
      document.getElementById('cal-prev').innerText = '< \u4E0A\u5E74'; document.getElementById('cal-next').innerText = '\u4E0B\u5E74 >';
      document.getElementById('cal-title').innerHTML = \`<span class="cal-title-btn" onclick="openYearPicker()">\${calDate.getFullYear()}\u5E74</span> <span class="cal-title-btn">\u9009\u62E9\u6708\u4EFD</span>\`;
      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(4, 1fr)'; grid.innerHTML = '';
      for(let i=0; i<12; i++) {
        const el = document.createElement('div'); el.className = 'cal-date' + (calDate.getMonth() === i ? ' selected' : ''); el.innerText = (i+1) + '\u6708';
        el.onclick = () => { calDate.setMonth(i); if (calendarMode === 'repeat_end') renderCalendarForRepeatEnd(); else renderCalendar(); }; grid.appendChild(el);
      }
    }

    function openYearPicker(startYear) {
      calMode = 'year';
      if (!startYear) startYear = calDate.getFullYear() - 4; yearPickerStart = startYear;
      var backFn = (calendarMode === 'repeat_end') ? renderCalendarForRepeatEnd : renderCalendar;
      const actionBtn = document.getElementById('cal-action-btn'); actionBtn.innerText = '\u8FD4\u56DE'; actionBtn.onclick = backFn;
      document.getElementById('cal-prev').innerText = '< \u4E0A\u9875'; document.getElementById('cal-next').innerText = '\u4E0B\u9875 >';
      document.getElementById('cal-title').innerHTML = \`<span class="cal-title-btn">\u9009\u62E9\u5E74\u4EFD</span> <span class="cal-title-btn" onclick="openMonthPicker()">\${calDate.getMonth() + 1}\u6708</span>\`;
      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(4, 1fr)'; grid.innerHTML = '';
      for(let i=0; i<12; i++) {
        const y = startYear + i; const el = document.createElement('div');
        el.className = 'cal-date' + (calDate.getFullYear() === y ? ' selected' : ''); el.innerText = y;
        el.onclick = () => { calDate.setFullYear(y); if (calendarMode === 'repeat_end') renderCalendarForRepeatEnd(); else renderCalendar(); }; grid.appendChild(el);
      }
    }

    function changeDate(offset) { exitBatchMode(); currentDate.setDate(currentDate.getDate() + offset); loadTodos(); }
    function jumpToToday() {
      if (calendarMode === 'select') {
        tempAddDate = formatDate(new Date());
        document.getElementById('add-date-display').innerText = tempAddDate;
        document.getElementById('modal-calendar').classList.remove('active');
        calendarMode = 'navigate';
      } else if (calendarMode === 'edit_date') {
        tempEditDate = formatDate(new Date());
        document.getElementById('edit-date-display').innerText = tempEditDate;
        document.getElementById('modal-calendar').classList.remove('active');
        calendarMode = 'navigate';
      } else if (calendarMode === 'repeat_end') {
        calDate = new Date();
        renderCalendarForRepeatEnd();
      } else {
        exitBatchMode();
        currentDate = new Date();
        document.getElementById('modal-calendar').classList.remove('active');
        loadTodos();
      }
    }
    
    function closeCalendar() {
      document.getElementById('modal-calendar').classList.remove('active');
      calendarMode = 'navigate';
    }

    if (!CSS.supports || !CSS.supports('selector(:has(*))')) {
      new MutationObserver(function() {
        var locked = !!document.querySelector('.modal-overlay.active, .detail-overlay.active');
        document.body.style.overflow = locked ? 'hidden' : '';
        document.body.style.touchAction = locked ? 'none' : '';
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    
`;

// src/html/js/bootstrap.js
var bootstrap = `
    async function bootstrap() {
      if (_previewRedirecting) return;
      await initSettings();
      initVersionDisplay();
      if (document.getElementById('login-view').classList.contains('hidden')) {
        loadTodos();
        checkInterruptedImport();
      }
    }
    bootstrap();

    async function resetScaleBrowserData() {
      var currentUA = navigator.userAgent || '';
      setScaleForUA(currentUA, 1.0);
      tempAppScale = 1.0;
      var scaleSlider = document.getElementById('scale-slider');
      var scaleDisplay = document.getElementById('scale-value-display');
      var scalePreview = document.getElementById('scale-preview');
      if (scaleSlider) scaleSlider.value = 1.0;
      if (scaleDisplay) scaleDisplay.innerText = '100%';
      if (scalePreview) scalePreview.style.zoom = 1.0;
      updateScalePresetButtons();
      applyAppScale(1.0);
    
      await fetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(appSettings),
        headers: { 'Content-Type': 'application/json' }
      });
    }

    Object.assign(window, {
      // \u767B\u5F55
      login: login,
      logout: async function() {
        await fetch('/api/logout', { method: 'POST' });
        location.reload();
      },
      // \u4E3B\u9898
      toggleTheme: toggleTheme,
      // \u65E5\u671F\u5BFC\u822A
      changeDate: changeDate,
      openCalendar: openCalendar,
      closeCalendar: closeCalendar,
      jumpToToday: jumpToToday,
      calChange: calChange,
      openYearPicker: openYearPicker,
      openMonthPicker: openMonthPicker,
      // \u65B0\u5EFA\u4E8B\u9879
      openAddModal: openAddModal,
      closeAddModal: closeAddModal,
      confirmAddTask: confirmAddTask,
      openCalendarForAdd: openCalendarForAdd,
      openCalendarForEdit: openCalendarForEdit,
      openCalendarForRepeatEnd: openCalendarForRepeatEnd,
      addTempSubtask: addTempSubtask,
      removeTempSubtask: removeTempSubtask,
      toggleAddSearch: toggleAddSearch,
      regenerateAddSearchTerms: regenerateAddSearchTerms,
      toggleTempSearchTerm: toggleTempSearchTerm,
      copyTempSearchTerm: copyTempSearchTerm,
      toggleProviderMenu: toggleProviderMenu,
      selectProvider: selectProvider,
      toggleRepeatMenu: toggleRepeatMenu,
      selectRepeat: selectRepeat,
      openTimePicker: openTimePicker,
      confirmTime: confirmTime,
      clearTime: clearTime,
      closeTimePicker: closeTimePicker,
      selectPriority: selectPriority,
      togglePriorityMenu: togglePriorityMenu,
      // \u5206\u7C7B
      openCategoryManage: openCategoryManage,
      toggleCatBatchMode: toggleCatBatchMode,
      catBatchSelectAll: catBatchSelectAll,
      batchDeleteCategories: batchDeleteCategories,
      toggleCatBatch: toggleCatBatch,
      catBatchDelete: catBatchDelete,
      toggleColorBatchMode: toggleColorBatchMode,
      batchDeleteCustomColors: batchDeleteCustomColors,
      toggleCategoryMenu: toggleCategoryMenu,
      selectCategory: selectCategory,
      createCategoryFromModal: createCategoryFromModal,
      closeCategoryModal: closeCategoryModal,
      onCategorySearchInput: onCategorySearchInput,
      onCategorySearchEnter: onCategorySearchEnter,
      toggleCategoryMode: toggleCategoryMode,
      onCategoryCreateEnter: onCategoryCreateEnter,
      onCategoryCreateInput: onCategoryCreateInput,
      onCategoryCreateBtnClick: onCategoryCreateBtnClick,
      // \u89C6\u56FE
      openViewModal: openViewModal,
      closeViewModal: closeViewModal,
      setViewFilter: setViewFilter,
      setViewCategory: setViewCategory,
      setViewSort: setViewSort,
      setViewOrder: setViewOrder,
      // \u6279\u91CF\u64CD\u4F5C
      toggleBatchMode: toggleBatchMode,
      batchSelectAll: batchSelectAll,
      batchToggleDone: batchToggleDone,
      batchDelete: batchDelete,
      exitBatchMode: exitBatchMode,
      // \u8BE6\u60C5
      openDetail: openDetail,
      closeDetail: closeDetail,
      toggleEditMode: toggleEditMode,
      handleActionClick: handleActionClick,
      confirmAction: confirmAction,
      toggleSubtask: toggleSubtask,
      toggleSearchTerm: toggleSearchTerm,
      copySearchTerm: copySearchTerm,
      copyText: copyText,
      toggleEditSearch: toggleEditSearch,
      regenerateEditSearchTerms: regenerateEditSearchTerms,
      // \u56DE\u6536\u7AD9
      openTrash: openTrash,
      closeTrash: closeTrash,
      actionTrash: actionTrash,
      clearTrash: clearTrash,
      toggleTrashBatchMode: toggleTrashBatchMode,
      exitTrashBatchMode: exitTrashBatchMode,
      batchTrashSelectAll: batchTrashSelectAll,
      batchTrashRestore: batchTrashRestore,
      batchTrashDelete: batchTrashDelete,
      toggleTrashBatchSelect: toggleTrashBatchSelect,
      // \u7EDF\u8BA1
      openStats: openStats,
      closeStats: closeStats,
      switchStatsTab: switchStatsTab,
      loadAnnualReport: loadAnnualReport,
      // \u8BBE\u7F6E
      openSettings: openSettings,
      closeSettings: closeSettings,
      saveAndCloseSettings: saveAndCloseSettings,
      toggleSettingPopover: toggleSettingPopover,
      selectSetting: selectSetting,
      toggleCustomCodeEnabled: toggleCustomCodeEnabled,
      previewCustomCode: previewCustomCode,
      resetCustomCode: resetCustomCode,
      restoreAllPreview: restoreAllPreview,
      // \u6570\u636E\u7BA1\u7406
      exportData: exportData,
      importData: importData,
      factoryReset: factoryReset,
      deleteSessionByIndex: deleteSessionByIndex,
      deleteAllSessions: deleteAllSessions,
      // API \u5BC6\u94A5\u7BA1\u7406
      loadApiKeys: loadApiKeys,
      createApiKey: createApiKey,
      deleteApiKey: deleteApiKey,
      toggleApiKey: toggleApiKey,
      onScaleSliderChange: onScaleSliderChange,
      setScalePreset: setScalePreset,
      resetScaleBrowserData: resetScaleBrowserData,
      checkUpdate: checkUpdate,
      compareVersions: compareVersions,
      openChangelogModal: openChangelogModal,
      closeChangelogModal: closeChangelogModal,
    });
`;

// src/html/index.js
var safeForScriptTag = /* @__PURE__ */ __name((s) => JSON.stringify(s || "").replace(/<\//g, "<\\/"), "safeForScriptTag");
function renderHTML(isAuthorized, customHeader, customContent) {
  let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>MOARA \u5F85\u529E\u4E8B\u9879</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
  <style>
${css}
  </style>
  <script>/*CUSTOM_HEADER_PLACEHOLDER*/<\/script>
</head>
${getBody(isAuthorized)}
  <script>/*CUSTOM_GLOBALS_PLACEHOLDER*/<\/script>
  <script>
  (function() {
    'use strict';

${core}

${todos}

${settings}

${io}

${stats}

${trash}

${categories}

${detail}

${calendar}

${bootstrap}

  })();
  <\/script>
  <script>/*CUSTOM_CONTENT_PLACEHOLDER*/<\/script>
</body>
</html>
  `;
  html = html.replaceAll("${APP_VERSION}", APP_VERSION);
  html = html.replaceAll("${CHANGELOG_JSON}", JSON.stringify(CHANGELOG).replace(/<\//g, "<\\/"));
  html = html.replace(
    "<script>/*CUSTOM_HEADER_PLACEHOLDER*/<\/script>",
    customHeader || ""
  );
  html = html.replace(
    "<script>/*CUSTOM_GLOBALS_PLACEHOLDER*/<\/script>",
    `<script>window.__CUSTOM_HEADER__=${safeForScriptTag(customHeader)};window.__CUSTOM_CONTENT__=${safeForScriptTag(customContent)};<\/script>`
  );
  html = html.replace(
    "<script>/*CUSTOM_CONTENT_PLACEHOLDER*/<\/script>",
    customContent || ""
  );
  return html;
}
__name(renderHTML, "renderHTML");

// node_modules/ical.js/dist/ical.js
var Binary = class _Binary {
  static {
    __name(this, "Binary");
  }
  /**
   * Creates a binary value from the given string.
   *
   * @param {String} aString        The binary value string
   * @return {Binary}               The binary value instance
   */
  static fromString(aString) {
    return new _Binary(aString);
  }
  /**
   * Creates a new ICAL.Binary instance
   *
   * @param {String} aValue     The binary data for this value
   */
  constructor(aValue) {
    this.value = aValue;
  }
  /**
   * The type name, to be used in the jCal object.
   * @default "binary"
   * @constant
   */
  icaltype = "binary";
  /**
   * Base64 decode the current value
   *
   * @return {String}         The base64-decoded value
   */
  decodeValue() {
    return this._b64_decode(this.value);
  }
  /**
   * Encodes the passed parameter with base64 and sets the internal
   * value to the result.
   *
   * @param {String} aValue      The raw binary value to encode
   */
  setEncodedValue(aValue) {
    this.value = this._b64_encode(aValue);
  }
  _b64_encode(data) {
    let b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, enc = "", tmp_arr = [];
    if (!data) {
      return data;
    }
    do {
      o1 = data.charCodeAt(i++);
      o2 = data.charCodeAt(i++);
      o3 = data.charCodeAt(i++);
      bits = o1 << 16 | o2 << 8 | o3;
      h1 = bits >> 18 & 63;
      h2 = bits >> 12 & 63;
      h3 = bits >> 6 & 63;
      h4 = bits & 63;
      tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
    } while (i < data.length);
    enc = tmp_arr.join("");
    let r = data.length % 3;
    return (r ? enc.slice(0, r - 3) : enc) + "===".slice(r || 3);
  }
  _b64_decode(data) {
    let b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, dec = "", tmp_arr = [];
    if (!data) {
      return data;
    }
    data += "";
    do {
      h1 = b64.indexOf(data.charAt(i++));
      h2 = b64.indexOf(data.charAt(i++));
      h3 = b64.indexOf(data.charAt(i++));
      h4 = b64.indexOf(data.charAt(i++));
      bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;
      o1 = bits >> 16 & 255;
      o2 = bits >> 8 & 255;
      o3 = bits & 255;
      if (h3 == 64) {
        tmp_arr[ac++] = String.fromCharCode(o1);
      } else if (h4 == 64) {
        tmp_arr[ac++] = String.fromCharCode(o1, o2);
      } else {
        tmp_arr[ac++] = String.fromCharCode(o1, o2, o3);
      }
    } while (i < data.length);
    dec = tmp_arr.join("");
    return dec;
  }
  /**
   * The string representation of this value
   * @return {String}
   */
  toString() {
    return this.value;
  }
};
var DURATION_LETTERS = /([PDWHMTS]{1,1})/;
var DATA_PROPS_TO_COPY = ["weeks", "days", "hours", "minutes", "seconds", "isNegative"];
var Duration = class _Duration {
  static {
    __name(this, "Duration");
  }
  /**
   * Returns a new ICAL.Duration instance from the passed seconds value.
   *
   * @param {Number} aSeconds       The seconds to create the instance from
   * @return {Duration}             The newly created duration instance
   */
  static fromSeconds(aSeconds) {
    return new _Duration().fromSeconds(aSeconds);
  }
  /**
   * Checks if the given string is an iCalendar duration value.
   *
   * @param {String} value      The raw ical value
   * @return {Boolean}          True, if the given value is of the
   *                              duration ical type
   */
  static isValueString(string) {
    return string[0] === "P" || string[1] === "P";
  }
  /**
   * Creates a new {@link ICAL.Duration} instance from the passed string.
   *
   * @param {String} aStr       The string to parse
   * @return {Duration}         The created duration instance
   */
  static fromString(aStr) {
    let pos = 0;
    let dict = /* @__PURE__ */ Object.create(null);
    let chunks = 0;
    while ((pos = aStr.search(DURATION_LETTERS)) !== -1) {
      let type = aStr[pos];
      let numeric = aStr.slice(0, Math.max(0, pos));
      aStr = aStr.slice(pos + 1);
      chunks += parseDurationChunk(type, numeric, dict);
    }
    if (chunks < 2) {
      throw new Error(
        'invalid duration value: Not enough duration components in "' + aStr + '"'
      );
    }
    return new _Duration(dict);
  }
  /**
   * Creates a new ICAL.Duration instance from the given data object.
   *
   * @param {Object} aData                An object with members of the duration
   * @param {Number=} aData.weeks         Duration in weeks
   * @param {Number=} aData.days          Duration in days
   * @param {Number=} aData.hours         Duration in hours
   * @param {Number=} aData.minutes       Duration in minutes
   * @param {Number=} aData.seconds       Duration in seconds
   * @param {Boolean=} aData.isNegative   If true, the duration is negative
   * @return {Duration}                   The createad duration instance
   */
  static fromData(aData) {
    return new _Duration(aData);
  }
  /**
   * Creates a new ICAL.Duration instance.
   *
   * @param {Object} data                 An object with members of the duration
   * @param {Number=} data.weeks          Duration in weeks
   * @param {Number=} data.days           Duration in days
   * @param {Number=} data.hours          Duration in hours
   * @param {Number=} data.minutes        Duration in minutes
   * @param {Number=} data.seconds        Duration in seconds
   * @param {Boolean=} data.isNegative    If true, the duration is negative
   */
  constructor(data) {
    this.wrappedJSObject = this;
    this.fromData(data);
  }
  /**
   * The weeks in this duration
   * @type {Number}
   * @default 0
   */
  weeks = 0;
  /**
   * The days in this duration
   * @type {Number}
   * @default 0
   */
  days = 0;
  /**
   * The days in this duration
   * @type {Number}
   * @default 0
   */
  hours = 0;
  /**
   * The minutes in this duration
   * @type {Number}
   * @default 0
   */
  minutes = 0;
  /**
   * The seconds in this duration
   * @type {Number}
   * @default 0
   */
  seconds = 0;
  /**
   * The seconds in this duration
   * @type {Boolean}
   * @default false
   */
  isNegative = false;
  /**
   * The class identifier.
   * @constant
   * @type {String}
   * @default "icalduration"
   */
  icalclass = "icalduration";
  /**
   * The type name, to be used in the jCal object.
   * @constant
   * @type {String}
   * @default "duration"
   */
  icaltype = "duration";
  /**
   * Returns a clone of the duration object.
   *
   * @return {Duration}      The cloned object
   */
  clone() {
    return _Duration.fromData(this);
  }
  /**
   * The duration value expressed as a number of seconds.
   *
   * @return {Number}             The duration value in seconds
   */
  toSeconds() {
    let seconds = this.seconds + 60 * this.minutes + 3600 * this.hours + 86400 * this.days + 7 * 86400 * this.weeks;
    return this.isNegative ? -seconds : seconds;
  }
  /**
   * Reads the passed seconds value into this duration object. Afterwards,
   * members like {@link ICAL.Duration#days days} and {@link ICAL.Duration#weeks weeks} will be set up
   * accordingly.
   *
   * @param {Number} aSeconds     The duration value in seconds
   * @return {Duration}           Returns this instance
   */
  fromSeconds(aSeconds) {
    let secs = Math.abs(aSeconds);
    this.isNegative = aSeconds < 0;
    this.days = trunc(secs / 86400);
    if (this.days % 7 == 0) {
      this.weeks = this.days / 7;
      this.days = 0;
    } else {
      this.weeks = 0;
    }
    secs -= (this.days + 7 * this.weeks) * 86400;
    this.hours = trunc(secs / 3600);
    secs -= this.hours * 3600;
    this.minutes = trunc(secs / 60);
    secs -= this.minutes * 60;
    this.seconds = secs;
    return this;
  }
  /**
   * Sets up the current instance using members from the passed data object.
   *
   * @param {Object} aData                An object with members of the duration
   * @param {Number=} aData.weeks         Duration in weeks
   * @param {Number=} aData.days          Duration in days
   * @param {Number=} aData.hours         Duration in hours
   * @param {Number=} aData.minutes       Duration in minutes
   * @param {Number=} aData.seconds       Duration in seconds
   * @param {Boolean=} aData.isNegative   If true, the duration is negative
   */
  fromData(aData) {
    for (let prop of DATA_PROPS_TO_COPY) {
      if (aData && prop in aData) {
        this[prop] = aData[prop];
      } else {
        this[prop] = 0;
      }
    }
  }
  /**
   * Resets the duration instance to the default values, i.e. PT0S
   */
  reset() {
    this.isNegative = false;
    this.weeks = 0;
    this.days = 0;
    this.hours = 0;
    this.minutes = 0;
    this.seconds = 0;
  }
  /**
   * Compares the duration instance with another one.
   *
   * @param {Duration} aOther             The instance to compare with
   * @return {Number}                     -1, 0 or 1 for less/equal/greater
   */
  compare(aOther) {
    let thisSeconds = this.toSeconds();
    let otherSeconds = aOther.toSeconds();
    return (thisSeconds > otherSeconds) - (thisSeconds < otherSeconds);
  }
  /**
   * Normalizes the duration instance. For example, a duration with a value
   * of 61 seconds will be normalized to 1 minute and 1 second.
   */
  normalize() {
    this.fromSeconds(this.toSeconds());
  }
  /**
   * The string representation of this duration.
   * @return {String}
   */
  toString() {
    if (this.toSeconds() == 0) {
      return "PT0S";
    } else {
      let str = "";
      if (this.isNegative) str += "-";
      str += "P";
      let hasWeeks = false;
      if (this.weeks) {
        if (this.days || this.hours || this.minutes || this.seconds) {
          str += this.weeks * 7 + this.days + "D";
        } else {
          str += this.weeks + "W";
          hasWeeks = true;
        }
      } else if (this.days) {
        str += this.days + "D";
      }
      if (!hasWeeks) {
        if (this.hours || this.minutes || this.seconds) {
          str += "T";
          if (this.hours) {
            str += this.hours + "H";
          }
          if (this.minutes) {
            str += this.minutes + "M";
          }
          if (this.seconds) {
            str += this.seconds + "S";
          }
        }
      }
      return str;
    }
  }
  /**
   * The iCalendar string representation of this duration.
   * @return {String}
   */
  toICALString() {
    return this.toString();
  }
};
function parseDurationChunk(letter, number, object) {
  let type;
  switch (letter) {
    case "P":
      if (number && number === "-") {
        object.isNegative = true;
      } else {
        object.isNegative = false;
      }
      break;
    case "D":
      type = "days";
      break;
    case "W":
      type = "weeks";
      break;
    case "H":
      type = "hours";
      break;
    case "M":
      type = "minutes";
      break;
    case "S":
      type = "seconds";
      break;
    default:
      return 0;
  }
  if (type) {
    if (!number && number !== 0) {
      throw new Error(
        'invalid duration value: Missing number before "' + letter + '"'
      );
    }
    let num = parseInt(number, 10);
    if (isStrictlyNaN(num)) {
      throw new Error(
        'invalid duration value: Invalid number "' + number + '" before "' + letter + '"'
      );
    }
    object[type] = num;
  }
  return 1;
}
__name(parseDurationChunk, "parseDurationChunk");
var Period = class _Period {
  static {
    __name(this, "Period");
  }
  /**
   * Creates a new {@link ICAL.Period} instance from the passed string.
   *
   * @param {String} str            The string to parse
   * @param {Property} prop         The property this period will be on
   * @return {Period}               The created period instance
   */
  static fromString(str, prop) {
    let parts = str.split("/");
    if (parts.length !== 2) {
      throw new Error(
        'Invalid string value: "' + str + '" must contain a "/" char.'
      );
    }
    let options = {
      start: Time.fromDateTimeString(parts[0], prop)
    };
    let end = parts[1];
    if (Duration.isValueString(end)) {
      options.duration = Duration.fromString(end);
    } else {
      options.end = Time.fromDateTimeString(end, prop);
    }
    return new _Period(options);
  }
  /**
   * Creates a new {@link ICAL.Period} instance from the given data object.
   * The passed data object cannot contain both and end date and a duration.
   *
   * @param {Object} aData                  An object with members of the period
   * @param {Time=} aData.start             The start of the period
   * @param {Time=} aData.end               The end of the period
   * @param {Duration=} aData.duration      The duration of the period
   * @return {Period}                       The period instance
   */
  static fromData(aData) {
    return new _Period(aData);
  }
  /**
   * Returns a new period instance from the given jCal data array. The first
   * member is always the start date string, the second member is either a
   * duration or end date string.
   *
   * @param {jCalComponent} aData           The jCal data array
   * @param {Property} aProp                The property this jCal data is on
   * @param {Boolean} aLenient              If true, data value can be both date and date-time
   * @return {Period}                       The period instance
   */
  static fromJSON(aData, aProp, aLenient) {
    function fromDateOrDateTimeString(aValue, dateProp) {
      if (aLenient) {
        return Time.fromString(aValue, dateProp);
      } else {
        return Time.fromDateTimeString(aValue, dateProp);
      }
    }
    __name(fromDateOrDateTimeString, "fromDateOrDateTimeString");
    if (Duration.isValueString(aData[1])) {
      return _Period.fromData({
        start: fromDateOrDateTimeString(aData[0], aProp),
        duration: Duration.fromString(aData[1])
      });
    } else {
      return _Period.fromData({
        start: fromDateOrDateTimeString(aData[0], aProp),
        end: fromDateOrDateTimeString(aData[1], aProp)
      });
    }
  }
  /**
   * Creates a new ICAL.Period instance. The passed data object cannot contain both and end date and
   * a duration.
   *
   * @param {Object} aData                  An object with members of the period
   * @param {Time=} aData.start             The start of the period
   * @param {Time=} aData.end               The end of the period
   * @param {Duration=} aData.duration      The duration of the period
   */
  constructor(aData) {
    this.wrappedJSObject = this;
    if (aData && "start" in aData) {
      if (aData.start && !(aData.start instanceof Time)) {
        throw new TypeError(".start must be an instance of ICAL.Time");
      }
      this.start = aData.start;
    }
    if (aData && aData.end && aData.duration) {
      throw new Error("cannot accept both end and duration");
    }
    if (aData && "end" in aData) {
      if (aData.end && !(aData.end instanceof Time)) {
        throw new TypeError(".end must be an instance of ICAL.Time");
      }
      this.end = aData.end;
    }
    if (aData && "duration" in aData) {
      if (aData.duration && !(aData.duration instanceof Duration)) {
        throw new TypeError(".duration must be an instance of ICAL.Duration");
      }
      this.duration = aData.duration;
    }
  }
  /**
   * The start of the period
   * @type {Time}
   */
  start = null;
  /**
   * The end of the period
   * @type {Time}
   */
  end = null;
  /**
   * The duration of the period
   * @type {Duration}
   */
  duration = null;
  /**
   * The class identifier.
   * @constant
   * @type {String}
   * @default "icalperiod"
   */
  icalclass = "icalperiod";
  /**
   * The type name, to be used in the jCal object.
   * @constant
   * @type {String}
   * @default "period"
   */
  icaltype = "period";
  /**
   * Returns a clone of the duration object.
   *
   * @return {Period}      The cloned object
   */
  clone() {
    return _Period.fromData({
      start: this.start ? this.start.clone() : null,
      end: this.end ? this.end.clone() : null,
      duration: this.duration ? this.duration.clone() : null
    });
  }
  /**
   * Calculates the duration of the period, either directly or by subtracting
   * start from end date.
   *
   * @return {Duration}      The calculated duration
   */
  getDuration() {
    if (this.duration) {
      return this.duration;
    } else {
      return this.end.subtractDate(this.start);
    }
  }
  /**
   * Calculates the end date of the period, either directly or by adding
   * duration to start date.
   *
   * @return {Time}          The calculated end date
   */
  getEnd() {
    if (this.end) {
      return this.end;
    } else {
      let end = this.start.clone();
      end.addDuration(this.duration);
      return end;
    }
  }
  /**
   * Compare this period with a date or other period. To maintain the logic where a.compare(b)
   * returns 1 when a > b, this function will return 1 when the period is after the date, 0 when the
   * date is within the period, and -1 when the period is before the date. When comparing two
   * periods, as soon as they overlap in any way this will return 0.
   *
   * @param {Time|Period} dt    The date or other period to compare with
   */
  compare(dt) {
    if (dt.compare(this.start) < 0) {
      return 1;
    } else if (dt.compare(this.getEnd()) > 0) {
      return -1;
    } else {
      return 0;
    }
  }
  /**
   * The string representation of this period.
   * @return {String}
   */
  toString() {
    return this.start + "/" + (this.end || this.duration);
  }
  /**
   * The jCal representation of this period type.
   * @return {Object}
   */
  toJSON() {
    return [this.start.toString(), (this.end || this.duration).toString()];
  }
  /**
   * The iCalendar string representation of this period.
   * @return {String}
   */
  toICALString() {
    return this.start.toICALString() + "/" + (this.end || this.duration).toICALString();
  }
};
var Time = class _Time {
  static {
    __name(this, "Time");
  }
  static _dowCache = {};
  static _wnCache = {};
  /**
   * Returns the days in the given month
   *
   * @param {Number} month      The month to check
   * @param {Number} year       The year to check
   * @return {Number}           The number of days in the month
   */
  static daysInMonth(month, year) {
    let _daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let days = 30;
    if (month < 1 || month > 12) return days;
    days = _daysInMonth[month];
    if (month == 2) {
      days += _Time.isLeapYear(year);
    }
    return days;
  }
  /**
   * Checks if the year is a leap year
   *
   * @param {Number} year       The year to check
   * @return {Boolean}          True, if the year is a leap year
   */
  static isLeapYear(year) {
    if (year <= 1752) {
      return year % 4 == 0;
    } else {
      return year % 4 == 0 && year % 100 != 0 || year % 400 == 0;
    }
  }
  /**
   * Create a new ICAL.Time from the day of year and year. The date is returned
   * in floating timezone.
   *
   * @param {Number} aDayOfYear     The day of year
   * @param {Number} aYear          The year to create the instance in
   * @return {Time}                 The created instance with the calculated date
   */
  static fromDayOfYear(aDayOfYear, aYear) {
    let year = aYear;
    let doy = aDayOfYear;
    let tt = new _Time();
    tt.auto_normalize = false;
    let is_leap = _Time.isLeapYear(year) ? 1 : 0;
    if (doy < 1) {
      year--;
      is_leap = _Time.isLeapYear(year) ? 1 : 0;
      doy += _Time.daysInYearPassedMonth[is_leap][12];
      return _Time.fromDayOfYear(doy, year);
    } else if (doy > _Time.daysInYearPassedMonth[is_leap][12]) {
      is_leap = _Time.isLeapYear(year) ? 1 : 0;
      doy -= _Time.daysInYearPassedMonth[is_leap][12];
      year++;
      return _Time.fromDayOfYear(doy, year);
    }
    tt.year = year;
    tt.isDate = true;
    for (let month = 11; month >= 0; month--) {
      if (doy > _Time.daysInYearPassedMonth[is_leap][month]) {
        tt.month = month + 1;
        tt.day = doy - _Time.daysInYearPassedMonth[is_leap][month];
        break;
      }
    }
    tt.auto_normalize = true;
    return tt;
  }
  /**
   * Returns a new ICAL.Time instance from a date string, e.g 2015-01-02.
   *
   * @deprecated                Use {@link ICAL.Time.fromDateString} instead
   * @param {String} str        The string to create from
   * @return {Time}             The date/time instance
   */
  static fromStringv2(str) {
    return new _Time({
      year: parseInt(str.slice(0, 4), 10),
      month: parseInt(str.slice(5, 7), 10),
      day: parseInt(str.slice(8, 10), 10),
      isDate: true
    });
  }
  /**
   * Returns a new ICAL.Time instance from a date string, e.g 2015-01-02.
   *
   * @param {String} aValue     The string to create from
   * @return {Time}             The date/time instance
   */
  static fromDateString(aValue) {
    return new _Time({
      year: strictParseInt(aValue.slice(0, 4)),
      month: strictParseInt(aValue.slice(5, 7)),
      day: strictParseInt(aValue.slice(8, 10)),
      isDate: true
    });
  }
  /**
   * Returns a new ICAL.Time instance from a date-time string, e.g
   * 2015-01-02T03:04:05. If a property is specified, the timezone is set up
   * from the property's TZID parameter.
   *
   * @param {String} aValue         The string to create from
   * @param {Property=} prop        The property the date belongs to
   * @return {Time}                 The date/time instance
   */
  static fromDateTimeString(aValue, prop) {
    if (aValue.length < 19) {
      throw new Error(
        'invalid date-time value: "' + aValue + '"'
      );
    }
    let zone;
    let zoneId;
    if (aValue.slice(-1) === "Z") {
      zone = Timezone.utcTimezone;
    } else if (prop) {
      zoneId = prop.getParameter("tzid");
      if (prop.parent) {
        if (prop.parent.name === "standard" || prop.parent.name === "daylight") {
          zone = Timezone.localTimezone;
        } else if (zoneId) {
          zone = prop.parent.getTimeZoneByID(zoneId);
        }
      }
    }
    const timeData = {
      year: strictParseInt(aValue.slice(0, 4)),
      month: strictParseInt(aValue.slice(5, 7)),
      day: strictParseInt(aValue.slice(8, 10)),
      hour: strictParseInt(aValue.slice(11, 13)),
      minute: strictParseInt(aValue.slice(14, 16)),
      second: strictParseInt(aValue.slice(17, 19))
    };
    if (zoneId && !zone) {
      timeData.timezone = zoneId;
    }
    return new _Time(timeData, zone);
  }
  /**
   * Returns a new ICAL.Time instance from a date or date-time string,
   *
   * @param {String} aValue         The string to create from
   * @param {Property=} prop        The property the date belongs to
   * @return {Time}                 The date/time instance
   */
  static fromString(aValue, aProperty) {
    if (aValue.length > 10) {
      return _Time.fromDateTimeString(aValue, aProperty);
    } else {
      return _Time.fromDateString(aValue);
    }
  }
  /**
   * Creates a new ICAL.Time instance from the given Javascript Date.
   *
   * @param {?Date} aDate             The Javascript Date to read, or null to reset
   * @param {Boolean} [useUTC=false]  If true, the UTC values of the date will be used
   */
  static fromJSDate(aDate, useUTC) {
    let tt = new _Time();
    return tt.fromJSDate(aDate, useUTC);
  }
  /**
   * Creates a new ICAL.Time instance from the the passed data object.
   *
   * @param {timeInit} aData          Time initialization
   * @param {Timezone=} aZone         Timezone this position occurs in
   */
  static fromData = /* @__PURE__ */ __name(function fromData(aData, aZone) {
    let t = new _Time();
    return t.fromData(aData, aZone);
  }, "fromData");
  /**
   * Creates a new ICAL.Time instance from the current moment.
   * The instance is “floating” - has no timezone relation.
   * To create an instance considering the time zone, call
   * ICAL.Time.fromJSDate(new Date(), true)
   * @return {Time}
   */
  static now() {
    return _Time.fromJSDate(/* @__PURE__ */ new Date(), false);
  }
  /**
   * Returns the date on which ISO week number 1 starts.
   *
   * @see Time#weekNumber
   * @param {Number} aYear                  The year to search in
   * @param {weekDay=} aWeekStart           The week start weekday, used for calculation.
   * @return {Time}                         The date on which week number 1 starts
   */
  static weekOneStarts(aYear, aWeekStart) {
    let t = _Time.fromData({
      year: aYear,
      month: 1,
      day: 1,
      isDate: true
    });
    let dow = t.dayOfWeek();
    let wkst = aWeekStart || _Time.DEFAULT_WEEK_START;
    if (dow > _Time.THURSDAY) {
      t.day += 7;
    }
    if (wkst > _Time.THURSDAY) {
      t.day -= 7;
    }
    t.day -= dow - wkst;
    return t;
  }
  /**
   * Get the dominical letter for the given year. Letters range from A - G for
   * common years, and AG to GF for leap years.
   *
   * @param {Number} yr           The year to retrieve the letter for
   * @return {String}             The dominical letter.
   */
  static getDominicalLetter(yr) {
    let LTRS = "GFEDCBA";
    let dom = (yr + (yr / 4 | 0) + (yr / 400 | 0) - (yr / 100 | 0) - 1) % 7;
    let isLeap = _Time.isLeapYear(yr);
    if (isLeap) {
      return LTRS[(dom + 6) % 7] + LTRS[dom];
    } else {
      return LTRS[dom];
    }
  }
  static #epochTime = null;
  /**
   * January 1st, 1970 as an ICAL.Time.
   * @type {Time}
   * @constant
   * @instance
   */
  static get epochTime() {
    if (!this.#epochTime) {
      this.#epochTime = _Time.fromData({
        year: 1970,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        isDate: false,
        timezone: "Z"
      });
    }
    return this.#epochTime;
  }
  static _cmp_attr(a, b, attr) {
    if (a[attr] > b[attr]) return 1;
    if (a[attr] < b[attr]) return -1;
    return 0;
  }
  /**
   * The days that have passed in the year after a given month. The array has
   * two members, one being an array of passed days for non-leap years, the
   * other analog for leap years.
   * @example
   * var isLeapYear = ICAL.Time.isLeapYear(year);
   * var passedDays = ICAL.Time.daysInYearPassedMonth[isLeapYear][month];
   * @type {Array.<Array.<Number>>}
   */
  static daysInYearPassedMonth = [
    [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365],
    [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366]
  ];
  static SUNDAY = 1;
  static MONDAY = 2;
  static TUESDAY = 3;
  static WEDNESDAY = 4;
  static THURSDAY = 5;
  static FRIDAY = 6;
  static SATURDAY = 7;
  /**
   * The default weekday for the WKST part.
   * @constant
   * @default ICAL.Time.MONDAY
   */
  static DEFAULT_WEEK_START = 2;
  // MONDAY
  /**
   * Creates a new ICAL.Time instance.
   *
   * @param {timeInit} data           Time initialization
   * @param {Timezone} zone           timezone this position occurs in
   */
  constructor(data, zone) {
    this.wrappedJSObject = this;
    this._time = /* @__PURE__ */ Object.create(null);
    this._time.year = 0;
    this._time.month = 1;
    this._time.day = 1;
    this._time.hour = 0;
    this._time.minute = 0;
    this._time.second = 0;
    this._time.isDate = false;
    this.fromData(data, zone);
  }
  /**
   * The class identifier.
   * @constant
   * @type {String}
   * @default "icaltime"
   */
  icalclass = "icaltime";
  _cachedUnixTime = null;
  /**
   * The type name, to be used in the jCal object. This value may change and
   * is strictly defined by the {@link ICAL.Time#isDate isDate} member.
   * @type {String}
   * @default "date-time"
   */
  get icaltype() {
    return this.isDate ? "date" : "date-time";
  }
  /**
   * The timezone for this time.
   * @type {Timezone}
   */
  zone = null;
  /**
   * Internal uses to indicate that a change has been made and the next read
   * operation must attempt to normalize the value (for example changing the
   * day to 33).
   *
   * @type {Boolean}
   * @private
   */
  _pendingNormalization = false;
  /**
   * The year of this date.
   * @type {Number}
   */
  get year() {
    return this._getTimeAttr("year");
  }
  set year(val) {
    this._setTimeAttr("year", val);
  }
  /**
   * The month of this date.
   * @type {Number}
   */
  get month() {
    return this._getTimeAttr("month");
  }
  set month(val) {
    this._setTimeAttr("month", val);
  }
  /**
   * The day of this date.
   * @type {Number}
   */
  get day() {
    return this._getTimeAttr("day");
  }
  set day(val) {
    this._setTimeAttr("day", val);
  }
  /**
   * The hour of this date-time.
   * @type {Number}
   */
  get hour() {
    return this._getTimeAttr("hour");
  }
  set hour(val) {
    this._setTimeAttr("hour", val);
  }
  /**
   * The minute of this date-time.
   * @type {Number}
   */
  get minute() {
    return this._getTimeAttr("minute");
  }
  set minute(val) {
    this._setTimeAttr("minute", val);
  }
  /**
   * The second of this date-time.
   * @type {Number}
   */
  get second() {
    return this._getTimeAttr("second");
  }
  set second(val) {
    this._setTimeAttr("second", val);
  }
  /**
   * If true, the instance represents a date (as opposed to a date-time)
   * @type {Boolean}
   */
  get isDate() {
    return this._getTimeAttr("isDate");
  }
  set isDate(val) {
    this._setTimeAttr("isDate", val);
  }
  /**
   * @private
   * @param {String} attr             Attribute to get (one of: year, month,
   *                                  day, hour, minute, second, isDate)
   * @return {Number|Boolean}         Current value for the attribute
   */
  _getTimeAttr(attr) {
    if (this._pendingNormalization) {
      this._normalize();
      this._pendingNormalization = false;
    }
    return this._time[attr];
  }
  /**
   * @private
   * @param {String} attr             Attribute to set (one of: year, month,
   *                                  day, hour, minute, second, isDate)
   * @param {Number|Boolean} val      New value for the attribute
   */
  _setTimeAttr(attr, val) {
    if (attr === "isDate" && val && !this._time.isDate) {
      this.adjust(0, 0, 0, 0);
    }
    this._cachedUnixTime = null;
    this._pendingNormalization = true;
    this._time[attr] = val;
  }
  /**
   * Returns a clone of the time object.
   *
   * @return {Time}              The cloned object
   */
  clone() {
    return new _Time(this._time, this.zone);
  }
  /**
   * Reset the time instance to epoch time
   */
  reset() {
    this.fromData(_Time.epochTime);
    this.zone = Timezone.utcTimezone;
  }
  /**
   * Reset the time instance to the given date/time values.
   *
   * @param {Number} year             The year to set
   * @param {Number} month            The month to set
   * @param {Number} day              The day to set
   * @param {Number} hour             The hour to set
   * @param {Number} minute           The minute to set
   * @param {Number} second           The second to set
   * @param {Timezone} timezone       The timezone to set
   */
  resetTo(year, month, day, hour, minute, second, timezone) {
    this.fromData({
      year,
      month,
      day,
      hour,
      minute,
      second,
      zone: timezone
    });
  }
  /**
   * Set up the current instance from the Javascript date value.
   *
   * @param {?Date} aDate             The Javascript Date to read, or null to reset
   * @param {Boolean} [useUTC=false]  If true, the UTC values of the date will be used
   */
  fromJSDate(aDate, useUTC) {
    if (!aDate) {
      this.reset();
    } else {
      if (useUTC) {
        this.zone = Timezone.utcTimezone;
        this.year = aDate.getUTCFullYear();
        this.month = aDate.getUTCMonth() + 1;
        this.day = aDate.getUTCDate();
        this.hour = aDate.getUTCHours();
        this.minute = aDate.getUTCMinutes();
        this.second = aDate.getUTCSeconds();
      } else {
        this.zone = Timezone.localTimezone;
        this.year = aDate.getFullYear();
        this.month = aDate.getMonth() + 1;
        this.day = aDate.getDate();
        this.hour = aDate.getHours();
        this.minute = aDate.getMinutes();
        this.second = aDate.getSeconds();
      }
    }
    this._cachedUnixTime = null;
    return this;
  }
  /**
   * Sets up the current instance using members from the passed data object.
   *
   * @param {timeInit} aData          Time initialization
   * @param {Timezone=} aZone         Timezone this position occurs in
   */
  fromData(aData, aZone) {
    if (aData) {
      for (let [key, value] of Object.entries(aData)) {
        if (key === "icaltype") continue;
        this[key] = value;
      }
    }
    if (aZone) {
      this.zone = aZone;
    }
    if (aData && !("isDate" in aData)) {
      this.isDate = !("hour" in aData);
    } else if (aData && "isDate" in aData) {
      this.isDate = aData.isDate;
    }
    if (aData && "timezone" in aData) {
      let zone = TimezoneService.get(
        aData.timezone
      );
      this.zone = zone || Timezone.localTimezone;
    }
    if (aData && "zone" in aData) {
      this.zone = aData.zone;
    }
    if (!this.zone) {
      this.zone = Timezone.localTimezone;
    }
    this._cachedUnixTime = null;
    return this;
  }
  /**
   * Calculate the day of week.
   * @param {weekDay=} aWeekStart
   *        The week start weekday, defaults to SUNDAY
   * @return {weekDay}
   */
  dayOfWeek(aWeekStart) {
    let firstDow = aWeekStart || _Time.SUNDAY;
    let dowCacheKey = (this.year << 12) + (this.month << 8) + (this.day << 3) + firstDow;
    if (dowCacheKey in _Time._dowCache) {
      return _Time._dowCache[dowCacheKey];
    }
    let q = this.day;
    let m = this.month + (this.month < 3 ? 12 : 0);
    let Y = this.year - (this.month < 3 ? 1 : 0);
    let h = q + Y + trunc((m + 1) * 26 / 10) + trunc(Y / 4);
    {
      h += trunc(Y / 100) * 6 + trunc(Y / 400);
    }
    h = (h + 7 - firstDow) % 7 + 1;
    _Time._dowCache[dowCacheKey] = h;
    return h;
  }
  /**
   * Calculate the day of year.
   * @return {Number}
   */
  dayOfYear() {
    let is_leap = _Time.isLeapYear(this.year) ? 1 : 0;
    let diypm = _Time.daysInYearPassedMonth;
    return diypm[is_leap][this.month - 1] + this.day;
  }
  /**
   * Returns a copy of the current date/time, rewound to the start of the
   * week. The resulting ICAL.Time instance is of icaltype date, even if this
   * is a date-time.
   *
   * @param {weekDay=} aWeekStart
   *        The week start weekday, defaults to SUNDAY
   * @return {Time}      The start of the week (cloned)
   */
  startOfWeek(aWeekStart) {
    let firstDow = aWeekStart || _Time.SUNDAY;
    let result = this.clone();
    result.day -= (this.dayOfWeek() + 7 - firstDow) % 7;
    result.isDate = true;
    result.hour = 0;
    result.minute = 0;
    result.second = 0;
    return result;
  }
  /**
   * Returns a copy of the current date/time, shifted to the end of the week.
   * The resulting ICAL.Time instance is of icaltype date, even if this is a
   * date-time.
   *
   * @param {weekDay=} aWeekStart
   *        The week start weekday, defaults to SUNDAY
   * @return {Time}      The end of the week (cloned)
   */
  endOfWeek(aWeekStart) {
    let firstDow = aWeekStart || _Time.SUNDAY;
    let result = this.clone();
    result.day += (7 - this.dayOfWeek() + firstDow - _Time.SUNDAY) % 7;
    result.isDate = true;
    result.hour = 0;
    result.minute = 0;
    result.second = 0;
    return result;
  }
  /**
   * Returns a copy of the current date/time, rewound to the start of the
   * month. The resulting ICAL.Time instance is of icaltype date, even if
   * this is a date-time.
   *
   * @return {Time}      The start of the month (cloned)
   */
  startOfMonth() {
    let result = this.clone();
    result.day = 1;
    result.isDate = true;
    result.hour = 0;
    result.minute = 0;
    result.second = 0;
    return result;
  }
  /**
   * Returns a copy of the current date/time, shifted to the end of the
   * month.  The resulting ICAL.Time instance is of icaltype date, even if
   * this is a date-time.
   *
   * @return {Time}      The end of the month (cloned)
   */
  endOfMonth() {
    let result = this.clone();
    result.day = _Time.daysInMonth(result.month, result.year);
    result.isDate = true;
    result.hour = 0;
    result.minute = 0;
    result.second = 0;
    return result;
  }
  /**
   * Returns a copy of the current date/time, rewound to the start of the
   * year. The resulting ICAL.Time instance is of icaltype date, even if
   * this is a date-time.
   *
   * @return {Time}      The start of the year (cloned)
   */
  startOfYear() {
    let result = this.clone();
    result.day = 1;
    result.month = 1;
    result.isDate = true;
    result.hour = 0;
    result.minute = 0;
    result.second = 0;
    return result;
  }
  /**
   * Returns a copy of the current date/time, shifted to the end of the
   * year.  The resulting ICAL.Time instance is of icaltype date, even if
   * this is a date-time.
   *
   * @return {Time}      The end of the year (cloned)
   */
  endOfYear() {
    let result = this.clone();
    result.day = 31;
    result.month = 12;
    result.isDate = true;
    result.hour = 0;
    result.minute = 0;
    result.second = 0;
    return result;
  }
  /**
   * First calculates the start of the week, then returns the day of year for
   * this date. If the day falls into the previous year, the day is zero or negative.
   *
   * @param {weekDay=} aFirstDayOfWeek
   *        The week start weekday, defaults to SUNDAY
   * @return {Number}     The calculated day of year
   */
  startDoyWeek(aFirstDayOfWeek) {
    let firstDow = aFirstDayOfWeek || _Time.SUNDAY;
    let delta = this.dayOfWeek() - firstDow;
    if (delta < 0) delta += 7;
    return this.dayOfYear() - delta;
  }
  /**
   * Get the dominical letter for the current year. Letters range from A - G
   * for common years, and AG to GF for leap years.
   *
   * @param {Number} yr           The year to retrieve the letter for
   * @return {String}             The dominical letter.
   */
  getDominicalLetter() {
    return _Time.getDominicalLetter(this.year);
  }
  /**
   * Finds the nthWeekDay relative to the current month (not day).  The
   * returned value is a day relative the month that this month belongs to so
   * 1 would indicate the first of the month and 40 would indicate a day in
   * the following month.
   *
   * @param {Number} aDayOfWeek   Day of the week see the day name constants
   * @param {Number} aPos         Nth occurrence of a given week day values
   *        of 1 and 0 both indicate the first weekday of that type. aPos may
   *        be either positive or negative
   *
   * @return {Number} numeric value indicating a day relative
   *                   to the current month of this time object
   */
  nthWeekDay(aDayOfWeek, aPos) {
    let daysInMonth = _Time.daysInMonth(this.month, this.year);
    let weekday;
    let pos = aPos;
    let start = 0;
    let otherDay = this.clone();
    if (pos >= 0) {
      otherDay.day = 1;
      if (pos != 0) {
        pos--;
      }
      start = otherDay.day;
      let startDow = otherDay.dayOfWeek();
      let offset = aDayOfWeek - startDow;
      if (offset < 0)
        offset += 7;
      start += offset;
      start -= aDayOfWeek;
      weekday = aDayOfWeek;
    } else {
      otherDay.day = daysInMonth;
      let endDow = otherDay.dayOfWeek();
      pos++;
      weekday = endDow - aDayOfWeek;
      if (weekday < 0) {
        weekday += 7;
      }
      weekday = daysInMonth - weekday;
    }
    weekday += pos * 7;
    return start + weekday;
  }
  /**
   * Checks if current time is the nth weekday, relative to the current
   * month.  Will always return false when rule resolves outside of current
   * month.
   *
   * @param {weekDay} aDayOfWeek                 Day of week to check
   * @param {Number} aPos                        Relative position
   * @return {Boolean}                           True, if it is the nth weekday
   */
  isNthWeekDay(aDayOfWeek, aPos) {
    let dow = this.dayOfWeek();
    if (aPos === 0 && dow === aDayOfWeek) {
      return true;
    }
    let day = this.nthWeekDay(aDayOfWeek, aPos);
    if (day === this.day) {
      return true;
    }
    return false;
  }
  /**
   * Calculates the ISO 8601 week number. The first week of a year is the
   * week that contains the first Thursday. The year can have 53 weeks, if
   * January 1st is a Friday.
   *
   * Note there are regions where the first week of the year is the one that
   * starts on January 1st, which may offset the week number. Also, if a
   * different week start is specified, this will also affect the week
   * number.
   *
   * @see Time.weekOneStarts
   * @param {weekDay} aWeekStart                  The weekday the week starts with
   * @return {Number}                             The ISO week number
   */
  weekNumber(aWeekStart) {
    let wnCacheKey = (this.year << 12) + (this.month << 8) + (this.day << 3) + aWeekStart;
    if (wnCacheKey in _Time._wnCache) {
      return _Time._wnCache[wnCacheKey];
    }
    let week1;
    let dt = this.clone();
    dt.isDate = true;
    let isoyear = this.year;
    if (dt.month == 12 && dt.day > 25) {
      week1 = _Time.weekOneStarts(isoyear + 1, aWeekStart);
      if (dt.compare(week1) < 0) {
        week1 = _Time.weekOneStarts(isoyear, aWeekStart);
      } else {
        isoyear++;
      }
    } else {
      week1 = _Time.weekOneStarts(isoyear, aWeekStart);
      if (dt.compare(week1) < 0) {
        week1 = _Time.weekOneStarts(--isoyear, aWeekStart);
      }
    }
    let daysBetween = dt.subtractDate(week1).toSeconds() / 86400;
    let answer = trunc(daysBetween / 7) + 1;
    _Time._wnCache[wnCacheKey] = answer;
    return answer;
  }
  /**
   * Adds the duration to the current time. The instance is modified in
   * place.
   *
   * @param {Duration} aDuration         The duration to add
   */
  addDuration(aDuration) {
    let mult = aDuration.isNegative ? -1 : 1;
    let second = this.second;
    let minute = this.minute;
    let hour = this.hour;
    let day = this.day;
    second += mult * aDuration.seconds;
    minute += mult * aDuration.minutes;
    hour += mult * aDuration.hours;
    day += mult * aDuration.days;
    day += mult * 7 * aDuration.weeks;
    this.second = second;
    this.minute = minute;
    this.hour = hour;
    this.day = day;
    this._cachedUnixTime = null;
  }
  /**
   * Subtract the date details (_excluding_ timezone).  Useful for finding
   * the relative difference between two time objects excluding their
   * timezone differences.
   *
   * @param {Time} aDate     The date to subtract
   * @return {Duration}      The difference as a duration
   */
  subtractDate(aDate) {
    let unixTime = this.toUnixTime() + this.utcOffset();
    let other = aDate.toUnixTime() + aDate.utcOffset();
    return Duration.fromSeconds(unixTime - other);
  }
  /**
   * Subtract the date details, taking timezones into account.
   *
   * @param {Time} aDate  The date to subtract
   * @return {Duration}   The difference in duration
   */
  subtractDateTz(aDate) {
    let unixTime = this.toUnixTime();
    let other = aDate.toUnixTime();
    return Duration.fromSeconds(unixTime - other);
  }
  /**
   * Compares the ICAL.Time instance with another one, or a period.
   *
   * @param {Time|Period} aOther                  The instance to compare with
   * @return {Number}                             -1, 0 or 1 for less/equal/greater
   */
  compare(other) {
    if (other instanceof Period) {
      return -1 * other.compare(this);
    } else {
      let a = this.toUnixTime();
      let b = other.toUnixTime();
      if (a > b) return 1;
      if (b > a) return -1;
      return 0;
    }
  }
  /**
   * Compares only the date part of this instance with another one.
   *
   * @param {Time} other                  The instance to compare with
   * @param {Timezone} tz                 The timezone to compare in
   * @return {Number}                     -1, 0 or 1 for less/equal/greater
   */
  compareDateOnlyTz(other, tz) {
    let a = this.convertToZone(tz);
    let b = other.convertToZone(tz);
    let rc = 0;
    if ((rc = _Time._cmp_attr(a, b, "year")) != 0) return rc;
    if ((rc = _Time._cmp_attr(a, b, "month")) != 0) return rc;
    if ((rc = _Time._cmp_attr(a, b, "day")) != 0) return rc;
    return rc;
  }
  /**
   * Convert the instance into another timezone. The returned ICAL.Time
   * instance is always a copy.
   *
   * @param {Timezone} zone      The zone to convert to
   * @return {Time}              The copy, converted to the zone
   */
  convertToZone(zone) {
    let copy = this.clone();
    let zone_equals = this.zone.tzid == zone.tzid;
    if (!this.isDate && !zone_equals) {
      Timezone.convert_time(copy, this.zone, zone);
    }
    copy.zone = zone;
    return copy;
  }
  /**
   * Calculates the UTC offset of the current date/time in the timezone it is
   * in.
   *
   * @return {Number}     UTC offset in seconds
   */
  utcOffset() {
    if (this.zone == Timezone.localTimezone || this.zone == Timezone.utcTimezone) {
      return 0;
    } else {
      return this.zone.utcOffset(this);
    }
  }
  /**
   * Returns an RFC 5545 compliant ical representation of this object.
   *
   * @return {String} ical date/date-time
   */
  toICALString() {
    let string = this.toString();
    if (string.length > 10) {
      return design.icalendar.value["date-time"].toICAL(string);
    } else {
      return design.icalendar.value.date.toICAL(string);
    }
  }
  /**
   * The string representation of this date/time, in jCal form
   * (including : and - separators).
   * @return {String}
   */
  toString() {
    let result = this.year + "-" + pad2(this.month) + "-" + pad2(this.day);
    if (!this.isDate) {
      result += "T" + pad2(this.hour) + ":" + pad2(this.minute) + ":" + pad2(this.second);
      if (this.zone === Timezone.utcTimezone) {
        result += "Z";
      }
    }
    return result;
  }
  /**
   * Converts the current instance to a Javascript date
   * @return {Date}
   */
  toJSDate() {
    if (this.zone == Timezone.localTimezone) {
      if (this.isDate) {
        return new Date(this.year, this.month - 1, this.day);
      } else {
        return new Date(
          this.year,
          this.month - 1,
          this.day,
          this.hour,
          this.minute,
          this.second,
          0
        );
      }
    } else {
      return new Date(this.toUnixTime() * 1e3);
    }
  }
  _normalize() {
    if (this._time.isDate) {
      this._time.hour = 0;
      this._time.minute = 0;
      this._time.second = 0;
    }
    this.adjust(0, 0, 0, 0);
    return this;
  }
  /**
   * Adjust the date/time by the given offset
   *
   * @param {Number} aExtraDays       The extra amount of days
   * @param {Number} aExtraHours      The extra amount of hours
   * @param {Number} aExtraMinutes    The extra amount of minutes
   * @param {Number} aExtraSeconds    The extra amount of seconds
   * @param {Number=} aTime           The time to adjust, defaults to the
   *                                    current instance.
   */
  adjust(aExtraDays, aExtraHours, aExtraMinutes, aExtraSeconds, aTime) {
    let minutesOverflow, hoursOverflow, daysOverflow = 0, yearsOverflow = 0;
    let second, minute, hour, day;
    let daysInMonth;
    let time = aTime || this._time;
    if (!time.isDate) {
      second = time.second + aExtraSeconds;
      time.second = second % 60;
      minutesOverflow = trunc(second / 60);
      if (time.second < 0) {
        time.second += 60;
        minutesOverflow--;
      }
      minute = time.minute + aExtraMinutes + minutesOverflow;
      time.minute = minute % 60;
      hoursOverflow = trunc(minute / 60);
      if (time.minute < 0) {
        time.minute += 60;
        hoursOverflow--;
      }
      hour = time.hour + aExtraHours + hoursOverflow;
      time.hour = hour % 24;
      daysOverflow = trunc(hour / 24);
      if (time.hour < 0) {
        time.hour += 24;
        daysOverflow--;
      }
    }
    if (time.month > 12) {
      yearsOverflow = trunc((time.month - 1) / 12);
    } else if (time.month < 1) {
      yearsOverflow = trunc(time.month / 12) - 1;
    }
    time.year += yearsOverflow;
    time.month -= 12 * yearsOverflow;
    day = time.day + aExtraDays + daysOverflow;
    if (day > 0) {
      for (; ; ) {
        daysInMonth = _Time.daysInMonth(time.month, time.year);
        if (day <= daysInMonth) {
          break;
        }
        time.month++;
        if (time.month > 12) {
          time.year++;
          time.month = 1;
        }
        day -= daysInMonth;
      }
    } else {
      while (day <= 0) {
        if (time.month == 1) {
          time.year--;
          time.month = 12;
        } else {
          time.month--;
        }
        day += _Time.daysInMonth(time.month, time.year);
      }
    }
    time.day = day;
    this._cachedUnixTime = null;
    return this;
  }
  /**
   * Sets up the current instance from unix time, the number of seconds since
   * January 1st, 1970.
   *
   * @param {Number} seconds      The seconds to set up with
   */
  fromUnixTime(seconds) {
    this.zone = Timezone.utcTimezone;
    let date = new Date(seconds * 1e3);
    this.year = date.getUTCFullYear();
    this.month = date.getUTCMonth() + 1;
    this.day = date.getUTCDate();
    if (this._time.isDate) {
      this.hour = 0;
      this.minute = 0;
      this.second = 0;
    } else {
      this.hour = date.getUTCHours();
      this.minute = date.getUTCMinutes();
      this.second = date.getUTCSeconds();
    }
    this._cachedUnixTime = null;
  }
  /**
   * Converts the current instance to seconds since January 1st 1970.
   *
   * @return {Number}         Seconds since 1970
   */
  toUnixTime() {
    if (this._cachedUnixTime !== null) {
      return this._cachedUnixTime;
    }
    let offset = this.utcOffset();
    let ms = Date.UTC(
      this.year,
      this.month - 1,
      this.day,
      this.hour,
      this.minute,
      this.second - offset
    );
    this._cachedUnixTime = ms / 1e3;
    return this._cachedUnixTime;
  }
  /**
   * Converts time to into Object which can be serialized then re-created
   * using the constructor.
   *
   * @example
   * // toJSON will automatically be called
   * var json = JSON.stringify(mytime);
   *
   * var deserialized = JSON.parse(json);
   *
   * var time = new ICAL.Time(deserialized);
   *
   * @return {Object}
   */
  toJSON() {
    let copy = [
      "year",
      "month",
      "day",
      "hour",
      "minute",
      "second",
      "isDate"
    ];
    let result = /* @__PURE__ */ Object.create(null);
    let i = 0;
    let len = copy.length;
    let prop;
    for (; i < len; i++) {
      prop = copy[i];
      result[prop] = this[prop];
    }
    if (this.zone) {
      result.timezone = this.zone.tzid;
    }
    return result;
  }
};
var CHAR = /[^ \t]/;
var VALUE_DELIMITER = ":";
var PARAM_DELIMITER = ";";
var PARAM_NAME_DELIMITER = "=";
var DEFAULT_VALUE_TYPE$1 = "unknown";
var DEFAULT_PARAM_TYPE = "text";
var RFC6868_REPLACE_MAP$1 = { "^'": '"', "^n": "\n", "^^": "^" };
function parse(input) {
  let state = {};
  let root = state.component = [];
  state.stack = [root];
  parse._eachLine(input, function(err, line) {
    parse._handleContentLine(line, state);
  });
  if (state.stack.length > 1) {
    throw new ParserError(
      "invalid ical body. component began but did not end"
    );
  }
  state = null;
  return root.length == 1 ? root[0] : root;
}
__name(parse, "parse");
parse.property = function(str, designSet) {
  let state = {
    component: [[], []],
    designSet: designSet || design.defaultSet
  };
  parse._handleContentLine(str, state);
  return state.component[1][0];
};
parse.component = function(str) {
  return parse(str);
};
var ParserError = class extends Error {
  static {
    __name(this, "ParserError");
  }
  name = this.constructor.name;
};
parse.ParserError = ParserError;
parse._handleContentLine = function(line, state) {
  let valuePos = line.indexOf(VALUE_DELIMITER);
  let paramPos = line.indexOf(PARAM_DELIMITER);
  let lastParamIndex;
  let lastValuePos;
  let name;
  let value;
  let params = {};
  if (paramPos !== -1 && valuePos !== -1) {
    if (paramPos > valuePos) {
      paramPos = -1;
    }
  }
  let parsedParams;
  if (paramPos !== -1) {
    name = line.slice(0, Math.max(0, paramPos)).toLowerCase();
    parsedParams = parse._parseParameters(line.slice(Math.max(0, paramPos)), 0, state.designSet);
    if (parsedParams[2] == -1) {
      throw new ParserError("Invalid parameters in '" + line + "'");
    }
    params = parsedParams[0];
    let parsedParamLength;
    if (typeof parsedParams[1] === "string") {
      parsedParamLength = parsedParams[1].length;
    } else {
      parsedParamLength = parsedParams[1].reduce((accumulator, currentValue) => {
        return accumulator + currentValue.length;
      }, 0);
    }
    lastParamIndex = parsedParamLength + parsedParams[2] + paramPos;
    if ((lastValuePos = line.slice(Math.max(0, lastParamIndex)).indexOf(VALUE_DELIMITER)) !== -1) {
      value = line.slice(Math.max(0, lastParamIndex + lastValuePos + 1));
    } else {
      throw new ParserError("Missing parameter value in '" + line + "'");
    }
  } else if (valuePos !== -1) {
    name = line.slice(0, Math.max(0, valuePos)).toLowerCase();
    value = line.slice(Math.max(0, valuePos + 1));
    if (name === "begin") {
      let newComponent = [value.toLowerCase(), [], []];
      if (state.stack.length === 1) {
        state.component.push(newComponent);
      } else {
        state.component[2].push(newComponent);
      }
      state.stack.push(state.component);
      state.component = newComponent;
      if (!state.designSet) {
        state.designSet = design.getDesignSet(state.component[0]);
      }
      return;
    } else if (name === "end") {
      state.component = state.stack.pop();
      return;
    }
  } else {
    throw new ParserError(
      'invalid line (no token ";" or ":") "' + line + '"'
    );
  }
  let valueType;
  let multiValue = false;
  let structuredValue = false;
  let propertyDetails;
  let splitName;
  let ungroupedName;
  if (state.designSet.propertyGroups && name.indexOf(".") !== -1) {
    splitName = name.split(".");
    params.group = splitName[0];
    ungroupedName = splitName[1];
  } else {
    ungroupedName = name;
  }
  if (ungroupedName in state.designSet.property) {
    propertyDetails = state.designSet.property[ungroupedName];
    if ("multiValue" in propertyDetails) {
      multiValue = propertyDetails.multiValue;
    }
    if ("structuredValue" in propertyDetails) {
      structuredValue = propertyDetails.structuredValue;
    }
    if (value && "detectType" in propertyDetails) {
      valueType = propertyDetails.detectType(value);
    }
  }
  if (!valueType) {
    if (!("value" in params)) {
      if (propertyDetails) {
        valueType = propertyDetails.defaultType;
      } else {
        valueType = DEFAULT_VALUE_TYPE$1;
      }
    } else {
      valueType = params.value.toLowerCase();
    }
  }
  delete params.value;
  let result;
  if (multiValue && structuredValue) {
    value = parse._parseMultiValue(value, structuredValue, valueType, [], multiValue, state.designSet, structuredValue);
    result = [ungroupedName, params, valueType, value];
  } else if (multiValue) {
    result = [ungroupedName, params, valueType];
    parse._parseMultiValue(value, multiValue, valueType, result, null, state.designSet, false);
  } else if (structuredValue) {
    value = parse._parseMultiValue(value, structuredValue, valueType, [], null, state.designSet, structuredValue);
    result = [ungroupedName, params, valueType, value];
  } else {
    value = parse._parseValue(value, valueType, state.designSet, false);
    result = [ungroupedName, params, valueType, value];
  }
  if (state.component[0] === "vcard" && state.component[1].length === 0 && !(name === "version" && value === "4.0")) {
    state.designSet = design.getDesignSet("vcard3");
  }
  state.component[1].push(result);
};
parse._parseValue = function(value, type, designSet, structuredValue) {
  if (type in designSet.value && "fromICAL" in designSet.value[type]) {
    return designSet.value[type].fromICAL(value, structuredValue);
  }
  return value;
};
parse._parseParameters = function(line, start, designSet) {
  let lastParam = start;
  let pos = 0;
  let delim = PARAM_NAME_DELIMITER;
  let result = {};
  let name, lcname;
  let value, valuePos = -1;
  let type, multiValue, mvdelim;
  while (pos !== false && (pos = line.indexOf(delim, pos + 1)) !== -1) {
    name = line.slice(lastParam + 1, pos);
    if (name.length == 0) {
      throw new ParserError("Empty parameter name in '" + line + "'");
    }
    lcname = name.toLowerCase();
    mvdelim = false;
    multiValue = false;
    if (lcname in designSet.param && designSet.param[lcname].valueType) {
      type = designSet.param[lcname].valueType;
    } else {
      type = DEFAULT_PARAM_TYPE;
    }
    if (lcname in designSet.param) {
      multiValue = designSet.param[lcname].multiValue;
      if (designSet.param[lcname].multiValueSeparateDQuote) {
        mvdelim = parse._rfc6868Escape('"' + multiValue + '"');
      }
    }
    let nextChar = line[pos + 1];
    if (nextChar === '"') {
      valuePos = pos + 2;
      pos = line.indexOf('"', valuePos);
      if (multiValue && pos != -1) {
        let extendedValue = true;
        while (extendedValue) {
          if (line[pos + 1] == multiValue && line[pos + 2] == '"') {
            pos = line.indexOf('"', pos + 3);
          } else {
            extendedValue = false;
          }
        }
      }
      if (pos === -1) {
        throw new ParserError(
          'invalid line (no matching double quote) "' + line + '"'
        );
      }
      value = line.slice(valuePos, pos);
      lastParam = line.indexOf(PARAM_DELIMITER, pos);
      let propValuePos = line.indexOf(VALUE_DELIMITER, pos);
      if (lastParam === -1 || propValuePos !== -1 && lastParam > propValuePos) {
        pos = false;
      }
    } else {
      valuePos = pos + 1;
      let nextPos = line.indexOf(PARAM_DELIMITER, valuePos);
      let propValuePos = line.indexOf(VALUE_DELIMITER, valuePos);
      if (propValuePos !== -1 && nextPos > propValuePos) {
        nextPos = propValuePos;
        pos = false;
      } else if (nextPos === -1) {
        if (propValuePos === -1) {
          nextPos = line.length;
        } else {
          nextPos = propValuePos;
        }
        pos = false;
      } else {
        lastParam = nextPos;
        pos = nextPos;
      }
      value = line.slice(valuePos, nextPos);
    }
    const length_before = value.length;
    value = parse._rfc6868Escape(value);
    valuePos += length_before - value.length;
    if (multiValue) {
      let delimiter = mvdelim || multiValue;
      value = parse._parseMultiValue(value, delimiter, type, [], null, designSet);
    } else {
      value = parse._parseValue(value, type, designSet);
    }
    if (multiValue && lcname in result) {
      if (Array.isArray(result[lcname])) {
        result[lcname].push(value);
      } else {
        result[lcname] = [
          result[lcname],
          value
        ];
      }
    } else {
      result[lcname] = value;
    }
  }
  return [result, value, valuePos];
};
parse._rfc6868Escape = function(val) {
  return val.replace(/\^['n^]/g, function(x) {
    return RFC6868_REPLACE_MAP$1[x];
  });
};
parse._parseMultiValue = function(buffer, delim, type, result, innerMulti, designSet, structuredValue) {
  let pos = 0;
  let lastPos = 0;
  let value;
  if (delim.length === 0) {
    return buffer;
  }
  while ((pos = unescapedIndexOf(buffer, delim, lastPos)) !== -1) {
    value = buffer.slice(lastPos, pos);
    if (innerMulti) {
      value = parse._parseMultiValue(value, innerMulti, type, [], null, designSet, structuredValue);
    } else {
      value = parse._parseValue(value, type, designSet, structuredValue);
    }
    result.push(value);
    lastPos = pos + delim.length;
  }
  value = buffer.slice(lastPos);
  if (innerMulti) {
    value = parse._parseMultiValue(value, innerMulti, type, [], null, designSet, structuredValue);
  } else {
    value = parse._parseValue(value, type, designSet, structuredValue);
  }
  result.push(value);
  return result.length == 1 ? result[0] : result;
};
parse._eachLine = function(buffer, callback) {
  let len = buffer.length;
  let lastPos = buffer.search(CHAR);
  let pos = lastPos;
  let line;
  let firstChar;
  let newlineOffset;
  do {
    pos = buffer.indexOf("\n", lastPos) + 1;
    if (pos > 1 && buffer[pos - 2] === "\r") {
      newlineOffset = 2;
    } else {
      newlineOffset = 1;
    }
    if (pos === 0) {
      pos = len;
      newlineOffset = 0;
    }
    firstChar = buffer[lastPos];
    if (firstChar === " " || firstChar === "	") {
      line += buffer.slice(lastPos + 1, pos - newlineOffset);
    } else {
      if (line)
        callback(null, line);
      line = buffer.slice(lastPos, pos - newlineOffset);
    }
    lastPos = pos;
  } while (pos !== len);
  line = line.trim();
  if (line.length)
    callback(null, line);
};
var OPTIONS = ["tzid", "location", "tznames", "latitude", "longitude"];
var Timezone = class _Timezone {
  static {
    __name(this, "Timezone");
  }
  static _compare_change_fn(a, b) {
    if (a.year < b.year) return -1;
    else if (a.year > b.year) return 1;
    if (a.month < b.month) return -1;
    else if (a.month > b.month) return 1;
    if (a.day < b.day) return -1;
    else if (a.day > b.day) return 1;
    if (a.hour < b.hour) return -1;
    else if (a.hour > b.hour) return 1;
    if (a.minute < b.minute) return -1;
    else if (a.minute > b.minute) return 1;
    if (a.second < b.second) return -1;
    else if (a.second > b.second) return 1;
    return 0;
  }
  /**
   * Convert the date/time from one zone to the next.
   *
   * @param {Time} tt                  The time to convert
   * @param {Timezone} from_zone       The source zone to convert from
   * @param {Timezone} to_zone         The target zone to convert to
   * @return {Time}                    The converted date/time object
   */
  static convert_time(tt, from_zone, to_zone) {
    if (tt.isDate || from_zone.tzid == to_zone.tzid || from_zone == _Timezone.localTimezone || to_zone == _Timezone.localTimezone) {
      tt.zone = to_zone;
      return tt;
    }
    let utcOffset = from_zone.utcOffset(tt);
    tt.adjust(0, 0, 0, -utcOffset);
    utcOffset = to_zone.utcOffset(tt);
    tt.adjust(0, 0, 0, utcOffset);
    return null;
  }
  /**
   * Creates a new ICAL.Timezone instance from the passed data object.
   *
   * @param {Component|Object} aData options for class
   * @param {String|Component} aData.component
   *        If aData is a simple object, then this member can be set to either a
   *        string containing the component data, or an already parsed
   *        ICAL.Component
   * @param {String} aData.tzid      The timezone identifier
   * @param {String} aData.location  The timezone locationw
   * @param {String} aData.tznames   An alternative string representation of the
   *                                  timezone
   * @param {Number} aData.latitude  The latitude of the timezone
   * @param {Number} aData.longitude The longitude of the timezone
   */
  static fromData(aData) {
    let tt = new _Timezone();
    return tt.fromData(aData);
  }
  /**
   * The instance describing the UTC timezone
   * @type {Timezone}
   * @constant
   * @instance
   */
  static #utcTimezone = null;
  static get utcTimezone() {
    if (!this.#utcTimezone) {
      this.#utcTimezone = _Timezone.fromData({
        tzid: "UTC"
      });
    }
    return this.#utcTimezone;
  }
  /**
   * The instance describing the local timezone
   * @type {Timezone}
   * @constant
   * @instance
   */
  static #localTimezone = null;
  static get localTimezone() {
    if (!this.#localTimezone) {
      this.#localTimezone = _Timezone.fromData({
        tzid: "floating"
      });
    }
    return this.#localTimezone;
  }
  /**
   * Adjust a timezone change object.
   * @private
   * @param {Object} change     The timezone change object
   * @param {Number} days       The extra amount of days
   * @param {Number} hours      The extra amount of hours
   * @param {Number} minutes    The extra amount of minutes
   * @param {Number} seconds    The extra amount of seconds
   */
  static adjust_change(change, days, hours, minutes, seconds) {
    return Time.prototype.adjust.call(
      change,
      days,
      hours,
      minutes,
      seconds,
      change
    );
  }
  static _minimumExpansionYear = -1;
  static EXTRA_COVERAGE = 5;
  /**
   * Creates a new ICAL.Timezone instance, by passing in a tzid and component.
   *
   * @param {Component|Object} data options for class
   * @param {String|Component} data.component
   *        If data is a simple object, then this member can be set to either a
   *        string containing the component data, or an already parsed
   *        ICAL.Component
   * @param {String} data.tzid      The timezone identifier
   * @param {String} data.location  The timezone locationw
   * @param {String} data.tznames   An alternative string representation of the
   *                                  timezone
   * @param {Number} data.latitude  The latitude of the timezone
   * @param {Number} data.longitude The longitude of the timezone
   */
  constructor(data) {
    this.wrappedJSObject = this;
    this.fromData(data);
  }
  /**
   * Timezone identifier
   * @type {String}
   */
  tzid = "";
  /**
   * Timezone location
   * @type {String}
   */
  location = "";
  /**
   * Alternative timezone name, for the string representation
   * @type {String}
   */
  tznames = "";
  /**
   * The primary latitude for the timezone.
   * @type {Number}
   */
  latitude = 0;
  /**
   * The primary longitude for the timezone.
   * @type {Number}
   */
  longitude = 0;
  /**
   * The vtimezone component for this timezone.
   * @type {Component}
   */
  component = null;
  /**
   * The year this timezone has been expanded to. All timezone transition
   * dates until this year are known and can be used for calculation
   *
   * @private
   * @type {Number}
   */
  expandedUntilYear = 0;
  /**
   * The class identifier.
   * @constant
   * @type {String}
   * @default "icaltimezone"
   */
  icalclass = "icaltimezone";
  /**
   * Sets up the current instance using members from the passed data object.
   *
   * @param {Component|Object} aData options for class
   * @param {String|Component} aData.component
   *        If aData is a simple object, then this member can be set to either a
   *        string containing the component data, or an already parsed
   *        ICAL.Component
   * @param {String} aData.tzid      The timezone identifier
   * @param {String} aData.location  The timezone locationw
   * @param {String} aData.tznames   An alternative string representation of the
   *                                  timezone
   * @param {Number} aData.latitude  The latitude of the timezone
   * @param {Number} aData.longitude The longitude of the timezone
   */
  fromData(aData) {
    this.expandedUntilYear = 0;
    this.changes = [];
    if (aData instanceof Component) {
      this.component = aData;
    } else {
      if (aData && "component" in aData) {
        if (typeof aData.component == "string") {
          let jCal = parse(aData.component);
          this.component = new Component(jCal);
        } else if (aData.component instanceof Component) {
          this.component = aData.component;
        } else {
          this.component = null;
        }
      }
      for (let prop of OPTIONS) {
        if (aData && prop in aData) {
          this[prop] = aData[prop];
        }
      }
    }
    if (this.component instanceof Component && !this.tzid) {
      this.tzid = this.component.getFirstPropertyValue("tzid");
    }
    return this;
  }
  /**
   * Finds the utcOffset the given time would occur in this timezone.
   *
   * @param {Time} tt         The time to check for
   * @return {Number}         utc offset in seconds
   */
  utcOffset(tt) {
    if (this == _Timezone.utcTimezone || this == _Timezone.localTimezone) {
      return 0;
    }
    this._ensureCoverage(tt.year);
    if (!this.changes.length) {
      return 0;
    }
    let tt_change = {
      year: tt.year,
      month: tt.month,
      day: tt.day,
      hour: tt.hour,
      minute: tt.minute,
      second: tt.second
    };
    let change_num = this._findNearbyChange(tt_change);
    let change_num_to_use = -1;
    let step = 1;
    for (; ; ) {
      let change = clone(this.changes[change_num], true);
      if (change.utcOffset < change.prevUtcOffset) {
        _Timezone.adjust_change(change, 0, 0, 0, change.utcOffset);
      } else {
        _Timezone.adjust_change(
          change,
          0,
          0,
          0,
          change.prevUtcOffset
        );
      }
      let cmp = _Timezone._compare_change_fn(tt_change, change);
      if (cmp >= 0) {
        change_num_to_use = change_num;
      } else {
        step = -1;
      }
      if (step == -1 && change_num_to_use != -1) {
        break;
      }
      change_num += step;
      if (change_num < 0) {
        return 0;
      }
      if (change_num >= this.changes.length) {
        break;
      }
    }
    let zone_change = this.changes[change_num_to_use];
    let utcOffset_change = zone_change.utcOffset - zone_change.prevUtcOffset;
    if (utcOffset_change < 0 && change_num_to_use > 0) {
      let tmp_change = clone(zone_change, true);
      _Timezone.adjust_change(tmp_change, 0, 0, 0, tmp_change.prevUtcOffset);
      if (_Timezone._compare_change_fn(tt_change, tmp_change) < 0) {
        let prev_zone_change = this.changes[change_num_to_use - 1];
        let want_daylight = false;
        if (zone_change.is_daylight != want_daylight && prev_zone_change.is_daylight == want_daylight) {
          zone_change = prev_zone_change;
        }
      }
    }
    return zone_change.utcOffset;
  }
  _findNearbyChange(change) {
    let idx = binsearchInsert(
      this.changes,
      change,
      _Timezone._compare_change_fn
    );
    if (idx >= this.changes.length) {
      return this.changes.length - 1;
    }
    return idx;
  }
  _ensureCoverage(aYear) {
    if (_Timezone._minimumExpansionYear == -1) {
      let today = Time.now();
      _Timezone._minimumExpansionYear = today.year;
    }
    let changesEndYear = aYear;
    if (changesEndYear < _Timezone._minimumExpansionYear) {
      changesEndYear = _Timezone._minimumExpansionYear;
    }
    changesEndYear += _Timezone.EXTRA_COVERAGE;
    if (!this.changes.length || this.expandedUntilYear < aYear) {
      let subcomps = this.component.getAllSubcomponents();
      let compLen = subcomps.length;
      let compIdx = 0;
      for (; compIdx < compLen; compIdx++) {
        this._expandComponent(
          subcomps[compIdx],
          changesEndYear,
          this.changes
        );
      }
      this.changes.sort(_Timezone._compare_change_fn);
      this.expandedUntilYear = changesEndYear;
    }
  }
  _expandComponent(aComponent, aYear, changes) {
    if (!aComponent.hasProperty("dtstart") || !aComponent.hasProperty("tzoffsetto") || !aComponent.hasProperty("tzoffsetfrom")) {
      return null;
    }
    let dtstart = aComponent.getFirstProperty("dtstart").getFirstValue();
    let change;
    function convert_tzoffset(offset) {
      return offset.factor * (offset.hours * 3600 + offset.minutes * 60);
    }
    __name(convert_tzoffset, "convert_tzoffset");
    function init_changes() {
      let changebase = {};
      changebase.is_daylight = aComponent.name == "daylight";
      changebase.utcOffset = convert_tzoffset(
        aComponent.getFirstProperty("tzoffsetto").getFirstValue()
      );
      changebase.prevUtcOffset = convert_tzoffset(
        aComponent.getFirstProperty("tzoffsetfrom").getFirstValue()
      );
      return changebase;
    }
    __name(init_changes, "init_changes");
    if (!aComponent.hasProperty("rrule") && !aComponent.hasProperty("rdate")) {
      change = init_changes();
      change.year = dtstart.year;
      change.month = dtstart.month;
      change.day = dtstart.day;
      change.hour = dtstart.hour;
      change.minute = dtstart.minute;
      change.second = dtstart.second;
      _Timezone.adjust_change(change, 0, 0, 0, -change.prevUtcOffset);
      changes.push(change);
    } else {
      let props = aComponent.getAllProperties("rdate");
      for (let rdate of props) {
        let time = rdate.getFirstValue();
        change = init_changes();
        change.year = time.year;
        change.month = time.month;
        change.day = time.day;
        if (time.isDate) {
          change.hour = dtstart.hour;
          change.minute = dtstart.minute;
          change.second = dtstart.second;
          if (dtstart.zone != _Timezone.utcTimezone) {
            _Timezone.adjust_change(change, 0, 0, 0, -change.prevUtcOffset);
          }
        } else {
          change.hour = time.hour;
          change.minute = time.minute;
          change.second = time.second;
          if (time.zone != _Timezone.utcTimezone) {
            _Timezone.adjust_change(change, 0, 0, 0, -change.prevUtcOffset);
          }
        }
        changes.push(change);
      }
      let rrule = aComponent.getFirstProperty("rrule");
      if (rrule) {
        rrule = rrule.getFirstValue();
        change = init_changes();
        if (rrule.until && rrule.until.zone == _Timezone.utcTimezone) {
          rrule.until.adjust(0, 0, 0, change.prevUtcOffset);
          rrule.until.zone = _Timezone.localTimezone;
        }
        let iterator = rrule.iterator(dtstart);
        let occ;
        while (occ = iterator.next()) {
          change = init_changes();
          if (occ.year > aYear || !occ) {
            break;
          }
          change.year = occ.year;
          change.month = occ.month;
          change.day = occ.day;
          change.hour = occ.hour;
          change.minute = occ.minute;
          change.second = occ.second;
          change.isDate = occ.isDate;
          _Timezone.adjust_change(change, 0, 0, 0, -change.prevUtcOffset);
          changes.push(change);
        }
      }
    }
    return changes;
  }
  /**
   * The string representation of this timezone.
   * @return {String}
   */
  toString() {
    return this.tznames ? this.tznames : this.tzid;
  }
};
var zones = null;
var TimezoneService = {
  get count() {
    if (zones === null) {
      return 0;
    }
    return Object.keys(zones).length;
  },
  reset: /* @__PURE__ */ __name(function() {
    zones = /* @__PURE__ */ Object.create(null);
    let utc = Timezone.utcTimezone;
    zones.Z = utc;
    zones.UTC = utc;
    zones.GMT = utc;
  }, "reset"),
  _hard_reset: /* @__PURE__ */ __name(function() {
    zones = null;
  }, "_hard_reset"),
  /**
   * Checks if timezone id has been registered.
   *
   * @param {String} tzid     Timezone identifier (e.g. America/Los_Angeles)
   * @return {Boolean}        False, when not present
   */
  has: /* @__PURE__ */ __name(function(tzid) {
    if (zones === null) {
      return false;
    }
    return !!zones[tzid];
  }, "has"),
  /**
   * Returns a timezone by its tzid if present.
   *
   * @param {String} tzid               Timezone identifier (e.g. America/Los_Angeles)
   * @return {Timezone | undefined}     The timezone, or undefined if not found
   */
  get: /* @__PURE__ */ __name(function(tzid) {
    if (zones === null) {
      this.reset();
    }
    return zones[tzid];
  }, "get"),
  /**
   * Registers a timezone object or component.
   *
   * @param {Component|Timezone} timezone
   *        The initialized zone or vtimezone.
   *
   * @param {String=} name
   *        The name of the timezone. Defaults to the component's TZID if not
   *        passed.
   */
  register: /* @__PURE__ */ __name(function(timezone, name) {
    if (zones === null) {
      this.reset();
    }
    if (typeof timezone === "string" && name instanceof Timezone) {
      [timezone, name] = [name, timezone];
    }
    if (!name) {
      if (timezone instanceof Timezone) {
        name = timezone.tzid;
      } else {
        if (timezone.name === "vtimezone") {
          timezone = new Timezone(timezone);
          name = timezone.tzid;
        }
      }
    }
    if (!name) {
      throw new TypeError("Neither a timezone nor a name was passed");
    }
    if (timezone instanceof Timezone) {
      zones[name] = timezone;
    } else {
      throw new TypeError("timezone must be ICAL.Timezone or ICAL.Component");
    }
  }, "register"),
  /**
   * Removes a timezone by its tzid from the list.
   *
   * @param {String} tzid     Timezone identifier (e.g. America/Los_Angeles)
   * @return {?Timezone}      The removed timezone, or null if not registered
   */
  remove: /* @__PURE__ */ __name(function(tzid) {
    if (zones === null) {
      return null;
    }
    return delete zones[tzid];
  }, "remove")
};
function updateTimezones(vcal) {
  let allsubs, properties, vtimezones, reqTzid, i;
  if (!vcal || vcal.name !== "vcalendar") {
    return vcal;
  }
  allsubs = vcal.getAllSubcomponents();
  properties = [];
  vtimezones = {};
  for (i = 0; i < allsubs.length; i++) {
    if (allsubs[i].name === "vtimezone") {
      let tzid = allsubs[i].getFirstProperty("tzid").getFirstValue();
      vtimezones[tzid] = allsubs[i];
    } else {
      properties = properties.concat(allsubs[i].getAllProperties());
    }
  }
  reqTzid = {};
  for (i = 0; i < properties.length; i++) {
    let tzid = properties[i].getParameter("tzid");
    if (tzid) {
      reqTzid[tzid] = true;
    }
  }
  for (let [tzid, comp] of Object.entries(vtimezones)) {
    if (!reqTzid[tzid]) {
      vcal.removeSubcomponent(comp);
    }
  }
  for (let tzid of Object.keys(reqTzid)) {
    if (!vtimezones[tzid] && TimezoneService.has(tzid)) {
      vcal.addSubcomponent(TimezoneService.get(tzid).component);
    }
  }
  return vcal;
}
__name(updateTimezones, "updateTimezones");
function isStrictlyNaN(number) {
  return typeof number === "number" && isNaN(number);
}
__name(isStrictlyNaN, "isStrictlyNaN");
function strictParseInt(string) {
  let result = parseInt(string, 10);
  if (isStrictlyNaN(result)) {
    throw new Error(
      'Could not extract integer from "' + string + '"'
    );
  }
  return result;
}
__name(strictParseInt, "strictParseInt");
function formatClassType(data, type) {
  if (typeof data === "undefined") {
    return void 0;
  }
  if (data instanceof type) {
    return data;
  }
  return new type(data);
}
__name(formatClassType, "formatClassType");
function unescapedIndexOf(buffer, search, pos) {
  while ((pos = buffer.indexOf(search, pos)) !== -1) {
    if (pos > 0 && buffer[pos - 1] === "\\") {
      pos += 1;
    } else {
      return pos;
    }
  }
  return -1;
}
__name(unescapedIndexOf, "unescapedIndexOf");
function binsearchInsert(list, seekVal, cmpfunc) {
  if (!list.length)
    return 0;
  let low = 0, high = list.length - 1, mid, cmpval;
  while (low <= high) {
    mid = low + Math.floor((high - low) / 2);
    cmpval = cmpfunc(seekVal, list[mid]);
    if (cmpval < 0)
      high = mid - 1;
    else if (cmpval > 0)
      low = mid + 1;
    else
      break;
  }
  if (cmpval < 0)
    return mid;
  else if (cmpval > 0)
    return mid + 1;
  else
    return mid;
}
__name(binsearchInsert, "binsearchInsert");
function clone(aSrc, aDeep) {
  if (!aSrc || typeof aSrc != "object") {
    return aSrc;
  } else if (aSrc instanceof Date) {
    return new Date(aSrc.getTime());
  } else if ("clone" in aSrc) {
    return aSrc.clone();
  } else if (Array.isArray(aSrc)) {
    let arr = [];
    for (let i = 0; i < aSrc.length; i++) {
      arr.push(aDeep ? clone(aSrc[i], true) : aSrc[i]);
    }
    return arr;
  } else {
    let obj = {};
    for (let [name, value] of Object.entries(aSrc)) {
      if (aDeep) {
        obj[name] = clone(value, true);
      } else {
        obj[name] = value;
      }
    }
    return obj;
  }
}
__name(clone, "clone");
function foldline(aLine) {
  let result = "";
  let line = aLine || "", pos = 0, line_length = 0;
  while (line.length) {
    let cp = line.codePointAt(pos);
    if (cp < 128) ++line_length;
    else if (cp < 2048) line_length += 2;
    else if (cp < 65536) line_length += 3;
    else line_length += 4;
    if (line_length < ICALmodule.foldLength + 1)
      pos += cp > 65535 ? 2 : 1;
    else {
      result += ICALmodule.newLineChar + " " + line.slice(0, Math.max(0, pos));
      line = line.slice(Math.max(0, pos));
      pos = line_length = 0;
    }
  }
  return result.slice(ICALmodule.newLineChar.length + 1);
}
__name(foldline, "foldline");
function pad2(data) {
  if (typeof data !== "string") {
    if (typeof data === "number") {
      data = parseInt(data);
    }
    data = String(data);
  }
  let len = data.length;
  switch (len) {
    case 0:
      return "00";
    case 1:
      return "0" + data;
    default:
      return data;
  }
}
__name(pad2, "pad2");
function trunc(number) {
  return number < 0 ? Math.ceil(number) : Math.floor(number);
}
__name(trunc, "trunc");
function extend(source, target) {
  for (let key in source) {
    let descr = Object.getOwnPropertyDescriptor(source, key);
    if (descr && !Object.getOwnPropertyDescriptor(target, key)) {
      Object.defineProperty(target, key, descr);
    }
  }
  return target;
}
__name(extend, "extend");
var helpers = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  binsearchInsert,
  clone,
  extend,
  foldline,
  formatClassType,
  isStrictlyNaN,
  pad2,
  strictParseInt,
  trunc,
  unescapedIndexOf,
  updateTimezones
});
var UtcOffset = class _UtcOffset {
  static {
    __name(this, "UtcOffset");
  }
  /**
   * Creates a new {@link ICAL.UtcOffset} instance from the passed string.
   *
   * @param {String} aString    The string to parse
   * @return {Duration}         The created utc-offset instance
   */
  static fromString(aString) {
    let options = {};
    options.factor = aString[0] === "+" ? 1 : -1;
    options.hours = strictParseInt(aString.slice(1, 3));
    options.minutes = strictParseInt(aString.slice(4, 6));
    return new _UtcOffset(options);
  }
  /**
   * Creates a new {@link ICAL.UtcOffset} instance from the passed seconds
   * value.
   *
   * @param {Number} aSeconds       The number of seconds to convert
   */
  static fromSeconds(aSeconds) {
    let instance = new _UtcOffset();
    instance.fromSeconds(aSeconds);
    return instance;
  }
  /**
   * Creates a new ICAL.UtcOffset instance.
   *
   * @param {Object} aData          An object with members of the utc offset
   * @param {Number=} aData.hours   The hours for the utc offset
   * @param {Number=} aData.minutes The minutes in the utc offset
   * @param {Number=} aData.factor  The factor for the utc-offset, either -1 or 1
   */
  constructor(aData) {
    this.fromData(aData);
  }
  /**
   * The hours in the utc-offset
   * @type {Number}
   */
  hours = 0;
  /**
   * The minutes in the utc-offset
   * @type {Number}
   */
  minutes = 0;
  /**
   * The sign of the utc offset, 1 for positive offset, -1 for negative
   * offsets.
   * @type {Number}
   */
  factor = 1;
  /**
   * The type name, to be used in the jCal object.
   * @constant
   * @type {String}
   * @default "utc-offset"
   */
  icaltype = "utc-offset";
  /**
   * Returns a clone of the utc offset object.
   *
   * @return {UtcOffset}     The cloned object
   */
  clone() {
    return _UtcOffset.fromSeconds(this.toSeconds());
  }
  /**
   * Sets up the current instance using members from the passed data object.
   *
   * @param {Object} aData          An object with members of the utc offset
   * @param {Number=} aData.hours   The hours for the utc offset
   * @param {Number=} aData.minutes The minutes in the utc offset
   * @param {Number=} aData.factor  The factor for the utc-offset, either -1 or 1
   */
  fromData(aData) {
    if (aData) {
      for (let [key, value] of Object.entries(aData)) {
        this[key] = value;
      }
    }
    this._normalize();
  }
  /**
   * Sets up the current instance from the given seconds value. The seconds
   * value is truncated to the minute. Offsets are wrapped when the world
   * ends, the hour after UTC+14:00 is UTC-12:00.
   *
   * @param {Number} aSeconds         The seconds to convert into an offset
   */
  fromSeconds(aSeconds) {
    let secs = Math.abs(aSeconds);
    this.factor = aSeconds < 0 ? -1 : 1;
    this.hours = trunc(secs / 3600);
    secs -= this.hours * 3600;
    this.minutes = trunc(secs / 60);
    return this;
  }
  /**
   * Convert the current offset to a value in seconds
   *
   * @return {Number}                 The offset in seconds
   */
  toSeconds() {
    return this.factor * (60 * this.minutes + 3600 * this.hours);
  }
  /**
   * Compare this utc offset with another one.
   *
   * @param {UtcOffset} other             The other offset to compare with
   * @return {Number}                     -1, 0 or 1 for less/equal/greater
   */
  compare(other) {
    let a = this.toSeconds();
    let b = other.toSeconds();
    return (a > b) - (b > a);
  }
  _normalize() {
    let secs = this.toSeconds();
    let factor = this.factor;
    while (secs < -43200) {
      secs += 97200;
    }
    while (secs > 50400) {
      secs -= 97200;
    }
    this.fromSeconds(secs);
    if (secs == 0) {
      this.factor = factor;
    }
  }
  /**
   * The iCalendar string representation of this utc-offset.
   * @return {String}
   */
  toICALString() {
    return design.icalendar.value["utc-offset"].toICAL(this.toString());
  }
  /**
   * The string representation of this utc-offset.
   * @return {String}
   */
  toString() {
    return (this.factor == 1 ? "+" : "-") + pad2(this.hours) + ":" + pad2(this.minutes);
  }
};
var VCardTime = class _VCardTime extends Time {
  static {
    __name(this, "VCardTime");
  }
  /**
   * Returns a new ICAL.VCardTime instance from a date and/or time string.
   *
   * @param {String} aValue     The string to create from
   * @param {String} aIcalType  The type for this instance, e.g. date-and-or-time
   * @return {VCardTime}        The date/time instance
   */
  static fromDateAndOrTimeString(aValue, aIcalType) {
    function part(v, s, e) {
      return v ? strictParseInt(v.slice(s, s + e)) : null;
    }
    __name(part, "part");
    let parts = aValue.split("T");
    let dt = parts[0], tmz = parts[1];
    let splitzone = tmz ? design.vcard.value.time._splitZone(tmz) : [];
    let zone = splitzone[0], tm = splitzone[1];
    let dtlen = dt ? dt.length : 0;
    let tmlen = tm ? tm.length : 0;
    let hasDashDate = dt && dt[0] == "-" && dt[1] == "-";
    let hasDashTime = tm && tm[0] == "-";
    let o = {
      year: hasDashDate ? null : part(dt, 0, 4),
      month: hasDashDate && (dtlen == 4 || dtlen == 7) ? part(dt, 2, 2) : dtlen == 7 ? part(dt, 5, 2) : dtlen == 10 ? part(dt, 5, 2) : null,
      day: dtlen == 5 ? part(dt, 3, 2) : dtlen == 7 && hasDashDate ? part(dt, 5, 2) : dtlen == 10 ? part(dt, 8, 2) : null,
      hour: hasDashTime ? null : part(tm, 0, 2),
      minute: hasDashTime && tmlen == 3 ? part(tm, 1, 2) : tmlen > 4 ? hasDashTime ? part(tm, 1, 2) : part(tm, 3, 2) : null,
      second: tmlen == 4 ? part(tm, 2, 2) : tmlen == 6 ? part(tm, 4, 2) : tmlen == 8 ? part(tm, 6, 2) : null
    };
    if (zone == "Z") {
      zone = Timezone.utcTimezone;
    } else if (zone && zone[3] == ":") {
      zone = UtcOffset.fromString(zone);
    } else {
      zone = null;
    }
    return new _VCardTime(o, zone, aIcalType);
  }
  /**
   * Creates a new ICAL.VCardTime instance.
   *
   * @param {Object} data                           The data for the time instance
   * @param {Number=} data.year                     The year for this date
   * @param {Number=} data.month                    The month for this date
   * @param {Number=} data.day                      The day for this date
   * @param {Number=} data.hour                     The hour for this date
   * @param {Number=} data.minute                   The minute for this date
   * @param {Number=} data.second                   The second for this date
   * @param {Timezone|UtcOffset} zone               The timezone to use
   * @param {String} icaltype                       The type for this date/time object
   */
  constructor(data, zone, icaltype) {
    super(data, zone);
    this.icaltype = icaltype || "date-and-or-time";
  }
  /**
   * The class identifier.
   * @constant
   * @type {String}
   * @default "vcardtime"
   */
  icalclass = "vcardtime";
  /**
   * The type name, to be used in the jCal object.
   * @type {String}
   * @default "date-and-or-time"
   */
  icaltype = "date-and-or-time";
  /**
   * Returns a clone of the vcard date/time object.
   *
   * @return {VCardTime}     The cloned object
   */
  clone() {
    return new _VCardTime(this._time, this.zone, this.icaltype);
  }
  _normalize() {
    return this;
  }
  /**
   * @inheritdoc
   */
  utcOffset() {
    if (this.zone instanceof UtcOffset) {
      return this.zone.toSeconds();
    } else {
      return Time.prototype.utcOffset.apply(this, arguments);
    }
  }
  /**
   * Returns an RFC 6350 compliant representation of this object.
   *
   * @return {String}         vcard date/time string
   */
  toICALString() {
    return design.vcard.value[this.icaltype].toICAL(this.toString());
  }
  /**
   * The string representation of this date/time, in jCard form
   * (including : and - separators).
   * @return {String}
   */
  toString() {
    let y = this.year, m = this.month, d = this.day;
    let h = this.hour, mm = this.minute, s = this.second;
    let hasYear = y !== null, hasMonth = m !== null, hasDay = d !== null;
    let hasHour = h !== null, hasMinute = mm !== null, hasSecond = s !== null;
    let datepart = (hasYear ? pad2(y) + (hasMonth || hasDay ? "-" : "") : hasMonth || hasDay ? "--" : "") + (hasMonth ? pad2(m) : "") + (hasDay ? "-" + pad2(d) : "");
    let timepart = (hasHour ? pad2(h) : "-") + (hasHour && hasMinute ? ":" : "") + (hasMinute ? pad2(mm) : "") + (!hasHour && !hasMinute ? "-" : "") + (hasMinute && hasSecond ? ":" : "") + (hasSecond ? pad2(s) : "");
    let zone;
    if (this.zone === Timezone.utcTimezone) {
      zone = "Z";
    } else if (this.zone instanceof UtcOffset) {
      zone = this.zone.toString();
    } else if (this.zone === Timezone.localTimezone) {
      zone = "";
    } else if (this.zone instanceof Timezone) {
      let offset = UtcOffset.fromSeconds(this.zone.utcOffset(this));
      zone = offset.toString();
    } else {
      zone = "";
    }
    switch (this.icaltype) {
      case "time":
        return timepart + zone;
      case "date-and-or-time":
      case "date-time":
        return datepart + (timepart == "--" ? "" : "T" + timepart + zone);
      case "date":
        return datepart;
    }
    return null;
  }
};
var RecurIterator = class _RecurIterator {
  static {
    __name(this, "RecurIterator");
  }
  static _indexMap = {
    "BYSECOND": 0,
    "BYMINUTE": 1,
    "BYHOUR": 2,
    "BYDAY": 3,
    "BYMONTHDAY": 4,
    "BYYEARDAY": 5,
    "BYWEEKNO": 6,
    "BYMONTH": 7,
    "BYSETPOS": 8
  };
  static _expandMap = {
    "SECONDLY": [1, 1, 1, 1, 1, 1, 1, 1],
    "MINUTELY": [2, 1, 1, 1, 1, 1, 1, 1],
    "HOURLY": [2, 2, 1, 1, 1, 1, 1, 1],
    "DAILY": [2, 2, 2, 1, 1, 1, 1, 1],
    "WEEKLY": [2, 2, 2, 2, 3, 3, 1, 1],
    "MONTHLY": [2, 2, 2, 2, 2, 3, 3, 1],
    "YEARLY": [2, 2, 2, 2, 2, 2, 2, 2]
  };
  static UNKNOWN = 0;
  static CONTRACT = 1;
  static EXPAND = 2;
  static ILLEGAL = 3;
  /**
   * Creates a new ICAL.RecurIterator instance. The options object may contain additional members
   * when resuming iteration from a previous run.
   *
   * @param {Object} options                The iterator options
   * @param {Recur} options.rule            The rule to iterate.
   * @param {Time} options.dtstart          The start date of the event.
   * @param {Boolean=} options.initialized  When true, assume that options are
   *        from a previously constructed iterator. Initialization will not be
   *        repeated.
   */
  constructor(options) {
    this.fromData(options);
  }
  /**
   * True when iteration is finished.
   * @type {Boolean}
   */
  completed = false;
  /**
   * The rule that is being iterated
   * @type {Recur}
   */
  rule = null;
  /**
   * The start date of the event being iterated.
   * @type {Time}
   */
  dtstart = null;
  /**
   * The last occurrence that was returned from the
   * {@link RecurIterator#next} method.
   * @type {Time}
   */
  last = null;
  /**
   * The sequence number from the occurrence
   * @type {Number}
   */
  occurrence_number = 0;
  /**
   * The indices used for the {@link ICAL.RecurIterator#by_data} object.
   * @type {Object}
   * @private
   */
  by_indices = null;
  /**
   * If true, the iterator has already been initialized
   * @type {Boolean}
   * @private
   */
  initialized = false;
  /**
   * The initializd by-data.
   * @type {Object}
   * @private
   */
  by_data = null;
  /**
   * The expanded yeardays
   * @type {Array}
   * @private
   */
  days = null;
  /**
   * The index in the {@link ICAL.RecurIterator#days} array.
   * @type {Number}
   * @private
   */
  days_index = 0;
  /**
   * Initialize the recurrence iterator from the passed data object. This
   * method is usually not called directly, you can initialize the iterator
   * through the constructor.
   *
   * @param {Object} options                The iterator options
   * @param {Recur} options.rule            The rule to iterate.
   * @param {Time} options.dtstart          The start date of the event.
   * @param {Boolean=} options.initialized  When true, assume that options are
   *        from a previously constructed iterator. Initialization will not be
   *        repeated.
   */
  fromData(options) {
    this.rule = formatClassType(options.rule, Recur);
    if (!this.rule) {
      throw new Error("iterator requires a (ICAL.Recur) rule");
    }
    this.dtstart = formatClassType(options.dtstart, Time);
    if (!this.dtstart) {
      throw new Error("iterator requires a (ICAL.Time) dtstart");
    }
    if (options.by_data) {
      this.by_data = options.by_data;
    } else {
      this.by_data = clone(this.rule.parts, true);
    }
    if (options.occurrence_number)
      this.occurrence_number = options.occurrence_number;
    this.days = options.days || [];
    if (options.last) {
      this.last = formatClassType(options.last, Time);
    }
    this.by_indices = options.by_indices;
    if (!this.by_indices) {
      this.by_indices = {
        "BYSECOND": 0,
        "BYMINUTE": 0,
        "BYHOUR": 0,
        "BYDAY": 0,
        "BYMONTH": 0,
        "BYWEEKNO": 0,
        "BYMONTHDAY": 0
      };
    }
    this.initialized = options.initialized || false;
    if (!this.initialized) {
      try {
        this.init();
      } catch (e) {
        if (e instanceof InvalidRecurrenceRuleError) {
          this.completed = true;
        } else {
          throw e;
        }
      }
    }
  }
  /**
   * Initialize the iterator
   * @private
   */
  init() {
    this.initialized = true;
    this.last = this.dtstart.clone();
    let parts = this.by_data;
    if ("BYDAY" in parts) {
      this.sort_byday_rules(parts.BYDAY);
    }
    if ("BYYEARDAY" in parts) {
      if ("BYMONTH" in parts || "BYWEEKNO" in parts || "BYMONTHDAY" in parts) {
        throw new Error("Invalid BYYEARDAY rule");
      }
    }
    if ("BYWEEKNO" in parts && "BYMONTHDAY" in parts) {
      throw new Error("BYWEEKNO does not fit to BYMONTHDAY");
    }
    if (this.rule.freq == "MONTHLY" && ("BYYEARDAY" in parts || "BYWEEKNO" in parts)) {
      throw new Error("For MONTHLY recurrences neither BYYEARDAY nor BYWEEKNO may appear");
    }
    if (this.rule.freq == "WEEKLY" && ("BYYEARDAY" in parts || "BYMONTHDAY" in parts)) {
      throw new Error("For WEEKLY recurrences neither BYMONTHDAY nor BYYEARDAY may appear");
    }
    if (this.rule.freq != "YEARLY" && "BYYEARDAY" in parts) {
      throw new Error("BYYEARDAY may only appear in YEARLY rules");
    }
    this.last.second = this.setup_defaults("BYSECOND", "SECONDLY", this.dtstart.second);
    this.last.minute = this.setup_defaults("BYMINUTE", "MINUTELY", this.dtstart.minute);
    this.last.hour = this.setup_defaults("BYHOUR", "HOURLY", this.dtstart.hour);
    this.last.day = this.setup_defaults("BYMONTHDAY", "DAILY", this.dtstart.day);
    this.last.month = this.setup_defaults("BYMONTH", "MONTHLY", this.dtstart.month);
    if (this.rule.freq == "WEEKLY") {
      if ("BYDAY" in parts) {
        let [, dow] = this.ruleDayOfWeek(parts.BYDAY[0], this.rule.wkst);
        let wkdy = dow - this.last.dayOfWeek(this.rule.wkst);
        if (this.last.dayOfWeek(this.rule.wkst) < dow && wkdy >= 0 || wkdy < 0) {
          this.last.day += wkdy;
        }
      } else {
        let dayName = Recur.numericDayToIcalDay(this.dtstart.dayOfWeek());
        parts.BYDAY = [dayName];
      }
    }
    if (this.rule.freq == "YEARLY") {
      const untilYear = this.rule.until ? this.rule.until.year : 2e4;
      while (this.last.year <= untilYear) {
        this.expand_year_days(this.last.year);
        if (this.days.length > 0) {
          break;
        }
        this.increment_year(this.rule.interval);
      }
      if (this.days.length == 0) {
        throw new InvalidRecurrenceRuleError();
      }
      if (!this._nextByYearDay() && !this.next_year() && !this.next_year() && !this.next_year()) {
        throw new InvalidRecurrenceRuleError();
      }
    }
    if (this.rule.freq == "MONTHLY") {
      if (this.has_by_data("BYDAY")) {
        let tempLast = null;
        let initLast = this.last.clone();
        let daysInMonth = Time.daysInMonth(this.last.month, this.last.year);
        for (let bydow of this.by_data.BYDAY) {
          this.last = initLast.clone();
          let [pos, dow] = this.ruleDayOfWeek(bydow);
          let dayOfMonth = this.last.nthWeekDay(dow, pos);
          if (pos >= 6 || pos <= -6) {
            throw new Error("Malformed values in BYDAY part");
          }
          if (dayOfMonth > daysInMonth || dayOfMonth <= 0) {
            if (tempLast && tempLast.month == initLast.month) {
              continue;
            }
            while (dayOfMonth > daysInMonth || dayOfMonth <= 0) {
              this.increment_month();
              daysInMonth = Time.daysInMonth(this.last.month, this.last.year);
              dayOfMonth = this.last.nthWeekDay(dow, pos);
            }
          }
          this.last.day = dayOfMonth;
          if (!tempLast || this.last.compare(tempLast) < 0) {
            tempLast = this.last.clone();
          }
        }
        this.last = tempLast.clone();
        if (this.has_by_data("BYMONTHDAY")) {
          this._byDayAndMonthDay(true);
        }
        if (this.last.day > daysInMonth || this.last.day == 0) {
          throw new Error("Malformed values in BYDAY part");
        }
      } else if (this.has_by_data("BYMONTHDAY")) {
        this.last.day = 1;
        let normalized = this.normalizeByMonthDayRules(
          this.last.year,
          this.last.month,
          this.rule.parts.BYMONTHDAY
        ).filter((d) => d >= this.last.day);
        if (normalized.length) {
          this.last.day = normalized[0];
          this.by_data.BYMONTHDAY = normalized;
        } else {
          if (!this.next_month() && !this.next_month() && !this.next_month()) {
            throw new InvalidRecurrenceRuleError();
          }
        }
      }
    }
  }
  /**
   * Retrieve the next occurrence from the iterator.
   * @return {Time}
   */
  next(again = false) {
    let before = this.last ? this.last.clone() : null;
    if (this.rule.count && this.occurrence_number >= this.rule.count || this.rule.until && this.last.compare(this.rule.until) > 0) {
      this.completed = true;
    }
    if (this.completed) {
      return null;
    }
    if (this.occurrence_number == 0 && this.last.compare(this.dtstart) >= 0) {
      this.occurrence_number++;
      return this.last;
    }
    let valid;
    let invalid_count = 0;
    do {
      valid = 1;
      switch (this.rule.freq) {
        case "SECONDLY":
          this.next_second();
          break;
        case "MINUTELY":
          this.next_minute();
          break;
        case "HOURLY":
          this.next_hour();
          break;
        case "DAILY":
          this.next_day();
          break;
        case "WEEKLY":
          this.next_week();
          break;
        case "MONTHLY":
          valid = this.next_month();
          if (valid) {
            invalid_count = 0;
          } else if (++invalid_count == 336) {
            this.completed = true;
            return null;
          }
          break;
        case "YEARLY":
          valid = this.next_year();
          if (valid) {
            invalid_count = 0;
          } else if (++invalid_count == 28) {
            this.completed = true;
            return null;
          }
          break;
        default:
          return null;
      }
    } while (!this.check_contracting_rules() || this.last.compare(this.dtstart) < 0 || !valid);
    if (this.last.compare(before) == 0) {
      if (again) {
        throw new Error("Same occurrence found twice, protecting you from death by recursion");
      }
      this.next(true);
    }
    if (this.rule.until && this.last.compare(this.rule.until) > 0) {
      this.completed = true;
      return null;
    } else {
      this.occurrence_number++;
      return this.last;
    }
  }
  next_second() {
    return this.next_generic("BYSECOND", "SECONDLY", "second", "minute");
  }
  increment_second(inc) {
    return this.increment_generic(inc, "second", 60, "minute");
  }
  next_minute() {
    return this.next_generic(
      "BYMINUTE",
      "MINUTELY",
      "minute",
      "hour",
      "next_second"
    );
  }
  increment_minute(inc) {
    return this.increment_generic(inc, "minute", 60, "hour");
  }
  next_hour() {
    return this.next_generic(
      "BYHOUR",
      "HOURLY",
      "hour",
      "monthday",
      "next_minute"
    );
  }
  increment_hour(inc) {
    this.increment_generic(inc, "hour", 24, "monthday");
  }
  next_day() {
    let this_freq = this.rule.freq == "DAILY";
    if (this.next_hour() == 0) {
      return 0;
    }
    if (this_freq) {
      this.increment_monthday(this.rule.interval);
    } else {
      this.increment_monthday(1);
    }
    return 0;
  }
  next_week() {
    let end_of_data = 0;
    if (this.next_weekday_by_week() == 0) {
      return end_of_data;
    }
    if (this.has_by_data("BYWEEKNO")) {
      this.by_indices.BYWEEKNO++;
      if (this.by_indices.BYWEEKNO == this.by_data.BYWEEKNO.length) {
        this.by_indices.BYWEEKNO = 0;
        end_of_data = 1;
      }
      this.last.month = 1;
      this.last.day = 1;
      let week_no = this.by_data.BYWEEKNO[this.by_indices.BYWEEKNO];
      this.last.day += 7 * week_no;
      if (end_of_data) {
        this.increment_year(1);
      }
    } else {
      this.increment_monthday(7 * this.rule.interval);
    }
    return end_of_data;
  }
  /**
   * Normalize each by day rule for a given year/month.
   * Takes into account ordering and negative rules
   *
   * @private
   * @param {Number} year         Current year.
   * @param {Number} month        Current month.
   * @param {Array}  rules        Array of rules.
   *
   * @return {Array} sorted and normalized rules.
   *                 Negative rules will be expanded to their
   *                 correct positive values for easier processing.
   */
  normalizeByMonthDayRules(year, month, rules) {
    let daysInMonth = Time.daysInMonth(month, year);
    let newRules = [];
    let ruleIdx = 0;
    let len = rules.length;
    let rule;
    for (; ruleIdx < len; ruleIdx++) {
      rule = parseInt(rules[ruleIdx], 10);
      if (isNaN(rule)) {
        throw new Error("Invalid BYMONTHDAY value");
      }
      if (Math.abs(rule) > daysInMonth) {
        continue;
      }
      if (rule < 0) {
        rule = daysInMonth + (rule + 1);
      } else if (rule === 0) {
        continue;
      }
      if (newRules.indexOf(rule) === -1) {
        newRules.push(rule);
      }
    }
    return newRules.sort(function(a, b) {
      return a - b;
    });
  }
  /**
   * NOTES:
   * We are given a list of dates in the month (BYMONTHDAY) (23, etc..)
   * Also we are given a list of days (BYDAY) (MO, 2SU, etc..) when
   * both conditions match a given date (this.last.day) iteration stops.
   *
   * @private
   * @param {Boolean=} isInit     When given true will not increment the
   *                                current day (this.last).
   */
  _byDayAndMonthDay(isInit) {
    let byMonthDay;
    let byDay = this.by_data.BYDAY;
    let date;
    let dateIdx = 0;
    let dateLen;
    let dayLen = byDay.length;
    let dataIsValid = 0;
    let daysInMonth;
    let self = this;
    let lastDay = this.last.day;
    function initMonth() {
      daysInMonth = Time.daysInMonth(
        self.last.month,
        self.last.year
      );
      byMonthDay = self.normalizeByMonthDayRules(
        self.last.year,
        self.last.month,
        self.by_data.BYMONTHDAY
      );
      dateLen = byMonthDay.length;
      while (byMonthDay[dateIdx] <= lastDay && !(isInit && byMonthDay[dateIdx] == lastDay) && dateIdx < dateLen - 1) {
        dateIdx++;
      }
    }
    __name(initMonth, "initMonth");
    function nextMonth() {
      lastDay = 0;
      self.increment_month();
      dateIdx = 0;
      initMonth();
    }
    __name(nextMonth, "nextMonth");
    initMonth();
    if (isInit) {
      lastDay -= 1;
    }
    let monthsCounter = 48;
    while (!dataIsValid && monthsCounter) {
      monthsCounter--;
      date = lastDay + 1;
      if (date > daysInMonth) {
        nextMonth();
        continue;
      }
      let next = byMonthDay[dateIdx++];
      if (next >= date) {
        lastDay = next;
      } else {
        nextMonth();
        continue;
      }
      for (let dayIdx = 0; dayIdx < dayLen; dayIdx++) {
        let parts = this.ruleDayOfWeek(byDay[dayIdx]);
        let pos = parts[0];
        let dow = parts[1];
        this.last.day = lastDay;
        if (this.last.isNthWeekDay(dow, pos)) {
          dataIsValid = 1;
          break;
        }
      }
      if (!dataIsValid && dateIdx === dateLen) {
        nextMonth();
        continue;
      }
    }
    if (monthsCounter <= 0) {
      throw new Error("Malformed values in BYDAY combined with BYMONTHDAY parts");
    }
    return dataIsValid;
  }
  next_month() {
    let data_valid = 1;
    if (this.next_hour() == 0) {
      return data_valid;
    }
    if (this.has_by_data("BYDAY") && this.has_by_data("BYMONTHDAY")) {
      data_valid = this._byDayAndMonthDay();
    } else if (this.has_by_data("BYDAY")) {
      let daysInMonth = Time.daysInMonth(this.last.month, this.last.year);
      let setpos = 0;
      let setpos_total = 0;
      if (this.has_by_data("BYSETPOS")) {
        let last_day = this.last.day;
        for (let day2 = 1; day2 <= daysInMonth; day2++) {
          this.last.day = day2;
          if (this.is_day_in_byday(this.last)) {
            setpos_total++;
            if (day2 <= last_day) {
              setpos++;
            }
          }
        }
        this.last.day = last_day;
      }
      data_valid = 0;
      let day;
      for (day = this.last.day + 1; day <= daysInMonth; day++) {
        this.last.day = day;
        if (this.is_day_in_byday(this.last)) {
          if (!this.has_by_data("BYSETPOS") || this.check_set_position(++setpos) || this.check_set_position(setpos - setpos_total - 1)) {
            data_valid = 1;
            break;
          }
        }
      }
      if (day > daysInMonth) {
        this.last.day = 1;
        this.increment_month();
        if (this.is_day_in_byday(this.last)) {
          if (!this.has_by_data("BYSETPOS") || this.check_set_position(1)) {
            data_valid = 1;
          }
        } else {
          data_valid = 0;
        }
      }
    } else if (this.has_by_data("BYMONTHDAY")) {
      this.by_indices.BYMONTHDAY++;
      if (this.by_indices.BYMONTHDAY >= this.by_data.BYMONTHDAY.length) {
        this.by_indices.BYMONTHDAY = 0;
        this.increment_month();
        if (this.by_indices.BYMONTHDAY >= this.by_data.BYMONTHDAY.length) {
          return 0;
        }
      }
      let daysInMonth = Time.daysInMonth(this.last.month, this.last.year);
      let day = this.by_data.BYMONTHDAY[this.by_indices.BYMONTHDAY];
      if (day < 0) {
        day = daysInMonth + day + 1;
      }
      if (day > daysInMonth) {
        this.last.day = 1;
        data_valid = this.is_day_in_byday(this.last);
      } else {
        this.last.day = day;
      }
    } else {
      this.increment_month();
      let daysInMonth = Time.daysInMonth(this.last.month, this.last.year);
      if (this.by_data.BYMONTHDAY[0] > daysInMonth) {
        data_valid = 0;
      } else {
        this.last.day = this.by_data.BYMONTHDAY[0];
      }
    }
    return data_valid;
  }
  next_weekday_by_week() {
    let end_of_data = 0;
    if (this.next_hour() == 0) {
      return end_of_data;
    }
    if (!this.has_by_data("BYDAY")) {
      return 1;
    }
    for (; ; ) {
      let tt = new Time();
      this.by_indices.BYDAY++;
      if (this.by_indices.BYDAY == Object.keys(this.by_data.BYDAY).length) {
        this.by_indices.BYDAY = 0;
        end_of_data = 1;
      }
      let coded_day = this.by_data.BYDAY[this.by_indices.BYDAY];
      let parts = this.ruleDayOfWeek(coded_day);
      let dow = parts[1];
      dow -= this.rule.wkst;
      if (dow < 0) {
        dow += 7;
      }
      tt.year = this.last.year;
      tt.month = this.last.month;
      tt.day = this.last.day;
      let startOfWeek = tt.startDoyWeek(this.rule.wkst);
      if (dow + startOfWeek < 1) {
        if (!end_of_data) {
          continue;
        }
      }
      let next = Time.fromDayOfYear(startOfWeek + dow, this.last.year);
      this.last.year = next.year;
      this.last.month = next.month;
      this.last.day = next.day;
      return end_of_data;
    }
  }
  next_year() {
    if (this.next_hour() == 0) {
      return 0;
    }
    if (this.days.length == 0 || ++this.days_index == this.days.length) {
      this.days_index = 0;
      this.increment_year(this.rule.interval);
      if (this.has_by_data("BYMONTHDAY")) {
        this.by_data.BYMONTHDAY = this.normalizeByMonthDayRules(
          this.last.year,
          this.last.month,
          this.rule.parts.BYMONTHDAY
        );
      }
      this.expand_year_days(this.last.year);
      if (this.days.length == 0) {
        return 0;
      }
    }
    return this._nextByYearDay();
  }
  _nextByYearDay() {
    let doy = this.days[this.days_index];
    let year = this.last.year;
    if (Math.abs(doy) == 366 && !Time.isLeapYear(this.last.year)) {
      return 0;
    }
    if (doy < 1) {
      doy += 1;
      year += 1;
    }
    let next = Time.fromDayOfYear(doy, year);
    this.last.day = next.day;
    this.last.month = next.month;
    return 1;
  }
  /**
   * @param dow (eg: '1TU', '-1MO')
   * @param {weekDay=} aWeekStart The week start weekday
   * @return [pos, numericDow] (eg: [1, 3]) numericDow is relative to aWeekStart
   */
  ruleDayOfWeek(dow, aWeekStart) {
    let matches = dow.match(/([+-]?[0-9])?(MO|TU|WE|TH|FR|SA|SU)/);
    if (matches) {
      let pos = parseInt(matches[1] || 0, 10);
      dow = Recur.icalDayToNumericDay(matches[2], aWeekStart);
      return [pos, dow];
    } else {
      return [0, 0];
    }
  }
  next_generic(aRuleType, aInterval, aDateAttr, aFollowingAttr, aPreviousIncr) {
    let has_by_rule = aRuleType in this.by_data;
    let this_freq = this.rule.freq == aInterval;
    let end_of_data = 0;
    if (aPreviousIncr && this[aPreviousIncr]() == 0) {
      return end_of_data;
    }
    if (has_by_rule) {
      this.by_indices[aRuleType]++;
      let dta = this.by_data[aRuleType];
      if (this.by_indices[aRuleType] == dta.length) {
        this.by_indices[aRuleType] = 0;
        end_of_data = 1;
      }
      this.last[aDateAttr] = dta[this.by_indices[aRuleType]];
    } else if (this_freq) {
      this["increment_" + aDateAttr](this.rule.interval);
    }
    if (has_by_rule && end_of_data && this_freq) {
      this["increment_" + aFollowingAttr](1);
    }
    return end_of_data;
  }
  increment_monthday(inc) {
    for (let i = 0; i < inc; i++) {
      let daysInMonth = Time.daysInMonth(this.last.month, this.last.year);
      this.last.day++;
      if (this.last.day > daysInMonth) {
        this.last.day -= daysInMonth;
        this.increment_month();
      }
    }
  }
  increment_month() {
    this.last.day = 1;
    if (this.has_by_data("BYMONTH")) {
      this.by_indices.BYMONTH++;
      if (this.by_indices.BYMONTH == this.by_data.BYMONTH.length) {
        this.by_indices.BYMONTH = 0;
        this.increment_year(1);
      }
      this.last.month = this.by_data.BYMONTH[this.by_indices.BYMONTH];
    } else {
      if (this.rule.freq == "MONTHLY") {
        this.last.month += this.rule.interval;
      } else {
        this.last.month++;
      }
      this.last.month--;
      let years = trunc(this.last.month / 12);
      this.last.month %= 12;
      this.last.month++;
      if (years != 0) {
        this.increment_year(years);
      }
    }
    if (this.has_by_data("BYMONTHDAY")) {
      this.by_data.BYMONTHDAY = this.normalizeByMonthDayRules(
        this.last.year,
        this.last.month,
        this.rule.parts.BYMONTHDAY
      );
    }
  }
  increment_year(inc) {
    this.last.day = 1;
    this.last.year += inc;
  }
  increment_generic(inc, aDateAttr, aFactor, aNextIncrement) {
    this.last[aDateAttr] += inc;
    let nextunit = trunc(this.last[aDateAttr] / aFactor);
    this.last[aDateAttr] %= aFactor;
    if (nextunit != 0) {
      this["increment_" + aNextIncrement](nextunit);
    }
  }
  has_by_data(aRuleType) {
    return aRuleType in this.rule.parts;
  }
  expand_year_days(aYear) {
    let t = new Time();
    this.days = [];
    let parts = {};
    let rules = ["BYDAY", "BYWEEKNO", "BYMONTHDAY", "BYMONTH", "BYYEARDAY"];
    for (let part of rules) {
      if (part in this.rule.parts) {
        parts[part] = this.rule.parts[part];
      }
    }
    if ("BYMONTH" in parts && "BYWEEKNO" in parts) {
      let valid = 1;
      let validWeeks = {};
      t.year = aYear;
      t.isDate = true;
      for (let monthIdx = 0; monthIdx < this.by_data.BYMONTH.length; monthIdx++) {
        let month = this.by_data.BYMONTH[monthIdx];
        t.month = month;
        t.day = 1;
        let first_week = t.weekNumber(this.rule.wkst);
        t.day = Time.daysInMonth(month, aYear);
        let last_week = t.weekNumber(this.rule.wkst);
        for (monthIdx = first_week; monthIdx < last_week; monthIdx++) {
          validWeeks[monthIdx] = 1;
        }
      }
      for (let weekIdx = 0; weekIdx < this.by_data.BYWEEKNO.length && valid; weekIdx++) {
        let weekno = this.by_data.BYWEEKNO[weekIdx];
        if (weekno < 52) {
          valid &= validWeeks[weekIdx];
        } else {
          valid = 0;
        }
      }
      if (valid) {
        delete parts.BYMONTH;
      } else {
        delete parts.BYWEEKNO;
      }
    }
    let partCount = Object.keys(parts).length;
    if (partCount == 0) {
      let t1 = this.dtstart.clone();
      t1.year = this.last.year;
      this.days.push(t1.dayOfYear());
    } else if (partCount == 1 && "BYMONTH" in parts) {
      for (let month of this.by_data.BYMONTH) {
        let t2 = this.dtstart.clone();
        t2.year = aYear;
        t2.month = month;
        t2.isDate = true;
        this.days.push(t2.dayOfYear());
      }
    } else if (partCount == 1 && "BYMONTHDAY" in parts) {
      for (let monthday of this.by_data.BYMONTHDAY) {
        let t3 = this.dtstart.clone();
        if (monthday < 0) {
          let daysInMonth = Time.daysInMonth(t3.month, aYear);
          monthday = monthday + daysInMonth + 1;
        }
        t3.day = monthday;
        t3.year = aYear;
        t3.isDate = true;
        this.days.push(t3.dayOfYear());
      }
    } else if (partCount == 2 && "BYMONTHDAY" in parts && "BYMONTH" in parts) {
      for (let month of this.by_data.BYMONTH) {
        let daysInMonth = Time.daysInMonth(month, aYear);
        for (let monthday of this.by_data.BYMONTHDAY) {
          if (monthday < 0) {
            monthday = monthday + daysInMonth + 1;
          }
          t.day = monthday;
          t.month = month;
          t.year = aYear;
          t.isDate = true;
          this.days.push(t.dayOfYear());
        }
      }
    } else if (partCount == 1 && "BYWEEKNO" in parts) ;
    else if (partCount == 2 && "BYWEEKNO" in parts && "BYMONTHDAY" in parts) ;
    else if (partCount == 1 && "BYDAY" in parts) {
      this.days = this.days.concat(this.expand_by_day(aYear));
    } else if (partCount == 2 && "BYDAY" in parts && "BYMONTH" in parts) {
      for (let month of this.by_data.BYMONTH) {
        let daysInMonth = Time.daysInMonth(month, aYear);
        t.year = aYear;
        t.month = month;
        t.day = 1;
        t.isDate = true;
        let first_dow = t.dayOfWeek();
        let doy_offset = t.dayOfYear() - 1;
        t.day = daysInMonth;
        let last_dow = t.dayOfWeek();
        if (this.has_by_data("BYSETPOS")) {
          let by_month_day = [];
          for (let day = 1; day <= daysInMonth; day++) {
            t.day = day;
            if (this.is_day_in_byday(t)) {
              by_month_day.push(day);
            }
          }
          for (let spIndex = 0; spIndex < by_month_day.length; spIndex++) {
            if (this.check_set_position(spIndex + 1) || this.check_set_position(spIndex - by_month_day.length)) {
              this.days.push(doy_offset + by_month_day[spIndex]);
            }
          }
        } else {
          for (let coded_day of this.by_data.BYDAY) {
            let bydayParts = this.ruleDayOfWeek(coded_day);
            let pos = bydayParts[0];
            let dow = bydayParts[1];
            let month_day;
            let first_matching_day = (dow + 7 - first_dow) % 7 + 1;
            let last_matching_day = daysInMonth - (last_dow + 7 - dow) % 7;
            if (pos == 0) {
              for (let day = first_matching_day; day <= daysInMonth; day += 7) {
                this.days.push(doy_offset + day);
              }
            } else if (pos > 0) {
              month_day = first_matching_day + (pos - 1) * 7;
              if (month_day <= daysInMonth) {
                this.days.push(doy_offset + month_day);
              }
            } else {
              month_day = last_matching_day + (pos + 1) * 7;
              if (month_day > 0) {
                this.days.push(doy_offset + month_day);
              }
            }
          }
        }
      }
      this.days.sort(function(a, b) {
        return a - b;
      });
    } else if (partCount == 2 && "BYDAY" in parts && "BYMONTHDAY" in parts) {
      let expandedDays = this.expand_by_day(aYear);
      for (let day of expandedDays) {
        let tt = Time.fromDayOfYear(day, aYear);
        if (this.by_data.BYMONTHDAY.indexOf(tt.day) >= 0) {
          this.days.push(day);
        }
      }
    } else if (partCount == 3 && "BYDAY" in parts && "BYMONTHDAY" in parts && "BYMONTH" in parts) {
      let expandedDays = this.expand_by_day(aYear);
      for (let day of expandedDays) {
        let tt = Time.fromDayOfYear(day, aYear);
        if (this.by_data.BYMONTH.indexOf(tt.month) >= 0 && this.by_data.BYMONTHDAY.indexOf(tt.day) >= 0) {
          this.days.push(day);
        }
      }
    } else if (partCount == 2 && "BYDAY" in parts && "BYWEEKNO" in parts) {
      let expandedDays = this.expand_by_day(aYear);
      for (let day of expandedDays) {
        let tt = Time.fromDayOfYear(day, aYear);
        let weekno = tt.weekNumber(this.rule.wkst);
        if (this.by_data.BYWEEKNO.indexOf(weekno)) {
          this.days.push(day);
        }
      }
    } else if (partCount == 3 && "BYDAY" in parts && "BYWEEKNO" in parts && "BYMONTHDAY" in parts) ;
    else if (partCount == 1 && "BYYEARDAY" in parts) {
      this.days = this.days.concat(this.by_data.BYYEARDAY);
    } else if (partCount == 2 && "BYYEARDAY" in parts && "BYDAY" in parts) {
      let daysInYear2 = Time.isLeapYear(aYear) ? 366 : 365;
      let expandedDays = new Set(this.expand_by_day(aYear));
      for (let doy of this.by_data.BYYEARDAY) {
        if (doy < 0) {
          doy += daysInYear2 + 1;
        }
        if (expandedDays.has(doy)) {
          this.days.push(doy);
        }
      }
    } else {
      this.days = [];
    }
    let daysInYear = Time.isLeapYear(aYear) ? 366 : 365;
    this.days.sort((a, b) => {
      if (a < 0) a += daysInYear + 1;
      if (b < 0) b += daysInYear + 1;
      return a - b;
    });
    return 0;
  }
  expand_by_day(aYear) {
    let days_list = [];
    let tmp = this.last.clone();
    tmp.year = aYear;
    tmp.month = 1;
    tmp.day = 1;
    tmp.isDate = true;
    let start_dow = tmp.dayOfWeek();
    tmp.month = 12;
    tmp.day = 31;
    tmp.isDate = true;
    let end_dow = tmp.dayOfWeek();
    let end_year_day = tmp.dayOfYear();
    for (let day of this.by_data.BYDAY) {
      let parts = this.ruleDayOfWeek(day);
      let pos = parts[0];
      let dow = parts[1];
      if (pos == 0) {
        let tmp_start_doy = (dow + 7 - start_dow) % 7 + 1;
        for (let doy = tmp_start_doy; doy <= end_year_day; doy += 7) {
          days_list.push(doy);
        }
      } else if (pos > 0) {
        let first;
        if (dow >= start_dow) {
          first = dow - start_dow + 1;
        } else {
          first = dow - start_dow + 8;
        }
        days_list.push(first + (pos - 1) * 7);
      } else {
        let last;
        pos = -pos;
        if (dow <= end_dow) {
          last = end_year_day - end_dow + dow;
        } else {
          last = end_year_day - end_dow + dow - 7;
        }
        days_list.push(last - (pos - 1) * 7);
      }
    }
    return days_list;
  }
  is_day_in_byday(tt) {
    if (this.by_data.BYDAY) {
      for (let day of this.by_data.BYDAY) {
        let parts = this.ruleDayOfWeek(day);
        let pos = parts[0];
        let dow = parts[1];
        let this_dow = tt.dayOfWeek();
        if (pos == 0 && dow == this_dow || tt.nthWeekDay(dow, pos) == tt.day) {
          return 1;
        }
      }
    }
    return 0;
  }
  /**
   * Checks if given value is in BYSETPOS.
   *
   * @private
   * @param {Numeric} aPos position to check for.
   * @return {Boolean} false unless BYSETPOS rules exist
   *                   and the given value is present in rules.
   */
  check_set_position(aPos) {
    if (this.has_by_data("BYSETPOS")) {
      let idx = this.by_data.BYSETPOS.indexOf(aPos);
      return idx !== -1;
    }
    return false;
  }
  sort_byday_rules(aRules) {
    for (let i = 0; i < aRules.length; i++) {
      for (let j = 0; j < i; j++) {
        let one = this.ruleDayOfWeek(aRules[j], this.rule.wkst)[1];
        let two = this.ruleDayOfWeek(aRules[i], this.rule.wkst)[1];
        if (one > two) {
          let tmp = aRules[i];
          aRules[i] = aRules[j];
          aRules[j] = tmp;
        }
      }
    }
  }
  check_contract_restriction(aRuleType, v) {
    let indexMapValue = _RecurIterator._indexMap[aRuleType];
    let ruleMapValue = _RecurIterator._expandMap[this.rule.freq][indexMapValue];
    let pass = false;
    if (aRuleType in this.by_data && ruleMapValue == _RecurIterator.CONTRACT) {
      let ruleType = this.by_data[aRuleType];
      for (let bydata of ruleType) {
        if (bydata == v) {
          pass = true;
          break;
        }
      }
    } else {
      pass = true;
    }
    return pass;
  }
  check_contracting_rules() {
    let dow = this.last.dayOfWeek();
    let weekNo = this.last.weekNumber(this.rule.wkst);
    let doy = this.last.dayOfYear();
    return this.check_contract_restriction("BYSECOND", this.last.second) && this.check_contract_restriction("BYMINUTE", this.last.minute) && this.check_contract_restriction("BYHOUR", this.last.hour) && this.check_contract_restriction("BYDAY", Recur.numericDayToIcalDay(dow)) && this.check_contract_restriction("BYWEEKNO", weekNo) && this.check_contract_restriction("BYMONTHDAY", this.last.day) && this.check_contract_restriction("BYMONTH", this.last.month) && this.check_contract_restriction("BYYEARDAY", doy);
  }
  setup_defaults(aRuleType, req, deftime) {
    let indexMapValue = _RecurIterator._indexMap[aRuleType];
    let ruleMapValue = _RecurIterator._expandMap[this.rule.freq][indexMapValue];
    if (ruleMapValue != _RecurIterator.CONTRACT) {
      if (!(aRuleType in this.by_data)) {
        this.by_data[aRuleType] = [deftime];
      }
      if (this.rule.freq != req) {
        return this.by_data[aRuleType][0];
      }
    }
    return deftime;
  }
  /**
   * Convert iterator into a serialize-able object.  Will preserve current
   * iteration sequence to ensure the seamless continuation of the recurrence
   * rule.
   * @return {Object}
   */
  toJSON() {
    let result = /* @__PURE__ */ Object.create(null);
    result.initialized = this.initialized;
    result.rule = this.rule.toJSON();
    result.dtstart = this.dtstart.toJSON();
    result.by_data = this.by_data;
    result.days = this.days;
    result.last = this.last.toJSON();
    result.by_indices = this.by_indices;
    result.occurrence_number = this.occurrence_number;
    return result;
  }
};
var InvalidRecurrenceRuleError = class extends Error {
  static {
    __name(this, "InvalidRecurrenceRuleError");
  }
  constructor() {
    super("Recurrence rule has no valid occurrences");
  }
};
var VALID_DAY_NAMES = /^(SU|MO|TU|WE|TH|FR|SA)$/;
var VALID_BYDAY_PART = /^([+-])?(5[0-3]|[1-4][0-9]|[1-9])?(SU|MO|TU|WE|TH|FR|SA)$/;
var DOW_MAP = {
  SU: Time.SUNDAY,
  MO: Time.MONDAY,
  TU: Time.TUESDAY,
  WE: Time.WEDNESDAY,
  TH: Time.THURSDAY,
  FR: Time.FRIDAY,
  SA: Time.SATURDAY
};
var REVERSE_DOW_MAP = Object.fromEntries(Object.entries(DOW_MAP).map((entry) => entry.reverse()));
var ALLOWED_FREQ = [
  "SECONDLY",
  "MINUTELY",
  "HOURLY",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY"
];
var Recur = class _Recur {
  static {
    __name(this, "Recur");
  }
  /**
   * Creates a new {@link ICAL.Recur} instance from the passed string.
   *
   * @param {String} string         The string to parse
   * @return {Recur}                The created recurrence instance
   */
  static fromString(string) {
    let data = this._stringToData(string, false);
    return new _Recur(data);
  }
  /**
   * Creates a new {@link ICAL.Recur} instance using members from the passed
   * data object.
   *
   * @param {Object} aData                              An object with members of the recurrence
   * @param {frequencyValues=} aData.freq               The frequency value
   * @param {Number=} aData.interval                    The INTERVAL value
   * @param {weekDay=} aData.wkst                       The week start value
   * @param {Time=} aData.until                         The end of the recurrence set
   * @param {Number=} aData.count                       The number of occurrences
   * @param {Array.<Number>=} aData.bysecond            The seconds for the BYSECOND part
   * @param {Array.<Number>=} aData.byminute            The minutes for the BYMINUTE part
   * @param {Array.<Number>=} aData.byhour              The hours for the BYHOUR part
   * @param {Array.<String>=} aData.byday               The BYDAY values
   * @param {Array.<Number>=} aData.bymonthday          The days for the BYMONTHDAY part
   * @param {Array.<Number>=} aData.byyearday           The days for the BYYEARDAY part
   * @param {Array.<Number>=} aData.byweekno            The weeks for the BYWEEKNO part
   * @param {Array.<Number>=} aData.bymonth             The month for the BYMONTH part
   * @param {Array.<Number>=} aData.bysetpos            The positionals for the BYSETPOS part
   */
  static fromData(aData) {
    return new _Recur(aData);
  }
  /**
   * Converts a recurrence string to a data object, suitable for the fromData
   * method.
   *
   * @private
   * @param {String} string     The string to parse
   * @param {Boolean} fmtIcal   If true, the string is considered to be an
   *                              iCalendar string
   * @return {Recur}            The recurrence instance
   */
  static _stringToData(string, fmtIcal) {
    let dict = /* @__PURE__ */ Object.create(null);
    let values = string.split(";");
    let len = values.length;
    for (let i = 0; i < len; i++) {
      let parts = values[i].split("=");
      let ucname = parts[0].toUpperCase();
      let lcname = parts[0].toLowerCase();
      let name = fmtIcal ? lcname : ucname;
      let value = parts[1];
      if (ucname in partDesign) {
        let partArr = value.split(",");
        let partSet = /* @__PURE__ */ new Set();
        for (let part of partArr) {
          partSet.add(partDesign[ucname](part));
        }
        partArr = [...partSet];
        dict[name] = partArr.length == 1 ? partArr[0] : partArr;
      } else if (ucname in optionDesign) {
        optionDesign[ucname](value, dict, fmtIcal);
      } else {
        dict[lcname] = value;
      }
    }
    return dict;
  }
  /**
   * Convert an ical representation of a day (SU, MO, etc..)
   * into a numeric value of that day.
   *
   * @param {String} string     The iCalendar day name
   * @param {weekDay=} aWeekStart
   *        The week start weekday, defaults to SUNDAY
   * @return {Number}           Numeric value of given day
   */
  static icalDayToNumericDay(string, aWeekStart) {
    let firstDow = aWeekStart || Time.SUNDAY;
    return (DOW_MAP[string] - firstDow + 7) % 7 + 1;
  }
  /**
   * Convert a numeric day value into its ical representation (SU, MO, etc..)
   *
   * @param {Number} num        Numeric value of given day
   * @param {weekDay=} aWeekStart
   *        The week start weekday, defaults to SUNDAY
   * @return {String}           The ICAL day value, e.g SU,MO,...
   */
  static numericDayToIcalDay(num, aWeekStart) {
    let firstDow = aWeekStart || Time.SUNDAY;
    let dow = num + firstDow - Time.SUNDAY;
    if (dow > 7) {
      dow -= 7;
    }
    return REVERSE_DOW_MAP[dow];
  }
  /**
   * Create a new instance of the Recur class.
   *
   * @param {Object} data                               An object with members of the recurrence
   * @param {frequencyValues=} data.freq                The frequency value
   * @param {Number=} data.interval                     The INTERVAL value
   * @param {weekDay=} data.wkst                        The week start value
   * @param {Time=} data.until                          The end of the recurrence set
   * @param {Number=} data.count                        The number of occurrences
   * @param {Array.<Number>=} data.bysecond             The seconds for the BYSECOND part
   * @param {Array.<Number>=} data.byminute             The minutes for the BYMINUTE part
   * @param {Array.<Number>=} data.byhour               The hours for the BYHOUR part
   * @param {Array.<String>=} data.byday                The BYDAY values
   * @param {Array.<Number>=} data.bymonthday           The days for the BYMONTHDAY part
   * @param {Array.<Number>=} data.byyearday            The days for the BYYEARDAY part
   * @param {Array.<Number>=} data.byweekno             The weeks for the BYWEEKNO part
   * @param {Array.<Number>=} data.bymonth              The month for the BYMONTH part
   * @param {Array.<Number>=} data.bysetpos             The positionals for the BYSETPOS part
   */
  constructor(data) {
    this.wrappedJSObject = this;
    this.parts = {};
    if (data && typeof data === "object") {
      this.fromData(data);
    }
  }
  /**
   * An object holding the BY-parts of the recurrence rule
   * @memberof ICAL.Recur
   * @typedef {Object} byParts
   * @property {Array.<Number>=} BYSECOND            The seconds for the BYSECOND part
   * @property {Array.<Number>=} BYMINUTE            The minutes for the BYMINUTE part
   * @property {Array.<Number>=} BYHOUR              The hours for the BYHOUR part
   * @property {Array.<String>=} BYDAY               The BYDAY values
   * @property {Array.<Number>=} BYMONTHDAY          The days for the BYMONTHDAY part
   * @property {Array.<Number>=} BYYEARDAY           The days for the BYYEARDAY part
   * @property {Array.<Number>=} BYWEEKNO            The weeks for the BYWEEKNO part
   * @property {Array.<Number>=} BYMONTH             The month for the BYMONTH part
   * @property {Array.<Number>=} BYSETPOS            The positionals for the BYSETPOS part
   */
  /**
   * An object holding the BY-parts of the recurrence rule
   * @type {byParts}
   */
  parts = null;
  /**
   * The interval value for the recurrence rule.
   * @type {Number}
   */
  interval = 1;
  /**
   * The week start day
   *
   * @type {weekDay}
   * @default ICAL.Time.MONDAY
   */
  wkst = Time.MONDAY;
  /**
   * The end of the recurrence
   * @type {?Time}
   */
  until = null;
  /**
   * The maximum number of occurrences
   * @type {?Number}
   */
  count = null;
  /**
   * The frequency value.
   * @type {frequencyValues}
   */
  freq = null;
  /**
   * The class identifier.
   * @constant
   * @type {String}
   * @default "icalrecur"
   */
  icalclass = "icalrecur";
  /**
   * The type name, to be used in the jCal object.
   * @constant
   * @type {String}
   * @default "recur"
   */
  icaltype = "recur";
  /**
   * Create a new iterator for this recurrence rule. The passed start date
   * must be the start date of the event, not the start of the range to
   * search in.
   *
   * @example
   * let recur = comp.getFirstPropertyValue('rrule');
   * let dtstart = comp.getFirstPropertyValue('dtstart');
   * let iter = recur.iterator(dtstart);
   * for (let next = iter.next(); next; next = iter.next()) {
   *   if (next.compare(rangeStart) < 0) {
   *     continue;
   *   }
   *   console.log(next.toString());
   * }
   *
   * @param {Time} aStart        The item's start date
   * @return {RecurIterator}     The recurrence iterator
   */
  iterator(aStart) {
    return new RecurIterator({
      rule: this,
      dtstart: aStart
    });
  }
  /**
   * Returns a clone of the recurrence object.
   *
   * @return {Recur}      The cloned object
   */
  clone() {
    return new _Recur(this.toJSON());
  }
  /**
   * Checks if the current rule is finite, i.e. has a count or until part.
   *
   * @return {Boolean}        True, if the rule is finite
   */
  isFinite() {
    return !!(this.count || this.until);
  }
  /**
   * Checks if the current rule has a count part, and not limited by an until
   * part.
   *
   * @return {Boolean}        True, if the rule is by count
   */
  isByCount() {
    return !!(this.count && !this.until);
  }
  /**
   * Adds a component (part) to the recurrence rule. This is not a component
   * in the sense of {@link ICAL.Component}, but a part of the recurrence
   * rule, i.e. BYMONTH.
   *
   * @param {String} aType            The name of the component part
   * @param {Array|String} aValue     The component value
   */
  addComponent(aType, aValue) {
    let ucname = aType.toUpperCase();
    if (ucname in this.parts) {
      this.parts[ucname].push(aValue);
    } else {
      this.parts[ucname] = [aValue];
    }
  }
  /**
   * Sets the component value for the given by-part.
   *
   * @param {String} aType        The component part name
   * @param {Array} aValues       The component values
   */
  setComponent(aType, aValues) {
    this.parts[aType.toUpperCase()] = aValues.slice();
  }
  /**
   * Gets (a copy) of the requested component value.
   *
   * @param {String} aType        The component part name
   * @return {Array}              The component part value
   */
  getComponent(aType) {
    let ucname = aType.toUpperCase();
    return ucname in this.parts ? this.parts[ucname].slice() : [];
  }
  /**
   * Retrieves the next occurrence after the given recurrence id. See the
   * guide on {@tutorial terminology} for more details.
   *
   * NOTE: Currently, this method iterates all occurrences from the start
   * date. It should not be called in a loop for performance reasons. If you
   * would like to get more than one occurrence, you can iterate the
   * occurrences manually, see the example on the
   * {@link ICAL.Recur#iterator iterator} method.
   *
   * @param {Time} aStartTime        The start of the event series
   * @param {Time} aRecurrenceId     The date of the last occurrence
   * @return {Time}                  The next occurrence after
   */
  getNextOccurrence(aStartTime, aRecurrenceId) {
    let iter = this.iterator(aStartTime);
    let next;
    do {
      next = iter.next();
    } while (next && next.compare(aRecurrenceId) <= 0);
    if (next && aRecurrenceId.zone) {
      next.zone = aRecurrenceId.zone;
    }
    return next;
  }
  /**
   * Sets up the current instance using members from the passed data object.
   *
   * @param {Object} data                               An object with members of the recurrence
   * @param {frequencyValues=} data.freq                The frequency value
   * @param {Number=} data.interval                     The INTERVAL value
   * @param {weekDay=} data.wkst                        The week start value
   * @param {Time=} data.until                          The end of the recurrence set
   * @param {Number=} data.count                        The number of occurrences
   * @param {Array.<Number>=} data.bysecond             The seconds for the BYSECOND part
   * @param {Array.<Number>=} data.byminute             The minutes for the BYMINUTE part
   * @param {Array.<Number>=} data.byhour               The hours for the BYHOUR part
   * @param {Array.<String>=} data.byday                The BYDAY values
   * @param {Array.<Number>=} data.bymonthday           The days for the BYMONTHDAY part
   * @param {Array.<Number>=} data.byyearday            The days for the BYYEARDAY part
   * @param {Array.<Number>=} data.byweekno             The weeks for the BYWEEKNO part
   * @param {Array.<Number>=} data.bymonth              The month for the BYMONTH part
   * @param {Array.<Number>=} data.bysetpos             The positionals for the BYSETPOS part
   */
  fromData(data) {
    for (let key in data) {
      let uckey = key.toUpperCase();
      if (uckey in partDesign) {
        if (Array.isArray(data[key])) {
          this.parts[uckey] = data[key];
        } else {
          this.parts[uckey] = [data[key]];
        }
      } else {
        this[key] = data[key];
      }
    }
    if (this.interval && typeof this.interval != "number") {
      optionDesign.INTERVAL(this.interval, this);
    }
    if (this.wkst && typeof this.wkst != "number") {
      this.wkst = _Recur.icalDayToNumericDay(this.wkst);
    }
    if (this.until && !(this.until instanceof Time)) {
      this.until = Time.fromString(this.until);
    }
  }
  /**
   * The jCal representation of this recurrence type.
   * @return {Object}
   */
  toJSON() {
    let res = /* @__PURE__ */ Object.create(null);
    res.freq = this.freq;
    if (this.count) {
      res.count = this.count;
    }
    if (this.interval > 1) {
      res.interval = this.interval;
    }
    for (let [k, kparts] of Object.entries(this.parts)) {
      if (Array.isArray(kparts) && kparts.length == 1) {
        res[k.toLowerCase()] = kparts[0];
      } else {
        res[k.toLowerCase()] = clone(kparts);
      }
    }
    if (this.until) {
      res.until = this.until.toString();
    }
    if ("wkst" in this && this.wkst !== Time.DEFAULT_WEEK_START) {
      res.wkst = _Recur.numericDayToIcalDay(this.wkst);
    }
    return res;
  }
  /**
   * The string representation of this recurrence rule.
   * @return {String}
   */
  toString() {
    let str = "FREQ=" + this.freq;
    if (this.count) {
      str += ";COUNT=" + this.count;
    }
    if (this.interval > 1) {
      str += ";INTERVAL=" + this.interval;
    }
    for (let [k, v] of Object.entries(this.parts)) {
      str += ";" + k + "=" + v;
    }
    if (this.until) {
      str += ";UNTIL=" + this.until.toICALString();
    }
    if ("wkst" in this && this.wkst !== Time.DEFAULT_WEEK_START) {
      str += ";WKST=" + _Recur.numericDayToIcalDay(this.wkst);
    }
    return str;
  }
};
function parseNumericValue(type, min, max, value) {
  let result = value;
  if (value[0] === "+") {
    result = value.slice(1);
  }
  result = strictParseInt(result);
  if (min !== void 0 && value < min) {
    throw new Error(
      type + ': invalid value "' + value + '" must be > ' + min
    );
  }
  if (max !== void 0 && value > max) {
    throw new Error(
      type + ': invalid value "' + value + '" must be < ' + min
    );
  }
  return result;
}
__name(parseNumericValue, "parseNumericValue");
var optionDesign = {
  FREQ: /* @__PURE__ */ __name(function(value, dict, fmtIcal) {
    if (ALLOWED_FREQ.indexOf(value) !== -1) {
      dict.freq = value;
    } else {
      throw new Error(
        'invalid frequency "' + value + '" expected: "' + ALLOWED_FREQ.join(", ") + '"'
      );
    }
  }, "FREQ"),
  COUNT: /* @__PURE__ */ __name(function(value, dict, fmtIcal) {
    dict.count = strictParseInt(value);
  }, "COUNT"),
  INTERVAL: /* @__PURE__ */ __name(function(value, dict, fmtIcal) {
    dict.interval = strictParseInt(value);
    if (dict.interval < 1) {
      dict.interval = 1;
    }
  }, "INTERVAL"),
  UNTIL: /* @__PURE__ */ __name(function(value, dict, fmtIcal) {
    if (value.length > 10) {
      dict.until = design.icalendar.value["date-time"].fromICAL(value);
    } else {
      dict.until = design.icalendar.value.date.fromICAL(value);
    }
    if (!fmtIcal) {
      dict.until = Time.fromString(dict.until);
    }
  }, "UNTIL"),
  WKST: /* @__PURE__ */ __name(function(value, dict, fmtIcal) {
    if (VALID_DAY_NAMES.test(value)) {
      dict.wkst = Recur.icalDayToNumericDay(value);
    } else {
      throw new Error('invalid WKST value "' + value + '"');
    }
  }, "WKST")
};
var partDesign = {
  BYSECOND: parseNumericValue.bind(void 0, "BYSECOND", 0, 60),
  BYMINUTE: parseNumericValue.bind(void 0, "BYMINUTE", 0, 59),
  BYHOUR: parseNumericValue.bind(void 0, "BYHOUR", 0, 23),
  BYDAY: /* @__PURE__ */ __name(function(value) {
    if (VALID_BYDAY_PART.test(value)) {
      return value;
    } else {
      throw new Error('invalid BYDAY value "' + value + '"');
    }
  }, "BYDAY"),
  BYMONTHDAY: parseNumericValue.bind(void 0, "BYMONTHDAY", -31, 31),
  BYYEARDAY: parseNumericValue.bind(void 0, "BYYEARDAY", -366, 366),
  BYWEEKNO: parseNumericValue.bind(void 0, "BYWEEKNO", -53, 53),
  BYMONTH: parseNumericValue.bind(void 0, "BYMONTH", 1, 12),
  BYSETPOS: parseNumericValue.bind(void 0, "BYSETPOS", -366, 366)
};
var FROM_ICAL_NEWLINE = /\\\\|\\;|\\,|\\[Nn]/g;
var TO_ICAL_NEWLINE = /\\|;|,|\n/g;
var FROM_VCARD_NEWLINE = /\\\\|\\,|\\[Nn]/g;
var TO_VCARD_NEWLINE = /\\|,|\n/g;
function createTextType(fromNewline, toNewline) {
  let result = {
    matches: /.*/,
    fromICAL: /* @__PURE__ */ __name(function(aValue, structuredEscape) {
      return replaceNewline(aValue, fromNewline, structuredEscape);
    }, "fromICAL"),
    toICAL: /* @__PURE__ */ __name(function(aValue, structuredEscape) {
      let regEx = toNewline;
      if (structuredEscape)
        regEx = new RegExp(regEx.source + "|" + structuredEscape, regEx.flags);
      return aValue.replace(regEx, function(str) {
        switch (str) {
          case "\\":
            return "\\\\";
          case ";":
            return "\\;";
          case ",":
            return "\\,";
          case "\n":
            return "\\n";
          /* c8 ignore next 2 */
          default:
            return str;
        }
      });
    }, "toICAL")
  };
  return result;
}
__name(createTextType, "createTextType");
var DEFAULT_TYPE_TEXT = { defaultType: "text" };
var DEFAULT_TYPE_TEXT_MULTI = { defaultType: "text", multiValue: "," };
var DEFAULT_TYPE_TEXT_STRUCTURED = { defaultType: "text", structuredValue: ";" };
var DEFAULT_TYPE_INTEGER = { defaultType: "integer" };
var DEFAULT_TYPE_DATETIME_DATE = { defaultType: "date-time", allowedTypes: ["date-time", "date"] };
var DEFAULT_TYPE_DATETIME = { defaultType: "date-time" };
var DEFAULT_TYPE_URI = { defaultType: "uri" };
var DEFAULT_TYPE_UTCOFFSET = { defaultType: "utc-offset" };
var DEFAULT_TYPE_RECUR = { defaultType: "recur" };
var DEFAULT_TYPE_DATE_ANDOR_TIME = { defaultType: "date-and-or-time", allowedTypes: ["date-time", "date", "text"] };
function replaceNewlineReplace(string) {
  switch (string) {
    case "\\\\":
      return "\\";
    case "\\;":
      return ";";
    case "\\,":
      return ",";
    case "\\n":
    case "\\N":
      return "\n";
    /* c8 ignore next 2 */
    default:
      return string;
  }
}
__name(replaceNewlineReplace, "replaceNewlineReplace");
function replaceNewline(value, newline, structuredEscape) {
  if (value.indexOf("\\") === -1) {
    return value;
  }
  if (structuredEscape)
    newline = new RegExp(newline.source + "|\\\\" + structuredEscape, newline.flags);
  return value.replace(newline, replaceNewlineReplace);
}
__name(replaceNewline, "replaceNewline");
var commonProperties = {
  "categories": DEFAULT_TYPE_TEXT_MULTI,
  "url": DEFAULT_TYPE_URI,
  "version": DEFAULT_TYPE_TEXT,
  "uid": DEFAULT_TYPE_TEXT
};
var commonValues = {
  "boolean": {
    values: ["TRUE", "FALSE"],
    fromICAL: /* @__PURE__ */ __name(function(aValue) {
      switch (aValue) {
        case "TRUE":
          return true;
        case "FALSE":
          return false;
        default:
          return false;
      }
    }, "fromICAL"),
    toICAL: /* @__PURE__ */ __name(function(aValue) {
      if (aValue) {
        return "TRUE";
      }
      return "FALSE";
    }, "toICAL")
  },
  float: {
    matches: /^[+-]?\d+\.\d+$/,
    fromICAL: /* @__PURE__ */ __name(function(aValue) {
      let parsed = parseFloat(aValue);
      if (isStrictlyNaN(parsed)) {
        return 0;
      }
      return parsed;
    }, "fromICAL"),
    toICAL: /* @__PURE__ */ __name(function(aValue) {
      return String(aValue);
    }, "toICAL")
  },
  integer: {
    fromICAL: /* @__PURE__ */ __name(function(aValue) {
      let parsed = parseInt(aValue);
      if (isStrictlyNaN(parsed)) {
        return 0;
      }
      return parsed;
    }, "fromICAL"),
    toICAL: /* @__PURE__ */ __name(function(aValue) {
      return String(aValue);
    }, "toICAL")
  },
  "utc-offset": {
    toICAL: /* @__PURE__ */ __name(function(aValue) {
      if (aValue.length < 7) {
        return aValue.slice(0, 3) + aValue.slice(4, 6);
      } else {
        return aValue.slice(0, 3) + aValue.slice(4, 6) + aValue.slice(7, 9);
      }
    }, "toICAL"),
    fromICAL: /* @__PURE__ */ __name(function(aValue) {
      if (aValue.length < 6) {
        return aValue.slice(0, 3) + ":" + aValue.slice(3, 5);
      } else {
        return aValue.slice(0, 3) + ":" + aValue.slice(3, 5) + ":" + aValue.slice(5, 7);
      }
    }, "fromICAL"),
    decorate: /* @__PURE__ */ __name(function(aValue) {
      return UtcOffset.fromString(aValue);
    }, "decorate"),
    undecorate: /* @__PURE__ */ __name(function(aValue) {
      return aValue.toString();
    }, "undecorate")
  }
};
var icalParams = {
  // Although the syntax is DQUOTE uri DQUOTE, I don't think we should
  // enforce anything aside from it being a valid content line.
  //
  // At least some params require - if multi values are used - DQUOTEs
  // for each of its values - e.g. delegated-from="uri1","uri2"
  // To indicate this, I introduced the new k/v pair
  // multiValueSeparateDQuote: true
  //
  // "ALTREP": { ... },
  // CN just wants a param-value
  // "CN": { ... }
  "cutype": {
    values: ["INDIVIDUAL", "GROUP", "RESOURCE", "ROOM", "UNKNOWN"],
    allowXName: true,
    allowIanaToken: true
  },
  "delegated-from": {
    valueType: "cal-address",
    multiValue: ",",
    multiValueSeparateDQuote: true
  },
  "delegated-to": {
    valueType: "cal-address",
    multiValue: ",",
    multiValueSeparateDQuote: true
  },
  // "DIR": { ... }, // See ALTREP
  "encoding": {
    values: ["8BIT", "BASE64"]
  },
  // "FMTTYPE": { ... }, // See ALTREP
  "fbtype": {
    values: ["FREE", "BUSY", "BUSY-UNAVAILABLE", "BUSY-TENTATIVE"],
    allowXName: true,
    allowIanaToken: true
  },
  // "LANGUAGE": { ... }, // See ALTREP
  "member": {
    valueType: "cal-address",
    multiValue: ",",
    multiValueSeparateDQuote: true
  },
  "partstat": {
    // TODO These values are actually different per-component
    values: [
      "NEEDS-ACTION",
      "ACCEPTED",
      "DECLINED",
      "TENTATIVE",
      "DELEGATED",
      "COMPLETED",
      "IN-PROCESS"
    ],
    allowXName: true,
    allowIanaToken: true
  },
  "range": {
    values: ["THISANDFUTURE"]
  },
  "related": {
    values: ["START", "END"]
  },
  "reltype": {
    values: ["PARENT", "CHILD", "SIBLING"],
    allowXName: true,
    allowIanaToken: true
  },
  "role": {
    values: [
      "REQ-PARTICIPANT",
      "CHAIR",
      "OPT-PARTICIPANT",
      "NON-PARTICIPANT"
    ],
    allowXName: true,
    allowIanaToken: true
  },
  "rsvp": {
    values: ["TRUE", "FALSE"]
  },
  "sent-by": {
    valueType: "cal-address"
  },
  "tzid": {
    matches: /^\//
  },
  "value": {
    // since the value here is a 'type' lowercase is used.
    values: [
      "binary",
      "boolean",
      "cal-address",
      "date",
      "date-time",
      "duration",
      "float",
      "integer",
      "period",
      "recur",
      "text",
      "time",
      "uri",
      "utc-offset"
    ],
    allowXName: true,
    allowIanaToken: true
  }
};
var icalValues = extend(commonValues, {
  text: createTextType(FROM_ICAL_NEWLINE, TO_ICAL_NEWLINE),
  uri: {
    // TODO
    /* ... */
  },
  "binary": {
    decorate: /* @__PURE__ */ __name(function(aString) {
      return Binary.fromString(aString);
    }, "decorate"),
    undecorate: /* @__PURE__ */ __name(function(aBinary) {
      return aBinary.toString();
    }, "undecorate")
  },
  "cal-address": {
    // needs to be an uri
  },
  "date": {
    decorate: /* @__PURE__ */ __name(function(aValue, aProp) {
      if (design.strict) {
        return Time.fromDateString(aValue, aProp);
      } else {
        return Time.fromString(aValue, aProp);
      }
    }, "decorate"),
    /**
     * undecorates a time object.
     */
    undecorate: /* @__PURE__ */ __name(function(aValue) {
      return aValue.toString();
    }, "undecorate"),
    fromICAL: /* @__PURE__ */ __name(function(aValue) {
      if (!design.strict && aValue.length >= 15) {
        return icalValues["date-time"].fromICAL(aValue);
      } else {
        return aValue.slice(0, 4) + "-" + aValue.slice(4, 6) + "-" + aValue.slice(6, 8);
      }
    }, "fromICAL"),
    toICAL: /* @__PURE__ */ __name(function(aValue) {
      let len = aValue.length;
      if (len == 10) {
        return aValue.slice(0, 4) + aValue.slice(5, 7) + aValue.slice(8, 10);
      } else if (len >= 19) {
        return icalValues["date-time"].toICAL(aValue);
      } else {
        return aValue;
      }
    }, "toICAL")
  },
  "date-time": {
    fromICAL: /* @__PURE__ */ __name(function(aValue) {
      if (!design.strict && aValue.length == 8) {
        return icalValues.date.fromICAL(aValue);
      } else {
        let result = aValue.slice(0, 4) + "-" + aValue.slice(4, 6) + "-" + aValue.slice(6, 8) + "T" + aValue.slice(9, 11) + ":" + aValue.slice(11, 13) + ":" + aValue.slice(13, 15);
        if (aValue[15] && aValue[15] === "Z") {
          result += "Z";
        }
        return result;
      }
    }, "fromICAL"),
    toICAL: /* @__PURE__ */ __name(function(aValue) {
      let len = aValue.length;
      if (len == 10 && !design.strict) {
        return icalValues.date.toICAL(aValue);
      } else if (len >= 19) {
        let result = aValue.slice(0, 4) + aValue.slice(5, 7) + // grab the (DDTHH) segment
        aValue.slice(8, 13) + // MM
        aValue.slice(14, 16) + // SS
        aValue.slice(17, 19);
        if (aValue[19] && aValue[19] === "Z") {
          result += "Z";
        }
        return result;
      } else {
        return aValue;
      }
    }, "toICAL"),
    decorate: /* @__PURE__ */ __name(function(aValue, aProp) {
      if (design.strict) {
        return Time.fromDateTimeString(aValue, aProp);
      } else {
        return Time.fromString(aValue, aProp);
      }
    }, "decorate"),
    undecorate: /* @__PURE__ */ __name(function(aValue) {
      return aValue.toString();
    }, "undecorate")
  },
  duration: {
    decorate: /* @__PURE__ */ __name(function(aValue) {
      return Duration.fromString(aValue);
    }, "decorate"),
    undecorate: /* @__PURE__ */ __name(function(aValue) {
      return aValue.toString();
    }, "undecorate")
  },
  period: {
    fromICAL: /* @__PURE__ */ __name(function(string) {
      let parts = string.split("/");
      parts[0] = icalValues["date-time"].fromICAL(parts[0]);
      if (!Duration.isValueString(parts[1])) {
        parts[1] = icalValues["date-time"].fromICAL(parts[1]);
      }
      return parts;
    }, "fromICAL"),
    toICAL: /* @__PURE__ */ __name(function(parts) {
      parts = parts.slice();
      if (!design.strict && parts[0].length == 10) {
        parts[0] = icalValues.date.toICAL(parts[0]);
      } else {
        parts[0] = icalValues["date-time"].toICAL(parts[0]);
      }
      if (!Duration.isValueString(parts[1])) {
        if (!design.strict && parts[1].length == 10) {
          parts[1] = icalValues.date.toICAL(parts[1]);
        } else {
          parts[1] = icalValues["date-time"].toICAL(parts[1]);
        }
      }
      return parts.join("/");
    }, "toICAL"),
    decorate: /* @__PURE__ */ __name(function(aValue, aProp) {
      return Period.fromJSON(aValue, aProp, !design.strict);
    }, "decorate"),
    undecorate: /* @__PURE__ */ __name(function(aValue) {
      return aValue.toJSON();
    }, "undecorate")
  },
  recur: {
    fromICAL: /* @__PURE__ */ __name(function(string) {
      return Recur._stringToData(string, true);
    }, "fromICAL"),
    toICAL: /* @__PURE__ */ __name(function(data) {
      let str = "";
      for (let [k, val] of Object.entries(data)) {
        if (k == "until") {
          if (val.length > 10) {
            val = icalValues["date-time"].toICAL(val);
          } else {
            val = icalValues.date.toICAL(val);
          }
        } else if (k == "wkst") {
          if (typeof val === "number") {
            val = Recur.numericDayToIcalDay(val);
          }
        } else if (Array.isArray(val)) {
          val = val.join(",");
        }
        str += k.toUpperCase() + "=" + val + ";";
      }
      return str.slice(0, Math.max(0, str.length - 1));
    }, "toICAL"),
    decorate: /* @__PURE__ */ __name(function decorate(aValue) {
      return Recur.fromData(aValue);
    }, "decorate"),
    undecorate: /* @__PURE__ */ __name(function(aRecur) {
      return aRecur.toJSON();
    }, "undecorate")
  },
  time: {
    fromICAL: /* @__PURE__ */ __name(function(aValue) {
      if (aValue.length < 6) {
        return aValue;
      }
      let result = aValue.slice(0, 2) + ":" + aValue.slice(2, 4) + ":" + aValue.slice(4, 6);
      if (aValue[6] === "Z") {
        result += "Z";
      }
      return result;
    }, "fromICAL"),
    toICAL: /* @__PURE__ */ __name(function(aValue) {
      if (aValue.length < 8) {
        return aValue;
      }
      let result = aValue.slice(0, 2) + aValue.slice(3, 5) + aValue.slice(6, 8);
      if (aValue[8] === "Z") {
        result += "Z";
      }
      return result;
    }, "toICAL")
  }
});
var icalProperties = extend(commonProperties, {
  "action": DEFAULT_TYPE_TEXT,
  "attach": { defaultType: "uri" },
  "attendee": { defaultType: "cal-address" },
  "calscale": DEFAULT_TYPE_TEXT,
  "class": DEFAULT_TYPE_TEXT,
  "comment": DEFAULT_TYPE_TEXT,
  "completed": DEFAULT_TYPE_DATETIME,
  "contact": DEFAULT_TYPE_TEXT,
  "created": DEFAULT_TYPE_DATETIME,
  "description": DEFAULT_TYPE_TEXT,
  "dtend": DEFAULT_TYPE_DATETIME_DATE,
  "dtstamp": DEFAULT_TYPE_DATETIME,
  "dtstart": DEFAULT_TYPE_DATETIME_DATE,
  "due": DEFAULT_TYPE_DATETIME_DATE,
  "duration": { defaultType: "duration" },
  "exdate": {
    defaultType: "date-time",
    allowedTypes: ["date-time", "date"],
    multiValue: ","
  },
  "exrule": DEFAULT_TYPE_RECUR,
  "freebusy": { defaultType: "period", multiValue: "," },
  "geo": { defaultType: "float", structuredValue: ";" },
  "last-modified": DEFAULT_TYPE_DATETIME,
  "location": DEFAULT_TYPE_TEXT,
  "method": DEFAULT_TYPE_TEXT,
  "organizer": { defaultType: "cal-address" },
  "percent-complete": DEFAULT_TYPE_INTEGER,
  "priority": DEFAULT_TYPE_INTEGER,
  "prodid": DEFAULT_TYPE_TEXT,
  "related-to": DEFAULT_TYPE_TEXT,
  "repeat": DEFAULT_TYPE_INTEGER,
  "rdate": {
    defaultType: "date-time",
    allowedTypes: ["date-time", "date", "period"],
    multiValue: ",",
    detectType: /* @__PURE__ */ __name(function(string) {
      if (string.indexOf("/") !== -1) {
        return "period";
      }
      return string.indexOf("T") === -1 ? "date" : "date-time";
    }, "detectType")
  },
  "recurrence-id": DEFAULT_TYPE_DATETIME_DATE,
  "resources": DEFAULT_TYPE_TEXT_MULTI,
  "request-status": DEFAULT_TYPE_TEXT_STRUCTURED,
  "rrule": DEFAULT_TYPE_RECUR,
  "sequence": DEFAULT_TYPE_INTEGER,
  "status": DEFAULT_TYPE_TEXT,
  "summary": DEFAULT_TYPE_TEXT,
  "transp": DEFAULT_TYPE_TEXT,
  "trigger": { defaultType: "duration", allowedTypes: ["duration", "date-time"] },
  "tzoffsetfrom": DEFAULT_TYPE_UTCOFFSET,
  "tzoffsetto": DEFAULT_TYPE_UTCOFFSET,
  "tzurl": DEFAULT_TYPE_URI,
  "tzid": DEFAULT_TYPE_TEXT,
  "tzname": DEFAULT_TYPE_TEXT
});
var vcardValues = extend(commonValues, {
  text: createTextType(FROM_VCARD_NEWLINE, TO_VCARD_NEWLINE),
  uri: createTextType(FROM_VCARD_NEWLINE, TO_VCARD_NEWLINE),
  date: {
    decorate: /* @__PURE__ */ __name(function(aValue) {
      return VCardTime.fromDateAndOrTimeString(aValue, "date");
    }, "decorate"),
    undecorate: /* @__PURE__ */ __name(function(aValue) {
      return aValue.toString();
    }, "undecorate"),
    fromICAL: /* @__PURE__ */ __name(function(aValue) {
      if (aValue.length == 8) {
        return icalValues.date.fromICAL(aValue);
      } else if (aValue[0] == "-" && aValue.length == 6) {
        return aValue.slice(0, 4) + "-" + aValue.slice(4);
      } else {
        return aValue;
      }
    }, "fromICAL"),
    toICAL: /* @__PURE__ */ __name(function(aValue) {
      if (aValue.length == 10) {
        return icalValues.date.toICAL(aValue);
      } else if (aValue[0] == "-" && aValue.length == 7) {
        return aValue.slice(0, 4) + aValue.slice(5);
      } else {
        return aValue;
      }
    }, "toICAL")
  },
  time: {
    decorate: /* @__PURE__ */ __name(function(aValue) {
      return VCardTime.fromDateAndOrTimeString("T" + aValue, "time");
    }, "decorate"),
    undecorate: /* @__PURE__ */ __name(function(aValue) {
      return aValue.toString();
    }, "undecorate"),
    fromICAL: /* @__PURE__ */ __name(function(aValue) {
      let splitzone = vcardValues.time._splitZone(aValue, true);
      let zone = splitzone[0], value = splitzone[1];
      if (value.length == 6) {
        value = value.slice(0, 2) + ":" + value.slice(2, 4) + ":" + value.slice(4, 6);
      } else if (value.length == 4 && value[0] != "-") {
        value = value.slice(0, 2) + ":" + value.slice(2, 4);
      } else if (value.length == 5) {
        value = value.slice(0, 3) + ":" + value.slice(3, 5);
      }
      if (zone.length == 5 && (zone[0] == "-" || zone[0] == "+")) {
        zone = zone.slice(0, 3) + ":" + zone.slice(3);
      }
      return value + zone;
    }, "fromICAL"),
    toICAL: /* @__PURE__ */ __name(function(aValue) {
      let splitzone = vcardValues.time._splitZone(aValue);
      let zone = splitzone[0], value = splitzone[1];
      if (value.length == 8) {
        value = value.slice(0, 2) + value.slice(3, 5) + value.slice(6, 8);
      } else if (value.length == 5 && value[0] != "-") {
        value = value.slice(0, 2) + value.slice(3, 5);
      } else if (value.length == 6) {
        value = value.slice(0, 3) + value.slice(4, 6);
      }
      if (zone.length == 6 && (zone[0] == "-" || zone[0] == "+")) {
        zone = zone.slice(0, 3) + zone.slice(4);
      }
      return value + zone;
    }, "toICAL"),
    _splitZone: /* @__PURE__ */ __name(function(aValue, isFromIcal) {
      let lastChar = aValue.length - 1;
      let signChar = aValue.length - (isFromIcal ? 5 : 6);
      let sign2 = aValue[signChar];
      let zone, value;
      if (aValue[lastChar] == "Z") {
        zone = aValue[lastChar];
        value = aValue.slice(0, Math.max(0, lastChar));
      } else if (aValue.length > 6 && (sign2 == "-" || sign2 == "+")) {
        zone = aValue.slice(signChar);
        value = aValue.slice(0, Math.max(0, signChar));
      } else {
        zone = "";
        value = aValue;
      }
      return [zone, value];
    }, "_splitZone")
  },
  "date-time": {
    decorate: /* @__PURE__ */ __name(function(aValue) {
      return VCardTime.fromDateAndOrTimeString(aValue, "date-time");
    }, "decorate"),
    undecorate: /* @__PURE__ */ __name(function(aValue) {
      return aValue.toString();
    }, "undecorate"),
    fromICAL: /* @__PURE__ */ __name(function(aValue) {
      return vcardValues["date-and-or-time"].fromICAL(aValue);
    }, "fromICAL"),
    toICAL: /* @__PURE__ */ __name(function(aValue) {
      return vcardValues["date-and-or-time"].toICAL(aValue);
    }, "toICAL")
  },
  "date-and-or-time": {
    decorate: /* @__PURE__ */ __name(function(aValue) {
      return VCardTime.fromDateAndOrTimeString(aValue, "date-and-or-time");
    }, "decorate"),
    undecorate: /* @__PURE__ */ __name(function(aValue) {
      return aValue.toString();
    }, "undecorate"),
    fromICAL: /* @__PURE__ */ __name(function(aValue) {
      let parts = aValue.split("T");
      return (parts[0] ? vcardValues.date.fromICAL(parts[0]) : "") + (parts[1] ? "T" + vcardValues.time.fromICAL(parts[1]) : "");
    }, "fromICAL"),
    toICAL: /* @__PURE__ */ __name(function(aValue) {
      let parts = aValue.split("T");
      return vcardValues.date.toICAL(parts[0]) + (parts[1] ? "T" + vcardValues.time.toICAL(parts[1]) : "");
    }, "toICAL")
  },
  timestamp: icalValues["date-time"],
  "language-tag": {
    matches: /^[a-zA-Z0-9-]+$/
    // Could go with a more strict regex here
  },
  "phone-number": {
    fromICAL: /* @__PURE__ */ __name(function(aValue) {
      return Array.from(aValue).filter(function(c) {
        return c === "\\" ? void 0 : c;
      }).join("");
    }, "fromICAL"),
    toICAL: /* @__PURE__ */ __name(function(aValue) {
      return Array.from(aValue).map(function(c) {
        return c === "," || c === ";" ? "\\" + c : c;
      }).join("");
    }, "toICAL")
  }
});
var vcardParams = {
  "type": {
    valueType: "text",
    multiValue: ","
  },
  "value": {
    // since the value here is a 'type' lowercase is used.
    values: [
      "text",
      "uri",
      "date",
      "time",
      "date-time",
      "date-and-or-time",
      "timestamp",
      "boolean",
      "integer",
      "float",
      "utc-offset",
      "language-tag"
    ],
    allowXName: true,
    allowIanaToken: true
  }
};
var vcardProperties = extend(commonProperties, {
  "adr": { defaultType: "text", structuredValue: ";", multiValue: "," },
  "anniversary": DEFAULT_TYPE_DATE_ANDOR_TIME,
  "bday": DEFAULT_TYPE_DATE_ANDOR_TIME,
  "caladruri": DEFAULT_TYPE_URI,
  "caluri": DEFAULT_TYPE_URI,
  "clientpidmap": DEFAULT_TYPE_TEXT_STRUCTURED,
  "email": DEFAULT_TYPE_TEXT,
  "fburl": DEFAULT_TYPE_URI,
  "fn": DEFAULT_TYPE_TEXT,
  "gender": DEFAULT_TYPE_TEXT_STRUCTURED,
  "geo": DEFAULT_TYPE_URI,
  "impp": DEFAULT_TYPE_URI,
  "key": DEFAULT_TYPE_URI,
  "kind": DEFAULT_TYPE_TEXT,
  "lang": { defaultType: "language-tag" },
  "logo": DEFAULT_TYPE_URI,
  "member": DEFAULT_TYPE_URI,
  "n": { defaultType: "text", structuredValue: ";", multiValue: "," },
  "nickname": DEFAULT_TYPE_TEXT_MULTI,
  "note": DEFAULT_TYPE_TEXT,
  "org": { defaultType: "text", structuredValue: ";" },
  "photo": DEFAULT_TYPE_URI,
  "related": DEFAULT_TYPE_URI,
  "rev": { defaultType: "timestamp" },
  "role": DEFAULT_TYPE_TEXT,
  "sound": DEFAULT_TYPE_URI,
  "source": DEFAULT_TYPE_URI,
  "tel": { defaultType: "uri", allowedTypes: ["uri", "text"] },
  "title": DEFAULT_TYPE_TEXT,
  "tz": { defaultType: "text", allowedTypes: ["text", "utc-offset", "uri"] },
  "xml": DEFAULT_TYPE_TEXT
});
var vcard3Values = extend(commonValues, {
  binary: icalValues.binary,
  date: vcardValues.date,
  "date-time": vcardValues["date-time"],
  "phone-number": vcardValues["phone-number"],
  uri: icalValues.uri,
  text: vcardValues.text,
  time: icalValues.time,
  vcard: icalValues.text,
  "utc-offset": {
    toICAL: /* @__PURE__ */ __name(function(aValue) {
      return aValue.slice(0, 7);
    }, "toICAL"),
    fromICAL: /* @__PURE__ */ __name(function(aValue) {
      return aValue.slice(0, 7);
    }, "fromICAL"),
    decorate: /* @__PURE__ */ __name(function(aValue) {
      return UtcOffset.fromString(aValue);
    }, "decorate"),
    undecorate: /* @__PURE__ */ __name(function(aValue) {
      return aValue.toString();
    }, "undecorate")
  }
});
var vcard3Params = {
  "type": {
    valueType: "text",
    multiValue: ","
  },
  "value": {
    // since the value here is a 'type' lowercase is used.
    values: [
      "text",
      "uri",
      "date",
      "date-time",
      "phone-number",
      "time",
      "boolean",
      "integer",
      "float",
      "utc-offset",
      "vcard",
      "binary"
    ],
    allowXName: true,
    allowIanaToken: true
  }
};
var vcard3Properties = extend(commonProperties, {
  fn: DEFAULT_TYPE_TEXT,
  n: { defaultType: "text", structuredValue: ";", multiValue: "," },
  nickname: DEFAULT_TYPE_TEXT_MULTI,
  photo: { defaultType: "binary", allowedTypes: ["binary", "uri"] },
  bday: {
    defaultType: "date-time",
    allowedTypes: ["date-time", "date"],
    detectType: /* @__PURE__ */ __name(function(string) {
      return string.indexOf("T") === -1 ? "date" : "date-time";
    }, "detectType")
  },
  adr: { defaultType: "text", structuredValue: ";", multiValue: "," },
  label: DEFAULT_TYPE_TEXT,
  tel: { defaultType: "phone-number" },
  email: DEFAULT_TYPE_TEXT,
  mailer: DEFAULT_TYPE_TEXT,
  tz: { defaultType: "utc-offset", allowedTypes: ["utc-offset", "text"] },
  geo: { defaultType: "float", structuredValue: ";" },
  title: DEFAULT_TYPE_TEXT,
  role: DEFAULT_TYPE_TEXT,
  logo: { defaultType: "binary", allowedTypes: ["binary", "uri"] },
  agent: { defaultType: "vcard", allowedTypes: ["vcard", "text", "uri"] },
  org: DEFAULT_TYPE_TEXT_STRUCTURED,
  note: DEFAULT_TYPE_TEXT_MULTI,
  prodid: DEFAULT_TYPE_TEXT,
  rev: {
    defaultType: "date-time",
    allowedTypes: ["date-time", "date"],
    detectType: /* @__PURE__ */ __name(function(string) {
      return string.indexOf("T") === -1 ? "date" : "date-time";
    }, "detectType")
  },
  "sort-string": DEFAULT_TYPE_TEXT,
  sound: { defaultType: "binary", allowedTypes: ["binary", "uri"] },
  class: DEFAULT_TYPE_TEXT,
  key: { defaultType: "binary", allowedTypes: ["binary", "text"] }
});
var icalSet = {
  name: "ical",
  value: icalValues,
  param: icalParams,
  property: icalProperties,
  propertyGroups: false
};
var vcardSet = {
  name: "vcard4",
  value: vcardValues,
  param: vcardParams,
  property: vcardProperties,
  propertyGroups: true
};
var vcard3Set = {
  name: "vcard3",
  value: vcard3Values,
  param: vcard3Params,
  property: vcard3Properties,
  propertyGroups: true
};
var design = {
  /**
   * Can be set to false to make the parser more lenient.
   */
  strict: true,
  /**
   * The default set for new properties and components if none is specified.
   * @type {designSet}
   */
  defaultSet: icalSet,
  /**
   * The default type for unknown properties
   * @type {String}
   */
  defaultType: "unknown",
  /**
   * Holds the design set for known top-level components
   *
   * @type {Object}
   * @property {designSet} vcard       vCard VCARD
   * @property {designSet} vevent      iCalendar VEVENT
   * @property {designSet} vtodo       iCalendar VTODO
   * @property {designSet} vjournal    iCalendar VJOURNAL
   * @property {designSet} valarm      iCalendar VALARM
   * @property {designSet} vtimezone   iCalendar VTIMEZONE
   * @property {designSet} daylight    iCalendar DAYLIGHT
   * @property {designSet} standard    iCalendar STANDARD
   *
   * @example
   * let propertyName = 'fn';
   * let componentDesign = ICAL.design.components.vcard;
   * let propertyDetails = componentDesign.property[propertyName];
   * if (propertyDetails.defaultType == 'text') {
   *   // Yep, sure is...
   * }
   */
  components: {
    vcard: vcardSet,
    vcard3: vcard3Set,
    vevent: icalSet,
    vtodo: icalSet,
    vjournal: icalSet,
    valarm: icalSet,
    vtimezone: icalSet,
    daylight: icalSet,
    standard: icalSet
  },
  /**
   * The design set for iCalendar (rfc5545/rfc7265) components.
   * @type {designSet}
   */
  icalendar: icalSet,
  /**
   * The design set for vCard (rfc6350/rfc7095) components.
   * @type {designSet}
   */
  vcard: vcardSet,
  /**
   * The design set for vCard (rfc2425/rfc2426/rfc7095) components.
   * @type {designSet}
   */
  vcard3: vcard3Set,
  /**
   * Gets the design set for the given component name.
   *
   * @param {String} componentName        The name of the component
   * @return {designSet}      The design set for the component
   */
  getDesignSet: /* @__PURE__ */ __name(function(componentName) {
    let isInDesign = componentName && componentName in design.components;
    return isInDesign ? design.components[componentName] : design.defaultSet;
  }, "getDesignSet")
};
var LINE_ENDING = "\r\n";
var DEFAULT_VALUE_TYPE = "unknown";
var RFC6868_REPLACE_MAP = { '"': "^'", "\n": "^n", "^": "^^" };
function stringify(jCal) {
  if (typeof jCal[0] == "string") {
    jCal = [jCal];
  }
  let i = 0;
  let len = jCal.length;
  let result = "";
  for (; i < len; i++) {
    result += stringify.component(jCal[i]) + LINE_ENDING;
  }
  return result;
}
__name(stringify, "stringify");
stringify.component = function(component, designSet) {
  let name = component[0].toUpperCase();
  let result = "BEGIN:" + name + LINE_ENDING;
  let props = component[1];
  let propIdx = 0;
  let propLen = props.length;
  let designSetName = component[0];
  if (designSetName === "vcard" && component[1].length > 0 && !(component[1][0][0] === "version" && component[1][0][3] === "4.0")) {
    designSetName = "vcard3";
  }
  designSet = designSet || design.getDesignSet(designSetName);
  for (; propIdx < propLen; propIdx++) {
    result += stringify.property(props[propIdx], designSet) + LINE_ENDING;
  }
  let comps = component[2] || [];
  let compIdx = 0;
  let compLen = comps.length;
  for (; compIdx < compLen; compIdx++) {
    result += stringify.component(comps[compIdx], designSet) + LINE_ENDING;
  }
  result += "END:" + name;
  return result;
};
stringify.property = function(property, designSet, noFold) {
  let name = property[0].toUpperCase();
  let jsName = property[0];
  let params = property[1];
  if (!designSet) {
    designSet = design.defaultSet;
  }
  let groupName = params.group;
  let line;
  if (designSet.propertyGroups && groupName) {
    line = groupName.toUpperCase() + "." + name;
  } else {
    line = name;
  }
  for (let [paramName, value] of Object.entries(params)) {
    if (designSet.propertyGroups && paramName == "group") {
      continue;
    }
    let paramDesign = designSet.param[paramName];
    let multiValue2 = paramDesign && paramDesign.multiValue;
    if (multiValue2 && Array.isArray(value)) {
      value = value.map(function(val) {
        val = stringify._rfc6868Unescape(val);
        val = stringify.paramPropertyValue(val, paramDesign.multiValueSeparateDQuote);
        return val;
      });
      value = stringify.multiValue(value, multiValue2, "unknown", null, designSet);
    } else {
      value = stringify._rfc6868Unescape(value);
      value = stringify.paramPropertyValue(value);
    }
    line += ";" + paramName.toUpperCase() + "=" + value;
  }
  if (property.length === 3) {
    return line + ":";
  }
  let valueType = property[2];
  let propDetails;
  let multiValue = false;
  let structuredValue = false;
  let isDefault = false;
  if (jsName in designSet.property) {
    propDetails = designSet.property[jsName];
    if ("multiValue" in propDetails) {
      multiValue = propDetails.multiValue;
    }
    if ("structuredValue" in propDetails && Array.isArray(property[3])) {
      structuredValue = propDetails.structuredValue;
    }
    if ("defaultType" in propDetails) {
      if (valueType === propDetails.defaultType) {
        isDefault = true;
      }
    } else {
      if (valueType === DEFAULT_VALUE_TYPE) {
        isDefault = true;
      }
    }
  } else {
    if (valueType === DEFAULT_VALUE_TYPE) {
      isDefault = true;
    }
  }
  if (!isDefault) {
    line += ";VALUE=" + valueType.toUpperCase();
  }
  line += ":";
  if (multiValue && structuredValue) {
    line += stringify.multiValue(
      property[3],
      structuredValue,
      valueType,
      multiValue,
      designSet,
      structuredValue
    );
  } else if (multiValue) {
    line += stringify.multiValue(
      property.slice(3),
      multiValue,
      valueType,
      null,
      designSet,
      false
    );
  } else if (structuredValue) {
    line += stringify.multiValue(
      property[3],
      structuredValue,
      valueType,
      null,
      designSet,
      structuredValue
    );
  } else {
    line += stringify.value(property[3], valueType, designSet, false);
  }
  return noFold ? line : foldline(line);
};
stringify.paramPropertyValue = function(value, force) {
  if (!force && value.indexOf(",") === -1 && value.indexOf(":") === -1 && value.indexOf(";") === -1) {
    return value;
  }
  return '"' + value + '"';
};
stringify.multiValue = function(values, delim, type, innerMulti, designSet, structuredValue) {
  let result = "";
  let len = values.length;
  let i = 0;
  for (; i < len; i++) {
    if (innerMulti && Array.isArray(values[i])) {
      result += stringify.multiValue(values[i], innerMulti, type, null, designSet, structuredValue);
    } else {
      result += stringify.value(values[i], type, designSet, structuredValue);
    }
    if (i !== len - 1) {
      result += delim;
    }
  }
  return result;
};
stringify.value = function(value, type, designSet, structuredValue) {
  if (type in designSet.value && "toICAL" in designSet.value[type]) {
    return designSet.value[type].toICAL(value, structuredValue);
  }
  return value;
};
stringify._rfc6868Unescape = function(val) {
  return val.replace(/[\n^"]/g, function(x) {
    return RFC6868_REPLACE_MAP[x];
  });
};
var NAME_INDEX$1 = 0;
var PROP_INDEX = 1;
var TYPE_INDEX = 2;
var VALUE_INDEX = 3;
var Property = class _Property {
  static {
    __name(this, "Property");
  }
  /**
   * Create an {@link ICAL.Property} by parsing the passed iCalendar string.
   *
   * @param {String} str            The iCalendar string to parse
   * @param {designSet=} designSet  The design data to use for this property
   * @return {Property}             The created iCalendar property
   */
  static fromString(str, designSet) {
    return new _Property(parse.property(str, designSet));
  }
  /**
   * Creates a new ICAL.Property instance.
   *
   * It is important to note that mutations done in the wrapper directly mutate the jCal object used
   * to initialize.
   *
   * Can also be used to create new properties by passing the name of the property (as a String).
   *
   * @param {Array|String} jCal         Raw jCal representation OR the new name of the property
   * @param {Component=} parent         Parent component
   */
  constructor(jCal, parent) {
    this._parent = parent || null;
    if (typeof jCal === "string") {
      this.jCal = [jCal, {}, design.defaultType];
      this.jCal[TYPE_INDEX] = this.getDefaultType();
    } else {
      this.jCal = jCal;
    }
    this._updateType();
  }
  /**
   * The value type for this property
   * @type {String}
   */
  get type() {
    return this.jCal[TYPE_INDEX];
  }
  /**
   * The name of this property, in lowercase.
   * @type {String}
   */
  get name() {
    return this.jCal[NAME_INDEX$1];
  }
  /**
   * The parent component for this property.
   * @type {Component}
   */
  get parent() {
    return this._parent;
  }
  set parent(p) {
    let designSetChanged = !this._parent || p && p._designSet != this._parent._designSet;
    this._parent = p;
    if (this.type == design.defaultType && designSetChanged) {
      this.jCal[TYPE_INDEX] = this.getDefaultType();
      this._updateType();
    }
  }
  /**
   * The design set for this property, e.g. icalendar vs vcard
   *
   * @type {designSet}
   * @private
   */
  get _designSet() {
    return this.parent ? this.parent._designSet : design.defaultSet;
  }
  /**
   * Updates the type metadata from the current jCal type and design set.
   *
   * @private
   */
  _updateType() {
    let designSet = this._designSet;
    if (this.type in designSet.value) {
      if ("decorate" in designSet.value[this.type]) {
        this.isDecorated = true;
      } else {
        this.isDecorated = false;
      }
      if (this.name in designSet.property) {
        this.isMultiValue = "multiValue" in designSet.property[this.name];
        this.isStructuredValue = "structuredValue" in designSet.property[this.name];
      }
    }
  }
  /**
   * Hydrate a single value. The act of hydrating means turning the raw jCal
   * value into a potentially wrapped object, for example {@link ICAL.Time}.
   *
   * @private
   * @param {Number} index        The index of the value to hydrate
   * @return {?Object}             The decorated value.
   */
  _hydrateValue(index) {
    if (this._values && this._values[index]) {
      return this._values[index];
    }
    if (this.jCal.length <= VALUE_INDEX + index) {
      return null;
    }
    if (this.isDecorated) {
      if (!this._values) {
        this._values = [];
      }
      return this._values[index] = this._decorate(
        this.jCal[VALUE_INDEX + index]
      );
    } else {
      return this.jCal[VALUE_INDEX + index];
    }
  }
  /**
   * Decorate a single value, returning its wrapped object. This is used by
   * the hydrate function to actually wrap the value.
   *
   * @private
   * @param {?} value         The value to decorate
   * @return {Object}         The decorated value
   */
  _decorate(value) {
    return this._designSet.value[this.type].decorate(value, this);
  }
  /**
   * Undecorate a single value, returning its raw jCal data.
   *
   * @private
   * @param {Object} value         The value to undecorate
   * @return {?}                   The undecorated value
   */
  _undecorate(value) {
    return this._designSet.value[this.type].undecorate(value, this);
  }
  /**
   * Sets the value at the given index while also hydrating it. The passed
   * value can either be a decorated or undecorated value.
   *
   * @private
   * @param {?} value             The value to set
   * @param {Number} index        The index to set it at
   */
  _setDecoratedValue(value, index) {
    if (!this._values) {
      this._values = [];
    }
    if (typeof value === "object" && "icaltype" in value) {
      this.jCal[VALUE_INDEX + index] = this._undecorate(value);
      this._values[index] = value;
    } else {
      this.jCal[VALUE_INDEX + index] = value;
      this._values[index] = this._decorate(value);
    }
  }
  /**
   * Gets a parameter on the property.
   *
   * @param {String}        name   Parameter name (lowercase)
   * @return {Array|String}        Parameter value
   */
  getParameter(name) {
    if (name in this.jCal[PROP_INDEX]) {
      return this.jCal[PROP_INDEX][name];
    } else {
      return void 0;
    }
  }
  /**
   * Gets first parameter on the property.
   *
   * @param {String}        name   Parameter name (lowercase)
   * @return {String}        Parameter value
   */
  getFirstParameter(name) {
    let parameters = this.getParameter(name);
    if (Array.isArray(parameters)) {
      return parameters[0];
    }
    return parameters;
  }
  /**
   * Sets a parameter on the property.
   *
   * @param {String}       name     The parameter name
   * @param {Array|String} value    The parameter value
   */
  setParameter(name, value) {
    let lcname = name.toLowerCase();
    if (typeof value === "string" && lcname in this._designSet.param && "multiValue" in this._designSet.param[lcname]) {
      value = [value];
    }
    this.jCal[PROP_INDEX][name] = value;
  }
  /**
   * Removes a parameter
   *
   * @param {String} name     The parameter name
   */
  removeParameter(name) {
    delete this.jCal[PROP_INDEX][name];
  }
  /**
   * Get the default type based on this property's name.
   *
   * @return {String}     The default type for this property
   */
  getDefaultType() {
    let name = this.jCal[NAME_INDEX$1];
    let designSet = this._designSet;
    if (name in designSet.property) {
      let details = designSet.property[name];
      if ("defaultType" in details) {
        return details.defaultType;
      }
    }
    return design.defaultType;
  }
  /**
   * Sets type of property and clears out any existing values of the current
   * type.
   *
   * @param {String} type     New iCAL type (see design.*.values)
   */
  resetType(type) {
    this.removeAllValues();
    this.jCal[TYPE_INDEX] = type;
    this._updateType();
  }
  /**
   * Finds the first property value.
   *
   * @return {Binary | Duration | Period |
   * Recur | Time | UtcOffset | Geo | string | null}         First property value
   */
  getFirstValue() {
    return this._hydrateValue(0);
  }
  /**
   * Gets all values on the property.
   *
   * NOTE: this creates an array during each call.
   *
   * @return {Array}          List of values
   */
  getValues() {
    let len = this.jCal.length - VALUE_INDEX;
    if (len < 1) {
      return [];
    }
    let i = 0;
    let result = [];
    for (; i < len; i++) {
      result[i] = this._hydrateValue(i);
    }
    return result;
  }
  /**
   * Removes all values from this property
   */
  removeAllValues() {
    if (this._values) {
      this._values.length = 0;
    }
    this.jCal.length = 3;
  }
  /**
   * Sets the values of the property.  Will overwrite the existing values.
   * This can only be used for multi-value properties.
   *
   * @param {Array} values    An array of values
   */
  setValues(values) {
    if (!this.isMultiValue) {
      throw new Error(
        this.name + ": does not not support mulitValue.\noverride isMultiValue"
      );
    }
    let len = values.length;
    let i = 0;
    this.removeAllValues();
    if (len > 0 && typeof values[0] === "object" && "icaltype" in values[0]) {
      this.resetType(values[0].icaltype);
    }
    if (this.isDecorated) {
      for (; i < len; i++) {
        this._setDecoratedValue(values[i], i);
      }
    } else {
      for (; i < len; i++) {
        this.jCal[VALUE_INDEX + i] = values[i];
      }
    }
  }
  /**
   * Sets the current value of the property. If this is a multi-value
   * property, all other values will be removed.
   *
   * @param {String|Object} value     New property value.
   */
  setValue(value) {
    this.removeAllValues();
    if (typeof value === "object" && "icaltype" in value) {
      this.resetType(value.icaltype);
    }
    if (this.isDecorated) {
      this._setDecoratedValue(value, 0);
    } else {
      this.jCal[VALUE_INDEX] = value;
    }
  }
  /**
   * Returns the Object representation of this component. The returned object
   * is a live jCal object and should be cloned if modified.
   * @return {Object}
   */
  toJSON() {
    return this.jCal;
  }
  /**
   * The string representation of this component.
   * @return {String}
   */
  toICALString() {
    return stringify.property(
      this.jCal,
      this._designSet,
      true
    );
  }
};
var NAME_INDEX = 0;
var PROPERTY_INDEX = 1;
var COMPONENT_INDEX = 2;
var PROPERTY_NAME_INDEX = 0;
var PROPERTY_VALUE_INDEX = 3;
var Component = class _Component {
  static {
    __name(this, "Component");
  }
  /**
   * Create an {@link ICAL.Component} by parsing the passed iCalendar string.
   *
   * @param {String} str        The iCalendar string to parse
   */
  static fromString(str) {
    return new _Component(parse.component(str));
  }
  /**
   * Creates a new Component instance.
   *
   * @param {Array|String} jCal         Raw jCal component data OR name of new
   *                                      component
   * @param {Component=} parent     Parent component to associate
   */
  constructor(jCal, parent) {
    if (typeof jCal === "string") {
      jCal = [jCal, [], []];
    }
    this.jCal = jCal;
    this.parent = parent || null;
    if (!this.parent && this.name === "vcalendar") {
      this._timezoneCache = /* @__PURE__ */ new Map();
    }
  }
  /**
   * Hydrated properties are inserted into the _properties array at the same
   * position as in the jCal array, so it is possible that the array contains
   * undefined values for unhydrdated properties. To avoid iterating the
   * array when checking if all properties have been hydrated, we save the
   * count here.
   *
   * @type {Number}
   * @private
   */
  _hydratedPropertyCount = 0;
  /**
   * The same count as for _hydratedPropertyCount, but for subcomponents
   *
   * @type {Number}
   * @private
   */
  _hydratedComponentCount = 0;
  /**
   * A cache of hydrated time zone objects which may be used by consumers, keyed
   * by time zone ID.
   *
   * @type {Map}
   * @private
   */
  _timezoneCache = null;
  /**
   * @private
   */
  _components = null;
  /**
   * @private
   */
  _properties = null;
  /**
   * The name of this component
   *
   * @type {String}
   */
  get name() {
    return this.jCal[NAME_INDEX];
  }
  /**
   * The design set for this component, e.g. icalendar vs vcard
   *
   * @type {designSet}
   * @private
   */
  get _designSet() {
    let parentDesign = this.parent && this.parent._designSet;
    if (!parentDesign && this.name == "vcard") {
      let versionProp = this.jCal[PROPERTY_INDEX]?.[0];
      if (versionProp && versionProp[PROPERTY_NAME_INDEX] == "version" && versionProp[PROPERTY_VALUE_INDEX] == "3.0") {
        return design.getDesignSet("vcard3");
      }
    }
    return parentDesign || design.getDesignSet(this.name);
  }
  /**
   * @private
   */
  _hydrateComponent(index) {
    if (!this._components) {
      this._components = [];
      this._hydratedComponentCount = 0;
    }
    if (this._components[index]) {
      return this._components[index];
    }
    let comp = new _Component(
      this.jCal[COMPONENT_INDEX][index],
      this
    );
    this._hydratedComponentCount++;
    return this._components[index] = comp;
  }
  /**
   * @private
   */
  _hydrateProperty(index) {
    if (!this._properties) {
      this._properties = [];
      this._hydratedPropertyCount = 0;
    }
    if (this._properties[index]) {
      return this._properties[index];
    }
    let prop = new Property(
      this.jCal[PROPERTY_INDEX][index],
      this
    );
    this._hydratedPropertyCount++;
    return this._properties[index] = prop;
  }
  /**
   * Finds first sub component, optionally filtered by name.
   *
   * @param {String=} name        Optional name to filter by
   * @return {?Component}     The found subcomponent
   */
  getFirstSubcomponent(name) {
    if (name) {
      let i = 0;
      let comps = this.jCal[COMPONENT_INDEX];
      let len = comps.length;
      for (; i < len; i++) {
        if (comps[i][NAME_INDEX] === name) {
          let result = this._hydrateComponent(i);
          return result;
        }
      }
    } else {
      if (this.jCal[COMPONENT_INDEX].length) {
        return this._hydrateComponent(0);
      }
    }
    return null;
  }
  /**
   * Finds all sub components, optionally filtering by name.
   *
   * @param {String=} name            Optional name to filter by
   * @return {Component[]}       The found sub components
   */
  getAllSubcomponents(name) {
    let jCalLen = this.jCal[COMPONENT_INDEX].length;
    let i = 0;
    if (name) {
      let comps = this.jCal[COMPONENT_INDEX];
      let result = [];
      for (; i < jCalLen; i++) {
        if (name === comps[i][NAME_INDEX]) {
          result.push(
            this._hydrateComponent(i)
          );
        }
      }
      return result;
    } else {
      if (!this._components || this._hydratedComponentCount !== jCalLen) {
        for (; i < jCalLen; i++) {
          this._hydrateComponent(i);
        }
      }
      return this._components || [];
    }
  }
  /**
   * Returns true when a named property exists.
   *
   * @param {String} name     The property name
   * @return {Boolean}        True, when property is found
   */
  hasProperty(name) {
    let props = this.jCal[PROPERTY_INDEX];
    let len = props.length;
    let i = 0;
    for (; i < len; i++) {
      if (props[i][NAME_INDEX] === name) {
        return true;
      }
    }
    return false;
  }
  /**
   * Finds the first property, optionally with the given name.
   *
   * @param {String=} name        Lowercase property name
   * @return {?Property}     The found property
   */
  getFirstProperty(name) {
    if (name) {
      let i = 0;
      let props = this.jCal[PROPERTY_INDEX];
      let len = props.length;
      for (; i < len; i++) {
        if (props[i][NAME_INDEX] === name) {
          let result = this._hydrateProperty(i);
          return result;
        }
      }
    } else {
      if (this.jCal[PROPERTY_INDEX].length) {
        return this._hydrateProperty(0);
      }
    }
    return null;
  }
  /**
   * Returns first property's value, if available.
   *
   * @param {String=} name                    Lowercase property name
   * @return {Binary | Duration | Period |
   * Recur | Time | UtcOffset | Geo | string | null}         The found property value.
   */
  getFirstPropertyValue(name) {
    let prop = this.getFirstProperty(name);
    if (prop) {
      return prop.getFirstValue();
    }
    return null;
  }
  /**
   * Get all properties in the component, optionally filtered by name.
   *
   * @param {String=} name        Lowercase property name
   * @return {Property[]}    List of properties
   */
  getAllProperties(name) {
    let jCalLen = this.jCal[PROPERTY_INDEX].length;
    let i = 0;
    if (name) {
      let props = this.jCal[PROPERTY_INDEX];
      let result = [];
      for (; i < jCalLen; i++) {
        if (name === props[i][NAME_INDEX]) {
          result.push(
            this._hydrateProperty(i)
          );
        }
      }
      return result;
    } else {
      if (!this._properties || this._hydratedPropertyCount !== jCalLen) {
        for (; i < jCalLen; i++) {
          this._hydrateProperty(i);
        }
      }
      return this._properties || [];
    }
  }
  /**
   * @private
   */
  _removeObjectByIndex(jCalIndex, cache, index) {
    cache = cache || [];
    if (cache[index]) {
      let obj = cache[index];
      if ("parent" in obj) {
        obj.parent = null;
      }
    }
    cache.splice(index, 1);
    this.jCal[jCalIndex].splice(index, 1);
  }
  /**
   * @private
   */
  _removeObject(jCalIndex, cache, nameOrObject) {
    let i = 0;
    let objects = this.jCal[jCalIndex];
    let len = objects.length;
    let cached = this[cache];
    if (typeof nameOrObject === "string") {
      for (; i < len; i++) {
        if (objects[i][NAME_INDEX] === nameOrObject) {
          this._removeObjectByIndex(jCalIndex, cached, i);
          return true;
        }
      }
    } else if (cached) {
      for (; i < len; i++) {
        if (cached[i] && cached[i] === nameOrObject) {
          this._removeObjectByIndex(jCalIndex, cached, i);
          return true;
        }
      }
    }
    return false;
  }
  /**
   * @private
   */
  _removeAllObjects(jCalIndex, cache, name) {
    let cached = this[cache];
    let objects = this.jCal[jCalIndex];
    let i = objects.length - 1;
    for (; i >= 0; i--) {
      if (!name || objects[i][NAME_INDEX] === name) {
        this._removeObjectByIndex(jCalIndex, cached, i);
      }
    }
  }
  /**
   * Adds a single sub component.
   *
   * @param {Component} component        The component to add
   * @return {Component}                 The passed in component
   */
  addSubcomponent(component) {
    if (!this._components) {
      this._components = [];
      this._hydratedComponentCount = 0;
    }
    if (component.parent) {
      component.parent.removeSubcomponent(component);
    }
    let idx = this.jCal[COMPONENT_INDEX].push(component.jCal);
    this._components[idx - 1] = component;
    this._hydratedComponentCount++;
    component.parent = this;
    return component;
  }
  /**
   * Removes a single component by name or the instance of a specific
   * component.
   *
   * @param {Component|String} nameOrComp    Name of component, or component
   * @return {Boolean}                            True when comp is removed
   */
  removeSubcomponent(nameOrComp) {
    let removed = this._removeObject(COMPONENT_INDEX, "_components", nameOrComp);
    if (removed) {
      this._hydratedComponentCount--;
    }
    return removed;
  }
  /**
   * Removes all components or (if given) all components by a particular
   * name.
   *
   * @param {String=} name            Lowercase component name
   */
  removeAllSubcomponents(name) {
    let removed = this._removeAllObjects(COMPONENT_INDEX, "_components", name);
    this._hydratedComponentCount = 0;
    return removed;
  }
  /**
   * Adds an {@link ICAL.Property} to the component.
   *
   * @param {Property} property      The property to add
   * @return {Property}              The passed in property
   */
  addProperty(property) {
    if (!(property instanceof Property)) {
      throw new TypeError("must be instance of ICAL.Property");
    }
    if (!this._properties) {
      this._properties = [];
      this._hydratedPropertyCount = 0;
    }
    if (property.parent) {
      property.parent.removeProperty(property);
    }
    let idx = this.jCal[PROPERTY_INDEX].push(property.jCal);
    this._properties[idx - 1] = property;
    this._hydratedPropertyCount++;
    property.parent = this;
    return property;
  }
  /**
   * Helper method to add a property with a value to the component.
   *
   * @param {String}               name         Property name to add
   * @param {String|Number|Object} value        Property value
   * @return {Property}                    The created property
   */
  addPropertyWithValue(name, value) {
    let prop = new Property(name);
    prop.setValue(value);
    this.addProperty(prop);
    return prop;
  }
  /**
   * Helper method that will update or create a property of the given name
   * and sets its value. If multiple properties with the given name exist,
   * only the first is updated.
   *
   * @param {String}               name         Property name to update
   * @param {String|Number|Object} value        Property value
   * @return {Property}                    The created property
   */
  updatePropertyWithValue(name, value) {
    let prop = this.getFirstProperty(name);
    if (prop) {
      prop.setValue(value);
    } else {
      prop = this.addPropertyWithValue(name, value);
    }
    return prop;
  }
  /**
   * Removes a single property by name or the instance of the specific
   * property.
   *
   * @param {String|Property} nameOrProp     Property name or instance to remove
   * @return {Boolean}                            True, when deleted
   */
  removeProperty(nameOrProp) {
    let removed = this._removeObject(PROPERTY_INDEX, "_properties", nameOrProp);
    if (removed) {
      this._hydratedPropertyCount--;
    }
    return removed;
  }
  /**
   * Removes all properties associated with this component, optionally
   * filtered by name.
   *
   * @param {String=} name        Lowercase property name
   * @return {Boolean}            True, when deleted
   */
  removeAllProperties(name) {
    let removed = this._removeAllObjects(PROPERTY_INDEX, "_properties", name);
    this._hydratedPropertyCount = 0;
    return removed;
  }
  /**
   * Returns the Object representation of this component. The returned object
   * is a live jCal object and should be cloned if modified.
   * @return {Object}
   */
  toJSON() {
    return this.jCal;
  }
  /**
   * The string representation of this component.
   * @return {String}
   */
  toString() {
    return stringify.component(
      this.jCal,
      this._designSet
    );
  }
  /**
   * Retrieve a time zone definition from the component tree, if any is present.
   * If the tree contains no time zone definitions or the TZID cannot be
   * matched, returns null.
   *
   * @param {String} tzid     The ID of the time zone to retrieve
   * @return {Timezone}  The time zone corresponding to the ID, or null
   */
  getTimeZoneByID(tzid) {
    if (this.parent) {
      return this.parent.getTimeZoneByID(tzid);
    }
    if (!this._timezoneCache) {
      return null;
    }
    if (this._timezoneCache.has(tzid)) {
      return this._timezoneCache.get(tzid);
    }
    const zones2 = this.getAllSubcomponents("vtimezone");
    for (const zone of zones2) {
      if (zone.getFirstProperty("tzid").getFirstValue() === tzid) {
        const hydratedZone = new Timezone({
          component: zone,
          tzid
        });
        this._timezoneCache.set(tzid, hydratedZone);
        return hydratedZone;
      }
    }
    return null;
  }
};
var RecurExpansion = class {
  static {
    __name(this, "RecurExpansion");
  }
  /**
   * Creates a new ICAL.RecurExpansion instance.
   *
   * The options object can be filled with the specified initial values. It can also contain
   * additional members, as a result of serializing a previous expansion state, as shown in the
   * example.
   *
   * @param {Object} options
   *        Recurrence expansion options
   * @param {Time} options.dtstart
   *        Start time of the event
   * @param {Component=} options.component
   *        Component for expansion, required if not resuming.
   */
  constructor(options) {
    this.ruleDates = [];
    this.exDates = [];
    this.fromData(options);
  }
  /**
   * True when iteration is fully completed.
   * @type {Boolean}
   */
  complete = false;
  /**
   * Array of rrule iterators.
   *
   * @type {RecurIterator[]}
   * @private
   */
  ruleIterators = null;
  /**
   * Array of rdate instances.
   *
   * @type {Time[]}
   * @private
   */
  ruleDates = null;
  /**
   * Array of exdate instances.
   *
   * @type {Time[]}
   * @private
   */
  exDates = null;
  /**
   * Current position in ruleDates array.
   * @type {Number}
   * @private
   */
  ruleDateInc = 0;
  /**
   * Current position in exDates array
   * @type {Number}
   * @private
   */
  exDateInc = 0;
  /**
   * Current negative date.
   *
   * @type {Time}
   * @private
   */
  exDate = null;
  /**
   * Current additional date.
   *
   * @type {Time}
   * @private
   */
  ruleDate = null;
  /**
   * Start date of recurring rules.
   *
   * @type {Time}
   */
  dtstart = null;
  /**
   * Last expanded time
   *
   * @type {Time}
   */
  last = null;
  /**
   * Initialize the recurrence expansion from the data object. The options
   * object may also contain additional members, see the
   * {@link ICAL.RecurExpansion constructor} for more details.
   *
   * @param {Object} options
   *        Recurrence expansion options
   * @param {Time} options.dtstart
   *        Start time of the event
   * @param {Component=} options.component
   *        Component for expansion, required if not resuming.
   */
  fromData(options) {
    let start = formatClassType(options.dtstart, Time);
    if (!start) {
      throw new Error(".dtstart (ICAL.Time) must be given");
    } else {
      this.dtstart = start;
    }
    if (options.component) {
      this._init(options.component);
    } else {
      this.last = formatClassType(options.last, Time) || start.clone();
      if (!options.ruleIterators) {
        throw new Error(".ruleIterators or .component must be given");
      }
      this.ruleIterators = options.ruleIterators.map(function(item) {
        return formatClassType(item, RecurIterator);
      });
      this.ruleDateInc = options.ruleDateInc;
      this.exDateInc = options.exDateInc;
      if (options.ruleDates) {
        this.ruleDates = options.ruleDates.map((item) => formatClassType(item, Time));
        this.ruleDate = this.ruleDates[this.ruleDateInc];
      }
      if (options.exDates) {
        this.exDates = options.exDates.map((item) => formatClassType(item, Time));
        this.exDate = this.exDates[this.exDateInc];
      }
      if (typeof options.complete !== "undefined") {
        this.complete = options.complete;
      }
    }
  }
  /**
   * Compare two ICAL.Time objects.  When the second parameter is a DATE and the first parameter is
   * DATE-TIME, strip the time and compare only the days.
   *
   * @private
   * @param {Time} a   The one object to compare
   * @param {Time} b   The other object to compare
   */
  _compare_special(a, b) {
    if (!a.isDate && b.isDate)
      return new Time({ year: a.year, month: a.month, day: a.day }).compare(b);
    return a.compare(b);
  }
  /**
   * Retrieve the next occurrence in the series.
   * @return {Time}
   */
  next() {
    let iter;
    let next;
    let compare;
    let maxTries = 500;
    let currentTry = 0;
    while (true) {
      if (currentTry++ > maxTries) {
        throw new Error(
          "max tries have occurred, rule may be impossible to fulfill."
        );
      }
      next = this.ruleDate;
      iter = this._nextRecurrenceIter(this.last);
      if (!next && !iter) {
        this.complete = true;
        break;
      }
      if (!next || iter && next.compare(iter.last) > 0) {
        next = iter.last.clone();
        iter.next();
      }
      if (this.ruleDate === next) {
        this._nextRuleDay();
      }
      this.last = next;
      if (this.exDate) {
        compare = this._compare_special(this.last, this.exDate);
        if (compare > 0) {
          this._nextExDay();
        }
        if (compare === 0) {
          this._nextExDay();
          continue;
        }
      }
      return this.last;
    }
  }
  /**
   * Converts object into a serialize-able format. This format can be passed
   * back into the expansion to resume iteration.
   * @return {Object}
   */
  toJSON() {
    function toJSON(item) {
      return item.toJSON();
    }
    __name(toJSON, "toJSON");
    let result = /* @__PURE__ */ Object.create(null);
    result.ruleIterators = this.ruleIterators.map(toJSON);
    if (this.ruleDates) {
      result.ruleDates = this.ruleDates.map(toJSON);
    }
    if (this.exDates) {
      result.exDates = this.exDates.map(toJSON);
    }
    result.ruleDateInc = this.ruleDateInc;
    result.exDateInc = this.exDateInc;
    result.last = this.last.toJSON();
    result.dtstart = this.dtstart.toJSON();
    result.complete = this.complete;
    return result;
  }
  /**
   * Extract all dates from the properties in the given component. The
   * properties will be filtered by the property name.
   *
   * @private
   * @param {Component} component             The component to search in
   * @param {String} propertyName             The property name to search for
   * @return {Time[]}                         The extracted dates.
   */
  _extractDates(component, propertyName) {
    let result = [];
    let props = component.getAllProperties(propertyName);
    for (let i = 0, len = props.length; i < len; i++) {
      for (let prop of props[i].getValues()) {
        let idx = binsearchInsert(
          result,
          prop,
          (a, b) => a.compare(b)
        );
        result.splice(idx, 0, prop);
      }
    }
    return result;
  }
  /**
   * Initialize the recurrence expansion.
   *
   * @private
   * @param {Component} component    The component to initialize from.
   */
  _init(component) {
    this.ruleIterators = [];
    this.last = this.dtstart.clone();
    if (!component.hasProperty("rdate") && !component.hasProperty("rrule") && !component.hasProperty("recurrence-id")) {
      this.ruleDate = this.last.clone();
      this.complete = true;
      return;
    }
    if (component.hasProperty("rdate")) {
      this.ruleDates = this._extractDates(component, "rdate");
      if (this.ruleDates[0] && this.ruleDates[0].compare(this.dtstart) < 0) {
        this.ruleDateInc = 0;
        this.last = this.ruleDates[0].clone();
      } else {
        this.ruleDateInc = binsearchInsert(
          this.ruleDates,
          this.last,
          (a, b) => a.compare(b)
        );
      }
      this.ruleDate = this.ruleDates[this.ruleDateInc];
    }
    if (component.hasProperty("rrule")) {
      let rules = component.getAllProperties("rrule");
      let i = 0;
      let len = rules.length;
      let rule;
      let iter;
      for (; i < len; i++) {
        rule = rules[i].getFirstValue();
        iter = rule.iterator(this.dtstart);
        this.ruleIterators.push(iter);
        iter.next();
      }
    }
    if (component.hasProperty("exdate")) {
      this.exDates = this._extractDates(component, "exdate");
      this.exDateInc = binsearchInsert(
        this.exDates,
        this.last,
        this._compare_special
      );
      this.exDate = this.exDates[this.exDateInc];
    }
  }
  /**
   * Advance to the next exdate
   * @private
   */
  _nextExDay() {
    this.exDate = this.exDates[++this.exDateInc];
  }
  /**
   * Advance to the next rule date
   * @private
   */
  _nextRuleDay() {
    this.ruleDate = this.ruleDates[++this.ruleDateInc];
  }
  /**
   * Find and return the recurrence rule with the most recent event and
   * return it.
   *
   * @private
   * @return {?RecurIterator}    Found iterator.
   */
  _nextRecurrenceIter() {
    let iters = this.ruleIterators;
    if (iters.length === 0) {
      return null;
    }
    let len = iters.length;
    let iter;
    let iterTime;
    let iterIdx = 0;
    let chosenIter;
    for (; iterIdx < len; iterIdx++) {
      iter = iters[iterIdx];
      iterTime = iter.last;
      if (iter.completed) {
        len--;
        if (iterIdx !== 0) {
          iterIdx--;
        }
        iters.splice(iterIdx, 1);
        continue;
      }
      if (!chosenIter || chosenIter.last.compare(iterTime) > 0) {
        chosenIter = iter;
      }
    }
    return chosenIter;
  }
};
var Event = class _Event {
  static {
    __name(this, "Event");
  }
  /**
   * Creates a new ICAL.Event instance.
   *
   * @param {Component=} component              The ICAL.Component to base this event on
   * @param {Object} [options]                  Options for this event
   * @param {Boolean=} options.strictExceptions  When true, will verify exceptions are related by
   *                                              their UUID
   * @param {Array<Component|Event>=} options.exceptions
   *          Exceptions to this event, either as components or events. If not
   *            specified exceptions will automatically be set in relation of
   *            component's parent
   */
  constructor(component, options) {
    if (!(component instanceof Component)) {
      options = component;
      component = null;
    }
    if (component) {
      this.component = component;
    } else {
      this.component = new Component("vevent");
    }
    this._rangeExceptionCache = /* @__PURE__ */ Object.create(null);
    this.exceptions = /* @__PURE__ */ Object.create(null);
    this.rangeExceptions = [];
    if (options && options.strictExceptions) {
      this.strictExceptions = options.strictExceptions;
    }
    if (options && options.exceptions) {
      options.exceptions.forEach(this.relateException, this);
    } else if (this.component.parent && !this.isRecurrenceException()) {
      this.component.parent.getAllSubcomponents("vevent").forEach(function(event) {
        if (event.hasProperty("recurrence-id")) {
          this.relateException(event);
        }
      }, this);
    }
  }
  static THISANDFUTURE = "THISANDFUTURE";
  /**
   * List of related event exceptions.
   *
   * @type {Event[]}
   */
  exceptions = null;
  /**
   * When true, will verify exceptions are related by their UUID.
   *
   * @type {Boolean}
   */
  strictExceptions = false;
  /**
   * Relates a given event exception to this object.  If the given component
   * does not share the UID of this event it cannot be related and will throw
   * an exception.
   *
   * If this component is an exception it cannot have other exceptions
   * related to it.
   *
   * @param {Component|Event} obj       Component or event
   */
  relateException(obj) {
    if (this.isRecurrenceException()) {
      throw new Error("cannot relate exception to exceptions");
    }
    if (obj instanceof Component) {
      obj = new _Event(obj);
    }
    if (this.strictExceptions && obj.uid !== this.uid) {
      throw new Error("attempted to relate unrelated exception");
    }
    let id = obj.recurrenceId.toString();
    this.exceptions[id] = obj;
    if (obj.modifiesFuture()) {
      let item = [
        obj.recurrenceId.toUnixTime(),
        id
      ];
      let idx = binsearchInsert(
        this.rangeExceptions,
        item,
        compareRangeException
      );
      this.rangeExceptions.splice(idx, 0, item);
    }
  }
  /**
   * Checks if this record is an exception and has the RANGE=THISANDFUTURE
   * value.
   *
   * @return {Boolean}        True, when exception is within range
   */
  modifiesFuture() {
    if (!this.component.hasProperty("recurrence-id")) {
      return false;
    }
    let range = this.component.getFirstProperty("recurrence-id").getParameter("range");
    return range === _Event.THISANDFUTURE;
  }
  /**
   * Finds the range exception nearest to the given date.
   *
   * @param {Time} time   usually an occurrence time of an event
   * @return {?Event}     the related event/exception or null
   */
  findRangeException(time) {
    if (!this.rangeExceptions.length) {
      return null;
    }
    let utc = time.toUnixTime();
    let idx = binsearchInsert(
      this.rangeExceptions,
      [utc],
      compareRangeException
    );
    idx -= 1;
    if (idx < 0) {
      return null;
    }
    let rangeItem = this.rangeExceptions[idx];
    if (utc < rangeItem[0]) {
      return null;
    }
    return rangeItem[1];
  }
  /**
   * Returns the occurrence details based on its start time.  If the
   * occurrence has an exception will return the details for that exception.
   *
   * NOTE: this method is intend to be used in conjunction
   *       with the {@link ICAL.Event#iterator iterator} method.
   *
   * @param {Time} occurrence               time occurrence
   * @return {occurrenceDetails}            Information about the occurrence
   */
  getOccurrenceDetails(occurrence) {
    let id = occurrence.toString();
    let utcId = occurrence.convertToZone(Timezone.utcTimezone).toString();
    let item;
    let result = {
      //XXX: Clone?
      recurrenceId: occurrence
    };
    if (id in this.exceptions) {
      item = result.item = this.exceptions[id];
      result.startDate = item.startDate;
      result.endDate = item.endDate;
      result.item = item;
    } else if (utcId in this.exceptions) {
      item = this.exceptions[utcId];
      result.startDate = item.startDate;
      result.endDate = item.endDate;
      result.item = item;
    } else {
      let rangeExceptionId = this.findRangeException(
        occurrence
      );
      let end;
      if (rangeExceptionId) {
        let exception = this.exceptions[rangeExceptionId];
        result.item = exception;
        let startDiff = this._rangeExceptionCache[rangeExceptionId];
        if (!startDiff) {
          let original = exception.recurrenceId.clone();
          let newStart = exception.startDate.clone();
          original.zone = newStart.zone;
          startDiff = newStart.subtractDate(original);
          this._rangeExceptionCache[rangeExceptionId] = startDiff;
        }
        let start = occurrence.clone();
        start.zone = exception.startDate.zone;
        start.addDuration(startDiff);
        end = start.clone();
        end.addDuration(exception.duration);
        result.startDate = start;
        result.endDate = end;
      } else {
        end = occurrence.clone();
        end.addDuration(this.duration);
        result.endDate = end;
        result.startDate = occurrence;
        result.item = this;
      }
    }
    return result;
  }
  /**
   * Builds a recur expansion instance for a specific point in time (defaults
   * to startDate).
   *
   * @param {Time=} startTime     Starting point for expansion
   * @return {RecurExpansion}    Expansion object
   */
  iterator(startTime) {
    return new RecurExpansion({
      component: this.component,
      dtstart: startTime || this.startDate
    });
  }
  /**
   * Checks if the event is recurring
   *
   * @return {Boolean}        True, if event is recurring
   */
  isRecurring() {
    let comp = this.component;
    return comp.hasProperty("rrule") || comp.hasProperty("rdate");
  }
  /**
   * Checks if the event describes a recurrence exception. See
   * {@tutorial terminology} for details.
   *
   * @return {Boolean}    True, if the event describes a recurrence exception
   */
  isRecurrenceException() {
    return this.component.hasProperty("recurrence-id");
  }
  /**
   * Returns the types of recurrences this event may have.
   *
   * Returned as an object with the following possible keys:
   *
   *    - YEARLY
   *    - MONTHLY
   *    - WEEKLY
   *    - DAILY
   *    - MINUTELY
   *    - SECONDLY
   *
   * @return {Object.<frequencyValues, Boolean>}
   *          Object of recurrence flags
   */
  getRecurrenceTypes() {
    let rules = this.component.getAllProperties("rrule");
    let i = 0;
    let len = rules.length;
    let result = /* @__PURE__ */ Object.create(null);
    for (; i < len; i++) {
      let value = rules[i].getFirstValue();
      result[value.freq] = true;
    }
    return result;
  }
  /**
   * The uid of this event
   * @type {String}
   */
  get uid() {
    return this._firstProp("uid");
  }
  set uid(value) {
    this._setProp("uid", value);
  }
  /**
   * The start date
   * @type {Time}
   */
  get startDate() {
    return this._firstProp("dtstart");
  }
  set startDate(value) {
    this._setTime("dtstart", value);
  }
  /**
   * The end date. This can be the result directly from the property, or the
   * end date calculated from start date and duration. Setting the property
   * will remove any duration properties.
   * @type {Time}
   */
  get endDate() {
    let endDate = this._firstProp("dtend");
    if (!endDate) {
      let duration = this._firstProp("duration");
      endDate = this.startDate.clone();
      if (duration) {
        endDate.addDuration(duration);
      } else if (endDate.isDate) {
        endDate.day += 1;
      }
    }
    return endDate;
  }
  set endDate(value) {
    if (this.component.hasProperty("duration")) {
      this.component.removeProperty("duration");
    }
    this._setTime("dtend", value);
  }
  /**
   * The duration. This can be the result directly from the property, or the
   * duration calculated from start date and end date. Setting the property
   * will remove any `dtend` properties.
   * @type {Duration}
   */
  get duration() {
    let duration = this._firstProp("duration");
    if (!duration) {
      return this.endDate.subtractDateTz(this.startDate);
    }
    return duration;
  }
  set duration(value) {
    if (this.component.hasProperty("dtend")) {
      this.component.removeProperty("dtend");
    }
    this._setProp("duration", value);
  }
  /**
   * The location of the event.
   * @type {String}
   */
  get location() {
    return this._firstProp("location");
  }
  set location(value) {
    this._setProp("location", value);
  }
  /**
   * The attendees in the event
   * @type {Property[]}
   */
  get attendees() {
    return this.component.getAllProperties("attendee");
  }
  /**
   * The event summary
   * @type {String}
   */
  get summary() {
    return this._firstProp("summary");
  }
  set summary(value) {
    this._setProp("summary", value);
  }
  /**
   * The event description.
   * @type {String}
   */
  get description() {
    return this._firstProp("description");
  }
  set description(value) {
    this._setProp("description", value);
  }
  /**
   * The event color from [rfc7986](https://datatracker.ietf.org/doc/html/rfc7986)
   * @type {String}
   */
  get color() {
    return this._firstProp("color");
  }
  set color(value) {
    this._setProp("color", value);
  }
  /**
   * The organizer value as an uri. In most cases this is a mailto: uri, but
   * it can also be something else, like urn:uuid:...
   * @type {String}
   */
  get organizer() {
    return this._firstProp("organizer");
  }
  set organizer(value) {
    this._setProp("organizer", value);
  }
  /**
   * The sequence value for this event. Used for scheduling
   * see {@tutorial terminology}.
   * @type {Number}
   */
  get sequence() {
    return this._firstProp("sequence");
  }
  set sequence(value) {
    this._setProp("sequence", value);
  }
  /**
   * The recurrence id for this event. See {@tutorial terminology} for details.
   * @type {Time}
   */
  get recurrenceId() {
    return this._firstProp("recurrence-id");
  }
  set recurrenceId(value) {
    this._setTime("recurrence-id", value);
  }
  /**
   * Set/update a time property's value.
   * This will also update the TZID of the property.
   *
   * TODO: this method handles the case where we are switching
   * from a known timezone to an implied timezone (one without TZID).
   * This does _not_ handle the case of moving between a known
   *  (by TimezoneService) timezone to an unknown timezone...
   *
   * We will not add/remove/update the VTIMEZONE subcomponents
   *  leading to invalid ICAL data...
   * @private
   * @param {String} propName     The property name
   * @param {Time} time           The time to set
   */
  _setTime(propName, time) {
    let prop = this.component.getFirstProperty(propName);
    if (!prop) {
      prop = new Property(propName);
      this.component.addProperty(prop);
    }
    if (time.zone === Timezone.localTimezone || time.zone === Timezone.utcTimezone) {
      prop.removeParameter("tzid");
    } else {
      prop.setParameter("tzid", time.zone.tzid);
    }
    prop.setValue(time);
  }
  _setProp(name, value) {
    this.component.updatePropertyWithValue(name, value);
  }
  _firstProp(name) {
    return this.component.getFirstPropertyValue(name);
  }
  /**
   * The string representation of this event.
   * @return {String}
   */
  toString() {
    return this.component.toString();
  }
};
function compareRangeException(a, b) {
  if (a[0] > b[0]) return 1;
  if (b[0] > a[0]) return -1;
  return 0;
}
__name(compareRangeException, "compareRangeException");
var ComponentParser = class {
  static {
    __name(this, "ComponentParser");
  }
  /**
   * Creates a new ICAL.ComponentParser instance.
   *
   * @param {Object=} options                   Component parser options
   * @param {Boolean} options.parseEvent        Whether events should be parsed
   * @param {Boolean} options.parseTimezeone    Whether timezones should be parsed
   */
  constructor(options) {
    if (typeof options === "undefined") {
      options = {};
    }
    for (let [key, value] of Object.entries(options)) {
      this[key] = value;
    }
  }
  /**
   * When true, parse events
   *
   * @type {Boolean}
   */
  parseEvent = true;
  /**
   * When true, parse timezones
   *
   * @type {Boolean}
   */
  parseTimezone = true;
  /* SAX like events here for reference */
  /**
   * Fired when parsing is complete
   * @callback
   */
  oncomplete = (
    /* c8 ignore next */
    /* @__PURE__ */ __name(function() {
    }, "oncomplete")
  );
  /**
   * Fired if an error occurs during parsing.
   *
   * @callback
   * @param {Error} err details of error
   */
  onerror = (
    /* c8 ignore next */
    /* @__PURE__ */ __name(function(err) {
    }, "onerror")
  );
  /**
   * Fired when a top level component (VTIMEZONE) is found
   *
   * @callback
   * @param {Timezone} component     Timezone object
   */
  ontimezone = (
    /* c8 ignore next */
    /* @__PURE__ */ __name(function(component) {
    }, "ontimezone")
  );
  /**
   * Fired when a top level component (VEVENT) is found.
   *
   * @callback
   * @param {Event} component    Top level component
   */
  onevent = (
    /* c8 ignore next */
    /* @__PURE__ */ __name(function(component) {
    }, "onevent")
  );
  /**
   * Process a string or parse ical object.  This function itself will return
   * nothing but will start the parsing process.
   *
   * Events must be registered prior to calling this method.
   *
   * @param {Component|String|Object} ical      The component to process,
   *        either in its final form, as a jCal Object, or string representation
   */
  process(ical) {
    if (typeof ical === "string") {
      ical = parse(ical);
    }
    if (!(ical instanceof Component)) {
      ical = new Component(ical);
    }
    let components = ical.getAllSubcomponents();
    let i = 0;
    let len = components.length;
    let component;
    for (; i < len; i++) {
      component = components[i];
      switch (component.name) {
        case "vtimezone":
          if (this.parseTimezone) {
            let tzid = component.getFirstPropertyValue("tzid");
            if (tzid) {
              this.ontimezone(new Timezone({
                tzid,
                component
              }));
            }
          }
          break;
        case "vevent":
          if (this.parseEvent) {
            this.onevent(new Event(component));
          }
          break;
        default:
          continue;
      }
    }
    this.oncomplete();
  }
};
var ICALmodule = {
  /**
   * The number of characters before iCalendar line folding should occur
   * @type {Number}
   * @default 75
   */
  foldLength: 75,
  debug: false,
  /**
   * The character(s) to be used for a newline. The default value is provided by
   * rfc5545.
   * @type {String}
   * @default "\r\n"
   */
  newLineChar: "\r\n",
  Binary,
  Component,
  ComponentParser,
  Duration,
  Event,
  Period,
  Property,
  Recur,
  RecurExpansion,
  RecurIterator,
  Time,
  Timezone,
  TimezoneService,
  UtcOffset,
  VCardTime,
  parse,
  stringify,
  design,
  helpers
};

// src/recurring-engine.js
var FREQ_MAP = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  yearly: "YEARLY"
};
var DAY_MAP = ["", "SU", "MO", "TU", "WE", "TH", "FR", "SA"];
function dateStrToICALTime(dateStr) {
  const parts = dateStr.split("-");
  return new ICALmodule.Time({
    year: parseInt(parts[0]),
    month: parseInt(parts[1]),
    day: parseInt(parts[2]),
    isDate: true
  });
}
__name(dateStrToICALTime, "dateStrToICALTime");
function icalTimeToDateStr(time) {
  const y = time.year;
  const m = String(time.month).padStart(2, "0");
  const d = String(time.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
__name(icalTimeToDateStr, "icalTimeToDateStr");
function buildRRuleString(repeatType, anchorDate, repeatEnd, repeatCustom) {
  if (repeatCustom && repeatCustom.trim()) {
    let rrule = repeatCustom.trim();
    if (!rrule.startsWith("RRULE:")) rrule = "RRULE:" + rrule;
    if (repeatEnd && !rrule.includes("UNTIL")) {
      const untilStr = repeatEnd.replace(/-/g, "") + "T235959Z";
      rrule = rrule + ";UNTIL=" + untilStr;
    }
    return rrule;
  }
  if (!repeatType || repeatType === "none" || !anchorDate) return "";
  const freq = FREQ_MAP[repeatType];
  if (!freq) return "";
  let parts = [`FREQ=${freq}`];
  if (repeatType === "weekly") {
    const d = dateStrToICALTime(anchorDate);
    parts.push(`BYDAY=${DAY_MAP[d.dayOfWeek()]}`);
  }
  if (repeatType === "monthly") {
    const d = dateStrToICALTime(anchorDate);
    parts.push(`BYMONTHDAY=${d.day}`);
  }
  if (repeatType === "yearly") {
    const d = dateStrToICALTime(anchorDate);
    parts.push(`BYMONTH=${d.month}`);
    parts.push(`BYMONTHDAY=${d.day}`);
  }
  if (repeatEnd) {
    const untilStr = repeatEnd.replace(/-/g, "") + "T235959Z";
    parts.push(`UNTIL=${untilStr}`);
  }
  return "RRULE:" + parts.join(";");
}
__name(buildRRuleString, "buildRRuleString");
function createICALComponent(template) {
  const vcalendar = new ICALmodule.Component(["vcalendar", [], []]);
  vcalendar.addPropertyWithValue("version", "2.0");
  vcalendar.addPropertyWithValue("prodid", "-//cf-todo//recurring-engine//EN");
  const vevent = new ICALmodule.Component("vevent");
  vevent.addPropertyWithValue("uid", template.parent_id || "temp");
  vevent.addPropertyWithValue("dtstart", dateStrToICALTime(template.anchor_date));
  const rruleStr = buildRRuleString(
    template.repeat_type,
    template.anchor_date,
    template.repeat_end,
    template.repeat_custom
  );
  if (rruleStr) {
    const rruleProp = new ICALmodule.Property("rrule", vevent);
    rruleProp.setValue(ICALmodule.Recur.fromString(rruleStr.replace("RRULE:", "")));
    vevent.addProperty(rruleProp);
  }
  let exdates = [];
  if (template.exdates) {
    try {
      exdates = typeof template.exdates === "string" ? JSON.parse(template.exdates) : template.exdates;
    } catch (e) {
      exdates = [];
    }
  }
  if (Array.isArray(exdates) && exdates.length > 0) {
    const exdateValues = exdates.filter((d) => d && typeof d === "string" && d.match(/^\d{4}-\d{2}-\d{2}$/)).map((d) => dateStrToICALTime(d));
    if (exdateValues.length > 0) {
      const exdateProp = new ICALmodule.Property("exdate", vevent);
      exdateProp.setValues(exdateValues);
      vevent.addProperty(exdateProp);
    }
  }
  vcalendar.addSubcomponent(vevent);
  return vcalendar;
}
__name(createICALComponent, "createICALComponent");
function isOccurrenceOnDate(template, dateStr) {
  if (!template.repeat_type || template.repeat_type === "none") return false;
  if (!template.anchor_date || template.anchor_date > dateStr) return false;
  let exdates = [];
  if (template.exdates) {
    try {
      exdates = typeof template.exdates === "string" ? JSON.parse(template.exdates) : template.exdates;
    } catch (e) {
      exdates = [];
    }
  }
  if (Array.isArray(exdates) && exdates.includes(dateStr)) return false;
  if (template.repeat_end && dateStr > template.repeat_end) return false;
  if (dateStr === template.anchor_date) return true;
  try {
    const vcalendar = createICALComponent(template);
    const vevent = vcalendar.getFirstSubcomponent("vevent");
    const event = new ICALmodule.Event(vevent);
    const iterator = event.iterator();
    let next;
    let count = 0;
    while ((next = iterator.next()) && count < 1e3) {
      const nextStr = icalTimeToDateStr(next);
      if (nextStr === dateStr) return true;
      if (nextStr > dateStr) return false;
      count++;
    }
    return false;
  } catch (e) {
    return simpleIsOccurrence(template, dateStr);
  }
}
__name(isOccurrenceOnDate, "isOccurrenceOnDate");
function simpleIsOccurrence(template, dateStr) {
  const anchor = template.anchor_date;
  if (dateStr < anchor) return false;
  if (template.repeat_end && dateStr > template.repeat_end) return false;
  const [ay, am, ad] = anchor.split("-").map(Number);
  const [dy, dm, dd] = dateStr.split("-").map(Number);
  switch (template.repeat_type) {
    case "daily":
      return true;
    case "weekly": {
      const anchorDate = new Date(ay, am - 1, ad);
      const targetDate = new Date(dy, dm - 1, dd);
      return anchorDate.getDay() === targetDate.getDay();
    }
    case "monthly":
      return ad === dd;
    case "yearly":
      return am === dm && ad === dd;
    default:
      return false;
  }
}
__name(simpleIsOccurrence, "simpleIsOccurrence");
function computeDeleteActions({ task, date, scope }) {
  const parentId = task.parentId || task.parent_id;
  const isSeries = task.isSeries || parentId && parentId !== task.id;
  const actions = {
    deleteTodoIds: [],
    updateTodos: [],
    updateTemplate: null,
    deleteTemplate: false,
    insertTemplate: null
  };
  if (!isSeries) {
    actions.deleteTodoIds.push(task.id);
    return actions;
  }
  switch (scope) {
    case "this": {
      actions.deleteTodoIds.push(task.id);
      actions.updateTemplate = { type: "add_exdate", date, parentId };
      break;
    }
    case "thisAndFuture": {
      actions.deleteTodoIds.push(task.id);
      actions.updateTemplate = { type: "set_repeat_end", date, parentId, alsoDeleteFuture: true };
      break;
    }
    case "all": {
      actions.deleteTemplate = true;
      actions.updateTemplate = { type: "delete_all", parentId };
      break;
    }
    default:
      actions.deleteTodoIds.push(task.id);
  }
  return actions;
}
__name(computeDeleteActions, "computeDeleteActions");
function computeUpdateActions({ task, date, scope, newValues }) {
  const parentId = task.parentId || task.parent_id;
  const isSeries = task.isSeries || parentId && parentId !== task.id;
  const rptType = newValues.repeat_type || task.repeat_type || "none";
  const isRecurring = rptType !== "none";
  const actions = {
    currentTodo: null,
    futureTodos: null,
    pastTodos: null,
    template: null,
    deleteTemplate: false,
    insertTemplate: null
  };
  if (!isSeries) {
    actions.currentTodo = { ...newValues, isRecurring: false };
    return actions;
  }
  switch (scope) {
    case "this": {
      if (isRecurring) {
        actions.currentTodo = {
          ...newValues,
          isRecurring: true,
          detachFromSeries: true,
          newSeries: true
        };
      } else {
        actions.currentTodo = {
          ...newValues,
          repeat_type: "none",
          isRecurring: false,
          detachFromSeries: true
        };
      }
      actions.template = { type: "add_exdate", date, parentId };
      break;
    }
    case "thisAndFuture": {
      if (isRecurring) {
        actions.currentTodo = { ...newValues, isRecurring: true };
        actions.pastTodos = { type: "set_repeat_end", date, parentId };
        actions.template = { type: "update_from_date", date, parentId, newValues };
      } else {
        actions.currentTodo = { ...newValues, repeat_type: "none", isRecurring: false, detachFromSeries: true };
        actions.pastTodos = { type: "set_repeat_end", date, parentId };
        actions.template = { type: "set_repeat_end", date, parentId };
      }
      break;
    }
    case "all": {
      if (isRecurring) {
        actions.currentTodo = { ...newValues, isRecurring: true };
        actions.template = { type: "update_all", parentId, newValues };
      } else {
        actions.currentTodo = { ...newValues, repeat_type: "none", isRecurring: false, detachFromSeries: true };
        actions.template = { type: "delete", parentId };
      }
      break;
    }
    default:
      actions.currentTodo = { ...newValues };
  }
  return actions;
}
__name(computeUpdateActions, "computeUpdateActions");
function addExdate(currentExdates, dateStr) {
  let exdates = [];
  try {
    exdates = typeof currentExdates === "string" ? JSON.parse(currentExdates || "[]") : Array.isArray(currentExdates) ? currentExdates : [];
  } catch (e) {
    exdates = [];
  }
  if (!exdates.includes(dateStr)) {
    exdates.push(dateStr);
  }
  return JSON.stringify(exdates);
}
__name(addExdate, "addExdate");
function removeExdate(currentExdates, dateStr) {
  let exdates = [];
  try {
    exdates = typeof currentExdates === "string" ? JSON.parse(currentExdates || "[]") : Array.isArray(currentExdates) ? currentExdates : [];
  } catch (e) {
    exdates = [];
  }
  exdates = exdates.filter((d) => d !== dateStr);
  return JSON.stringify(exdates);
}
__name(removeExdate, "removeExdate");
function getPreviousDate(dateStr) {
  const parts = dateStr.split("-");
  const d = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
__name(getPreviousDate, "getPreviousDate");

// src/api-v1.js
var API_KEYS_SETTINGS_KEY = "api_keys";
function generateApiKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) => c === "+" ? "-" : c === "/" ? "_" : "");
  return "cfk_" + raw;
}
__name(generateApiKey, "generateApiKey");
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
__name(getApiKeys, "getApiKeys");
async function saveApiKeys(DB, keys) {
  await DB.prepare(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
  ).bind(API_KEYS_SETTINGS_KEY, JSON.stringify(keys)).run();
}
__name(saveApiKeys, "saveApiKeys");
async function verifyApiKey(DB, providedKey, jwtSecret) {
  if (!providedKey || typeof providedKey !== "string") return false;
  const keys = await getApiKeys(DB);
  for (const k of keys) {
    if (k.disabled) continue;
    const match = await secureCompare(providedKey, k.key, jwtSecret);
    if (match) return true;
  }
  return false;
}
__name(verifyApiKey, "verifyApiKey");
function extractApiKey(request, url) {
  const headerKey = request.headers.get("X-API-Key");
  if (headerKey) return headerKey;
  const queryKey = url.searchParams.get("api_key");
  if (queryKey) return queryKey;
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith("cfk_")) return token;
  }
  return null;
}
__name(extractApiKey, "extractApiKey");
async function verifyCookieAuth(request, env) {
  const cookies = parseCookies(request);
  if (!cookies.auth_token || !cookies.auth_sig) {
    return apiError("Cookie authentication required", 401);
  }
  const sigValid = await verify(cookies.auth_token, cookies.auth_sig, env.JWT_SECRET);
  if (!sigValid) return apiError("Invalid cookie auth", 401);
  const record = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'active_session_token'"
  ).first();
  if (!record || !record.value) return apiError("UNAUTHORIZED", 401);
  let sessions;
  try {
    sessions = JSON.parse(record.value);
    if (!Array.isArray(sessions)) return apiError("UNAUTHORIZED", 401);
  } catch (e) {
    return apiError("UNAUTHORIZED", 401);
  }
  const matched = sessions.find((s) => s.token === cookies.auth_token);
  if (!matched) return apiError("UNAUTHORIZED", 401);
  return null;
}
__name(verifyCookieAuth, "verifyCookieAuth");
async function handleApiKeys(request, env, url) {
  const authErr = await verifyCookieAuth(request, env);
  if (authErr) return authErr;
  if (request.method === "GET") {
    const keys = await getApiKeys(env.DB);
    const safe = keys.map((k) => ({
      id: k.id,
      name: k.name || "",
      keyPrefix: k.key.slice(0, 8) + "..." + k.key.slice(-4),
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt || null,
      disabled: k.disabled || false
    }));
    return new Response(JSON.stringify(safe), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (request.method === "POST") {
    const { action, id, name } = await request.json();
    if (action === "CREATE") {
      const keys = await getApiKeys(env.DB);
      if (keys.length >= 10) {
        return apiError("\u6700\u591A\u521B\u5EFA10\u4E2AAPI Key", 400);
      }
      const newKey = generateApiKey();
      const keyId = Date.now().toString() + Math.random().toString().slice(2, 6);
      const record = {
        id: keyId,
        key: newKey,
        name: (name || "").trim().slice(0, 50) || "Default",
        createdAt: Date.now(),
        lastUsedAt: null,
        disabled: false
      };
      keys.push(record);
      await saveApiKeys(env.DB, keys);
      return new Response(JSON.stringify({
        success: true,
        id: keyId,
        key: newKey,
        name: record.name
      }), { headers: { "Content-Type": "application/json" } });
    }
    if (action === "DELETE") {
      if (!id) return apiError("\u7F3A\u5C11 id", 400);
      let keys = await getApiKeys(env.DB);
      keys = keys.filter((k) => k.id !== id);
      await saveApiKeys(env.DB, keys);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (action === "TOGGLE") {
      if (!id) return apiError("\u7F3A\u5C11 id", 400);
      const keys = await getApiKeys(env.DB);
      const target = keys.find((k) => k.id === id);
      if (!target) return apiError("Key \u4E0D\u5B58\u5728", 404);
      target.disabled = !target.disabled;
      await saveApiKeys(env.DB, keys);
      return new Response(JSON.stringify({ success: true, disabled: target.disabled }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (action === "RENAME") {
      if (!id) return apiError("\u7F3A\u5C11 id", 400);
      const keys = await getApiKeys(env.DB);
      const target = keys.find((k) => k.id === id);
      if (!target) return apiError("Key \u4E0D\u5B58\u5728", 404);
      target.name = (name || "").trim().slice(0, 50) || "Default";
      await saveApiKeys(env.DB, keys);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return apiError("\u672A\u77E5\u64CD\u4F5C\uFF0C\u53EF\u7528: CREATE, DELETE, TOGGLE, RENAME", 400);
  }
  return apiError("Method Not Allowed", 405);
}
__name(handleApiKeys, "handleApiKeys");
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
__name(jsonResponse, "jsonResponse");
async function touchApiKeyLastUsed(DB, apiKey) {
  try {
    const keys = await getApiKeys(DB);
    const target = keys.find((k) => k.key === apiKey);
    if (target) {
      const now = Date.now();
      if (!target.lastUsedAt || now - target.lastUsedAt > 5 * 60 * 1e3) {
        target.lastUsedAt = now;
        await saveApiKeys(DB, keys);
      }
    }
  } catch (e) {
  }
}
__name(touchApiKeyLastUsed, "touchApiKeyLastUsed");
function parseJsonField(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val) {
    try {
      return JSON.parse(val);
    } catch (e) {
    }
  }
  return [];
}
__name(parseJsonField, "parseJsonField");
function normalizePriority(val) {
  if (val === "medium") return "med";
  if (["low", "med", "high"].includes(val)) return val;
  return "low";
}
__name(normalizePriority, "normalizePriority");
function formatTodo(row) {
  const subtasks = parseJsonField(row.subtasks).map((s) => {
    if (typeof s === "string" && s.trim()) return { text: s, done: false };
    if (s && typeof s === "object" && s.text) return s;
    return null;
  }).filter(Boolean);
  const searchTerms = parseJsonField(row.search_terms).map((w) => {
    if (typeof w === "string" && w.trim()) return { text: w, done: false };
    if (w && typeof w === "object" && w.text) return w;
    return null;
  }).filter(Boolean);
  let rType = row.repeat_type || "none";
  if (rType !== "none" && !["daily", "weekly", "monthly", "yearly"].includes(rType)) rType = "daily";
  return {
    id: row.id,
    parentId: row.parent_id,
    date: row.date,
    text: row.text,
    time: row.time || "",
    priority: normalizePriority(row.priority || "low"),
    desc: row.desc || "",
    url: row.url || "",
    copyText: row.copy_text || "",
    subtasks,
    searchTerms,
    done: !!row.done,
    deleted: !!row.deleted,
    repeatType: rType,
    repeatCustom: row.repeat_custom || "",
    repeatEnd: row.repeat_end || "",
    endTime: row.end_time || "",
    categoryId: row.category_id || "",
    recurrenceId: row.recurrence_id || "",
    isException: !!row.is_exception,
    isSeries: rType !== "none"
  };
}
__name(formatTodo, "formatTodo");
function formatCategory(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color || DEFAULT_CATEGORY_COLOR
  };
}
__name(formatCategory, "formatCategory");
async function handleV1Todos(request, env, url) {
  const DB = env.DB;
  if (request.method === "GET") {
    const date = url.searchParams.get("date");
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const categoryId = url.searchParams.get("category_id");
    const done = url.searchParams.get("done");
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 1), 500);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
    let conditions = ["deleted = 0"];
    let params = [];
    if (date) {
      conditions.push("date = ?");
      params.push(date);
    } else if (startDate && endDate) {
      conditions.push("date >= ? AND date <= ?");
      params.push(startDate, endDate);
    } else if (startDate) {
      conditions.push("date >= ?");
      params.push(startDate);
    } else if (endDate) {
      conditions.push("date <= ?");
      params.push(endDate);
    }
    if (categoryId) {
      conditions.push("category_id = ?");
      params.push(categoryId);
    }
    if (done === "true") {
      conditions.push("done = 1");
    } else if (done === "false") {
      conditions.push("done = 0");
    }
    const whereClause = conditions.join(" AND ");
    const countRes = await DB.prepare(
      `SELECT COUNT(*) as total FROM todos WHERE ${whereClause}`
    ).bind(...params).first();
    const { results } = await DB.prepare(
      `SELECT * FROM todos WHERE ${whereClause} ORDER BY date ASC, id ASC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();
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
      for (const tpl of templatesReq.results || []) {
        let templateForEngine = { ...tpl, exdates: tpl.exdates || "[]" };
        if (!isOccurrenceOnDate(templateForEngine, date)) continue;
        const newId = crypto.randomUUID();
        let parsedSubtasks = parseJsonField(tpl.subtasks);
        parsedSubtasks.forEach((st) => st.done = false);
        const newRecord = {
          ...tpl,
          id: newId,
          date,
          parent_id: tpl.parent_id,
          done: 0,
          deleted: 0,
          subtasks: parsedSubtasks,
          search_terms: []
        };
        recurringResults.push(newRecord);
        insertStmts.push(DB.prepare(
          "INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          newId,
          tpl.parent_id,
          date,
          tpl.text,
          tpl.time || "",
          tpl.priority || "low",
          tpl.desc || "",
          tpl.url || "",
          tpl.copy_text || "",
          JSON.stringify(parsedSubtasks),
          "[]",
          0,
          0,
          tpl.repeat_type || "none",
          tpl.repeat_custom || "",
          tpl.repeat_end || "",
          tpl.end_time || "",
          tpl.category_id || ""
        ));
      }
      if (insertStmts.length > 0) {
        for (let i = 0; i < insertStmts.length; i += 100) {
          await DB.batch(insertStmts.slice(i, i + 100));
        }
      }
    }
    const allResults = [...results || [], ...recurringResults];
    const formatted = allResults.map(formatTodo);
    return jsonResponse({
      success: true,
      data: formatted,
      pagination: {
        total: (countRes?.total || 0) + recurringResults.length,
        limit,
        offset
      }
    });
  }
  if (request.method === "POST") {
    const body = await request.json();
    const { date, text, time, priority, desc, url: url2, copyText, subtasks, searchTerms, repeatType, repeatEnd, endTime, categoryId } = body;
    if (!date || !text) {
      return apiError("date \u548C text \u4E3A\u5FC5\u586B\u9879", 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return apiError("date \u683C\u5F0F\u5E94\u4E3A YYYY-MM-DD", 400);
    }
    const id = crypto.randomUUID();
    const rptType = repeatType || "none";
    const catId = categoryId || "";
    const rEnd = repeatEnd || "";
    const eTime = endTime || "";
    const normPriority = normalizePriority(priority || "low");
    const normalizedSubtasks = (subtasks || []).map((s) => {
      if (typeof s === "string") return { text: s, done: false };
      if (s && typeof s === "object" && s.text) return s;
      return null;
    }).filter(Boolean);
    const normalizedSearchTerms = (searchTerms || []).map((w) => {
      if (typeof w === "string") return { text: w, done: false };
      if (w && typeof w === "object" && w.text) return w;
      return null;
    }).filter(Boolean);
    const subtasksStr = JSON.stringify(normalizedSubtasks);
    const searchTermsStr = JSON.stringify(normalizedSearchTerms);
    await DB.prepare(
      "INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      id,
      id,
      date,
      text,
      time || "",
      normPriority,
      desc || "",
      url2 || "",
      copyText || "",
      subtasksStr,
      searchTermsStr,
      0,
      0,
      rptType,
      "",
      rEnd,
      eTime,
      catId
    ).run();
    if (rptType !== "none") {
      await DB.prepare(
        "INSERT INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        id,
        text,
        time || "",
        normPriority,
        desc || "",
        url2 || "",
        copyText || "",
        subtasksStr,
        searchTermsStr,
        rptType,
        "",
        rEnd,
        eTime,
        date,
        "[]",
        catId
      ).run();
    }
    return jsonResponse({
      success: true,
      data: { id, date, text, repeatType: rptType, categoryId: catId }
    }, 201);
  }
  return apiError("Method Not Allowed", 405);
}
__name(handleV1Todos, "handleV1Todos");
async function handleV1TodoGet(DB, todoId) {
  const row = await DB.prepare("SELECT * FROM todos WHERE id = ?").bind(todoId).first();
  if (!row) return apiError("Todo \u4E0D\u5B58\u5728", 404);
  return jsonResponse({ success: true, data: formatTodo(row) });
}
__name(handleV1TodoGet, "handleV1TodoGet");
async function handleV1TodoPut(request, DB, todoId) {
  const existing = await DB.prepare("SELECT * FROM todos WHERE id = ?").bind(todoId).first();
  if (!existing) return apiError("Todo \u4E0D\u5B58\u5728", 404);
  const body = await request.json();
  const parentId = existing.parent_id;
  const isSeries = existing.repeat_type && existing.repeat_type !== "none" && parentId && parentId !== existing.id;
  const scope = isSeries && (!body.scope || body.scope === "none") ? "this" : body.scope || "none";
  const newValues = {
    text: body.text !== void 0 ? body.text : existing.text,
    time: body.time !== void 0 ? body.time : existing.time || "",
    priority: body.priority !== void 0 ? normalizePriority(body.priority) : normalizePriority(existing.priority || "low"),
    desc: body.desc !== void 0 ? body.desc : existing.desc || "",
    url: body.url !== void 0 ? body.url : existing.url || "",
    copyText: body.copyText !== void 0 ? body.copyText : existing.copy_text || "",
    subtasks: JSON.stringify(body.subtasks !== void 0 ? body.subtasks : parseJsonField(existing.subtasks)),
    search_terms: JSON.stringify(body.searchTerms !== void 0 ? body.searchTerms : parseJsonField(existing.search_terms)),
    repeat_type: body.repeatType !== void 0 ? body.repeatType : existing.repeat_type || "none",
    repeat_custom: "",
    repeat_end: body.repeatEnd !== void 0 ? body.repeatEnd : existing.repeat_end || "",
    end_time: body.endTime !== void 0 ? body.endTime : existing.end_time || "",
    category_id: body.categoryId !== void 0 ? body.categoryId : existing.category_id || "",
    date: body.date !== void 0 ? body.date : existing.date
  };
  const date = existing.date;
  const rptType = newValues.repeat_type;
  const subtasksStr = newValues.subtasks;
  const searchTermsStr = newValues.search_terms;
  const newDate = newValues.date;
  const dateChanged = newDate !== date;
  if (!isSeries || !scope || scope === "none") {
    if (rptType !== "none") {
      await DB.prepare(
        "UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?"
      ).bind(newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, "", newValues.repeat_end, newValues.end_time, newValues.category_id, todoId).run();
      await DB.prepare(
        "INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(todoId, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, "", newValues.repeat_end, newValues.end_time, newDate, "[]", newValues.category_id).run();
    } else if (parentId && parentId !== todoId) {
      await DB.prepare(
        "UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type='none', repeat_custom='', repeat_end='', end_time=?, category_id=? WHERE id=?"
      ).bind(todoId, newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, newValues.end_time, newValues.category_id, todoId).run();
      const tpl = await DB.prepare("SELECT exdates FROM todo_templates WHERE parent_id = ?").bind(parentId).first();
      if (tpl) {
        const newExdates = addExdate(tpl.exdates || "[]", date);
        await DB.prepare("UPDATE todo_templates SET exdates = ? WHERE parent_id = ?").bind(newExdates, parentId).run();
      }
    } else {
      await DB.prepare(
        "UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?"
      ).bind(newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, "", newValues.repeat_end, newValues.end_time, newValues.category_id, todoId).run();
    }
  } else {
    const actions = computeUpdateActions({ task: { ...existing, parentId, isSeries }, date, scope, newValues });
    if (actions.currentTodo) {
      const cv = actions.currentTodo;
      if (cv.detachFromSeries) {
        if (cv.newSeries) {
          await DB.prepare(
            "UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?"
          ).bind(todoId, newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, "", newValues.repeat_end, newValues.end_time, newValues.category_id, todoId).run();
          await DB.prepare(
            "INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(todoId, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, "", newValues.repeat_end, newValues.end_time, newDate, "[]", newValues.category_id).run();
        } else {
          await DB.prepare(
            "UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type='none', repeat_custom='', repeat_end='', end_time=?, category_id=? WHERE id=?"
          ).bind(todoId, newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, newValues.end_time, newValues.category_id, todoId).run();
        }
      } else if (cv.isRecurring) {
        await DB.prepare(
          "UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?"
        ).bind(newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, "", newValues.repeat_end, newValues.end_time, newValues.category_id, todoId).run();
      } else {
        await DB.prepare(
          "UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type='none', repeat_custom='', repeat_end='', category_id=? WHERE id=?"
        ).bind(newDate, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, newValues.category_id, todoId).run();
      }
    }
    if (actions.pastTodos) {
      const pt = actions.pastTodos;
      if (pt.type === "set_repeat_end") {
        const prevDate = getPreviousDate(date);
        await DB.prepare(
          "UPDATE todos SET repeat_end=? WHERE parent_id=? AND date < ? AND repeat_type != 'none' AND (repeat_end = '' OR repeat_end IS NULL) AND deleted = 0"
        ).bind(prevDate, parentId, date).run();
      }
    }
    if (scope === "thisAndFuture") {
      if (rptType !== "none") {
        if (dateChanged) {
          await DB.prepare("DELETE FROM todos WHERE parent_id=? AND id != ? AND date >= ? AND deleted = 0").bind(parentId, todoId, date).run();
        } else {
          await DB.prepare(
            "UPDATE todos SET text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE parent_id=? AND id != ? AND date >= ? AND deleted = 0"
          ).bind(newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, "", newValues.repeat_end, newValues.end_time, newValues.category_id, parentId, todoId, date).run();
        }
      } else {
        await DB.prepare("DELETE FROM todos WHERE parent_id=? AND id != ? AND date > ? AND deleted = 0").bind(parentId, todoId, date).run();
      }
    } else if (scope === "all") {
      if (rptType !== "none") {
        if (dateChanged) {
          await DB.prepare("DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0").bind(parentId, todoId).run();
        } else {
          await DB.prepare(
            "UPDATE todos SET text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE parent_id=? AND id != ? AND deleted = 0"
          ).bind(newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, "", newValues.repeat_end, newValues.end_time, newValues.category_id, parentId, todoId).run();
        }
      } else {
        await DB.prepare("DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0").bind(parentId, todoId).run();
      }
    }
    if (actions.template) {
      const tmpl = actions.template;
      if (tmpl.type === "add_exdate") {
        const tpl = await DB.prepare("SELECT exdates FROM todo_templates WHERE parent_id = ?").bind(parentId).first();
        if (tpl) {
          const newExdates = addExdate(tpl.exdates || "[]", date);
          await DB.prepare("UPDATE todo_templates SET exdates = ? WHERE parent_id = ?").bind(newExdates, parentId).run();
        }
      } else if (tmpl.type === "set_repeat_end") {
        const prevDate = getPreviousDate(date);
        await DB.prepare("UPDATE todo_templates SET repeat_end=? WHERE parent_id=?").bind(prevDate, parentId).run();
      } else if (tmpl.type === "update_from_date" || tmpl.type === "update_all") {
        if (rptType !== "none") {
          let existingExdates = "[]";
          try {
            const existingTpl = await DB.prepare("SELECT exdates FROM todo_templates WHERE parent_id = ?").bind(parentId).first();
            if (existingTpl) existingExdates = existingTpl.exdates || "[]";
          } catch (e) {
          }
          await DB.prepare(
            "INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(parentId, newValues.text, newValues.time, newValues.priority, newValues.desc, newValues.url, newValues.copyText, subtasksStr, searchTermsStr, rptType, "", newValues.repeat_end, newValues.end_time, newDate, existingExdates, newValues.category_id).run();
        }
      } else if (tmpl.type === "delete") {
        await DB.prepare("DELETE FROM todo_templates WHERE parent_id=?").bind(parentId).run();
      }
    }
  }
  const updated = await DB.prepare("SELECT * FROM todos WHERE id = ?").bind(todoId).first();
  return jsonResponse({ success: true, data: formatTodo(updated) });
}
__name(handleV1TodoPut, "handleV1TodoPut");
async function handleV1TodoDelete(DB, todoId, scope) {
  const existing = await DB.prepare("SELECT * FROM todos WHERE id = ?").bind(todoId).first();
  if (!existing) return apiError("Todo \u4E0D\u5B58\u5728", 404);
  const parentId = existing.parent_id;
  const isSeries = existing.repeat_type && existing.repeat_type !== "none" && parentId && parentId !== todoId;
  const date = existing.date;
  const effectiveScope = isSeries && !scope ? "this" : scope;
  if (!isSeries || !effectiveScope) {
    await DB.prepare("UPDATE todos SET deleted = 1 WHERE id = ?").bind(todoId).run();
  } else {
    const actions = computeDeleteActions({ task: { ...existing, parentId, isSeries }, date, scope: effectiveScope });
    if (actions.deleteTodoIds && actions.deleteTodoIds.length > 0) {
      for (const id of actions.deleteTodoIds) {
        await DB.prepare("UPDATE todos SET deleted = 1 WHERE id = ?").bind(id).run();
      }
    }
    if (actions.updateTemplate) {
      const tmpl = actions.updateTemplate;
      if (tmpl.type === "add_exdate") {
        const tpl = await DB.prepare("SELECT exdates FROM todo_templates WHERE parent_id = ?").bind(parentId).first();
        if (tpl) {
          const newExdates = addExdate(tpl.exdates || "[]", date);
          await DB.prepare("UPDATE todo_templates SET exdates = ? WHERE parent_id = ?").bind(newExdates, parentId).run();
        }
      } else if (tmpl.type === "set_repeat_end") {
        const prevDate = getPreviousDate(date);
        if (tmpl.alsoDeleteFuture) {
          await DB.prepare("UPDATE todos SET deleted = 1 WHERE parent_id=? AND date >= ?").bind(parentId, date).run();
        }
        await DB.prepare("UPDATE todos SET repeat_end=? WHERE parent_id=? AND date < ? AND repeat_type != 'none'").bind(prevDate, parentId, date).run();
        await DB.prepare("UPDATE todo_templates SET repeat_end=? WHERE parent_id=?").bind(prevDate, parentId).run();
      } else if (tmpl.type === "delete_all") {
        await DB.prepare("UPDATE todos SET deleted = 1 WHERE parent_id=?").bind(parentId).run();
        await DB.prepare("DELETE FROM todo_templates WHERE parent_id=?").bind(parentId).run();
      }
    }
    if (actions.deleteTemplate) {
      await DB.prepare("DELETE FROM todo_templates WHERE parent_id=?").bind(parentId).run();
    }
  }
  return jsonResponse({ success: true });
}
__name(handleV1TodoDelete, "handleV1TodoDelete");
async function handleV1TodoToggle(DB, todoId) {
  const existing = await DB.prepare("SELECT done FROM todos WHERE id = ?").bind(todoId).first();
  if (!existing) return apiError("Todo \u4E0D\u5B58\u5728", 404);
  const newDone = existing.done ? 0 : 1;
  await DB.prepare("UPDATE todos SET done = ? WHERE id = ?").bind(newDone, todoId).run();
  return jsonResponse({ success: true, data: { id: todoId, done: !!newDone } });
}
__name(handleV1TodoToggle, "handleV1TodoToggle");
async function handleV1Categories(request, env, url) {
  const DB = env.DB;
  if (request.method === "GET") {
    const { results } = await DB.prepare("SELECT id, name, color FROM categories ORDER BY id").all();
    return jsonResponse({ success: true, data: (results || []).map(formatCategory) });
  }
  if (request.method === "POST") {
    const { name, color } = await request.json();
    if (!name || !name.trim()) return apiError("name \u4E3A\u5FC5\u586B\u9879", 400);
    const existing = await DB.prepare("SELECT id FROM categories WHERE LOWER(name) = ?").bind(name.trim().toLowerCase()).first();
    if (existing) return apiError("\u5206\u7C7B\u540D\u79F0\u5DF2\u5B58\u5728", 400);
    const id = Date.now().toString() + Math.random().toString().slice(2, 6);
    const catColor = color && color.trim() ? color.trim() : DEFAULT_CATEGORY_COLOR;
    await DB.prepare("INSERT INTO categories (id, name, color) VALUES (?, ?, ?)").bind(id, name.trim(), catColor).run();
    return jsonResponse({ success: true, data: { id, name: name.trim(), color: catColor } }, 201);
  }
  return apiError("Method Not Allowed", 405);
}
__name(handleV1Categories, "handleV1Categories");
async function handleV1CategoryGet(DB, catId) {
  const row = await DB.prepare("SELECT id, name, color FROM categories WHERE id = ?").bind(catId).first();
  if (!row) return apiError("\u5206\u7C7B\u4E0D\u5B58\u5728", 404);
  return jsonResponse({ success: true, data: formatCategory(row) });
}
__name(handleV1CategoryGet, "handleV1CategoryGet");
async function handleV1CategoryPut(request, DB, catId) {
  const existing = await DB.prepare("SELECT id FROM categories WHERE id = ?").bind(catId).first();
  if (!existing) return apiError("\u5206\u7C7B\u4E0D\u5B58\u5728", 404);
  const body = await request.json();
  const sets = [];
  const vals = [];
  if (body.name !== void 0 && body.name.trim()) {
    const dup = await DB.prepare("SELECT id FROM categories WHERE LOWER(name) = ? AND id != ?").bind(body.name.trim().toLowerCase(), catId).first();
    if (dup) return apiError("\u5206\u7C7B\u540D\u79F0\u5DF2\u5B58\u5728", 400);
    sets.push("name = ?");
    vals.push(body.name.trim());
  }
  if (body.color !== void 0 && body.color.trim()) {
    sets.push("color = ?");
    vals.push(body.color.trim());
  }
  if (sets.length > 0) {
    vals.push(catId);
    await DB.prepare(`UPDATE categories SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  }
  const updated = await DB.prepare("SELECT id, name, color FROM categories WHERE id = ?").bind(catId).first();
  return jsonResponse({ success: true, data: formatCategory(updated) });
}
__name(handleV1CategoryPut, "handleV1CategoryPut");
async function handleV1CategoryDelete(DB, catId) {
  const existing = await DB.prepare("SELECT id FROM categories WHERE id = ?").bind(catId).first();
  if (!existing) return apiError("\u5206\u7C7B\u4E0D\u5B58\u5728", 404);
  await DB.batch([
    DB.prepare("DELETE FROM categories WHERE id = ?").bind(catId),
    DB.prepare("UPDATE todos SET category_id = '' WHERE category_id = ?").bind(catId),
    DB.prepare("UPDATE todo_templates SET category_id = '' WHERE category_id = ?").bind(catId)
  ]);
  return jsonResponse({ success: true });
}
__name(handleV1CategoryDelete, "handleV1CategoryDelete");
async function handleV1TodoBatch(request, DB) {
  const { action, ids, doneStatus } = await request.json();
  if (action === "BATCH_TOGGLE_DONE") {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError("ids \u4E3A\u5FC5\u586B\u6570\u7EC4", 400);
    if (ids.length > 100) return apiError("\u5355\u6B21\u6700\u591A100\u6761", 400);
    const placeholders = ids.map(() => "?").join(",");
    await DB.prepare(`UPDATE todos SET done = ? WHERE id IN (${placeholders})`).bind(doneStatus ? 1 : 0, ...ids).run();
    return jsonResponse({ success: true, data: { affected: ids.length, done: !!doneStatus } });
  }
  if (action === "BATCH_DELETE") {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError("ids \u4E3A\u5FC5\u586B\u6570\u7EC4", 400);
    if (ids.length > 100) return apiError("\u5355\u6B21\u6700\u591A100\u6761", 400);
    const placeholders = ids.map(() => "?").join(",");
    const tasks = await DB.prepare(`SELECT parent_id, date, repeat_type FROM todos WHERE id IN (${placeholders})`).bind(...ids).all();
    await DB.prepare(`UPDATE todos SET deleted = 1 WHERE id IN (${placeholders})`).bind(...ids).run();
    const exdateUpdates = {};
    for (const t of tasks.results || []) {
      if (t.repeat_type && t.repeat_type !== "none" && t.parent_id) {
        if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
        exdateUpdates[t.parent_id].push(t.date);
      }
    }
    for (const pid of Object.keys(exdateUpdates)) {
      const tpl = await DB.prepare("SELECT exdates FROM todo_templates WHERE parent_id = ?").bind(pid).first();
      if (tpl) {
        let currentExdates = tpl.exdates || "[]";
        let changed = false;
        for (const d of exdateUpdates[pid]) {
          const newExdates = addExdate(currentExdates, d);
          if (newExdates !== currentExdates) {
            currentExdates = newExdates;
            changed = true;
          }
        }
        if (changed) await DB.prepare("UPDATE todo_templates SET exdates = ? WHERE parent_id = ?").bind(currentExdates, pid).run();
      }
    }
    return jsonResponse({ success: true, data: { affected: ids.length } });
  }
  return apiError("\u672A\u77E5\u64CD\u4F5C\uFF0C\u53EF\u7528: BATCH_TOGGLE_DONE, BATCH_DELETE", 400);
}
__name(handleV1TodoBatch, "handleV1TodoBatch");
async function handleV1TrashList(DB, url) {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 1), 500);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
  const { results } = await DB.prepare("SELECT * FROM todos WHERE deleted = 1 ORDER BY date DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
  const countRes = await DB.prepare("SELECT COUNT(*) as total FROM todos WHERE deleted = 1").first();
  return jsonResponse({
    success: true,
    data: (results || []).map(formatTodo),
    pagination: { total: countRes?.total || 0, limit, offset }
  });
}
__name(handleV1TrashList, "handleV1TrashList");
async function handleV1TrashAction(request, DB) {
  const { action, id, ids } = await request.json();
  if (action === "RESTORE") {
    if (!id) return apiError("\u7F3A\u5C11 id", 400);
    const t = await DB.prepare("SELECT parent_id, date, repeat_type, repeat_end FROM todos WHERE id = ?").bind(id).first();
    if (!t) return apiError("\u5F85\u529E\u4E0D\u5B58\u5728", 404);
    await DB.prepare("UPDATE todos SET deleted = 0 WHERE id = ?").bind(id).run();
    if (t.repeat_type && t.repeat_type !== "none" && t.parent_id) {
      const existing = await DB.prepare(
        "SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 AND id != ? LIMIT 1"
      ).bind(t.parent_id, t.date, id).first();
      if (existing) {
        await DB.prepare("UPDATE todos SET parent_id=?, repeat_type='none', repeat_custom='', repeat_end='' WHERE id=?").bind(id, id).run();
      } else if (t.repeat_end && t.repeat_end !== "") {
        const tpl2 = await DB.prepare("SELECT repeat_end FROM todo_templates WHERE parent_id = ?").bind(t.parent_id).first();
        if (tpl2 && tpl2.repeat_end && tpl2.repeat_end < t.date) {
          await DB.prepare("UPDATE todos SET parent_id=?, repeat_type='none', repeat_custom='', repeat_end='' WHERE id=?").bind(id, id).run();
        } else {
          await DB.prepare("UPDATE todos SET repeat_end='' WHERE id=?").bind(id).run();
        }
      }
      const tpl = await DB.prepare("SELECT exdates FROM todo_templates WHERE parent_id = ?").bind(t.parent_id).first();
      if (tpl) {
        const newExdates = removeExdate(tpl.exdates || "[]", t.date);
        await DB.prepare("UPDATE todo_templates SET exdates = ? WHERE parent_id = ?").bind(newExdates, t.parent_id).run();
      } else if (!tpl && t.repeat_type && t.repeat_type !== "none") {
        const task = await DB.prepare("SELECT text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, end_time, category_id FROM todos WHERE id=?").bind(id).first();
        if (task) {
          await DB.prepare(
            "INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
          ).bind(t.parent_id, task.text, task.time, task.priority, task.desc, task.url, task.copy_text, task.subtasks, task.search_terms, task.repeat_type, task.repeat_custom || "", "", task.end_time, t.date, "[]", task.category_id).run();
        }
      }
    }
    return jsonResponse({ success: true });
  }
  if (action === "DELETE_PERMANENT") {
    if (!id) return apiError("\u7F3A\u5C11 id", 400);
    await DB.prepare("DELETE FROM todos WHERE id = ?").bind(id).run();
    return jsonResponse({ success: true });
  }
  if (action === "CLEAR_ALL") {
    await DB.prepare("DELETE FROM todos WHERE deleted = 1").run();
    return jsonResponse({ success: true });
  }
  if (action === "CLEAR_ALL_DATA") {
    await DB.batch([
      DB.prepare("DELETE FROM todos"),
      DB.prepare("DELETE FROM todo_templates"),
      DB.prepare("DELETE FROM settings"),
      DB.prepare("DELETE FROM categories")
    ]);
    return jsonResponse({ success: true });
  }
  if (action === "BATCH_RESTORE") {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError("ids \u4E3A\u5FC5\u586B\u6570\u7EC4", 400);
    const placeholders = ids.map(() => "?").join(",");
    const tasks = await DB.prepare(`SELECT id, parent_id, date, repeat_type, repeat_end FROM todos WHERE id IN (${placeholders})`).bind(...ids).all();
    await DB.prepare(`UPDATE todos SET deleted = 0 WHERE id IN (${placeholders})`).bind(...ids).run();
    const reviveIds = [];
    const detachIds = [];
    for (const t of tasks.results || []) {
      if (t.repeat_type && t.repeat_type !== "none" && t.repeat_end && t.repeat_end !== "") {
        const existing = await DB.prepare("SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 AND id != ? LIMIT 1").bind(t.parent_id, t.date, t.id).first();
        if (existing) {
          detachIds.push(t.id);
        } else {
          const tpl = await DB.prepare("SELECT repeat_end FROM todo_templates WHERE parent_id = ?").bind(t.parent_id).first();
          if (tpl && tpl.repeat_end && tpl.repeat_end < t.date) {
            detachIds.push(t.id);
          } else {
            reviveIds.push(t.id);
          }
        }
      }
    }
    if (reviveIds.length > 0) {
      const ph = reviveIds.map(() => "?").join(",");
      await DB.prepare(`UPDATE todos SET repeat_end='' WHERE id IN (${ph})`).bind(...reviveIds).run();
    }
    if (detachIds.length > 0) {
      const ph = detachIds.map(() => "?").join(",");
      await DB.prepare(`UPDATE todos SET parent_id=id, repeat_type='none', repeat_custom='', repeat_end='' WHERE id IN (${ph})`).bind(...detachIds).run();
    }
    const exdateUpdates = {};
    for (const t of tasks.results || []) {
      if (t.repeat_type && t.repeat_type !== "none" && t.parent_id) {
        if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
        exdateUpdates[t.parent_id].push(t.date);
      }
    }
    for (const pid of Object.keys(exdateUpdates)) {
      const tpl = await DB.prepare("SELECT exdates FROM todo_templates WHERE parent_id = ?").bind(pid).first();
      if (tpl) {
        let currentExdates = tpl.exdates || "[]";
        let changed = false;
        for (const d of exdateUpdates[pid]) {
          const newExdates = removeExdate(currentExdates, d);
          if (newExdates !== currentExdates) {
            currentExdates = newExdates;
            changed = true;
          }
        }
        if (changed) await DB.prepare("UPDATE todo_templates SET exdates = ? WHERE parent_id = ?").bind(currentExdates, pid).run();
      }
    }
    return jsonResponse({ success: true, data: { restored: ids.length } });
  }
  if (action === "BATCH_DELETE_PERMANENT") {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError("ids \u4E3A\u5FC5\u586B\u6570\u7EC4", 400);
    const placeholders = ids.map(() => "?").join(",");
    await DB.prepare(`DELETE FROM todos WHERE id IN (${placeholders})`).bind(...ids).run();
    return jsonResponse({ success: true, data: { deleted: ids.length } });
  }
  return apiError("\u672A\u77E5\u64CD\u4F5C\uFF0C\u53EF\u7528: RESTORE, DELETE_PERMANENT, CLEAR_ALL, CLEAR_ALL_DATA, BATCH_RESTORE, BATCH_DELETE_PERMANENT", 400);
}
__name(handleV1TrashAction, "handleV1TrashAction");
async function handleV1Stats(DB, url) {
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end) return apiError("start \u548C end \u4E3A\u5FC5\u586B\u53C2\u6570 (YYYY-MM-DD)", 400);
  const { results } = await DB.prepare(
    "SELECT date, priority, done FROM todos WHERE date >= ? AND date <= ? AND deleted = 0"
  ).bind(start, end).all();
  const stats2 = {
    total: results.length,
    done: results.filter((r) => r.done).length,
    undone: results.filter((r) => !r.done).length,
    byPriority: {
      low: results.filter((r) => r.priority === "low").length,
      med: results.filter((r) => r.priority === "med").length,
      high: results.filter((r) => r.priority === "high").length
    },
    byDate: {}
  };
  for (const r of results) {
    if (!stats2.byDate[r.date]) stats2.byDate[r.date] = { total: 0, done: 0 };
    stats2.byDate[r.date].total++;
    if (r.done) stats2.byDate[r.date].done++;
  }
  return jsonResponse({ success: true, data: stats2 });
}
__name(handleV1Stats, "handleV1Stats");
async function handleV1CategoryBatch(request, DB) {
  const { action, ids } = await request.json();
  if (action === "BATCH_DELETE") {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return apiError("ids \u4E3A\u5FC5\u586B\u6570\u7EC4", 400);
    const placeholders = ids.map(() => "?").join(",");
    await DB.batch([
      DB.prepare(`DELETE FROM categories WHERE id IN (${placeholders})`).bind(...ids),
      DB.prepare(`UPDATE todos SET category_id = '' WHERE category_id IN (${placeholders})`).bind(...ids),
      DB.prepare(`UPDATE todo_templates SET category_id = '' WHERE category_id IN (${placeholders})`).bind(...ids)
    ]);
    return jsonResponse({ success: true, data: { deleted: ids.length } });
  }
  return apiError("\u672A\u77E5\u64CD\u4F5C\uFF0C\u53EF\u7528: BATCH_DELETE", 400);
}
__name(handleV1CategoryBatch, "handleV1CategoryBatch");
async function handleV1SettingsGet(DB) {
  const record = await DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
  let settingsObj = {};
  if (record && record.value) {
    try {
      settingsObj = JSON.parse(record.value);
    } catch (e) {
    }
  }
  return jsonResponse({ success: true, data: settingsObj });
}
__name(handleV1SettingsGet, "handleV1SettingsGet");
async function handleV1SettingsPost(request, DB) {
  const data = await request.json();
  await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)").bind(JSON.stringify(data)).run();
  return jsonResponse({ success: true });
}
__name(handleV1SettingsPost, "handleV1SettingsPost");
async function handleV1CustomCodeGet(DB) {
  const headerRecord = await DB.prepare("SELECT value FROM settings WHERE key = 'custom_header'").first();
  const contentRecord = await DB.prepare("SELECT value FROM settings WHERE key = 'custom_content'").first();
  return jsonResponse({
    success: true,
    data: {
      customHeader: headerRecord?.value || "",
      customContent: contentRecord?.value || ""
    }
  });
}
__name(handleV1CustomCodeGet, "handleV1CustomCodeGet");
async function handleV1CustomCodePost(request, DB) {
  const { customHeader, customContent } = await request.json();
  const stmts = [];
  if (customHeader !== void 0) {
    stmts.push(DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_header', ?)").bind(customHeader));
  }
  if (customContent !== void 0) {
    stmts.push(DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_content', ?)").bind(customContent));
  }
  if (stmts.length > 0) {
    await DB.batch(stmts);
  }
  return jsonResponse({ success: true });
}
__name(handleV1CustomCodePost, "handleV1CustomCodePost");
async function handleV1CustomHeaderGet(DB) {
  const record = await DB.prepare("SELECT value FROM settings WHERE key = 'custom_header'").first();
  return new Response(record?.value || "", { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}
__name(handleV1CustomHeaderGet, "handleV1CustomHeaderGet");
async function handleV1CustomContentGet(DB) {
  const record = await DB.prepare("SELECT value FROM settings WHERE key = 'custom_content'").first();
  return new Response(record?.value || "", { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}
__name(handleV1CustomContentGet, "handleV1CustomContentGet");
async function handleV1CustomColorsGet(DB) {
  const record = await DB.prepare("SELECT value FROM settings WHERE key = 'customColors'").first();
  let customColors = [];
  if (record && record.value) {
    try {
      customColors = JSON.parse(record.value);
    } catch (e) {
    }
  }
  return jsonResponse({ success: true, data: customColors });
}
__name(handleV1CustomColorsGet, "handleV1CustomColorsGet");
async function handleV1CustomColorsPost(request, DB) {
  const { colors } = await request.json();
  if (!Array.isArray(colors)) {
    return apiError("colors \u5FC5\u987B\u4E3A\u6570\u7EC4", 400);
  }
  await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('customColors', ?)").bind(JSON.stringify(colors)).run();
  return jsonResponse({ success: true, data: colors });
}
__name(handleV1CustomColorsPost, "handleV1CustomColorsPost");
async function handleV1TodoSubtasks(request, DB, todoId) {
  const { subtasks } = await request.json();
  if (!Array.isArray(subtasks)) return apiError("subtasks \u5FC5\u987B\u4E3A\u6570\u7EC4", 400);
  const existing = await DB.prepare("SELECT id FROM todos WHERE id = ?").bind(todoId).first();
  if (!existing) return apiError("\u5F85\u529E\u4E0D\u5B58\u5728", 404);
  await DB.prepare("UPDATE todos SET subtasks = ? WHERE id = ?").bind(JSON.stringify(subtasks), todoId).run();
  return jsonResponse({ success: true });
}
__name(handleV1TodoSubtasks, "handleV1TodoSubtasks");
async function handleV1TodoSearchTerms(request, DB, todoId) {
  const { searchTerms } = await request.json();
  if (!Array.isArray(searchTerms)) return apiError("searchTerms \u5FC5\u987B\u4E3A\u6570\u7EC4", 400);
  const existing = await DB.prepare("SELECT id FROM todos WHERE id = ?").bind(todoId).first();
  if (!existing) return apiError("\u5F85\u529E\u4E0D\u5B58\u5728", 404);
  await DB.prepare("UPDATE todos SET search_terms = ? WHERE id = ?").bind(JSON.stringify(searchTerms), todoId).run();
  return jsonResponse({ success: true });
}
__name(handleV1TodoSearchTerms, "handleV1TodoSearchTerms");
async function handleV1Request(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/api/v1/keys") {
    return handleApiKeys(request, env, url);
  }
  const apiKey = extractApiKey(request, url);
  if (apiKey) {
    const valid = await verifyApiKey(env.DB, apiKey, env.JWT_SECRET);
    if (!valid) return apiError("Invalid API Key", 401);
    ctx.waitUntil(touchApiKeyLastUsed(env.DB, apiKey));
  } else {
    const authErr = await verifyCookieAuth(request, env);
    if (authErr) return authErr;
  }
  if (path === "/api/v1/todos") {
    return handleV1Todos(request, env, url);
  }
  if (path === "/api/v1/todos/batch" && request.method === "POST") {
    return handleV1TodoBatch(request, env.DB);
  }
  const todoMatch = path.match(/^\/api\/v1\/todos\/([a-zA-Z0-9_-]+)$/);
  if (todoMatch) {
    const todoId = todoMatch[1];
    if (request.method === "GET") return handleV1TodoGet(env.DB, todoId);
    if (request.method === "PUT") return handleV1TodoPut(request, env.DB, todoId);
    if (request.method === "DELETE") {
      const scope = url.searchParams.get("scope") || void 0;
      return handleV1TodoDelete(env.DB, todoId, scope);
    }
    return apiError("Method Not Allowed", 405);
  }
  const toggleMatch = path.match(/^\/api\/v1\/todos\/([a-zA-Z0-9_-]+)\/toggle$/);
  if (toggleMatch && request.method === "PATCH") {
    return handleV1TodoToggle(env.DB, toggleMatch[1]);
  }
  const subtasksMatch = path.match(/^\/api\/v1\/todos\/([a-zA-Z0-9_-]+)\/subtasks$/);
  if (subtasksMatch && request.method === "PATCH") {
    return handleV1TodoSubtasks(request, env.DB, subtasksMatch[1]);
  }
  const searchTermsMatch = path.match(/^\/api\/v1\/todos\/([a-zA-Z0-9_-]+)\/search-terms$/);
  if (searchTermsMatch && request.method === "PATCH") {
    return handleV1TodoSearchTerms(request, env.DB, searchTermsMatch[1]);
  }
  if (path === "/api/v1/trash" && request.method === "GET") {
    return handleV1TrashList(env.DB, url);
  }
  if (path === "/api/v1/trash-action" && request.method === "POST") {
    return handleV1TrashAction(request, env.DB);
  }
  if (path === "/api/v1/stats" && request.method === "GET") {
    return handleV1Stats(env.DB, url);
  }
  if (path === "/api/v1/categories") {
    return handleV1Categories(request, env, url);
  }
  if (path === "/api/v1/categories/batch" && request.method === "POST") {
    return handleV1CategoryBatch(request, env.DB);
  }
  const catMatch = path.match(/^\/api\/v1\/categories\/([a-zA-Z0-9_.-]+)$/);
  if (catMatch) {
    const catId = catMatch[1];
    if (request.method === "GET") return handleV1CategoryGet(env.DB, catId);
    if (request.method === "PUT") return handleV1CategoryPut(request, env.DB, catId);
    if (request.method === "DELETE") return handleV1CategoryDelete(env.DB, catId);
    return apiError("Method Not Allowed", 405);
  }
  if (path === "/api/v1/settings") {
    if (request.method === "GET") return handleV1SettingsGet(env.DB);
    if (request.method === "POST") return handleV1SettingsPost(request, env.DB);
    return apiError("Method Not Allowed", 405);
  }
  if (path === "/api/v1/custom-code") {
    if (request.method === "GET") return handleV1CustomCodeGet(env.DB);
    if (request.method === "POST") return handleV1CustomCodePost(request, env.DB);
    return apiError("Method Not Allowed", 405);
  }
  if (path === "/api/v1/custom-header" && request.method === "GET") {
    return handleV1CustomHeaderGet(env.DB);
  }
  if (path === "/api/v1/custom-content" && request.method === "GET") {
    return handleV1CustomContentGet(env.DB);
  }
  if (path === "/api/v1/custom-colors") {
    if (request.method === "GET") return handleV1CustomColorsGet(env.DB);
    if (request.method === "POST") return handleV1CustomColorsPost(request, env.DB);
    return apiError("Method Not Allowed", 405);
  }
  return null;
}
__name(handleV1Request, "handleV1Request");

// src/api.js
var isDbInitialized = false;
async function handleRequest(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const cookies = parseCookies(request);
    const clientIp = request.headers.get("cf-connecting-ip") || "unknown";
    const isAuthorized = /* @__PURE__ */ __name(async () => {
      if (!cookies.auth_token || !cookies.auth_sig) return { ok: false };
      const sigValid = await verify(cookies.auth_token, cookies.auth_sig, env.JWT_SECRET);
      if (!sigValid) return { ok: false };
      const record = await env.DB.prepare(
        "SELECT value FROM settings WHERE key = 'active_session_token'"
      ).first();
      if (!record || !record.value) return { ok: false };
      let sessions;
      if (!record.value.startsWith("[")) {
        if (record.value !== cookies.auth_token) return { ok: false };
        sessions = [{ token: record.value, ua: "" }];
      } else {
        try {
          sessions = JSON.parse(record.value);
          if (!Array.isArray(sessions)) return { ok: false };
        } catch (e) {
          return { ok: false };
        }
      }
      const matched = sessions.find((s) => s.token === cookies.auth_token);
      if (!matched) return { ok: false };
      return { ok: true, matchedSession: matched, sessions };
    }, "isAuthorized");
    const initDb = /* @__PURE__ */ __name(async () => {
      if (isDbInitialized) return;
      try {
        let currentSchema = 0;
        try {
          const marker = await env.DB.prepare("SELECT value FROM settings WHERE key = 'db_schema_version'").first();
          if (marker && marker.value) currentSchema = parseInt(marker.value, 10) || 0;
        } catch (e) {
        }
        if (currentSchema >= DB_SCHEMA) {
          isDbInitialized = true;
          return;
        }
        await env.DB.batch([
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS todos (
              id TEXT PRIMARY KEY,
              parent_id TEXT NOT NULL,
              date TEXT NOT NULL,
              text TEXT NOT NULL,
              time TEXT,
              priority TEXT,
              desc TEXT,
              url TEXT,
              copy_text TEXT,
              subtasks TEXT,
              search_terms TEXT,
              done INTEGER NOT NULL DEFAULT 0,
              deleted INTEGER NOT NULL DEFAULT 0,
              repeat_type TEXT DEFAULT 'none',
              repeat_custom TEXT DEFAULT '',
              repeat_end TEXT DEFAULT '',
              end_time TEXT DEFAULT '',
              category_id TEXT DEFAULT '',
              recurrence_id TEXT DEFAULT '',
              is_exception INTEGER NOT NULL DEFAULT 0
            )
          `),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)`),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)`),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS todo_templates (
              parent_id TEXT PRIMARY KEY,
              text TEXT, time TEXT, priority TEXT, desc TEXT, url TEXT, 
              copy_text TEXT, subtasks TEXT, search_terms TEXT, 
              repeat_type TEXT, repeat_custom TEXT, repeat_end TEXT DEFAULT '', end_time TEXT DEFAULT '',
              anchor_date TEXT,
              exdates TEXT DEFAULT '[]',
              category_id TEXT DEFAULT ''
            )
          `),
          env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)`),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS login_attempts (
              ip TEXT PRIMARY KEY,
              attempts INTEGER NOT NULL DEFAULT 0,
              lock_until INTEGER NOT NULL DEFAULT 0
            )
          `),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT
            )
          `),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS import_sessions (
              id TEXT PRIMARY KEY,
              mode TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'active',
              started_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            )
          `),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS export_sessions (
              id TEXT PRIMARY KEY,
              status TEXT NOT NULL DEFAULT 'active',
              inc_todos INTEGER NOT NULL DEFAULT 0,
              inc_trash INTEGER NOT NULL DEFAULT 0,
              inc_settings INTEGER NOT NULL DEFAULT 0,
              total_todos INTEGER NOT NULL DEFAULT 0,
              total_templates INTEGER NOT NULL DEFAULT 0,
              todos_cursor TEXT NOT NULL DEFAULT '',
              templates_cursor TEXT NOT NULL DEFAULT '',
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            )
          `),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS categories (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              color TEXT NOT NULL DEFAULT '#888888'
            )
          `)
        ]);
        if (currentSchema < 1) {
          try {
            await env.DB.prepare(`ALTER TABLE export_sessions ADD COLUMN todos_cursor TEXT NOT NULL DEFAULT ''`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE export_sessions ADD COLUMN templates_cursor TEXT NOT NULL DEFAULT ''`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE todos ADD COLUMN copy_text TEXT`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE todos ADD COLUMN subtasks TEXT`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE todos ADD COLUMN search_terms TEXT`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE todos ADD COLUMN repeat_type TEXT DEFAULT 'none'`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE todos ADD COLUMN repeat_custom TEXT DEFAULT ''`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE todos ADD COLUMN repeat_end TEXT DEFAULT ''`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE todos ADD COLUMN end_time TEXT DEFAULT ''`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE todo_templates ADD COLUMN repeat_end TEXT DEFAULT ''`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE todo_templates ADD COLUMN end_time TEXT DEFAULT ''`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE todos ADD COLUMN category_id TEXT DEFAULT ''`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE todo_templates ADD COLUMN category_id TEXT DEFAULT ''`).run();
          } catch (e) {
          }
        }
        if (currentSchema < 2) {
          try {
            const c = await env.DB.prepare("SELECT COUNT(*) as c FROM todo_templates").first();
            if (c && c.c === 0) {
              await env.DB.prepare(`
                INSERT OR IGNORE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates)
                SELECT parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, 
                  CASE WHEN (repeat_type IS NULL OR repeat_type = 'none' OR repeat_type = '') THEN 'daily' ELSE repeat_type END,
                  repeat_custom, '', '', date, '[]'
                FROM todos t1
                WHERE repeat = 1 AND deleted = 0 
                AND date = (SELECT MAX(date) FROM todos t2 WHERE t2.parent_id = t1.parent_id AND t2.repeat = 1 AND t2.deleted = 0)
              `).run();
            }
          } catch (e) {
          }
        }
        if (currentSchema < 3) {
          try {
            await env.DB.prepare(`ALTER TABLE todos ADD COLUMN recurrence_id TEXT DEFAULT ''`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE todos ADD COLUMN is_exception INTEGER NOT NULL DEFAULT 0`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE todo_templates ADD COLUMN exdates TEXT DEFAULT '[]'`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`UPDATE todo_templates SET exdates = blacklist WHERE exdates = '[]' AND blacklist IS NOT NULL AND blacklist != '[]'`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE todo_templates DROP COLUMN blacklist`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`
              UPDATE todos SET repeat_type = COALESCE(
                (SELECT t.repeat_type FROM todo_templates t WHERE t.parent_id = todos.parent_id),
                'daily'
              ) WHERE repeat = -1 AND (repeat_type = 'none' OR repeat_type IS NULL OR repeat_type = '')
            `).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`UPDATE todos SET repeat_type = 'none' WHERE repeat = 0 AND repeat_type != 'none' AND repeat_type IS NOT NULL AND repeat_type != ''`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`UPDATE todos SET repeat_type = 'daily' WHERE repeat = 1 AND (repeat_type = 'none' OR repeat_type IS NULL OR repeat_type = '')`).run();
          } catch (e) {
          }
          try {
            await env.DB.prepare(`ALTER TABLE todos DROP COLUMN repeat`).run();
          } catch (e) {
          }
        }
        await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('db_schema_version', ?)").bind(String(DB_SCHEMA)).run();
        isDbInitialized = true;
      } catch (e) {
        console.error("DB Init error:", e);
      }
    }, "initDb");
    await initDb();
    const publicApiPaths = ["/api/login", "/api/logout", "/api/hot-search"];
    const isApiRequest = url.pathname.startsWith("/api/");
    const isV1Request = url.pathname.startsWith("/api/v1/");
    if (isApiRequest && !publicApiPaths.includes(url.pathname) && !isV1Request) {
      const apiKey = extractApiKey(request, url);
      if (apiKey) {
        const valid = await verifyApiKey(env.DB, apiKey, env.JWT_SECRET);
        if (!valid) return apiError("UNAUTHORIZED", 401);
      } else {
        const { ok: apiAuthed } = await isAuthorized();
        if (!apiAuthed) return apiError("UNAUTHORIZED", 401);
      }
    }
    if (isV1Request) {
      const v1Result = await handleV1Request(request, env, ctx);
      if (v1Result) return v1Result;
      return apiError("Not Found", 404);
    }
    if (url.pathname === "/api/login" && request.method === "POST") {
      const now = Date.now();
      const attemptRecord = await env.DB.prepare("SELECT * FROM login_attempts WHERE ip = ?").bind(clientIp).first();
      if (attemptRecord && attemptRecord.lock_until > now) {
        return apiError("ACCOUNT LOCKED", 429);
      }
      const { password } = await request.json();
      const isAdmin = await secureCompare(password, env.ADMIN_PASSWORD, env.JWT_SECRET);
      if (isAdmin) {
        await env.DB.prepare(`
          INSERT INTO login_attempts (ip, attempts, lock_until) VALUES (?, 0, 0) 
          ON CONFLICT(ip) DO UPDATE SET attempts = 0, lock_until = 0
        `).bind(clientIp).run();
        const loginUA = request.headers.get("User-Agent") || "";
        let sessions = [];
        const sessionRecord = await env.DB.prepare(
          "SELECT value FROM settings WHERE key = 'active_session_token'"
        ).first();
        if (sessionRecord && sessionRecord.value) {
          try {
            const parsed = JSON.parse(sessionRecord.value);
            if (Array.isArray(parsed)) sessions = parsed;
          } catch (e) {
            sessions = [];
          }
        }
        const token = generateSessionToken();
        const sig = await sign(token, env.JWT_SECRET);
        sessions = sessions.filter((s) => s.ua !== loginUA);
        sessions.push({ token, ua: loginUA });
        while (sessions.length > 3) sessions.shift();
        await env.DB.prepare(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_session_token', ?)"
        ).bind(JSON.stringify(sessions)).run();
        if (loginUA) {
          const appSettingsRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
          let appSettingsObj = {};
          if (appSettingsRecord && appSettingsRecord.value) {
            try {
              appSettingsObj = JSON.parse(appSettingsRecord.value);
            } catch (e) {
            }
          }
          if (!Array.isArray(appSettingsObj.scaleByBrowser)) {
            appSettingsObj.scaleByBrowser = [];
          }
          let uaExists = false;
          for (let i = 0; i < appSettingsObj.scaleByBrowser.length; i++) {
            if (appSettingsObj.scaleByBrowser[i].ua === loginUA) {
              uaExists = true;
              break;
            }
          }
          if (!uaExists) {
            appSettingsObj.scaleByBrowser.push({ ua: loginUA, scale: 1 });
            while (appSettingsObj.scaleByBrowser.length > 3) {
              appSettingsObj.scaleByBrowser.shift();
            }
            await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)").bind(JSON.stringify(appSettingsObj)).run();
          }
        }
        const headers = new Headers();
        headers.append("Set-Cookie", `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
        headers.append("Set-Cookie", `auth_sig=${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
        return new Response(JSON.stringify({ success: true }), { headers });
      } else {
        await env.DB.prepare(`
          INSERT INTO login_attempts (ip, attempts, lock_until) VALUES (?, 1, 0) 
          ON CONFLICT(ip) DO UPDATE SET 
            attempts = attempts + 1,
            lock_until = CASE WHEN attempts + 1 >= 5 THEN ? ELSE 0 END
        `).bind(clientIp, now + 15 * 60 * 1e3).run();
        return apiError("ACCESS DENIED", 401);
      }
    }
    if (url.pathname === "/api/logout" && request.method === "POST") {
      if (cookies.auth_token) {
        const record = await env.DB.prepare(
          "SELECT value FROM settings WHERE key = 'active_session_token'"
        ).first();
        if (record && record.value) {
          try {
            let sessions = [];
            try {
              const parsed = JSON.parse(record.value);
              if (Array.isArray(parsed)) sessions = parsed;
            } catch (e) {
            }
            if (sessions.length > 0) {
              sessions = sessions.filter((s) => s.token !== cookies.auth_token);
              if (sessions.length > 0) {
                await env.DB.prepare(
                  "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_session_token', ?)"
                ).bind(JSON.stringify(sessions)).run();
              } else {
                await env.DB.prepare(
                  "DELETE FROM settings WHERE key = 'active_session_token'"
                ).run();
              }
            }
          } catch (e) {
          }
        }
      }
      const headers = new Headers();
      headers.append("Set-Cookie", `auth_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
      headers.append("Set-Cookie", `auth_sig=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
      return new Response(JSON.stringify({ success: true }), { headers });
    }
    if (url.pathname === "/" && request.method === "GET") {
      const [authResult, settingsRecord] = await Promise.all([
        isAuthorized(),
        env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first()
      ]);
      const { ok: authorized, matchedSession, sessions: authSessions } = authResult;
      let customHeader = "";
      let customContent = "";
      let appSettingsObj = null;
      if (settingsRecord && settingsRecord.value) {
        try {
          appSettingsObj = JSON.parse(settingsRecord.value);
        } catch (e) {
        }
      }
      if (url.searchParams.get("preview") !== "1" && appSettingsObj && appSettingsObj.customCodeEnabled === true) {
        try {
          const customRecords = await env.DB.prepare(
            "SELECT key, value FROM settings WHERE key IN ('custom_header', 'custom_content')"
          ).all();
          if (customRecords.results) {
            for (const row of customRecords.results) {
              if (row.key === "custom_header" && row.value) customHeader = row.value;
              if (row.key === "custom_content" && row.value) customContent = row.value;
            }
          }
        } catch (e) {
        }
      }
      if (authorized && matchedSession) {
        const currentUA = request.headers.get("User-Agent") || "";
        if (currentUA && matchedSession.ua !== currentUA) {
          const oldUA = matchedSession.ua;
          matchedSession.ua = currentUA;
          const updatedSessions = authSessions.filter(
            (s) => s.token === matchedSession.token || s.ua !== currentUA
          );
          const batchStmts = [
            env.DB.prepare(
              "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_session_token', ?)"
            ).bind(JSON.stringify(updatedSessions))
          ];
          if (!appSettingsObj) appSettingsObj = {};
          if (!Array.isArray(appSettingsObj.scaleByBrowser)) {
            appSettingsObj.scaleByBrowser = [];
          }
          let replaced = false;
          for (let i = 0; i < appSettingsObj.scaleByBrowser.length; i++) {
            if (appSettingsObj.scaleByBrowser[i].ua === oldUA) {
              appSettingsObj.scaleByBrowser[i].ua = currentUA;
              replaced = true;
              break;
            }
          }
          if (!replaced) {
            appSettingsObj.scaleByBrowser.push({ ua: currentUA, scale: 1 });
          }
          let foundCurrentUA = false;
          appSettingsObj.scaleByBrowser = appSettingsObj.scaleByBrowser.filter((s) => {
            if (s.ua === currentUA) {
              if (!foundCurrentUA) {
                foundCurrentUA = true;
                return true;
              }
              return false;
            }
            return true;
          });
          while (appSettingsObj.scaleByBrowser.length > 3) {
            appSettingsObj.scaleByBrowser.shift();
          }
          batchStmts.push(
            env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)").bind(JSON.stringify(appSettingsObj))
          );
          await env.DB.batch(batchStmts);
        }
      }
      return new Response(renderHTML(authorized, customHeader, customContent), {
        headers: { "Content-Type": "text/html;charset=UTF-8" }
      });
    }
    if (url.pathname === "/api/sessions" && request.method === "GET") {
      const record = await env.DB.prepare(
        "SELECT value FROM settings WHERE key = 'active_session_token'"
      ).first();
      let sessions = [];
      if (record && record.value) {
        try {
          const parsed = JSON.parse(record.value);
          if (Array.isArray(parsed)) sessions = parsed;
        } catch (e) {
        }
      }
      const clientUA = request.headers.get("User-Agent") || "";
      const safeSessions = sessions.map((s) => ({
        ua: s.ua,
        disabled: s.disabled || false,
        isCurrent: s.ua === clientUA
      }));
      return new Response(JSON.stringify(safeSessions), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/session-action" && request.method === "POST") {
      const { action, ua } = await request.json();
      const record = await env.DB.prepare(
        "SELECT value FROM settings WHERE key = 'active_session_token'"
      ).first();
      let sessions = [];
      if (record && record.value) {
        try {
          const parsed = JSON.parse(record.value);
          if (Array.isArray(parsed)) sessions = parsed;
        } catch (e) {
        }
      }
      if (action === "DELETE" && ua) {
        sessions = sessions.filter((s) => s.ua !== ua);
      } else if (action === "DELETE_ALL") {
        sessions = [];
      }
      if (sessions.length > 0) {
        await env.DB.prepare(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_session_token', ?)"
        ).bind(JSON.stringify(sessions)).run();
      } else {
        await env.DB.prepare(
          "DELETE FROM settings WHERE key = 'active_session_token'"
        ).run();
      }
      if (action === "DELETE" || action === "DELETE_ALL") {
        try {
          const appSettingsRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
          if (appSettingsRecord && appSettingsRecord.value) {
            let appSettingsObj = JSON.parse(appSettingsRecord.value);
            if (Array.isArray(appSettingsObj.scaleByBrowser)) {
              const remainingUAs = sessions.map((s) => s.ua);
              if (action === "DELETE_ALL") {
                appSettingsObj.scaleByBrowser = [];
              } else {
                appSettingsObj.scaleByBrowser = appSettingsObj.scaleByBrowser.filter((item) => remainingUAs.includes(item.ua));
              }
              await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)").bind(JSON.stringify(appSettingsObj)).run();
            }
          }
        } catch (e) {
        }
      }
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/custom-code" && request.method === "GET") {
      const headerRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_header'").first();
      const contentRecord = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_content'").first();
      return new Response(JSON.stringify({
        customHeader: headerRecord?.value || "",
        customContent: contentRecord?.value || ""
      }), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/custom-code" && request.method === "POST") {
      const { customHeader, customContent } = await request.json();
      const stmts = [];
      if (customHeader !== void 0) {
        stmts.push(env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_header', ?)").bind(customHeader));
      }
      if (customContent !== void 0) {
        stmts.push(env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_content', ?)").bind(customContent));
      }
      if (stmts.length > 0) {
        await env.DB.batch(stmts);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/api/hot-search" && request.method === "GET") {
      const provider = url.searchParams.get("provider") || "auto";
      const allWords = await fetchHotSearchData(provider);
      return new Response(JSON.stringify({ success: true, data: allWords }), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/stats" && request.method === "GET") {
      const start = url.searchParams.get("start");
      const end = url.searchParams.get("end");
      if (!start || !end) return apiError("Date required", 400);
      const { results } = await env.DB.prepare(
        "SELECT date, priority, done FROM todos WHERE date >= ? AND date <= ? AND deleted = 0"
      ).bind(start, end).all();
      return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/export" && request.method === "GET") {
      const mode = url.searchParams.get("mode");
      if (mode === "page") {
        const type = url.searchParams.get("type") || "todos";
        const cursor = url.searchParams.get("cursor") || "";
        const sessionId = url.searchParams.get("sessionId") || "";
        const PAGE_SIZE = 500;
        const incTodos = url.searchParams.get("todos") === "true";
        const incTrash = url.searchParams.get("trash") === "true";
        let condition = "1=0";
        if (type === "todos") {
          if (incTodos && incTrash) condition = "1=1";
          else if (incTodos) condition = "deleted = 0";
          else if (incTrash) condition = "deleted = 1";
        } else {
          condition = "1=1";
        }
        const tableName = type === "templates" ? "todo_templates" : "todos";
        let cursorCondition = "";
        let cursorParams = [];
        if (cursor) {
          if (type === "todos") {
            const parts = cursor.split(":");
            const cursorDate = parts[0] || "";
            const cursorDeleted = parts[1] === "1" ? 1 : 0;
            const cursorId = parts.slice(2).join(":");
            cursorCondition = ` AND (date > ? OR (date = ? AND deleted > ?) OR (date = ? AND deleted = ? AND id > ?))`;
            cursorParams = [cursorDate, cursorDate, cursorDeleted, cursorDate, cursorDeleted, cursorId];
          } else {
            cursorCondition = ` AND parent_id > ?`;
            cursorParams = [cursor];
          }
        }
        const orderBy = type === "todos" ? "date ASC, deleted ASC, id ASC" : "parent_id ASC";
        const dataRes = await env.DB.prepare(
          `SELECT * FROM ${tableName} WHERE ${condition}${cursorCondition} ORDER BY ${orderBy} LIMIT ?`
        ).bind(...cursorParams, PAGE_SIZE).all();
        const rows = dataRes.results || [];
        let nextCursor = "";
        const hasMore = rows.length === PAGE_SIZE;
        if (hasMore) {
          const last = rows[rows.length - 1];
          nextCursor = type === "todos" ? `${last.date}:${last.deleted}:${last.id}` : last.parent_id;
        } else if (sessionId && url.searchParams.get("final") === "true") {
          ctx.waitUntil(env.DB.prepare("DELETE FROM export_sessions WHERE id = ?").bind(sessionId).run().catch(() => {
          }));
        }
        const lines = [];
        for (const row of rows) {
          lines.push(JSON.stringify(type === "templates" ? { _type: "template", ...row } : row));
        }
        if (hasMore) {
          lines.push(JSON.stringify({ _type: "page_info", cursor: nextCursor, hasMore: true }));
        } else {
          lines.push(JSON.stringify({ _type: "page_info", cursor: "", hasMore: false }));
        }
        const body = "ndjson\n" + lines.join("\n") + "\n";
        return new Response(body, {
          headers: { "Content-Type": "application/x-ndjson" }
        });
      }
      if (mode === "session") {
        const action = url.searchParams.get("action") || "create";
        const sessionId = url.searchParams.get("sessionId");
        if (action === "create") {
          const incTodos = url.searchParams.get("todos") === "true" ? 1 : 0;
          const incTrash = url.searchParams.get("trash") === "true" ? 1 : 0;
          const incSettings = url.searchParams.get("settings") === "true" ? 1 : 0;
          const incCategories = url.searchParams.get("categories") === "true" ? 1 : 0;
          const id = sessionId || crypto.randomUUID();
          const now = Date.now();
          let todoCondition = "1=0";
          if (incTodos && incTrash) todoCondition = "1=1";
          else if (incTodos) todoCondition = "deleted = 0";
          else if (incTrash) todoCondition = "deleted = 1";
          const hasTodoData = incTodos || incTrash;
          const [todoExistsRes, tplExistsRes] = hasTodoData ? await Promise.all([
            env.DB.prepare(`SELECT 1 FROM todos WHERE ${todoCondition} LIMIT 1`).first(),
            incTodos ? env.DB.prepare("SELECT 1 FROM todo_templates LIMIT 1").first() : Promise.resolve(null)
          ]) : [null, null];
          const EXPORT_TIMEOUT = 10 * 60 * 1e3;
          const oldSession = await env.DB.prepare("SELECT * FROM export_sessions WHERE status = ?").bind("active").first();
          if (oldSession) {
            if (now - oldSession.updated_at < EXPORT_TIMEOUT) {
              return apiError("\u5B58\u5728\u8FDB\u884C\u4E2D\u7684\u5BFC\u51FA\u4F1A\u8BDD", 409, { conflict: true, sessionId: oldSession.id });
            }
            await env.DB.prepare("DELETE FROM export_sessions WHERE id = ?").bind(oldSession.id).run();
          }
          const staleSessions = await env.DB.prepare("SELECT id FROM export_sessions WHERE updated_at < ?").bind(now - EXPORT_TIMEOUT).all();
          if (staleSessions.results && staleSessions.results.length > 0) {
            await env.DB.prepare("DELETE FROM export_sessions WHERE updated_at < ?").bind(now - EXPORT_TIMEOUT).run();
          }
          await env.DB.prepare(
            "INSERT INTO export_sessions (id, status, inc_todos, inc_trash, inc_settings, todos_cursor, templates_cursor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(id, "active", incTodos, incTrash, incSettings, "", "", now, now).run();
          return new Response(JSON.stringify({
            sessionId: id,
            hasData: !!(todoExistsRes || tplExistsRes || incSettings || incCategories)
          }), { headers: { "Content-Type": "application/json" } });
        }
        if (action === "update" && sessionId) {
          const session = await env.DB.prepare("SELECT * FROM export_sessions WHERE id = ? AND status = ?").bind(sessionId, "active").first();
          if (!session) return apiError("Session not found or not active", 404);
          const todosCursor = url.searchParams.get("todosCursor");
          const templatesCursor = url.searchParams.get("templatesCursor");
          const now = Date.now();
          if (todosCursor !== null) {
            await env.DB.prepare("UPDATE export_sessions SET todos_cursor = ?, updated_at = ? WHERE id = ?").bind(todosCursor, now, sessionId).run();
          }
          if (templatesCursor !== null) {
            await env.DB.prepare("UPDATE export_sessions SET templates_cursor = ?, updated_at = ? WHERE id = ?").bind(templatesCursor, now, sessionId).run();
          }
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        }
        if (action === "status" && sessionId) {
          const session = await env.DB.prepare("SELECT * FROM export_sessions WHERE id = ?").bind(sessionId).first();
          if (!session) {
            return apiError("Session not found", 404);
          }
          return new Response(JSON.stringify({
            sessionId: session.id,
            status: session.status,
            todosCursor: session.todos_cursor,
            templatesCursor: session.templates_cursor
          }), { headers: { "Content-Type": "application/json" } });
        }
        if (action === "done" && sessionId) {
          await env.DB.prepare("DELETE FROM export_sessions WHERE id = ?").bind(sessionId).run();
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        }
        if (action === "abort" && sessionId) {
          await env.DB.prepare("DELETE FROM export_sessions WHERE id = ?").bind(sessionId).run();
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        }
        return apiError("Invalid session action", 400);
      }
      if (mode === "stream") {
        let buildTodoCursorCondition = function(cursor) {
          if (!cursor) return { sql: "", params: [] };
          const parts = cursor.split(":");
          const cursorDate = parts[0] || "";
          const cursorDeleted = parts[1] === "1" ? 1 : 0;
          const cursorId = parts.slice(2).join(":");
          return {
            sql: ` AND (date > ? OR (date = ? AND deleted > ?) OR (date = ? AND deleted = ? AND id > ?))`,
            params: [cursorDate, cursorDate, cursorDeleted, cursorDate, cursorDeleted, cursorId]
          };
        }, encodeNdjsonLine = function(obj) {
          return JSON.stringify(obj) + "\n";
        }, enqueueBatch = function(controller, rows, mapper) {
          if (rows.length === 0) return;
          const chunk = rows.map(mapper || ((r) => JSON.stringify(r) + "\n")).join("");
          controller.enqueue(encoder.encode(chunk));
        }, emitContinuation = function(controller) {
          continuationEmitted = true;
          controller.enqueue(encoder.encode(encodeNdjsonLine({
            _type: "continuation",
            todosCursor: todosDone ? "__done__" : todosCursor,
            templatesCursor: templatesDone ? "__done__" : templatesCursor,
            hasMore: true
          })));
        };
        __name(buildTodoCursorCondition, "buildTodoCursorCondition");
        __name(encodeNdjsonLine, "encodeNdjsonLine");
        __name(enqueueBatch, "enqueueBatch");
        __name(emitContinuation, "emitContinuation");
        const sessionId = url.searchParams.get("sessionId");
        let todosCursor = url.searchParams.get("todosCursor") || "";
        let templatesCursor = url.searchParams.get("templatesCursor") || "";
        let todosDone = todosCursor === "__done__";
        let templatesDone = templatesCursor === "__done__";
        const skipHeader = url.searchParams.get("skipHeader") === "true";
        const incTodos = url.searchParams.get("todos") === "true";
        const incTrash = url.searchParams.get("trash") === "true";
        const incSettings = url.searchParams.get("settings") === "true";
        const incCategories = url.searchParams.get("categories") === "true";
        const STREAM_PAGE_SIZE = 500;
        const SESSION_UPDATE_INTERVAL = 5;
        const MAX_QUERIES_PER_INVOCATION = 45;
        let todoCondition = "1=0";
        if (incTodos && incTrash) todoCondition = "1=1";
        else if (incTodos) todoCondition = "deleted = 0";
        else if (incTrash) todoCondition = "deleted = 1";
        const encoder = new TextEncoder();
        let pageCount = 0;
        let queryCount = 0;
        let headerEmitted = skipHeader;
        let continuationEmitted = false;
        const stream = new ReadableStream({
          async pull(controller) {
            try {
              if (continuationEmitted) {
                controller.close();
                return;
              }
              if (!headerEmitted) {
                controller.enqueue(encoder.encode("ndjson\n"));
                if (incSettings) {
                  const [settingsRes, headerRes, contentRes, customColorsRes] = await env.DB.batch([
                    env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'"),
                    env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_header'"),
                    env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_content'"),
                    env.DB.prepare("SELECT value FROM settings WHERE key = 'customColors'")
                  ]);
                  queryCount++;
                  const settingsRecord = settingsRes.results?.[0];
                  let settingsObj = {};
                  try {
                    settingsObj = settingsRecord?.value ? JSON.parse(settingsRecord.value) : {};
                  } catch (e) {
                  }
                  controller.enqueue(encoder.encode(encodeNdjsonLine({ _type: "settings", data: settingsObj })));
                  const headerRecord = headerRes.results?.[0];
                  controller.enqueue(encoder.encode(encodeNdjsonLine({ _type: "custom_header", data: headerRecord?.value || "" })));
                  const contentRecord = contentRes.results?.[0];
                  controller.enqueue(encoder.encode(encodeNdjsonLine({ _type: "custom_content", data: contentRecord?.value || "" })));
                  const customColorsRecord = customColorsRes.results?.[0];
                  let customColorsArr = [];
                  try {
                    customColorsArr = customColorsRecord?.value ? JSON.parse(customColorsRecord.value) : [];
                  } catch (e) {
                  }
                  controller.enqueue(encoder.encode(encodeNdjsonLine({ _type: "customColors", data: customColorsArr })));
                }
                if (incCategories) {
                  const { results: catRes } = await env.DB.prepare("SELECT id, name, color FROM categories ORDER BY id").all();
                  queryCount++;
                  controller.enqueue(encoder.encode(encodeNdjsonLine({ _type: "categories", data: catRes || [] })));
                }
                headerEmitted = true;
              }
              if (!todosDone) {
                if (queryCount >= MAX_QUERIES_PER_INVOCATION) {
                  emitContinuation(controller);
                  return;
                }
                const cc = buildTodoCursorCondition(todosCursor);
                const dataRes = await env.DB.prepare(
                  `SELECT * FROM todos WHERE ${todoCondition}${cc.sql} ORDER BY date ASC, deleted ASC, id ASC LIMIT ?`
                ).bind(...cc.params, STREAM_PAGE_SIZE).all();
                queryCount++;
                const rows = dataRes.results || [];
                enqueueBatch(controller, rows);
                pageCount++;
                if (rows.length === STREAM_PAGE_SIZE) {
                  const last = rows[rows.length - 1];
                  todosCursor = `${last.date}:${last.deleted}:${last.id}`;
                  if (sessionId && pageCount % SESSION_UPDATE_INTERVAL === 0) {
                    await env.DB.prepare("UPDATE export_sessions SET todos_cursor = ?, updated_at = ? WHERE id = ?").bind(todosCursor, Date.now(), sessionId).run();
                    queryCount++;
                  }
                  return;
                } else {
                  todosDone = true;
                  if (sessionId) {
                    await env.DB.prepare("UPDATE export_sessions SET todos_cursor = ?, updated_at = ? WHERE id = ?").bind("__done__", Date.now(), sessionId).run();
                    queryCount++;
                  }
                }
              }
              if (todosDone && !templatesDone && incTodos) {
                if (queryCount >= MAX_QUERIES_PER_INVOCATION) {
                  emitContinuation(controller);
                  return;
                }
                const tplCursorSql = templatesCursor ? " AND parent_id > ?" : "";
                const tplCursorParams = templatesCursor ? [templatesCursor] : [];
                const dataRes = await env.DB.prepare(
                  `SELECT * FROM todo_templates WHERE 1=1${tplCursorSql} ORDER BY parent_id ASC LIMIT ?`
                ).bind(...tplCursorParams, STREAM_PAGE_SIZE).all();
                queryCount++;
                const rows = dataRes.results || [];
                enqueueBatch(controller, rows, (r) => JSON.stringify({ _type: "template", ...r }) + "\n");
                pageCount++;
                if (rows.length === STREAM_PAGE_SIZE) {
                  templatesCursor = rows[rows.length - 1].parent_id;
                  if (sessionId && pageCount % SESSION_UPDATE_INTERVAL === 0) {
                    await env.DB.prepare("UPDATE export_sessions SET templates_cursor = ?, updated_at = ? WHERE id = ?").bind(templatesCursor, Date.now(), sessionId).run();
                    queryCount++;
                  }
                  return;
                } else {
                  templatesDone = true;
                  if (sessionId) {
                    await env.DB.prepare("UPDATE export_sessions SET templates_cursor = ?, updated_at = ? WHERE id = ?").bind("__done__", Date.now(), sessionId).run();
                    queryCount++;
                  }
                }
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          }
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "application/x-ndjson",
            "Content-Disposition": 'attachment; filename="todo_export.json"'
          }
        });
      }
      return apiError("Unknown mode. Use mode=page, mode=stream or mode=session", 400);
    }
    if (url.pathname === "/api/import" && request.method === "POST") {
      const contentType = request.headers.get("Content-Type") || "";
      const BATCH_SIZE = 100;
      const safeStringify = /* @__PURE__ */ __name((v) => {
        if (typeof v === "string") return v;
        if (Array.isArray(v)) return JSON.stringify(v);
        if (v != null && typeof v === "object") return JSON.stringify(v);
        return "[]";
      }, "safeStringify");
      const buildTodoStmts = /* @__PURE__ */ __name((items) => (items || []).map((t) => {
        return env.DB.prepare(
          `INSERT OR REPLACE INTO todos
          (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id, recurrence_id, is_exception)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          t.id,
          t.parent_id,
          t.date,
          t.text,
          t.time || "",
          t.priority || "low",
          t.desc || "",
          t.url || "",
          t.copy_text || "",
          safeStringify(t.subtasks),
          safeStringify(t.search_terms),
          t.done || 0,
          t.deleted || 0,
          t.repeat_type || "none",
          t.repeat_custom || "",
          t.repeat_end || "",
          t.end_time || "",
          t.category_id || "",
          t.recurrence_id || "",
          t.is_exception || 0
        );
      }), "buildTodoStmts");
      const buildTemplateStmts = /* @__PURE__ */ __name((items) => (items || []).map((t) => {
        const exdates = t.exdates || "[]";
        return env.DB.prepare(
          `INSERT OR REPLACE INTO todo_templates
          (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          t.parent_id,
          t.text || "",
          t.time || "",
          t.priority || "low",
          t.desc || "",
          t.url || "",
          t.copy_text || "",
          safeStringify(t.subtasks),
          safeStringify(t.search_terms),
          t.repeat_type || "none",
          t.repeat_custom || "",
          t.repeat_end || "",
          t.end_time || "",
          t.anchor_date || "",
          exdates,
          t.category_id || ""
        );
      }), "buildTemplateStmts");
      const execBatch = /* @__PURE__ */ __name(async (stmts) => {
        for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
          await env.DB.batch(stmts.slice(i, i + BATCH_SIZE));
        }
      }, "execBatch");
      const BACKUP_TTL = 10 * 60 * 1e3;
      const clearBackupTables = /* @__PURE__ */ __name(async () => {
        try {
          await env.DB.batch([
            env.DB.prepare("DROP TABLE IF EXISTS todos_backup"),
            env.DB.prepare("DROP TABLE IF EXISTS todo_templates_backup"),
            env.DB.prepare("DROP TABLE IF EXISTS categories_backup")
          ]);
        } catch (e) {
          console.error("Failed to drop backup tables:", e);
        }
      }, "clearBackupTables");
      const cleanExpiredBackups = /* @__PURE__ */ __name(async () => {
        const record = await env.DB.prepare("SELECT value FROM settings WHERE key = 'import_backup_time'").first();
        if (!record || !record.value) return;
        const backupTime = parseInt(record.value, 10);
        if (isNaN(backupTime) || Date.now() - backupTime < BACKUP_TTL) return;
        await clearBackupTables();
        await env.DB.prepare("DELETE FROM settings WHERE key = 'import_backup_time'").run();
      }, "cleanExpiredBackups");
      try {
        if (contentType.includes("application/x-ndjson")) {
          const importId = url.searchParams.get("importId");
          if (!importId) return apiError("importId required", 400);
          if (!request.body) return apiError("\u8BF7\u6C42\u4F53\u4E3A\u7A7A", 400);
          const session = await env.DB.prepare("SELECT * FROM import_sessions WHERE id = ? AND status = ?").bind(importId, "active").first();
          if (!session) return apiError("\u65E0\u6548\u6216\u5DF2\u8FC7\u671F\u7684\u5BFC\u5165\u4F1A\u8BDD", 400);
          let buffer = "";
          const reader = request.body.getReader();
          const decoder = new TextDecoder();
          let todoBatch = [];
          let tplBatch = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              const obj = JSON.parse(trimmed);
              if (obj._type === "template") {
                const tpl = Object.assign({}, obj);
                delete tpl._type;
                tplBatch.push(tpl);
                if (tplBatch.length >= BATCH_SIZE) {
                  await execBatch(buildTemplateStmts(tplBatch));
                  tplBatch = [];
                }
              } else if (obj._type) {
              } else {
                todoBatch.push(obj);
                if (todoBatch.length >= BATCH_SIZE) {
                  await execBatch(buildTodoStmts(todoBatch));
                  todoBatch = [];
                }
              }
            }
          }
          if (buffer.trim()) {
            const obj = JSON.parse(buffer.trim());
            if (obj._type === "template") {
              const tpl = Object.assign({}, obj);
              delete tpl._type;
              tplBatch.push(tpl);
            } else if (!obj._type) {
              todoBatch.push(obj);
            }
          }
          if (todoBatch.length > 0) {
            await execBatch(buildTodoStmts(todoBatch));
          }
          if (tplBatch.length > 0) {
            await execBatch(buildTemplateStmts(tplBatch));
          }
          await env.DB.prepare("UPDATE import_sessions SET updated_at = ? WHERE id = ?").bind(Date.now(), importId).run();
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        }
        const body = await request.json();
        const phase = body.phase;
        if (phase === "status") {
          await cleanExpiredBackups();
          const session = await env.DB.prepare("SELECT * FROM import_sessions WHERE status = ?").bind("active").first();
          if (!session) {
            return new Response(JSON.stringify({ active: false }), { headers: { "Content-Type": "application/json" } });
          }
          const now = Date.now();
          const TIMEOUT = 10 * 60 * 1e3;
          const timedOut = now - session.updated_at > TIMEOUT;
          const [todoBakRes, tplBakRes] = await Promise.all([
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todo_templates_backup'").first()
          ]);
          return new Response(JSON.stringify({
            active: true,
            importId: session.id,
            mode: session.mode,
            startedAt: session.started_at,
            updatedAt: session.updated_at,
            timedOut,
            hasBackup: !!(todoBakRes || tplBakRes)
          }), { headers: { "Content-Type": "application/json" } });
        }
        if (phase === "abort") {
          const importId = body.importId;
          const discard = !!body.discard;
          const keepBackup = !!body.keepBackup;
          if (!importId) return apiError("importId required", 400);
          const session = await env.DB.prepare("SELECT * FROM import_sessions WHERE id = ?").bind(importId).first();
          if (!session) return apiError("\u4F1A\u8BDD\u4E0D\u5B58\u5728", 400);
          if (session.mode === "overwrite" && !keepBackup) {
            if (discard) {
              await clearBackupTables();
            } else {
              try {
                await env.DB.batch([
                  env.DB.prepare("DROP TABLE IF EXISTS todos"),
                  env.DB.prepare("DROP TABLE IF EXISTS todo_templates"),
                  env.DB.prepare("DROP TABLE IF EXISTS categories"),
                  env.DB.prepare("ALTER TABLE todos_backup RENAME TO todos"),
                  env.DB.prepare("ALTER TABLE todo_templates_backup RENAME TO todo_templates"),
                  env.DB.prepare("ALTER TABLE categories_backup RENAME TO categories"),
                  env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)"),
                  env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)"),
                  env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)")
                ]);
              } catch (e) {
                return apiError("\u6062\u590D\u5907\u4EFD\u5931\u8D25: " + e.message, 500);
              }
            }
          }
          await env.DB.prepare("DELETE FROM import_sessions WHERE id = ?").bind(importId).run();
          if (session.mode === "overwrite" && !keepBackup) {
            await env.DB.prepare("DELETE FROM settings WHERE key = 'import_backup_time'").run();
          }
          return new Response(JSON.stringify({ success: true, recovered: session.mode === "overwrite" && !discard && !keepBackup }), {
            headers: { "Content-Type": "application/json" }
          });
        }
        if (phase === "init") {
          const importId = body.importId;
          const mode = body.mode || "merge";
          if (!importId) return apiError("importId required", 400);
          await cleanExpiredBackups();
          const oldSession = await env.DB.prepare("SELECT * FROM import_sessions WHERE status = ?").bind("active").first();
          if (oldSession) {
            const now2 = Date.now();
            const TIMEOUT = 10 * 60 * 1e3;
            if (now2 - oldSession.updated_at < TIMEOUT) {
              return apiError("\u5B58\u5728\u8FDB\u884C\u4E2D\u7684\u5BFC\u5165\u4F1A\u8BDD", 409, { conflict: true, importId: oldSession.id, mode: oldSession.mode });
            }
            if (oldSession.mode === "overwrite") {
              try {
                await env.DB.batch([
                  env.DB.prepare("DROP TABLE IF EXISTS todos"),
                  env.DB.prepare("DROP TABLE IF EXISTS todo_templates"),
                  env.DB.prepare("DROP TABLE IF EXISTS categories"),
                  env.DB.prepare("ALTER TABLE todos_backup RENAME TO todos"),
                  env.DB.prepare("ALTER TABLE todo_templates_backup RENAME TO todo_templates"),
                  env.DB.prepare("ALTER TABLE categories_backup RENAME TO categories"),
                  env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)"),
                  env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)"),
                  env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)")
                ]);
              } catch (e) {
                console.error("Auto-recover old session failed:", e);
              }
            }
            await env.DB.prepare("DELETE FROM import_sessions WHERE id = ?").bind(oldSession.id).run();
            if (oldSession.mode === "overwrite") {
              await env.DB.prepare("DELETE FROM settings WHERE key = 'import_backup_time'").run();
            }
          }
          const now = Date.now();
          if (mode === "overwrite") {
            try {
              await env.DB.batch([
                env.DB.prepare("DROP TABLE IF EXISTS todos_backup"),
                env.DB.prepare("DROP TABLE IF EXISTS todo_templates_backup"),
                env.DB.prepare("DROP TABLE IF EXISTS categories_backup"),
                env.DB.prepare("DROP INDEX IF EXISTS idx_todos_cursor"),
                env.DB.prepare("DROP INDEX IF EXISTS idx_todos_parent_date_del"),
                env.DB.prepare("DROP INDEX IF EXISTS idx_templates_repeat_type")
              ]);
              await env.DB.batch([
                env.DB.prepare("ALTER TABLE todos RENAME TO todos_backup"),
                env.DB.prepare("ALTER TABLE todo_templates RENAME TO todo_templates_backup"),
                env.DB.prepare("ALTER TABLE categories RENAME TO categories_backup")
              ]);
              await env.DB.batch([
                env.DB.prepare(`
                  CREATE TABLE todos (
                    id TEXT PRIMARY KEY,
                    parent_id TEXT NOT NULL,
                    date TEXT NOT NULL,
                    text TEXT NOT NULL,
                    time TEXT,
                    priority TEXT,
                    desc TEXT,
                    url TEXT,
                    copy_text TEXT,
                    subtasks TEXT,
                    search_terms TEXT,
                    done INTEGER NOT NULL DEFAULT 0,
                    deleted INTEGER NOT NULL DEFAULT 0,
                    repeat_type TEXT DEFAULT 'none',
                    repeat_custom TEXT DEFAULT '',
                    repeat_end TEXT DEFAULT '',
                    end_time TEXT DEFAULT '',
                    category_id TEXT DEFAULT '',
                    recurrence_id TEXT DEFAULT '',
                    is_exception INTEGER NOT NULL DEFAULT 0
                  )
                `),
                env.DB.prepare(`CREATE INDEX idx_todos_cursor ON todos(date, deleted, id)`),
                env.DB.prepare(`CREATE INDEX idx_todos_parent_date_del ON todos(parent_id, date, deleted)`),
                env.DB.prepare(`
                  CREATE TABLE todo_templates (
                    parent_id TEXT PRIMARY KEY,
                    text TEXT, time TEXT, priority TEXT, desc TEXT, url TEXT,
                    copy_text TEXT, subtasks TEXT, search_terms TEXT,
                    repeat_type TEXT, repeat_custom TEXT, repeat_end TEXT DEFAULT '', end_time TEXT DEFAULT '',
                    anchor_date TEXT,
                    exdates TEXT DEFAULT '[]',
                    category_id TEXT DEFAULT ''
                  )
                `),
                env.DB.prepare(`CREATE INDEX idx_templates_repeat_type ON todo_templates(repeat_type)`),
                env.DB.prepare(`
                  CREATE TABLE categories (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    color TEXT NOT NULL DEFAULT '#888888'
                  )
                `),
                env.DB.prepare("INSERT INTO import_sessions (id, mode, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(importId, "overwrite", "active", now, now),
                env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('import_backup_time', ?)").bind(String(now))
              ]);
            } catch (backupErr) {
              try {
                await env.DB.batch([
                  env.DB.prepare("DROP TABLE IF EXISTS todos"),
                  env.DB.prepare("DROP TABLE IF EXISTS todo_templates"),
                  env.DB.prepare("DROP TABLE IF EXISTS categories"),
                  env.DB.prepare("ALTER TABLE todos_backup RENAME TO todos"),
                  env.DB.prepare("ALTER TABLE todo_templates_backup RENAME TO todo_templates"),
                  env.DB.prepare("ALTER TABLE categories_backup RENAME TO categories"),
                  env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)"),
                  env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)"),
                  env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)")
                ]);
              } catch (rollbackErr) {
                console.error("Rollback after backup failure also failed:", rollbackErr);
              }
              return apiError("\u8986\u5199\u524D\u5907\u4EFD\u5931\u8D25: " + backupErr.message, 500);
            }
          } else {
            await env.DB.prepare("INSERT INTO import_sessions (id, mode, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(importId, "merge", "active", now, now).run();
          }
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } else if (phase === "finalize") {
          const importId = body.importId;
          if (!importId) return apiError("importId required", 400);
          const session = await env.DB.prepare("SELECT * FROM import_sessions WHERE id = ?").bind(importId).first();
          if (!session) return apiError("\u4F1A\u8BDD\u4E0D\u5B58\u5728", 400);
          if (session.mode === "overwrite") {
            try {
              await env.DB.batch([
                env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)"),
                env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)"),
                env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)")
              ]);
            } catch (e) {
              console.error("Index rebuild after finalize:", e);
            }
          }
          if (body.custom_header !== void 0 || body.custom_content !== void 0) {
            const customStmts = [];
            if (body.custom_header !== void 0) {
              customStmts.push(env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_header', ?)").bind(body.custom_header));
            }
            if (body.custom_content !== void 0) {
              customStmts.push(env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_content', ?)").bind(body.custom_content));
            }
            if (customStmts.length > 0) await env.DB.batch(customStmts);
          }
          if (body.categories && Array.isArray(body.categories)) {
            if (session.mode === "overwrite") {
              await env.DB.prepare("DELETE FROM categories").run();
            }
            const insertStmts = body.categories.filter((c) => c.id && c.name).map(
              (c) => env.DB.prepare("INSERT OR REPLACE INTO categories (id, name, color) VALUES (?, ?, ?)").bind(c.id, c.name, c.color || "#888888")
            );
            if (insertStmts.length > 0) await env.DB.batch(insertStmts);
            await env.DB.batch([
              env.DB.prepare("UPDATE todos SET category_id = '' WHERE category_id != '' AND category_id NOT IN (SELECT id FROM categories)"),
              env.DB.prepare("UPDATE todo_templates SET category_id = '' WHERE category_id != '' AND category_id NOT IN (SELECT id FROM categories)")
            ]);
          }
          if (body.customColors && Array.isArray(body.customColors)) {
            await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('customColors', ?)").bind(JSON.stringify(body.customColors)).run();
          }
          await env.DB.prepare("DELETE FROM import_sessions WHERE id = ?").bind(importId).run();
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } else {
          return apiError("\u672A\u77E5 phase\uFF0C\u53EF\u7528: status, abort, init, finalize", 400);
        }
      } catch (e) {
        return apiError(e.message);
      }
    }
    if (url.pathname === "/api/import-backup") {
      const action = url.searchParams.get("action") || "query";
      try {
        if (action === "query") {
          const [todoBakRes, tplBakRes, catBakRes] = await Promise.all([
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todo_templates_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories_backup'").first()
          ]);
          const hasTodoBak = !!todoBakRes;
          const hasTplBak = !!tplBakRes;
          const hasCatBak = !!catBakRes;
          return new Response(JSON.stringify({
            exists: hasTodoBak || hasTplBak || hasCatBak,
            todos: hasTodoBak ? "backup_exists" : 0,
            templates: hasTplBak ? "backup_exists" : 0,
            categories: hasCatBak ? "backup_exists" : 0
          }), { headers: { "Content-Type": "application/json" } });
        }
        if (action === "restore") {
          const [todoBakRes, tplBakRes, catBakRes] = await Promise.all([
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todo_templates_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories_backup'").first()
          ]);
          const hasTodoBak = !!todoBakRes;
          const hasTplBak = !!tplBakRes;
          const hasCatBak = !!catBakRes;
          if (!hasTodoBak && !hasTplBak && !hasCatBak) {
            return apiError("\u672A\u627E\u5230\u5907\u4EFD\u6570\u636E\uFF0C\u65E0\u9700\u6062\u590D", 404);
          }
          try {
            const restoreStmts = [];
            if (hasTodoBak) {
              restoreStmts.push(
                env.DB.prepare("DROP TABLE IF EXISTS todos"),
                env.DB.prepare("ALTER TABLE todos_backup RENAME TO todos"),
                env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_todos_cursor ON todos(date, deleted, id)"),
                env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted)")
              );
            }
            if (hasTplBak) {
              restoreStmts.push(
                env.DB.prepare("DROP TABLE IF EXISTS todo_templates"),
                env.DB.prepare("ALTER TABLE todo_templates_backup RENAME TO todo_templates"),
                env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type)")
              );
            }
            if (hasCatBak) {
              restoreStmts.push(
                env.DB.prepare("DROP TABLE IF EXISTS categories"),
                env.DB.prepare("ALTER TABLE categories_backup RENAME TO categories")
              );
            }
            await env.DB.batch(restoreStmts);
          } catch (e) {
            return apiError("\u6062\u590D\u5931\u8D25: " + e.message + "\uFF0C\u5907\u4EFD\u6570\u636E\u4ECD\u4FDD\u7559\uFF0C\u53EF\u91CD\u8BD5");
          }
          await env.DB.prepare("DELETE FROM settings WHERE key = 'import_backup_time'").run();
          return new Response(JSON.stringify({
            success: true,
            restored: { todos: hasTodoBak ? "restored" : 0, templates: hasTplBak ? "restored" : 0, categories: hasCatBak ? "restored" : 0 }
          }), { headers: { "Content-Type": "application/json" } });
        }
        if (action === "clear") {
          const [todoBakRes, tplBakRes, catBakRes] = await Promise.all([
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todo_templates_backup'").first(),
            env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories_backup'").first()
          ]);
          const hasTodoBak = !!todoBakRes;
          const hasTplBak = !!tplBakRes;
          const hasCatBak = !!catBakRes;
          if (!hasTodoBak && !hasTplBak && !hasCatBak) {
            return new Response(JSON.stringify({ success: true, message: "\u65E0\u6B8B\u7559\u5907\u4EFD\uFF0C\u65E0\u9700\u6E05\u9664" }), {
              headers: { "Content-Type": "application/json" }
            });
          }
          await env.DB.batch([
            env.DB.prepare("DROP TABLE IF EXISTS todos_backup"),
            env.DB.prepare("DROP TABLE IF EXISTS todo_templates_backup"),
            env.DB.prepare("DROP TABLE IF EXISTS categories_backup")
          ]);
          await env.DB.prepare("DELETE FROM settings WHERE key = 'import_backup_time'").run();
          return new Response(JSON.stringify({
            success: true,
            message: "\u5907\u4EFD\u8BB0\u5F55\u5DF2\u6E05\u9664\uFF08\u539F\u59CB\u6570\u636E\u672A\u6062\u590D\uFF09"
          }), { headers: { "Content-Type": "application/json" } });
        }
        return apiError("\u672A\u77E5\u64CD\u4F5C\uFF0C\u53EF\u7528: query, restore, clear", 400);
      } catch (e) {
        return apiError(e.message);
      }
    }
    if (url.pathname === "/api/settings" && request.method === "GET") {
      const record = await env.DB.prepare("SELECT value FROM settings WHERE key = 'app_settings'").first();
      let settingsObj = {};
      if (record && record.value) {
        try {
          settingsObj = JSON.parse(record.value);
        } catch (e) {
        }
      }
      return new Response(JSON.stringify(settingsObj), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/settings" && request.method === "POST") {
      const data = await request.json();
      await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)").bind(JSON.stringify(data)).run();
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/custom-colors" && request.method === "GET") {
      const record = await env.DB.prepare("SELECT value FROM settings WHERE key = 'customColors'").first();
      let customColors = [];
      if (record && record.value) {
        try {
          customColors = JSON.parse(record.value);
        } catch (e) {
        }
      }
      return new Response(JSON.stringify(customColors), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/custom-header" && request.method === "GET") {
      const record = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_header'").first();
      return new Response(record?.value || "", { headers: { "Content-Type": "text/plain" } });
    }
    if (url.pathname === "/api/custom-content" && request.method === "GET") {
      const record = await env.DB.prepare("SELECT value FROM settings WHERE key = 'custom_content'").first();
      return new Response(record?.value || "", { headers: { "Content-Type": "text/plain" } });
    }
    if (url.pathname === "/api/custom-colors" && request.method === "POST") {
      const { colors } = await request.json();
      if (!Array.isArray(colors)) {
        return apiError("colors must be an array", 400);
      }
      await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('customColors', ?)").bind(JSON.stringify(colors)).run();
      return new Response(JSON.stringify({ success: true, colors }), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/categories" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT id, name, color FROM categories ORDER BY id").all();
      return new Response(JSON.stringify(results || []), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/category-action" && request.method === "POST") {
      const { action, id, ids, name, color } = await request.json();
      if (action === "CREATE") {
        if (!name || !name.trim()) {
          return apiError("\u5206\u7C7B\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A", 400);
        }
        const existing = await env.DB.prepare("SELECT id FROM categories WHERE LOWER(name) = ?").bind(name.trim().toLowerCase()).first();
        if (existing) {
          return apiError("\u5206\u7C7B\u540D\u79F0\u5DF2\u5B58\u5728", 400);
        }
        const newId = Date.now().toString() + Math.random().toString().slice(2, 6);
        const catColor = color && color.trim() ? color.trim() : DEFAULT_CATEGORY_COLOR;
        await env.DB.prepare("INSERT INTO categories (id, name, color) VALUES (?, ?, ?)").bind(newId, name.trim(), catColor).run();
        return new Response(JSON.stringify({ success: true, id: newId, name: name.trim(), color: catColor }), { headers: { "Content-Type": "application/json" } });
      } else if (action === "UPDATE") {
        if (!id) {
          return apiError("\u7F3A\u5C11\u5206\u7C7BID", 400);
        }
        if (name && name.trim()) {
          const existing = await env.DB.prepare("SELECT id FROM categories WHERE LOWER(name) = ? AND id != ?").bind(name.trim().toLowerCase(), id).first();
          if (existing) {
            return apiError("\u5206\u7C7B\u540D\u79F0\u5DF2\u5B58\u5728", 400);
          }
        }
        const cat = await env.DB.prepare("SELECT id FROM categories WHERE id = ?").bind(id).first();
        if (cat) {
          const sets = [];
          const vals = [];
          if (name && name.trim()) {
            sets.push("name = ?");
            vals.push(name.trim());
          }
          if (color && color.trim()) {
            sets.push("color = ?");
            vals.push(color.trim());
          }
          if (sets.length > 0) {
            vals.push(id);
            await env.DB.prepare(`UPDATE categories SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
          }
        }
        return new Response(JSON.stringify({ success: true, id, name: name ? name.trim() : void 0, color: color ? color.trim() : void 0 }), { headers: { "Content-Type": "application/json" } });
      } else if (action === "BATCH_DELETE") {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return apiError("\u7F3A\u5C11\u5206\u7C7BID\u5217\u8868", 400);
        }
        const placeholders = ids.map(() => "?").join(",");
        await env.DB.batch([
          env.DB.prepare(`DELETE FROM categories WHERE id IN (${placeholders})`).bind(...ids),
          env.DB.prepare(`UPDATE todos SET category_id = '' WHERE category_id IN (${placeholders})`).bind(...ids),
          env.DB.prepare(`UPDATE todo_templates SET category_id = '' WHERE category_id IN (${placeholders})`).bind(...ids)
        ]);
        return new Response(JSON.stringify({ success: true, ids }), { headers: { "Content-Type": "application/json" } });
      }
      return apiError("\u672A\u77E5\u64CD\u4F5C", 400);
    }
    if (url.pathname === "/api/trash" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM todos WHERE deleted = 1 ORDER BY date DESC LIMIT 100").all();
      return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/trash-action" && request.method === "POST") {
      const { action, id, ids } = await request.json();
      if (action === "RESTORE") {
        const t = await env.DB.prepare("SELECT parent_id, date, repeat_type, repeat_end FROM todos WHERE id = ?").bind(id).first();
        await env.DB.prepare("UPDATE todos SET deleted = 0 WHERE id = ?").bind(id).run();
        if (t && t.repeat_type && t.repeat_type !== "none" && t.parent_id) {
          const existing = await env.DB.prepare(
            "SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 AND id != ? LIMIT 1"
          ).bind(t.parent_id, t.date, id).first();
          if (existing) {
            await env.DB.prepare(
              "UPDATE todos SET parent_id=?, repeat_type='none', repeat_custom='', repeat_end='' WHERE id=?"
            ).bind(id, id).run();
          } else if (t.repeat_end && t.repeat_end !== "") {
            const tpl2 = await env.DB.prepare("SELECT repeat_end FROM todo_templates WHERE parent_id = ?").bind(t.parent_id).first();
            if (tpl2 && tpl2.repeat_end && tpl2.repeat_end < t.date) {
              await env.DB.prepare(
                "UPDATE todos SET parent_id=?, repeat_type='none', repeat_custom='', repeat_end='' WHERE id=?"
              ).bind(id, id).run();
            } else {
              await env.DB.prepare("UPDATE todos SET repeat_end='' WHERE id=?").bind(id).run();
            }
          }
          const tpl = await env.DB.prepare("SELECT exdates FROM todo_templates WHERE parent_id = ?").bind(t.parent_id).first();
          if (tpl) {
            const currentExdates = tpl.exdates || "[]";
            const newExdates = removeExdate(currentExdates, t.date);
            await env.DB.prepare("UPDATE todo_templates SET exdates = ? WHERE parent_id = ?").bind(newExdates, t.parent_id).run();
          } else if (!tpl && t.repeat_type && t.repeat_type !== "none") {
            const task = await env.DB.prepare("SELECT text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, end_time, category_id FROM todos WHERE id=?").bind(id).first();
            if (task) {
              await env.DB.prepare(
                "INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
              ).bind(t.parent_id, task.text, task.time, task.priority, task.desc, task.url, task.copy_text, task.subtasks, task.search_terms, task.repeat_type, task.repeat_custom || "", "", task.end_time, t.date, "[]", task.category_id).run();
            }
          }
        }
      } else if (action === "DELETE_PERMANENT") {
        await env.DB.prepare("DELETE FROM todos WHERE id = ?").bind(id).run();
      } else if (action === "CLEAR_ALL") {
        await env.DB.prepare("DELETE FROM todos WHERE deleted = 1").run();
      } else if (action === "BATCH_RESTORE") {
        if (ids && ids.length > 0) {
          const placeholders = ids.map(() => "?").join(",");
          const tasks = await env.DB.prepare(`SELECT id, parent_id, date, repeat_type, repeat_end FROM todos WHERE id IN (${placeholders})`).bind(...ids).all();
          await env.DB.prepare(`UPDATE todos SET deleted = 0 WHERE id IN (${placeholders})`).bind(...ids).run();
          const reviveIds = [];
          const detachIds = [];
          for (const t of tasks.results) {
            if (t.repeat_type && t.repeat_type !== "none" && t.repeat_end && t.repeat_end !== "") {
              const existing = await env.DB.prepare(
                "SELECT id FROM todos WHERE parent_id = ? AND date = ? AND deleted = 0 AND id != ? LIMIT 1"
              ).bind(t.parent_id, t.date, t.id).first();
              if (existing) {
                detachIds.push(t.id);
              } else {
                const tpl = await env.DB.prepare("SELECT repeat_end FROM todo_templates WHERE parent_id = ?").bind(t.parent_id).first();
                if (tpl && tpl.repeat_end && tpl.repeat_end < t.date) {
                  detachIds.push(t.id);
                } else {
                  reviveIds.push(t.id);
                }
              }
            }
          }
          if (reviveIds.length > 0) {
            const ph = reviveIds.map(() => "?").join(",");
            await env.DB.prepare(`UPDATE todos SET repeat_end='' WHERE id IN (${ph})`).bind(...reviveIds).run();
          }
          if (detachIds.length > 0) {
            const ph = detachIds.map(() => "?").join(",");
            await env.DB.prepare(`UPDATE todos SET parent_id=id, repeat_type='none', repeat_custom='', repeat_end='' WHERE id IN (${ph})`).bind(...detachIds).run();
          }
          const exdateUpdates = {};
          for (const t of tasks.results) {
            if (t.repeat_type && t.repeat_type !== "none" && t.parent_id) {
              if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
              exdateUpdates[t.parent_id].push(t.date);
            }
          }
          for (const pid of Object.keys(exdateUpdates)) {
            const tpl = await env.DB.prepare("SELECT exdates FROM todo_templates WHERE parent_id = ?").bind(pid).first();
            if (tpl) {
              let currentExdates = tpl.exdates || "[]";
              let changed = false;
              for (const d of exdateUpdates[pid]) {
                const newExdates = removeExdate(currentExdates, d);
                if (newExdates !== currentExdates) {
                  currentExdates = newExdates;
                  changed = true;
                }
              }
              if (changed) await env.DB.prepare("UPDATE todo_templates SET exdates = ? WHERE parent_id = ?").bind(currentExdates, pid).run();
            } else if (!tpl) {
              const firstTask = tasks.results.find((t) => t.parent_id === pid && t.repeat_type && t.repeat_type !== "none");
              if (firstTask) {
                const task = await env.DB.prepare("SELECT text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, end_time, category_id FROM todos WHERE id=?").bind(firstTask.id).first();
                if (task) {
                  await env.DB.prepare(
                    "INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, `desc`, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
                  ).bind(pid, task.text, task.time, task.priority, task.desc, task.url, task.copy_text, task.subtasks, task.search_terms, task.repeat_type, task.repeat_custom || "", "", task.end_time, firstTask.date, "[]", task.category_id).run();
                }
              }
            }
          }
        }
      } else if (action === "BATCH_DELETE_PERMANENT") {
        if (ids && ids.length > 0) {
          const placeholders = ids.map(() => "?").join(",");
          await env.DB.prepare(`DELETE FROM todos WHERE id IN (${placeholders})`).bind(...ids).run();
        }
      } else if (action === "CLEAR_ALL_DATA") {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM todos"),
          env.DB.prepare("DELETE FROM todo_templates"),
          env.DB.prepare("DELETE FROM settings"),
          env.DB.prepare("DELETE FROM categories")
        ]);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/todos" && request.method === "GET") {
      const date = url.searchParams.get("date");
      if (!date) return apiError("Date required", 400);
      let { results } = await env.DB.prepare(
        "SELECT * FROM todos WHERE date = ? AND deleted = 0"
      ).bind(date).all();
      const targetDayOfWeek = String(getDayOfWeek(date));
      const targetDayOfMonth = date.slice(8, 10);
      const targetMonthDay = date.slice(5, 10);
      const templatesReq = await env.DB.prepare(`
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
      let newlyFetchedSearchTerms = null;
      if (templatesReq.results && templatesReq.results.length > 0) {
        for (const tpl of templatesReq.results) {
          let templateForEngine = { ...tpl, exdates: tpl.exdates || "[]" };
          if (!isOccurrenceOnDate(templateForEngine, date)) continue;
          const newId = crypto.randomUUID();
          let parsedSubtasks = [];
          if (tpl.subtasks && tpl.subtasks !== "[]" && tpl.subtasks !== "") {
            try {
              parsedSubtasks = JSON.parse(tpl.subtasks);
              parsedSubtasks.forEach((st) => st.done = false);
            } catch (e) {
            }
          }
          let parsedSearchTerms = [];
          if (tpl.search_terms && tpl.search_terms !== "[]" && tpl.search_terms !== "") {
            try {
              const oldTerms = JSON.parse(tpl.search_terms);
              if (Array.isArray(oldTerms) && oldTerms.length > 0) {
                if (!newlyFetchedSearchTerms) {
                  const fetched = await fetchHotSearchData("auto");
                  const valid = fetched.filter((w) => typeof w === "string" && w.trim().length > 0);
                  newlyFetchedSearchTerms = valid.sort(() => 0.5 - Math.random()).slice(0, 20);
                }
                if (newlyFetchedSearchTerms.length > 0) {
                  parsedSearchTerms = newlyFetchedSearchTerms.map((w) => ({ text: w, done: false }));
                } else {
                  parsedSearchTerms = oldTerms.map((w) => {
                    const t = typeof w === "string" ? w : w.text || "";
                    return { text: t, done: false };
                  }).filter((w) => w.text);
                }
              }
            } catch (e) {
            }
          }
          const newRecord = {
            ...tpl,
            id: newId,
            date,
            parent_id: tpl.parent_id,
            done: 0,
            deleted: 0,
            subtasks: parsedSubtasks,
            search_terms: parsedSearchTerms
          };
          results.push(newRecord);
          insertStmts.push(env.DB.prepare(
            "INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(
            newId,
            tpl.parent_id,
            date,
            tpl.text,
            tpl.time || "",
            tpl.priority || "low",
            tpl.desc || "",
            tpl.url || "",
            tpl.copy_text || "",
            JSON.stringify(parsedSubtasks),
            JSON.stringify(parsedSearchTerms),
            0,
            0,
            tpl.repeat_type || "none",
            tpl.repeat_custom || "",
            tpl.repeat_end || "",
            tpl.end_time || "",
            tpl.category_id || ""
          ));
        }
        if (insertStmts.length > 0) {
          for (let i = 0; i < insertStmts.length; i += 100) {
            await env.DB.batch(insertStmts.slice(i, i + 100));
          }
        }
      }
      const formatted = results.map((row) => {
        let parsedSubtasks = [];
        let parsedSearchTerms = [];
        if (Array.isArray(row.subtasks)) {
          parsedSubtasks = row.subtasks;
        } else {
          try {
            if (row.subtasks) parsedSubtasks = JSON.parse(row.subtasks);
          } catch (e) {
          }
        }
        if (Array.isArray(row.search_terms)) {
          parsedSearchTerms = row.search_terms;
        } else {
          try {
            if (row.search_terms) parsedSearchTerms = JSON.parse(row.search_terms);
          } catch (e) {
          }
        }
        parsedSearchTerms = parsedSearchTerms.map((w) => {
          if (typeof w === "string" && w.trim()) return { text: w, done: false };
          if (w && typeof w === "object" && w.text) return w;
          return null;
        }).filter(Boolean);
        let rType = row.repeat_type || "none";
        if (rType !== "none" && !["daily", "weekly", "monthly", "yearly"].includes(rType)) rType = "daily";
        return {
          ...row,
          repeat_type: rType,
          repeat_custom: row.repeat_custom || "",
          repeat_end: row.repeat_end || "",
          end_time: row.end_time || "",
          isSeries: rType && rType !== "none",
          done: !!row.done,
          subtasks: parsedSubtasks,
          search_terms: parsedSearchTerms
        };
      });
      return new Response(JSON.stringify(formatted), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/todo-action" && request.method === "POST") {
      const { action, date, task, scope, ids, doneStatus } = await request.json();
      if (action === "TOGGLE_DONE") {
        await env.DB.prepare("UPDATE todos SET done = ? WHERE id = ?").bind(task.done ? 1 : 0, task.id).run();
      } else if (action === "UPDATE_SUBTASKS") {
        await env.DB.prepare("UPDATE todos SET subtasks = ? WHERE id = ?").bind(JSON.stringify(task.subtasks || []), task.id).run();
      } else if (action === "UPDATE_SEARCH_TERMS") {
        await env.DB.prepare("UPDATE todos SET search_terms = ? WHERE id = ?").bind(JSON.stringify(task.search_terms || []), task.id).run();
      } else if (action === "BATCH_TOGGLE_DONE") {
        if (ids && ids.length > 0) {
          const placeholders = ids.map(() => "?").join(",");
          await env.DB.prepare(`UPDATE todos SET done = ? WHERE id IN (${placeholders})`).bind(doneStatus ? 1 : 0, ...ids).run();
        }
      } else if (action === "BATCH_DELETE") {
        if (ids && ids.length > 0) {
          const placeholders = ids.map(() => "?").join(",");
          const tasks = await env.DB.prepare(`SELECT parent_id, date, repeat_type FROM todos WHERE id IN (${placeholders})`).bind(...ids).all();
          await env.DB.prepare(`UPDATE todos SET deleted = 1 WHERE id IN (${placeholders})`).bind(...ids).run();
          const exdateUpdates = {};
          for (const t of tasks.results) {
            if (t.repeat_type && t.repeat_type !== "none") {
              if (!exdateUpdates[t.parent_id]) exdateUpdates[t.parent_id] = [];
              exdateUpdates[t.parent_id].push(t.date);
            }
          }
          for (const pid of Object.keys(exdateUpdates)) {
            const tpl = await env.DB.prepare("SELECT exdates FROM todo_templates WHERE parent_id = ?").bind(pid).first();
            if (tpl) {
              let currentExdates = tpl.exdates || "[]";
              let changed = false;
              for (const d of exdateUpdates[pid]) {
                const newExdates = addExdate(currentExdates, d);
                if (newExdates !== currentExdates) {
                  currentExdates = newExdates;
                  changed = true;
                }
              }
              if (changed) await env.DB.prepare("UPDATE todo_templates SET exdates = ? WHERE parent_id = ?").bind(currentExdates, pid).run();
            }
          }
        }
      } else if (action === "CREATE") {
        const rptType = task.repeat_type || "none";
        const categoryId = task.category_id || "";
        const repeatEnd = task.repeat_end || "";
        const endTime = task.end_time || "";
        await env.DB.prepare(
          "INSERT INTO todos (id, parent_id, date, text, time, priority, desc, url, copy_text, subtasks, search_terms, done, deleted, repeat_type, repeat_custom, repeat_end, end_time, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          task.id,
          task.id,
          date,
          task.text,
          task.time || "",
          task.priority || "low",
          task.desc || "",
          task.url || "",
          task.copyText || "",
          JSON.stringify(task.subtasks || []),
          JSON.stringify(task.search_terms || []),
          0,
          0,
          rptType,
          "",
          repeatEnd,
          endTime,
          categoryId
        ).run();
        if (rptType !== "none") {
          await env.DB.prepare(
            "INSERT INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(
            task.id,
            task.text,
            task.time || "",
            task.priority || "low",
            task.desc || "",
            task.url || "",
            task.copyText || "",
            JSON.stringify(task.subtasks || []),
            JSON.stringify(task.search_terms || []),
            rptType,
            "",
            repeatEnd,
            endTime,
            date,
            "[]",
            categoryId
          ).run();
        }
      } else if (action === "UPDATE") {
        const rptType = task.repeat_type || "none";
        const subtasksStr = JSON.stringify(task.subtasks || []);
        const searchTermsStr = JSON.stringify(task.search_terms || []);
        const categoryId = task.category_id || "";
        const repeatEnd = task.repeat_end || "";
        const endTime = task.end_time || "";
        const newDate = task.date || date;
        const dateChanged = newDate !== date;
        const parentId = task.parentId || task.parent_id;
        const isSeries = task.isSeries || parentId && parentId !== task.id;
        const newValues = {
          text: task.text,
          time: task.time || "",
          priority: task.priority || "low",
          desc: task.desc || "",
          url: task.url || "",
          copyText: task.copyText || "",
          subtasks: subtasksStr,
          search_terms: searchTermsStr,
          repeat_type: rptType,
          repeat_custom: "",
          repeat_end: repeatEnd,
          end_time: endTime,
          category_id: categoryId,
          date: newDate
        };
        if (!isSeries || !scope || scope === "none") {
          if (rptType !== "none") {
            await env.DB.prepare(
              "UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?"
            ).bind(newDate, task.text, task.time || "", task.priority || "low", task.desc || "", task.url || "", task.copyText || "", subtasksStr, searchTermsStr, rptType, "", repeatEnd, endTime, categoryId, task.id).run();
            await env.DB.prepare(
              "INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ).bind(
              task.id,
              task.text,
              task.time || "",
              task.priority || "low",
              task.desc || "",
              task.url || "",
              task.copyText || "",
              subtasksStr,
              searchTermsStr,
              rptType,
              "",
              repeatEnd,
              endTime,
              newDate,
              "[]",
              categoryId
            ).run();
          } else if (parentId && parentId !== task.id) {
            await env.DB.prepare(
              "UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type='none', repeat_custom='', repeat_end='', end_time=?, category_id=? WHERE id=?"
            ).bind(task.id, newDate, task.text, task.time || "", task.priority || "low", task.desc || "", task.url || "", task.copyText || "", subtasksStr, searchTermsStr, endTime, categoryId, task.id).run();
            const tpl = await env.DB.prepare("SELECT exdates FROM todo_templates WHERE parent_id = ?").bind(parentId).first();
            if (tpl) {
              const currentExdates = tpl.exdates || "[]";
              const newExdates = addExdate(currentExdates, date);
              await env.DB.prepare("UPDATE todo_templates SET exdates = ? WHERE parent_id = ?").bind(newExdates, parentId).run();
            }
          } else {
            await env.DB.prepare(
              "UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?"
            ).bind(newDate, task.text, task.time || "", task.priority || "low", task.desc || "", task.url || "", task.copyText || "", subtasksStr, searchTermsStr, rptType, "", repeatEnd, endTime, categoryId, task.id).run();
          }
        } else {
          const actions = computeUpdateActions({ task, date, scope, newValues });
          if (actions.currentTodo) {
            const cv = actions.currentTodo;
            if (cv.detachFromSeries) {
              if (cv.newSeries) {
                await env.DB.prepare(
                  "UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?"
                ).bind(task.id, newDate, task.text, task.time || "", task.priority || "low", task.desc || "", task.url || "", task.copyText || "", subtasksStr, searchTermsStr, rptType, "", repeatEnd, endTime, categoryId, task.id).run();
                await env.DB.prepare(
                  "INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                ).bind(
                  task.id,
                  task.text,
                  task.time || "",
                  task.priority || "low",
                  task.desc || "",
                  task.url || "",
                  task.copyText || "",
                  subtasksStr,
                  searchTermsStr,
                  rptType,
                  "",
                  repeatEnd,
                  endTime,
                  newDate,
                  "[]",
                  categoryId
                ).run();
              } else {
                await env.DB.prepare(
                  "UPDATE todos SET parent_id=?, date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type='none', repeat_custom='', repeat_end='', end_time=?, category_id=? WHERE id=?"
                ).bind(task.id, newDate, task.text, task.time || "", task.priority || "low", task.desc || "", task.url || "", task.copyText || "", subtasksStr, searchTermsStr, endTime, categoryId, task.id).run();
              }
            } else if (cv.isRecurring) {
              await env.DB.prepare(
                "UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE id=?"
              ).bind(newDate, task.text, task.time || "", task.priority || "low", task.desc || "", task.url || "", task.copyText || "", subtasksStr, searchTermsStr, rptType, "", repeatEnd, endTime, categoryId, task.id).run();
            } else {
              await env.DB.prepare(
                "UPDATE todos SET date=?, text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type='none', repeat_custom='', repeat_end='', category_id=? WHERE id=?"
              ).bind(newDate, task.text, task.time || "", task.priority || "low", task.desc || "", task.url || "", task.copyText || "", subtasksStr, searchTermsStr, categoryId, task.id).run();
            }
          }
          if (actions.pastTodos) {
            const pt = actions.pastTodos;
            if (pt.type === "set_repeat_end") {
              const prevDate = getPreviousDate(date);
              await env.DB.prepare(
                "UPDATE todos SET repeat_end=? WHERE parent_id=? AND date < ? AND repeat_type != 'none' AND (repeat_end = '' OR repeat_end IS NULL) AND deleted = 0"
              ).bind(prevDate, parentId, date).run();
            }
          }
          if (scope === "thisAndFuture") {
            if (rptType !== "none") {
              if (dateChanged) {
                await env.DB.prepare(
                  "DELETE FROM todos WHERE parent_id=? AND id != ? AND date >= ? AND deleted = 0"
                ).bind(parentId, task.id, date).run();
              } else {
                await env.DB.prepare(
                  "UPDATE todos SET text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE parent_id=? AND id != ? AND date >= ? AND deleted = 0"
                ).bind(task.text, task.time || "", task.priority || "low", task.desc || "", task.url || "", task.copyText || "", subtasksStr, searchTermsStr, rptType, "", repeatEnd, endTime, categoryId, parentId, task.id, date).run();
              }
            } else {
              await env.DB.prepare(
                "DELETE FROM todos WHERE parent_id=? AND id != ? AND date > ? AND deleted = 0"
              ).bind(parentId, task.id, date).run();
            }
          } else if (scope === "all") {
            if (rptType !== "none") {
              if (dateChanged) {
                await env.DB.prepare(
                  "DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0"
                ).bind(parentId, task.id).run();
              } else {
                await env.DB.prepare(
                  "UPDATE todos SET text=?, time=?, priority=?, desc=?, url=?, copy_text=?, subtasks=?, search_terms=?, repeat_type=?, repeat_custom=?, repeat_end=?, end_time=?, category_id=? WHERE parent_id=? AND id != ? AND deleted = 0"
                ).bind(task.text, task.time || "", task.priority || "low", task.desc || "", task.url || "", task.copyText || "", subtasksStr, searchTermsStr, rptType, "", repeatEnd, endTime, categoryId, parentId, task.id).run();
              }
            } else {
              await env.DB.prepare(
                "DELETE FROM todos WHERE parent_id=? AND id != ? AND deleted = 0"
              ).bind(parentId, task.id).run();
            }
          }
          if (actions.template) {
            const tmpl = actions.template;
            if (tmpl.type === "add_exdate") {
              const tpl = await env.DB.prepare("SELECT exdates FROM todo_templates WHERE parent_id = ?").bind(parentId).first();
              if (tpl) {
                const currentExdates = tpl.exdates || "[]";
                const newExdates = addExdate(currentExdates, date);
                await env.DB.prepare("UPDATE todo_templates SET exdates = ? WHERE parent_id = ?").bind(newExdates, parentId).run();
              }
            } else if (tmpl.type === "set_repeat_end") {
              const prevDate = getPreviousDate(date);
              await env.DB.prepare("UPDATE todo_templates SET repeat_end=? WHERE parent_id=?").bind(prevDate, parentId).run();
            } else if (tmpl.type === "update_from_date" || tmpl.type === "update_all") {
              if (rptType !== "none") {
                let existingExdates = "[]";
                try {
                  const existingTpl = await env.DB.prepare(
                    "SELECT exdates FROM todo_templates WHERE parent_id = ?"
                  ).bind(parentId).first();
                  if (existingTpl) {
                    existingExdates = existingTpl.exdates || "[]";
                  }
                } catch (e) {
                }
                await env.DB.prepare(
                  "INSERT OR REPLACE INTO todo_templates (parent_id, text, time, priority, desc, url, copy_text, subtasks, search_terms, repeat_type, repeat_custom, repeat_end, end_time, anchor_date, exdates, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                ).bind(
                  parentId,
                  task.text,
                  task.time || "",
                  task.priority || "low",
                  task.desc || "",
                  task.url || "",
                  task.copyText || "",
                  subtasksStr,
                  searchTermsStr,
                  rptType,
                  "",
                  repeatEnd,
                  endTime,
                  newDate,
                  existingExdates,
                  categoryId
                ).run();
              }
            } else if (tmpl.type === "delete") {
              await env.DB.prepare("DELETE FROM todo_templates WHERE parent_id=?").bind(parentId).run();
            }
          }
        }
      } else if (action === "DELETE") {
        const parentId = task.parentId || task.parent_id;
        const isSeries = task.isSeries || parentId && parentId !== task.id;
        if (!isSeries || !scope) {
          await env.DB.prepare("UPDATE todos SET deleted = 1 WHERE id = ?").bind(task.id).run();
        } else {
          const actions = computeDeleteActions({ task, date, scope });
          if (actions.deleteTodoIds && actions.deleteTodoIds.length > 0) {
            for (const todoId of actions.deleteTodoIds) {
              await env.DB.prepare("UPDATE todos SET deleted = 1 WHERE id = ?").bind(todoId).run();
            }
          }
          if (actions.updateTemplate) {
            const tmpl = actions.updateTemplate;
            if (tmpl.type === "add_exdate") {
              const tpl = await env.DB.prepare("SELECT exdates FROM todo_templates WHERE parent_id = ?").bind(parentId).first();
              if (tpl) {
                const currentExdates = tpl.exdates || "[]";
                const newExdates = addExdate(currentExdates, date);
                await env.DB.prepare("UPDATE todo_templates SET exdates = ? WHERE parent_id = ?").bind(newExdates, parentId).run();
              }
            } else if (tmpl.type === "set_repeat_end") {
              const prevDate = getPreviousDate(date);
              if (tmpl.alsoDeleteFuture) {
                await env.DB.prepare("UPDATE todos SET deleted = 1 WHERE parent_id=? AND date >= ?").bind(parentId, date).run();
              }
              await env.DB.prepare("UPDATE todos SET repeat_end=? WHERE parent_id=? AND date < ? AND repeat_type != 'none'").bind(prevDate, parentId, date).run();
              await env.DB.prepare("UPDATE todo_templates SET repeat_end=? WHERE parent_id=?").bind(prevDate, parentId).run();
            } else if (tmpl.type === "delete_all") {
              await env.DB.prepare("UPDATE todos SET deleted = 1 WHERE parent_id=?").bind(parentId).run();
              await env.DB.prepare("DELETE FROM todo_templates WHERE parent_id=?").bind(parentId).run();
            }
          }
          if (actions.deleteTemplate) {
            await env.DB.prepare("DELETE FROM todo_templates WHERE parent_id=?").bind(parentId).run();
          }
        }
      }
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }
    return apiError("Not Found", 404);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : String(e));
  }
}
__name(handleRequest, "handleRequest");

// src/index.js
var src_default = {
  fetch: handleRequest
};

// ../root/.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../root/.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-4eYv8S/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../root/.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-4eYv8S/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
