(function() {
    'use strict';

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
        if (currentThemeMode === 'auto') btn.innerText = '自动';
        else if (currentThemeMode === 'light') btn.innerText = '亮色';
        else btn.innerText = '暗色';
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
    
    var CURRENT_VERSION = 'v${APP_VERSION}';
    
    function initVersionDisplay() {
      var el = document.getElementById('app-version-display');
      if (el) el.textContent = CURRENT_VERSION;
    }
    
    async function checkUpdate() {
      var s = document.getElementById('update-status');
      if (!s) return;
      s.innerHTML = '<span style="color:#888;font-size:0.8rem;">检查中...</span>';
      try {
        var res = await fetch('https://api.github.com/repos/moaradc/cf-todo/releases/latest', {
          headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var d = await res.json();
        if (!d.tag_name) throw new Error('No tag');
    
        var latest = d.tag_name;
        var cmp = compareVersions(CURRENT_VERSION, latest);
    
        if (cmp < 0) {
          var dl = d.assets && d.assets[0]
            ? ' | <a href="' + d.assets[0].browser_download_url + '" style="color:var(--accent);font-size:0.8rem;text-decoration:none;">下载</a>'
            : '';
          s.innerHTML = '<span style="font-size:0.8rem;font-weight:bold;">→ ' + escapeHtml(latest) + '</span> '
            + '<a href="' + d.html_url + '" target="_blank" style="color:var(--accent);font-size:0.8rem;text-decoration:none;">GitHub</a>' + dl;
        } else {
          s.innerHTML = '<span style="font-size:0.8rem;">已是最新</span>';
        }
      } catch (e) {
        s.innerHTML = '<span style="color:var(--accent);font-size:0.8rem;">检查失败</span>';
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
      location.reload();
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
          badges += '<span class="badge badge-overdue">已逾期</span> ';
        } else if (endMs - nowMs <= 30 * 60 * 1000 && nowMs >= startMs) {
          var remainMin = Math.ceil((endMs - nowMs) / 60000);
          badges += '<span class="badge badge-warning">剩余' + remainMin + '分钟</span> ';
        }
      }

      if (todo.repeat_type && todo.repeat_type !== 'none') {
        var repeatLabel = '';
        if (todo.repeat_type === 'daily') {
          repeatLabel = '每天';
        } else if (todo.repeat_type === 'weekly') {
          var days = ['日','一','二','三','四','五','六'];
          var parts = todo.date.split('-');
          var day = new Date(parts[0], parts[1]-1, parts[2]).getDay();
          repeatLabel = '每周' + days[day];
        } else if (todo.repeat_type === 'monthly') {
          var parts2 = todo.date.split('-');
          repeatLabel = '每月' + parseInt(parts2[2], 10) + '号';
        } else if (todo.repeat_type === 'yearly') {
          var parts3 = todo.date.split('-');
          repeatLabel = '每年' + parseInt(parts3[1], 10) + '月' + parseInt(parts3[2], 10) + '日';
        }
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
        else if (res.status === 429) { alert("连续尝试错误次数过多，IP已被锁定，请 15 分钟后再试！"); } 
        else { alert("密钥验证失败 / 访问被拒绝"); }
      } catch (e) { alert("网络连接失败"); }
    }


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
        prefix = "今日事项";
      } else if (str < todayStr) {
        prefix = "历史归档";
      } else {
        prefix = "未来计划";
      }

      let subText = "";
      if (isLoading) {
        subText = `[ ${prefix} | 拉取中... ]`;
      } else {
        const total = todos.length;
        const done = todos.filter(t => t.done).length;
        subText = `[ ${prefix} | 进度: ${done}/${total} ]`;
      }

      document.getElementById('date-main').innerText = str;
      document.getElementById('date-sub').innerText = subText;
    }

    async function loadTodos() {
      const dateStr = formatDate(currentDate);
      updateDateHeader(true);
      document.getElementById('todo-list').innerHTML = '<div style="padding:20px;text-align:center;">数据拉取中...</div>';
      try {
        const res = await fetch(`/api/todos?date=${dateStr}`);
        if (res.ok) {
          todos = await res.json();
          renderTodos();
        }
      } catch (e) { console.error(e); }
    }

    function updateViewBtnLabel() {
      var fMap = { 'all': '全部', 'todo': '未完成', 'done': '已完成' };
      var sMap = { 'time': '时间', 'priority': '优先级' };
      var catLabel = filterCategoryId ? getCategoryName(filterCategoryId) : '全部分类';
      var el;
      el = document.getElementById('view-tag-filter');
      if (el) el.textContent = fMap[filterMethod];
      el = document.getElementById('view-tag-category');
      if (el) el.textContent = catLabel;
      el = document.getElementById('view-tag-sort');
      if (el) el.textContent = sMap[sortMethod] + '·' + (sortAsc ? '正序' : '倒序');
    }

    function renderViewCategoryBtns() {
      var container = document.getElementById('view-category-btns');
      if (!container) return;
      container.innerHTML = '';
      var allBtn = document.createElement('div');
      allBtn.className = 'category-modal-item' + (!filterCategoryId ? ' selected' : '');
      allBtn.innerHTML = '<span class="cat-name">全部</span>';
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
        listEl.innerHTML = '<div style="padding:40px;text-align:center;border:1px dashed #666;">无数据 // NULL</div>';
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
      if (!confirm(`确认删除选中的 ${selectedTasks.size} 个事项吗？(仅删除当天的当前项)`)) return;
      const ids = Array.from(selectedTasks).map(idx => todos[idx].id);
      await fetch('/api/todo-action', {
        method: 'POST', body: JSON.stringify({ action: 'BATCH_DELETE', ids: ids }),
        headers: { 'Content-Type': 'application/json' }
      });
      exitBatchMode(); loadTodos();
    }



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

      const pMap = {'auto':'自动 (随机源)', 'bilibili':'哔哩哔哩', 'weibo':'微博热搜', 'zhihu':'知乎热榜', 'baidu':'百度热搜'};
      const sMap = {'time':'按时间', 'priority':'按优先级'};

      document.getElementById('set-disp-provider').innerText = pMap[tempSetProvider];
      document.getElementById('set-disp-sort').innerText = sMap[tempSetSort];
      document.getElementById('set-disp-sort-asc').innerText = tempSetSortAsc ? '正序' : '倒序';

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
      loadSessions();
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
      showPopover(`popover-set-${type}`, triggerEl, true);
    }

    function selectSetting(type, value, label) {
      if (type === 'provider') { tempSetProvider = value; document.getElementById('set-disp-provider').innerText = label; }
      else if (type === 'sort') { tempSetSort = value; document.getElementById('set-disp-sort').innerText = label; }
      else if (type === 'sortAsc') { tempSetSortAsc = value === 'true'; document.getElementById('set-disp-sort-asc').innerText = label; }
      document.getElementById(`popover-set-${type}`).style.display = 'none';
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
      if (!confirm('确定要重置自定义代码吗？\n这将清空所有自定义头部和内容。')) return;

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



    async function exportData() {
      var incTodos = document.getElementById('export-todos').checked;
      var incTrash = document.getElementById('export-trash').checked;
      var incSettings = document.getElementById('export-settings').checked;
      var incCategories = document.getElementById('export-categories').checked;
      var useChunked = document.getElementById('chunked-mode').checked;

      if (!incTodos && !incTrash && !incSettings && !incCategories) return alert('请至少选择一项需要导出的内容。');

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

      var spinChars = ['\u28FE','\u28F7','\u28EF','\u28DF','\u287F','\u28BF','\u28FB','\u28FD'];
      var spinIdx = 0; var curTitle = ''; var targetPct = 0; var curPct = 0;
      var spinTimer = setInterval(function() { spinIdx = (spinIdx+1)%8; titleEl.textContent = spinChars[spinIdx]+' '+curTitle; if(curPct<targetPct){curPct=targetPct>=100?targetPct:curPct+Math.max(1,Math.round((targetPct-curPct)*0.1));if(curPct>targetPct)curPct=targetPct;barFill.style.width=Math.min(curPct,100)+'%';} }, 80);
      function showProgress(t,s,p) { curTitle=t; subEl.textContent=s||''; if(p!==undefined) targetPct=Math.min(Math.max(p,0),100); }
      function closeProgress() { clearInterval(spinTimer); if(overlay.parentNode) overlay.parentNode.removeChild(overlay); }
      function showAlert(msg) {
        return new Promise(function(resolve) {
          var ao=document.createElement('div'); ao.className='io-overlay';
          var ab=document.createElement('div'); ab.className='io-dialog';
          var am=document.createElement('div'); am.className='io-msg'; am.textContent=msg;
          var bo=document.createElement('button'); bo.className='io-btn io-btn-primary'; bo.textContent='确定';
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
          var by=document.createElement('button'); by.className='io-btn io-btn-primary'; by.textContent=btnYesLabel||'确定';
          var bn=document.createElement('button'); bn.className='io-btn io-btn-secondary'; bn.textContent=btnNoLabel||'取消';
          br.appendChild(bn); br.appendChild(by); cb.appendChild(ct); cb.appendChild(cm); cb.appendChild(br); co.appendChild(cb); document.body.appendChild(co);
          by.onclick=function(){ if(co.parentNode) co.parentNode.removeChild(co); resolve(true); };
          bn.onclick=function(){ if(co.parentNode) co.parentNode.removeChild(co); resolve(false); };
        });
      }

      var sessionId = crypto.randomUUID();

      try {
        showProgress('初始化导出会话', '创建会话...', 8);
        var sessionRes = await fetch('/api/export?mode=session&action=create&todos=' + incTodos + '&trash=' + incTrash + '&settings=' + incSettings + '&categories=' + incCategories + '&sessionId=' + sessionId);
        if (!sessionRes.ok) {
          if (sessionRes.status === 409) {
            var conflictData = {};
            try { conflictData = await sessionRes.json(); } catch(ee) {}
            var doAbortExport = await showConfirm("导出会话冲突", '检测到未完成的导出会话 (' + (conflictData.sessionId || '') + ')。\n可能是上次导出异常中断导致。\n点击「确定」中止旧会话并重新导出。\n点击「清理」仅清除旧会话。', "确定", "清理");
            if (doAbortExport) {
              if (conflictData.sessionId) {
                await fetch('/api/export?mode=session&action=abort&sessionId=' + conflictData.sessionId);
              }
              sessionRes = await fetch('/api/export?mode=session&action=create&todos=' + incTodos + '&trash=' + incTrash + '&settings=' + incSettings + '&categories=' + incCategories + '&sessionId=' + sessionId);
              if (!sessionRes.ok) throw new Error('重试创建导出会话失败');
            } else {
              if (conflictData.sessionId) {
                await fetch('/api/export?mode=session&action=abort&sessionId=' + conflictData.sessionId);
              }
              closeProgress();
              return;
            }
          } else {
            throw new Error('创建导出会话失败');
          }
        }
        var sessionData = await sessionRes.json();
        if (!sessionData.hasData) {
          try { await fetch('/api/export?mode=session&action=abort&sessionId=' + sessionId); } catch(e) {}
          closeProgress(); await showAlert('没有可导出的数据。'); return;
        }

        showProgress('准备导出', '开始下载...', 15);

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
          var bytes = encoder.encode(line + '\n');
          if (useStreamWrite) {
            writeQueue = writeQueue.then(function() { return writableStream.write(bytes); });
          } else {
            chunks.push(bytes);
          }
        }

        if (useChunked) {
          writeLine('ndjson');

          if (incSettings) {
            showProgress('分片导出', '获取设置...', 25);
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
            showProgress('分片导出', '获取分类...', 30);
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
            var pagePromise = fetch(todosBaseUrl + '&cursor=').then(function(r) { if (!r.ok) throw new Error('分页获取待办失败'); return r.text(); });
            while (true) {
              var pageText = await pagePromise;
              var pageLines = pageText.split('\n').filter(function(l) { return l.trim(); });
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
                pagePromise = fetch(todosBaseUrl + '&cursor=' + encodeURIComponent(pageInfo.cursor)).then(function(r) { if (!r.ok) throw new Error('分页获取待办失败'); return r.text(); });
              }
              if (!pageInfo || !pageInfo.hasMore) break;
              todosCursor = pageInfo.cursor;
              todosPage++;
              todosPct += ((hasTemplates ? 55 : 60) - todosPct) * 0.15;
              showProgress('分片导出', '获取待办第 ' + todosPage + ' 页...', Math.round(todosPct));
              if (todosPage % 5 === 0) {
                await fetch('/api/export?mode=session&action=update&sessionId=' + sessionId + '&todosCursor=' + encodeURIComponent(todosCursor));
              }
            }

            if (hasTemplates) {
              var tplCursor = '';
              var tplPage = 0;
              var tplPct = Math.round(todosPct) + 5;
              var tplBaseUrl = '/api/export?mode=page&type=templates&todos=true&trash=false&sessionId=' + sessionId + '&final=true';
              var tplPromise = fetch(tplBaseUrl + '&cursor=').then(function(r) { if (!r.ok) throw new Error('分页获取模板失败'); return r.text(); });
              while (true) {
                var tplText = await tplPromise;
                var tplLines = tplText.split('\n').filter(function(l) { return l.trim(); });
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
                  tplPromise = fetch(tplBaseUrl + '&cursor=' + encodeURIComponent(tplPageInfo.cursor)).then(function(r) { if (!r.ok) throw new Error('分页获取模板失败'); return r.text(); });
                }
                if (!tplPageInfo || !tplPageInfo.hasMore) break;
                tplCursor = tplPageInfo.cursor;
                tplPage++;
                tplPct += (90 - tplPct) * 0.15;
                showProgress('分片导出', '获取模板第 ' + tplPage + ' 页...', Math.round(tplPct));
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
              showProgress('生成文件', '准备下载...', 96);
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
            showProgress('生成文件', '组装下载文件...', 96);
            var blob = new Blob(chunks, { type: 'application/json' });
            var blobUrl = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = blobUrl; a.download = fileName;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 30000);
            chunks = null;
          }

          showProgress('导出完成', '文件已保存', 100);
          try { await fetch('/api/export?mode=session&action=done&sessionId=' + sessionId); } catch(e) {}
          setTimeout(closeProgress, 2000);
        } else {
          if (exportStrategy === 'opfs') {
            showProgress('OPFS 导出', '初始化缓存写入...', 15);
          } else if (exportStrategy === 'fileSystemAPI') {
            showProgress('File System API 导出', '初始化流式写入...', 15);
          } else {
            showProgress('内存导出', '大数据量时可能较慢，建议使用 Chrome/Edge 浏览器', 15);
          }
          var streamBaseUrl = '/api/export?mode=stream&todos=' + incTodos + '&trash=' + incTrash + '&settings=' + incSettings + '&categories=' + incCategories + '&sessionId=' + sessionId;
          var streamTodosCursor = '';
          var streamTemplatesCursor = '';
          var streamSkipHeader = false;
          var streamBytes = 0;
          var streamPct = 15;
          var continuationRound = 0;
          var streamLabel = exportStrategy === 'fileSystemAPI' ? 'File System API' : (exportStrategy === 'opfs' ? 'OPFS' : '内存');
          var streamSubLabel = exportStrategy === 'fileSystemAPI' ? '已写入' : (exportStrategy === 'opfs' ? '已缓存' : '已读取');

          while (true) {
            var extraParams = '';
            if (streamTodosCursor) extraParams += '&todosCursor=' + encodeURIComponent(streamTodosCursor);
            if (streamTemplatesCursor) extraParams += '&templatesCursor=' + encodeURIComponent(streamTemplatesCursor);
            if (streamSkipHeader) extraParams += '&skipHeader=true';
            var streamUrl = streamBaseUrl + extraParams;
            var res = await fetch(streamUrl);
            if (!res.ok) throw new Error('流式导出请求失败');

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
              var lines = lineBuffer.split('\n');
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
                  var lineBytes = encoder.encode(line + '\n');
                  await writableStream.write(lineBytes);
                  streamBytes += lineBytes.byteLength;
                } else {
                  pendingLines.push(line + '\n');
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
                var lastLineBytes = encoder.encode(lineBuffer.trim() + '\n');
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
              showProgress(streamLabel, '续传第 ' + continuationRound + ' 轮...', Math.round(streamPct));
            } else {
              break;
            }
          }

          if (useStreamWrite) {
            await writableStream.close();
            if (exportStrategy === 'opfs') {
              showProgress('生成文件', '准备下载...', 96);
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
            showProgress('生成文件', '组装下载文件...', 96);
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

          showProgress('导出完成', '文件已保存', 100);
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
        await showAlert('导出失败：' + e.message);
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

      var spinChars = ['\u28FE','\u28F7','\u28EF','\u28DF','\u287F','\u28BF','\u28FB','\u28FD'];
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
          var by=document.createElement('button'); by.className='io-btn io-btn-primary'; by.textContent=btnYesLabel||'确定';
          var bn=document.createElement('button'); bn.className='io-btn io-btn-secondary'; bn.textContent=btnNoLabel||'取消';
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
          var bo=document.createElement('button'); bo.className='io-btn io-btn-primary'; bo.textContent='确定';
          ab.appendChild(am); ab.appendChild(bo); ao.appendChild(ab); document.body.appendChild(ao);
          bo.onclick=function(){ if(ao.parentNode) ao.parentNode.removeChild(ao); resolve(); };
        });
      }

      (async function() {
        try {
          var mode = 'merge';
          var isOverwrite = await showConfirm("是否使用【覆盖模式】？", "点击确定将清空云端的所有数据，然后完全替换为导入的新数据。\n请确保导出数据时一定要全部勾选，否则执行时对于可能出现的问题后果自负。\n点击取消将进入【合并模式】或取消导入操作。");
          if (isOverwrite) { mode = 'overwrite'; }
          else {
            var isMerge = await showConfirm("是否继续使用【合并模式】进行导入？", "将保留现有云端的所有数据，新增并覆盖更新 ID 相同的重叠事项。\n请确保导出数据时一定要全部勾选，否则执行时对于可能出现的问题后果自负。\n过程中出现异常将无法恢复。");
            if (!isMerge) { closeProgress(); event.target.value=''; return; }
          }

          showProgress('初始化导入会话', mode === 'overwrite' ? '备份并清空云端数据...' : '创建合并会话...', 8);
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
              var conflictMsg = '检测到未完成的导入会话 (' + errData1.importId + ')\n\n';
              if (errData1.mode === 'overwrite') {
                conflictMsg += '该会话为覆写模式，点击「恢复」将中止旧会话并恢复原始数据。\n';
              } else {
                conflictMsg += '点击「恢复」将清除旧会话记录。\n';
              }
              conflictMsg += '点击「确定」中止旧会话并继续当前导入。';

              var doAbortOld = await showConfirm("会话冲突", conflictMsg, "确定", "恢复");
              if (doAbortOld) {
                var abortOldRes = await fetch('/api/import', {
                  method: 'POST',
                  body: JSON.stringify({ phase: 'abort', importId: errData1.importId }),
                  headers: { 'Content-Type': 'application/json' }
                });
                if (abortOldRes.ok) {
                  showProgress('重试初始化', mode === 'overwrite' ? '备份并清空云端数据...' : '创建合并会话...', 8);
                  await new Promise(function(r){ setTimeout(r,30); });
                  initRes = await fetch('/api/import', {
                    method: 'POST',
                    body: JSON.stringify({ phase: 'init', mode: mode, importId: importId }),
                    headers: { 'Content-Type': 'application/json' }
                  });
                  if (!initRes.ok) {
                    var errMsg1Retry = '重试初始化失败';
                    try { var ed1r = await initRes.json(); if(ed1r.error) errMsg1Retry+='：'+ed1r.error; } catch(ee){}
                    throw new Error(errMsg1Retry);
                  }
                } else {
                  throw new Error('中止旧会话失败，请刷新页面后重试');
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
                    await showAlert('原始数据已成功恢复。');
                  } else if (errData1.mode === 'overwrite') {
                    await showAlert('旧会话已清除，但未检测到备份数据。');
                  } else {
                    await showAlert('旧会话已清除。');
                  }
                } else {
                  await showAlert('恢复操作失败，可手动访问 /api/import-backup?action=restore 尝试恢复。');
                }
                return;
              }
            } else {
              var errMsg1 = '初始化失败';
              if(errData1.error) errMsg1 += '：' + errData1.error;
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
                  msg += abortData.recovered ? '\n\n已自动恢复原始备份数据' : '\n\n会话已清除，但未检测到备份数据';
                } else {
                  msg += '\n\n自动恢复失败，可手动访问 /api/import-backup?action=restore 尝试恢复';
                }
              } catch(abortErr) {
                msg += '\n\n自动恢复请求异常：' + abortErr.message;
              }
            }
            throw new Error(msg);
          };

          showProgress('读取文件', '正在读取...', 15);

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
              showProgress('分片导入', '上传第 ' + chunkIdx + ' 片...', Math.round(uploadPct));
              var chunkBody = chunkBuf.join('\n') + '\n';
              chunkBuf.length = 0;
              var chunkRes = await fetch('/api/import?importId=' + importId, {
                method: 'POST',
                body: chunkBody,
                headers: { 'Content-Type': 'application/x-ndjson' }
              });
              chunkBody = null;
              if (!chunkRes.ok) {
                var chunkErr = '第 ' + chunkIdx + ' 片上传失败';
                try { var ced = await chunkRes.json(); if (ced.error) chunkErr += '：' + ced.error; } catch(cee) {}
                await abortAndThrow(chunkErr);
              }
            }

            while (true) {
              var _cref = await streamReader.read();
              if (_cref.done) break;
              bytesRead += _cref.value.byteLength;
              var readPct = 15 + Math.round((bytesRead / Math.max(fileSize, 1)) * 25);
              showProgress('分片导入', '读取 ' + (bytesRead / 1024 / 1024).toFixed(1) + ' / ' + (fileSize / 1024 / 1024).toFixed(1) + ' MB', readPct);

              lineBuffer += decoder.decode(_cref.value, { stream: true });
              var lines = lineBuffer.split('\n');
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
              showProgress('流式导入', '读取 ' + (bytesRead / 1024 / 1024).toFixed(1) + ' / ' + (fileSize / 1024 / 1024).toFixed(1) + ' MB', readPct);

              lineBuffer += decoder.decode(_ref.value, { stream: true });
              var lines = lineBuffer.split('\n');
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

                output += trimmed + '\n';
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
                  else { await writer.write(encoder.encode(trimmed + '\n')); }
                } catch(pe) { await writer.write(encoder.encode(trimmed + '\n')); }
              } else {
                await writer.write(encoder.encode(trimmed + '\n'));
              }
            }

            await writer.close();
            showProgress('流式导入', '上传数据中...', 42);
            var uploadRes = await uploadPromise;
            if (!uploadRes.ok) {
              var errMsg2 = '上传数据失败';
              try { var ed2 = await uploadRes.json(); if(ed2.error) errMsg2+='：'+ed2.error; } catch(ee){}
              await abortAndThrow(errMsg2);
            }
          } else {
            showProgress('读取文件', '兼容模式...', 15);
            var fileReader = new FileReader();
            var rawText = await new Promise(function(resolve, reject) {
              fileReader.onload = function(e) { resolve(e.target.result); };
              fileReader.onerror = function() { reject(new Error('文件读取失败')); };
              fileReader.readAsText(file);
            });

            showProgress('数据解析', '解析 JSON 中...', 40);

            var data;
            var firstLine = rawText.split('\n')[0].trim();

            if (firstLine === 'ndjson') {
              isNdjson = true;
              var lines = rawText.split('\n');
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
              throw new Error("未在文件中找到有效的待办或设置数据。");
            }

            showProgress('上传数据', '', 45);
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
                  chunk += JSON.stringify(mixedItems[mIdx]) + '\n';
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
              var errMsg2b = '上传数据失败';
              try { var ed2b = await uploadRes.json(); if(ed2b.error) errMsg2b+='：'+ed2b.error; } catch(ee){}
              await abortAndThrow(errMsg2b);
            }

            settingsBuf.settings = data.settings;
            settingsBuf.custom_header = data.custom_header;
            settingsBuf.custom_content = data.custom_content;
            categoriesBuf = data.categories;
            customColorsBuf = data.customColors;
          }

          if (settingsBuf.settings && document.getElementById('export-settings').checked) {
            showProgress('应用偏好设置', '', 85);
            await fetch('/api/settings', {
              method: 'POST',
              body: JSON.stringify(settingsBuf.settings),
              headers: { 'Content-Type': 'application/json' }
            });
          }

          showProgress('收尾处理', '清理并完成导入...', 90);
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
            var errMsg4 = '收尾处理失败';
            try { var ed4 = await finalRes.json(); if(ed4.error) errMsg4+='：'+ed4.error; } catch(ee){}
            throw new Error(errMsg4);
          }

          showProgress('导入完成', '界面即将重载...', 100);
          await new Promise(function(r){ setTimeout(r,1000); });
          closeProgress();
          location.reload();
        } catch (err) {
          closeProgress();
          await showAlert('导入失败：' + err.message);
        }
        event.target.value = '';
      })();
    }

    async function factoryReset() {
      if (!confirm("警告：此操作将彻底删除云端所有的待办事项、回收站记录和所有的云端偏好设置！\n此操作不可逆，强烈建议先导出系统备份！\n\n是否继续？")) return;
      if (!confirm("最终确认：真的要彻底清空所有数据吗？")) return;

      try {
        await fetch('/api/trash-action', {
          method: 'POST', body: JSON.stringify({ action: 'CLEAR_ALL_DATA' }),
          headers: { 'Content-Type': 'application/json' }
        });
        alert("系统云端已完全清空，即将重置。");
        location.reload();
      } catch (e) {
        alert("数据清理执行失败");
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
            '检测到上次覆写导入中断，原始数据备份仍在。\n\n' +
            '会话 ID: ' + data.importId + '\n' +
            '启动时间: ' + new Date(data.startedAt).toLocaleString() + '\n\n' +
            '点击「确定」恢复原始数据，点击「取消」放弃恢复（当前不完整数据将保留）。'
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
                alert('原始数据已成功恢复，页面即将重载。');
                location.reload();
              } else {
                alert('会话已清除。');
              }
            } else {
              alert('恢复操作失败，可手动访问 /api/import-backup?action=restore 尝试恢复。');
            }
          } else {
            await fetch('/api/import', {
              method: 'POST',
              body: JSON.stringify({ phase: 'abort', importId: data.importId }),
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } else {
          var doCleanup = confirm(
            '检测到上次合并导入中断（会话 ID: ' + data.importId + '）。\n\n' +
            '合并模式无法自动恢复，部分新数据可能已写入。\n' +
            '点击「确定」清除该会话记录。'
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
        const res = await fetch(`/api/stats?start=${startStr}&end=${endStr}`);
        if(res.ok) {
          const rawData = await res.json();
          renderStatsCharts(rawData, datesArray);
          document.getElementById('stats-loading').classList.add('hidden');
          document.getElementById('stats-content').classList.remove('hidden');
        } else {
          document.getElementById('stats-loading').innerText = '数据拉取失败。';
        }
      } catch(e) {
        document.getElementById('stats-loading').innerText = '网络请求异常。';
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

    // 年度报告出现时间 0=1月, 1=2月, ..., 11=12月
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
        titleEl.innerText = '7天统计';
        if (getAnnualReportYear() !== null) {
          switchBtn.classList.remove('hidden');
          switchBtn.innerText = '年度报告';
        } else {
          switchBtn.classList.add('hidden');
        }
      } else {
        titleEl.innerText = '年度报告';
        switchBtn.classList.remove('hidden');
        switchBtn.innerText = '7天统计';
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
      loading.innerText = '年度数据加载中...';

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
          loading.innerText = '年度数据拉取失败。';
        }
      } catch(e) {
        loading.innerText = '网络请求异常。';
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
      var monthLabels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

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
      var priLabels = ['高', '中', '低'];
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
        '<div class="annual-year-title"><span>' + annualYear + ' 年度报告</span></div>' +
        '<div class="annual-hero">' +
          '<div class="annual-ending-title">' + ending.title + '</div>' +
          '<div class="annual-ending-subtitle">' + ending.subtitle + '</div>' +
          '<div class="annual-ending-desc">' + ending.desc + '</div>' +
        '</div>' +
        '<div class="annual-divider">◆ ◆ ◆</div>' +
        '<div class="annual-section-title">核心数据</div>' +
        '<div class="annual-stats-grid">' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + totalTasks + '</div><div class="annual-stat-label">总事项数</div></div>' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + doneTasks + '</div><div class="annual-stat-label">已完成</div></div>' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + doneRate.toFixed(1) + '%</div><div class="annual-stat-label">完成率</div></div>' +
          '<div class="annual-stat-card"><div class="annual-stat-value">' + activeDays + '</div><div class="annual-stat-label">活跃天数</div></div>' +
        '</div>' +
        '<div class="annual-section-title">月度活跃度</div>' +
        '<div class="annual-month-chart">' + monthBarsHtml + '</div>' +
        '<div class="annual-section-title">优先级分布</div>' +
        '<div style="margin-bottom:25px;">' + priBarsHtml + '</div>' +
        '<div class="annual-divider">◆ ◆ ◆</div>' +
        '<div class="annual-section-title">年度叙事</div>' +
        '<div class="annual-narrative">' + narrative + '<div class="annual-report-time">统计周期：' + annualYear + '-01-01 至 ' + annualYear + '-12-31<br>显示截止：' + getAnnualExpiryTime() + '</div></div>';
    }

    function determineEnding(totalTasks, doneRate, highPriRate, firstHalf, secondHalf, monthData, activeDays, medPriRate, lowPriRate) {
      if (totalTasks < 5) {
        return {
          title: '空白画布',
          subtitle: 'THE BLANK CANVAS',
          desc: '这一年，你选择了留下大片空白。也许是没有什么需要记录，也许是最好的待办就是没有待办。空白不是虚无——它是等待被书写的可能性。下一年，你会落笔吗？'
        };
      }
      if (doneRate >= 80 && totalTasks >= 50) {
        return {
          title: '效率引擎',
          subtitle: 'THE EFFICIENCY ENGINE',
          desc: '你将待办清单视为战场，80%以上的任务被你无情终结。每一条划掉的待办，都是一次对混沌的宣战。你是秩序的信徒，效率的化身。在你面前，没有任何一条待办能活过明天。'
        };
      }
      if (doneRate < 30 && totalTasks >= 20) {
        return {
          title: '拖延哲学家',
          subtitle: 'THE PROCRASTINATION PHILOSOPHER',
          desc: '你不是在拖延——你是在思考。那些未完成的待办，每一个都承载着深邃的犹豫与无限的可能。也许明天，也许下辈子，它们终将被完成。至少，你写下了它们。'
        };
      }
      if (highPriRate > 40 && doneRate >= 60) {
        return {
          title: '战略规划师',
          subtitle: 'THE STRATEGIC PLANNER',
          desc: '你只关注真正重要的事。高优先级是你的武器，完成率是你的战绩。无关紧要的事？不配出现在你的清单上。你不是在做待办——你是在指挥战役。'
        };
      }
      if (totalTasks < 30 && doneRate >= 70) {
        return {
          title: '精准打击者',
          subtitle: 'THE PRECISION STRIKER',
          desc: '少即是多。你不贪多，但每一发都命中靶心。你的待办清单短小精悍，却弹无虚发。真正的高手，从不需要满屏的红点来证明自己的存在。'
        };
      }
      if (totalTasks >= 100 && doneRate < 50) {
        return {
          title: '待办收藏家',
          subtitle: 'THE TODO COLLECTOR',
          desc: '你的待办清单是一座博物馆。每一项都被精心收藏，却鲜有人问津。但谁知道呢？也许某天你会打开它，然后惊叹于自己曾经的野心和想象。'
        };
      }
      if (firstHalf > 0 && secondHalf >= 0 && firstHalf > secondHalf * 2) {
        return {
          title: '开局王者',
          subtitle: 'THE QUICK STARTER',
          desc: '年初的你意气风发，雄心万丈。但时间是最好的稀释剂。你的故事总是从"这次一定"开始，然后以"下次再说"收尾。但至少，你的开局总是漂亮的。'
        };
      }
      if (secondHalf > firstHalf * 2 && firstHalf > 0) {
        return {
          title: '后发制人',
          subtitle: 'THE LATE BLOOMER',
          desc: '上半年还在酝酿，下半年突然爆发。你用实际行动证明了：重要的不是何时开始，而是何时发力。厚积薄发，大器晚成——说的就是你。'
        };
      }
      var priArr = [highPriRate, medPriRate, lowPriRate];
      var maxPriDiff = Math.max.apply(null, priArr) - Math.min.apply(null, priArr);
      if (maxPriDiff < 20 && doneRate >= 55 && doneRate <= 85) {
        return {
          title: '均衡大师',
          subtitle: 'THE BALANCE MASTER',
          desc: '高、中、低优先级在你手中均匀分布。你不偏废，不冒进，以中庸之道驾驭时间。这世上没有你特别在意的事，也没有你愿意放弃的事——也许这就是最大的智慧。'
        };
      }
      if (doneRate >= 50 && doneRate < 80 && totalTasks >= 30 && totalTasks < 100) {
        return {
          title: '从容行者',
          subtitle: 'THE STEADY WALKER',
          desc: '不急不躁，按自己的节奏前行。你完成的每一件事都有分量，未完成的也不过是留给未来的礼物。你不需要被定义——你的待办清单，就是你自己。'
        };
      }
      if (doneRate >= 30 && doneRate < 50 && totalTasks >= 30) {
        return {
          title: '半途旅人',
          subtitle: 'THE HALFWAY TRAVELER',
          desc: '你开始了，但经常没有到达。这不丢人——每一段旅程都有意义，即使没有走到终点。你的清单上写满了"进行中"，而"进行中"本身就是一种态度。'
        };
      }
      return {
        title: '待办探索者',
        subtitle: 'THE TODO EXPLORER',
        desc: '你在待办的世界里漫游，不为征服，只为探索。每一条记录都是一次尝试，每一次完成都是一次惊喜。没有KPI，没有目标——只有你和你的清单。'
      };
    }

    function generateNarrative(totalTasks, doneTasks, doneRate, busiestMonth, busiestDate, busiestDateCount, highPri, medPri, lowPri, activeDays, firstHalf, secondHalf, monthData, year) {
      var monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
      var n = '';

      n += '<strong>' + year + '</strong> 年，你一共创建了 <em>' + totalTasks + '</em> 条待办事项。';

      if (totalTasks === 0) {
        n += '这一年你的清单空空如也。也许你活在当下，从不需要计划——又或者，你本身就是最好的计划。';
        return n;
      }

      n += '其中 <em>' + doneTasks + '</em> 条被你亲手终结，完成率 <em>' + doneRate.toFixed(1) + '%</em>。';

      if (doneRate >= 90) n += '这是一个令人敬畏的数字。你的清单上几乎没有逃脱者。';
      else if (doneRate >= 70) n += '大多数任务没能逃过你的追击，少数幸存者大概在瑟瑟发抖。';
      else if (doneRate >= 50) n += '一半做了，一半没做。这大概是世界上最诚实的比例。';
      else if (doneRate >= 30) n += '虽然完成的不多，但每一条都是诚意之作……大概吧。';
      else n += '你的待办清单更像是一个许愿池——扔进去的硬币，偶尔会发光。';

      n += '<br><br>';
      n += '你在 <em>' + activeDays + '</em> 个不同的日子里打开了这个应用。';

      if (activeDays >= 300) n += '几乎没有一天缺席——你比打卡机还准时。';
      else if (activeDays >= 200) n += '一年三分之二的时间你都在这里，这已经不是习惯，是信仰。';
      else if (activeDays >= 100) n += '三天打鱼两天晒网？不，你只是选择在重要的日子出现。';
      else if (activeDays >= 30) n += '偶尔来看看，确认清单还在，然后离开。这也是一种使用方式。';
      else n += '你来去如风，像一位神秘的访客。清单记得你来过。';

      n += '<br><br>';

      if (busiestMonth >= 0 && monthData[busiestMonth].total > 0) {
        n += '<strong>' + monthNames[busiestMonth] + '</strong> 是你最忙碌的月份，一共 <em>' + monthData[busiestMonth].total + '</em> 条事项涌入';
        var bDoneRate = monthData[busiestMonth].total > 0 ? (monthData[busiestMonth].done / monthData[busiestMonth].total * 100).toFixed(0) : 0;
        n += '，当月完成率 <em>' + bDoneRate + '%</em>。';
        if (monthData[busiestMonth].total >= 30) n += '那段时间你一定忙得不可开措。';
        else if (monthData[busiestMonth].total >= 15) n += '虽然忙碌，但你扛过来了。';
      }

      if (busiestDate !== '--') {
        n += '而 <strong>' + busiestDate + '</strong> 是你最充实的一天，单日创建 <em>' + busiestDateCount + '</em> 条待办。';
      }

      n += '<br><br>';

      var total = highPri + medPri + lowPri;
      if (total > 0) {
        if (highPri > medPri && highPri > lowPri) {
          n += '你的清单中高优先级事项占了 <em>' + (highPri/total*100).toFixed(0) + '%</em>——你总是先处理最紧急的事，或者说，你制造了太多紧急的事。';
        } else if (lowPri > highPri && lowPri > medPri) {
          n += '低优先级事项占了 <em>' + (lowPri/total*100).toFixed(0) + '%</em>——看起来你的大多数待办都"不那么重要"。但谁知道呢，也许"不重要"才是最诚实的标签。';
        } else if (medPri >= highPri && medPri >= lowPri) {
          n += '中优先级事项占据了 <em>' + (medPri/total*100).toFixed(0) + '%</em>——大多数事情既不紧急也不可忽略。这就是生活的真相：平淡而持续。';
        } else {
          n += '高、中、低优先级均匀分布，你对待每一件事都一视同仁……或者说，你对优先级这个功能有些随意。';
        }
      }

      n += '<br><br>';

      if (firstHalf > 0 || secondHalf > 0) {
        if (firstHalf > secondHalf * 1.5 && secondHalf > 0) {
          n += '上半年你意气风发，产出了 <em>' + firstHalf + '</em> 条事项；下半年只有 <em>' + secondHalf + '</em> 条。经典的三分钟热度曲线。';
        } else if (secondHalf > firstHalf * 1.5 && firstHalf > 0) {
          n += '下半年你突然发力，产出了 <em>' + secondHalf + '</em> 条事项，远超上半年的 <em>' + firstHalf + '</em> 条。后发制人，大器晚成。';
        } else if (firstHalf === secondHalf && firstHalf > 0) {
          n += '上下半年各产出 <em>' + firstHalf + '</em> 条事项，节奏稳定如钟。你是时间的朋友。';
        } else if (firstHalf > 0 && secondHalf > 0) {
          n += '上下半年各产出 <em>' + firstHalf + '</em> 和 <em>' + secondHalf + '</em> 条事项，节奏基本稳定。';
        } else if (firstHalf > 0 && secondHalf === 0) {
          n += '所有的事项都集中在上半年。下半年？大概是在享受上半年的劳动成果。';
        } else {
          n += '所有的事项都集中在下半年。上半年？大概是在积蓄力量。';
        }
      }

      n += '<br><br>';

      // 找出有数据的月份数
      var activeMonths = 0;
      monthData.forEach(function(m) { if (m.total > 0) activeMonths++; });
      n += '这一年有 <em>' + activeMonths + '</em> 个月份留下了你的记录。';

      if (activeMonths >= 10) n += '你几乎全年无休，是真正的待办常驻居民。';
      else if (activeMonths >= 6) n += '大半年的时间你都在与清单为伴。';
      else if (activeMonths >= 3) n += '你只在某些时段出现，像候鸟一样有规律地迁徙。';
      else n += '你的记录零星而珍贵，像夜空中偶尔闪过的流星。';

      n += '<br><br>';
      n += '这就是你的 <strong>' + year + '</strong> 年待办故事。无论结局如何，每一条记录都是你认真活过的证据。';

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

      document.getElementById('stats-total-info').innerText = "近7天总完成数: " + totalDone;
      document.getElementById('stats-total-info').style.color = cText;

      // 柱状图 (每日总数 vs 完成数)
      const ctxBar = document.getElementById('chart-bar').getContext('2d');
      chartInstanceBar = new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: datesArray.map(d => d.slice(5)), // 仅显示 MM-DD
          datasets: [
            {
              label: '当日总事项',
              data: datesArray.map(d => dailyTotalCounts[d]),
              backgroundColor: cPanel,
              borderColor: cBorder,
              borderWidth: 1
            },
            {
              label: '当日完成事项',
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

      // 圆环图 (优先级占比)
      const ctxPri = document.getElementById('chart-pie-priority').getContext('2d');
      chartInstancePri = new Chart(ctxPri, {
        type: 'doughnut',
        data: {
          labels: ['高', '中', '低'],
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
            title: { display: true, text: '优先级占比', color: cText, font: { size: 14, weight: 'bold' } },
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

      // 圆环图 (完成率占比)
      const ctxStat = document.getElementById('chart-pie-status').getContext('2d');
      chartInstanceStat = new Chart(ctxStat, {
        type: 'doughnut',
        data: {
          labels: ['已完成', '未完成'],
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
            title: { display: true, text: '事项完成率', color: cText, font: { size: 14, weight: 'bold' } },
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
      list.innerHTML = '<div style="padding:20px;text-align:center;">数据拉取中...</div>';
      try {
        const res = await fetch('/api/trash');
        if (res.ok) {
          trashTodos = await res.json();
          renderTrashItems();
        }
      } catch(e) { list.innerHTML = '<div style="color:var(--warn);text-align:center;">加载失败</div>'; }
    }

    function renderTrashItems() {
      const list = document.getElementById('trash-list');
      list.innerHTML = '';
      if (trashTodos.length === 0) {
        list.innerHTML = '<div style="padding:40px;text-align:center;border:1px dashed #666;">回收站为空</div>';
        return;
      }
      trashTodos.forEach((todo, index) => {
        const el = document.createElement('div');
        el.className = 'todo-item';

        let checkboxHtml = '';
        let actionsHtml = '';

        if (isTrashBatchMode) {
          const isSelected = selectedTrashTasks.has(index);
          checkboxHtml = `<div class="checkbox ${isSelected ? 'batch-selected' : ''}" onclick="event.stopPropagation(); toggleTrashBatchSelect(${index})"></div>`;
        } else {
          actionsHtml = `
            <button class="btn-ghost" style="padding:4px 8px; border:1px solid #666;" onclick="event.stopPropagation(); actionTrash('${todo.id}', 'RESTORE')">恢复</button>
            <button class="btn-danger" style="padding:4px 8px; margin-left:8px;" onclick="event.stopPropagation(); actionTrash('${todo.id}', 'DELETE_PERMANENT')">删除</button>
          `;
        }

        el.innerHTML = `
          ${checkboxHtml}
          <div class="item-meta" style="opacity:0.7;">
            <div class="item-title" style="text-decoration:line-through;">${todo.text}</div>
            <div class="item-info">原日期: ${todo.date}</div>
          </div>
          ${actionsHtml}
        `;

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
      if (!confirm(`你会永远失去 ${selectedTrashTasks.size} 个事项！`)) return;
      const ids = Array.from(selectedTrashTasks).map(idx => trashTodos[idx].id);
      await fetch('/api/trash-action', {
        method: 'POST', body: JSON.stringify({ action: 'BATCH_DELETE_PERMANENT', ids })
      });
      exitTrashBatchMode();
      loadTrashData();
    }

    async function actionTrash(id, action) {
      if (action === 'DELETE_PERMANENT' && !confirm('你会永远失去它，确认？')) return;
      await fetch('/api/trash-action', {
        method: 'POST', body: JSON.stringify({ action, id }),
        headers: { 'Content-Type': 'application/json' }
      });
      loadTrashData();
    }

    async function clearTrash() {
      if (!confirm('确认清空？你会永远失去它们！')) return;
      await fetch('/api/trash-action', {
        method: 'POST', body: JSON.stringify({ action: 'CLEAR_ALL' }),
        headers: { 'Content-Type': 'application/json' }
      });
      loadTrashData();
    }



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
      list.innerHTML = tempSubtasks.map((st, i) => `
        <div class="subtask-edit-item">
          <span class="flex-1" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${st.text}</span>
          <button class="btn-danger" style="padding:4px 8px;" onclick="removeTempSubtask('${mode}', ${i})">删</button>
        </div>
      `).join('');
    }

    function renderSearchTerms(mode) {
      const preview = document.getElementById(mode + '-search-preview');
      if (!preview) return;
      preview.innerHTML = tempSearchTerms.map((termObj, i) => {
        const text = termObj.text;
        const safeText = encodeURIComponent(text).replace(/'/g, "%27");
        return `<div class="search-term-tag ${termObj.done ? 'done' : ''}">
          <div class="search-term-checkbox" onclick="toggleTempSearchTerm('${mode}', ${i})"></div>
          <span>${text}</span>
          <button onclick="copyTempSearchTerm('${mode}', ${i}, '${safeText}')">⎘</button>
        </div>`;
      }).join('');
    }

    async function regenerateSearchTerms(mode, isRefresh) {
      const preview = document.getElementById(mode + '-search-preview');
      const btn = document.getElementById(mode + '-search-regenerate-btn');
      if (!preview) return;
      const msg = isRefresh ? '重新拉取热点' : '拉取全网热点';
      preview.innerHTML = '<div style="color:#666; width:100%; text-align:center; padding: 10px 0;">[系统请求中] 正在通过 CF Worker ' + msg + '...</div>';
      if (btn) btn.disabled = true;
      tempSearchTerms = await generateSearchTerms(tempSearchProvider);
      if (btn) btn.disabled = false;
      if (tempSearchTerms.length === 0) {
        preview.innerHTML = '<div style="color:var(--warn); width:100%; text-align:center;">[数据拉取失败] 请重试或稍后再试</div>';
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
        document.getElementById('add-repeat-display').innerText = '重复: ' + label;
        var endRow = document.getElementById('add-repeat-end-row');
        if (endRow) endRow.style.display = (val !== 'none') ? '' : 'none';
      } else if (activeMode === 'edit') {
        document.getElementById('edit-repeat-display').innerText = '重复: ' + label;
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
              customInput.placeholder = activeMode === 'manage' && editingCategoryId ? '编辑分类名称...' : '新建分类...';
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
              customInput.placeholder = activeMode === 'manage' && editingCategoryId ? '编辑分类名称...' : '新建分类...';
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
            customInput.placeholder = '#自定义颜色...';
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
        noCatItem.innerHTML = '<span class="cat-name">无分类</span>';
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
      if (!confirm('确认删除选中的 ' + selectedCatIds.size + ' 个分类？')) return;
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
      if (!confirm('确认删除选中的 ' + selectedColors.size + ' 个自定义颜色？')) return;
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
      if (createInput) { createInput.value = ''; createInput.placeholder = '新建分类...'; }
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
          if (titleEl) titleEl.textContent = '>> 编辑分类';
          if (createInput) createInput.placeholder = '编辑分类名称...';
          if (preview) { preview.style.display = 'block'; updateCategoryEditPreview(); }
          if (confirmBtn) confirmBtn.textContent = '保存';
        } else {
          if (titleEl) titleEl.textContent = '>> 新建分类';
          if (createInput) createInput.placeholder = '新建分类...';
          if (preview) preview.style.display = 'none';
          if (confirmBtn) confirmBtn.textContent = '创建';
        }
      } else {
        if (searchRow) searchRow.style.display = 'flex';
        if (createRow) createRow.style.display = 'none';
        if (iconPlus) { iconPlus.style.opacity = '1'; iconPlus.style.transform = 'rotate(0deg)'; }
        if (iconSearch) { iconSearch.style.opacity = '0'; iconSearch.style.transform = 'rotate(-90deg)'; }
        if (listEl) listEl.style.display = 'flex';
        if (colorPresets) colorPresets.style.display = 'none';
        if (titleEl) titleEl.textContent = '>> 选择分类';
        if (createInput) { createInput.value = ''; createInput.placeholder = '新建分类...'; }
        if (preview) preview.style.display = 'none';
        if (confirmBtn) confirmBtn.textContent = '创建';
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
          createInput.placeholder = activeMode === 'manage' && editingCategoryId ? '编辑分类名称...' : '新建分类...';
          renderCategoryColorPresets();
          return;
        }
        customColorsList.push(normalizedColor);
        categorySelectedColor = normalizedColor;
        categoryCustomColor = '';
        createInput.value = activeMode === 'manage' && editingCategoryId ? editingCategoryName : '';
        createInput.placeholder = activeMode === 'manage' && editingCategoryId ? '编辑分类名称...' : '新建分类...';
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
      if (createInput) { createInput.value = ''; createInput.placeholder = '新建分类...'; }
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
      if (titleEl) titleEl.textContent = '>> 选择分类';
      if (preview) preview.style.display = 'none';
      if (confirmBtn) confirmBtn.textContent = '创建';
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
      const displayName = catId ? getCategoryName(catId) : '无';
      if (activeMode === 'add') {
        document.getElementById('add-category-display').innerText = '分类: ' + displayName;
      } else if (activeMode === 'edit') {
        document.getElementById('edit-category-display').innerText = '分类: ' + displayName;
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
      document.getElementById('add-repeat-display').innerText = '重复: 不重复';
      document.getElementById('add-category-display').innerText = '分类: 无';
      document.getElementById('add-endtime-display').innerText = '结束 --:--';
      document.getElementById('add-repeat-end-display').innerText = '循环截止: 永不';
      document.getElementById('add-repeat-end-row').style.display = 'none';

      tempSubtasks =[]; tempSearchTerms =[]; addSearchState = false;
      tempSearchProvider = appSettings.provider || 'auto';
      document.getElementById('add-subtask-input').value = '';
      renderTempSubtasks('add');

      const pMap = {'auto':'自动 (随机源)', 'bilibili':'哔哩哔哩', 'weibo':'微博热搜', 'zhihu':'知乎热榜', 'baidu':'百度热搜'};
      const providerDisplay = document.getElementById('add-search-provider-display');
      if(providerDisplay) providerDisplay.innerText = pMap[tempSearchProvider];

      document.getElementById('add-search-box').classList.remove('checked');
      document.getElementById('add-search-actions').classList.add('hidden');

      updateAddUI();
    }

    function updateAddUI() {
      document.getElementById('add-time-display').innerText = tempTime ? ('开始 ' + tempTime) : '开始 --:--';
      document.getElementById('add-endtime-display').innerText = tempEndTime ? ('结束 ' + tempEndTime) : '结束 --:--';
      const pMap = {low:'优先级: 低', med:'优先级: 中', high:'优先级: 高'};
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
      const task = todos[index]; tempTime = task.time || ''; tempPriority = task.priority || 'low';
      tempCategoryId = task.category_id || '';
      renderDetailContent();

      const btnSave = document.getElementById('btn-save-task'); const btnDel = document.getElementById('btn-delete-task');
      const btnEdit = document.getElementById('btn-edit-toggle');
      btnSave.classList.add('hidden'); btnDel.classList.remove('hidden'); btnEdit.innerText = "编辑";
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
      const pMap = {low:'优先级: 低', med:'优先级: 中', high:'优先级: 高'};
      const rMap = { none: '不重复', daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' };

      if (!isEditMode) {
        let urlSection = '';
        if (task.url) urlSection = `<div class="detail-label">链接 (URL)</div><div class="detail-value"><a href="${task.url}" target="_blank">${task.url}</a></div>`;

        let copySection = '';
        if (task.copy_text) {
          const safeText = encodeURIComponent(task.copy_text).replace(/'/g, "%27");
          copySection = `<div class="detail-label">快捷复制内容</div><div class="detail-value" style="display:flex; justify-content:space-between; align-items:center;">
              <span>${task.copy_text}</span><button class="btn-ghost" style="padding:4px 8px;" onclick="copyText(decodeURIComponent('${safeText}'))">复制</button>
            </div>`;
        }

        let descSection = '';
        if (task.desc) {
          const mdHtml = parseMarkdown(task.desc);
          descSection = `<div class="detail-label">备注</div><div class="detail-value" style="display:block; min-height:30px; line-height:1.5;">${mdHtml}</div>`;
        }

        let subtasksSection = '';
        if (task.subtasks && task.subtasks.length > 0) {
          let stHtml = task.subtasks.map((st, i) => `
            <div class="subtask-view-item ${st.done ? 'done' : ''}" onclick="toggleSubtask(${currentDetailIndex}, ${i})">
                <div class="checkbox"></div>
                <div class="item-meta"><div class="item-title">${st.text}</div></div>
            </div>
          `).join('');
          subtasksSection = `<div class="detail-label">子任务</div><div style="margin-bottom:20px;">${stHtml}</div>`;
        }

        let searchSection = '';
        if (task.search_terms && task.search_terms.length > 0) {
          let stHtml = task.search_terms.map((termObj, i) => {
            const text = termObj.text;
            const safeText = encodeURIComponent(text).replace(/'/g, "%27");
            return `<div class="search-term-tag ${termObj.done ? 'done' : ''}">
              <div class="search-term-checkbox" onclick="toggleSearchTerm(${currentDetailIndex}, ${i})"></div>
              <span>${text}</span>
              <button onclick="copySearchTerm(${currentDetailIndex}, ${i}, '${safeText}')">⎘</button>
            </div>`;
          }).join('');
          searchSection = `
            <div class="detail-label">网络每日搜索</div>
            <div class="search-card">
              ${stHtml}
            </div>
          `;
        }

        let rText = '单次任务';
        if (task.repeat_type && task.repeat_type !== 'none') {
            rText = `重复: ${rMap[task.repeat_type]}`;
            if (task.repeat_end) rText += ' (至' + task.repeat_end + ')';
        } else if (task.isSeries) {
            rText = '已停用未来的系列事项';
        }

        let catSection = '';
        if (task.category_id) {
          var catName = getCategoryName(task.category_id);
          var catColor = getCategoryColor(task.category_id);
          if (catName) {
            catSection = `<div class="detail-label">分类</div><div class="detail-value"><span class="badge-category"><span class="badge-category-icon" style="background:${catColor}"></span><span class="cat-name">${escapeHtml(catName)}</span></span></div>`;
          }
        }

        container.innerHTML = `
          <div class="detail-label">事项内容</div><div class="detail-value">${task.text}</div>
          ${subtasksSection}
          ${searchSection}
          <div class="row">
            <div class="flex-1"><div class="detail-label">时间点</div><div class="detail-value">${task.time || '--:--'}${task.end_time ? ' - ' + task.end_time : ''}</div></div>
            <div class="flex-1"><div class="detail-label">优先级</div><div class="detail-value">${pMap[task.priority]}</div></div>
          </div>
          ${urlSection}${copySection}
          ${catSection}
          <div class="detail-label">属性</div><div class="detail-value">${rText}</div>
          ${descSection}
        `;
      } else {
        activeMode = 'edit';
        container.innerHTML = `
          <input type="text" id="edit-text" value="${task.text}" class="detail-value editable" placeholder="事项标题（必填）">

          <div class="detail-label modal-section">子任务</div>
          <div class="row modal-subtask-row">
            <input type="text" id="edit-subtask-input" placeholder="输入子任务（可选）" class="detail-value editable flex-1">
            <button onclick="addTempSubtask('edit')">添加</button>
          </div>
          <div id="edit-subtasks-list" style="margin-bottom:15px;"></div>

          <div class="detail-label modal-section">时间与重复</div>
          <div class="row modal-row">
            <div class="fake-input detail-value editable flex-1" onclick="openCalendarForEdit()">
              <span id="edit-date-display">${task.date || '----/--/--'}</span>
              <span class="arrow">▼</span>
            </div>
            <div class="fake-input detail-value editable flex-1" onclick="toggleRepeatMenu('edit', this)">
              <span id="edit-repeat-display">重复: ${rMap[tempRepeatType]}</span>
              <span class="arrow">▼</span>
            </div>
          </div>
          <div id="edit-repeat-end-row" class="modal-row" ${tempRepeatType !== 'none' ? '' : 'style="display:none;"'}>
            <div class="fake-input detail-value editable" onclick="openCalendarForRepeatEnd('edit')">
              <span id="edit-repeat-end-display">循环截止: ${tempRepeatEnd || '永不'}</span>
              <span class="arrow">▼</span>
            </div>
          </div>
          <div class="row modal-row">
            <div class="fake-input detail-value editable flex-1" onclick="openTimePicker('edit','start')"><span id="edit-time-display">${tempTime ? '开始 ' + tempTime : '开始 --:--'}</span></div>
            <div class="fake-input detail-value editable flex-1" onclick="openTimePicker('edit','end')"><span id="edit-endtime-display">${tempEndTime ? '结束 ' + tempEndTime : '结束 --:--'}</span></div>
          </div>

          <div class="detail-label modal-section">属性与链接</div>
          <div class="row modal-row">
            <div class="fake-input detail-value editable flex-1" id="edit-category-trigger" onclick="toggleCategoryMenu('edit', this)">
              <span id="edit-category-display">分类: ${getCategoryName(tempCategoryId) || '无'}</span>
              <span class="arrow-r">▼</span>
            </div>
            <div class="fake-input detail-value editable flex-1" onclick="togglePriorityMenu('edit', this)">
              <span id="edit-priority-display">${pMap[tempPriority]}</span>
              <span class="arrow">▼</span>
            </div>
          </div>
          <input type="url" id="edit-url" value="${task.url || ''}" class="detail-value editable" placeholder="URL / APP Scheme (可选)">
          <input type="text" id="edit-copy" value="${task.copy_text || ''}" class="detail-value editable" placeholder="快捷复制内容（可选）">

          <div class="detail-label modal-section">其他</div>
          <div class="switch-label" onclick="toggleEditSearch()">
            <div class="switch-box ${tempSearchTerms.length > 0 ? 'checked' : ''}" id="edit-search-box"></div>
            <span>启用每日搜索</span>
          </div>
          <div id="edit-search-actions" class="${tempSearchTerms.length > 0 ? '' : 'hidden'}" style="margin-bottom:15px;">
            <div class="row modal-row">
              <div class="fake-input flex-1" id="edit-search-provider-trigger" onclick="toggleProviderMenu('edit', this)" style="height:46px;">
                <span id="edit-search-provider-display">自动 (随机源)</span>
                <span class="arrow-r">▼</span>
              </div>
              <button class="btn-ghost flex-1" id="edit-search-regenerate-btn" style="height:46px; padding: 0 5px;" onclick="regenerateEditSearchTerms()">获取热搜</button>
            </div>
            <div class="search-card" id="edit-search-preview"></div>
          </div>

          <textarea id="edit-desc" rows="3" class="detail-value editable" placeholder="输入备注/详细描述（可选）">${task.desc || ''}</textarea>
        `;
        renderTempSubtasks('edit');
        if (tempSearchTerms.length > 0) renderSearchTerms('edit');
      }
    }

    function toggleEditMode() {
      isEditMode = !isEditMode;
      const btnSave = document.getElementById('btn-save-task'); const btnDel = document.getElementById('btn-delete-task'); const btnEdit = document.getElementById('btn-edit-toggle');
      if (isEditMode) {
        btnSave.classList.remove('hidden'); btnDel.classList.add('hidden'); btnEdit.innerText = "取消编辑";
        const task = todos[currentDetailIndex];
        tempTime = task.time || ''; tempPriority = task.priority || 'low';
        tempEndTime = task.end_time || '';
        tempRepeatType = task.repeat_type || 'none';
        tempRepeatEnd = task.repeat_end || '';
        tempSubtasks = JSON.parse(JSON.stringify(task.subtasks ||[]));
        tempSearchTerms = JSON.parse(JSON.stringify(task.search_terms ||[]));
        tempSearchProvider = appSettings.provider || 'auto';

        setTimeout(() => {
          const pMap = {'auto':'自动 (随机源)', 'bilibili':'哔哩哔哩', 'weibo':'微博热搜', 'zhihu':'知乎热榜', 'baidu':'百度热搜'};
          const el = document.getElementById('edit-search-provider-display');
          if (el) el.innerText = pMap[tempSearchProvider];
        }, 10);
      } else {
        btnSave.classList.add('hidden'); btnDel.classList.remove('hidden'); btnEdit.innerText = "编辑";
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
        'auto': '自动 (随机源)', 'bilibili': '哔哩哔哩', 'weibo': '微博热搜', 'zhihu': '知乎热榜', 'baidu': '百度热搜'
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
      if (titleEl) titleEl.textContent = (target === 'end') ? '选择结束时间' : '选择开始时间';
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
      var selectedTime = `${String(timePickerHour).padStart(2,'0')}:${String(timePickerMin).padStart(2,'0')}`;
      if (timePickerTarget === 'end') {
        tempEndTime = selectedTime;
        if(activeMode === 'add') updateAddUI();
        else if(activeMode === 'edit') document.getElementById('edit-endtime-display').innerText = '结束 ' + tempEndTime;
      } else {
        tempTime = selectedTime;
        if (!tempEndTime && activeMode !== 'edit') {
          var parts = [timePickerHour, timePickerMin + 30];
          if (parts[1] >= 60) { parts[0] += 1; parts[1] -= 60; }
          if (parts[0] >= 24) parts[0] = 23;
          tempEndTime = `${String(parts[0]).padStart(2,'0')}:${String(parts[1]).padStart(2,'0')}`;
        }
        if(activeMode === 'add') updateAddUI(); else if(activeMode === 'edit') document.getElementById('edit-time-display').innerText = '开始 ' + tempTime;
      }
      closeTimePicker();
    }

    function clearTime() {
      if (timePickerTarget === 'end') {
        tempEndTime = '';
        if(activeMode === 'add') updateAddUI();
        else if(activeMode === 'edit') document.getElementById('edit-endtime-display').innerText = '结束 --:--';
      } else {
        tempTime = '';
        if(activeMode === 'add') updateAddUI(); else if(activeMode === 'edit') document.getElementById('edit-time-display').innerText = '开始 --:--';
      }
      closeTimePicker();
    }
    function closeTimePicker() { document.getElementById('modal-time').classList.remove('active'); }

    function togglePriorityMenu(mode, triggerEl) {
      activeMode = mode;
      showPopover('popover-priority', triggerEl, false);
    }

    function selectPriority(val) {
      tempPriority = val; const pMapShort = {low:'优先级: 低', med:'优先级: 中', high:'优先级: 高'};
      if(activeMode === 'add') updateAddUI(); else if(activeMode === 'edit') document.getElementById('edit-priority-display').innerText = pMapShort[val];
      document.getElementById('popover-priority').style.display = 'none';
    }

    function handleActionClick(e, action) {
      const task = todos[currentDetailIndex]; pendingAction = action;
      const popover = document.getElementById('popover-action'); const title = document.getElementById('popover-title'); const options = document.getElementById('popover-options');
      options.innerHTML = '';
      if (action === 'delete') {
        title.innerText = "警告：确认删除？";
        if (task.isSeries) {
          options.innerHTML += `<button onclick="confirmAction('single')">仅此项</button>`;
          options.innerHTML += `<button onclick="confirmAction('future')">此项及以后</button>`;
          options.innerHTML += `<button onclick="confirmAction('future_repeat')">以后</button>`;
          options.innerHTML += `<button onclick="confirmAction('all')">所有</button>`;
        } else { options.innerHTML += `<button onclick="confirmAction('single')">确认删除</button>`; }
      } else if (action === 'save') {
        const isRepeatNow = tempRepeatType !== 'none';
        if (task.isSeries || isRepeatNow) {
          title.innerText = "保存为：";
          options.innerHTML += `<button onclick="confirmAction('single')">仅此项</button>`;
          options.innerHTML += `<button onclick="confirmAction('future')">此项及以后</button>`;
          options.innerHTML += `<button onclick="confirmAction('future_repeat')">以后</button>`;
          options.innerHTML += `<button onclick="confirmAction('all')">所有</button>`;
        } else { confirmAction('single'); return; }
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
        task.text = document.getElementById('edit-text').value; task.time = tempTime; task.priority = tempPriority;
        task.end_time = tempEndTime;
        task.desc = document.getElementById('edit-desc').value; task.url = document.getElementById('edit-url').value;
        task.copyText = document.getElementById('edit-copy').value; task.copy_text = task.copyText;
        task.subtasks = tempSubtasks; task.search_terms = tempSearchTerms;
        task.repeat_type = tempRepeatType; task.repeat_custom = '';
        task.repeat_end = tempRepeatEnd;
        task.category_id = tempCategoryId;

        toggleEditMode();
        await fetch('/api/todo-action', { method: 'POST', body: JSON.stringify({ action: 'UPDATE', date: formatDate(currentDate), task: task, scope: scope }), headers: { 'Content-Type': 'application/json' } });
        await loadTodos();
        const newIndex = todos.findIndex(t => t.id === task.id);
        if (newIndex !== -1) currentDetailIndex = newIndex; else closeDetail();
      }
    }



    function openCalendar() { calendarMode = 'navigate'; calDate = new Date(currentDate); calMode = 'date'; renderCalendar(); document.getElementById('modal-calendar').classList.add('active'); }
    function calChange(offset) {
      if (calendarMode === 'repeat_end') { calDate.setMonth(calDate.getMonth() + offset); renderCalendarForRepeatEnd(); return; }
      if (calMode === 'date') { calDate.setMonth(calDate.getMonth() + offset); renderCalendar(); }
      else if (calMode === 'year') { yearPickerStart += offset * 12; openYearPicker(yearPickerStart); }
      else if (calMode === 'month') { calDate.setFullYear(calDate.getFullYear() + offset); openMonthPicker(); }
    }

    function openCalendarForAdd() { calendarMode = 'select'; calDate = new Date(tempAddDate || currentDate); renderCalendar(); document.getElementById('modal-calendar').classList.add('active');
    }
    function openCalendarForEdit() { calendarMode = 'edit_date'; var t = todos[currentDetailIndex]; calDate = new Date(t.date || currentDate); renderCalendar(); document.getElementById('modal-calendar').classList.add('active'); }

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
      actionBtn.innerText = '清除截止日期'; actionBtn.onclick = function() {
        tempRepeatEnd = '';
        if (calendarRepeatEndTarget === 'add') {
          document.getElementById('add-repeat-end-display').innerText = '循环截止: 永不';
        } else {
          document.getElementById('edit-repeat-end-display').innerText = '循环截止: 永不';
        }
        document.getElementById('modal-calendar').classList.remove('active');
      };
      document.getElementById('cal-prev').innerText = '< 上月'; document.getElementById('cal-next').innerText = '下月 >';
      document.getElementById('cal-title').innerHTML = `<span class="cal-title-btn" onclick="openYearPicker()">${year}年</span> <span class="cal-title-btn" onclick="openMonthPicker()">${month + 1}月</span>`;
      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(7, 1fr)'; grid.innerHTML = '';
      const days = ['日','一','二','三','四','五','六']; days.forEach(d => grid.innerHTML += `<div class="cal-day-name">${d}</div>`);
      const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
      const selectedStr = tempRepeatEnd || '';
      for(let i=0; i<firstDay; i++) grid.innerHTML += `<div class="cal-date empty"></div>`;
      for(let i=1; i<=daysInMonth; i++) {
        const d = new Date(year, month, i); const dStr = formatDate(d);
        let className = 'cal-date';
        if (dStr === selectedStr) className += ' selected';
        const el = document.createElement('div'); el.className = className; el.innerText = i;
        el.onclick = () => {
          tempRepeatEnd = formatDate(new Date(year, month, i));
          if (calendarRepeatEndTarget === 'add') {
            document.getElementById('add-repeat-end-display').innerText = '循环截止: ' + tempRepeatEnd;
          } else {
            document.getElementById('edit-repeat-end-display').innerText = '循环截止: ' + tempRepeatEnd;
          }
          document.getElementById('modal-calendar').classList.remove('active');
        };
        grid.appendChild(el);
      }
    }

    function renderCalendar() {
      calMode = 'date';
      const year = calDate.getFullYear(); const month = calDate.getMonth();
      const actionBtn = document.getElementById('cal-action-btn'); actionBtn.innerText = '返回今日'; actionBtn.onclick = jumpToToday;

      document.getElementById('cal-prev').innerText = '< 上月'; document.getElementById('cal-next').innerText = '下月 >';
      document.getElementById('cal-title').innerHTML = `<span class="cal-title-btn" onclick="openYearPicker()">${year}年</span> <span class="cal-title-btn" onclick="openMonthPicker()">${month + 1}月</span>`;

      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(7, 1fr)'; grid.innerHTML = '';
      const days = ['日','一','二','三','四','五','六']; days.forEach(d => grid.innerHTML += `<div class="cal-day-name">${d}</div>`);
      const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
      const todayStr = formatDate(new Date()); const selectedStr = (calendarMode === 'select' || calendarMode === 'edit_date') ? formatDate(calDate) : formatDate(currentDate);

      for(let i=0; i<firstDay; i++) grid.innerHTML += `<div class="cal-date empty"></div>`;
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
            var t = todos[currentDetailIndex]; t.date = formatDate(new Date(year, month, i));
            document.getElementById('edit-date-display').innerText = t.date;
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
      const actionBtn = document.getElementById('cal-action-btn'); actionBtn.innerText = '返回'; actionBtn.onclick = backFn;
      document.getElementById('cal-prev').innerText = '< 上年'; document.getElementById('cal-next').innerText = '下年 >';
      document.getElementById('cal-title').innerHTML = `<span class="cal-title-btn" onclick="openYearPicker()">${calDate.getFullYear()}年</span> <span class="cal-title-btn">选择月份</span>`;
      const grid = document.getElementById('cal-grid'); grid.style.gridTemplateColumns = 'repeat(4, 1fr)'; grid.innerHTML = '';
      for(let i=0; i<12; i++) {
        const el = document.createElement('div'); el.className = 'cal-date' + (calDate.getMonth() === i ? ' selected' : ''); el.innerText = (i+1) + '月';
        el.onclick = () => { calDate.setMonth(i); if (calendarMode === 'repeat_end') renderCalendarForRepeatEnd(); else renderCalendar(); }; grid.appendChild(el);
      }
    }

    function openYearPicker(startYear) {
      calMode = 'year';
      if (!startYear) startYear = calDate.getFullYear() - 4; yearPickerStart = startYear;
      var backFn = (calendarMode === 'repeat_end') ? renderCalendarForRepeatEnd : renderCalendar;
      const actionBtn = document.getElementById('cal-action-btn'); actionBtn.innerText = '返回'; actionBtn.onclick = backFn;
      document.getElementById('cal-prev').innerText = '< 上页'; document.getElementById('cal-next').innerText = '下页 >';
      document.getElementById('cal-title').innerHTML = `<span class="cal-title-btn">选择年份</span> <span class="cal-title-btn" onclick="openMonthPicker()">${calDate.getMonth() + 1}月</span>`;
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
        var t = todos[currentDetailIndex]; t.date = formatDate(new Date());
        document.getElementById('edit-date-display').innerText = t.date;
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
      // 登录
      login: login,
      logout: async function() {
        await fetch('/api/logout', { method: 'POST' });
        location.reload();
      },
      // 主题
      toggleTheme: toggleTheme,
      // 日期导航
      changeDate: changeDate,
      openCalendar: openCalendar,
      closeCalendar: closeCalendar,
      jumpToToday: jumpToToday,
      calChange: calChange,
      openYearPicker: openYearPicker,
      openMonthPicker: openMonthPicker,
      // 新建事项
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
      // 分类
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
      // 视图
      openViewModal: openViewModal,
      closeViewModal: closeViewModal,
      setViewFilter: setViewFilter,
      setViewCategory: setViewCategory,
      setViewSort: setViewSort,
      setViewOrder: setViewOrder,
      // 批量操作
      toggleBatchMode: toggleBatchMode,
      batchSelectAll: batchSelectAll,
      batchToggleDone: batchToggleDone,
      batchDelete: batchDelete,
      exitBatchMode: exitBatchMode,
      // 详情
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
      // 回收站
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
      // 统计
      openStats: openStats,
      closeStats: closeStats,
      switchStatsTab: switchStatsTab,
      loadAnnualReport: loadAnnualReport,
      // 设置
      openSettings: openSettings,
      closeSettings: closeSettings,
      saveAndCloseSettings: saveAndCloseSettings,
      toggleSettingPopover: toggleSettingPopover,
      selectSetting: selectSetting,
      toggleCustomCodeEnabled: toggleCustomCodeEnabled,
      previewCustomCode: previewCustomCode,
      resetCustomCode: resetCustomCode,
      restoreAllPreview: restoreAllPreview,
      // 数据管理
      exportData: exportData,
      importData: importData,
      factoryReset: factoryReset,
      deleteSessionByIndex: deleteSessionByIndex,
      deleteAllSessions: deleteAllSessions,
      onScaleSliderChange: onScaleSliderChange,
      setScalePreset: setScalePreset,
      resetScaleBrowserData: resetScaleBrowserData,
      checkUpdate: checkUpdate,
      compareVersions: compareVersions,
    });


  })();