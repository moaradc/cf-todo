export const settings = `
    function openSettings() {
      tempSetProvider = appSettings.provider || 'auto';
      tempSetSort = appSettings.sortMethod || 'time';
      tempSetSortAsc = appSettings.sortAsc !== undefined ? appSettings.sortAsc : true;
      tempSetApiKeyScope = appSettings.apiKeyScope || 'v1';
      
      customCodeEnabled = appSettings.customCodeEnabled === true;
      
      var currentUA = navigator.userAgent || '';
      tempAppScale = getScaleForUA(appSettings.scaleByBrowser, currentUA);
      tempBaseFontSize = getFontSizeForUA(appSettings.fontSizeByBrowser, currentUA);
      tempDisplayScale = getDisplayScaleForUA(appSettings.displayScaleByBrowser, currentUA);

      var scaleSlider = document.getElementById('scale-slider');
      var scaleDisplay = document.getElementById('scale-value-display');
      if (scaleSlider) scaleSlider.value = tempAppScale;
      if (scaleDisplay) scaleDisplay.innerText = Math.round(tempAppScale * 100) + '%';
      updateScalePresetButtons();

      var displayscaleSlider = document.getElementById('displayscale-slider');
      var displayscaleDisplay = document.getElementById('displayscale-value-display');
      if (displayscaleSlider) displayscaleSlider.value = tempDisplayScale;
      if (displayscaleDisplay) displayscaleDisplay.innerText = Math.round(tempDisplayScale * 100) + '%';
      updateDisplayScalePresetButtons();

      var fontsizeSlider = document.getElementById('fontsize-slider');
      var fontsizeDisplay = document.getElementById('fontsize-value-display');
      if (fontsizeSlider) fontsizeSlider.value = tempBaseFontSize;
      if (fontsizeDisplay) fontsizeDisplay.innerText = tempBaseFontSize + 'px';
      updateFontSizePresetButtons();

      updateCombinedPreview();
      
      document.getElementById('custom-code-enabled-box').classList.toggle('checked', customCodeEnabled);
      updateCustomCodeUI();
    
      const pMap = {'auto':'自动 (随机源)', 'bilibili':'哔哩哔哩', 'weibo':'微博热搜', 'zhihu':'知乎热榜', 'baidu':'百度热搜'};
      const sMap = {'time':'按时间', 'priority':'按优先级'};
      const akMap = {'v1':'v1', 'v0':'v0', 'all':'全部', 'disabled':'禁用'};
      
      document.getElementById('set-disp-provider').innerText = pMap[tempSetProvider];
      document.getElementById('set-disp-sort').innerText = sMap[tempSetSort];
      document.getElementById('set-disp-sort-asc').innerText = tempSetSortAsc ? '正序' : '倒序';
      document.getElementById('set-disp-apiKeyScope').innerText = akMap[tempSetApiKeyScope];
    
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
      updatePwaInstallUI();
      _navPush('settings-overlay', closeSettings, '/settings');
    }

    // 应用缓存大小计算与清空
    // 性能权衡：仅在用户主动点击「刷新」或「清空缓存」时计算，不随设置页打开自动触发
    // 准确性优先：优先读 content-length 头（O(1)），缺失时回退到 response.blob().size（读取完整响应体）
    // 因此显示结果不再带「≈」，但首次计算可能稍慢（取决于缓存条目数与无 content-length 的比例）
    function formatCacheSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    async function getCacheSize() {
      if (!('caches' in window)) return 0;
      var total = 0;
      var names = await caches.keys();
      for (var i = 0; i < names.length; i++) {
        var cache = await caches.open(names[i]);
        var requests = await cache.keys();
        for (var j = 0; j < requests.length; j++) {
          var response = await cache.match(requests[j]);
          if (!response) continue;
          // 优先 content-length 头（不读响应体，开销最低）
          var len = response.headers.get('content-length');
          if (len) {
            var n = parseInt(len, 10);
            if (!isNaN(n) && n >= 0) { total += n; continue; }
          }
          // 回退：读取响应体获取实际字节数（仅对缺失 content-length 的条目）
          try {
            var blob = await response.clone().blob();
            total += blob.size;
          } catch (e) { /* 跳过无法读取的条目 */ }
        }
      }
      return total;
    }

    async function refreshCacheSize() {
      var display = document.getElementById('cache-size-display');
      if (!display) return;
      if (!('caches' in window)) { display.textContent = '不可用'; return; }
      display.textContent = '计算中...';
      try {
        var bytes = await getCacheSize();
        display.textContent = formatCacheSize(bytes);
      } catch (e) {
        display.textContent = '计算失败';
      }
    }

    async function clearAppCache() {
      // 清理前端定制预览状态（保留 moara_authed 登录态与 themeMode 主题偏好）
      localStorage.removeItem('preview_custom_header');
      localStorage.removeItem('preview_custom_content');
      try {
        // 1. 清空 Service Worker Cache API
        if ('caches' in window) {
          var names = await caches.keys();
          await Promise.all(names.map(function(n) { return caches.delete(n); }));
        }
        // 2. 通知 Service Worker 释放其内部引用
        try { await clearPwaCache(); } catch(e) {}
      } catch (e) { /* 忽略，仍重载 */ }
      // 3. 直接重载到根路径，与 saveAndCloseSettings 行为一致
      // 避免停留在 /settings 路由；若处于预览模式，重载还能完全卸载已注入的自定义代码
      window.location.replace('/');
    }

    function closeSettings() {
      if (_isNavClosing) {
        const view = document.getElementById('settings-overlay');
        view.classList.add('closing');
        view.addEventListener('animationend', function handler() {
          view.classList.remove('active');
          view.classList.remove('closing');
          view.removeEventListener('animationend', handler);
        });
        return;
      }
      _navClose('settings-overlay');
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
      else if (type === 'apiKeyScope') { tempSetApiKeyScope = value; document.getElementById('set-disp-apiKeyScope').innerText = label; }
      document.getElementById(\`popover-set-\${type}\`).style.display = 'none';
    }

    async function saveAndCloseSettings() {
      appSettings.provider = tempSetProvider;
      appSettings.sortMethod = tempSetSort;
      appSettings.sortAsc = tempSetSortAsc;
      appSettings.apiKeyScope = tempSetApiKeyScope;
      appSettings.customCodeEnabled = customCodeEnabled;

      var currentUA = navigator.userAgent || '';
      setScaleForUA(currentUA, tempAppScale);
      setFontSizeForUA(currentUA, tempBaseFontSize);
      setDisplayScaleForUA(currentUA, tempDisplayScale);
    
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
      await clearPwaCache();
      localStorage.removeItem('preview_custom_header');
      localStorage.removeItem('preview_custom_content');
      window.location.replace('/');
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

    function updatePwaInstallUI() {
      var section = document.getElementById('pwa-install-section');
      var card = document.getElementById('pwa-install-card');
      var btn = document.getElementById('pwa-install-btn');
      var status = document.getElementById('pwa-install-status');
      if (!section || !card) return;

      var state = getPwaState();
      if (state === 'standalone') {
        section.style.display = '';
        card.style.display = '';
        if (btn) btn.style.display = 'none';
        if (status) status.textContent = '— 已作为应用运行';
      } else if (state === 'installable') {
        section.style.display = '';
        card.style.display = '';
        if (btn) btn.style.display = '';
      } else {
        section.style.display = 'none';
        card.style.display = 'none';
      }
    }
`;
