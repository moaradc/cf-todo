export function getBody(isAuthorized) {
  return `
<body>
  <div class="scanlines"></div>
  
  <div id="preview-notice" class="hidden" style="background:var(--warn);color:#000;padding:8px 15px;text-align:center;font-weight:bold;font-size:0.85rem;position:fixed;top:0;left:0;right:0;z-index:110;">⚠ 前端定制预览状态 — 自定义仅在本地生效 <span class="md-code" style="cursor:pointer;margin-left:8px;background:#000;color:var(--warn);" onclick="restoreAllPreview()">还原</span></div>

  <div class="container">
    <div class="top-actions-left ${isAuthorized ? '' : 'hidden'}">
      <button class="theme-toggle-btn" onclick="openTrash()">回收站</button>
      <button class="theme-toggle-btn" onclick="openStats()">统计</button>
    </div>
    <div class="top-actions ${isAuthorized ? '' : 'hidden'}">
      <button class="theme-toggle-btn" onclick="openSettings()">设置</button>
      <button id="theme-toggle-btn" class="theme-toggle-btn" onclick="toggleTheme()">自动</button>
    </div>
    <h1>待办事项</h1>

    <div id="login-view" class="${isAuthorized ? 'hidden' : ''}">
      <div style="border: 1px solid var(--accent); padding: 20px; text-align: center;">
        <p style="color:var(--accent); margin-bottom:15px;">[ 身份验证请求 ]</p>
        <input type="password" id="password-input" placeholder="输入密钥..." onkeydown="if(event.key==='Enter')login()">
        <button class="btn-primary" style="width:100%" onclick="login()">接入系统</button>
      </div>
    </div>

    <div id="app-view" class="${isAuthorized ? '' : 'hidden'}">
      
      <div class="date-bar">
        <button onclick="changeDate(-1)">&lt;</button>
        <div class="date-display" onclick="openCalendar()">
          <span class="main" id="date-main">LOADING...</span>
          <span class="sub" id="date-sub">点击切换日期</span>
        </div>
        <button onclick="changeDate(1)">&gt;</button>
      </div>

      <div class="toolbar">
        <button id="btn-batch-mode" onclick="toggleBatchMode()">≡ 批量</button>
        <div class="view-tags" onclick="openViewModal()">
          <button class="view-tag" id="view-tag-filter">全部</button>
          <button class="view-tag view-tag-shrink" id="view-tag-category">全部分类</button>
          <button class="view-tag" id="view-tag-sort">时间·正序</button>
          <button class="view-tag" onclick="event.stopPropagation();openCategoryManage()">分类管理</button>
        </div>
      </div>

      <div id="todo-list"></div>
      
      <div class="fab" onclick="openAddModal()">+</div>
    </div>
  </div>

  <div id="batch-bar" class="batch-bar hidden">
    <button onclick="batchSelectAll()">全选</button>
    <button onclick="batchToggleDone()">批量完成/取消</button>
    <button class="btn-danger" onclick="batchDelete()">批量删除</button>
    <button onclick="exitBatchMode()">退出</button>
  </div>

  <div id="modal-add" class="modal-overlay" onclick="if(event.target===this) closeAddModal()">
    <div class="modal-content">
      <h3 style="margin-bottom:15px; padding-bottom:5px;">>> 新建事项</h3>
      <input type="text" id="add-text" placeholder="事项标题（必填）">
      
      <div class="detail-label modal-section">子任务</div>
      <div class="row modal-subtask-row">
        <input type="text" id="add-subtask-input" placeholder="输入子任务（可选）" class="flex-1">
        <button onclick="addTempSubtask('add')">添加</button>
      </div>
      <div id="add-subtasks-list" style="margin-bottom:15px;"></div>

      <div class="detail-label modal-section">时间与重复</div>
      <div class="row modal-row">
        <div class="fake-input flex-1" onclick="openCalendarForAdd()">
          <span id="add-date-display">----/--/--</span>
          <span class="arrow">▼</span>
        </div>
        <div class="fake-input flex-1" id="add-repeat-trigger" onclick="toggleRepeatMenu('add', this)">
          <span id="add-repeat-display">重复: 不重复</span>
          <span class="arrow">▼</span>
        </div>
      </div>
      <div id="add-repeat-end-row" class="modal-row" style="display:none;">
        <div class="fake-input" onclick="openCalendarForRepeatEnd('add')">
          <span id="add-repeat-end-display">循环截止: 永不</span>
          <span class="arrow">▼</span>
        </div>
      </div>
      <div class="row modal-row">
        <div class="fake-input flex-1" onclick="openTimePicker('add','start')">
          <span id="add-time-display">开始 --:--</span>
          <span class="arrow">▼</span>
        </div>
        <div class="fake-input flex-1" onclick="openTimePicker('add','end')">
          <span id="add-endtime-display">结束 --:--</span>
          <span class="arrow">▼</span>
        </div>
      </div>

      <div class="detail-label modal-section">属性与链接</div>
      <div class="row modal-row">
        <div class="fake-input flex-1" id="add-category-trigger" onclick="toggleCategoryMenu('add', this)">
          <span id="add-category-display">分类: 无</span>
          <span class="arrow-r">▼</span>
        </div>
        <div class="fake-input flex-1" id="add-priority-trigger" onclick="togglePriorityMenu('add', this)">
          <span id="add-priority-display">优先级: 低</span>
          <span class="arrow">▼</span>
        </div>
      </div>
      <input type="url" id="add-url" placeholder="URL / APP Scheme (可选)">
      <input type="text" id="add-copy" placeholder="快捷复制内容（可选）">

      <div class="detail-label modal-section">其他</div>
      <div class="switch-label" onclick="toggleAddSearch()">
        <div class="switch-box" id="add-search-box"></div>
        <span>启用每日搜索</span>
      </div>
      <div id="add-search-actions" class="hidden" style="margin-bottom:15px;">
        <div class="row modal-row">
          <div class="fake-input flex-1" id="add-search-provider-trigger" onclick="toggleProviderMenu('add', this)" style="height:46px;">
            <span id="add-search-provider-display">自动 (随机源)</span>
            <span class="arrow-r">▼</span>
          </div>
          <button class="btn-ghost flex-1" id="add-search-regenerate-btn" style="height:46px; padding: 0 5px;" onclick="regenerateAddSearchTerms()">获取热搜</button>
        </div>
        <div class="search-card" id="add-search-preview"></div>
      </div>

      <textarea id="add-desc" rows="3" placeholder="输入备注/详细描述（可选）"></textarea>
      <div class="row" style="margin-top:10px;">
        <button class="flex-1" onclick="closeAddModal()">取消</button>
        <button class="flex-1 btn-primary" onclick="confirmAddTask()">添加</button>
      </div>
    </div>
  </div>

  <div id="detail-view" class="detail-overlay">
    <div class="detail-header">
      <div style="display:flex; align-items:center; gap:6px;">
        <button onclick="closeDetail()" style="padding: 4px 8px;">←</button>
        <span style="font-weight:bold;">事项详情</span>
      </div>
      <button id="btn-edit-toggle" onclick="toggleEditMode()" style="padding: 4px 8px;">编辑</button>
    </div>
    <div id="detail-content"></div>
    <div style="margin-top:auto; display:flex; gap:10px; padding-top:20px;">
      <button class="btn-danger flex-1" id="btn-delete-task">删除事项</button>
      <button class="btn-primary flex-1 hidden" id="btn-save-task">保存变更</button>
    </div>
  </div>

  <div id="trash-overlay" class="detail-overlay">
    <div class="detail-header" style="align-items: center;">
      <div style="display:flex; align-items:center; gap:6px;">
        <button onclick="closeTrash()" style="padding: 4px 8px;">←</button>
        <span style="font-weight:bold;">回收站</span>
      </div>
      <div style="display:flex; gap:8px;">
        <button id="btn-trash-batch" style="padding:4px 8px;" onclick="toggleTrashBatchMode()">批量</button>
        <button class="btn-danger" style="padding:4px 8px; border:1px solid #666;" onclick="clearTrash()">清空</button>
      </div>
    </div>
    <div id="trash-list" style="flex:1; overflow-y:auto; padding-bottom: 20px;"></div>
    
    <div id="trash-batch-bar" class="batch-bar hidden" style="z-index: 70;">
      <button onclick="batchTrashSelectAll()">全选</button>
      <button onclick="batchTrashRestore()">恢复选中</button>
      <button class="btn-danger" onclick="batchTrashDelete()">彻底删除</button>
      <button onclick="exitTrashBatchMode()">退出</button>
    </div>
  </div>

  <div id="stats-overlay" class="detail-overlay">
    <div class="detail-header" style="align-items: center;">
      <div style="display:flex; align-items:center; gap:6px;">
        <button onclick="closeStats()" style="padding: 4px 8px;">←</button>
        <span style="font-weight:bold;" id="stats-title-text">7天统计</span>
      </div>
      <button id="stats-switch-btn" class="btn-ghost hidden" style="padding:4px 8px; border:1px solid #666;" onclick="switchStatsTab()">年度报告</button>
    </div>
    <div style="flex:1; overflow-y:auto; padding-bottom: 20px;">
      <div id="stats-weekly">
        <div id="stats-loading" style="text-align:center; padding:40px; color:var(--fg);">数据拉取中...</div>
        <div id="stats-content" class="hidden">
          <div class="stats-grid">
            <div class="chart-container chart-container-bar"><canvas id="chart-bar"></canvas></div>
            <div style="text-align: center; color: var(--crt); font-weight: bold; font-size: 1.1rem; margin: 5px 0;" id="stats-total-info">近7天总完成数: 0</div>
            <div class="stats-row-bottom">
              <div class="chart-container chart-container-pie"><canvas id="chart-pie-priority"></canvas></div>
              <div class="chart-container chart-container-pie"><canvas id="chart-pie-status"></canvas></div>
            </div>
          </div>
        </div>
      </div>
      <div id="stats-annual" class="hidden">
        <div id="annual-loading" style="text-align:center; padding:40px; color:var(--fg);">年度数据加载中...</div>
        <div id="annual-content" class="hidden"></div>
      </div>
    </div>
  </div>

  <div id="settings-overlay" class="detail-overlay">
    <div class="detail-header" style="align-items: center;">
      <div style="display:flex; align-items:center; gap:6px;">
        <button onclick="closeSettings()" style="padding: 4px 8px;">←</button>
        <span style="font-weight:bold;">系统设置</span>
      </div>
      <button onclick="saveAndCloseSettings()" style="padding: 4px 8px;">保存</button>
    </div>
    <div style="flex:1; overflow-y:auto; padding-bottom: 20px;">
      
      <div class="detail-label">偏好设置</div>
      <div style="margin-bottom: 20px;">
          <div class="setting-item">
              <span class="flex-1">每日搜索源</span>
              <div class="fake-input" onclick="toggleSettingPopover('provider', this)" style="width: 145px; margin-bottom: 0; padding: 6px 8px; justify-content: space-between; border-radius: 4px;">
                  <span id="set-disp-provider">自动 (随机源)</span>
                  <span style="font-size:0.8rem; margin-right: 4px;">▼</span>
              </div>
          </div>
          <div class="setting-item">
              <span class="flex-1">排序方式</span>
              <div class="fake-input" onclick="toggleSettingPopover('sort', this)" style="width: 145px; margin-bottom: 0; padding: 6px 8px; justify-content: space-between; border-radius: 4px;">
                  <span id="set-disp-sort">按时间</span>
                  <span style="font-size:0.8rem; margin-right: 4px;">▼</span>
              </div>
          </div>
          <div class="setting-item">
              <span class="flex-1">排序顺序</span>
              <div class="fake-input" onclick="toggleSettingPopover('sortAsc', this)" style="width: 145px; margin-bottom: 0; padding: 6px 8px; justify-content: space-between; border-radius: 4px;">
                  <span id="set-disp-sort-asc">正序</span>
                  <span style="font-size:0.8rem; margin-right: 4px;">▼</span>
              </div>
          </div>
          <div class="setting-item" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
              <span>显示大小</span>
              <span class="md-code" style="cursor:pointer;margin-left:auto;" onclick="resetScaleBrowserData()">重置</span>
            </div>
            <div class="scale-control">
              <div class="scale-slider-row">
                <span class="scale-label-sm">A</span>
                <input type="range" id="scale-slider" min="0.75" max="1.25" step="0.01" value="1" oninput="onScaleSliderChange(this.value)">
                <span class="scale-label-lg">A</span>
                <span class="scale-value" id="scale-value-display">100%</span>
              </div>
              <div class="scale-presets">
                <button class="scale-preset-btn" data-scale="0.85" onclick="setScalePreset(0.85)">小</button>
                <button class="scale-preset-btn active" data-scale="1.0" onclick="setScalePreset(1.0)">默认</button>
                <button class="scale-preset-btn" data-scale="1.15" onclick="setScalePreset(1.15)">大</button>
              </div>
              <div class="scale-preview-wrap">
                <div id="scale-preview" style="zoom:1;">
                  <div class="todo-item" style="margin-bottom:5px;">
                    <div class="checkbox"></div>
                    <div class="item-meta">
                      <div class="item-title">示例待办事项</div>
                      <div class="item-info">
                        <span class="badge badge-high">高</span>
                        <span class="badge badge-time">09:00</span>
                      </div>
                    </div>
                  </div>
                  <div class="todo-item done">
                    <div class="checkbox"></div>
                    <div class="item-meta">
                      <div class="item-title">已完成的任务</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>
      
      <div class="settings-card">
          <div class="setting-item" style="margin-bottom: 15px; border: none; padding: 0;">
              <span class="settings-text" style="margin:0;"><strong>启用前端定制注入</strong></span>
              <div class="switch-label" onclick="toggleCustomCodeEnabled()" style="margin-bottom: 0;">
                  <div class="switch-box" id="custom-code-enabled-box"></div>
              </div>
          </div>

          <p class="settings-text" style="margin-bottom: 12px;">关闭后将不再注入自定义代码，但代码仍会保留在数据库中。</p>
          
         <div class="detail-label" style="margin-top: 6px;">自定义头部</div>
        <textarea id="custom-header-preview" rows="5"
          style="resize:vertical; font-size:0.8rem; margin-bottom: 12px;"
          placeholder="未配置或已关闭 — 将注入到 &lt;head&gt; 内"></textarea>
          <div class="detail-label">自定义内容</div>
          <textarea id="custom-content-preview" rows="5"
            style="resize:vertical; font-size:0.8rem; margin-bottom: 12px;"
            placeholder="未配置或已关闭 — 将注入到 &lt;/body&gt; 前"></textarea>
          <div id="custom-action-row" style="display:none; gap:10px; margin-bottom:12px;">
              <span class="md-code" style="cursor:pointer; flex:1; text-align:center;" onclick="previewCustomCode()">预览</span>
              <span class="md-code" style="cursor:pointer; flex:1; text-align:center;" onclick="resetCustomCode()">重置</span>
              <span class="md-code" style="cursor:pointer; color:var(--accent); flex:1; text-align:center; display:none;" id="restore-custom-btn" onclick="restoreAllPreview()">还原</span>
          </div>
          <div class="settings-text" style="border-top: 1px dashed #333; padding-top: 10px;">
            <strong>说明：</strong>通过编辑区注入自定义 HTML/CSS/JS，存储在 D1 数据库中。（可留空）<br>
            <strong>自定义头部</strong> — 注入到 <span class="md-code">&lt;head&gt;</span> 内（适合放 <span class="md-code">&lt;style&gt;</span>、外部 CSS、meta 标签等）<br>
            <strong>自定义内容</strong> — 注入到 <span class="md-code">&lt;/body&gt;</span> 前（适合放 <span class="md-code">&lt;script&gt;</span>、HTML 片段等）
          </div>
      </div>

      <div class="detail-label">数据管理 (导入/导出 JSON)</div>
      <div class="settings-card">
          <div class="settings-text" style="margin-bottom: 10px;">即将导出的内容包括：</div>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer;">
            <input type="checkbox" id="export-todos" checked style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">活动与历史待办事项（含重复模板）</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer;">
            <input type="checkbox" id="export-trash" checked style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">仅回收站中的数据（相关的黑名单在重复模板中）</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer;">
            <input type="checkbox" id="export-settings" checked style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">个性化数据</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:15px; cursor:pointer;">
            <input type="checkbox" id="export-categories" checked style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">分类数据</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; margin-bottom:15px; cursor:pointer;">
            <input type="checkbox" id="chunked-mode" style="width:16px; height:16px; margin:0;"> 
            <span class="settings-text" style="margin:0;">使用分片模式（推荐大数据使用）</span>
          </label>
          <div class="row">
              <button class="flex-1" onclick="exportData()">导出数据</button>
              <button class="flex-1" onclick="document.getElementById('import-file').click()">导入数据</button>
              <input type="file" id="import-file" style="display:none" accept=".json" onchange="importData(event)">
          </div>
          <div class="settings-text" style="border-top: 1px dashed #333; padding-top: 10px; margin-top: 15px;">
           <strong>/api/import-backup: </strong>执行覆盖模式导入时，系统会将当前 <span class="md-code">todos、todo_templates、categories</span> 表直接重命名为备份表，然后创建空表接收新数据。导入成功则删除备份表，导入异常将自动把备份表重命名回主表恢复原数据。若自动恢复也失败（极端情况）或存在残留，可在浏览器地址栏访问以下接口手动处理。<br>
           <span class="md-code">?action=query</span> — 查询是否存在备份表<br>
           <span class="md-code">?action=restore</span> — 恢复备份表（当前数据将被覆盖）<br>
           <span class="md-code">?action=clear</span> — 清空备份表
          </div>
      </div>

      <div class="detail-label">登录管理</div>
      <div class="settings-card">
          <p class="settings-text" style="margin-bottom: 12px;">最多支持 <strong>3</strong> 个浏览器UA同时登录。达到上限后新登录将自动替换最早（靠上）登录的会话。</p>
          <div id="sessions-list" style="margin-bottom: 12px;"></div>
          <button class="btn-danger" style="width:100%" onclick="deleteAllSessions()">全部删除</button>
      </div>

      <div class="detail-label">关于 MOARA 待办事项</div>
      <div class="settings-card">
          <p class="settings-text" style="margin-bottom:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><strong>当前版本:</strong> <span id="app-version-display"></span> <span id="update-status"></span> <span class="md-code" style="cursor:pointer;font-size:0.75rem;" onclick="checkUpdate()">检查</span></p>
          <p class="settings-text" style="margin-bottom: 5px;"><strong>底层架构:</strong> Cloudflare Worker + D1 Database</p>
          <p class="settings-text"><strong>项目描述:</strong> 普通的待办事项管理</p>
      </div>

      <div class="detail-label" style="color: var(--accent);">危险区域</div>
      <div class="settings-card danger">
          <div class="settings-text" style="margin-bottom: 10px;">退出当前登录会话，需重新输入密钥接入系统。您的数据不会消失。</div>
          <button class="btn-danger" style="width:100%" onclick="logout()">退出登录</button>
          
          <p class="settings-text" style="margin-bottom: 15px; margin-top: 20px; padding-top: 20px; border-top: 1px dashed var(--accent);">执行此操作将不可逆地清空所有的系统记录、回收站数据并重置偏好设置。建议提前导出备份。</p>
          <button class="btn-danger" style="width:100%" onclick="factoryReset()">恢复出厂设置</button>
      </div>

    </div>
  </div>

  <div id="modal-changelog" class="modal-overlay" onclick="if(event.target===this) closeChangelogModal()">
    <div class="modal-content" style="max-height:80vh;display:flex;flex-direction:column;">
      <h3 style="margin-bottom:15px; padding-bottom:5px; flex-shrink:0;">>> 更新日志</h3>
      <div id="changelog-list" style="flex:1;overflow-y:auto;min-height:0;"></div>
      <div style="margin-top:15px; flex-shrink:0;">
        <button class="flex-1" onclick="closeChangelogModal()" style="width:100%;">关闭</button>
      </div>
    </div>
  </div>

  <div id="popover-action" class="popover-menu">
    <div class="popover-title" id="popover-title">选择操作范围:</div>
    <div id="popover-options"></div>
  </div>

  <div id="popover-priority" class="popover-menu">
    <button onclick="selectPriority('low')">优先级: 低</button>
    <button onclick="selectPriority('med')">优先级: 中</button>
    <button onclick="selectPriority('high')">优先级: 高</button>
  </div>

  <div id="popover-provider" class="popover-menu">
    <button onclick="selectProvider('auto')">自动 (随机源)</button>
    <button onclick="selectProvider('bilibili')">哔哩哔哩</button>
    <button onclick="selectProvider('weibo')">微博热搜</button>
    <button onclick="selectProvider('zhihu')">知乎热榜</button>
    <button onclick="selectProvider('baidu')">百度热搜</button>
  </div>

  <div id="popover-repeat" class="popover-menu">
    <button onclick="selectRepeat('none', '不重复')">不重复</button>
    <button onclick="selectRepeat('daily', '每天')">每天</button>
    <button onclick="selectRepeat('weekly', '每周')">每周</button>
    <button onclick="selectRepeat('monthly', '每月')">每月</button>
    <button onclick="selectRepeat('yearly', '每年')">每年</button>
  </div>

  <div id="modal-category" class="modal-overlay" style="z-index:85;" onclick="if(event.target===this) closeCategoryModal()">
    <div class="modal-content" style="max-width:350px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:5px;">
        <h3 id="category-modal-title" style="margin:0;">>> 选择分类</h3>
        <button id="cat-batch-btn" onclick="toggleCatBatch()" style="display:none;font-size:1rem;padding:2px 6px;border:1px solid var(--crt);background:transparent;color:var(--crt);cursor:pointer;">≡</button>
      </div>
      <div id="category-modal-body" class="category-modal-body">
        <div id="category-modal-list" class="category-modal-list"></div>
        <div id="category-color-presets" class="category-color-presets" style="display:none;"></div>
      </div>
      <div class="category-modal-divider">
        <div id="category-search-row" style="display:flex;gap:6px;align-items:stretch;">
          <input type="text" id="category-new-name" class="category-new-input" placeholder="搜索或快捷新建分类..." style="margin:0;flex:1;" oninput="onCategorySearchInput()" onkeydown="if(event.key==='Enter'&&!event.isComposing)onCategorySearchEnter()">
          <button id="category-toggle-btn" onclick="toggleCategoryMode()" style="width:36px;border:1px solid var(--crt);background:transparent;color:var(--crt);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;">
            <svg id="category-toggle-icon-plus" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;transition:opacity 0.3s ease,transform 0.3s ease;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <svg id="category-toggle-icon-search" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;opacity:0;transform:rotate(-90deg);transition:opacity 0.3s ease,transform 0.3s ease;"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </div>
        <div id="category-edit-preview" style="display:none;padding:4px 0;"></div>
        <div id="category-create-row" style="display:none;gap:6px;align-items:stretch;">
          <input type="text" id="category-create-name" class="category-new-input" placeholder="新建分类..." style="margin:0;flex:1;" oninput="onCategoryCreateInput()" onkeydown="if(event.key==='Enter'&&!event.isComposing)onCategoryCreateEnter()">
          <button id="category-toggle-btn-2" onclick="toggleCategoryMode()" style="width:36px;border:1px solid var(--crt);background:transparent;color:var(--crt);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </div>
        <div style="margin-top:6px;display:flex;gap:6px;">
          <button class="flex-1" onclick="closeCategoryModal()" style="font-size:0.8rem;padding:8px;">取消</button>
          <button id="category-confirm-btn" class="flex-1" onclick="onCategoryCreateBtnClick()" style="font-size:0.8rem;padding:8px;">创建</button>
        </div>
      </div>
      <div id="cat-batch-bar" style="display:none;margin-top:6px;gap:6px;">
        <button class="flex-1" onclick="catBatchSelectAll()" style="font-size:0.8rem;padding:8px;">全选</button>
        <button class="flex-1 btn-danger" onclick="catBatchDelete()" style="font-size:0.8rem;padding:8px;">删除</button>
        <button class="flex-1" onclick="toggleCatBatch()" style="font-size:0.8rem;padding:8px;">取消</button>
      </div>
    </div>
  </div>

  <div id="modal-view" class="modal-overlay" style="z-index:80;" onclick="if(event.target===this) closeViewModal()">
    <div class="modal-content" style="max-width:340px;">
      <h3 style="margin-bottom:12px; padding-bottom:5px;">>> 视图</h3>
      <div class="detail-label" style="margin-top:0;">筛选</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;" id="view-filter-btns">
        <div class="category-modal-item selected" data-val="all" onclick="setViewFilter('all')"><span class="cat-name">全部</span></div>
        <div class="category-modal-item" data-val="todo" onclick="setViewFilter('todo')"><span class="cat-name">未完成</span></div>
        <div class="category-modal-item" data-val="done" onclick="setViewFilter('done')"><span class="cat-name">已完成</span></div>
      </div>
      <div class="detail-label">分类</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;max-height:120px;overflow-y:auto;" id="view-category-btns"></div>
      <div class="detail-label">排序</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;" id="view-sort-btns">
        <div class="category-modal-item selected" data-val="time" onclick="setViewSort('time')"><span class="cat-name">时间</span></div>
        <div class="category-modal-item" data-val="priority" onclick="setViewSort('priority')"><span class="cat-name">优先级</span></div>
      </div>
      <div class="detail-label">顺序</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;" id="view-order-btns">
        <div class="category-modal-item selected" data-val="asc" onclick="setViewOrder(true)"><span class="cat-name">正序</span></div>
        <div class="category-modal-item" data-val="desc" onclick="setViewOrder(false)"><span class="cat-name">倒序</span></div>
      </div>
      <button onclick="closeViewModal()" style="width:100%;font-size:0.85rem;padding:8px;">完成</button>
    </div>
  </div>

  <div id="popover-set-provider" class="popover-menu">
    <button onclick="selectSetting('provider', 'auto', '自动 (随机源)')">自动 (随机源)</button>
    <button onclick="selectSetting('provider', 'bilibili', '哔哩哔哩')">哔哩哔哩</button>
    <button onclick="selectSetting('provider', 'weibo', '微博热搜')">微博热搜</button>
    <button onclick="selectSetting('provider', 'zhihu', '知乎热榜')">知乎热榜</button>
    <button onclick="selectSetting('provider', 'baidu', '百度热搜')">百度热搜</button>
  </div>
  <div id="popover-set-sort" class="popover-menu">
    <button onclick="selectSetting('sort', 'time', '按时间')">按时间</button>
    <button onclick="selectSetting('sort', 'priority', '按优先级')">按优先级</button>
  </div>
  <div id="popover-set-sortAsc" class="popover-menu">
    <button onclick="selectSetting('sortAsc', 'true', '正序')">正序</button>
    <button onclick="selectSetting('sortAsc', 'false', '倒序')">倒序</button>
  </div>

  <div id="modal-calendar" class="modal-overlay" style="z-index:65;" onclick="if(event.target===this) closeCalendar()">
    <div class="modal-content">
      <div class="calendar-header">
        <span style="cursor:pointer" onclick="calChange(-1)" id="cal-prev">&lt; 上月</span>
        <span id="cal-title"></span>
        <span style="cursor:pointer" onclick="calChange(1)" id="cal-next">下月 &gt;</span>
      </div>
      <div class="calendar-grid" id="cal-grid"></div>
      <button id="cal-action-btn" class="btn-ghost" style="width:100%; margin-top:15px;" onclick="jumpToToday()">返回今日</button>
    </div>
  </div>

  <div id="modal-time" class="modal-overlay" onclick="if(event.target===this) closeTimePicker()">
    <div class="modal-content">
      <h3 id="time-picker-title" style="text-align:center; margin-bottom:10px;">选择时间</h3>
      <div class="row">
        <div class="flex-1"><div class="time-label">时</div></div>
        <div class="flex-1"><div class="time-label">分</div></div>
      </div>
      <div class="time-picker-container">
        <div class="time-col" id="time-col-hour"></div>
        <div class="time-col" id="time-col-min"></div>
      </div>
      <div class="row">
        <button class="flex-1" onclick="clearTime()">清除</button>
        <button class="flex-1 btn-primary" onclick="confirmTime()">确认</button>
      </div>
    </div>
  </div>

  `;
}
