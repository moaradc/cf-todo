/**
 * 提醒邮件 HTML 模板 —— ECHO 复古未来终端风格（完整版）。
 *
 * 参考 echo.lubeiluchen.cc 完整网站设计语言：
 *   - ArchiveHeader：黑色标签 + 横线 + REC_DATE + 大标题（橙色阴影）
 *   - SectionHeader：彩色方块 + 标题 + 虚线延伸
 *   - Card：2px 黑边框 + hard shadow (4px 4px 0) + 白底
 *   - 标签：bg-dark text-bg 小方块标签 + #tag 胶囊
 *   - LOGGED BY：黄色条 + 倾斜
 *   - 终端式正文：> 前缀 + Courier 等宽
 *   - [ END OF LOG ] / [ ACCESS FILE ] 等标记
 *   - STATUS: 绿色状态值 + 虚线分隔
 *
 * 邮件兼容：内联 CSS + 表格布局，600px 宽度。
 */

export interface EmailItem {
  text: string;
  time?: string;
  priority?: string;
  desc?: string;
  url?: string;
  categoryName?: string;
  categoryColor?: string;
  done?: boolean;
}

export interface EmailSection {
  title: string;
  items: EmailItem[];
  emptyMessage?: string;
  listStyle?: 'cards' | 'list' | 'keywords';
}

export interface RenderEmailParams {
  title: string;
  subtitle: string;
  sections: EmailSection[];
  runAt: Date;
  timezoneLabel: string;
  appUrl?: string;
  footerNote?: string;
}

const C = {
  primary: '#ea580c',
  primaryLight: '#f97316',
  bg: '#f2f0e4',
  panel: '#e8e6d9',
  paper: '#ffffff',
  dark: '#1c1917',
  ink: '#292524',
  textMuted: '#8A8A8A',
  yellow: '#eab308',
  green: '#65a30d',
  red: '#dc2626',
};

const PRIORITY_TAG: Record<string, { bg: string; label: string }> = {
  high: { bg: C.red, label: 'HIGH' },
  med: { bg: C.yellow, label: 'MED' },
  low: { bg: C.textMuted, label: 'LOW' },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }

function formatRunTimestamp(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

/** ECHO 小标签：黑底白字方块 */
function darkTag(text: string): string {
  return `<span style="display:inline-block;padding:2px 8px;background:${C.dark};color:${C.bg};font-family:'Courier New',monospace;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">${escapeHtml(text)}</span>`;
}

/** ECHO 彩色标签 */
function colorTag(bg: string, text: string): string {
  return `<span style="display:inline-block;padding:2px 8px;background:${bg};color:#FFFFFF;font-family:'Courier New',monospace;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">${escapeHtml(text)}</span>`;
}

/** ECHO #tag 胶囊 */
function hashTag(text: string, color: string): string {
  return `<span style="display:inline-block;padding:3px 10px;background:${C.panel};border:1px solid ${color};border-radius:999px;font-family:'Courier New',monospace;font-size:11px;color:${color};font-weight:700;">${escapeHtml(text)}</span>`;
}

/** ECHO 彩色方块（SectionHeader 用） */
function colorSquare(color: string): string {
  return `<span style="display:inline-block;width:14px;height:14px;background:${color};vertical-align:middle;margin-right:8px;"></span>`;
}

// ── cards 样式（ECHO Card 组件模式） ──
function renderItemCard(item: EmailItem, index: number): string {
  const prio = PRIORITY_TAG[item.priority ?? 'low'] ?? PRIORITY_TAG.low;
  const doneMark = item.done ? '<span style="color:#65a30d;font-size:14px;margin-right:4px;">&#x2713;</span>' : '';
  const desc = item.desc ? `<p style="margin:6px 0 0 0;font-size:13px;color:${C.ink};line-height:1.6;font-family:'Courier New',monospace;">${escapeHtml(item.desc)}</p>` : '';
  const urlLink = item.url
    ? `<p style="margin:6px 0 0 0;font-size:12px;"><a href="${escapeHtml(item.url)}" style="color:${C.primary};text-decoration:none;font-family:'Courier New',monospace;word-break:break-all;">${escapeHtml(item.url)}</a></p>`
    : '';
  const catDot = item.categoryColor
    ? `<span style="display:inline-block;width:8px;height:8px;background:${escapeHtml(item.categoryColor)};border-radius:50%;margin-right:4px;vertical-align:middle;"></span>`
    : '';
  const catName = item.categoryName ? `<span style="color:${C.textMuted};font-size:11px;font-family:'Courier New',monospace;">${escapeHtml(item.categoryName)}</span>` : '';

  const num = String(index + 1).padStart(2, '0');
  return `<tr><td style="padding:0 0 12px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};border:2px solid ${C.dark};box-shadow:3px 3px 0 ${C.dark};${item.done ? 'opacity:0.6;' : ''}">
      <!-- 黑色编号条 -->
      <tr><td style="background:${C.dark};padding:5px 14px;">
        <span style="font-family:'Courier New',monospace;font-size:12px;font-weight:700;color:${C.primaryLight};letter-spacing:0.15em;">${num}</span>
        ${item.time ? `<span style="float:right;font-family:'Courier New',monospace;font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.1em;">${escapeHtml(item.time)}</span>` : ''}
      </td></tr>
      <!-- 内容区 -->
      <tr><td style="padding:14px 16px;">
        <div style="font-size:15px;color:${C.dark};line-height:1.5;font-weight:500;${item.done ? `text-decoration:line-through;color:${C.textMuted};` : ''}">${doneMark}${escapeHtml(item.text)}</div>
        ${desc}${urlLink}
        <div style="margin-top:8px;">
          ${item.priority ? colorTag(prio.bg, prio.label) : ''}
          ${item.done ? ` ${colorTag(C.green, 'DONE')}` : ''}
          ${catDot ? ` <span style="margin-left:6px;">${catDot}${catName}</span>` : ''}
        </div>
      </td></tr>
    </table>
  </td></tr>`;
}

// ── list 样式 ──
function renderListItem(item: EmailItem): string {
  const pColor = PRIORITY_TAG[item.priority ?? 'low']?.bg ?? C.textMuted;
  const doneMark = item.done ? '<span style="color:#65a30d;margin-right:6px;">&#x2713;</span>' : '';
  const timeTag = item.time ? `<span style="color:${C.textMuted};font-size:11px;margin-right:8px;font-family:'Courier New',monospace;">${escapeHtml(item.time)}</span>` : '';
  return `<tr><td style="padding:7px 0;border-bottom:1px dashed ${C.dark}33;">
    <span style="display:inline-block;width:6px;height:6px;background:${pColor};margin-right:8px;vertical-align:middle;"></span>
    ${timeTag}${doneMark}<span style="font-size:14px;color:${C.dark};${item.done ? `text-decoration:line-through;color:${C.textMuted};` : ''}">${escapeHtml(item.text)}</span>
  </td></tr>`;
}

// ── keywords 样式（无编号无颜色区分，用 done 状态区分） ──
function renderKeywordItem(item: EmailItem): string {
  const bg = item.done ? C.panel : C.paper;
  const border = item.done ? C.textMuted : C.dark;
  const color = item.done ? C.textMuted : C.dark;
  const doneMark = item.done ? ' <span style="font-size:9px;">&#x2713;</span>' : '';
  return `<tr><td style="padding:3px 0;">
    <span style="display:inline-block;padding:3px 10px;background:${bg};border:1px solid ${border};border-radius:999px;font-family:'Courier New',monospace;font-size:12px;color:${color};font-weight:700;${item.done ? 'text-decoration:line-through;' : ''}">${escapeHtml(item.text)}${doneMark}</span>
  </td></tr>`;
}

function renderSection(section: EmailSection, sectionIndex: number): string {
  const count = section.items.length;
  // section 标题颜色轮换（ECHO SectionHeader 模式）
  const colors = [C.primary, C.red, C.green, C.dark, C.yellow];
  const secColor = colors[sectionIndex % colors.length];

  // SectionHeader：彩色方块 + 标题 + 虚线延伸（ECHO 模式）
  let html = `<tr><td style="padding:16px 0 0 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:8px;white-space:nowrap;">${colorSquare(secColor)}</td>
      <td style="font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:${C.dark};letter-spacing:0.1em;text-transform:uppercase;white-space:nowrap;padding-right:10px;">${escapeHtml(section.title)}${count > 0 ? ` (${count})` : ''}</td>
      <td style="border-bottom:2px dashed ${C.dark}33;width:100%;height:1px;"></td>
    </tr></table>
  </td></tr>`;

  if (count === 0 && section.emptyMessage) {
    html += `<tr><td style="padding:12px 0;">
      <div style="background:${C.paper};border:2px solid ${C.dark};box-shadow:2px 2px 0 ${C.dark};padding:16px;text-align:center;">
        <span style="font-family:'Courier New',monospace;font-size:13px;color:${C.textMuted};font-style:italic;">${escapeHtml(section.emptyMessage)}</span>
      </div>
    </td></tr>`;
    return html;
  }

  const style = section.listStyle ?? 'cards';
  let itemsHtml = '';
  if (style === 'cards') {
    itemsHtml = section.items.map((i, idx) => renderItemCard(i, idx)).join('');
  } else if (style === 'list') {
    itemsHtml = section.items.map(renderListItem).join('');
  } else {
    itemsHtml = section.items.map(renderKeywordItem).join('');
  }

  html += `<tr><td style="padding:10px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
  </td></tr>`;

  return html;
}

export function renderModeEmail(params: RenderEmailParams): { html: string; text: string; subject: string } {
  const { title, subtitle, sections, runAt, timezoneLabel, appUrl, footerNote } = params;
  const runStr = formatRunTimestamp(runAt);
  const subject = title;
  const sectionsHtml = sections.map((s, i) => renderSection(s, i)).join('');

  const footer = footerNote ?? '本邮件由 cf-todo 定时提醒服务自动发送';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:'Space Grotesk','Noto Sans SC',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="min-height:100%;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- ArchiveHeader：REMINDER_LOG 黑块 -->
          <tr><td style="padding-bottom:8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="white-space:nowrap;padding-right:10px;">${darkTag('REMINDER_LOG')}</td>
            </tr></table>
          </td></tr>

          <!-- 大标题（橙色 textShadow，ECHO 模式） -->
          <tr><td style="padding:0 0 4px 0;">
            <div style="font-family:'Space Grotesk','Noto Sans SC',sans-serif;font-size:32px;font-weight:900;color:${C.dark};letter-spacing:-0.02em;line-height:1;text-shadow:3px 3px 0 ${C.primary};">${escapeHtml(title)}</div>
          </td></tr>

          <!-- 副标题（含时间+时区，精确到秒） -->
          <tr><td style="padding:0 0 20px 0;">
            <div style="font-family:'Courier New',monospace;font-size:13px;color:${C.ink};letter-spacing:0.05em;">${escapeHtml(subtitle)}</div>
          </td></tr>

          <!-- ═══ SECTIONS ═══ -->
          ${sectionsHtml}

          <!-- ═══ FOOTER（ECHO 模式：虚线分隔 + STATUS + [ END OF LOG ]） ═══ -->
          <tr><td style="padding:20px 0 0 0;">
            <div style="border-top:2px dashed ${C.dark}33;padding-top:12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:'Courier New',monospace;font-size:10px;font-weight:700;color:${C.textMuted};letter-spacing:0.1em;text-transform:uppercase;">STATUS:</td>
                  <td style="text-align:right;"><span style="background:${C.green};color:#FFFFFF;padding:1px 6px;font-family:'Courier New',monospace;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">SENT</span></td>
                </tr>
              </table>
            </div>
          </td></tr>
          <tr><td style="padding:8px 0;">
            <div style="font-size:11px;color:${C.textMuted};line-height:1.6;font-family:'Courier New',monospace;">${escapeHtml(footer)}</div>
          </td></tr>
          <tr><td style="text-align:right;padding:4px 0 0 0;">
            <span style="font-family:'Courier New',monospace;font-size:10px;color:${C.textMuted};letter-spacing:0.15em;text-transform:uppercase;opacity:0.5;">[ END OF LOG ]</span>
          </td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // 纯文本回退
  const textParts: string[] = [`cf-todo ${title}`, subtitle, `REC_DATE: ${runStr} (TZ: ${timezoneLabel})`, ''];
  sections.forEach((s, i) => {
    textParts.push(`[${String(i + 1).padStart(2, '0')}] ${s.title} (${s.items.length})`);
    if (s.items.length === 0 && s.emptyMessage) {
      textParts.push('  ' + s.emptyMessage);
    } else {
      s.items.forEach((item, j) => {
        const bits = [`  [${String(j + 1).padStart(2, '0')}]`];
        if (item.time) bits.push(item.time);
        bits.push(item.text);
        if (item.done) bits.push('[DONE]');
        textParts.push(bits.join(' '));
      });
    }
    textParts.push('');
  });
  textParts.push('STATUS: SENT', '[ END OF LOG ]', 'cf-todo');
  const text = textParts.join('\n');

  return { html, text, subject };
}
