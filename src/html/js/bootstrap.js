export const bootstrap = `
    async function bootstrap() {
      if (_previewRedirecting) return;
      await initSettings();
      initVersionDisplay();
      var loginView = document.getElementById('login-view');
      if (loginView && !loginView.classList.contains('hidden')) {
        // Offline + previously logged in: show notice
        if (!navigator.onLine && localStorage.getItem('moara_authed') === '1') {
          var notice = document.createElement('p');
          notice.style.cssText = 'color:var(--warn);font-size:0.85rem;margin-top:12px;text-align:center;';
          notice.textContent = '当前处于离线状态，请恢复网络后访问。';
          loginView.querySelector('div').appendChild(notice);
        }
      } else {
        localStorage.setItem('moara_authed', '1');
        loadTodos();
        checkInterruptedImport();
        _navRestore();
      }
      // Register Service Worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(function(e) {
          console.warn('SW registration failed:', e);
        });
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

    async function resetFontSizeBrowserData() {
      var currentUA = navigator.userAgent || '';
      setFontSizeForUA(currentUA, 16);
      tempBaseFontSize = 16;
      var fontsizeSlider = document.getElementById('fontsize-slider');
      var fontsizeDisplay = document.getElementById('fontsize-value-display');
      var fontsizePreview = document.getElementById('fontsize-preview');
      if (fontsizeSlider) fontsizeSlider.value = 16;
      if (fontsizeDisplay) fontsizeDisplay.innerText = '16px';
      if (fontsizePreview) fontsizePreview.style.fontSize = '16px';
      updateFontSizePresetButtons();
      applyBaseFontSize(16);

      await fetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(appSettings),
        headers: { 'Content-Type': 'application/json' }
      });
    }

    async function resetDisplayScaleBrowserData() {
      var currentUA = navigator.userAgent || '';
      setDisplayScaleForUA(currentUA, 1.0);
      tempDisplayScale = 1.0;
      var displayscaleSlider = document.getElementById('displayscale-slider');
      var displayscaleDisplay = document.getElementById('displayscale-value-display');
      var displayscalePreview = document.getElementById('displayscale-preview');
      if (displayscaleSlider) displayscaleSlider.value = 1.0;
      if (displayscaleDisplay) displayscaleDisplay.innerText = '100%';
      if (displayscalePreview) displayscalePreview.style.zoom = 1.0;
      updateDisplayScalePresetButtons();
      applyDisplayScale(1.0);

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
        localStorage.removeItem('moara_authed');
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
      // API 密钥管理
      loadApiKeys: loadApiKeys,
      createApiKey: createApiKey,
      deleteApiKey: deleteApiKey,
      toggleApiKey: toggleApiKey,
      onScaleSliderChange: onScaleSliderChange,
      setScalePreset: setScalePreset,
      resetScaleBrowserData: resetScaleBrowserData,
      onFontSizeSliderChange: onFontSizeSliderChange,
      setFontSizePreset: setFontSizePreset,
      resetFontSizeBrowserData: resetFontSizeBrowserData,
      onDisplayScaleSliderChange: onDisplayScaleSliderChange,
      setDisplayScalePreset: setDisplayScalePreset,
      resetDisplayScaleBrowserData: resetDisplayScaleBrowserData,
      checkUpdate: checkUpdate,
      compareVersions: compareVersions,
      openChangelogModal: openChangelogModal,
      closeChangelogModal: closeChangelogModal,
      // PWA
      installPwa: installPwa,
      clearPwaCache: clearPwaCache,
      // SPA Router
      _navBack: _navBack,
      _navRestore: _navRestore,
    });
`;
