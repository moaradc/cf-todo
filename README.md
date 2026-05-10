# cf-todo

一个跑在Cloudflare Worker + D1上的待办网页，由AI设计

## 能干什么

- 增删改、标记完成
- 创建子任务拆分步骤，逐个勾掉
- 自动拉取B站/微博/知乎/百度热点共20个，当任务或灵感池用
- 每日重复事项，勾了明天还有
- 回收站防手滑
- 批量操作、筛选排序、导入导出

---

## 环境变量配置

在 Cloudflare Dashboard 中，进入您的 Worker 项目 -> **设置** -> **变量和机密** 中添加以下变量。

| 变量名 | 必填 | 类型 | 说明 |
| :--- | :---: | :--- | :--- |
| `DB` | **是** | D1 数据库绑定 | D1 数据库的绑定名称。Worker 依赖此数据库存储数据 |
| `ADMIN_PASSWORD` | **是** | 文本或秘钥 | 登录密码。连续错误 5 次会锁定该 IP 15 分钟 |
| `JWT_SECRET` | **是** | 文本或秘钥 | 用于签名和验证用户登录态 Token 的密钥。随机字符串即可 |

---

## 配置指南

### 1. 创建 Worker 项目，选择从 Hello world 开始

### 2. 数据库绑定

这是运行该项目的基础，配置步骤：

1. 在 Cloudflare Dashboard 左侧菜单选择 **存储和数据库 > D1 SQL 数据库**，创建一个数据库。
2. 进入您的 Worker 项目，选择 绑定
3. 点击 **添加绑定**，选择 **D1 数据库**。
4. **变量名称** 必须填入：`DB`
5. 选择刚刚创建的 D1 数据库 -> 添加绑定。

### 3. 核心密钥配置

1. 在 Worker 项目的 **设置** -> **变量和机密** 中。
2. 点击 **添加变量**。
3. 类型选文本或秘钥，添加变量名称 `ADMIN_PASSWORD` 和 `JWT_SECRET`。
4. 建议填写强密码/密钥串。

### 4. 前端定制注入

在网站的**设置**中添加。<br>默认**关闭**前端定制注入。需要在网站“设置 -> 前端定制”中启用前端定制注入并点击保存才会生效。

示例 - 美观的半透明主题（双击主界面空白处切换背景图，≥3次下载当前背景图）

<details>
<summary><strong>查看自定义头部代码</strong></summary>

```html
<style>
:root{
  --ycy-panel:rgba(255,255,255,.74);
  --ycy-panel-s:rgba(255,255,255,.88);
  --ycy-panel-w:rgba(255,255,255,.52);
  --ycy-bd:rgba(255,255,255,.45);
  --ycy-bd2:rgba(0,0,0,.06);
  --ycy-sh:0 2px 16px rgba(0,0,0,.05);
  --ycy-sh-lg:0 6px 28px rgba(0,0,0,.09);
  --ycy-r:14px;--ycy-r-s:10px;--ycy-r-xs:6px;
  --ycy-t:#1a1a1a;--ycy-t2:#555;--ycy-t3:#999;
  --ycy-ac:#e8453c;--ycy-ac-l:rgba(232,69,60,.10);
  --ycy-gn:#2d8f5e;--ycy-wn:#d4940a;--ycy-bl:#3a7bd5;
  --bg:transparent;--fg:var(--ycy-t);--accent:var(--ycy-ac);
  --crt:var(--ycy-gn);--warn:var(--ycy-wn);--panel:var(--ycy-panel);
  --font-main: 'Courier New', Courier, monospace;
}
html.bg-dark{
  --ycy-panel:rgba(26,26,26,.68);
  --ycy-panel-s:rgba(36,36,36,.82);
  --ycy-panel-w:rgba(20,20,20,.48);
  --ycy-bd:rgba(255,255,255,.10);
  --ycy-bd2:rgba(255,255,255,.04);
  --ycy-sh:0 2px 16px rgba(0,0,0,.18);
  --ycy-sh-lg:0 6px 28px rgba(0,0,0,.28);
  --ycy-t:#f0f0f0;--ycy-t2:#bbb;--ycy-t3:#777;
  --ycy-ac:#ff6b5e;--ycy-ac-l:rgba(255,107,94,.14);
  --ycy-gn:#4ade80;--ycy-wn:#fbbf24;--ycy-bl:#60a5fa;
}

/* ── bg ── */
#bg-layer-a,#bg-layer-b{
  position:fixed;top:0;left:0;width:100%;height:100%;
  background-size:cover;background-position:center;
  z-index:0;opacity:0;transition:opacity 1.6s ease;pointer-events:none;
}
#bg-layer-a.vis,#bg-layer-b.vis{opacity:1}
#bg-loading{
  position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;
  background:linear-gradient(110deg,#eee 8%,#f7f7f7 18%,#eee 33%);
  background-size:200% 100%;animation:shimmer 1.6s linear infinite;
  transition:opacity .8s ease;
}
html.bg-dark #bg-loading{
  background:linear-gradient(110deg,#1a1a1a 8%,#282828 18%,#1a1a1a 33%);
  background-size:200% 100%;
}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
#bg-vignette{
  position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;
  background:radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,.10) 100%);
}
html.bg-dark #bg-vignette{
  background:radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,.18) 100%);
}

/* ── overlay-open: hide main content ── */
body.overlay-open .container{visibility:hidden!important}
body.overlay-open #batch-bar{visibility:hidden!important}
body.overlay-open .fab{display:none!important}

/* ── global ── */
*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
body{background:transparent!important;color:var(--ycy-t)!important;font-family:var(--font-main)!important;overflow-x:hidden}
body.modal-open{overflow:hidden!important;touch-action:none!important}
.scanlines{display:none!important}
.container{position:relative;z-index:1;max-width:560px}
::selection{background:var(--ycy-ac);color:#fff}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--ycy-t3);border-radius:4px}

/* ── h1 ── */
h1{color:var(--ycy-t)!important;border-bottom:1px solid var(--ycy-bd)!important;font-weight:700!important;font-size:1.3rem!important;letter-spacing:.5px;text-shadow:0 1px 8px rgba(255,255,255,.5)}
html.bg-dark h1{text-shadow:0 1px 8px rgba(0,0,0,.6)}
h1 span{color:var(--ycy-ac)!important}

/* ── buttons ── */
button{background:var(--ycy-panel)!important;color:var(--ycy-t)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-xs)!important;font-family:var(--font-main)!important;transition:all .2s!important;box-shadow:var(--ycy-sh)!important;font-weight:500!important}
button:active{transform:scale(.97)!important;background:var(--ycy-panel-s)!important}
.btn-primary{background:var(--ycy-ac)!important;color:#fff!important;border-color:var(--ycy-ac)!important;box-shadow:0 2px 12px rgba(232,69,60,.25)!important}
.btn-primary:active{opacity:1!important;background:var(--ycy-panel-s)!important;color:var(--ycy-t)!important}
.btn-danger{color:#fff!important;border-color:rgba(232,69,60,.74)!important;background:rgba(232,69,60,.74)!important;box-shadow:none!important}
.btn-danger:hover{background:rgba(232,69,60,.68)!important;border-color:rgba(232,69,60,.68)!important}
.btn-ghost{background:transparent!important;border:1px dashed var(--ycy-t3)!important;color:var(--ycy-t2)!important;box-shadow:none!important}
.btn-ghost:hover{color:var(--ycy-t)!important;border-color:var(--ycy-t2)!important}
.theme-toggle-btn{background:var(--ycy-panel)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-xs)!important;box-shadow:var(--ycy-sh)!important;text-shadow:0 1px 6px rgba(255,255,255,.4)}
html.bg-dark .theme-toggle-btn{text-shadow:0 1px 6px rgba(0,0,0,.5)}

/* ── inputs ── */
input,textarea,select{background:var(--ycy-panel-s)!important;color:var(--ycy-t)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-xs)!important;font-family:var(--font-main)!important;box-shadow:var(--ycy-sh)!important;transition:border-color .2s,box-shadow .2s!important}
input:focus,textarea:focus,select:focus{border-color:var(--ycy-ac)!important;box-shadow:0 0 0 3px var(--ycy-ac-l)!important;outline:none!important}
input::placeholder,textarea::placeholder{color:var(--ycy-t3)!important}

/* ── fake-input ── */
.fake-input{background:var(--ycy-panel)!important;color:var(--ycy-t)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-xs)!important;box-shadow:var(--ycy-sh)!important}

/* ── date-bar ── */
.date-bar{background:rgba(255,255,255,.55)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r)!important;box-shadow:var(--ycy-sh-lg)!important}
html.bg-dark .date-bar{background:rgba(26,26,26,.52)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r)!important;box-shadow:var(--ycy-sh-lg)!important}

/* ── toolbar ── */
.toolbar button{background:rgba(255,255,255,.55)!important;color:var(--ycy-t2)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-xs)!important;box-shadow:none!important;font-size:.72rem!important}
html.bg-dark .toolbar button{background:rgba(26,26,26,.52)!important}
.toolbar button:hover{background:rgba(255,255,255,.68)!important}
html.bg-dark .toolbar button:hover{background:rgba(36,36,36,.65)!important}
.toolbar button.active{color:var(--ycy-ac)!important;border-color:var(--ycy-ac)!important;background:var(--ycy-ac-l)!important}

/* ── todo-item ── */
.todo-item{background:rgba(255,255,255,.55)!important;border:1px solid var(--ycy-bd)!important;border-left:4px solid var(--ycy-t3)!important;border-radius:var(--ycy-r-s)!important;box-shadow:var(--ycy-sh)!important;transition:all .25s!important}
html.bg-dark .todo-item{background:rgba(26,26,26,.52)!important}
.todo-item:hover{background:rgba(255,255,255,.68)!important;box-shadow:var(--ycy-sh-lg)!important}
html.bg-dark .todo-item:hover{background:rgba(36,36,36,.65)!important}
.todo-item.done{opacity:.4!important;filter:grayscale(60%)!important}
.todo-item.done .item-title{text-decoration:line-through!important;color:var(--ycy-t3)!important}

/* ── checkbox ── */
.checkbox{background:transparent!important;border:2px solid var(--ycy-t3)!important;border-radius:4px!important;box-shadow:none!important;transition:all .2s!important}
.todo-item.done .checkbox{background:var(--ycy-panel-w)!important;border-color:var(--ycy-t3)!important;position:relative!important}
.todo-item.done .checkbox::after{content:'✓'!important;color:var(--ycy-t3)!important;position:absolute!important;left:2px!important;top:-2px!important;font-size:15px!important;font-weight:700!important;background:none!important}
.todo-item .checkbox.batch-selected{background:var(--ycy-ac)!important;border-color:var(--ycy-ac)!important}
.todo-item .checkbox.batch-selected::after{color:#fff!important}

/* ── badges ── */
.badge{border-radius:4px!important;font-weight:600!important;padding:1px 6px!important;font-size:.68rem!important}
.badge-high{background:var(--ycy-ac)!important;color:#fff!important;border:none!important}
.badge-med{background:var(--ycy-wn)!important;color:#fff!important;border:none!important}
.badge-low{background:var(--ycy-t3)!important;color:#fff!important;border:none!important}
.badge-time{background:var(--ycy-panel-s)!important;color:var(--ycy-bl)!important;border:1px solid var(--ycy-bd)!important}

/* ── btn-link ── */
.btn-link{background:var(--ycy-panel)!important;color:var(--ycy-t2)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-xs)!important;box-shadow:none!important}
.btn-link:hover{background:var(--ycy-panel-s)!important;color:var(--ycy-ac)!important}

/* ── fab ── */
.fab{background:var(--ycy-ac)!important;color:#fff!important;border:none!important;border-radius:50%!important;box-shadow:0 4px 20px rgba(232,69,60,.35)!important;transition:transform .2s,box-shadow .2s!important}
.fab:active{transform:scale(.9)!important;box-shadow:0 2px 10px rgba(232,69,60,.25)!important}

/* ── batch-bar ── */
.batch-bar{background:var(--ycy-panel-s)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r)!important;box-shadow:var(--ycy-sh-lg)!important}
.batch-bar button{border:none!important;box-shadow:none!important;border-radius:var(--ycy-r-xs)!important}

/*  ── MODAL - ADD (bottom sheet)  ── */
#modal-add.modal-overlay{align-items:flex-end!important;background:rgba(0,0,0,.22)!important}
@keyframes overlayFadeIn{from{opacity:0}to{opacity:1}}
@keyframes overlayFadeOut{from{opacity:1}to{opacity:0}}
#modal-add.modal-overlay.active{animation:overlayFadeIn .3s ease both!important}
#modal-add.modal-overlay.active.closing-overlay{animation:overlayFadeOut .3s ease forwards!important;pointer-events:none!important}
#modal-add .modal-content{position:fixed!important;bottom:0!important;left:0!important;right:0!important;top:auto!important;max-width:100%!important;width:100%!important;max-height:88vh!important;border-radius:20px 20px 0 0!important;box-shadow:0 -4px 40px rgba(0,0,0,.10)!important;animation:sheetUpSmooth .38s cubic-bezier(.22,.9,.36,1) both!important;padding:0 20px 24px!important;overflow-y:auto!important;background:var(--ycy-panel-s)!important;border:1px solid var(--ycy-bd)!important;color:var(--ycy-t)!important;overscroll-behavior:contain!important;will-change:transform!important;backface-visibility:hidden!important}

/* ── >> 新建事项 手柄 ── */
#modal-add .modal-content.ycy-sheet-ready{overflow-y:hidden!important;padding:0!important;display:flex!important;flex-direction:column!important}
.ycy-drag-handle{flex-shrink:0;padding:12px 0;text-align:center;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;border-radius:20px 20px 0 0}
.ycy-drag-handle::after{content:'';display:inline-block;width:36px;height:4px;background:var(--ycy-t3);border-radius:2px;opacity:.35;transition:opacity .2s,width .2s}
.ycy-drag-handle:hover::after,
.ycy-drag-handle.ycy-dragging::after{opacity:.55;width:52px}
.ycy-drag-handle.ycy-dragging{cursor:grabbing}
.ycy-sheet-body{overflow-y:auto;flex:1;padding:0 20px 24px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}

@keyframes sheetUpSmooth{from{transform:translate3d(0,100%,0)}to{transform:translate3d(0,0,0)}}
@keyframes sheetDown{from{transform:translate3d(0,0,0);opacity:1}to{transform:translate3d(0,100%,0);opacity:0}}
#modal-add .modal-content.closing{animation:sheetDown .3s cubic-bezier(.4,0,.2,1) forwards!important;pointer-events:none!important}

/* ── 桌面版：添加模态框 → 居中对话框 ── */
@media (min-width: 1024px){#modal-add.modal-overlay {align-items: center !important;justify-content: center !important}
#modal-add .modal-content{position: relative !important;bottom: auto !important;left: auto !important;right: auto !important;width: 520px !important;max-width: calc(100vw - 48px) !important;max-height: 84vh !important;border-radius: var(--ycy-r) !important;box-shadow: 0 16px 56px rgba(0,0,0,.12), 0 0 0 1px var(--ycy-bd) !important;animation: ycyDeskIn .32s cubic-bezier(.22,.9,.36,1) both !important}
html.bg-dark #modal-add .modal-content{box-shadow: 0 16px 56px rgba(0,0,0,.32), 0 0 0 1px var(--ycy-bd) !important}
#modal-add .modal-content.closing{animation: ycyDeskOut .22s ease forwards !important}
.ycy-drag-handle{display: none !important;}
#modal-add .modal-content.ycy-sheet-ready{padding: 0 !important;display: flex !important;flex-direction: column !important;overflow: hidden !important}
#modal-add .modal-content.ycy-sheet-ready .ycy-sheet-body{padding: 12px 28px 28px !important}
#modal-add .modal-content:not(.ycy-sheet-ready){padding: 28px !important}}

/* ── CALENDAR & TIME MODALS ── */
#modal-calendar.modal-overlay,
#modal-time.modal-overlay{background:rgba(0,0,0,.22)!important}
.modal-content{background:var(--ycy-panel-s)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r)!important;box-shadow:var(--ycy-sh-lg)!important;color:var(--ycy-t)!important}
.modal-content h3{color:var(--ycy-t)!important;border-bottom:1px solid var(--ycy-bd2)!important;padding-bottom:8px!important}

/* ── FULL-SCREEN OVERLAYS ── */
.detail-overlay{background:transparent!important;z-index:300!important}
.detail-header{border-bottom:1px solid var(--ycy-bd2)!important}
.detail-header span{color:var(--ycy-t)!important;background:none!important;padding:0!important;border-radius:0!important}
.detail-label{color:var(--ycy-t3)!important;font-size:.75rem!important;text-transform:uppercase!important;letter-spacing:.5px!important;margin-top:18px!important}
.detail-value{color:var(--ycy-t)!important;border-left:3px solid var(--ycy-ac)!important;background:var(--ycy-panel)!important;border-radius:0 var(--ycy-r-xs) var(--ycy-r-xs) 0!important;box-shadow:var(--ycy-sh)!important;padding:12px 14px!important}
.detail-value.editable{border-left-color:var(--ycy-ac)!important;box-shadow:0 0 0 3px var(--ycy-ac-l)!important;background:var(--ycy-panel-s)!important}
.detail-value a{color:var(--ycy-ac)!important;border-bottom:1px dashed var(--ycy-ac)!important}

/* ── popover ── */
.popover-menu{background:var(--ycy-panel-s)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-s)!important;box-shadow:var(--ycy-sh-lg)!important;animation:popIn .18s ease!important}
@keyframes popIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
.popover-menu button{color:var(--ycy-t)!important;border:none!important;background:transparent!important;box-shadow:none!important;border-radius:var(--ycy-r-xs)!important}
.popover-menu button:hover{background:var(--ycy-ac-l)!important;color:var(--ycy-ac)!important}
.popover-title{color:var(--ycy-t3)!important;border-bottom:1px solid var(--ycy-bd2)!important}

/* ── calendar ── */
.calendar-header{color:var(--ycy-t)!important;border-bottom:1px solid var(--ycy-bd2)!important;padding-bottom:10px!important}
.cal-day-name{color:var(--ycy-t3)!important;font-weight:600!important}
.cal-date{color:var(--ycy-t)!important;border:2px solid transparent!important;border-radius:8px!important;transition:all .15s!important}
.cal-date:hover{border-color:var(--ycy-ac)!important;background:var(--ycy-ac-l)!important}
.cal-date.today{color:var(--ycy-ac)!important;border-color:var(--ycy-ac)!important}
.cal-date.selected{background:var(--ycy-ac)!important;color:#fff!important;border-color:var(--ycy-ac)!important;box-shadow:none!important;font-weight:700!important}

/* ── time ── */
.time-col{border:1px solid var(--ycy-bd)!important;background:var(--ycy-panel)!important;border-radius:var(--ycy-r-s)!important}
.time-cell{color:var(--ycy-t2)!important}
.time-cell.active{background:var(--ycy-ac)!important;color:#fff!important}
.time-label{color:var(--ycy-ac)!important;font-weight:600!important}

/* ── switch ── */
.switch-label{color:var(--ycy-t)!important;cursor:pointer!important}
.switch-box{width:16px;height:16px;border:2px solid var(--ycy-t3)!important;border-radius:4px!important;background:transparent!important;position:relative!important;box-shadow:none!important}
.switch-box.checked::after{content:''!important;position:absolute!important;top:2px!important;left:2px!important;right:2px!important;bottom:2px!important;background:var(--ycy-ac)!important;border-radius:1px!important;box-shadow:none!important}

/* ── subtask ── */
.subtask-view-item{background:var(--ycy-panel)!important;border:1px solid var(--ycy-bd)!important;border-left:3px solid var(--ycy-t3)!important;border-radius:var(--ycy-r-xs)!important;box-shadow:none!important}
.subtask-view-item.done{opacity:.4!important;filter:grayscale(60%)!important}
.subtask-view-item.done .checkbox{background:var(--ycy-panel-w)!important;border-color:var(--ycy-t3)!important}
.subtask-edit-item{background:var(--ycy-panel)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-xs)!important;box-shadow:none!important}

/* ── search ── */
.search-card{background:var(--ycy-panel)!important;border:1px dashed var(--ycy-bd)!important;border-radius:var(--ycy-r-s)!important;box-shadow:none!important}
.search-term-tag{background:var(--ycy-panel-s)!important;border:1px solid var(--ycy-bd)!important;color:var(--ycy-t)!important;border-radius:var(--ycy-r-xs)!important;box-shadow:none!important}
.search-term-tag button{color:var(--ycy-t2)!important;background:transparent!important;border:none!important;box-shadow:none!important}
.search-term-tag button:hover{color:var(--ycy-ac)!important}
.search-term-tag.done{opacity:.4!important;filter:grayscale(60%)!important}
.search-term-checkbox{border:1px solid var(--ycy-t3)!important;background:transparent!important;border-radius:2px!important;box-shadow:none!important}
.search-term-tag.done .search-term-checkbox{background:var(--ycy-panel-w)!important;border-color:var(--ycy-t3)!important}
.search-term-tag.done .search-term-checkbox::after{color:var(--ycy-t3)!important}

/* ── settings ── */
.setting-item{background:var(--ycy-panel)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-xs)!important;box-shadow:none!important}
.setting-item span{color:var(--ycy-t)!important;font-weight:400!important}
.settings-card{background:var(--ycy-panel)!important;border:1px dashed var(--ycy-bd)!important;border-radius:var(--ycy-r-s)!important;box-shadow:none!important}
.settings-card.danger{border-color:var(--ycy-ac)!important;border-style:solid!important}
.settings-text{color:var(--ycy-t2)!important;line-height:1.7!important}
.settings-text strong{color:var(--ycy-gn)!important}
.md-code{background:var(--ycy-panel-s)!important;color:var(--ycy-ac)!important;border:1px solid var(--ycy-bd)!important;border-radius:4px!important;font-family:var(--font-main)!important}

/* ── chart ── */
.chart-container{background:var(--ycy-panel)!important;border:1px dashed var(--ycy-bd)!important;border-radius:var(--ycy-r-s)!important;box-shadow:none!important}

/* ── annual ── */
.stats-tabs{border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-xs)!important;overflow:hidden!important}
.stats-tab{color:var(--ycy-t2)!important;background:transparent!important;border:none!important;border-radius:0!important;box-shadow:none!important}
.stats-tab.active{background:var(--ycy-ac)!important;color:#fff!important}
.annual-hero{background:var(--ycy-panel-s)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r)!important;box-shadow:var(--ycy-sh-lg)!important}
.annual-hero::before{background:linear-gradient(90deg,var(--ycy-ac),var(--ycy-wn),var(--ycy-gn))!important;height:3px!important}
.annual-ending-title{color:var(--ycy-ac)!important}
.annual-ending-subtitle{color:var(--ycy-t2)!important}
.annual-ending-desc{border-top:1px dashed var(--ycy-bd)!important;color:var(--ycy-t)!important}
.annual-stat-card{background:var(--ycy-panel)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-s)!important;box-shadow:none!important}
.annual-stat-value{color:var(--ycy-gn)!important}
.annual-stat-label{color:var(--ycy-t3)!important}
.annual-section-title{color:var(--ycy-ac)!important;border-bottom:1px dashed var(--ycy-bd)!important}
.annual-month-bar-bg{background:var(--ycy-panel)!important;border-color:var(--ycy-bd)!important;border-radius:3px!important}
.annual-month-bar-total{background:rgba(128,128,128,.08)!important}
.annual-month-bar-done{background:var(--ycy-gn)!important;border-radius:3px!important;opacity:.7!important}
.annual-month-label,.annual-month-count{color:var(--ycy-t2)!important}
.annual-narrative{background:var(--ycy-panel)!important;border:1px dashed var(--ycy-bd)!important;border-radius:var(--ycy-r-s)!important;box-shadow:none!important;color:var(--ycy-t)!important}
.annual-narrative strong{color:var(--ycy-gn)!important}
.annual-narrative em{color:var(--ycy-ac)!important;font-style:normal!important}
.annual-narrative .highlight{color:var(--ycy-wn)!important;border-bottom:1px dashed var(--ycy-wn)!important}
.annual-divider{color:var(--ycy-t3)!important}
.annual-year-title{border-bottom:1px dashed var(--ycy-bd)!important}
.annual-year-title span{color:var(--ycy-gn)!important;text-shadow:none!important}
.annual-pri-bar-bg{background:var(--ycy-panel)!important;border-color:var(--ycy-bd)!important;border-radius:3px!important}
.annual-pri-label,.annual-pri-count{color:var(--ycy-t2)!important}
.annual-report-time{border-top:1px dashed var(--ycy-bd)!important;color:var(--ycy-t3)!important}

/* ── session ── */
.session-item{background:var(--ycy-panel)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-xs)!important;box-shadow:none!important}
.session-item.current-session{border-color:var(--ycy-gn)!important}
.session-ua{color:var(--ycy-t2)!important}

/* ── login ── */
#login-view > div{background:var(--ycy-panel-s)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r)!important;box-shadow:var(--ycy-sh-lg)!important}
#login-view p{color:var(--ycy-ac)!important}

/* ── preview-notice ── */
#preview-notice{background:var(--ycy-wn)!important;color:#1a1a1a!important;font-weight:600!important;border-bottom:none!important;border-radius:0!important}

/* ── scale ── */
.scale-slider-row input[type="range"]{background:var(--ycy-panel)!important;border:none!important}
.scale-slider-row input[type="range"]::-webkit-slider-thumb{background:var(--ycy-gn)!important;border:2px solid var(--ycy-bd)!important;box-shadow:none!important;border-radius:50%!important}
.scale-slider-row input[type="range"]::-moz-range-thumb{background:var(--ycy-gn)!important;border:2px solid var(--ycy-bd)!important;border-radius:50%!important}
.scale-slider-row input[type="range"]::-moz-range-track{background:var(--ycy-panel)!important;border:none!important}
.scale-value{color:var(--ycy-gn)!important}
.scale-preset-btn{background:var(--ycy-panel)!important;border:1px solid var(--ycy-bd)!important;color:var(--ycy-t2)!important;border-radius:var(--ycy-r-xs)!important;box-shadow:none!important}
.scale-preset-btn.active{border-color:var(--ycy-gn)!important;color:var(--ycy-gn)!important;background:var(--ycy-ac-l)!important}
.scale-preview-wrap{background:var(--ycy-panel-w)!important;border-color:var(--ycy-bd)!important;border-radius:var(--ycy-r-xs)!important}
.scale-label-sm,.scale-label-lg{color:var(--ycy-t3)!important}

/* ── custom textarea ── */
#custom-header-preview,#custom-content-preview{background:var(--ycy-panel-s)!important;color:var(--ycy-t)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-xs)!important;box-shadow:none!important}

/* ── smooth transitions on bg-dark toggle ── */
.todo-item,.date-bar,.batch-bar,.modal-content,.fake-input,.setting-item,.settings-card,.subtask-view-item,.search-card,.search-term-tag,.chart-container,.annual-hero,.annual-stat-card,.annual-narrative,.session-item,.detail-value,.badge-time,.btn-link,button,input,textarea,select,.checkbox{
  transition:background-color .45s ease,color .45s ease,border-color .45s ease,opacity .25s,transform .25s,box-shadow .25s!important;
}
/* ── 亮色模式统计文字颜色 ── */
html:not(.bg-dark) #stats-total-info{color:var(--ycy-t)!important}
html:not(.bg-dark) .annual-stat-value{color:var(--ycy-gn)!important}
html:not(.bg-dark) .annual-stat-label{color:var(--ycy-t3)!important}
html:not(.bg-dark) .annual-month-label,
html:not(.bg-dark) .annual-month-count,
html:not(.bg-dark) .annual-pri-label,
html:not(.bg-dark) .annual-pri-count{color:var(--ycy-t2)!important}
html:not(.bg-dark) .annual-narrative{color:var(--ycy-t)!important}
html:not(.bg-dark) .annual-ending-desc{color:var(--ycy-t)!important}
html:not(.bg-dark) .annual-ending-subtitle{color:var(--ycy-t2)!important}
html:not(.bg-dark) .annual-report-time{color:var(--ycy-t3)!important}
html:not(.bg-dark) .annual-section-title{color:var(--ycy-ac)!important}
html:not(.bg-dark) .annual-year-title span{color:var(--ycy-gn)!important}

/* ── 暗色模式背景图降低亮度 ── */
html.bg-dark #bg-layer-a,
html.bg-dark #bg-layer-b{filter:brightness(.58) saturate(.72);transition:filter .8s ease, opacity 1.6s ease}
html.bg-dark #bg-vignette{background:radial-gradient(ellipse at center,transparent 28%,rgba(0,0,0,.32) 100%)!important}

/* ── 暗色模式日期栏强制覆盖 [data-theme="light"] ── */
html.bg-dark .date-bar{background:var(--ycy-panel)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r)!important;box-shadow:var(--ycy-sh-lg)!important;padding:8px!important}
html.bg-dark .date-display .main{background:none!important;color:var(--ycy-ac)!important;font-weight:700!important;padding:0!important;border:none!important;border-radius:0!important;box-shadow:none!important;text-shadow:0 1px 8px rgba(0,0,0,.6)!important;font-family:var(--font-main)!important}
html.bg-dark .date-display .sub{color:var(--ycy-t2)!important;font-weight:400!important;margin-top:0!important}

/* ── 亮色模式日期栏大小与暗色模式统一 ── */
[data-theme="light"] .date-bar{background:rgba(255,255,255,.55)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r)!important;box-shadow:var(--ycy-sh-lg)!important;padding:8px!important}
[data-theme="light"] .date-display .main{background:none!important;color:var(--ycy-ac)!important;font-weight:700!important;padding:0!important;border:none!important;border-radius:0!important;box-shadow:none!important;text-shadow:0 1px 8px rgba(255,255,255,.5)!important;font-family:var(--font-main)!important}
[data-theme="light"] .date-display .sub{color:var(--ycy-t2)!important;font-weight:400!important;margin-top:0!important}

/* ── 亮色模式覆盖层遮罩（淡入淡出） ── */
#ycy-light-overlay{position:fixed;top:0;left:0;width:100%;height:100%;z-index:250;pointer-events:none;background:rgba(0,0,0,.12);opacity:0;transition:opacity .35s ease}
#ycy-light-overlay.vis{opacity:1}
html.bg-dark #ycy-light-overlay{display:none!important}
</style>
```
</details>

<details>
<summary><strong>查看自定义内容代码</strong></summary>

```html
<script>
(function(){

/* BACKGROUND SYSTEM */

var bgA=document.createElement('div');bgA.id='bg-layer-a';
var bgB=document.createElement('div');bgB.id='bg-layer-b';
var loader=document.createElement('div');loader.id='bg-loading';
var vignette=document.createElement('div');vignette.id='bg-vignette';
document.body.prepend(vignette,bgA,bgB,loader);

var cur='a';
var loading=false;
var customBgUrl=''; // 选填，自定义背景图地址，如 'https://t.alcy.cc/ycy'
var currentBgUrl='';

var apiBase=window.innerWidth<768?'https://t.alcy.cc/json?mp':'https://t.alcy.cc/json?pc';

function loadBg(){
  if(loading)return;
  loading=true;
  var ts=Date.now();

  if(customBgUrl){
    var imgUrl=customBgUrl+(customBgUrl.indexOf('?')>-1?'&':'?')+'t='+ts;
    var img=new Image();
    img.onload=function(){
      currentBgUrl=imgUrl;
      applyBg(imgUrl);
      loading=false;
    };
    img.onerror=function(){
      currentBgUrl=customBgUrl;
      applyBg(customBgUrl);
      loading=false;
    };
    img.src=imgUrl;
  }else{
    var url=apiBase+'&t='+ts;
    fetch(url)
      .then(function(r){return r.json();})
      .then(function(data){
        if(data&&data.data&&data.data.link){
          var imgUrl=data.data.link;
          var img=new Image();
          img.onload=function(){
            currentBgUrl=imgUrl;
            applyBg(imgUrl);
            loading=false;
          };
          img.onerror=function(){
            currentBgUrl=imgUrl;
            applyBg(imgUrl);
            loading=false;
          };
          img.src=imgUrl;
        }else{
          loading=false;
        }
      })
      .catch(function(){
        loading=false;
      });
  }
}

function applyBg(src){
  var next=cur==='a'?'b':'a';
  var nextEl=document.getElementById('bg-layer-'+next);
  var curEl=document.getElementById('bg-layer-'+cur);
  nextEl.style.backgroundImage='url('+src+')';
  requestAnimationFrame(function(){
    nextEl.classList.add('vis');
    curEl.classList.remove('vis');
  });
  cur=next;
  loader.style.opacity='0';
  setTimeout(function(){loader.style.display='none';},800);
}

/* Click detection: double-click → switch bg, triple-click → download */
var clickCount=0;
var clickTimer=null;

document.addEventListener('click',function(e){
  if(e.target.closest('button,input,textarea,select,a,.todo-item,.fake-input,.checkbox,.modal-content,.detail-overlay,.batch-bar,.popover-menu,.fab,.calendar-grid,.time-picker-container,.search-card,.setting-item,.settings-card,.subtask-view-item,.subtask-edit-item,.search-term-tag'))return;

  clickCount++;

  if(clickTimer)clearTimeout(clickTimer);

  clickTimer=setTimeout(function(){
    if(clickCount>=3&&currentBgUrl&&!customBgUrl){
      var a=document.createElement('a');
      a.href=currentBgUrl;
      a.download='';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }else if(clickCount===2){
      loadBg();
    }
    clickCount=0;
  },150);
});

loadBg();


/* THEME MANAGEMENT */

var ycyThemeMode=localStorage.getItem('ycyThemeMode')||'auto';
var _themeGuard=false;
var _ycySyncingDT=false;

function ycyApplyTheme(){
  if(_themeGuard)return;
  _themeGuard=true;

  var isDark=false;
  if(ycyThemeMode==='auto'){
    isDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
  }else if(ycyThemeMode==='dark'){
    isDark=true;
  }

  if(isDark){
    document.documentElement.classList.add('bg-dark');
  }else{
    document.documentElement.classList.remove('bg-dark');
  }

  var wantTheme=isDark?null:'light';
  var hasTheme=document.documentElement.getAttribute('data-theme');
  if(hasTheme!==wantTheme){
    _ycySyncingDT=true;
    if(wantTheme) document.documentElement.setAttribute('data-theme',wantTheme);
    else document.documentElement.removeAttribute('data-theme');
    _ycySyncingDT=false;
  }

  syncThemeButtonText();

  setTimeout(function(){_themeGuard=false;},80);
}

function syncThemeButtonText(){
  var btn=document.getElementById('theme-toggle-btn');
  if(!btn)return;
  var map={auto:'自动',light:'亮色',dark:'暗色'};
  var t=map[ycyThemeMode]||'自动';
  if(btn.textContent!==t) btn.textContent=t;
}

function ycyToggleTheme(){
  if(ycyThemeMode==='auto') ycyThemeMode='light';
  else if(ycyThemeMode==='light') ycyThemeMode='dark';
  else ycyThemeMode='auto';
  localStorage.setItem('ycyThemeMode',ycyThemeMode);
  ycyApplyTheme();
}

window.toggleTheme=ycyToggleTheme;

function setupThemeButton(){
  var btn=document.getElementById('theme-toggle-btn');
  if(!btn)return false;
  if(btn.getAttribute('data-ycy'))return true;
  btn.setAttribute('data-ycy','1');
  btn.removeAttribute('onclick');
  btn.addEventListener('click',function(e){
    e.preventDefault();e.stopPropagation();
    ycyToggleTheme();
  });

  var obs=new MutationObserver(function(){
    syncThemeButtonText();
  });
  obs.observe(btn,{childList:true,characterData:true,subtree:true});

  return true;
}

setTimeout(function(){
  setupThemeButton();
  ycyApplyTheme();
},300);

setInterval(function(){
  setupThemeButton();
  ycyApplyTheme();
},3000);

var dtObs=new MutationObserver(function(){
  if(_ycySyncingDT) return;
  setTimeout(ycyApplyTheme,50);
});
dtObs.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});


/* OVERLAY MANAGEMENT */
var ycyLightOverlay=document.createElement('div');
ycyLightOverlay.id='ycy-light-overlay';
document.body.appendChild(ycyLightOverlay);

var fullOverlays=['detail-view','trash-overlay','stats-overlay','settings-overlay'];

function checkOverlayState(){
  var anyActive=false;
  for(var i=0;i<fullOverlays.length;i++){
    var el=document.getElementById(fullOverlays[i]);
    if(el && el.classList.contains('active') && !el.classList.contains('closing')){
      anyActive=true;break;
    }
  }
  if(anyActive){
    document.body.classList.add('overlay-open');
  }else{
    document.body.classList.remove('overlay-open');
  }
  var isDark=document.documentElement.classList.contains('bg-dark');
  if(!isDark && anyActive){
    ycyLightOverlay.classList.add('vis');
  }else{
    ycyLightOverlay.classList.remove('vis');
  }
}

function setupOverlayObserver(){
  for(var i=0;i<fullOverlays.length;i++){
    var el=document.getElementById(fullOverlays[i]);
    if(!el)continue;
    var obs=new MutationObserver(checkOverlayState);
    obs.observe(el,{attributes:true,attributeFilter:['class']});
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',setupOverlayObserver);
}else{
  setupOverlayObserver();
}
setTimeout(setupOverlayObserver,1500);


/* CHART.JS COLOR PATCHING */

function patchChart(){
  if(!window.Chart)return;
  var isDark=document.documentElement.classList.contains('bg-dark');
  var fg=isDark?'#bbb':'#555';
  Chart.defaults.color=fg;
  Chart.defaults.borderColor=isDark?'rgba(128,128,128,0.08)':'rgba(0,0,0,0.06)';
  Chart.defaults.font.family="'Noto Sans SC',-apple-system,sans-serif";
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',patchChart);
}else{
  patchChart();
}
setTimeout(patchChart,2500);

var statsObs=new MutationObserver(function(){
  var el=document.getElementById('stats-overlay');
  if(el&&el.classList.contains('active')){setTimeout(patchChart,300);}
});
setTimeout(function(){
  var el=document.getElementById('stats-overlay');
  if(el)statsObs.observe(el,{attributes:true,attributeFilter:['class']});
},1500);


/* ADD MODAL RESTRUCTURE */

function restructureAddModal() {
  var mc = document.querySelector('#modal-add .modal-content');
  if (!mc) return;
  
  if (mc.classList.contains('ycy-sheet-ready')) {
    fixAddModalChildren();
    return;
  }
  
  mc.classList.add('ycy-sheet-ready');
  
  var handle = document.createElement('div');
  handle.className = 'ycy-drag-handle';
  mc.prepend(handle);
  
  var body = document.createElement('div');
  body.className = 'ycy-sheet-body';
  mc.appendChild(body);
  
  fixAddModalChildren();
  
  handle.addEventListener('click', function() {
    var overlay = document.getElementById('modal-add');
    if (overlay) {
      var closeBtn = overlay.querySelector('.close, .modal-close, [onclick*="close"]');
      if (closeBtn) {
        closeBtn.click();
      } else {
        overlay.classList.add('closing-overlay');
        var mcInner = overlay.querySelector('.modal-content');
        if(mcInner) mcInner.classList.add('closing');
        
        setTimeout(function() {
          overlay.classList.remove('active', 'closing-overlay');
          if(mcInner) mcInner.classList.remove('closing');
          document.body.classList.remove('modal-open');
        }, 300);
      }
    }
  });
}

function fixAddModalChildren() {
  var mc = document.querySelector('#modal-add .modal-content.ycy-sheet-ready');
  if (!mc) return;
  var body = mc.querySelector('.ycy-sheet-body');
  var handle = mc.querySelector('.ycy-drag-handle');
  if (!body || !handle) return;
  
  var nodesToMove = [];
  for (var i = 0; i < mc.childNodes.length; i++) {
    var node = mc.childNodes[i];
    if (node !== handle && node !== body) {
      nodesToMove.push(node);
    }
  }
  for (var i = 0; i < nodesToMove.length; i++) {
    body.appendChild(nodesToMove[i]);
  }
}

var addModalObs = new MutationObserver(function() {
  restructureAddModal();
});

setTimeout(function() {
  var addModal = document.getElementById('modal-add');
  if (addModal) {
    addModalObs.observe(addModal, { childList: true, subtree: true });
  }
  restructureAddModal();
}, 500);

/* FORCE SYNC */

var _forceSyncing=false;
var _ycyForceSync=new MutationObserver(function(){
  if(_forceSyncing)return;
  _forceSyncing=true;

  var isDark=document.documentElement.classList.contains('bg-dark');
  var dt=document.documentElement.getAttribute('data-theme');

  if(isDark && dt==='light'){
    document.documentElement.removeAttribute('data-theme');
  }else if(!isDark && dt!=='light'){
    document.documentElement.setAttribute('data-theme','light');
  }

  setTimeout(function(){_forceSyncing=false;},60);
});
_ycyForceSync.observe(document.documentElement,{
  attributes:true,
  attributeFilter:['class','data-theme']
});
})();
</script>
```
</details>

## 使用方法

- 右下角 `+` 建任务，可填子任务、时间、优先级、链接、快捷复制内容
- 点任务看详情，点「编辑」修改
- 右上设置调整偏好、备份数据、清空重开
- 备注支持Markdown的加粗、斜体、删除线

## 截图

> 截图已过时，以实际界面为准
<div align="center">
  <img src="./Screenshots/Screenshots1.jpg" width="30%" />
  <img src="./Screenshots/Screenshots2.jpg" width="30%" />
  <img src="./Screenshots/Screenshots3.jpg" width="30%" />
</div>
<div align="center">
  <img src="./Screenshots/Screenshots4.jpg" width="30%" />
  <img src="./Screenshots/Screenshots5.jpg" width="30%" />
  <img src="./Screenshots/Screenshots6.jpg" width="30%" />
</div>
<div align="center">
  <img src="./Screenshots/Screenshots7.jpg" width="45%" />
  <img src="./Screenshots/Screenshots8.jpg" width="45%" />
</div>

---

## Supabase 数据库配置

使用 Supabase 作为云端数据库替代 Cloudflare D1<br>需使用 **worker_2.6.6_supabase_beta2.js**

### 1. 注册与创建项目

1. 访问：[Supabase](https://supabase.com)
2. 注册/登录账号
3. 点击 **New project** 创建新项目
   - **Project name**：项目名称，随意填写
   - **Database password**：数据库密码（本项目可能用不到，但请妥善保存）
   - **Region**：选择距离你最近的服务器区域
4. 点击 **Create new project**

### 2. 初始化数据库表

1. 进入刚创建的项目，在菜单栏点击 **SQL Editor**（图标像一个终端），将以下建表语句完整复制并粘贴到编辑器中：

```sql
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  date TEXT NOT NULL,
  text TEXT NOT NULL,
  time TEXT,
  priority TEXT,
  repeat INTEGER NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  url TEXT,
  copy_text TEXT,
  subtasks JSONB DEFAULT '[]',
  search_terms JSONB DEFAULT '[]',
  done INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  repeat_type TEXT DEFAULT 'none',
  repeat_custom TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_todos_date_del ON todos(date, deleted);
CREATE INDEX IF NOT EXISTS idx_todos_parent_date_del ON todos(parent_id, date, deleted);

CREATE TABLE IF NOT EXISTS todo_templates (
  parent_id TEXT PRIMARY KEY,
  text TEXT, time TEXT, priority TEXT, description TEXT DEFAULT '', url TEXT, 
  copy_text TEXT, subtasks JSONB DEFAULT '[]', search_terms JSONB DEFAULT '[]', 
  repeat_type TEXT, repeat_custom TEXT,
  anchor_date TEXT,
  blacklist JSONB DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_templates_repeat_type ON todo_templates(repeat_type);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  lock_until BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB
);
```

2.点击右下角的 Run 执行

### 3. 启用行级安全策略 (RLS)

在 SQL Editor 中继续执行以下语句（完整复制并粘贴）：

```sql
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
```

### 4. 配置 Worker 环境变量

在 Cloudflare Dashboard 中，进入您的 Worker 项目 -> **设置** -> **变量和机密** 中添加以下变量。

| 变量名 | 获取方式 |
| :--- | :---: |
| `SUPABASE_URL` | 回到 Supabase 在该项目的名称下方，例如：https://ju.supabase.co |
| `SUPABASE_KEY` | 回到 Supabase 右上角三条杠 -> Project Settings -> API Keys -> Legacy anon, service_role API keys -> 找到 service_role 并复制 |
