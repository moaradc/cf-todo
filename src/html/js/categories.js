export const categories = `
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
          <button class="subtask-icon-btn danger" onclick="removeTempSubtask('\${mode}', \${i})" aria-label="删除子任务">−</button>
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
          <button onclick="copyTempSearchTerm('\${mode}', \${i}, '\${safeText}')">⎘</button>
        </div>\`;
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
      // 碎时记 (fragment): 一次性浮动事项，无截止/间隔概念；
      // 起始日期通过日期选择器单独控制，默认空（任意日期都出现）
      if (val === 'fragment') {
        tempFragmentAnchor = '';
        // 碎时记无间隔/截止概念，清空临时状态避免切回普通重复时显示成"每2天/截止 X"
        // （confirmAddTask 里有 isFragment 兜底，但 UI 显示依赖 temp* 变量）
        tempRepeatInterval = 1;
        tempRepeatEnd = '';
        if (activeMode === 'add') {
          document.getElementById('add-repeat-display').innerText = '重复: ' + label;
          var endRow = document.getElementById('add-repeat-end-row');
          if (endRow) endRow.style.display = 'none';
          var dateDisp = document.getElementById('add-date-display');
          if (dateDisp) dateDisp.innerText = '起始: 不限';
        } else if (activeMode === 'edit') {
          document.getElementById('edit-repeat-display').innerText = '重复: ' + label;
          var endRow = document.getElementById('edit-repeat-end-row');
          if (endRow) endRow.style.display = 'none';
          var dateDisp = document.getElementById('edit-date-display');
          if (dateDisp) dateDisp.innerText = '起始: 不限';
        }
        document.getElementById('popover-repeat').style.display = 'none';
        return;
      }
      // 辅助函数：获取非 fragment 模式下应显示的日期
      // 从 fragment 切回普通类型时，tempEditDate/tempAddDate 可能为空（原 fragment 不限起始），
      // 此时用当前查看日期兜底，确保非 fragment 始终有有效具体日期
      var getNonFragmentDate = function(defaultDate) {
        return defaultDate || formatDate(currentDate);
      };
      if (val !== 'none') {
        // 切换重复类型时更新间隔显示
        var intervalText = getIntervalDisplayText(tempRepeatInterval || 1, val);
        // 截止日期显示：tempRepeatEnd 已在切到 fragment 时清空，切回普通重复时同步刷新 UI
        var repeatEndText = '截止: ' + (tempRepeatEnd || '永不');
        if (activeMode === 'add') {
          document.getElementById('add-repeat-display').innerText = '重复: ' + label;
          document.getElementById('add-interval-display').innerText = intervalText;
          var endRow = document.getElementById('add-repeat-end-row');
          if (endRow) endRow.style.display = '';
          var endDisp = document.getElementById('add-repeat-end-display');
          if (endDisp) endDisp.innerText = repeatEndText;
          // 从碎时记切回普通重复时，恢复日期显示；tempAddDate 为空时用当前日期兜底
          tempAddDate = getNonFragmentDate(tempAddDate);
          var dateDisp = document.getElementById('add-date-display');
          if (dateDisp) dateDisp.innerText = tempAddDate;
        } else if (activeMode === 'edit') {
          document.getElementById('edit-repeat-display').innerText = '重复: ' + label;
          var editIntervalEl = document.getElementById('edit-interval-display');
          if (editIntervalEl) editIntervalEl.innerText = intervalText;
          var endRow = document.getElementById('edit-repeat-end-row');
          if (endRow) endRow.style.display = '';
          var editEndDisp = document.getElementById('edit-repeat-end-display');
          if (editEndDisp) editEndDisp.innerText = repeatEndText;
          // 从碎时记切回普通重复时，恢复日期显示；tempEditDate 为空时用当前日期兜底
          tempEditDate = getNonFragmentDate(tempEditDate);
          var dateDisp = document.getElementById('edit-date-display');
          if (dateDisp) dateDisp.innerText = tempEditDate;
        }
      } else {
        if (activeMode === 'add') {
          document.getElementById('add-repeat-display').innerText = '重复: ' + label;
          var endRow = document.getElementById('add-repeat-end-row');
          if (endRow) endRow.style.display = 'none';
          // 从碎时记切回不重复时，恢复日期显示；tempAddDate 为空时用当前日期兜底
          tempAddDate = getNonFragmentDate(tempAddDate);
          var dateDisp = document.getElementById('add-date-display');
          if (dateDisp) dateDisp.innerText = tempAddDate;
        } else if (activeMode === 'edit') {
          document.getElementById('edit-repeat-display').innerText = '重复: ' + label;
          var endRow = document.getElementById('edit-repeat-end-row');
          if (endRow) endRow.style.display = 'none';
          // 从碎时记切回不重复时，恢复日期显示；tempEditDate 为空时用当前日期兜底
          tempEditDate = getNonFragmentDate(tempEditDate);
          var dateDisp = document.getElementById('edit-date-display');
          if (dateDisp) dateDisp.innerText = tempEditDate;
        }
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

    // 高亮匹配：在原始（未转义）文本上定位 query 出现位置，再做转义 + 包裹 <span>。
    function highlightMatch(text, query) {
      if (!text) return '';
      if (!query) return escapeHtml(text);
      var textStr = String(text);
      var queryStr = String(query);
      var lowerText = textStr.toLowerCase();
      var lowerQuery = queryStr.toLowerCase();
      var result = '';
      var i = 0;
      var idx;
      while ((idx = lowerText.indexOf(lowerQuery, i)) !== -1) {
        // 转义 query 之前的部分
        result += escapeHtml(textStr.substring(i, idx));
        // 转义 query 命中的部分并包裹高亮
        result += '<span class="cat-highlight">' + escapeHtml(textStr.substring(idx, idx + queryStr.length)) + '</span>';
        i = idx + queryStr.length;
        // 安全上限：防止极端输入（如 query 为空字符串被外部绕过保护）造成死循环
        if (i > textStr.length) break;
      }
      // 转义剩余部分
      if (i < textStr.length) result += escapeHtml(textStr.substring(i));
      return result;
    }

    let _cachedMatchedIds = null;
    let _cachedSearchQuery = null;
    let _cachedSelectedId = null;
    let _catSearchRafPending = false;

    function renderCategoryModalList(force) {
      const listEl = document.getElementById('category-modal-list');
      if (!listEl) return;
      const trimmedQuery = categorySearchQuery.trim();
      const q = trimmedQuery.toLowerCase();
      const selId = activeMode === 'manage' ? '' : (tempCategoryId || '');
      // 第一道缓存：query + selection 完全一致 → 直接 return
      if (!force && _cachedSearchQuery === q && _cachedSelectedId === selId && _cachedMatchedIds !== null) return;

      let matched = categoriesList;
      if (q) {
        matched = categoriesList.filter(c => c.name && c.name.toLowerCase().includes(q));
      }
      var newIds = matched.map(function(c) { return c.id; });

      // 第二道缓存：匹配集未变（仅 query 长度变化） → 仅更新高亮，跳过整列表重建。
      // 对数百个分类 + 连续键入的场景尤为关键。
      var matchedUnchanged = !force
        && _cachedMatchedIds !== null
        && _cachedSelectedId === selId
        && newIds.length === _cachedMatchedIds.length
        && newIds.every(function(id, i) { return id === _cachedMatchedIds[i]; });

      if (matchedUnchanged) {
        // 选择器明确排除 data-cat-id="" 的项（无分类项），
        var nameEls = listEl.querySelectorAll('.category-modal-item[data-cat-id]:not([data-cat-id=""]) .cat-name');
        var n = Math.min(matched.length, nameEls.length);
        for (var i = 0; i < n; i++) {
          nameEls[i].innerHTML = highlightMatch(matched[i].name, trimmedQuery);
        }
        _cachedSearchQuery = q;
        return;
      }

      _cachedMatchedIds = newIds;
      _cachedSearchQuery = q;
      _cachedSelectedId = selId;

      // 全量重建：用 DocumentFragment 批量插入，避免逐个 appendChild 触发 N 次 reflow
      var frag = document.createDocumentFragment();
      if (!isCatBatchMode) {
        const noCatItem = document.createElement('div');
        noCatItem.className = 'category-modal-item' + (!selId ? ' selected' : '');
        noCatItem.innerHTML = '<span class="cat-name">无分类</span>';
        // 注意：不要给无分类项加 data-cat-id 属性。
        // 缓存命中分支用 .category-modal-item[data-cat-id] 选择器精准定位真实分类项，
        // 若无分类项也带该属性（哪怕值为空），会被选择器误匹配，导致后续高亮回写时
        // 错位：无分类项被写成首个匹配分类名，真实分类项的高亮全部错位。
        noCatItem.onclick = function() { selectCategory(''); };
        frag.appendChild(noCatItem);
      }
      var defaultColor = CATEGORY_COLOR_PRESETS[0];
      for (var j = 0; j < matched.length; j++) {
        var cat = matched[j];
        var item = document.createElement('div');
        item.setAttribute('data-cat-id', cat.id);
        // 批量模式：选中状态来自 selectedCatIds；普通模式：来自 selId
        var isSelected = isCatBatchMode
          ? selectedCatIds.has(cat.id)
          : (selId === cat.id);
        item.className = 'category-modal-item' + (isSelected ? ' selected' : '');
        var color = cat.color || defaultColor;
        var highlightedName = highlightMatch(cat.name, trimmedQuery);
        item.innerHTML = '<span class="badge-category-icon" style="background:' + color + '"></span><span class="cat-name">' + highlightedName + '</span>';
        // 闭包捕获当前 cat.id，避免 onclick 内引用循环变量 j
        (function(catId) {
          item.onclick = function() {
            if (isCatBatchMode) {
              if (selectedCatIds.has(catId)) selectedCatIds.delete(catId);
              else selectedCatIds.add(catId);
              renderCategoryModalList(true);
            } else {
              selectCategory(catId);
            }
          };
        })(cat.id);
        frag.appendChild(item);
      }
      // 一次性替换，比 listEl.innerHTML = '' + 多次 appendChild 快
      listEl.innerHTML = '';
      listEl.appendChild(frag);
    }

    function onCategorySearchInput() {
      const input = document.getElementById('category-new-name');
      if (!input) return;
      categorySearchQuery = input.value;
      // requestAnimationFrame 合并：连续键入时每帧最多渲染一次，
      // 避免快速输入造成栈积压与重复 DOM 操作。
      if (_catSearchRafPending) return;
      _catSearchRafPending = true;
      requestAnimationFrame(function() {
        _catSearchRafPending = false;
        renderCategoryModalList();
      });
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
      _navPush('modal-category', closeCategoryModal, '/category');
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
      if (_isNavClosing) {
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
        return;
      }
      _navClose('modal-category');
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

`;
