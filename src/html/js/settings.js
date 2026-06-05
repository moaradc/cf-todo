export const settings = `
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
      if (!confirm('确定要重置自定义代码吗？\\n这将清空所有自定义头部和内容。')) return;
      
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
