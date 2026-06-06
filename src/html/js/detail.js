export const detail = `
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

        let rText = '不重复';
        if (task.repeat_type && task.repeat_type !== 'none') {
            var days = ['日','一','二','三','四','五','六'];
            if (task.repeat_type === 'daily') rText = '每天';
            else if (task.repeat_type === 'weekly') {
              var dp = (task.date || '').split('-');
              if (dp.length === 3) { var dw = new Date(dp[0], dp[1]-1, dp[2]).getDay(); rText = '每周' + days[dw]; }
              else rText = '每周';
            } else if (task.repeat_type === 'monthly') {
              var mp = (task.date || '').split('-');
              rText = mp.length === 3 ? '每月' + parseInt(mp[2], 10) + '号' : '每月';
            } else if (task.repeat_type === 'yearly') {
              var yp = (task.date || '').split('-');
              rText = yp.length === 3 ? '每年' + parseInt(yp[1], 10) + '月' + parseInt(yp[2], 10) + '日' : '每年';
            }
            if (task.repeat_end) rText += '·至' + task.repeat_end;
        } else if (task.isSeries) {
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
        \`;
      } else {
        activeMode = 'edit';
        container.innerHTML = \`
          <input type="text" id="edit-text" value="\${task.text}" class="detail-value editable" placeholder="事项标题（必填）">
          
          <div class="detail-label modal-section">子任务</div>
          <div class="row modal-subtask-row">
            <input type="text" id="edit-subtask-input" placeholder="输入子任务（可选）" class="detail-value editable flex-1">
            <button onclick="addTempSubtask('edit')">添加</button>
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
          <div id="edit-repeat-end-row" class="modal-row" \${tempRepeatType !== 'none' ? '' : 'style="display:none;"'}>
            <div class="fake-input detail-value editable" onclick="openCalendarForRepeatEnd('edit')">
              <span id="edit-repeat-end-display">循环截止: \${tempRepeatEnd || '永不'}</span>
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
        title.innerText = "确认删除";
        if (task.isSeries) {
          options.innerHTML += \`<button onclick="confirmAction('this')">删除此事件</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('thisAndFuture')">删除此事件及之后</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('all')">删除整个系列</button>\`;
        } else { options.innerHTML += \`<button onclick="confirmAction('this')">确认删除</button>\`; }
      } else if (action === 'save') {
        if (task.isSeries) {
          title.innerText = "保存范围：";
          options.innerHTML += \`<button onclick="confirmAction('this')">仅此事件</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('thisAndFuture')">此事件及之后</button>\`;
          options.innerHTML += \`<button onclick="confirmAction('all')">整个系列</button>\`;
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
        // 保存原始日期，后端需要它定位当前实例
        const originalDate = task.date || formatDate(currentDate);
        task.date = tempEditDate;
        task.text = document.getElementById('edit-text').value; task.time = tempTime; task.priority = tempPriority;
        task.end_time = tempEndTime;
        task.desc = document.getElementById('edit-desc').value; task.url = document.getElementById('edit-url').value;
        task.copyText = document.getElementById('edit-copy').value; task.copy_text = task.copyText; 
        task.subtasks = tempSubtasks; task.search_terms = tempSearchTerms;
        task.category_id = tempCategoryId;
        
        // scope='this' 时：脱离模板，变为单次任务
        if (scope === 'this' && task.isSeries) {
          task.repeat_type = 'none';
          task.repeat_custom = '';
          task.repeat_end = '';
          task.isSeries = false;
        } else {
          task.repeat_type = tempRepeatType;
          task.repeat_custom = '';
          task.repeat_end = tempRepeatEnd;
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
