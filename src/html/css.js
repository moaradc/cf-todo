export const css = `
    /* =========================================
       DEFAULT THEME: DARK BRUTALISM
       ========================================= */
    :root {
      --bg: #0a0a0a;
      --fg: #b0b0b0;
      --accent: #ff3300; 
      --crt: #00ff41;    
      --warn: #ffcc00;   
      --panel: #141414;
      --font-main: 'Courier New', Courier, monospace;
      --app-scale: 1;
      --display-scale: 1;
      --base-font-size: 16px;
      --cat-color-default: #888888;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; scrollbar-width: none; -ms-overflow-style: none; }
    *::-webkit-scrollbar { display: none; }
    html { font-size: var(--base-font-size); }
    
    #app-root { zoom: var(--display-scale); width: 100%; display: flex; flex-direction: column; align-items: center; }
    
    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--font-main);
      overflow-x: hidden;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-bottom: 120px;
      zoom: var(--app-scale);
    }

    .scanlines {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(to bottom, rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%);
      background-size: 100% 2px;
      pointer-events: none;
      z-index: 100;
    }

    .container { width: 100%; max-width: calc(600px / var(--app-scale) / var(--display-scale)); padding: 15px; position: relative; z-index: 1; }

    .top-actions { position: absolute; top: 15px; right: 15px; display: flex; gap: 8px; z-index: 10; }
    .top-actions-left { position: absolute; top: 15px; left: 15px; display: flex; gap: 8px; z-index: 10; }
    
    .theme-toggle-btn {
      background: #222; color: var(--fg);
      border: 1px solid #333; padding: 4px 8px;
      font-size: 0.75rem; cursor: pointer;
      font-family: var(--font-main);
      transition: 0.2s;
    }
    .theme-toggle-btn:hover { background: var(--fg); color: #000; }

    h1 {
      font-size: 1.5rem; text-transform: uppercase; border-bottom: 2px dashed var(--fg);
      padding-bottom: 10px; margin-bottom: 20px; text-align: center; letter-spacing: 1px;
    }
    h1 span { color: var(--accent); font-weight: bold; }

    button {
      background: #222; color: var(--fg); border: 1px solid var(--fg);
      padding: 8px 12px; font-family: var(--font-main); cursor: pointer;
      text-transform: uppercase; font-size: 0.85rem; transition: 0.2s;
    }
    button:active { background: var(--accent); color: #000; border-color: var(--accent); }
    
    .btn-primary { background: var(--accent); color: #000; border: none; font-weight: bold; }
    .btn-danger { color: var(--accent); border-color: var(--accent); }
    .btn-danger:hover { background: var(--accent); color: #000; }
    .btn-ghost { background: transparent; border: none; color: #666; }
    .btn-ghost:hover { color: var(--fg); }

    input, textarea, select {
      width: 100%; background: #000; border: 1px solid #444; color: var(--crt);
      padding: 8px 10px; font-family: var(--font-main); font-size: 1rem; outline: none; margin-bottom: 10px;
    }
    textarea { resize: vertical; scrollbar-width: thin; }
    textarea::-webkit-scrollbar { display: initial; }
    input:focus, textarea:focus, select:focus { border-color: var(--crt); box-shadow: 0 0 5px rgba(0,255,65,0.3); }
    
    .fake-input {
      width: 100%; background: #000; border: 1px solid #444; color: var(--fg);
      padding: 8px 10px; font-family: var(--font-main); font-size: 1rem; margin-bottom: 10px;
      cursor: pointer; display: flex; justify-content: space-between; align-items: center;
    }
    .fake-input:active { border-color: var(--accent); }
    .fake-input span { pointer-events: none; }
    #add-category-display, #edit-category-display { min-width: 0; word-break: break-all; }

    .date-bar {
      display: flex; justify-content: space-between; align-items: center;
      background: #000; border: 1px solid var(--fg); padding: 8px; margin-bottom: 10px;
    }
    .date-display { text-align: center; cursor: pointer; }
    .date-display .main { font-size: 1.2rem; font-weight: bold; color: var(--crt); }
    .date-display .sub { font-size: 0.8rem; color: #aaa; display: block; }

    .toolbar { display: flex; align-items: center; gap: 6px; margin-bottom: 15px; }
    .toolbar button { 
      flex: none; font-size: 0.7rem; padding: 6px 8px; text-align: center; 
      border-color: #444; color: #888; white-space: nowrap;
    }
    .toolbar button.active { border-color: var(--crt); color: var(--crt); }
    .view-tags { flex: 1; display: flex; align-items: center; gap: 4px; overflow: hidden; cursor: pointer; min-width: 0; }
    .view-tag { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .toolbar .view-tag-shrink { flex-shrink: 1; min-width: 0; }

    .todo-item {
      display: flex; align-items: center; background: var(--panel);
      border-left: 4px solid #333; margin-bottom: 10px; padding: 15px;
      cursor: pointer; transition: 0.2s; position: relative;
    }
    .todo-item:active { transform: scale(0.98); }
    
    .checkbox { width: 20px; height: 20px; border: 2px solid var(--fg); margin-right: 15px; flex-shrink: 0; transition: 0.2s; }
    .todo-item.pri-high .checkbox { border-color: var(--accent); }
    .todo-item.pri-med .checkbox { border-color: var(--warn); }
    
    .todo-item.done { border-left-color: #444; opacity: 0.45; filter: grayscale(80%); }
    .todo-item.done .item-title { text-decoration: line-through; color: #777; }
    .todo-item.done .checkbox { background: #222; border-color: #555; position: relative; }
    .todo-item.done .checkbox::after { content: '✓'; color: #666; position: absolute; left: 2px; top: -2px; font-size: 16px; font-weight: bold; }

    .todo-item .checkbox.batch-selected { background: var(--accent) !important; border-color: var(--accent) !important; position: relative; filter: none !important; opacity: 1 !important; }
    .todo-item .checkbox.batch-selected::after { content: '✓' !important; color: #000 !important; font-size: 16px; font-weight: bold; position: absolute; top: -2px; left: 2px; }

    .item-meta { display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; }
    .item-title { font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.2s; }
    .item-info { font-size: 0.75rem; color: #666; margin-top: 4px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    
    .badge { padding: 1px 4px; border-radius: 2px; font-size: 0.7rem; color: #000; font-weight: bold; }
    .badge-high { background: var(--accent); }
    .badge-med { background: var(--warn); }
    .badge-low { background: #888; }
    .badge-time { background: #333; color: var(--crt); border: 1px solid #444; }
    .badge-overdue { background: #8B0000; color: #FF6B6B; border: 1px solid #FF6B6B; }
    .badge-warning { background: #4A3000; color: #FFD93D; border: 1px solid #FFD93D; }
    .badge-category { display: inline-flex; align-items: center; padding: 6px 12px; color: var(--fg); font-size: 0.85rem; border: 1px solid #333; background: transparent; gap: 6px; max-width: 100%; }
    .badge-category-icon { width: 8px; height: 8px; border-radius: 2px; background: var(--cat-color-default); display: inline-block; flex-shrink: 0; }
    .badge-category .cat-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .category-new-input { width: 100%; background: #000; border: 1px solid var(--crt); color: var(--crt); padding: 8px; font-family: var(--font-main); font-size: 0.85rem; outline: none; margin: 4px 0; }
    .category-new-input:focus { box-shadow: 0 0 5px rgba(0,255,65,0.3); }
    .category-modal-list { max-height: 50vh; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start; }
    .category-modal-body { overflow: hidden; margin: 0 -20px; padding: 0 20px; transition: height 0.3s ease; }
    .category-modal-item { display: inline-flex; align-items: center; padding: 6px 12px; cursor: pointer; color: var(--fg); font-size: 0.85rem; border: 1px solid #333; background: transparent; transition: background 0.15s, border-color 0.15s; gap: 6px; max-width: 100%; }
    .category-modal-item:hover { background: var(--accent); color: #000; border-color: var(--accent); }
    .category-modal-item.selected { background: var(--crt); color: #000; font-weight: bold; border-color: var(--crt); }
    .category-modal-item .badge-category-icon { flex-shrink: 0; }
    .category-modal-item .cat-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cat-highlight { color: var(--accent); font-weight: bold; }
    .category-modal-divider { border-top: 1px solid #333; margin: 10px 0; padding-top: 10px; }
    .category-color-presets { display: flex; flex-wrap: wrap; gap: 10px; padding: 8px 0; align-items: center; }
    .category-color-circle { width: 28px; height: 28px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: border-color 0.15s, transform 0.15s; flex-shrink: 0; }
    .category-color-circle:hover { transform: scale(1.15); }
    .category-color-circle.selected { border-color: var(--crt); box-shadow: 0 0 6px rgba(0,255,65,0.4); }
    .category-color-custom { width: 28px; height: 28px; border-radius: 50%; cursor: pointer; border: 2px dashed #555; display: flex; align-items: center; justify-content: center; transition: border-color 0.15s, transform 0.15s; flex-shrink: 0; position: relative; }
    .category-color-custom:hover { transform: scale(1.15); }
    .category-color-custom.selected { border-color: var(--crt); border-style: solid; box-shadow: 0 0 6px rgba(0,255,65,0.4); }
    .category-color-custom svg { pointer-events: none; }

    .btn-link {
      background: #222; border: 1px solid #444; color: var(--crt);
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      margin-left: 10px; font-size: 0.9rem; text-decoration: none; cursor: pointer; flex-shrink: 0;
    }
    .btn-link:hover { background: var(--crt); color: #000; }

    /* ==================== 详情面板计时区块 ==================== */
    .timer-row {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .timer-elapsed-large {
      font-size: 1.4rem; font-weight: bold; font-variant-numeric: tabular-nums;
      color: var(--accent);
    }
    /* 累计/本次前累计 用普通 detail-value 字号 + 内联 style 控制副信息层级，
       与 feat/more-ui-fixes 碎时记 UI 1:1 一致，不引入额外 class */

    .fab {
      position: fixed; bottom: 30px; right: 30px; width: 60px; height: 60px;
      background: var(--accent); color: #000; font-size: 2.5rem;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #fff; box-shadow: 4px 4px 0 #000; z-index: 20; cursor: pointer;
    }

    .batch-bar {
      position: fixed; left: 50%;
      top: calc(100dvh - 20px - env(safe-area-inset-bottom, 0px));
      transform: translate(-50%, -100%);
      width: 92%; max-width: 600px;
      background: var(--panel); border: 2px solid var(--accent);
      padding: 10px; border-radius: 8px;
      display: flex; justify-content: space-between; gap: 8px;
      z-index: 30; animation: popupSlide 0.3s forwards;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
    }
    .batch-bar.closing { animation: popupSlideDown 0.3s forwards; }
    @keyframes popupSlide {
      from { transform: translate(-50%, 100%); opacity: 0; }
      to { transform: translate(-50%, -100%); opacity: 1; }
    }
    @keyframes popupSlideDown {
      from { transform: translate(-50%, -100%); opacity: 1; }
      to { transform: translate(-50%, 100%); opacity: 0; }
    }
    .batch-bar button { flex: 1; padding: 10px 2px; font-size: 0.75rem; letter-spacing: -0.5px; white-space: nowrap; }
    
    .modal-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.9); backdrop-filter: blur(4px);
      z-index: 40; display: none; justify-content: center; align-items: center;
    }
    .modal-overlay.active { display: flex; animation: fadeIn 0.2s; }
    .modal-content {
      width: 90%; max-width: 400px; max-height: 90vh; overflow-y: auto; background: #111; border: 1px solid var(--crt);
      padding: 20px; box-shadow: 0 0 30px rgba(0,255,65,0.1); position: relative;
    }

    #modal-time, #modal-interval { z-index: 90; }

    .calendar-header { display: flex; justify-content: space-between; margin-bottom: 15px; color: var(--accent); font-weight: bold; align-items: center; }
    .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center; }
    .cal-day-name { color: #666; font-size: 0.8rem; margin-bottom: 5px; }
    .cal-date { padding: 10px 0; cursor: pointer; border: 1px solid transparent; color: var(--fg); }
    .cal-date:hover { border-color: var(--fg); }
    .cal-date.today { color: var(--accent); font-weight: bold; border: 1px dashed var(--accent); }
    .cal-date.selected { background: var(--crt); color: #000; font-weight: bold; box-shadow: 2px 2px 0 #000; }
    .cal-date.empty { pointer-events: none; }
    .cal-title-btn { cursor: pointer; border-bottom: 1px dashed var(--accent); padding: 0 2px; margin: 0 2px; transition: color 0.2s; }
    .cal-title-btn:hover { color: var(--crt); border-color: var(--crt); }

    .time-picker-container { display: flex; height: 200px; gap: 10px; margin-bottom: 15px; }
    .time-col { flex: 1; overflow-y: auto; border: 1px solid #333; display: flex; flex-direction: column; }
    .time-cell { padding: 8px; text-align: center; cursor: pointer; color: #666; font-size: 0.9rem; }
    .time-cell.active { background: var(--crt); color: #000; font-weight: bold; }
    .time-label { text-align: center; font-size: 0.8rem; color: var(--accent); margin-bottom: 5px; }

    .detail-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: #080808; z-index: 60; display: none; flex-direction: column;
      padding: 20px; overflow-y: auto;
    }
    .detail-overlay.active { display: flex; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    .detail-overlay.closing { animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

    .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid #333; padding-bottom: 10px; }
    .detail-label { color: #555; font-size: 0.8rem; margin-bottom: 5px; text-transform: uppercase; }
    .detail-value { 
      color: var(--fg); font-size: 1.1rem; margin-bottom: 20px; 
      border-left: 2px solid #333; padding-left: 10px; min-height: 28px; 
      display: flex; align-items: center; word-break: break-all;
    }
    .detail-value.editable { border-left: 2px solid var(--accent); background: #111; padding: 8px 10px; outline: none; }
    .fake-input.detail-value.editable { display: flex; justify-content: space-between; }
    .detail-value a { text-decoration: none; color: var(--crt); border-bottom: 1px dashed var(--crt); }

    .popover-menu {
      position: absolute; background: #000; border: 2px solid var(--accent);
      padding: 5px; z-index: 80; display: none; flex-direction: column; gap: 5px;
      box-shadow: 4px 4px 0 rgba(255, 62, 0, 0.5); width: max-content; min-width: auto; max-width: 280px; }
    .popover-menu button { text-align: left; border: none; background: transparent; color: var(--fg); padding: 10px; font-size: 0.9rem; letter-spacing: normal; white-space: nowrap; }
    .popover-menu button:hover { background: var(--accent); color: #000; }
    .popover-title { font-size: 0.7rem; color: #666; padding: 5px; border-bottom: 1px solid #333; margin-bottom: 2px; }
    /* 窄屏：popover 允许换行，避免按钮文字被裁剪 */
    @media (max-width: 480px) {
      .popover-menu { max-width: calc(100vw - 24px); box-shadow: 2px 2px 0 rgba(255, 62, 0, 0.5); }
      .popover-menu button { white-space: normal; padding: 8px 10px; font-size: 0.85rem; }
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes slideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }

    .hidden { display: none !important; }
    .row { display: flex; gap: 10px; }
    .flex-1 { flex: 1; }
    .switch-label { display: flex; align-items: center; gap: 10px; color: var(--crt); cursor: pointer; margin-bottom: 15px; }
    .switch-box { width: 16px; height: 16px; border: 1px solid var(--crt); display: inline-block; position: relative; }
    .switch-box.checked::after { content: ''; position: absolute; top: 2px; left: 2px; right: 2px; bottom: 2px; background: var(--crt); }

    .modal-section { margin-top: 10px; }
    .modal-row { margin-bottom: 10px; }
    .modal-row .fake-input { margin-bottom: 0; }
    .modal-row .detail-value.editable { margin-bottom: 0; }
    .modal-subtask-row { margin-bottom: 10px; align-items: stretch; }
    .modal-subtask-row input { margin-bottom: 0; }
    .modal-subtask-row button { margin: 0; }
    .fake-input .arrow { font-size: 0.8rem; }
    .fake-input .arrow-r { font-size: 0.8rem; margin-right: 8px; }

    /* 子任务 +/- 图标按钮：方形、粗号、与同行输入框等高（依赖 flex stretch） */
    .subtask-icon-btn {
      width: 38px; flex-shrink: 0; padding: 0;
      font-size: 1.25rem; font-weight: 900; line-height: 1;
      display: flex; align-items: center; justify-content: center;
      text-transform: none;
    }
    .subtask-icon-btn.danger { color: var(--accent); border-color: var(--accent); }
    .subtask-icon-btn.danger:hover { background: var(--accent); color: #000; }
    .subtask-edit-item .subtask-icon-btn { width: 30px; height: 28px; font-size: 1.1rem; }

    .subtask-view-item {
      display: flex; align-items: center; background: rgba(255,255,255,0.05);
      margin-bottom: 5px; padding: 10px; cursor: pointer; transition: 0.2s;
      border-left: 3px solid var(--fg); border-radius: 2px;
    }
    .subtask-view-item:active { transform: scale(0.98); }
    .subtask-view-item.done { opacity: 0.5; filter: grayscale(80%); border-left-color: #444; }
    .subtask-view-item.done .item-title { text-decoration: line-through; }
    .subtask-view-item .checkbox { width: 16px; height: 16px; margin-right: 12px; }
    .subtask-view-item.done .checkbox { background: #222; border-color: #555; position: relative; }
    .subtask-view-item.done .checkbox::after { content: '✓'; color: #666; position: absolute; left: 1px; top: -3px; font-size: 14px; font-weight: bold; }

    .subtask-edit-item {
      display: flex; align-items: center; gap: 10px; margin-bottom: 5px;
      background: var(--panel); padding: 8px; border: 1px solid #333; border-radius: 2px;
    }

    .search-card {
      background: var(--panel); border: 1px dashed var(--fg); padding: 12px;
      border-radius: 4px; display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; min-height: 50px;
    }
    .search-term-checkbox {
      width: 14px; height: 14px; border: 1px solid var(--fg); margin-right: 5px;
      cursor: pointer; position: relative; flex-shrink: 0;
    }
    .search-term-tag {
      background: #222; border: 1px solid #444; color: var(--crt);
      padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 5px;
      font-size: 0.85rem; transition: 0.2s; word-break: break-all;
    }
    .search-term-tag button {
      padding: 0; border: none; width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.9rem; color: var(--fg); background: transparent; flex-shrink: 0;
    }
    .search-term-tag button:hover { color: var(--accent); }
    .search-term-tag.done { opacity: 0.5; filter: grayscale(80%); border-color: #444; }
    .search-term-tag.done span { text-decoration: line-through; }
    .search-term-tag.done .search-term-checkbox { background: #222; border-color: #555; }
    .search-term-tag.done .search-term-checkbox::after { content: '✓'; position: absolute; left: 1px; top: -3px; font-size: 12px; color: #666; font-weight: bold; }

    .setting-item { display: flex; align-items: center; justify-content: space-between; background: var(--panel); padding: 10px; border: 1px solid #333; margin-bottom: 5px; border-radius: 4px; }
    .setting-item span { font-size: 0.9rem; color: var(--fg); }

    .settings-card { margin-bottom: 20px; background: var(--panel); padding: 15px; border: 1px dashed var(--fg); border-radius: 4px; }
    .settings-card.danger { border: 1px solid var(--accent); }
    .settings-text { font-size: 0.85rem; line-height: 1.6; color: #888; margin-bottom: 0; }
    .settings-text strong { color: var(--crt); }
    
    .md-code { background: #222; padding: 2px 4px; border-radius: 2px; color: var(--crt); font-family: var(--font-main); }
    .md-ul { padding-left: 20px; margin: 5px 0; }
    del { opacity: 0.6; }

    .stats-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
    .stats-row-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .chart-container { background: var(--panel); border: 1px dashed var(--fg); padding: 15px; border-radius: 4px; position: relative; }
    .chart-container-bar { height: 250px; }
    .chart-container-pie { height: 200px; display: flex; justify-content: center; align-items: center; }

    /* === 统计页：时间范围 tabs / 图表标题 / 热力图 / 分类排行 === */
    .stats-range-tabs {
      display: flex; gap: 0; margin-bottom: 15px;
      border: 1px solid var(--fg); overflow: hidden; border-radius: 0;
    }
    .stats-range-tab {
      flex: 1; padding: 7px 6px; font-size: 0.8rem; border: none !important;
      background: transparent !important; color: var(--fg) !important; cursor: pointer;
      letter-spacing: 0.5px; box-shadow: none !important; border-radius: 0 !important;
    }
    .stats-range-tab.active { background: var(--accent) !important; color: #000 !important; font-weight: bold; }
    .stats-summary-row {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
    }
    .stats-summary-card {
      background: var(--panel); border: 1px solid #333; padding: 10px 6px; text-align: center;
    }
    .stats-summary-value { font-size: 1.15rem; font-weight: bold; color: var(--crt); line-height: 1.2; }
    .stats-summary-label { font-size: 0.65rem; color: #666; margin-top: 3px; letter-spacing: 0.5px; }
    .chart-title {
      font-size: 0.8rem; color: var(--accent); text-transform: uppercase;
      letter-spacing: 1.5px; margin-bottom: 8px; padding-bottom: 4px;
      border-bottom: 1px dashed #444;
    }
    .chart-canvas { width: 100%; height: 100%; min-height: 200px; }
    .chart-container-tall { padding: 15px; }
    .chart-container-tall .chart-canvas { height: 260px; }
    .chart-container-mid { padding: 15px; }
    .chart-container-mid .chart-canvas { height: 220px; }
    .chart-container-tall.hidden-by-range,
    .chart-container-mid.hidden-by-range,
    .chart-container.hidden-by-range { display: none !important; }

    /* GitHub 热力图：calendar 模式需要更大高度 */
    #chart-heatmap { height: 220px; }
    .stats-heatmap-legend {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.7rem; color: #888; margin-top: 6px; justify-content: flex-end;
    }
    .stats-heatmap-legend .swatch {
      width: 10px; height: 10px; display: inline-block; border-radius: 2px;
    }

    /* 分类排行对比卡片:响应式多列 */
    /* 手机竖屏单列;手机横屏/平板 2 列;PC 3 列 */
    .category-rank-list {
      display: grid; grid-template-columns: 1fr; gap: 10px;
    }
    @media (min-width: 600px) {
      .category-rank-list { grid-template-columns: 1fr 1fr; gap: 12px; }
    }
    @media (min-width: 1024px) {
      .category-rank-list { grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
    }
    .category-rank-item {
      display: grid; grid-template-columns: 22px 1fr auto; gap: 10px; align-items: center;
      padding: 8px 6px; border: 1px solid #333; background: rgba(255,255,255,0.02);
    }
    .category-rank-rank { font-size: 0.85rem; font-weight: bold; color: var(--crt); text-align: center; }
    .category-rank-name {
      font-size: 0.85rem; color: var(--fg); display: flex; align-items: center; gap: 6px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .category-rank-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .category-rank-bar-wrap {
      grid-column: 2 / 4; height: 8px; background: #111; position: relative; overflow: hidden;
      border: 1px solid #222; margin-top: 2px;
    }
    .category-rank-bar-total { position: absolute; top: 0; left: 0; height: 100%; background: rgba(255,255,255,0.08); }
    .category-rank-bar-done { position: absolute; top: 0; left: 0; height: 100%; background: var(--crt); opacity: 0.7; }
    .category-rank-count { font-size: 0.75rem; color: #aaa; }
    .category-rank-empty { text-align: center; color: #666; font-size: 0.85rem; padding: 20px; }

    [data-theme="light"] .stats-range-tabs { border: 2px solid #1B1915; border-radius: 0; }
    [data-theme="light"] .stats-range-tab { color: #1B1915 !important; border-radius: 0 !important; }
    [data-theme="light"] .stats-range-tab.active { background: #1B1915 !important; color: #5C960B !important; border-radius: 0 !important; }
    [data-theme="light"] .stats-summary-card { background: #FEFEFE; border: 2px solid #1B1915; box-shadow: 2px 2px 0 #E5E5E5; border-radius: 4px; }
    [data-theme="light"] .stats-summary-value { color: #5C960B; }
    [data-theme="light"] .stats-summary-label { color: #1B1915; font-weight: bold; }
    [data-theme="light"] .chart-title { color: #CE2424; border-bottom-color: #1B1915; }
    [data-theme="light"] .category-rank-item { background: #FEFEFE; border: 2px solid #1B1915; box-shadow: 2px 2px 0 #E5E5E5; border-radius: 4px; }
    [data-theme="light"] .category-rank-bar-wrap { background: #F0F0F0; border-color: #CCC; }
    [data-theme="light"] .category-rank-bar-total { background: rgba(0,0,0,0.08); }
    [data-theme="light"] .category-rank-bar-done { background: #5C960B; }
    [data-theme="light"] .category-rank-rank { color: #5C960B; }
    [data-theme="light"] .category-rank-name { color: #1B1915; }
    [data-theme="light"] .category-rank-count { color: #1B1915; }

    /* 年度报告新增：对比卡片网格 */
    .annual-compare-grid {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;
    }
    .annual-compare-card {
      background: var(--panel); border: 1px solid #333; padding: 12px 10px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .annual-compare-card.winner { border-color: var(--crt); box-shadow: 0 0 0 1px var(--crt) inset; }
    .annual-compare-card-label { font-size: 0.7rem; color: #888; letter-spacing: 1px; text-transform: uppercase; }
    .annual-compare-card-value { font-size: 1.4rem; font-weight: bold; color: var(--crt); }
    .annual-compare-card-sub { font-size: 0.7rem; color: #666; }
    .annual-compare-card-bar { height: 6px; background: #111; position: relative; overflow: hidden; }
    .annual-compare-card-bar-fill { position: absolute; top: 0; left: 0; height: 100%; background: var(--crt); opacity: 0.7; }
    .annual-rank-list { display: flex; flex-direction: column; gap: 6px; }
    .annual-rank-item {
      display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: center;
      padding: 6px 8px; border: 1px solid #2a2a2a; background: rgba(255,255,255,0.02);
    }
    .annual-rank-rank { font-size: 0.8rem; font-weight: bold; color: var(--crt); text-align: center; }
    .annual-rank-name { font-size: 0.8rem; color: var(--fg); }
    .annual-rank-count { font-size: 0.75rem; color: #aaa; }
    .annual-chart-block { background: var(--panel); border: 1px dashed var(--fg); padding: 15px; margin-bottom: 20px; }
    .annual-chart-block .chart-canvas { height: 220px; }
    .annual-chart-title {
      font-size: 0.8rem; color: var(--accent); text-transform: uppercase;
      letter-spacing: 1.5px; margin-bottom: 8px; padding-bottom: 4px;
      border-bottom: 1px dashed #444;
    }
    [data-theme="light"] .annual-compare-card { background: #FEFEFE; border: 2px solid #1B1915; box-shadow: 2px 2px 0 #E5E5E5; border-radius: 4px; }
    [data-theme="light"] .annual-compare-card.winner { border-color: #5C960B; box-shadow: 0 0 0 2px #5C960B inset, 2px 2px 0 #1B1915; }
    [data-theme="light"] .annual-compare-card-label { color: #1B1915; font-weight: bold; }
    [data-theme="light"] .annual-compare-card-value { color: #5C960B; }
    [data-theme="light"] .annual-compare-card-sub { color: #1B1915; }
    [data-theme="light"] .annual-compare-card-bar { background: #F0F0F0; }
    [data-theme="light"] .annual-compare-card-bar-fill { background: #5C960B; }
    [data-theme="light"] .annual-rank-item { background: #FEFEFE; border: 1px solid #1B1915; border-radius: 4px; }
    [data-theme="light"] .annual-rank-rank { color: #5C960B; }
    [data-theme="light"] .annual-rank-name { color: #1B1915; }
    [data-theme="light"] .annual-rank-count { color: #1B1915; }
    [data-theme="light"] .annual-chart-block { background: #FEFEFE; border: 2px dashed #1B1915; border-radius: 4px; }
    [data-theme="light"] .annual-chart-title { color: #CE2424; border-bottom-color: #1B1915; }

    @media (max-width: 600px) {
      /* 统计页 summary: 2 列 */
      .stats-summary-row { grid-template-columns: repeat(2, 1fr); gap: 6px; }
      .stats-summary-card { padding: 8px 4px; }
      .stats-summary-value { font-size: 1rem; }
      .stats-summary-label { font-size: 0.6rem; letter-spacing: 0.3px; }

      /* 时间范围 tabs 更紧凑 */
      .stats-range-tabs { margin-bottom: 10px; }
      .stats-range-tab { padding: 6px 4px; font-size: 0.75rem; letter-spacing: 0; }

      /* 图表容器更紧凑 */
      .chart-container { padding: 10px 8px; }
      .chart-container-tall .chart-canvas { height: 200px; }
      .chart-container-mid .chart-canvas { height: 180px; }
      .chart-title { font-size: 0.72rem; letter-spacing: 1px; margin-bottom: 6px; }

      /* 下方两列布局在窄屏改为单列堆叠 */
      .stats-row-bottom { grid-template-columns: 1fr; gap: 12px; }
      /* 例外:饼图(优先级占比 + 事项完成率)始终并排,饼图结构简单,窄屏也足够 */
      .stats-row-pies { grid-template-columns: 1fr 1fr; gap: 10px; }
      .stats-row-pies .chart-container-mid { padding: 10px 6px; }
      .stats-row-pies .chart-canvas { height: 160px; }

      /* 分类排行卡片更紧凑 */
      .category-rank-item { padding: 6px 4px; gap: 6px; grid-template-columns: 18px 1fr auto; }
      .category-rank-rank { font-size: 0.75rem; }
      .category-rank-name { font-size: 0.78rem; }
      .category-rank-count { font-size: 0.7rem; }
      .category-rank-bar-wrap { height: 6px; }

      /* 年度报告：对比卡片单列 */
      .annual-compare-grid { grid-template-columns: 1fr; gap: 8px; }
      .annual-compare-card { padding: 10px 8px; }
      .annual-compare-card-value { font-size: 1.2rem; }
      .annual-compare-card-label { font-size: 0.65rem; }
      .annual-compare-card-sub { font-size: 0.65rem; }

      /* 年度报告：核心数据卡片 2 列 */
      .annual-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .annual-stat-card { padding: 10px 6px; }
      .annual-stat-value { font-size: 1.25rem; }
      .annual-stat-label { font-size: 0.62rem; letter-spacing: 0.5px; }

      /* 年度报告：图表块更紧凑 */
      .annual-chart-block { padding: 10px 8px; margin-bottom: 12px; }
      .annual-chart-block .chart-canvas { height: 180px; }
      .annual-chart-title { font-size: 0.72rem; letter-spacing: 1px; margin-bottom: 6px; }

      /* 年度报告：排行更紧凑 */
      .annual-rank-item { padding: 5px 6px; grid-template-columns: 18px 1fr auto; gap: 6px; }
      .annual-rank-rank { font-size: 0.72rem; }
      .annual-rank-name { font-size: 0.72rem; }
      .annual-rank-count { font-size: 0.68rem; }

      /* Hero 区域字号收敛 */
      .annual-ending-title { font-size: 1.4rem; letter-spacing: 2px; }
      .annual-ending-subtitle { font-size: 0.65rem; letter-spacing: 3px; }
      .annual-ending-desc { font-size: 0.82rem; line-height: 1.7; }
      .annual-year-title span { font-size: 1rem; letter-spacing: 2px; }
      .annual-section-title { font-size: 0.72rem; letter-spacing: 1.5px; margin-bottom: 8px; }

      /* 叙事文案更紧凑 */
      .annual-narrative { padding: 14px 12px; font-size: 0.82rem; line-height: 1.75; }

      /* 热力图容器在窄屏减少内边距 */
      #chart-heatmap { height: 180px; }
    }

    @media (max-width: 380px) {
      /* 极窄屏（小手机）：进一步收敛 */
      .stats-range-tab { padding: 5px 2px; font-size: 0.7rem; }
      .stats-summary-value { font-size: 0.9rem; }
      .chart-container-tall .chart-canvas { height: 180px; }
      .chart-container-mid .chart-canvas { height: 160px; }
      .annual-chart-block .chart-canvas { height: 160px; }
      .annual-ending-title { font-size: 1.2rem; }
    }

    /* =========================================
       ISOLATED THEME: LIGHT CASSETTE FUTURISM
       ========================================= */[data-theme="light"] body { background-color: #F0EEE2; color: #1B1915; }[data-theme="light"] .scanlines { display: none !important; }[data-theme="light"] .theme-toggle-btn {
      background: #E5E5E5; color: #1B1915; border: 2px solid #1B1915;
      box-shadow: 2px 2px 0 #1B1915; font-weight: 900; border-radius: 4px;
    }[data-theme="light"] .theme-toggle-btn:hover { background: #1B1915; color: #F0EEE2; }[data-theme="light"] h1 { border-bottom: 4px solid #1B1915; color: #1B1915; }[data-theme="light"] h1 span {
      background: #1B1915; color: #E1AC07; padding: 0 8px;
      border-radius: 4px; border: 2px solid #1B1915; font-family: sans-serif;
    }[data-theme="light"] button {
      background: #F0F0F0; color: #1B1915; border: 2px solid #1B1915;
      box-shadow: 2px 2px 0 #1B1915; border-radius: 4px; font-weight: bold;
    }[data-theme="light"] button:active {
      transform: translate(2px, 2px); box-shadow: 0 0 0 #1B1915; background: #E5E5E5;
    }[data-theme="light"] .btn-primary { background: #CE2424; color: #FEFEFE; }[data-theme="light"] .btn-primary:active { background: #1B1915; color: #CE2424; }[data-theme="light"] .btn-danger { background: #FEFEFE; color: #CE2424; border: 2px solid #CE2424; box-shadow: 2px 2px 0 #CE2424; }[data-theme="light"] .btn-ghost { background: transparent; border: 2px dashed #E5E5E5; box-shadow: none; color: #1B1915; }[data-theme="light"] input,[data-theme="light"] textarea,[data-theme="light"] select,[data-theme="light"] .fake-input {
      background: #FEFEFE; color: #1B1915; border: 2px solid #1B1915;
      box-shadow: inset 2px 2px 0 #E5E5E5; border-radius: 4px;
    }[data-theme="light"] input:focus,[data-theme="light"] textarea:focus,[data-theme="light"] select:focus {
      border-color: #5C960B; box-shadow: inset 2px 2px 0 #E5E5E5, 0 0 0 3px rgba(92,150,11,0.3);
    }[data-theme="light"] .date-bar {
      background: #F0F0F0; border: 2px solid #1B1915;
      border-radius: 6px; box-shadow: 4px 4px 0 #1B1915; padding: 12px;
    }[data-theme="light"] .date-display .main {
      background: #1B1915; color: #5C960B; padding: 4px 12px;
      border-radius: 4px; border: 2px inset #E5E5E5; font-family: 'Courier New', monospace;
      text-shadow: 0 0 4px rgba(92,150,11,0.4); box-shadow: inset 0 0 10px #1B1915;
    }[data-theme="light"] .date-display .sub { color: #1B1915; font-weight: bold; margin-top: 5px; }[data-theme="light"] .toolbar button { background: #FEFEFE; color: #1B1915; border: 2px solid #1B1915; box-shadow: 2px 2px 0 #E5E5E5; }[data-theme="light"] .todo-item {
      background: #FEFEFE; border: 2px solid #1B1915;
      box-shadow: 4px 4px 0 #E5E5E5; border-left: 8px solid #1B1915; border-radius: 6px;
    }[data-theme="light"] .todo-item.done {
      background: #EAEAEA; border-color: #CCC; border-left-color: #AAA;
      box-shadow: 2px 2px 0 #CCC; opacity: 0.55; filter: grayscale(80%);
    }[data-theme="light"] .todo-item.done .item-title { color: #888; text-decoration: line-through 2px #AAA; }[data-theme="light"] .todo-item.done .checkbox { background: #DDD; border-color: #AAA; box-shadow: none; }[data-theme="light"] .todo-item.done .checkbox::after { color: #888; }[data-theme="light"] .checkbox {
      background: #FEFEFE; border: 2px solid #1B1915;
      box-shadow: inset 2px 2px 0 #E5E5E5; border-radius: 4px;
    }[data-theme="light"] .todo-item.pri-high .checkbox { border-color: #CE2424; }
    [data-theme="light"] .todo-item.pri-med .checkbox { border-color: #E1AC07; }[data-theme="light"] .todo-item .checkbox.batch-selected { background: #5C960B !important; border-color: #1B1915 !important; box-shadow: none !important; }[data-theme="light"] .todo-item .checkbox.batch-selected::after { color: #FEFEFE !important; }[data-theme="light"] .item-info { color: #1B1915; font-weight: bold; }[data-theme="light"] .badge-high { background: #CE2424; color: #FEFEFE; border: 1px solid #1B1915; }[data-theme="light"] .badge-med { background: #E1AC07; color: #1B1915; border: 1px solid #1B1915; }[data-theme="light"] .badge-low { background: #E5E5E5; color: #1B1915; border: 1px solid #1B1915; }[data-theme="light"] .badge-time { background: #1B1915; color: #5C960B; border: 1px solid #1B1915; }[data-theme="light"] .badge-overdue { background: #CE2424; color: #FEFEFE; border: 1px solid #1B1915; }[data-theme="light"] .badge-warning { background: #E1AC07; color: #1B1915; border: 1px solid #1B1915; }[data-theme="light"] .badge-category { color: #1B1915; border-color: #1B1915; }[data-theme="light"] .badge-category-icon { background: var(--cat-color-default); }[data-theme="light"] .category-new-input { background: #FEFEFE; border-color: #1B1915; color: #1B1915; }[data-theme="light"] .category-modal-item { color: #1B1915; border-color: #1B1915; }[data-theme="light"] .category-modal-item:hover { background: #1B1915; color: #FEFEFE; border-color: #1B1915; }[data-theme="light"] .category-modal-item.selected { background: #1B1915; color: #5C960B; border-color: #1B1915; }[data-theme="light"] .category-modal-divider { border-top-color: #1B1915; }[data-theme="light"] .category-color-circle.selected { border-color: #1B1915; box-shadow: 0 0 6px rgba(27,25,21,0.3); }[data-theme="light"] .category-color-custom { border-color: #888; }[data-theme="light"] .category-color-custom.selected { border-color: #1B1915; box-shadow: 0 0 6px rgba(27,25,21,0.3); }[data-theme="light"] .cat-highlight { color: #CE2424; }[data-theme="light"] #category-toggle-btn,[data-theme="light"] #category-toggle-btn-2 { border-color: #1B1915 !important; color: #1B1915 !important; }[data-theme="light"] .btn-link {
      background: #E5E5E5; color: #1B1915; border: 2px solid #1B1915;
      box-shadow: 2px 2px 0 #1B1915; border-radius: 4px;
    }[data-theme="light"] .btn-link:hover { background: #1B1915; color: #F0EEE2; }
    [data-theme="light"] .timer-elapsed-large { color: #CE2424; }
    [data-theme="light"] .batch-bar {
      border: 3px solid #1B1915; box-shadow: 6px 6px 0 #1B1915; background: #F0F0F0; border-top: 3px solid #1B1915;
    }[data-theme="light"] .fab {
      background: #CE2424; color: #FEFEFE; border: 4px solid #1B1915;
      box-shadow: 4px 4px 0 #1B1915; border-radius: 50%;
    }[data-theme="light"] .modal-overlay { background: rgba(27, 25, 21, 0.85); }[data-theme="light"] .modal-content {
      background: #F0F0F0; border: 4px solid #1B1915;
      box-shadow: 8px 8px 0 #1B1915; border-radius: 8px;
    }[data-theme="light"] .modal-content h3 { color: #1B1915; border-bottom: 2px solid #1B1915; }[data-theme="light"] .detail-overlay { background: #F0EEE2; }[data-theme="light"] .detail-header { border-bottom: 2px solid #1B1915; }[data-theme="light"] .detail-header span { background: #1B1915; color: #FEFEFE; padding: 4px 8px; border-radius: 4px; }[data-theme="light"] .detail-label { color: #1B1915; font-weight: bold; }[data-theme="light"] .detail-value {
      border-left: 4px solid #1B1915; background: #FEFEFE; padding: 10px;
      border-radius: 0 4px 4px 0; color: #1B1915; box-shadow: 2px 2px 0 #E5E5E5;
    }[data-theme="light"] .detail-value.editable { border-left: 4px solid #CE2424; box-shadow: inset 2px 2px 0 #E5E5E5; }[data-theme="light"] .detail-value a { color: #CE2424; border-bottom-color: #CE2424; }[data-theme="light"] .popover-menu {
      background: #FEFEFE; border: 3px solid #1B1915;
      box-shadow: 6px 6px 0 #1B1915; border-radius: 4px;
    }[data-theme="light"] .popover-menu button { color: #1B1915; border-bottom: 2px solid #F0F0F0; border-radius: 0; box-shadow: none; }[data-theme="light"] .popover-menu button:hover { background: #1B1915; color: #FEFEFE; }[data-theme="light"] .popover-title { color: #1B1915; font-weight: bold; border-bottom: 2px solid #1B1915; }[data-theme="light"] .calendar-header { color: #1B1915; border-bottom: 2px solid #1B1915; padding-bottom: 10px; }[data-theme="light"] .cal-day-name { color: #1B1915; font-weight: bold; }[data-theme="light"] .cal-date { color: #1B1915; border: 2px solid transparent; border-radius: 4px; }[data-theme="light"] .cal-date:hover { border-color: #1B1915; background: #E5E5E5; }[data-theme="light"] .cal-date.today { border-color: #CE2424; color: #CE2424; }[data-theme="light"] .cal-date.selected { background: #1B1915; color: #5C960B; box-shadow: 2px 2px 0 #5C960B; }[data-theme="light"] .time-col { border: 2px solid #1B1915; background: #FEFEFE; border-radius: 4px; }[data-theme="light"] .time-cell { color: #1B1915; }[data-theme="light"] .time-cell.active { background: #1B1915; color: #5C960B; }[data-theme="light"] .time-label { color: #1B1915; font-weight: bold; }[data-theme="light"] .switch-label { color: #1B1915; font-weight: bold; }[data-theme="light"] .switch-box { border: 2px solid #1B1915; background: #FEFEFE; border-radius: 3px; }[data-theme="light"] .switch-box.checked::after { background: #CE2424; border-radius: 1px; }[data-theme="light"] .subtask-view-item {
      background: rgba(0,0,0,0.03); border-left: 4px solid #1B1915; box-shadow: 2px 2px 0 #E5E5E5;
    }[data-theme="light"] .subtask-view-item.done { border-left-color: #AAA; }[data-theme="light"] .subtask-view-item.done .checkbox { background: #DDD; border-color: #AAA; box-shadow: none; }[data-theme="light"] .subtask-view-item.done .checkbox::after { color: #888; }[data-theme="light"] .subtask-edit-item {
      background: #FEFEFE; border: 2px solid #1B1915; box-shadow: 2px 2px 0 #E5E5E5;
    }[data-theme="light"] .search-card {
      background: #F0F0F0; border: 2px dashed #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5;
    }[data-theme="light"] .search-term-tag {
      background: #FEFEFE; border: 2px solid #1B1915; color: #1B1915; box-shadow: 2px 2px 0 #E5E5E5;
    }[data-theme="light"] .search-term-tag button { color: #1B1915; }[data-theme="light"] .search-term-tag button:hover { color: #CE2424; }[data-theme="light"] .search-term-tag.done { border-color: #AAA; background: #EAEAEA; }[data-theme="light"] .search-term-tag.done .search-term-checkbox { background: #DDD; border-color: #AAA; box-shadow: none; }[data-theme="light"] .search-term-tag.done .search-term-checkbox::after { color: #888; }
    [data-theme="light"] .setting-item { background: #FEFEFE; border-color: #1B1915; box-shadow: 2px 2px 0 #E5E5E5; }
    [data-theme="light"] .setting-item span { color: #1B1915; font-weight: bold; }
    [data-theme="light"] .settings-card { background: #F0F0F0; border: 2px dashed #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5; }[data-theme="light"] .settings-card.danger { border: 2px solid #CE2424; box-shadow: 4px 4px 0 #CE2424; background: #FEFEFE; }
    [data-theme="light"] .settings-text { color: #1B1915; font-weight: bold; }
    [data-theme="light"] .settings-text strong,
    [data-theme="light"] .apikey-status { color: #5C960B; }
    [data-theme="light"] .md-code { background: #E5E5E5; color: #5C960B; border: 1px solid #1B1915; }
    [data-theme="light"] .chart-container { background: #F0F0F0; border: 2px dashed #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5; }
    
    /* === 年度报告样式 === */
    .stats-tabs { display: flex; gap: 0; border: 1px solid var(--fg); overflow: hidden; }
    .stats-tab {
      padding: 5px 14px; font-size: 0.8rem; border: none !important;
      background: transparent !important; color: var(--fg) !important; cursor: pointer;
      text-transform: uppercase; letter-spacing: 0.5px; box-shadow: none !important;
    }
    .stats-tab.active { background: var(--accent) !important; color: #000 !important; font-weight: bold; }

    .annual-year-title {
      text-align: center; margin-bottom: 25px; padding: 12px 0;
      border-bottom: 1px dashed #333;
    }
    .annual-year-title span {
      font-size: 1.2rem; font-weight: bold; color: var(--crt); letter-spacing: 4px;
    }

    .annual-hero {
      text-align: center; padding: 30px 15px; margin-bottom: 25px;
      border: 2px solid var(--accent); background: var(--panel); position: relative; overflow: hidden;
    }
    .annual-hero::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, var(--accent), var(--warn), var(--crt));
    }
    .annual-ending-title {
      font-size: 1.8rem; font-weight: bold; color: var(--accent);
      margin-bottom: 8px; letter-spacing: 3px; text-transform: uppercase;
    }
    .annual-ending-subtitle {
      font-size: 0.75rem; color: #666; margin-bottom: 15px; letter-spacing: 4px;
    }
    .annual-ending-desc {
      font-size: 0.9rem; color: var(--fg); line-height: 1.8;
      border-top: 1px dashed #444; padding-top: 15px; text-align: left;
    }

    .annual-stats-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 25px;
    }
    .annual-stat-card {
      background: var(--panel); border: 1px solid #333; padding: 14px 10px; text-align: center;
    }
    .annual-stat-value { font-size: 1.6rem; font-weight: bold; color: var(--crt); }
    .annual-stat-label { font-size: 0.7rem; color: #666; text-transform: uppercase; margin-top: 4px; letter-spacing: 1px; }

    .annual-section-title {
      font-size: 0.8rem; color: var(--accent); text-transform: uppercase;
      letter-spacing: 2px; margin-bottom: 12px; padding-bottom: 5px;
      border-bottom: 1px dashed #444;
    }

    .annual-month-chart { margin-bottom: 25px; }
    .annual-month-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
    .annual-month-label { font-size: 0.7rem; color: #999; width: 30px; text-align: right; flex-shrink: 0; }
    .annual-month-bar-bg {
      flex: 1; height: 18px; background: #111; position: relative; overflow: hidden; border: 1px solid #222;
    }
    .annual-month-bar-total { height: 100%; position: absolute; top: 0; left: 0; background: rgba(255,255,255,0.06); }
    .annual-month-bar-done { height: 100%; position: absolute; top: 0; left: 0; background: var(--crt); opacity: 0.65; }
    .annual-month-count { font-size: 0.7rem; color: #aaa; width: 30px; flex-shrink: 0; }

    .annual-narrative {
      background: var(--panel); border: 1px dashed var(--fg); padding: 20px;
      line-height: 1.9; color: var(--fg); font-size: 0.9rem; margin-bottom: 20px;
    }
    .annual-narrative strong { color: var(--crt); }
    .annual-narrative em { color: var(--accent); font-style: normal; }
    .annual-narrative .highlight { color: var(--warn); font-weight: bold; border-bottom: 1px dashed var(--warn); }

    .annual-divider { text-align: center; color: #333; margin: 25px 0; letter-spacing: 5px; font-size: 0.8rem; }

    .annual-pri-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .annual-pri-label { font-size: 0.75rem; color: #999; width: 24px; flex-shrink: 0; text-align: right; }
    .annual-pri-bar-bg { flex: 1; height: 12px; background: #111; position: relative; overflow: hidden; border: 1px solid #222; }
    .annual-pri-bar-fill { height: 100%; position: absolute; top: 0; left: 0; }
    .annual-pri-count { font-size: 0.7rem; color: #aaa; width: 30px; flex-shrink: 0; }
    .annual-report-time { margin-top: 25px; padding-top: 15px; border-top: 1px dashed #333; text-align: center; font-size: 0.75rem; color: #666; line-height: 1.8; }

    /* Light theme 年度报告 */
    [data-theme="light"] .stats-tabs { border: 2px solid #1B1915; border-radius: 4px; }
    [data-theme="light"] .stats-tab { color: #1B1915 !important; border-radius: 0 !important; }
    [data-theme="light"] .stats-tab.active { background: #1B1915 !important; color: #5C960B !important; }
    [data-theme="light"] .annual-hero { background: #FEFEFE; border: 3px solid #1B1915; box-shadow: 6px 6px 0 #1B1915; border-radius: 8px; }
    [data-theme="light"] .annual-ending-title { color: #CE2424; }
    [data-theme="light"] .annual-ending-subtitle { color: #1B1915; }
    [data-theme="light"] .annual-ending-desc { border-top-color: #1B1915; color: #1B1915; }
    [data-theme="light"] .annual-stat-card { background: #FEFEFE; border: 2px solid #1B1915; box-shadow: 2px 2px 0 #E5E5E5; border-radius: 4px; }
    [data-theme="light"] .annual-stat-value { color: #5C960B; }
    [data-theme="light"] .annual-stat-label { color: #1B1915; font-weight: bold; }
    [data-theme="light"] .annual-section-title { color: #CE2424; border-bottom-color: #1B1915; }
    [data-theme="light"] .annual-month-bar-bg { background: #F0F0F0; border-color: #CCC; }
    [data-theme="light"] .annual-month-bar-total { background: rgba(0,0,0,0.06); }
    [data-theme="light"] .annual-month-bar-done { background: #5C960B; }
    [data-theme="light"] .annual-month-label { color: #1B1915; }
    [data-theme="light"] .annual-month-count { color: #1B1915; }
    [data-theme="light"] .annual-narrative { background: #FEFEFE; border: 2px dashed #1B1915; color: #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5; }
    [data-theme="light"] .annual-narrative strong { color: #5C960B; }
    [data-theme="light"] .annual-narrative em { color: #CE2424; }
    [data-theme="light"] .annual-divider { color: #CCC; }
    [data-theme="light"] .annual-year-title { border-bottom-color: #1B1915; }
    [data-theme="light"] .annual-year-title span { color: #5C960B; text-shadow: 0 0 4px rgba(92,150,11,0.3); }
    [data-theme="light"] .annual-pri-bar-bg { background: #F0F0F0; border-color: #CCC; }
    [data-theme="light"] .annual-pri-label { color: #1B1915; }
    [data-theme="light"] .annual-pri-count { color: #1B1915; }
    [data-theme="light"] .annual-report-time { border-top-color: #1B1915; color: #666; }
    [data-theme="light"] #custom-header-preview,
    [data-theme="light"] #custom-content-preview {
      background: #FEFEFE; color: #1B1915; border: 2px solid #1B1915;
      box-shadow: inset 2px 2px 0 #E5E5E5; border-radius: 4px;
    }

    [data-theme="light"] #preview-notice { background: #E1AC07; color: #1B1915; border-bottom: 2px solid #1B1915; }
    [data-theme="light"] #preview-notice .md-code { background: #1B1915; color: #E1AC07; border: 1px solid #1B1915; }
    
    /* === 缩放大小调整 === */
    .scale-control { width: 100%; }
    .scale-slider-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .scale-slider-row .scale-label-sm { font-size: 0.85rem; color: #666; flex-shrink: 0; font-weight: bold; }
    .scale-slider-row .scale-label-lg { font-size: 1.1rem; color: #666; font-weight: bold; flex-shrink: 0; }
    .scale-slider-row input[type="range"] {
      flex: 1; -webkit-appearance: none; appearance: none;
      height: 6px; background: #222; border-radius: 3px;
      outline: none; margin-bottom: 0; border: none; padding: 0; width: auto;
    }
    .scale-slider-row input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--crt); cursor: pointer;
      border: 2px solid var(--fg);
      box-shadow: 0 0 6px rgba(0,255,65,0.3);
    }
    .scale-slider-row input[type="range"]::-moz-range-thumb {
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--crt); cursor: pointer;
      border: 2px solid var(--fg);
    }
    .scale-slider-row input[type="range"]::-moz-range-track {
      height: 6px; background: #222; border-radius: 3px; border: none;
    }
    .scale-value { 
      font-size: 0.85rem; color: var(--crt); min-width: 44px; text-align: center;
      font-weight: bold; flex-shrink: 0;
    }
    .scale-presets { display: flex; gap: 6px; margin-bottom: 12px; }
    .scale-preset-btn {
      flex: 1; padding: 8px 4px; font-size: 0.8rem;
      text-align: center; cursor: pointer;
      background: #222; border: 1px solid #444; color: var(--fg);
      font-family: var(--font-main); transition: 0.2s;
    }
    .scale-preset-btn.active {
      border-color: var(--crt); color: var(--crt);
      background: rgba(0,255,65,0.08);
    }
    .scale-preset-btn:active { background: var(--crt); color: #000; }
    .scale-preview-wrap {
      border: 1px dashed #444; border-radius: 4px; padding: 10px;
      background: var(--bg);
    }
    .scale-preview-wrap .todo-item { margin-bottom: 5px; pointer-events: none; }

    /* 显示与字体 卡片内分区（小标题分隔，无虚线） */
    .scale-section { margin-bottom: 18px; }
    .scale-section:last-child { margin-bottom: 0; }
    .scale-section-label {
      display: flex; align-items: center; gap: 8px;
      color: #777; font-size: 0.72rem; font-weight: bold;
      text-transform: uppercase; letter-spacing: 0.5px;
      margin-bottom: 10px;
    }
    .scale-section-label .md-code { font-weight: normal; }

    /* Light 主题 - 缩放大小调整 */
    [data-theme="light"] .scale-slider-row input[type="range"] { background: #E5E5E5; }
    [data-theme="light"] .scale-slider-row input[type="range"]::-webkit-slider-thumb {
      background: #5C960B; border-color: #1B1915; box-shadow: 2px 2px 0 #1B1915;
    }
    [data-theme="light"] .scale-slider-row input[type="range"]::-moz-range-thumb {
      background: #5C960B; border-color: #1B1915;
    }
    [data-theme="light"] .scale-slider-row input[type="range"]::-moz-range-track { background: #E5E5E5; }
    [data-theme="light"] .scale-value { color: #5C960B; }
    [data-theme="light"] .scale-preset-btn {
      background: #FEFEFE; border: 2px solid #1B1915; color: #1B1915;
      box-shadow: 2px 2px 0 #E5E5E5; border-radius: 4px; font-weight: bold;
    }
    [data-theme="light"] .scale-preset-btn.active {
      border-color: #5C960B; color: #5C960B; background: rgba(92,150,11,0.08);
      box-shadow: 2px 2px 0 #5C960B;
    }
    [data-theme="light"] .scale-preset-btn:active { background: #5C960B; color: #FEFEFE; }
    [data-theme="light"] .scale-preview-wrap { background: #F0EEE2; border-color: #1B1915; }
    [data-theme="light"] .scale-label-sm,
    [data-theme="light"] .scale-label-lg { color: #1B1915; }
    [data-theme="light"] .scale-section-label { color: #1B1915; }

    /* === 显示大小调整 (display density) === */
    .combined-preview-wrap .todo-item { margin-bottom: 5px; pointer-events: none; }
    #combined-preview { line-height: 1.5; }
    /* 让预览内部元素跟随 #combined-preview 的 font-size 缩放（覆盖 rem 改用 em） */
    #combined-preview .item-title { font-size: 1em; }
    #combined-preview .item-info { font-size: 0.75em; }
    #combined-preview .badge { font-size: 0.7em; }

    [data-theme="light"] .combined-preview-wrap { background: #F0EEE2; border-color: #1B1915; }

    /* === 字体大小调整 (font-size) === */
    /* preview styles shared via combined-preview-wrap above */

    .apikey-create-row { display: flex; gap: 8px; margin-bottom: 12px; align-items: stretch; }
    .apikey-create-row input { flex: 1; margin-bottom: 0; }
    .apikey-create-btn { padding: 8px 14px; white-space: nowrap; }

    .apikey-status { font-size: 0.7rem; margin-left: 6px; color: var(--crt); }
    .apikey-status.disabled { color: var(--accent); }
    [data-theme="light"] .apikey-status.disabled { color: #CE2424; }

    #apikey-created-box { display: none; background: var(--panel); border: 1px solid var(--crt); border-radius: 4px; padding: 12px; margin-bottom: 12px; }
    #apikey-created-box .apikey-created-text { margin: 0 0 8px 0; color: var(--crt); }
    #apikey-created-box .apikey-created-row { display: flex; gap: 8px; align-items: center; }
    #apikey-created-value { flex: 1; word-break: break-all; font-size: 0.8rem; padding: 8px; margin-bottom: 0; cursor: text; }
    #apikey-created-box .apikey-copy-btn { padding: 6px 10px; white-space: nowrap; }

    [data-theme="light"] #apikey-created-box { background: #F0F0F0; border: 2px solid #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5; }
    [data-theme="light"] #apikey-created-box .apikey-created-text { color: #5C960B; }
    [data-theme="light"] #apikey-created-value { background: #FEFEFE; border: 2px solid #1B1915; box-shadow: inset 2px 2px 0 #E5E5E5; color: #1B1915; }

    .session-item { display: flex; align-items: center; background: var(--panel); border: 1px solid #333; margin-bottom: 8px; padding: 10px; border-radius: 4px; gap: 10px; flex-wrap: wrap; }
    .session-item.current-session { border-color: var(--crt); }
    .session-ua { flex: 1; font-size: 0.72rem; color: var(--fg); word-break: break-all; line-height: 1.4; min-width: 0; }
    .session-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .session-actions button { padding: 4px 8px; font-size: 0.75rem; }

    [data-theme="light"] .session-item { background: #FEFEFE; border-color: #1B1915; box-shadow: 2px 2px 0 #E5E5E5; border-radius: 4px; }
    [data-theme="light"] .session-item.current-session { border-color: #5C960B; }
    [data-theme="light"] .session-ua { color: #1B1915; }
    
    body:has(.modal-overlay.active, .detail-overlay.active) { overflow: hidden !important; touch-action: none; }
    .modal-overlay.active,
    .detail-overlay.active { overscroll-behavior: contain; }
    .io-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 120; }
    .io-overlay-high { z-index: 130; }
    .io-dialog { background: #0a0a0a; border: 1px solid #ff3300; padding: 25px 35px; text-align: center; font-family: Courier New, monospace; max-width: 90vw; min-width: 280px; }
    .io-title { font-size: 1.05rem; font-weight: bold; margin-bottom: 8px; color: #fff; }
    .io-sub { font-size: 0.85rem; color: #888; margin-bottom: 10px; }
    .io-sub-block { margin-bottom: 20px; white-space: pre-line; }
    .io-msg { font-size: 0.95rem; font-weight: bold; margin-bottom: 20px; color: #ff3300; white-space: pre-line; }
    .io-bar-bg { height: 4px; background: #222; border: 1px solid #333; }
    .io-bar-fill { height: 100%; width: 0%; background: #ff3300; transition: width 0.3s; }
    .io-btn-row { display: flex; gap: 10px; justify-content: center; }
    .io-btn { padding: 8px 25px; cursor: pointer; font-family: inherit; font-weight: bold; background: transparent; }
    .io-btn-primary { border: 1px solid #ff3300; color: #ff3300; }
    .io-btn-secondary { border: 1px solid #555; color: #888; }
    [data-theme="light"] .io-overlay { background: rgba(27,25,21,0.85); }
    [data-theme="light"] .io-dialog { background: #F0F0F0; border: 4px solid #1B1915; box-shadow: 8px 8px 0 #1B1915; border-radius: 8px; }
    [data-theme="light"] .io-title { color: #1B1915; }
    [data-theme="light"] .io-sub { color: #666; }
    [data-theme="light"] .io-msg { color: #CE2424; }
    [data-theme="light"] .io-bar-bg { height: 8px; background: #E5E5E5; border: 2px solid #1B1915; }
    [data-theme="light"] .io-bar-fill { background: #CE2424; }
    [data-theme="light"] .io-btn-primary { border: 3px solid #1B1915; color: #1B1915; box-shadow: 2px 2px 0 #1B1915; }
    [data-theme="light"] .io-btn-primary:hover { background: #1B1915; color: #FEFEFE; }
    [data-theme="light"] .io-btn-secondary { border: 2px solid #999; color: #666; }
    [data-theme="light"] .io-btn-secondary:hover { background: #E5E5E5; }

    .changelog-entry { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dashed #333; }
    .changelog-entry:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .changelog-version { font-size: 0.9rem; font-weight: bold; color: var(--crt); margin-bottom: 2px; }
    .changelog-date { font-size: 0.7rem; color: #666; margin-bottom: 4px; }
    .changelog-notes { font-size: 0.8rem; color: var(--fg); line-height: 1.5; }
    .changelog-new { border-left: 3px solid var(--accent); padding-left: 10px; border-bottom: none; }
    .changelog-new .changelog-version { color: var(--accent); }
    .changelog-section-title { font-size: 0.7rem; color: #555; text-transform: uppercase; margin: 12px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #333; letter-spacing: 1px; }
    [data-theme="light"] .changelog-entry { border-bottom-color: #1B1915; }
    [data-theme="light"] .changelog-version { color: #5C960B; }
    [data-theme="light"] .changelog-date { color: #666; }
    [data-theme="light"] .changelog-notes { color: #1B1915; }
    [data-theme="light"] .changelog-new { border-left-color: #CE2424; }
    [data-theme="light"] .changelog-new .changelog-version { color: #CE2424; }
    [data-theme="light"] .changelog-section-title { color: #1B1915; border-bottom-color: #1B1915; }
`;
