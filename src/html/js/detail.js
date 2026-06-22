export const detail = `
    function openAddModal() {
      activeMode = 'add';
      document.getElementById('modal-add').classList.add('active');
      document.getElementById('add-text').value = ''; document.getElementById('add-desc').value = '';
      document.getElementById('add-url').value = ''; document.getElementById('add-copy').value = '';
      tempTime = ''; tempPriority = 'low';
      tempEndTime = ''; tempRepeatType = 'none';
      tempRepeatEnd = ''; tempCategoryId = '';
      tempRepeatInterval = 1;
      tempAddDate = formatDate(currentDate);
      document.getElementById('add-date-display').innerText = tempAddDate;
      document.getElementById('add-repeat-display').innerText = '重复: 不重复';
      document.getElementById('add-category-display').innerText = '分类: 无';
      document.getElementById('add-endtime-display').innerText = '结束 --:--';
      document.getElementById('add-repeat-end-display').innerText = '截止: 永不';
      document.getElementById('add-interval-display').innerText = '间隔: 每1天';
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
      _navPush('modal-add', closeAddModal, '/add');
    }
    
    function updateAddUI() {
      document.getElementById('add-time-display').innerText = tempTime ? ('开始 ' + tempTime) : '开始 --:--';
      document.getElementById('add-endtime-display').innerText = tempEndTime ? ('结束 ' + tempEndTime) : '结束 --:--';
      const pMap = {low:'优先级: 低', med:'优先级: 中', high:'优先级: 高'};
      document.getElementById('add-priority-display').innerText = pMap[tempPriority];
    }

    function getIntervalDisplayText(interval, repeatType) {
      var unitMap = { daily: '天', weekly: '周', monthly: '月', yearly: '年' };
      var unit = unitMap[repeatType] || '天';
      return '间隔: 每' + (interval || 1) + unit;
    }

    function closeAddModal() {
      if (_isNavClosing) {
        hideAndRescuePopovers();
        var catModal = document.getElementById('modal-category');
        if (catModal && catModal.classList.contains('active')) catModal.classList.remove('active');
        var modal = document.getElementById('modal-add');
        if (!modal || !modal.classList.contains('active')) return;
        var content = modal.querySelector('.modal-content');
        if (!content) { modal.classList.remove('active'); return; }
        modal.classList.add('closing-overlay');
        content.classList.add('closing');
        var closed = false;
        function doClose() {
          if (closed) return;
          closed = true;
          modal.classList.remove('active', 'closing-overlay');
          content.classList.remove('closing');
        }
        var computedStyle = window.getComputedStyle(content);
        var duration = parseFloat(computedStyle.animationDuration);
        var name = computedStyle.animationName;
        if (name && name !== 'none' && duration > 0) {
          content.addEventListener('animationend', function handler(e) {
            if (e.target === content) { doClose(); content.removeEventListener('animationend', handler); }
          });
          setTimeout(doClose, duration * 1000 + 100);
        } else { doClose(); }
        return;
      }
      _navClose('modal-add');
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
        repeat_interval: tempRepeatInterval || 1,
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
      btnSave.classList.add('hidden'); btnDel.classList.remove('hidden'); btnEdit.innerText = "编辑";
      btnDel.onclick = (e) => handleActionClick(e, 'delete'); btnSave.onclick = (e) => handleActionClick(e, 'save');

      const detailView = document.getElementById('detail-view');
      detailView.classList.remove('closing'); detailView.classList.add('active');
      _navPush('detail-view', closeDetail, '/detail');
    }

    function closeDetail() {
      if (_isNavClosing) {
        hideAndRescuePopovers();
        var catModal = document.getElementById('modal-category');
        if (catModal && catModal.classList.contains('active')) catModal.classList.remove('active');
        const detailView = document.getElementById('detail-view'); detailView.classList.add('closing');
        detailView.addEventListener('animationend', function handler() {
          detailView.classList.remove('active'); detailView.classList.remove('closing'); detailView.removeEventListener('animationend', handler);
        });
        return;
      }
      _navClose('detail-view');
    }

    function getRepeatDisplayText(repeatType, dateStr, repeatEnd, repeatInterval) {
      if (!repeatType || repeatType === 'none') return '单次任务';
      var days = ['日','一','二','三','四','五','六'];
      var n = repeatInterval && repeatInterval > 1 ? repeatInterval : null;
      var rText = '';
      if (repeatType === 'daily') rText = n ? '每' + n + '天' : '每天';
      else if (repeatType === 'weekly') {
        var dp = (dateStr || '').split('-');
        if (dp.length === 3) { var dw = new Date(dp[0], dp[1]-1, dp[2]).getDay(); rText = n ? '每' + n + '周' + days[dw] : '每周' + days[dw]; }
        else rText = n ? '每' + n + '周' : '每周';
      } else if (repeatType === 'monthly') {
        var mp = (dateStr || '').split('-');
        rText = n ? '每' + n + '月' + (mp.length === 3 ? parseInt(mp[2], 10) + '号' : '') : (mp.length === 3 ? '每月' + parseInt(mp[2], 10) + '号' : '每月');
      } else if (repeatType === 'yearly') {
        var yp = (dateStr || '').split('-');
        rText = n ? '每' + n + '年' + (yp.length === 3 ? parseInt(yp[1], 10) + '月' + parseInt(yp[2], 10) + '日' : '') : (yp.length === 3 ? '每年' + parseInt(yp[1], 10) + '月' + parseInt(yp[2], 10) + '日' : '每年');
      }
      if (repeatEnd) rText += '·至' + repeatEnd;
      return rText;
    }

    // ==================== 详情面板计时区块 ====================
    // 实例级记录直接读 todos[currentDetailIndex].time_records（todo 对象自带），
    // 不再发 /api/time-records?todo_id= 拉取。原因：
    //   1. /api/todos 已经把 time_records 字段带过来了，前端只需 JSON.parse
    //   2. todo.id 唯一，从 todos[currentDetailIndex] 取出的就是当前实例的记录，
    //      不会跨实例串台
    //   3. 消除 SW 缓存命中旧空响应、D1 读副本延迟等导致的"拉到空 records"问题
    //   4. 省一次网络往返
    // 模板级 templateRecords 仍独立拉取（用于 predictDuration 预估时长），失败不影响主流程。
    let detailTimerOwnerId = null;
    let detailTemplateRecords = []; // 当前模板的跨实例记录（仅用于 predictDuration 预估）

    // 取当前事项的实例级完成记录：直接从 todo.time_records 字段解析
    // 兼容字符串（DB 原始格式）和数组（理论上服务端可能解析后返回）两种形式
    function getDetailTimeRecords() {
      const task = todos[currentDetailIndex];
      if (!task) return [];
      const raw = task.time_records;
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string' && raw) {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
      }
      return [];
    }

    // 仅刷新计时区块，不重渲染整个面板（避免破坏用户阅读位置）
    // overrideRecord: 可选，completeTimer 同步阶段直传的刚算出的 record。
    //   不写入任何缓存，仅在本次调用中消费，避免状态残留/串台/失效问题。
    //   await fetch 后 reloadDetailTimeRecords 会用服务器返回的最新 records 重新渲染（无参数调用）。
    function refreshDetailTimerBlock(overrideRecord) {
      const task = todos[currentDetailIndex];
      const slot = document.getElementById('timer-section');
      if (!task || !slot) return;
      // 仅重复 todo 渲染区块
      if (!task.repeat_type || task.repeat_type === 'none') { slot.innerHTML = ''; return; }

      const timerState = task.done ? null : maybePruneStaleTimer(task.id);
      const paused = timerState && isTimerPaused(timerState);
      const elapsed = timerState ? timerElapsed(timerState) : 0;

      // 当前实例的完成记录（实例级，独立不串台）
      const records = getDetailTimeRecords();
      // 预估完成时间（中位数），仅用于进行中/已暂停/空闲态的提示
      // 已完成态不显示（按用户要求精简）
      // 使用模板级记录预估：跨实例的中位数更稳定
      const predict = predictDuration(detailTemplateRecords);
      const predictText = predict ? '预计 ' + formatMs(predict) : '';

      let html = '<div class="detail-label">计时</div>';

      if (task.done) {
        // 已完成：优先使用 overrideRecord（completeTimer 同步阶段直传，未经过任何缓存），
        // 其次回退到 records 末尾（reloadDetailTimeRecords fetch 后的正常路径）
        const lastRec = overrideRecord || (records.length ? records[records.length - 1] : null);
        if (lastRec) {
          const dur = Math.max(0, (lastRec.e || 0) - (lastRec.s || 0) - (lastRec.p || 0));
          const endTimeStr = new Date(lastRec.e).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
          html += '<div class="detail-value">完成于 ' + endTimeStr + '，耗时 ' + formatMs(dur) + '</div>';
        } else {
          html += '<div class="detail-value" style="color:var(--fg); opacity:0.6;">无完成耗时记录</div>';
        }
      } else if (timerState) {
        // 进行中 / 已暂停：内部有多行（timer-row + 预估），用 block 流
        html += '<div class="detail-value" style="display:block;">';
        html += '<div class="timer-row">';
        html += '<span class="timer-elapsed-large" data-timer-id="' + task.id + '-detail">' + formatElapsed(elapsed) + '</span>';
        if (paused) {
          html += '<button class="btn-ghost" onclick="resumeTimerDetail()">继续</button>';
        } else {
          html += '<button class="btn-ghost" onclick="pauseTimerDetail()">暂停</button>';
        }
        html += '<button class="btn-ghost" onclick="completeTimerDetail()">结束</button>';
        html += '<button class="btn-ghost" onclick="cancelTimerDetail()">取消</button>';
        html += '</div>';
        if (predictText) html += '<div style="font-size:0.85em; opacity:0.7; margin-top:6px;">' + predictText + '</div>';
        html += '</div>';
      } else {
        // 空闲：内部有多行（timer-row + 预估），用 block 流
        html += '<div class="detail-value" style="display:block;">';
        html += '<div class="timer-row">';
        html += '<button class="btn-ghost" onclick="startTimerDetail()">开始计时</button>';
        if (predictText) html += '<span style="font-size:0.85em; opacity:0.7; margin-left:10px;">' + predictText + '</span>';
        html += '</div>';
        html += '</div>';
      }
      slot.innerHTML = html;
    }

    function startTimerDetail() {
      const task = todos[currentDetailIndex];
      if (!task) return;
      startTimer(task.id);
      refreshDetailTimerBlock();
    }
    function pauseTimerDetail() {
      const task = todos[currentDetailIndex];
      if (!task) return;
      pauseTimer(task.id);
      refreshDetailTimerBlock();
    }
    function resumeTimerDetail() {
      const task = todos[currentDetailIndex];
      if (!task) return;
      resumeTimer(task.id);
      refreshDetailTimerBlock();
    }
    function completeTimerDetail() {
      if (currentDetailIndex < 0) return;
      completeTimer(currentDetailIndex);
      // completeTimer await fetch 后会调用 reloadDetailTimeRecords 重新拉取并刷新
    }
    function cancelTimerDetail() {
      const task = todos[currentDetailIndex];
      if (!task) return;
      // 取消计时：清除本地状态，不标记完成，不写入 time_records
      abortTimer(task.id);
      refreshDetailTimerBlock();
    }

    // 拉取当前模板的跨实例记录（templateRecords），用于 predictDuration 预估时长
    // 实例级 records 不再拉取：直接读 todos[currentDetailIndex].time_records（见 getDetailTimeRecords）
    // 此函数仅用于：completeTimer 后刷新预估数据；预估数据缺失不影响"完成于"显示
    function reloadDetailTimeRecords() {
      const task = todos[currentDetailIndex];
      if (!task || !task.id) return;
      const tid = task.id;
      // 仅拉模板级记录：以 todo_id 查询，服务端会同时返回 records 和 templateRecords，
      // 我们只用 templateRecords（用于 predictDuration）
      const bustUrl = '/api/time-records?todo_id=' + encodeURIComponent(tid) + '&_t=' + Date.now();
      fetch(bustUrl)
        .then(function(r) { return r.ok ? r.json() : { templateRecords: [] }; })
        .then(function(data) {
          // 防止竞态：仅当当前详情仍是同一事项时才刷新 UI
          const cur = todos[currentDetailIndex];
          detailTemplateRecords = (data && Array.isArray(data.templateRecords)) ? data.templateRecords : [];
          if (cur && cur.id === task.id) refreshDetailTimerBlock();
        })
        .catch(function() {
          const cur = todos[currentDetailIndex];
          detailTemplateRecords = [];
          if (cur && cur.id === task.id) refreshDetailTimerBlock();
        });
    }

    // completeTimer 之后：实时调用 API 拉取权威 todos（含 time_records 字段）
    // 解决背景/前台切换后 todos 数组与服务器不一致、本地缓存导致 UI 显示错误的问题
    // 不再单独拉 /api/time-records：todos[].time_records 已含实例级记录
    function reloadDetailAfterComplete() {
      const task = todos[currentDetailIndex];
      if (!task || !task.id) return;
      const todoId = task.id;
      const dateStr = formatDate(currentDate);

      // 仅拉 todos，cache: 'no-cache' 确保绕过 SW/HTTP 缓存
      const todosUrl = '/api/todos?date=' + encodeURIComponent(dateStr) + '&_t=' + Date.now();

      fetch(todosUrl, { cache: 'no-cache' })
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function() { return null; })
        .then(function(freshTodos) {
          if (!Array.isArray(freshTodos)) return;

          // 更新 todos 数组（以服务器为准，含最新 time_records 字段）
          todos = freshTodos;
          // 重新定位 currentDetailIndex（数组顺序可能变化）
          const newIdx = todos.findIndex(function(t) { return t.id === todoId; });
          if (newIdx !== -1) currentDetailIndex = newIdx;

          // 渲染主列表
          if (typeof renderTodos === 'function') renderTodos();

          // 刷新计时区块：getDetailTimeRecords 会从 todos[currentDetailIndex].time_records 解析
          refreshDetailTimerBlock();
        });
    }

    function renderDetailContent() {
      hideAndRescuePopovers();
      const task = todos[currentDetailIndex]; const container = document.getElementById('detail-content');
      const pMap = {low:'优先级: 低', med:'优先级: 中', high:'优先级: 高'};
      const rMap = { none: '不重复', daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' };

      // 实例级 records 已直接来自 todos[currentDetailIndex].time_records（见 getDetailTimeRecords），
      // 不再 fetch。这里仅清空模板级缓存，下面会按需拉取模板级记录用于 predictDuration 预估。
      detailTimerOwnerId = task && task.id;
      detailTemplateRecords = [];
      
      if (!isEditMode) {
        let urlSection = '';
        if (task.url) urlSection = \`<div class="detail-label">链接 (URL)</div><div class="detail-value"><a href="\${task.url}" target="_blank">\${task.url}</a></div>\`;

        let copySection = '';
        if (task.copy_text) {
          const safeText = encodeURIComponent(task.copy_text).replace(/'/g, "%27");
          copySection = \`<div class="detail-label">快捷复制内容</div><div class="detail-value" style="display:flex; justify-content:space-between; align-items:center;">
              <span>\${task.copy_text}</span><button class="btn-ghost" style="padding:4px 8px;" onclick="copyText(decodeURIComponent('\${safeText}'))">复制</button>
            </div>\`;
        }

        let descSection = '';
        if (task.desc) {
          const mdHtml = parseMarkdown(task.desc);
          descSection = \`<div class="detail-label">备注</div><div class="detail-value" style="display:block; min-height:30px; line-height:1.5;">\${mdHtml}</div>\`;
        }

        let subtasksSection = '';
        if (task.subtasks && task.subtasks.length > 0) {
          let stHtml = task.subtasks.map((st, i) => \`
            <div class="subtask-view-item \${st.done ? 'done' : ''}" onclick="toggleSubtask(\${currentDetailIndex}, \${i})">
                <div class="checkbox"></div>
                <div class="item-meta"><div class="item-title">\${st.text}</div></div>
            </div>
          \`).join('');
          subtasksSection = \`<div class="detail-label">子任务</div><div style="margin-bottom:20px;">\${stHtml}</div>\`;
        }

        let searchSection = '';
        if (task.search_terms && task.search_terms.length > 0) {
          let stHtml = task.search_terms.map((termObj, i) => {
            const text = termObj.text;
            const safeText = encodeURIComponent(text).replace(/'/g, "%27");
            return \`<div class="search-term-tag \${termObj.done ? 'done' : ''}">
              <div class="search-term-checkbox" onclick="toggleSearchTerm(\${currentDetailIndex}, \${i})"></div>
              <span>\${text}</span>
              <button onclick="copySearchTerm(\${currentDetailIndex}, \${i}, '\${safeText}')">⎘</button>
            </div>\`;
          }).join('');
          searchSection = \`
            <div class="detail-label">网络每日搜索</div>
            <div class="search-card">
              \${stHtml}
            </div>
          \`;
        }

        let rText = getRepeatDisplayText(task.repeat_type, task.date, task.repeat_end, task.repeat_interval);
        if ((!task.repeat_type || task.repeat_type === 'none') && task.isSeries) {
            rText = '已停止重复';
        }

        let catSection = '';
        if (task.category_id) {
          var catName = getCategoryName(task.category_id);
          var catColor = getCategoryColor(task.category_id);
          if (catName) {
            catSection = \`<div class="detail-label">分类</div><div class="detail-value"><span class="badge-category"><span class="badge-category-icon" style="background:\${catColor}"></span><span class="cat-name">\${escapeHtml(catName)}</span></span></div>\`;
          }
        }

        // 计时区块（仅重复 todo）
        let timerSection = '';
        if (task.repeat_type && task.repeat_type !== 'none') {
          timerSection = '<div id="timer-section"></div>';
          // 实例级 records 已直接来自 todo.time_records，无需 fetch。
          // 这里仅拉取模板级记录（templateRecords），用于 predictDuration 预估时长。
          // 模板级记录缺失不影响"完成于"显示，仅影响"预计 X 分"提示。
          const fetchTodoId = task.id;
          if (fetchTodoId) {
            const bustUrl = '/api/time-records?todo_id=' + encodeURIComponent(fetchTodoId) + '&_t=' + Date.now();
            fetch(bustUrl)
              .then(function(r) { return r.ok ? r.json() : { templateRecords: [] }; })
              .then(function(data) {
                // 防止竞态：仅当当前详情仍是同一事项时才应用结果
                const cur = todos[currentDetailIndex];
                if (!cur || cur.id !== task.id) return;
                detailTemplateRecords = (data && Array.isArray(data.templateRecords)) ? data.templateRecords : [];
                refreshDetailTimerBlock();
              })
              .catch(function() {
                const cur = todos[currentDetailIndex];
                if (!cur || cur.id !== task.id) return;
                detailTemplateRecords = [];
                refreshDetailTimerBlock();
              });
          }
        }

        container.innerHTML = \`
          <div class="detail-label">事项内容</div><div class="detail-value">\${task.text}</div>
          \${subtasksSection}
          \${searchSection}
          <div class="row">
            <div class="flex-1"><div class="detail-label">时间点</div><div class="detail-value">\${task.time || '--:--'}\${task.end_time ? ' - ' + task.end_time : ''}</div></div>
            <div class="flex-1"><div class="detail-label">优先级</div><div class="detail-value">\${pMap[task.priority]}</div></div>
          </div>
          \${urlSection}\${copySection}
          \${catSection}
          <div class="detail-label">属性</div><div class="detail-value">\${rText}</div>
          \${descSection}
          \${timerSection}
        \`;
        // 立即用本地缓存渲染一次计时区块（避免等待网络时空白）
        if (task.repeat_type && task.repeat_type !== 'none') refreshDetailTimerBlock();
      } else {
        activeMode = 'edit';
        var intervalText = getIntervalDisplayText(tempRepeatInterval, tempRepeatType);
        container.innerHTML = \`
          <input type="text" id="edit-text" value="\${task.text}" class="detail-value editable" placeholder="事项标题（必填）">
          
          <div class="detail-label modal-section">子任务</div>
          <div class="row modal-subtask-row">
            <input type="text" id="edit-subtask-input" placeholder="输入子任务（可选）" class="detail-value editable flex-1">
            <button class="subtask-icon-btn" onclick="addTempSubtask('edit')" aria-label="添加子任务">+</button>
          </div>
          <div id="edit-subtasks-list" style="margin-bottom:15px;"></div>

          <div class="detail-label modal-section">时间与重复</div>
          <div class="row modal-row">
            <div class="fake-input detail-value editable flex-1" onclick="openCalendarForEdit()">
              <span id="edit-date-display">\${tempEditDate || '----/--/--'}</span>
              <span class="arrow">▼</span>
            </div>
            <div class="fake-input detail-value editable flex-1" onclick="toggleRepeatMenu('edit', this)">
              <span id="edit-repeat-display">重复: \${rMap[tempRepeatType]}</span>
              <span class="arrow">▼</span>
            </div>
          </div>
          <div id="edit-repeat-end-row" class="row modal-row" \${tempRepeatType !== 'none' ? '' : 'style="display:none;"'}>
            <div class="fake-input detail-value editable flex-1" onclick="openCalendarForRepeatEnd('edit')">
              <span id="edit-repeat-end-display">截止: \${tempRepeatEnd || '永不'}</span>
              <span class="arrow">▼</span>
            </div>
            <div class="fake-input detail-value editable flex-1" onclick="openIntervalPicker('edit')">
              <span id="edit-interval-display">\${intervalText}</span>
              <span class="arrow">▼</span>
            </div>
          </div>
          <div class="row modal-row">
            <div class="fake-input detail-value editable flex-1" onclick="openTimePicker('edit','start')"><span id="edit-time-display">\${tempTime ? '开始 ' + tempTime : '开始 --:--'}</span></div>
            <div class="fake-input detail-value editable flex-1" onclick="openTimePicker('edit','end')"><span id="edit-endtime-display">\${tempEndTime ? '结束 ' + tempEndTime : '结束 --:--'}</span></div>
          </div>

          <div class="detail-label modal-section">属性与链接</div>
          <div class="row modal-row">
            <div class="fake-input detail-value editable flex-1" id="edit-category-trigger" onclick="toggleCategoryMenu('edit', this)">
              <span id="edit-category-display">分类: \${getCategoryName(tempCategoryId) || '无'}</span>
              <span class="arrow-r">▼</span>
            </div>
            <div class="fake-input detail-value editable flex-1" onclick="togglePriorityMenu('edit', this)">
              <span id="edit-priority-display">\${pMap[tempPriority]}</span>
              <span class="arrow">▼</span>
            </div>
          </div>
          <input type="url" id="edit-url" value="\${task.url || ''}" class="detail-value editable" placeholder="URL / APP Scheme (可选)">
          <input type="text" id="edit-copy" value="\${task.copy_text || ''}" class="detail-value editable" placeholder="快捷复制内容（可选）">

          <div class="detail-label modal-section">其他</div>
          <div class="switch-label" onclick="toggleEditSearch()">
            <div class="switch-box \${tempSearchTerms.length > 0 ? 'checked' : ''}" id="edit-search-box"></div>
            <span>启用每日搜索</span>
          </div>
          <div id="edit-search-actions" class="\${tempSearchTerms.length > 0 ? '' : 'hidden'}" style="margin-bottom:15px;">
            <div class="row modal-row">
              <div class="fake-input flex-1" id="edit-search-provider-trigger" onclick="toggleProviderMenu('edit', this)" style="height:46px;">
                <span id="edit-search-provider-display">自动 (随机源)</span>
                <span class="arrow-r">▼</span>
              </div>
              <button class="btn-ghost flex-1" id="edit-search-regenerate-btn" style="height:46px; padding: 0 5px;" onclick="regenerateEditSearchTerms()">获取热搜</button>
            </div>
            <div class="search-card" id="edit-search-preview"></div>
          </div>
          
          <textarea id="edit-desc" rows="3" class="detail-value editable" placeholder="输入备注/详细描述（可选）">\${task.desc || ''}</textarea>
        \`;
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
        tempEditDate = task.date || '';
        tempTime = task.time || ''; tempPriority = task.priority || 'low';
        tempEndTime = task.end_time || '';
        tempRepeatType = task.repeat_type || 'none';
        tempRepeatEnd = task.repeat_end || '';
        tempRepeatInterval = task.repeat_interval || 1;
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
        'auto': '自动 (随机源)', 'bilibili':'哔哩哔哩', 'weibo':'微博热搜', 'zhihu':'知乎热榜', 'baidu':'百度热搜'
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
      _navPush('modal-time', closeTimePicker, '/time');
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
        else if(activeMode === 'edit') document.getElementById('edit-endtime-display').innerText = '结束 ' + tempEndTime;
      } else {
        tempTime = selectedTime;
        if (!tempEndTime && activeMode !== 'edit') {
          var parts = [timePickerHour, timePickerMin + 30];
          if (parts[1] >= 60) { parts[0] += 1; parts[1] -= 60; }
          if (parts[0] >= 24) parts[0] = 23;
          tempEndTime = \`\${String(parts[0]).padStart(2,'0')}:\${String(parts[1]).padStart(2,'0')}\`;
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
    function closeTimePicker() {
      if (_isNavClosing) {
        document.getElementById('modal-time').classList.remove('active');
        return;
      }
      _navClose('modal-time');
    }

    // ==================== 间隔选择器 ====================

    let intervalPickerCount = 1;
    let intervalPickerUnitIndex = 0;
    const INTERVAL_UNITS = ['天', '周', '月', '年'];
    const INTERVAL_TYPE_MAP = ['daily', 'weekly', 'monthly', 'yearly'];

    function openIntervalPicker(mode) {
      activeMode = mode;
      document.getElementById('modal-interval').classList.add('active');
      
      // 根据当前 repeatType 确定单位索引
      var typeIdx = INTERVAL_TYPE_MAP.indexOf(tempRepeatType);
      if (typeIdx === -1) typeIdx = 0;
      intervalPickerUnitIndex = typeIdx;
      intervalPickerCount = tempRepeatInterval || 1;
      
      var countCol = document.getElementById('interval-col-count'); countCol.innerHTML = '';
      for (let i = 1; i <= 99; i++) {
        const div = document.createElement('div');
        div.className = 'time-cell';
        div.innerText = i;
        div.onclick = () => { intervalPickerCount = i; updateIntervalPickerSelection(); };
        countCol.appendChild(div);
      }
      
      var unitCol = document.getElementById('interval-col-unit'); unitCol.innerHTML = '';
      for (let i = 0; i < INTERVAL_UNITS.length; i++) {
        const div = document.createElement('div');
        div.className = 'time-cell';
        div.innerText = INTERVAL_UNITS[i];
        div.onclick = () => { intervalPickerUnitIndex = i; updateIntervalPickerSelection(); };
        unitCol.appendChild(div);
      }
      
      setTimeout(() => {
        updateIntervalPickerSelection();
        var activeCount = countCol.querySelector('.active');
        if (activeCount) activeCount.scrollIntoView({block: "center"});
        var activeUnit = unitCol.querySelector('.active');
        if (activeUnit) activeUnit.scrollIntoView({block: "center"});
      }, 10);
      
      _navPush('modal-interval', closeIntervalPicker, '/interval');
    }

    function updateIntervalPickerSelection() {
      var countCells = document.getElementById('interval-col-count').children;
      Array.from(countCells).forEach((c, i) => c.className = (i + 1 === intervalPickerCount) ? 'time-cell active' : 'time-cell');
      var unitCells = document.getElementById('interval-col-unit').children;
      Array.from(unitCells).forEach((c, i) => c.className = (i === intervalPickerUnitIndex) ? 'time-cell active' : 'time-cell');
    }

    function confirmInterval() {
      tempRepeatInterval = intervalPickerCount;
      tempRepeatType = INTERVAL_TYPE_MAP[intervalPickerUnitIndex];
      var intervalText = getIntervalDisplayText(tempRepeatInterval, tempRepeatType);
      var rMap = { none: '不重复', daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' };
      
      if (activeMode === 'add') {
        document.getElementById('add-interval-display').innerText = intervalText;
        document.getElementById('add-repeat-display').innerText = '重复: ' + rMap[tempRepeatType];
      } else if (activeMode === 'edit') {
        document.getElementById('edit-interval-display').innerText = intervalText;
        document.getElementById('edit-repeat-display').innerText = '重复: ' + rMap[tempRepeatType];
      }
      closeIntervalPicker();
    }

    function resetInterval() {
      tempRepeatInterval = 1;
      var intervalText = getIntervalDisplayText(1, tempRepeatType);
      if (activeMode === 'add') {
        document.getElementById('add-interval-display').innerText = intervalText;
      } else if (activeMode === 'edit') {
        document.getElementById('edit-interval-display').innerText = intervalText;
      }
      closeIntervalPicker();
    }

    function closeIntervalPicker() {
      if (_isNavClosing) {
        document.getElementById('modal-interval').classList.remove('active');
        return;
      }
      _navClose('modal-interval');
    }

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
        title.innerText = "确认删除";
        if (task.isSeries) {
          options.innerHTML += \`<button onclick="confirmAction('this')">仅此日程</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('thisAndFuture')">此日程及之后</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('all')">所有日程</button>\`;
        } else { options.innerHTML += \`<button onclick="confirmAction('this')">确认删除</button>\`; }
      } else if (action === 'save') {
        if (task.isSeries) {
          title.innerText = "保存范围：";
          options.innerHTML += \`<button onclick="confirmAction('this')">仅此日程</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('thisAndFuture')">此日程及之后</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('all')">所有日程</button>\`;
        } else { confirmAction('this'); return; }
      }

      const btn = e.target; btn.parentNode.style.position = 'relative'; btn.parentNode.appendChild(popover);
      popover.style.display = 'flex'; popover.style.top = 'auto'; popover.style.bottom = (btn.parentNode.offsetHeight - btn.offsetTop + 5) + 'px';
      // 先按原逻辑设置左右锚点，再调用 clamp 兜底，避免在窄屏溢出父容器/视口
      if (btn.offsetLeft > btn.parentNode.offsetWidth / 2) {
        popover.style.right = (btn.parentNode.offsetWidth - btn.offsetLeft - btn.offsetWidth) + 'px';
        popover.style.left = 'auto';
      } else {
        popover.style.left = btn.offsetLeft + 'px';
        popover.style.right = 'auto';
      }
      _clampActionPopoverWithinParent(popover, btn);

      const closeHandler = (event) => { if (!popover.contains(event.target) && event.target !== e.target) { popover.style.display = 'none'; document.removeEventListener('click', closeHandler); } };
      setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    // 详情页 action popover 边界兜底：若左右锚点导致溢出父容器则贴边并按需收窄
    function _clampActionPopoverWithinParent(popover, btn) {
      try {
        var parent = btn.parentNode;
        var parentW = parent.clientWidth;
        var popW = popover.offsetWidth;
        // 当前左边界（基于 left 或 right 反推）
        var currentLeft;
        if (popover.style.left !== 'auto' && popover.style.left !== '') {
          currentLeft = parseInt(popover.style.left, 10) || 0;
        } else {
          var rightVal = parseInt(popover.style.right, 10) || 0;
          currentLeft = parentW - popW - rightVal;
        }
        if (currentLeft + popW > parentW - 4) {
          // 右溢出：贴右边
          popover.style.left = 'auto';
          popover.style.right = '4px';
          popW = popover.offsetWidth;
          var newLeft = parentW - popW - 4;
          if (newLeft < 0) {
            // 极窄屏：贴左 + 收窄宽度
            popover.style.right = 'auto';
            popover.style.left = '0';
            popover.style.maxWidth = (parentW - 8) + 'px';
            popover.style.width = (parentW - 8) + 'px';
          }
        } else if (currentLeft < 0) {
          popover.style.right = 'auto';
          popover.style.left = '0';
        }
      } catch(e) {}
    }

    async function confirmAction(scope) {
      hideAndRescuePopovers();
      const task = todos[currentDetailIndex];
      if (pendingAction === 'delete') {
        // 删除前清理计时器，避免 localStorage 残留
        if (task && task.id && typeof clearTimerState === 'function') clearTimerState(task.id);
        closeDetail();
        await fetch('/api/todo-action', { method: 'POST', body: JSON.stringify({ action: 'DELETE', date: formatDate(currentDate), task: task, scope: scope }), headers: { 'Content-Type': 'application/json' } });
        loadTodos();
      } 
      else if (pendingAction === 'save') {
        // 保存原始日期，后端需要它定位当前实例
        const originalDate = task.date || formatDate(currentDate);
        task.date = tempEditDate;
        task.text = document.getElementById('edit-text').value; task.time = tempTime; task.priority = tempPriority;
        task.end_time = tempEndTime;
        task.desc = document.getElementById('edit-desc').value; task.url = document.getElementById('edit-url').value;
        task.copyText = document.getElementById('edit-copy').value; task.copy_text = task.copyText; 
        task.subtasks = tempSubtasks; task.search_terms = tempSearchTerms;
        task.category_id = tempCategoryId;
        
        // 根据scope处理重复属性
        if (scope === 'this' && task.isSeries) {
          // 仅此项：脱离系列，变为非重复单次事项
          // 重复相关变更（间隔、频率、截止）对"仅此项"无意义，遵循标准规则
          task.repeat_type = 'none';
          task.repeat_custom = '';
          task.repeat_end = '';
          task.repeat_interval = 1;
          task.isSeries = false;
        } else {
          // 此项及之后 / 所有日程：应用重复变更
          task.repeat_type = tempRepeatType;
          task.repeat_custom = '';
          task.repeat_end = tempRepeatEnd;
          task.repeat_interval = tempRepeatInterval || 1;
          if (tempRepeatType === 'none') {
            task.isSeries = false;
          }
        }
        
        // 系列任务：直接关闭详情；非系列任务：切回查看模式保留详情
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
