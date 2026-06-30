export const core = `
    // ==================== RRULE → 中文标签渲染器 ====================
    // 基于 RFC 5545 §3.3.10 (https://icalendar.org/iCalendar-RFC-5545/3-3-10-recurrence-rule.html)
    // 与 ical.js 解析能力对齐。仅前端展示用，不影响后端展开逻辑。
    //
    // 设计：
    // - 覆盖 DAILY/WEEKLY/MONTHLY/YEARLY × BYDAY/BYMONTHDAY/BYMONTH/BYSETPOS/BYWEEKNO/BYYEARDAY/INTERVAL/COUNT/UNTIL
    // - 遇到无法精确翻译的语义（BYHOUR/BYMINUTE/BYSECOND/RSCALE 等）返回 null，
    //   调用方回退到 todo.date 推导或显示通用的"自定义重复"
    // - 所有 token 已被后端 sanitizeRepeatCustom 规范化为大写、剥 RRULE: 前缀

    var _RRULE_WDAY_MAP = { MO:'一', TU:'二', WE:'三', TH:'四', FR:'五', SA:'六', SU:'日' };
    var _RRULE_WDAY_ORDER = ['MO','TU','WE','TH','FR','SA','SU'];
    var _RRULE_ZH_NUM = ['零','一','二','三','四','五','六','七','八','九','十','十一','十二'];
    // 中文序数（仅 1-5 常用，超过用阿拉伯数字）
    function _rruleOrdinalZh(n) {
      var m = ['','第一','第二','第三','第四','第五'];
      return (n >= 1 && n <= 5) ? m[n] : '第' + n + '个';
    }

    // 解析 RRULE 字符串为 token 字典。失败返回 null。
    function _rruleParse(custom) {
      if (!custom || typeof custom !== 'string') return null;
      var s = custom.trim();
      if (!s) return null;
      if (s.startsWith('RRULE:')) s = s.slice(6).trim();
      var parts = s.split(';').filter(function(p) { return p.length > 0; });
      if (!parts.length) return null;
      var tok = {};
      for (var i = 0; i < parts.length; i++) {
        var kv = parts[i].split('=');
        if (kv.length !== 2) return null;
        tok[kv[0].toUpperCase()] = kv[1];
      }
      if (!tok.FREQ) return null;
      return tok;
    }

    // 解析 BYDAY=MO,WE,FR 或 BYDAY=2MO,-1FR 这类形式
    // 返回 [{wday:'MO', ord:0}, ...]；ord=0 表示无序数（weekly），ord=N 表示第 N 个（monthly/yearly）
    // 含未知 wday 代码返回 null
    function _rruleParseByday(bydayStr) {
      if (!bydayStr) return null;
      var tokens = bydayStr.split(',');
      var out = [];
      for (var i = 0; i < tokens.length; i++) {
        var t = (tokens[i] || '').trim();
        if (!t) continue;
        // 匹配可选 [+-]数字 + 星期代码
        var m = t.match(/^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/);
        if (!m) return null;
        var ord = m[1] ? parseInt(m[1], 10) : 0;
        out.push({ wday: m[2], ord: ord });
      }
      return out.length ? out : null;
    }

    // 解析数字列表（如 BYMONTHDAY=1,15）为 int 数组。失败返回 null。
    function _rruleParseNumList(s, min, max) {
      if (!s) return null;
      var tokens = s.split(',');
      var out = [];
      for (var i = 0; i < tokens.length; i++) {
        var n = parseInt(tokens[i], 10);
        if (isNaN(n)) return null;
        if (min !== undefined && n < min) return null;
        if (max !== undefined && n > max) return null;
        out.push(n);
      }
      return out.length ? out : null;
    }

    // 中文数字（用于月份/日）
    function _zhNum(n) {
      if (n >= 1 && n <= 12) return _RRULE_ZH_NUM[n];
      return String(n);
    }

    // BYMONTHDAY 单值中文：1 → "1日"；-1 → "最后一天"；-3 → "倒数第3天"
    function _zhMonthDay(n) {
      if (n > 0) return n + '日';
      if (n === -1) return '最后一天';
      return '倒数第' + (-n) + '天';
    }

    // 主渲染函数：将 repeat_custom 翻译为短中文标签
    // 项目场景：仅覆盖 DAILY/WEEKLY/MONTHLY/YEARLY 的常见重复规则（每天/每周/每月/每年）
    // 不支持：SECONDLY/MINUTELY/HOURLY（后端已拒绝）、BYHOUR/BYMINUTE/BYSECOND（时间段语义，拒绝）、
    //         RSCALE 等 RFC 7529 扩展
    // 保留：COUNT（"重复N次"为合法 RFC 5545 终止条件，渲染为·共N次，供后续场景使用）
    // 遇到不支持 token 返回 null，调用方回退到"自定义重复"或 todo.date 推导
    function _rruleToZhLabel(custom, repeatType, dateStr, interval, repeatEnd) {
      var tok = _rruleParse(custom);
      if (!tok) return null;

      // INTERVAL 来自 custom，优先级低于外部 interval 参数（与后端 buildRRuleString 一致）
      var iv = (interval && interval > 1) ? interval : (tok.INTERVAL ? parseInt(tok.INTERVAL, 10) : 1);
      // 后缀由 FREQ 决定；iv=1 时也需后缀（"每天"/"每周"/"每月"/"每年"）
      var freqUnit = { DAILY:'天', WEEKLY:'周', MONTHLY:'月', YEARLY:'年' }[tok.FREQ];
      if (!freqUnit) return null;
      var ivPrefix = iv > 1 ? '每' + iv + freqUnit : '每' + freqUnit;
      var ivSuffix = '';  // 已合并到 ivPrefix，保留参数以兼容旧代码

      // 拒绝：BYHOUR/BYMINUTE/BYSECOND 是时间段语义（如"每天9点"），项目无此需求
      // 入库了也不能误导成"每天"，直接返 null 走"自定义重复"分支
      if (tok.BYHOUR || tok.BYMINUTE || tok.BYSECOND) return null;

      var label = '';
      var bydays = _rruleParseByday(tok.BYDAY);
      var bymonthdays = _rruleParseNumList(tok.BYMONTHDAY, -31, 31);
      var bymonths = _rruleParseNumList(tok.BYMONTH, 1, 12);
      var byweeknos = _rruleParseNumList(tok.BYWEEKNO, -53, 53);
      var byyeardays = _rruleParseNumList(tok.BYYEARDAY, -366, 366);
      var bysetpos = _rruleParseNumList(tok.BYSETPOS, -366, 366);

      // ----- DAILY -----
      if (tok.FREQ === 'DAILY') {
        // DAILY + 任何 BYxxx 都简化为 "每N天"（BYDAY 在 DAILY 中语义混乱，按规范仅是过滤器）
        label = ivPrefix;
      }
      // ----- WEEKLY -----
      else if (tok.FREQ === 'WEEKLY') {
        if (bydays) {
          // WEEKLY + BYDAY：BYDAY 不得含序数（RFC 5545 强制）
          var hasOrd = bydays.some(function(d) { return d.ord !== 0; });
          if (hasOrd) return null;
          // 排序后拼接
          var sorted = bydays.slice().sort(function(a, b) {
            return _RRULE_WDAY_ORDER.indexOf(a.wday) - _RRULE_WDAY_ORDER.indexOf(b.wday);
          });
          var wdayZh = '';
          for (var i = 0; i < sorted.length; i++) wdayZh += _RRULE_WDAY_MAP[sorted[i].wday];
          label = ivPrefix + wdayZh;
        } else {
          // WEEKLY 无 BYDAY：回退到 dateStr 当日星期
          if (dateStr) {
            var dp = dateStr.split('-');
            if (dp.length === 3) {
              var dw = new Date(dp[0], dp[1]-1, dp[2]).getDay();
              var wdayZhFallback = '日一二三四五六'[dw];
              label = ivPrefix + wdayZhFallback;
            } else {
              label = ivPrefix;
            }
          } else {
            label = ivPrefix;
          }
        }
      }
      // ----- MONTHLY -----
      else if (tok.FREQ === 'MONTHLY') {
        if (bydays && !bymonthdays) {
          // BYDAY + BYSETPOS：取最后一个序数
          if (bysetpos && bysetpos.length === 1) {
            var sp = bysetpos[0];
            // BYDAY 仅取 1 个 wday（多 wday + BYSETPOS 中文歧义大，回退）
            if (bydays.length === 1) {
              var d = bydays[0];
              var ordZh = sp > 0 ? _rruleOrdinalZh(sp) : '倒数第' + (-sp);
              label = ivPrefix + ordZh + '周' + _RRULE_WDAY_MAP[d.wday];
            } else {
              // 多 wday + BYSETPOS=-1：例如 "每月最后一个工作日"
              if (sp === -1) {
                var sorted2 = bydays.slice().sort(function(a, b) {
                  return _RRULE_WDAY_ORDER.indexOf(a.wday) - _RRULE_WDAY_ORDER.indexOf(b.wday);
                });
                // 检测 MO-FR 组合 → "工作日"；SA,SU 组合 → "周末"
                var wdaySet = sorted2.map(function(d) { return d.wday; }).join(',');
                if (wdaySet === 'MO,TU,WE,TH,FR') {
                  label = ivPrefix + '最后工作日';
                } else if (wdaySet === 'SA,SU') {
                  label = ivPrefix + '最后周末';
                } else {
                  var wdayZh2 = '';
                  for (var j = 0; j < sorted2.length; j++) wdayZh2 += _RRULE_WDAY_MAP[sorted2[j].wday];
                  label = ivPrefix + '最后' + wdayZh2;
                }
              } else {
                return null;
              }
            }
          } else if (bysetpos) {
            return null;
          } else {
            // BYDAY 含序数（如 2MO = 每月第2周周一）
            if (bydays.length === 1) {
              var dd = bydays[0];
              if (dd.ord !== 0) {
                var ordZh2 = dd.ord > 0 ? _rruleOrdinalZh(dd.ord) : '倒数第' + (-dd.ord);
                label = ivPrefix + ordZh2 + '周' + _RRULE_WDAY_MAP[dd.wday];
              } else {
                // 无序数：每月所有周一（中文表达"每月周一"）
                label = ivPrefix + _RRULE_WDAY_MAP[dd.wday];
              }
            } else {
              return null;  // 多 wday 无 BYSETPOS，语义模糊
            }
          }
        } else if (bymonthdays && !bydays) {
          // BYMONTHDAY：如 1,15 → "每月1日和15日"
          if (bymonthdays.length === 1) {
            label = ivPrefix + _zhMonthDay(bymonthdays[0]);
          } else if (bymonthdays.length === 2) {
            label = ivPrefix + _zhMonthDay(bymonthdays[0]) + '和' + _zhMonthDay(bymonthdays[1]);
          } else {
            label = ivPrefix + '多日';
          }
        } else if (bymonthdays && bydays) {
          return null;  // 组合过复杂，回退
        } else {
          // MONTHLY 无 BYxxx：用 dateStr 当日
          if (dateStr) {
            var mp = dateStr.split('-');
            if (mp.length === 3) label = ivPrefix + parseInt(mp[2], 10) + '号';
            else label = ivPrefix;
          } else {
            label = ivPrefix;
          }
        }
      }
      // ----- YEARLY -----
      else if (tok.FREQ === 'YEARLY') {
        if (bymonths && bymonthdays && bymonths.length === 1 && bymonthdays.length === 1) {
          // BYMONTH=2;BYMONTHDAY=29 → "每年2月29日"
          label = ivPrefix + _zhNum(bymonths[0]) + '月' + bymonthdays[0] + '日';
        } else if (bymonths && bydays && bymonths.length === 1 && bydays.length === 1) {
          // BYMONTH=5;BYDAY=2MO → "每年5月第2周周一"
          var dd2 = bydays[0];
          var ordZh3 = dd2.ord > 0 ? _rruleOrdinalZh(dd2.ord) : (dd2.ord < 0 ? '倒数第' + (-dd2.ord) : '');
          label = ivPrefix + _zhNum(bymonths[0]) + '月' + ordZh3 + '周' + _RRULE_WDAY_MAP[dd2.wday];
        } else if (byweeknos && bydays && byweeknos.length === 1 && bydays.length === 1) {
          // BYWEEKNO=1;BYDAY=MO → "每年第1周周一"
          var dd3 = bydays[0];
          var wn = byweeknos[0];
          var wnZh = wn > 0 ? '第' + wn + '周' : '倒数第' + (-wn) + '周';
          label = ivPrefix + wnZh + _RRULE_WDAY_MAP[dd3.wday];
        } else if (bymonths || bydays || bymonthdays || byweeknos || byyeardays || bysetpos) {
          // 含未支持的 BYxxx 组合（如多 BYMONTH、BYYEARDAY 等），不回退 dateStr 避免误导
          return null;
        } else {
          // YEARLY 无 BYxxx：回退到 dateStr
          if (dateStr) {
            var yp = dateStr.split('-');
            if (yp.length === 3) label = ivPrefix + parseInt(yp[1], 10) + '月' + parseInt(yp[2], 10) + '日';
            else label = ivPrefix;
          } else {
            label = ivPrefix;
          }
        }
      } else {
        return null;
      }

      // 追加 repeat_end / UNTIL / COUNT 终止条件
      // COUNT 为合法 RFC 5545 终止条件，渲染为·共N次（供后续场景使用）
      if (repeatEnd) {
        label += '·至' + repeatEnd;
      } else if (tok.UNTIL) {
        // UNTIL 格式 YYYYMMDD 或 YYYYMMDDTHHMMSSZ，截取日期部分
        var untilDate = tok.UNTIL.length >= 8 ? tok.UNTIL.slice(0, 4) + '-' + tok.UNTIL.slice(4, 6) + '-' + tok.UNTIL.slice(6, 8) : '';
        if (untilDate) label += '·至' + untilDate;
      } else if (tok.COUNT) {
        label += '·共' + tok.COUNT + '次';
      }

      return label;
    }

    // 兼容旧调用名（保留 _bydayToZh 作为 weekly 专用快捷入口，但内部走新渲染器）
    function _bydayToZh(custom) {
      var tok = _rruleParse(custom);
      if (!tok || tok.FREQ !== 'WEEKLY') return null;
      var bydays = _rruleParseByday(tok.BYDAY);
      if (!bydays) return null;
      var hasOrd = bydays.some(function(d) { return d.ord !== 0; });
      if (hasOrd) return null;
      var sorted = bydays.slice().sort(function(a, b) {
        return _RRULE_WDAY_ORDER.indexOf(a.wday) - _RRULE_WDAY_ORDER.indexOf(b.wday);
      });
      var zh = '';
      for (var i = 0; i < sorted.length; i++) zh += _RRULE_WDAY_MAP[sorted[i].wday];
      return zh;
    }
    var _isOffline = !navigator.onLine;
    // 统一通知条：复用 preview-notice，合并预览/离线提示
    function _updateNoticeBar() {
      var notice = document.getElementById('preview-notice');
      if (!notice) return;
      var hasPreview = localStorage.getItem('preview_custom_header') !== null || localStorage.getItem('preview_custom_content') !== null;
      var parts = [];
      if (hasPreview) parts.push('⚠ 前端定制预览状态 — 自定义仅在本地生效 <span class="md-code" style="cursor:pointer;margin-left:8px;background:#000;color:var(--warn);" onclick="restoreAllPreview()">还原</span>');
      if (_isOffline) parts.push('离线模式 — 数据为上次缓存');
      if (parts.length > 0) {
        notice.innerHTML = parts.join(' &nbsp;|&nbsp; ');
        notice.classList.remove('hidden');
        document.body.style.paddingTop = '40px';
      } else {
        notice.classList.add('hidden');
        notice.innerHTML = '';
        document.body.style.paddingTop = '';
      }
    }
    window.addEventListener('online', function() { _isOffline = false; _updateNoticeBar(); });
    window.addEventListener('offline', function() { _isOffline = true; _updateNoticeBar(); });

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
      }
      _updateNoticeBar();
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
        if (currentThemeMode === 'auto') btn.innerText = '自动';
        else if (currentThemeMode === 'light') btn.innerText = '亮色';
        else btn.innerText = '暗色';
      }
      // stats.js 用 MutationObserver 监听 data-theme 变化重绘 ECharts，无需在此通知
    }

    function toggleTheme() {
      if (currentThemeMode === 'auto') currentThemeMode = 'light';
      else if (currentThemeMode === 'light') currentThemeMode = 'dark';
      else currentThemeMode = 'auto';
      localStorage.setItem('themeMode', currentThemeMode);
      applyTheme();
    }
    applyTheme();
    // auto 模式仅在跨越 6:00 / 18:00 临界点时才调 applyTheme（消除原每分钟空跑）
    var _lastAutoHour = (currentThemeMode === 'auto') ? new Date().getHours() : -1;
    setInterval(function() {
      if (currentThemeMode !== 'auto') return;
      var h = new Date().getHours();
      // 检测是否跨越临界点（6 或 18）：上一小时与当前小时分属不同区间
      var prevDay = (_lastAutoHour >= 6 && _lastAutoHour < 18);
      var curDay = (h >= 6 && h < 18);
      if (prevDay !== curDay) {
        _lastAutoHour = h;
        applyTheme();
      } else {
        _lastAutoHour = h;
      }
    }, 60000);
    setInterval(function() { if (todos.some(function(t){ return !t.done && t.end_time && t.time && t.date; })) renderTodos(); }, 60000);

    let currentDate = new Date();
    let todos =[];
    let currentDetailIndex = -1;
    let isEditMode = false;
    let pendingAction = null; 
    let filterMethod = 'all';
    let filterCategoryIds = new Set();
    
    let tempSubtasks =[];
    let tempSearchTerms =[];
    let addSearchState = false;
    let tempSearchProvider = 'auto';

    let tempPriority = 'low'; 
    let tempTime = ''; 
    let tempEndTime = '';
    let tempRepeatType = 'none';
    let tempRepeatEnd = '';
    let tempRepeatInterval = 1;
    let tempAddDate = '';
    let tempEditDate = '';
    // 碎时记 (fragment) 起始日期：空字符串=任意日期都出现；'YYYY-MM-DD'=该日期及之后出现
    let tempFragmentAnchor = '';
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
    let tempSetApiKeyScope = 'v1';
    let customCodeEnabled = false;
    
    let sessionsList = [];
    
    var CURRENT_VERSION = 'v\${APP_VERSION}';
    var remoteLatestVersion = null;  // 远端最新版本号（仅用于 checkUpdate 提示）

    function initVersionDisplay() {
      var el = document.getElementById('app-version-display');
      if (el) {
        el.textContent = CURRENT_VERSION;
        el.style.cursor = 'pointer';
        el.onclick = function() { openChangelogModal(); };
      }
    }

    // 检查版本号是否有更新，用于设置页"→ vX.X.X"提示
    async function checkUpdate() {
      var s = document.getElementById('update-status');
      if (!s) return;
      s.innerHTML = '<span style="color:#888;font-size:0.8rem;">检查中...</span>';

      // 缓存键：vcheck_data (version.json 内容) + vcheck_ts (时间戳)
      var CACHE_TTL_MS = 24 * 60 * 60 * 1000;
      var now = Date.now();
      var cachedTs = 0;
      var cachedData = null;
      try {
        cachedTs = parseInt(localStorage.getItem('vcheck_ts') || '0', 10);
        cachedData = localStorage.getItem('vcheck_data');
      } catch (e) { /* localStorage 不可用时降级为每次都请求 */ }

      var d = null;
      var fromCache = false;
      if (cachedData && (now - cachedTs) < CACHE_TTL_MS) {
        // 缓存有效
        try { d = JSON.parse(cachedData); fromCache = true; } catch (e) { d = null; }
      }

      if (!d) {
        // 缓存无效或过期，发请求
        try {
          var res = await fetch('https://raw.githubusercontent.com/moaradc/cf-todo/main/version.json');
          if (!res.ok) throw new Error('HTTP ' + res.status);
          d = await res.json();
          if (!d.version) throw new Error('No version');
          // 写入缓存
          try {
            localStorage.setItem('vcheck_ts', String(now));
            localStorage.setItem('vcheck_data', JSON.stringify(d));
          } catch (e) { /* 配额满等忽略 */ }
        } catch (e) {
          // 请求失败：回退到缓存（即使过期），避免断网时显示"检查失败"
          if (cachedData) {
            try { d = JSON.parse(cachedData); fromCache = true; } catch (e2) { d = null; }
          }
          if (!d) {
            remoteLatestVersion = null;
            s.innerHTML = '<span style="color:var(--accent);font-size:0.8rem;">检查失败</span>';
            return;
          }
        }
      }

      var latest = d.version;
      var cmp = compareVersions(CURRENT_VERSION, latest);
      if (cmp < 0) {
        remoteLatestVersion = latest;
        s.innerHTML = '<span style="font-size:0.8rem;font-weight:bold;cursor:pointer;color:var(--accent);" onclick="openChangelogModal()">→ v' + escapeHtml(latest) + '</span>';
      } else {
        remoteLatestVersion = null;
        s.innerHTML = '<span style="font-size:0.8rem;">已是最新' + (fromCache ? '' : '') + '</span>';
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
      div.appendChild(document.createTextNode(text == null ? '' : String(text)));
      // textContent->innerHTML 只转义 & < >；补转义引号以安全用于属性值
      return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // 实时从 GitHub 拉取最新 changelog（改 version.json 推 main 后立即可见）
    var _changelogLoading = false;
    function openChangelogModal() {
      var overlay = document.getElementById('modal-changelog');
      if (!overlay) return;
      var body = document.getElementById('changelog-body');
      if (!body) return;
      overlay.classList.add('active');
      _navPush('modal-changelog', closeChangelogModal, '/changelog');
      // 防止重复点击重复请求
      if (_changelogLoading) return;
      _changelogLoading = true;
      body.innerHTML = '<div style="text-align:center;color:#888;padding:30px;">加载中...</div>';
      fetch('https://raw.githubusercontent.com/moaradc/cf-todo/main/version.json')
        .then(function(res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function(d) {
          _changelogLoading = false;
          var changelog = (d && d.changelog && Array.isArray(d.changelog)) ? d.changelog : [];
          if (changelog.length === 0) {
            body.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">暂无更新日志</div>';
            return;
          }
          var html = '';
          for (var i = 0; i < changelog.length; i++) {
            var e = changelog[i];
            var entryCmp = compareVersions(CURRENT_VERSION, 'v' + e.version);
            var isNewer = entryCmp < 0;
            var isCurrent = entryCmp === 0;
            html += '<div class="changelog-entry' + (isNewer ? ' changelog-new' : '') + '">';
            html += '<div class="changelog-version">v' + escapeHtml(e.version);
            if (isNewer) html += ' <span style="font-size:0.7rem;color:var(--accent);">新版本可用</span>';
            else if (isCurrent) html += ' <span style="font-size:0.7rem;color:#666;">当前版本</span>';
            html += '</div>';
            if (e.date) html += '<div class="changelog-date">' + escapeHtml(e.date) + '</div>';
            if (e.notes) html += '<div class="changelog-notes">' + parseMarkdown(e.notes) + '</div>';
            html += '</div>';
          }
          body.innerHTML = html;
        })
        .catch(function(e) {
          _changelogLoading = false;
          body.innerHTML = '<div style="text-align:center;color:var(--accent);padding:20px;">加载失败，请稍后重试</div>';
        });
    }

    function closeChangelogModal() {
      if (_isNavClosing) {
        var overlay = document.getElementById('modal-changelog');
        if (overlay) overlay.classList.remove('active');
        return;
      }
      _navClose('modal-changelog');
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
        container.innerHTML = '<div class="settings-text" style="text-align:center; padding: 10px;">暂无活跃会话</div>';
        return;
      }
      container.innerHTML = sessionsList.map(function(s, i) {
        var actions = '';
        if (s.isCurrent) {
          actions += '<span style="font-size:0.7rem;color:#666;">当前会话</span>';
        } else {
          actions += '<button class="btn-danger" onclick="deleteSessionByIndex(' + i + ')">删除</button>';
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
      if (!confirm('确认删除该会话？删除后需要重新登录。')) return;
      await fetch('/api/session-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'DELETE', ua: s.ua }),
        headers: { 'Content-Type': 'application/json' }
      });
      loadSessions();
    }

    async function deleteAllSessions() {
      if (!confirm('确认删除全部会话？删除后需要重新登录。')) return;
      await fetch('/api/session-action', {
        method: 'POST',
        body: JSON.stringify({ action: 'DELETE_ALL' }),
        headers: { 'Content-Type': 'application/json' }
      });
      // 服务端会话已清空，刷新到 / 会落到登录界面
      await refreshToHome();
    }

    // ==================== API Key 管理 ====================

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
        container.innerHTML = '<div class="settings-text" style="text-align:center; padding: 10px;">暂无 API 密钥</div>';
        return;
      }
      container.innerHTML = apiKeysList.map(function(k, i) {
        var statusTag = k.disabled ? '<span class="apikey-status disabled">已禁用</span>' : '<span class="apikey-status">活跃</span>';
        var lastUsed = k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '从未使用';
        return '<div class="session-item' + (k.disabled ? '' : '') + '">' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">' +
              '<span style="font-weight:bold;font-size:0.85rem;">' + escapeHtml(k.name || '未命名') + '</span>' +
              statusTag +
            '</div>' +
            '<div style="font-size:0.75rem;color:#666;margin-top:3px;font-family:monospace;">' + escapeHtml(k.keyPrefix) + '</div>' +
            '<div style="font-size:0.7rem;color:#555;margin-top:2px;">最后使用: ' + lastUsed + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:4px;flex-shrink:0;">' +
            '<button style="padding:4px 8px;font-size:0.75rem;" onclick="toggleApiKey(' + i + ')">' + (k.disabled ? '启用' : '禁用') + '</button>' +
            '<button class="btn-danger" style="padding:4px 8px;font-size:0.75rem;" onclick="deleteApiKey(' + i + ')">删除</button>' +
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
            alert(data.error || '创建失败');
          }
        } else {
          const err = await res.json();
          alert(err.error || '创建失败');
        }
      } catch(e) {
        alert('创建失败: ' + e.message);
      }
    }

    async function deleteApiKey(index) {
      var k = apiKeysList[index];
      if (!k) return;
      if (!confirm('确认删除密钥 "' + (k.name || '未命名') + '"？删除后使用此密钥的程序将无法访问。')) return;
      try {
        await fetch('/api/v1/keys', {
          method: 'POST',
          body: JSON.stringify({ action: 'DELETE', id: k.id }),
          headers: { 'Content-Type': 'application/json' }
        });
        await loadApiKeys();
      } catch(e) {
        alert('删除失败: ' + e.message);
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
        alert('操作失败: ' + e.message);
      }
    }
    
    let tempAppScale = 1.0;
    let tempDisplayScale = 1.0;
    let tempBaseFontSize = 16;

    function applyAppScale(scale) {
      document.documentElement.style.setProperty('--app-scale', scale);
    }

    function applyDisplayScale(scale) {
      document.documentElement.style.setProperty('--display-scale', scale);
    }

    function applyBaseFontSize(px) {
      document.documentElement.style.setProperty('--base-font-size', px + 'px');
    }

    function onScaleSliderChange(val) {
      tempAppScale = parseFloat(val);
      document.getElementById('scale-value-display').innerText = Math.round(tempAppScale * 100) + '%';
      updateCombinedPreview();
      updateScalePresetButtons();
    }

    function setScalePreset(val) {
      tempAppScale = val;
      document.getElementById('scale-slider').value = val;
      document.getElementById('scale-value-display').innerText = Math.round(val * 100) + '%';
      updateCombinedPreview();
      updateScalePresetButtons();
    }

    function updateScalePresetButtons() {
      var btns = document.querySelectorAll('.scale-preset-btn[data-scale]');
      var presets = [0.85, 1.0, 1.15];
      btns.forEach(function(btn, i) {
        if (i < presets.length && Math.abs(tempAppScale - presets[i]) < 0.02) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    function onFontSizeSliderChange(val) {
      tempBaseFontSize = parseInt(val, 10);
      document.getElementById('fontsize-value-display').innerText = tempBaseFontSize + 'px';
      updateCombinedPreview();
      updateFontSizePresetButtons();
    }

    function setFontSizePreset(val) {
      tempBaseFontSize = val;
      document.getElementById('fontsize-slider').value = val;
      document.getElementById('fontsize-value-display').innerText = val + 'px';
      updateCombinedPreview();
      updateFontSizePresetButtons();
    }

    function updateFontSizePresetButtons() {
      var btns = document.querySelectorAll('.scale-preset-btn[data-fontsize]');
      var presets = [14, 16, 18];
      btns.forEach(function(btn, i) {
        if (i < presets.length && tempBaseFontSize === presets[i]) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    function onDisplayScaleSliderChange(val) {
      tempDisplayScale = parseFloat(val);
      document.getElementById('displayscale-value-display').innerText = Math.round(tempDisplayScale * 100) + '%';
      updateCombinedPreview();
      updateDisplayScalePresetButtons();
    }

    function setDisplayScalePreset(val) {
      tempDisplayScale = val;
      document.getElementById('displayscale-slider').value = val;
      document.getElementById('displayscale-value-display').innerText = Math.round(val * 100) + '%';
      updateCombinedPreview();
      updateDisplayScalePresetButtons();
    }

    function updateDisplayScalePresetButtons() {
      var btns = document.querySelectorAll('.scale-preset-btn[data-displayscale]');
      var presets = [0.9, 1.0, 1.1];
      btns.forEach(function(btn, i) {
        if (i < presets.length && Math.abs(tempDisplayScale - presets[i]) < 0.02) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    function updateCombinedPreview() {
      var preview = document.getElementById('combined-preview');
      if (!preview) return;
      var previewWrap = preview.closest('.scale-preview-wrap');
      // Apply app scale (zoom) to the wrapper, display scale (zoom) and font size to the preview itself
      if (previewWrap) {
        previewWrap.style.zoom = tempAppScale;
      }
      preview.style.zoom = tempDisplayScale;
      preview.style.fontSize = tempBaseFontSize + 'px';
    }

    function createTodoElement(todo, index) {
      var el = document.createElement('div');
      el.className = 'todo-item ' + (todo.done ? 'done' : '') + (todo.priority === 'high' ? ' pri-high' : todo.priority === 'med' ? ' pri-med' : ' pri-low');

      // 计时状态：先确定是否激活（用于 badges 行显示"计时中"标签）
      var timerState = null;
      var canTimer = !todo.done && todo.type && todo.type !== 'none';
      if (!canTimer) {
        if (readTimerState(todo.id)) writeTimerState(todo.id, null);
      } else {
        timerState = maybePruneStaleTimer(todo.id);
      }
      var timerActive = !!timerState;

      var badges = '';
      // 计时中标签置顶（样式与"每天"等重复标签一致）
      if (timerActive) {
        badges += '<span class="badge" style="background:transparent;border:1px solid var(--accent);color:var(--accent);">计时中</span> ';
      }
      if (todo.time) {
        var timeLabel = todo.time;
        if (todo.end_time) timeLabel += '-' + todo.end_time;
        badges += '<span class="badge badge-time">' + escapeHtml(timeLabel) + '</span> ';
      }

      if (!todo.done && todo.end_time && todo.time && todo.date) {
        var now = new Date();
        var dateStr = todo.date;
        var endMs = new Date(dateStr + 'T' + todo.end_time + ':00').getTime();
        var startMs = new Date(dateStr + 'T' + todo.time + ':00').getTime();
        var nowMs = now.getTime();
        if (nowMs > endMs) {
          badges += '<span class="badge badge-overdue">已逾期</span> ';
        } else if (endMs - nowMs <= 30 * 60 * 1000 && nowMs >= startMs) {
          var remainMin = Math.ceil((endMs - nowMs) / 60000);
          badges += '<span class="badge badge-warning">剩余' + remainMin + '分钟</span> ';
        }
      }

      if (todo.type && todo.type !== 'none') {
        var repeatLabel = '';
        if (todo.type === 'fragment') {
          // 碎时记: 一次性浮动事项，固定显示"碎时记"标签
          repeatLabel = '碎时记';
        } else if (todo.type === 'recurring') {
          // 从 rrule 解析中文标签
          // 优先使用 _rruleToZhLabel（支持完整 RFC 5545 RRULE，含 UNTIL/COUNT/BYDAY 等）
          // INTERVAL 从 rrule 解析（无 repeat_interval 字段）
          var rruleLabel = todo.rrule ? _rruleToZhLabel(todo.rrule, todo.type, todo.date, null, null) : null;
          if (rruleLabel) {
            repeatLabel = rruleLabel;
          } else if (todo.rrule) {
            // rrule 存在但无法精确翻译
            repeatLabel = '自定义重复';
          } else {
            // 无 rrule（异常数据），回退到通用的"重复"
            repeatLabel = '重复';
          }
        }
        if (repeatLabel) {
          badges += '<span class="badge" style="background:transparent;border:1px solid var(--fg);color:var(--fg);">' + escapeHtml(repeatLabel) + '</span> ';
        }
      }

      if (todo.subtasks && todo.subtasks.length > 0) {
        var completed = todo.subtasks.filter(function(st){ return st.done; }).length;
        badges += '<span class="badge" style="background:transparent;border:1px solid var(--fg);color:var(--fg);">' + completed + '/' + todo.subtasks.length + '</span> ';
      }



      var meta = document.createElement('div');
      meta.className = 'item-meta';
      meta.innerHTML = '<div class="item-title">' + escapeHtml(todo.text) + '</div><div class="item-info">' + badges + '</div>';

      var checkbox = document.createElement('div');
      // 计时激活时点击 checkbox = 结束+完成；不改变 checkbox 视觉（计时状态用 badges 行的"计时中"标签表达）
      checkbox.className = 'checkbox' + (isBatchMode && selectedTasks.has(index) ? ' batch-selected' : '');
      checkbox.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isBatchMode) { toggleBatchSelect(index); return; }
        if (timerActive) { completeTimer(index); return; }
        toggleDone(index);
      });

      el.appendChild(checkbox);
      el.appendChild(meta);

      if (!isBatchMode) {
        if (todo.url) {
          var linkBtn = document.createElement('a');
          // 仅允许 http(s)/ftp 协议，阻断 javascript:/data: 等 XSS 向量
          var safeUrl = String(todo.url).trim();
          if (/^(https?:|ftp:|mailto:|tel:|\\/|\\.\\/|\\.\\.\\/|#)/i.test(safeUrl)) {
            linkBtn.href = safeUrl;
          } else {
            linkBtn.href = '#';
          }
          linkBtn.target = '_blank';
          linkBtn.rel = 'noopener noreferrer';
          linkBtn.className = 'btn-link';
          linkBtn.innerText = '↗';
          linkBtn.addEventListener('click', function(e){ e.stopPropagation(); });
          el.appendChild(linkBtn);
        }
        if (todo.copy_text) {
          var copyBtn = document.createElement('button');
          copyBtn.className = 'btn-link';
          copyBtn.innerText = '⎘';
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
    
    // ECharts 实例集中管理：切换 tab / 关闭面板时统一 dispose
    let chartInstances = {};
    let currentStatsTab = 'weekly';
    let currentStatsRange = '7d'; // 7d / 12w / 12m / year
    let annualYear = null;
    let cachedCategories = null; // 首次进入统计页后缓存，避免重复请求
    let cachedThemeKey = '';     // 主题切换时强制重绘

    // ==================== PWA 安装 ====================
    var _deferredInstallPrompt = null;

    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      _deferredInstallPrompt = e;
    });

    async function installPwa() {
      if (!_deferredInstallPrompt) return;
      _deferredInstallPrompt.prompt();
      await _deferredInstallPrompt.userChoice;
      _deferredInstallPrompt = null;
    }

    function getPwaState() {
      if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) return 'standalone';
      if (_deferredInstallPrompt) return 'installable';
      return 'unsupported';
    }

    function getScaleForUA(arr, ua) {
      if (!Array.isArray(arr)) return 1.0;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].ua === ua) return parseFloat(arr[i].scale) || 1.0;
      }
      return 1.0;
    }

    function setScaleForUA(ua, scale) {
      if (!Array.isArray(appSettings.scaleByBrowser)) {
        appSettings.scaleByBrowser = [];
      }
      for (var i = 0; i < appSettings.scaleByBrowser.length; i++) {
        if (appSettings.scaleByBrowser[i].ua === ua) {
          appSettings.scaleByBrowser[i].scale = scale;
          return;
        }
      }
      appSettings.scaleByBrowser.push({ ua: ua, scale: scale });
      while (appSettings.scaleByBrowser.length > MAX_BROWSER_UA) {
        appSettings.scaleByBrowser.shift();
      }
    }

    function getFontSizeForUA(arr, ua) {
      if (!Array.isArray(arr)) return 16;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].ua === ua) return parseInt(arr[i].fontSize, 10) || 16;
      }
      return 16;
    }

    function setFontSizeForUA(ua, fontSize) {
      if (!Array.isArray(appSettings.fontSizeByBrowser)) {
        appSettings.fontSizeByBrowser = [];
      }
      for (var i = 0; i < appSettings.fontSizeByBrowser.length; i++) {
        if (appSettings.fontSizeByBrowser[i].ua === ua) {
          appSettings.fontSizeByBrowser[i].fontSize = fontSize;
          return;
        }
      }
      appSettings.fontSizeByBrowser.push({ ua: ua, fontSize: fontSize });
      while (appSettings.fontSizeByBrowser.length > MAX_BROWSER_UA) {
        appSettings.fontSizeByBrowser.shift();
      }
    }

    function getDisplayScaleForUA(arr, ua) {
      if (!Array.isArray(arr)) return 1.0;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].ua === ua) return parseFloat(arr[i].displayScale) || 1.0;
      }
      return 1.0;
    }

    function setDisplayScaleForUA(ua, displayScale) {
      if (!Array.isArray(appSettings.displayScaleByBrowser)) {
        appSettings.displayScaleByBrowser = [];
      }
      for (var i = 0; i < appSettings.displayScaleByBrowser.length; i++) {
        if (appSettings.displayScaleByBrowser[i].ua === ua) {
          appSettings.displayScaleByBrowser[i].displayScale = displayScale;
          return;
        }
      }
      appSettings.displayScaleByBrowser.push({ ua: ua, displayScale: displayScale });
      while (appSettings.displayScaleByBrowser.length > MAX_BROWSER_UA) {
        appSettings.displayScaleByBrowser.shift();
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
          var fontSizeByBrowser = Array.isArray(saved.fontSizeByBrowser) ? saved.fontSizeByBrowser : [];
          var matchedFontSize = getFontSizeForUA(fontSizeByBrowser, currentUA);
          var displayScaleByBrowser = Array.isArray(saved.displayScaleByBrowser) ? saved.displayScaleByBrowser : [];
          var matchedDisplayScale = getDisplayScaleForUA(displayScaleByBrowser, currentUA);
          appSettings = {
            provider: saved.provider || 'auto',
            sortMethod: saved.sortMethod || 'time',
            sortAsc: saved.sortAsc !== undefined ? (saved.sortAsc === 'true' || saved.sortAsc === true) : true,
            customCodeEnabled: saved.customCodeEnabled !== undefined ? (saved.customCodeEnabled === 'true' || saved.customCodeEnabled === true) : false,
            apiKeyScope: saved.apiKeyScope || 'v1',
            scaleByBrowser: scaleByBrowser,
            fontSizeByBrowser: fontSizeByBrowser,
            displayScaleByBrowser: displayScaleByBrowser
          };
          tempAppScale = matchedScale;
          tempBaseFontSize = matchedFontSize;
          tempDisplayScale = matchedDisplayScale;
        } else {
          throw new Error('Failed to load DB settings');
        }
      } catch (e) {
        appSettings = { provider: 'auto', sortMethod: 'time', sortAsc: true, customCodeEnabled: false, apiKeyScope: 'v1', scaleByBrowser: [], fontSizeByBrowser: [], displayScaleByBrowser: [] };
        tempAppScale = 1.0;
        tempBaseFontSize = 16;
        tempDisplayScale = 1.0;
      }

      sortMethod = appSettings.sortMethod;
      sortAsc = appSettings.sortAsc;
      tempSearchProvider = appSettings.provider;

      updateViewBtnLabel();
      applyAppScale(tempAppScale);
      applyBaseFontSize(tempBaseFontSize);
      applyDisplayScale(tempDisplayScale);
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
        if (res.ok) {
          localStorage.setItem('moara_authed', '1');
          location.reload();
        } 
        else if (res.status === 429) { alert("连续尝试错误次数过多，IP已被锁定，请 15 分钟后再试！"); } 
        else { alert("密钥验证失败 / 访问被拒绝"); }
      } catch (e) { alert("网络连接失败"); }
    }

    function clearPwaCache() {
      if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return Promise.resolve();
      return new Promise(function(resolve) {
        var sw = navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener('message', function handler(msg) {
          if (msg.data && msg.data.type === 'CACHE_CLEARED') {
            navigator.serviceWorker.removeEventListener('message', handler);
            resolve();
          }
        });
        sw.postMessage({ type: 'CLEAR_CACHE' });
        setTimeout(resolve, 3000);
      });
    }
`;
