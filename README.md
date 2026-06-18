# cf-todo

一个跑在Cloudflare Worker + D1上的待办网页
演示站点：https://moara.ccwu.cc

## 能干什么

- 增删改、标记完成
- 创建子任务拆分步骤，逐个勾掉
- 自动拉取B站/微博/知乎/百度热点共20个，当任务或灵感池用
- 每日重复事项，勾了明天还有
- 回收站防手滑
- 批量操作、筛选排序、导入导出

---

## GitHub Actions 部署

第1步：Fork 仓库

打开本项目的 GitHub 页面 → 右上角 **Fork** → 确认。

第2步：获取 Cloudflare API Token 和 Account ID

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 右上角头像 → **我的个人资料** → **API 令牌** → **创建令牌**
3. 选择 **编辑 Cloudflare Workers** 模板 → 添加权限 **Account - D1 - Edit** → **继续显示摘要** → **创建令牌**
4. **复制令牌**（只显示一次）
5. 浏览器地址栏可看到 **账户 ID**，记下来

第3步：在 GitHub 仓库中配置 Secrets

进入仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，添加以下 4 个：

| Secret 名称 | 必填 | 说明 |
| :--- | :---: | :--- |
| `CLOUDFLARE_API_TOKEN` | **是** | 上一步获取的 API 令牌 |
| `CLOUDFLARE_ACCOUNT_ID` | **是** | 上一步获取的账户 ID |
| `ADMIN_PASSWORD` | **是** | 登录密码，建议强密码 |
| `JWT_SECRET` | **是** | JWT 签名密钥，随机字符串即可，可到 [jwtsecrets](https://jwtsecrets.com/#generator) 生成 |

第4步：一键部署

1. 进入仓库的 **Actions** 选项卡
2. 左侧选择 **Deploy to Cloudflare Workers**
3. 点击右侧 **Run workflow** → 选择分支 → **Run workflow**
4. 等待运行完成，出现绿色 ✓ 即部署成功
访问你的 URL 开始使用

---

## 前端定制注入

在网站的**设置**中添加。<br>默认**关闭**前端定制注入。需要在网站"设置 -> 前端定制"中启用前端定制注入并点击保存才会生效。

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
button{background:var(--ycy-panel)!important;color:var(--ycy-t)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-xs)!important;font-family:var(--font-main)!important;box-shadow:var(--ycy-sh)!important;font-weight:500!important}
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
.fake-input.detail-value.editable{display:flex!important;justify-content:space-between!important}
.fake-input .arrow,.fake-input .arrow-r{font-size:.8rem!important}
.fake-input .arrow-r{margin-right:8px!important}

/* ── modal layout ── */
.modal-section{margin-top:10px!important}
.modal-row{margin-bottom:10px!important}
.modal-row .fake-input{margin-bottom:0!important}
.modal-row .detail-value.editable{margin-bottom:0!important}
.modal-subtask-row{margin-bottom:10px!important;align-items:stretch!important}
.modal-subtask-row input{margin-bottom:0!important}
.modal-subtask-row button{margin:0!important}
/* 子任务 +/- 图标按钮：方形、粗号、与同行输入框等高（依赖 flex stretch） */
.subtask-icon-btn{width:38px!important;flex-shrink:0!important;padding:0!important;font-size:1.25rem!important;font-weight:900!important;line-height:1!important;display:flex!important;align-items:center!important;justify-content:center!important;text-transform:none!important}
.subtask-icon-btn.danger{color:var(--ycy-ac)!important;border-color:var(--ycy-ac)!important}
.subtask-icon-btn.danger:hover{background:var(--ycy-ac)!important;color:#000!important}
.subtask-edit-item .subtask-icon-btn{width:30px!important;height:28px!important;font-size:1.1rem!important}

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
.todo-item.pri-high .checkbox{border-color:var(--ycy-ac)!important}
.todo-item.pri-med .checkbox{border-color:var(--ycy-wn)!important}
.todo-item.done .checkbox{background:var(--ycy-panel-w)!important;border-color:var(--ycy-t3)!important;position:relative!important}
.todo-item.done .checkbox::after{content:'✓'!important;color:var(--ycy-t3)!important;position:absolute!important;left:2px!important;top:-2px!important;font-size:15px!important;font-weight:700!important;background:none!important}
.todo-item .checkbox.batch-selected{background:var(--ycy-ac)!important;border-color:var(--ycy-ac)!important}
.todo-item .checkbox.batch-selected::after{color:#fff!important}

/* ── badges ── */
.badge{border-radius:4px!important;font-weight:600!important;padding:1px 6px!important;font-size:.68rem!important}
.badge-time{background:var(--ycy-panel-s)!important;color:var(--ycy-bl)!important;border:1px solid var(--ycy-bd)!important}
.badge-overdue{background:rgba(206,36,36,.6)!important}
html.bg-dark .badge-overdue{background:rgba(139,0,0,.6)!important}
.badge-warning{background:rgba(225,172,7,.6)!important}
html.bg-dark .badge-warning{background:rgba(74,48,0,.6)!important}
.badge-category{display:inline-flex!important;align-items:center!important;padding:6px 12px!important;color:var(--ycy-t)!important;font-size:.85rem!important;border:1px solid var(--ycy-bd)!important;background:transparent!important;gap:6px!important;max-width:100%!important;border-radius:var(--ycy-r-xs)!important;box-shadow:none!important}
.badge-category-icon{width:8px!important;height:8px!important;border-radius:2px!important;display:inline-block!important;flex-shrink:0!important}
.badge-category .cat-name{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}

/* ── category modal ── */
.category-modal-list{max-height:50vh!important;overflow-y:auto!important;flex-wrap:wrap!important;gap:8px!important;align-content:flex-start!important}
.category-modal-body{overflow:hidden!important;margin:0 -20px!important;padding:0 20px!important;transition:height .3s ease!important;will-change:height!important;contain:layout style paint!important}
.category-modal-item{display:inline-flex!important;align-items:center!important;padding:6px 12px!important;cursor:pointer!important;color:var(--ycy-t)!important;font-size:.85rem!important;border:1px solid var(--ycy-bd)!important;background:transparent!important;transition:background .15s,border-color .15s!important;gap:6px!important;max-width:100%!important;border-radius:var(--ycy-r-xs)!important;box-shadow:none!important}
.category-modal-item:hover{background:var(--ycy-ac-l)!important;color:var(--ycy-ac)!important;border-color:var(--ycy-ac)!important}
.category-modal-item.selected{background:var(--ycy-gn)!important;color:#fff!important;font-weight:700!important;border-color:var(--ycy-gn)!important}
.category-modal-item .badge-category-icon{flex-shrink:0!important}
.category-modal-item .cat-name{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
.cat-highlight{color:var(--ycy-ac)!important;font-weight:700!important}
.category-modal-divider{border-top:1px solid var(--ycy-bd2)!important;margin:10px 0!important;padding-top:10px!important}
.category-new-input{width:100%!important;background:var(--ycy-panel-s)!important;border:1px solid var(--ycy-bd)!important;color:var(--ycy-t)!important;padding:8px!important;font-family:var(--font-main)!important;font-size:.85rem!important;outline:none!important;margin:0!important;border-radius:var(--ycy-r-xs)!important;box-shadow:var(--ycy-sh)!important}
.category-new-input:focus{border-color:var(--ycy-ac)!important;box-shadow:0 0 0 3px var(--ycy-ac-l)!important}
#category-toggle-btn,#category-toggle-btn-2{border:1px solid var(--ycy-bd)!important;color:var(--ycy-t2)!important;background:var(--ycy-panel)!important;border-radius:var(--ycy-r-xs)!important;box-shadow:var(--ycy-sh)!important;padding:6px 8px!important;width:36px!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;position:relative!important}
#category-toggle-btn svg,#category-toggle-btn-2 svg{pointer-events:none!important;transition:opacity .3s ease,transform .3s ease!important}
#category-search-row[style*="flex"],#category-create-row[style*="flex"]{gap:6px!important;align-items:stretch!important}
[data-theme="light"] #category-toggle-btn,[data-theme="light"] #category-toggle-btn-2{border-color:var(--ycy-bd)!important;color:var(--ycy-t2)!important;background:var(--ycy-panel)!important;box-shadow:var(--ycy-sh)!important}

/* ── category color picker ── */
.category-color-presets{flex-wrap:wrap!important;gap:10px!important;padding:8px 0!important;align-items:center!important}
.category-color-circle{width:28px!important;height:28px!important;border-radius:50%!important;cursor:pointer!important;border:2px solid transparent!important;transition:border-color .15s,transform .15s!important;flex-shrink:0!important;box-shadow:none!important}
.category-color-circle:hover{transform:scale(1.15)!important}
.category-color-circle.selected{border-color:var(--ycy-gn)!important;box-shadow:0 0 6px rgba(45,143,94,.3)!important}
.category-color-custom{width:28px!important;height:28px!important;border-radius:50%!important;cursor:pointer!important;border:2px dashed var(--ycy-t3)!important;display:flex!important;align-items:center!important;justify-content:center!important;transition:border-color .15s,transform .15s!important;flex-shrink:0!important;position:relative!important;box-shadow:none!important}
.category-color-custom:hover{transform:scale(1.15)!important}
.category-color-custom.selected{border-color:var(--ycy-gn)!important;border-style:solid!important;box-shadow:0 0 6px rgba(45,143,94,.3)!important}
.category-color-custom svg{pointer-events:none!important}

/* ── view modal ── */
#modal-category.modal-overlay,#modal-view.modal-overlay{background:rgba(0,0,0,.22)!important}
#modal-category .modal-content{box-shadow:none!important;will-change:transform!important;transform:translateZ(0)!important;transition:border-color .45s ease!important}

/* ── view tags (toolbar) ── */
.view-tags{flex:1!important;display:flex!important;align-items:center!important;gap:4px!important;overflow:hidden!important;cursor:pointer!important;min-width:0!important}
.view-tag{overflow:hidden!important;text-overflow:ellipsis!important}
.view-tag-shrink{flex-shrink:1!important;min-width:0!important}

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
#modal-time.modal-overlay,
#modal-interval.modal-overlay{background:rgba(0,0,0,.22)!important}
.modal-content{background:var(--ycy-panel-s)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r)!important;box-shadow:var(--ycy-sh-lg)!important;color:var(--ycy-t)!important}
.modal-content h3{color:var(--ycy-t)!important;border-bottom:1px solid var(--ycy-bd2)!important;padding-bottom:8px!important}

/* ── FULL-SCREEN OVERLAYS ── */
.detail-overlay{background:transparent!important;z-index:60!important;font-family:var(--font-main)!important}
.detail-header{border-bottom:1px solid var(--ycy-bd2)!important;margin-bottom:12px!important}
.detail-header span{color:var(--ycy-t)!important;background:none!important;padding:0!important;border-radius:0!important}
.detail-label{color:var(--ycy-t3)!important;font-size:.75rem!important;text-transform:uppercase!important;letter-spacing:.5px!important;margin-bottom:5px!important}
.detail-value{color:var(--ycy-t)!important;border-left:3px solid var(--ycy-ac)!important;background:var(--ycy-panel)!important;border-radius:0 var(--ycy-r-xs) var(--ycy-r-xs) 0!important;box-shadow:var(--ycy-sh)!important;padding:10px!important}
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

/* ── apikey ── */
.apikey-status{color:var(--ycy-gn)!important}
.apikey-status.disabled{color:var(--ycy-ac)!important}
#apikey-created-box{background:var(--ycy-panel)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-xs)!important;box-shadow:none!important}
#apikey-created-box .apikey-created-text{color:var(--ycy-gn)!important}
#apikey-created-value{background:var(--ycy-panel-s)!important;border:1px solid var(--ycy-bd)!important;color:var(--ycy-t)!important;border-radius:var(--ycy-r-xs)!important;box-shadow:var(--ycy-sh)!important}

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

/* ── import/export modal ── */
.io-overlay{background:rgba(0,0,0,.22)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
html.bg-dark .io-overlay{background:rgba(0,0,0,.42)!important}
.io-dialog{background:var(--ycy-panel-s)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r)!important;box-shadow:var(--ycy-sh-lg)!important;padding:25px 35px!important;text-align:center!important;font-family:var(--font-main)!important;max-width:90vw!important;min-width:280px!important;color:var(--ycy-t)!important}
.io-title{font-size:1.05rem!important;font-weight:700!important;margin-bottom:8px!important;color:var(--ycy-t)!important}
.io-sub{font-size:.85rem!important;color:var(--ycy-t2)!important;margin-bottom:10px!important}
.io-sub-block{margin-bottom:20px!important;white-space:pre-line!important}
.io-msg{font-size:.95rem!important;font-weight:700!important;margin-bottom:20px!important;color:var(--ycy-ac)!important;white-space:pre-line!important}
.io-bar-bg{height:4px!important;background:var(--ycy-panel)!important;border:1px solid var(--ycy-bd)!important;border-radius:2px!important}
.io-bar-fill{height:100%!important;background:var(--ycy-ac)!important;border-radius:2px!important;transition:width .3s!important}
.io-btn-row{display:flex!important;gap:10px!important;justify-content:center!important}
.io-btn{padding:8px 25px!important;cursor:pointer!important;font-family:var(--font-main)!important;font-weight:500!important;background:var(--ycy-panel)!important;color:var(--ycy-t)!important;border:1px solid var(--ycy-bd)!important;border-radius:var(--ycy-r-xs)!important;box-shadow:var(--ycy-sh)!important;transition:all .2s!important}
.io-btn:active{transform:scale(.97)!important;background:var(--ycy-panel-s)!important}
.io-btn-primary{background:var(--ycy-ac)!important;color:#fff!important;border-color:var(--ycy-ac)!important;box-shadow:0 2px 12px rgba(232,69,60,.25)!important}
.io-btn-primary:active{opacity:1!important;background:var(--ycy-panel-s)!important;color:var(--ycy-t)!important}
.io-btn-secondary{background:var(--ycy-panel)!important;color:var(--ycy-t2)!important;border:1px solid var(--ycy-bd)!important;box-shadow:none!important}
.io-btn-secondary:hover{background:var(--ycy-panel-s)!important;color:var(--ycy-t)!important}

/* ── smooth transitions on bg-dark toggle ── */
.todo-item,.date-bar,.batch-bar,.fake-input,.setting-item,.settings-card,.subtask-view-item,.search-card,.search-term-tag,.chart-container,.annual-hero,.annual-stat-card,.annual-narrative,.session-item,.detail-value,.badge-time,.badge-category,.btn-link,.checkbox{
  transition:background-color .45s ease,color .45s ease,border-color .45s ease,opacity .25s,transform .25s,box-shadow .25s!important;
}
.modal-content{
  transition:border-color .45s ease,box-shadow .25s!important;
}
button,input,textarea,select{
  transition:background-color .15s ease,color .15s ease,border-color .15s ease,opacity .15s,transform .15s,box-shadow .15s!important;
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
#ycy-light-overlay{position:fixed;top:0;left:0;width:100%;height:100%;z-index:55;pointer-events:none;background:rgba(0,0,0,.12);opacity:0;transition:opacity .35s ease}
#ycy-light-overlay.vis{opacity:1}
html.bg-dark #ycy-light-overlay{display:none!important}

/* ── changelog modal ── */
#modal-changelog.modal-overlay{background:rgba(0,0,0,.22)!important}
html.bg-dark #modal-changelog.modal-overlay{background:rgba(0,0,0,.42)!important}
.changelog-entry{margin-bottom:12px!important;padding-bottom:10px!important;border-bottom:1px dashed var(--ycy-bd2)!important}
.changelog-entry:last-child{border-bottom:none!important;margin-bottom:0!important;padding-bottom:0!important}
.changelog-version{font-size:.9rem!important;font-weight:700!important;color:var(--ycy-gn)!important;margin-bottom:2px!important}
.changelog-date{font-size:.7rem!important;color:var(--ycy-t3)!important;margin-bottom:4px!important}
.changelog-notes{font-size:.8rem!important;color:var(--ycy-t)!important;line-height:1.5!important}
.changelog-new{border-left:3px solid var(--ycy-ac)!important;padding-left:10px!important;border-bottom:none!important}
.changelog-new .changelog-version{color:var(--ycy-ac)!important}
.changelog-section-title{font-size:.7rem!important;color:var(--ycy-t2)!important;text-transform:uppercase!important;margin:12px 0 8px!important;padding-bottom:4px!important;border-bottom:1px solid var(--ycy-bd2)!important;letter-spacing:1px!important}
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
  if(e.target.closest('button,input,textarea,select,a,.todo-item,.fake-input,.checkbox,.modal-content,.modal-overlay,.detail-overlay,.batch-bar,.popover-menu,.fab,.calendar-grid,.time-picker-container,.search-card,.setting-item,.settings-card,.subtask-view-item,.subtask-edit-item,.search-term-tag,.category-modal-item,.category-color-circle,.category-color-custom,.view-tags'))return;

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
    var hour=new Date().getHours();
    isDark=hour<6||hour>=18;
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

  // 移动端隐藏 ">> 新建事项" 标题
  var _isMobileAdd = window.matchMedia && window.matchMedia('(max-width: 1024px)').matches;
  var _addTitle = body.querySelector('h3') || mc.querySelector('h3');
  if (_addTitle) {
    if (_isMobileAdd) {
      _addTitle.style.display = 'none';
      _addTitle.style.margin = '0';
      _addTitle.style.border = 'none';
      _addTitle.style.padding = '0';
    } else {
      _addTitle.style.display = '';
      _addTitle.style.margin = '';
      _addTitle.style.border = '';
      _addTitle.style.padding = '';
    }
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
