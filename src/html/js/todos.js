export const todos = `
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
        subText = \`[ \${prefix} | 拉取中... ]\`;
      } else {
        const total = todos.length;
        const done = todos.filter(t => t.done).length;
        subText = \`[ \${prefix} | 进度: \${done}/\${total} ]\`;
      }

      document.getElementById('date-main').innerText = str;
      document.getElementById('date-sub').innerText = subText;
    }

    // ==================== 日期切换加载竞态控制 ====================
    // 快速切换日期时，旧请求若未完成会浪费网络资源，且其响应可能晚于新请求到达，
    // 导致 UI 显示错误日期的数据。这里用双重防护：
    //   1) AbortController：主动 abort 上一个未完成的 fetch（含 SW 链路），
    //      释放网络资源，避免无效请求继续在后端跑。
    //   2) generation 计数：即便 abort 未真正生效（如老浏览器、SW 缓存命中已返回），
    //      旧代次的响应也不会写入 todos 或触发 renderTodos，确保 UI 一致。
    let _loadTodosGen = 0;
    let _loadTodosAbortCtrl = null;

    async function loadTodos() {
      const dateStr = formatDate(currentDate);
      // 自增 generation，标记本次为最新一代
      const myGen = ++_loadTodosGen;
      // 中断上一个未完成的请求；不支持 AbortController 时降级为仅靠 generation 校验
      if (_loadTodosAbortCtrl) {
        try { _loadTodosAbortCtrl.abort(); } catch (e) {}
      }
      let abortCtrl = null;
      const fetchOpts = {};
      if (typeof AbortController === 'function') {
        abortCtrl = new AbortController();
        fetchOpts.signal = abortCtrl.signal;
        _loadTodosAbortCtrl = abortCtrl;
      }

      updateDateHeader(true);
      document.getElementById('todo-list').innerHTML = '<div style="padding:20px;text-align:center;">数据拉取中...</div>';
      try {
        const res = await fetch(\`/api/todos?date=\${dateStr}\`, fetchOpts);
        if (res.status === 503) {
          // SW返回503表示离线且无缓存
          // 仅当本次仍是最新一代时才更新 UI，避免旧请求覆盖新请求结果
          if (myGen !== _loadTodosGen) return;
          document.getElementById('todo-list').innerHTML = '<div style="padding:20px;text-align:center;color:var(--warn);">离线 — 无缓存数据</div>';
          return;
        }
        if (res.ok) {
          const data = await res.json();
          // 竞态保护：仅当本次仍是最新一代时才写入 todos 与渲染
          // （即便 abort 未生效，如 SW 缓存命中或老浏览器，generation 仍能挡住旧响应）
          if (myGen !== _loadTodosGen) return;
          todos = data;
          renderTodos();
          // 启动/停止每秒 ticking（仅当存在 running 计时器时）
          ensureTimerTick();
        }
      } catch (e) {
        // 主动中断引发的 AbortError 不算错误，静默丢弃
        if (e && e.name === 'AbortError') return;
        // 旧代次的结果被新代次覆盖，静默丢弃（避免旧请求的错误覆盖新请求的 UI）
        if (myGen !== _loadTodosGen) return;
        // 网络错误且SW未拦截
        if (!navigator.onLine) {
          document.getElementById('todo-list').innerHTML = '<div style="padding:20px;text-align:center;color:var(--warn);">离线 — 无缓存数据</div>';
        } else {
          console.error(e);
        }
      } finally {
        // 清理 abort controller 引用（仅当本次仍持有最新 controller 时才清空，
        // 避免误清新请求的 controller 导致新请求无法被后续 abort）
        if (abortCtrl && _loadTodosAbortCtrl === abortCtrl) _loadTodosAbortCtrl = null;
      }
    }

    function updateViewBtnLabel() {
      var fMap = { 'all': '全部', 'todo': '未完成', 'done': '已完成' };
      var sMap = { 'time': '时间', 'priority': '优先级' };
      var catLabel;
      if (filterCategoryIds.size === 0) {
        catLabel = '全部分类';
      } else if (filterCategoryIds.size === 1) {
        var onlyId = filterCategoryIds.values().next().value;
        catLabel = getCategoryName(onlyId) || '已选 1 个';
      } else {
        catLabel = '已选 ' + filterCategoryIds.size + ' 个';
      }
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
      allBtn.className = 'category-modal-item' + (filterCategoryIds.size === 0 ? ' selected' : '');
      allBtn.innerHTML = '<span class="cat-name">全部</span>';
      allBtn.onclick = function() { setViewCategory(''); };
      container.appendChild(allBtn);
      for (var i = 0; i < categoriesList.length; i++) {
        var cat = categoriesList[i];
        var btn = document.createElement('div');
        btn.className = 'category-modal-item' + (filterCategoryIds.has(cat.id) ? ' selected' : '');
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
      _navPush('modal-view', closeViewModal, '/view');
    }

    function closeViewModal() {
      if (_isNavClosing) {
        document.getElementById('modal-view').classList.remove('active');
        return;
      }
      _navClose('modal-view');
    }

    function setViewFilter(method) {
      filterMethod = method;
      activateBtnGroup('view-filter-btns', method);
      updateViewBtnLabel();
      renderTodos();
    }

    function setViewCategory(catId) {
      // 空字符串 = "全部" 按钮，清空选择集
      if (!catId) {
        filterCategoryIds.clear();
      } else if (filterCategoryIds.has(catId)) {
        filterCategoryIds.delete(catId);
      } else {
        filterCategoryIds.add(catId);
      }
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
      if (filterCategoryIds.size > 0) filteredTodos = filteredTodos.filter(function(t){ return filterCategoryIds.has(t.category_id); });

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
      // 若该事项有活动计时器，一并清除（不记录到历史）
      if (typeof clearTimerState === 'function') clearTimerState(todos[index].id);
      // 乐观更新：先刷新 UI，再发请求（与 completeTimer 一致，避免等待网络）
      renderTodos();
      try {
        await fetch('/api/todo-action', {
          method: 'POST',
          body: JSON.stringify({ action: 'TOGGLE_DONE', task: { id: todos[index].id, done: todos[index].done } }),
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        // 网络失败不回滚本地状态，下次拉取会刷新
      }
    }

    // ==================== 计时器（仅重复 todo） ====================
    // 状态机: idle -> running -> paused -> running ... -> completed (调用 TIMER_COMPLETE)
    // localStorage key: cf_timer_<todo_id>
    // value: { s: <start_ms>, p: <累计paused_ms>, lp: <last_pause_start_ms|null> }
    // 服务端记录: { s, e, p } 三元组，elapsed = e - s - p
    const TIMER_MAX_RECORDS = 10;
    const TIMER_STALE_MS = 24 * 60 * 60 * 1000; // 超过 24h 视为遗留，自动清除
    let timerTickHandle = null;

    function timerKey(todoId) { return 'cf_timer_' + todoId; }

    function readTimerState(todoId) {
      try {
        const raw = localStorage.getItem(timerKey(todoId));
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj.s !== 'number') return null;
        if (typeof obj.p !== 'number') obj.p = 0;
        if (obj.lp !== null && typeof obj.lp !== 'number') obj.lp = null;
        return obj;
      } catch (e) { return null; }
    }

    function writeTimerState(todoId, state) {
      try {
        if (state === null) localStorage.removeItem(timerKey(todoId));
        else localStorage.setItem(timerKey(todoId), JSON.stringify(state));
      } catch (e) {}
    }

    function clearTimerState(todoId) {
      writeTimerState(todoId, null);
      ensureTimerTick();
    }

    // 返回当前 elapsed_ms（running 时持续累加，paused 时冻结）
    function timerElapsed(state) {
      if (!state) return 0;
      const base = (state.lp !== null ? state.lp : Date.now()) - state.s;
      return Math.max(0, base - state.p);
    }

    function isTimerRunning(state) {
      return state && state.lp === null;
    }

    function isTimerPaused(state) {
      return state && state.lp !== null;
    }

    // 遗留计时器清理：若 running 且距 start 超过 24h，直接清除
    function maybePruneStaleTimer(todoId) {
      const st = readTimerState(todoId);
      if (!st) return null;
      if (isTimerRunning(st) && (Date.now() - st.s) > TIMER_STALE_MS) {
        writeTimerState(todoId, null);
        return null;
      }
      return st;
    }

    function startTimer(todoId) {
      // 若已有计时器（含遗留），先清除
      writeTimerState(todoId, { s: Date.now(), p: 0, lp: null });
      ensureTimerTick();
      renderTodos();
    }

    function pauseTimer(todoId) {
      const st = readTimerState(todoId);
      if (!st || !isTimerRunning(st)) return;
      writeTimerState(todoId, { s: st.s, p: st.p, lp: Date.now() });
      ensureTimerTick();
      renderTodos();
    }

    function resumeTimer(todoId) {
      const st = readTimerState(todoId);
      if (!st || !isTimerPaused(st)) return;
      const pausedDelta = Date.now() - st.lp;
      writeTimerState(todoId, { s: st.s, p: st.p + pausedDelta, lp: null });
      ensureTimerTick();
      renderTodos();
    }

    function abortTimer(todoId) {
      writeTimerState(todoId, null);
      ensureTimerTick();
      renderTodos();
    }

    // 结束计时 + 标记完成 + 写入历史
    async function completeTimer(index) {
      const todo = todos[index];
      if (!todo) return;
      const st = readTimerState(todo.id);
      if (!st) return;
      const now = Date.now();
      let endMs = now;
      let pausedMs = st.p;
      if (isTimerPaused(st)) pausedMs += (now - st.lp);
      const elapsedMs = endMs - st.s - pausedMs;
      // 本地兜底：时长不合理则不写记录，仅清除本地 + 完成事项
      let record = null;
      if (elapsedMs >= 1000 && elapsedMs <= TIMER_STALE_MS) {
        record = { s: st.s, e: endMs, p: Math.max(0, Math.floor(pausedMs)) };
      }
      writeTimerState(todo.id, null);
      todo.done = true;
      ensureTimerTick();
      renderTodos();
      // 同步阶段：把刚算出的 record 作为参数直传给 refreshDetailTimerBlock，
      // 让 UI 即刻渲染"完成于 X，耗时 Y"。
      // 不写入任何缓存（避免状态残留/串台/失效问题），record 仅在本次调用中消费。
      // await fetch 之后的 reloadDetailTimeRecords 会用服务器返回的最新 records 重新渲染。
      if (typeof refreshDetailTimerBlock === 'function' && currentDetailIndex === index) {
        refreshDetailTimerBlock(record);
      }
      try {
        await fetch('/api/todo-action', {
          method: 'POST',
          body: JSON.stringify({
            action: 'TIMER_COMPLETE',
            task: { id: todo.id, parent_id: todo.parent_id },
            parentId: todo.parent_id,
            record: record
          }),
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        // 网络失败不回滚本地状态（用户已视觉完成），下次拉取会刷新
      }
      // 服务器已写入新记录：实时调用 API 拉取权威数据（todos + time_records）
      // 解决背景/前台切换后 todos 数组与服务器不一致、本地缓存导致 UI 显示错误的问题
      if (typeof reloadDetailAfterComplete === 'function' && currentDetailIndex === index) {
        reloadDetailAfterComplete();
      }
    }

    // 全局 ticking：每秒重渲染列表，让 running 计时器更新显示
    // 仅当存在 running 计时器时启用，避免空转
    function ensureTimerTick() {
      const hasRunning = todos.some(function(t) {
        const st = readTimerState(t.id);
        return st && isTimerRunning(st);
      });
      if (hasRunning && !timerTickHandle) {
        timerTickHandle = setInterval(function() {
          // 仅更新计时器相关 DOM，避免完整重渲染破坏滚动/动画
          document.querySelectorAll('[data-timer-id]').forEach(function(el) {
            const id = el.getAttribute('data-timer-id');
            // 详情面板用 <id>-detail 后缀，需要还原
            const realId = id.endsWith('-detail') ? id.slice(0, -'-detail'.length) : id;
            const st = readTimerState(realId);
            if (!st) { el.textContent = ''; return; }
            el.textContent = formatElapsed(timerElapsed(st));
          });
        }, 1000);
      } else if (!hasRunning && timerTickHandle) {
        clearInterval(timerTickHandle);
        timerTickHandle = null;
      }
    }

    function formatElapsed(ms) {
      if (!ms || ms < 0) ms = 0;
      const totalSec = Math.floor(ms / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const pad = function(n) { return String(n).padStart(2, '0'); };
      // 固定 3 段 HH:MM:SS，便于扫读且对齐
      return pad(h) + ':' + pad(m) + ':' + pad(s);
    }

    function formatMs(ms) {
      if (!ms || ms < 0) ms = 0;
      const totalSec = Math.floor(ms / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      // 数字与单位之间加空格，便于扫读；多段之间也用空格分隔
      if (h > 0) return h + ' 小时' + (m > 0 ? ' ' + m + ' 分' : '');
      if (m > 0) return m + ' 分' + (s > 0 ? ' ' + s + ' 秒' : '');
      return s + ' 秒';
    }

    // 基于历史记录预估完成时间（中位数更稳健）
    function predictDuration(records) {
      if (!records || !records.length) return null;
      const durations = records.map(function(r) {
        return Math.max(0, (r.e || 0) - (r.s || 0) - (r.p || 0));
      }).filter(function(d) { return d > 0; });
      if (!durations.length) return null;
      durations.sort(function(a, b) { return a - b; });
      const mid = Math.floor(durations.length / 2);
      return durations.length % 2 === 0
        ? Math.floor((durations[mid - 1] + durations[mid]) / 2)
        : durations[mid];
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
      if (filterCategoryIds.size > 0) filteredTodos = filteredTodos.filter(t => filterCategoryIds.has(t.category_id));

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

      // 批量完成时：对有活动计时器的选中项，计算 record 并清本地状态
      // 类比"职场身份高低"：开启计时的 todo 完成时记录耗时，未开启的只标记完成
      const timerRecords = [];  // [{ id, parentId, record }]
      if (targetDone) {
        const now = Date.now();
        Array.from(selectedTasks).forEach(idx => {
          const todo = todos[idx];
          if (!todo) return;
          const st = readTimerState(todo.id);
          if (!st) return;
          let pausedMs = st.p;
          if (isTimerPaused(st)) pausedMs += (now - st.lp);
          const elapsedMs = now - st.s - pausedMs;
          // 时长合理才记录（与 completeTimer 一致）
          if (elapsedMs >= 1000 && elapsedMs <= TIMER_STALE_MS) {
            timerRecords.push({
              id: todo.id,
              parentId: todo.parent_id,
              record: { s: st.s, e: now, p: Math.max(0, Math.floor(pausedMs)) }
            });
          }
          // 清除本地计时器状态（无论是否记录）
          writeTimerState(todo.id, null);
        });
        ensureTimerTick();
      }

      Array.from(selectedTasks).forEach(idx => todos[idx].done = targetDone);
      renderTodos();
      // 乐观更新：先退出批量模式，再发请求（避免等待网络才退出）
      exitBatchMode();

      try {
        await fetch('/api/todo-action', {
          method: 'POST',
          body: JSON.stringify({
            action: 'BATCH_TOGGLE_DONE',
            ids: ids,
            doneStatus: targetDone,
            timerRecords: timerRecords.length > 0 ? timerRecords : undefined
          }),
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        // 网络失败不回滚本地状态，下次拉取会刷新
      }

      // 批量完成后，若详情面板正打开且当前事项有记录写入，重新拉取 time_records
      if (targetDone && timerRecords.length > 0 && typeof reloadDetailTimeRecords === 'function' && currentDetailIndex >= 0) {
        const cur = todos[currentDetailIndex];
        if (cur && timerRecords.some(function(r) { return r.id === cur.id; })) {
          reloadDetailTimeRecords();
        }
      }
    }

    async function batchDelete() {
      if (selectedTasks.size === 0) return;
      if (!confirm(\`确认删除选中的 \${selectedTasks.size} 个事项吗？(仅删除当天的当前项)\`)) return;
      const ids = Array.from(selectedTasks).map(idx => todos[idx].id);
      await fetch('/api/todo-action', {
        method: 'POST', body: JSON.stringify({ action: 'BATCH_DELETE', ids: ids }),
        headers: { 'Content-Type': 'application/json' }
      });
      exitBatchMode(); loadTodos();
    }
`;
