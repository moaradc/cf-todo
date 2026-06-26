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

      // 注意：必须用副本排序，禁止 in-place sort 全局 todos。
      // 原因：详情面板的 currentDetailIndex 是 todos 数组的下标，
      // 若 renderTodos 直接对 todos.sort()，会把 currentDetailIndex 指向的元素换走，
      // 导致 refreshDetailTimerBlock 取到错误的 todo（典型现象：completeTimer 后
      // 详情页本应显示"完成于 X"，却显示"开始计时"）。
      var filteredTodos = todos;
      if (filterMethod === 'todo') filteredTodos = todos.filter(function(t){ return !t.done; });
      else if (filterMethod === 'done') filteredTodos = todos.filter(function(t){ return t.done; });
      if (filterCategoryIds.size > 0) filteredTodos = filteredTodos.filter(function(t){ return filterCategoryIds.has(t.category_id); });

      var listEl = document.getElementById('todo-list');

      if (filteredTodos.length === 0) {
        listEl.innerHTML = '<div style="padding:40px;text-align:center;border:1px dashed #666;">无数据 // NULL</div>';
        return;
      }

      // 复制一份再排序，避免污染全局 todos 的顺序
      filteredTodos = filteredTodos.slice();
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
      const todo = todos[index];
      if (!todo) return;
      // 计时功能为碎时记独有；普通重复 todo 不支持计时（前端无计时按钮），
      // 但仍兼容遗留 localStorage 计时器状态：清空并走 toggleDone。
      const isFragment = todo.repeat_type === 'fragment';
      // 有活动计时器时点完成：转交 completeTimer，保留计时进度写入真实耗时 record
      if (isFragment && !todo.done && typeof readTimerState === 'function' && readTimerState(todo.id)) {
        await completeTimer(index);
        return;
      }
      todo.done = !todo.done;
      if (typeof clearTimerState === 'function') clearTimerState(todo.id);
      if (!todo.done) {
        // 取消勾选：清空实例级 time_records（与服务端 TOGGLE_DONE 一致）
        // 碎时记"继续计时"按钮路径（continueAfterDone）才会保留累计（keepRecords=true）
        todo.time_records = [];
        // 碎时记取消勾选时 date 从 fragment_anchor 恢复（保留用户设置的起始日期）
        if (isFragment) {
          todo.date = todo.fragment_anchor || '';
        }
      } else {
        // 勾选完成（无计时器）：构造零耗时 record，仅记录完成时刻
        const now = Date.now();
        try {
          let arr = Array.isArray(todo.time_records)
            ? todo.time_records
            : (typeof todo.time_records === 'string' ? JSON.parse(todo.time_records || '[]') : []);
          if (!Array.isArray(arr)) arr = [];
          arr.push({ s: now, e: now, p: 0 });
          // 普通 todo：FIFO 5 截断（与 bd3f88d / 后端 TOGGLE_DONE 一致）
          // 碎时记：不截断（保留全部 session 用于累计统计）
          if (!isFragment && arr.length > 5) arr = arr.slice(arr.length - 5);
          todo.time_records = arr;
        } catch (e) {
          todo.time_records = [{ s: now, e: now, p: 0 }];
        }
        // 碎时记：完成时 date 冻结到当前查看日期（与后端 TOGGLE_DONE 一致）
        // 普通 todo.date 不变（bd3f88d 行为）
        if (isFragment) {
          todo.date = formatDate(currentDate);
        }
      }
      renderTodos();
      try {
        const now = Date.now();
        // 碎时记：toggleDone 显式传 keepRecords: false，明确"取消完成应清除 records"语义。
        //          与 continueAfterDone 的 keepRecords: true 形成对照，防止未来维护者误加 true。
        // 普通 todo：不传 keepRecords（bd3f88d 行为，服务端默认清空 records）
        const payload = { action: 'TOGGLE_DONE', task: { id: todo.id, done: todo.done } };
        if (isFragment) {
          payload.keepRecords = false;
        }
        if (todo.done) {
          payload.record = { s: now, e: now, p: 0 };
          // 碎时记完成需要 date 字段供后端冻结（取当前查看日期）
          if (isFragment) {
            payload.date = formatDate(currentDate);
          }
        }
        await fetch('/api/todo-action', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        // 网络失败不回滚，下次拉取会刷新
      }
    }

    // ==================== 计时器 ====================
    // 状态机: idle -> running -> paused -> running ... -> completed (TIMER_COMPLETE)
    //   或: idle -> running -> ... -> record (TIMER_RECORD) -> idle -> running ...
    // localStorage key: cf_timer_<todo_id>
    // value: { s: <start_ms>, p: <累计paused_ms>, lp: <last_pause_start_ms|null> }
    // 服务端记录: { s, e, p }，elapsed = e - s - p
    //
    // 碎时记 (fragment) 计时模型：
    // - 多 session 累计，支持 [记录]/[继续计时]
    // - 实例级 time_records: [{s,e,p}, ...]，不 FIFO，累计 = Σ(e-s-p)
    // - 无模板级 time_records（碎时记不创建模板，predictDuration 不可用）
    // - 单 session 上限 7d (TIMER_MAX_SESSION_MS)
    //
    // 普通重复 todo 计时功能（复刻 bd3f88d）：
    // - 仅支持 [开始/暂停/继续/完成/取消]，无 [记录]/[继续计时]
    // - 实例级 time_records FIFO 5 截断
    // - 模板级 time_records FIFO 10 截断（供 predictDuration 预估）
    // - 单 session 上限 24h (TIMER_STALE_MS)
    // - TIMER_RECORD 对普通 todo no-op（前端不暴露按钮，后端拒绝）
    function isFragmentTodo(todoId) {
      const t = todos.find(function(t) { return t.id === todoId; });
      return !!(t && t.repeat_type === 'fragment');
    }
    const TIMER_STALE_MS = 24 * 60 * 60 * 1000; // 超过 24h 视为遗留，自动清除
    const TIMER_MAX_SESSION_MS = 7 * 24 * 60 * 60 * 1000; // 单 session 上限（与服务端一致）
    let timerTickHandle = null;
    // 操作锁：防止 async 操作（completeTimer/recordTimer/continueAfterDone）重复触发
    // 场景：用户快速连点"完成"；记录请求飞行中点完成
    // 语义：操作开始时 add(todoId)，结束（无论成功失败）时 delete(todoId)
    const timerBusyIds = new Set();
    function acquireTimerLock(todoId) {
      if (timerBusyIds.has(todoId)) return false;
      timerBusyIds.add(todoId);
      return true;
    }
    function releaseTimerLock(todoId) {
      timerBusyIds.delete(todoId);
    }

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

    // 遗留计时器清理：
    // - running 态：距 start 超 24h，直接清除（用户忘关，进度无意义）
    // - paused 态：距 lp（暂停开始）超 24h，尝试记录当前 session 后清除；
    //   若 session 总跨度超 7d（服务端会拒绝），不记录直接清除
    function maybePruneStaleTimer(todoId) {
      const st = readTimerState(todoId);
      if (!st) return null;
      const now = Date.now();
      if (isTimerRunning(st) && (now - st.s) > TIMER_STALE_MS) {
        writeTimerState(todoId, null);
        return null;
      }
      if (isTimerPaused(st) && (now - st.lp) > TIMER_STALE_MS) {
        // paused 超 24h：尝试保存 session（保留用户进度）
        const todo = todos.find(function(t) { return t.id === todoId; });
        if (todo) {
          let pausedMs = st.p + (now - st.lp);
          const elapsedMs = now - st.s - pausedMs;
          // session 合法才记录，否则丢弃（服务端会拒绝超 7d 的）
          if (elapsedMs >= 1000 && elapsedMs <= TIMER_MAX_SESSION_MS) {
            const record = { s: st.s, e: now, p: Math.max(0, Math.floor(pausedMs)) };
            try {
              let arr = parseTimeRecords(todo.time_records);
              arr.push(record);
              todo.time_records = arr;
            } catch (e) {
              todo.time_records = [record];
            }
            // 异步写服务器，不阻塞渲染
            try {
              fetch('/api/todo-action', {
                method: 'POST',
                body: JSON.stringify({
                  action: 'TIMER_RECORD',
                  task: { id: todo.id, parent_id: todo.parent_id },
                  parentId: todo.parent_id,
                  record: record
                }),
                headers: { 'Content-Type': 'application/json' }
              }).catch(function() {});
            } catch (e) {}
          }
        }
        writeTimerState(todoId, null);
        return null;
      }
      return st;
    }

    // 计算多条 session 记录的累计耗时（毫秒）
    // records: [{s,e,p}, ...]，每条耗时 = max(0, e-s-p)，求和
    function sumRecordsMs(records) {
      if (!Array.isArray(records) || records.length === 0) return 0;
      let total = 0;
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        if (!r || typeof r.s !== 'number' || typeof r.e !== 'number') continue;
        const dur = r.e - r.s - (typeof r.p === 'number' ? r.p : 0);
        if (dur > 0) total += dur;
      }
      return total;
    }

    // 解析 todo.time_records，兼容 string / array 两种形式
    function parseTimeRecords(raw) {
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string' && raw) {
        try {
          const p = JSON.parse(raw);
          return Array.isArray(p) ? p : [];
        } catch (e) { return []; }
      }
      return [];
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

    // 计时"完成"：标记 done=1 + 追加 session 到实例级 + 模板级
    // - 碎时记：实例级不 FIFO（保留全部 session 用于累计统计）；无模板级
    // - 普通 todo：实例级 FIFO 5（复刻 bd3f88d）；模板级 FIFO 10（供 predictDuration）
    async function completeTimer(index) {
      const todo = todos[index];
      if (!todo) return;
      const isFragment = todo.repeat_type === 'fragment';
      // 问题 4 防御：todo 已 done 直接返回（recordTimer 飞行中或重复触发）
      if (todo.done) return;
      // 问题 3 防御：操作锁，防止连点重复触发
      if (!acquireTimerLock(todo.id)) return;
      try {
        const st = readTimerState(todo.id);
        const completedTodoId = todo.id;
        const now = Date.now();
        let record = null;
        if (st) {
          let pausedMs = st.p;
          if (isTimerPaused(st)) pausedMs += (now - st.lp);
          const elapsedMs = now - st.s - pausedMs;
          // 普通 todo 使用 TIMER_STALE_MS（24h）作为时长上限（bd3f88d 行为）
          // 碎时记使用 TIMER_MAX_SESSION_MS（7d）
          const maxMs = isFragment ? TIMER_MAX_SESSION_MS : TIMER_STALE_MS;
          if (elapsedMs >= 1000 && elapsedMs <= maxMs) {
            record = { s: st.s, e: now, p: Math.max(0, Math.floor(pausedMs)) };
          }
          writeTimerState(todo.id, null);
        } else {
          // st === null：无活动计时器。
          // 可能是 recordTimer 飞行中（计时器已清但 todo.done 未变），或 toggleDone 误路由。
          // 不写零耗时 record（避免污染累计），仅标记 done。完成时刻由 done 状态隐含。
          record = null;
        }
        todo.done = true;
        // 乐观更新：仅在有 record 时追加（零耗时场景不追加）
        if (record) {
          try {
            let arr = parseTimeRecords(todo.time_records);
            arr.push(record);
            // 普通 todo：FIFO 5 截断（复刻 bd3f88d）
            // 碎时记：不截断（保留全部 session 用于累计统计）
            if (!isFragment && arr.length > 5) arr = arr.slice(arr.length - 5);
            todo.time_records = arr;
          } catch (e) {
            todo.time_records = [record];
          }
        }
        // 碎时记：完成时 date 冻结到当前查看日期（与后端 TIMER_COMPLETE 一致）
        // 普通 todo.date 不变（bd3f88d 行为）
        if (isFragment) {
          todo.date = formatDate(currentDate);
        }
        ensureTimerTick();
        renderTodos();
        // renderTodos 可能 sort 导致 index 漂移，用 id 重定位
        if (currentDetailIndex >= 0 && todos[currentDetailIndex] && todos[currentDetailIndex].id !== completedTodoId) {
          const newIdx = todos.findIndex(function(t) { return t.id === completedTodoId; });
          if (newIdx !== -1) currentDetailIndex = newIdx;
        }
        // 同步渲染（不等 fetch），record 直传避免缓存竞态
        if (typeof refreshDetailTimerBlock === 'function' && currentDetailIndex === index) {
          refreshDetailTimerBlock(record);
        }
        try {
          // 碎时记完成需要 date 字段供后端冻结（取当前查看日期）
          const completePayload = {
            action: 'TIMER_COMPLETE',
            task: { id: todo.id, parent_id: todo.parent_id },
            parentId: todo.parent_id,
            record: record
          };
          if (todo.repeat_type === 'fragment') {
            completePayload.date = formatDate(currentDate);
          }
          await fetch('/api/todo-action', {
            method: 'POST',
            body: JSON.stringify(completePayload),
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          // 网络失败不回滚，下次拉取会刷新
        }
        if (typeof reloadDetailAfterComplete === 'function' && currentDetailIndex === index) {
          reloadDetailAfterComplete();
        }
      } finally {
        releaseTimerLock(todo.id);
      }
    }

    // 计时"记录"：保存 session 到实例级 time_records，回到空闲态，不标记完成
    // 碎时记独有功能；普通 todo 不支持"记录"（bd3f88d 无此操作）。
    // 若调用链误触发非碎时记 todo 的 recordTimer，防御清空计时器后早退。
    async function recordTimer(index) {
      const todo = todos[index];
      if (!todo) return;
      // 普通 todo：no-op（bd3f88d 无此功能；前端按钮已不渲染）
      if (todo.repeat_type !== 'fragment') {
        writeTimerState(todo.id, null);
        return;
      }
      const st = readTimerState(todo.id);
      if (!st) return;
      // 问题 3 防御：操作锁，防止连点重复触发
      if (!acquireTimerLock(todo.id)) return;
      try {
        const recordedTodoId = todo.id;
        const now = Date.now();
        let pausedMs = st.p;
        if (isTimerPaused(st)) pausedMs += (now - st.lp);
        const elapsedMs = now - st.s - pausedMs;
        // 时长不合理（<1s 或 >7d）：仅清计时器，不写记录
        if (elapsedMs < 1000 || elapsedMs > TIMER_MAX_SESSION_MS) {
          writeTimerState(todo.id, null);
          ensureTimerTick();
          renderTodos();
          if (typeof refreshDetailTimerBlock === 'function' && currentDetailIndex === index) {
            refreshDetailTimerBlock();
          }
          return;
        }
        const record = { s: st.s, e: now, p: Math.max(0, Math.floor(pausedMs)) };

        writeTimerState(todo.id, null);
        try {
          let arr = parseTimeRecords(todo.time_records);
          arr.push(record);
          todo.time_records = arr;
        } catch (e) {
          todo.time_records = [record];
        }
        ensureTimerTick();
        renderTodos();
        if (currentDetailIndex >= 0 && todos[currentDetailIndex] && todos[currentDetailIndex].id !== recordedTodoId) {
          const newIdx = todos.findIndex(function(t) { return t.id === recordedTodoId; });
          if (newIdx !== -1) currentDetailIndex = newIdx;
        }
        if (typeof refreshDetailTimerBlock === 'function' && currentDetailIndex === index) {
          refreshDetailTimerBlock();
        }
        try {
          await fetch('/api/todo-action', {
            method: 'POST',
            body: JSON.stringify({
              action: 'TIMER_RECORD',
              task: { id: todo.id, parent_id: todo.parent_id },
              parentId: todo.parent_id,
              record: record
            }),
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          // 网络失败不回滚，下次拉取会刷新
        }
        if (typeof reloadDetailAfterComplete === 'function' && currentDetailIndex === index) {
          reloadDetailAfterComplete();
        }
      } finally {
        releaseTimerLock(todo.id);
      }
    }

    // "继续计时"：已完成态重新开始计时，保留累计记录
    // TOGGLE_DONE with keepRecords=true → 服务端置 done=0 不清 time_records；本地 startTimer 开新 session
    // 碎时记独有功能；普通 todo 不支持"继续计时"（bd3f88d 无此操作）。
    // 若调用链误触发非碎时记 todo 的 continueAfterDone，防御清空计时器后早退。
    async function continueAfterDone(index) {
      const todo = todos[index];
      if (!todo) return;
      // 普通 todo：no-op（bd3f88d 无此功能；前端按钮已不渲染）
      if (todo.repeat_type !== 'fragment') {
        writeTimerState(todo.id, null);
        return;
      }
      // 问题 3 防御：操作锁
      if (!acquireTimerLock(todo.id)) return;
      try {
        const continuedTodoId = todo.id;
        todo.done = false;
        // 碎时记：取消完成时 date 从 fragment_anchor 恢复（保留用户设置的起始日期）
        // 用户在已完成的碎时记上点"继续计时"后，该事项恢复到未完成状态，起始日期保留
        if (todo.repeat_type === 'fragment') {
          todo.date = todo.fragment_anchor || '';
        }
        startTimer(todo.id);
        if (currentDetailIndex >= 0 && todos[currentDetailIndex] && todos[currentDetailIndex].id !== continuedTodoId) {
          const newIdx = todos.findIndex(function(t) { return t.id === continuedTodoId; });
          if (newIdx !== -1) currentDetailIndex = newIdx;
        }
        if (typeof refreshDetailTimerBlock === 'function' && currentDetailIndex === index) {
          refreshDetailTimerBlock();
        }
        try {
          await fetch('/api/todo-action', {
            method: 'POST',
            body: JSON.stringify({
              action: 'TOGGLE_DONE',
              task: { id: todo.id, done: false },
              keepRecords: true
            }),
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          // 网络失败不回滚，下次拉取会刷新
        }
        if (typeof reloadDetailAfterComplete === 'function' && currentDetailIndex === index) {
          reloadDetailAfterComplete();
        }
      } finally {
        releaseTimerLock(todo.id);
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

      // 批量完成时：对所有选中项构造 record
      // - 有活动计时器：计算真实耗时（s<e），清本地计时器状态
      // - 无活动计时器：零耗时 record（s===e），仅记录完成时刻
      // 与单选 toggleDone 行为一致：勾选框完成都记录"完成于 X"
      const timerRecords = [];  // [{ id, parentId, record }]
      if (targetDone) {
        const now = Date.now();
        Array.from(selectedTasks).forEach(idx => {
          const todo = todos[idx];
          if (!todo) return;
          const st = readTimerState(todo.id);
          if (st) {
            // 有活动计时器：真实耗时 record
            let pausedMs = st.p;
            if (isTimerPaused(st)) pausedMs += (now - st.lp);
            const elapsedMs = now - st.s - pausedMs;
            // 时长合理才记录真实耗时（与 completeTimer 一致），否则降级为零耗时
            if (elapsedMs >= 1000 && elapsedMs <= TIMER_STALE_MS) {
              timerRecords.push({
                id: todo.id,
                parentId: todo.parent_id,
                record: { s: st.s, e: now, p: Math.max(0, Math.floor(pausedMs)) }
              });
            } else {
              // 时长不合理（<1s 或超 24h）：降级为零耗时，至少记录完成时刻
              timerRecords.push({
                id: todo.id,
                parentId: todo.parent_id,
                record: { s: now, e: now, p: 0 }
              });
            }
            // 清除本地计时器状态（无论是否记录真实耗时）
            writeTimerState(todo.id, null);
          } else {
            // 无活动计时器：零耗时 record（s===e），仅记录完成时刻
            timerRecords.push({
              id: todo.id,
              parentId: todo.parent_id,
              record: { s: now, e: now, p: 0 }
            });
          }
        });
        ensureTimerTick();
      }

      Array.from(selectedTasks).forEach(idx => {
        const todo = todos[idx];
        if (!todo) return;
        // 记录原始 done 状态，用于判断是否需要冻结 date（仅对未完成项执行）
        todo._wasDone = !!todo.done;
        todo.done = targetDone;
        // 批量完成时：同步更新本地 todo.time_records（与 completeTimer 保持一致），
        // 让详情面板 getDetailTimeRecords() 能立即拿到新记录
        if (targetDone) {
          const tr = timerRecords.find(r => r.id === todo.id);
          if (tr && tr.record) {
            try {
              let arr = Array.isArray(todo.time_records)
                ? todo.time_records
                : (typeof todo.time_records === 'string' ? JSON.parse(todo.time_records || '[]') : []);
              if (!Array.isArray(arr)) arr = [];
              arr.push(tr.record);
              // 普通 todo：FIFO 5 截断（与 bd3f88d / 服务端 BATCH_TOGGLE_DONE 一致）
              // 碎时记：不截断（累计必须准确）
              if (todo.repeat_type !== 'fragment' && arr.length > 5) arr = arr.slice(arr.length - 5);
              todo.time_records = arr;
            } catch (e) {
              todo.time_records = [tr.record];
            }
          }
          // 碎时记：完成时 date 冻结到当前查看日期（与后端 BATCH_TOGGLE_DONE 一致）
          // 仅对原本未完成的碎时记执行，避免覆盖已完成碎时记的冻结完成日期
          if (todo.repeat_type === 'fragment' && !todo._wasDone) {
            todo.date = formatDate(currentDate);
          }
        } else {
          // 批量取消完成：清空本地 time_records（与服务端 TOGGLE_DONE/BATCH_TOGGLE_DONE 一致）
          // "继续计时"按钮路径才会保留累计；批量取消等同 checkbox 取消，应清空
          todo.time_records = [];
          // 碎时记：取消完成时 date 从 fragment_anchor 恢复（保留用户设置的起始日期）
          if (todo.repeat_type === 'fragment') {
            todo.date = todo.fragment_anchor || '';
          }
        }
        // 清理临时标记
        delete todo._wasDone;
      });
      renderTodos();
      // 乐观更新：先退出批量模式，再发请求（避免等待网络才退出）
      exitBatchMode();

      try {
        const batchPayload = {
          action: 'BATCH_TOGGLE_DONE',
          ids: ids,
          doneStatus: targetDone,
          timerRecords: timerRecords.length > 0 ? timerRecords : undefined
        };
        // 碎时记完成/取消完成都需要 date 字段（完成时冻结，取消时服务端会忽略并重置为空）
        // 只要选中项中存在碎时记，就传 date
        const hasFragment = Array.from(selectedTasks).some(idx => todos[idx] && todos[idx].repeat_type === 'fragment');
        if (hasFragment) {
          batchPayload.date = formatDate(currentDate);
        }
        await fetch('/api/todo-action', {
          method: 'POST',
          body: JSON.stringify(batchPayload),
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
      // 删除前清理选中项的本地计时器状态，避免 localStorage 孤儿
      // 否则若用户从回收站恢复该 todo，maybePruneStaleTimer 可能复活为"计时中"
      Array.from(selectedTasks).forEach(idx => {
        const t = todos[idx];
        if (t && typeof readTimerState === 'function' && readTimerState(t.id)) {
          if (typeof clearTimerState === 'function') clearTimerState(t.id);
        }
      });
      await fetch('/api/todo-action', {
        method: 'POST', body: JSON.stringify({ action: 'BATCH_DELETE', ids: ids }),
        headers: { 'Content-Type': 'application/json' }
      });
      exitBatchMode(); loadTodos();
    }
`;
