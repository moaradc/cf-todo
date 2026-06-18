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

    async function loadTodos() {
      const dateStr = formatDate(currentDate);
      updateDateHeader(true);
      document.getElementById('todo-list').innerHTML = '<div style="padding:20px;text-align:center;">数据拉取中...</div>';
      try {
        const res = await fetch(\`/api/todos?date=\${dateStr}\`);
        if (res.status === 503) {
          // SW返回503表示离线且无缓存
          document.getElementById('todo-list').innerHTML = '<div style="padding:20px;text-align:center;color:var(--warn);">离线 — 无缓存数据</div>';
          return;
        }
        if (res.ok) {
          todos = await res.json();
          renderTodos();
        }
      } catch (e) {
        // 网络错误且SW未拦截
        if (!navigator.onLine) {
          document.getElementById('todo-list').innerHTML = '<div style="padding:20px;text-align:center;color:var(--warn);">离线 — 无缓存数据</div>';
        } else {
          console.error(e);
        }
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
      if (!confirm(\`确认删除选中的 \${selectedTasks.size} 个事项吗？(仅删除当天的当前项)\`)) return;
      const ids = Array.from(selectedTasks).map(idx => todos[idx].id);
      await fetch('/api/todo-action', {
        method: 'POST', body: JSON.stringify({ action: 'BATCH_DELETE', ids: ids }),
        headers: { 'Content-Type': 'application/json' }
      });
      exitBatchMode(); loadTodos();
    }
`;
