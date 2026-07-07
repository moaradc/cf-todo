/**
 * 提醒邮件 HTML 模板 —— ECHO 复古未来终端风格。
 *
 * 设计语言（参考 ECHO 奇点日志）：
 *   - 章节卡片：黑色编号条头部 + 白底内容区
 *   - 标签系统：彩色标签（黄/绿/红/米白）+ Courier 等宽字体
 *   - 信息层次：标签 → 标题 → 描述 → 元数据 → [ END OF LOG ]
 *   - 分隔线：黑色虚线 + 标签
 *   - 状态指示：彩色圆点 + 状态文字
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

// ── 颜色常量 ──
const C = {
  primary: '#E85D04',
  primaryLight: '#F48C06',
  bgDark: '#0A0A0A',
  bgCream: '#FAF6EE',
  bgWhite: '#FFFFFF',
  bgLight: '#F5F0E8',
  textPrimary: '#1A1A1A',
  textSecondary: '#4A4A4A',
  textMuted: '#8A8A8A',
  borderBlack: '#000000',
  tagYellow: '#F5A623',
  tagGreen: '#4A7C59',
  tagRed: '#CC3333',
  tagBeige: '#F5F0E8',
  borderCream: '#E8E0D0',
};

const PRIORITY_TAG: Record<string, { bg: string; label: string }> = {
  high: { bg: C.tagRed, label: 'HIGH' },
  med: { bg: C.tagYellow, label: 'MED' },
  low: { bg: C.textMuted, label: 'LOW' },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }

function formatRunTimestamp(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** 彩色标签（ECHO 风格：彩色背景 + 黑边框 + Courier 大写） */
function tag(bg: string, text: string): string {
  return `<span style="display:inline-block;padding:2px 8px;background:${bg};border:1px solid ${C.borderBlack};border-radius:2px;font-family:'Courier New',monospace;font-size:10px;font-weight:700;color:#FFFFFF;letter-spacing:0.1em;text-transform:uppercase;">${escapeHtml(text)}</span>`;
}

/** 彩色圆点 */
function dot(color: string): string {
  return `<span style="display:inline-block;width:8px;height:8px;background:${color};border-radius:50%;margin-right:6px;vertical-align:middle;"></span>`;
}

/** 虚线分隔 + 标签（ECHO 风格） */
function dashedDivider(label: string): string {
  return `<tr><td style="padding:8px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:'Courier New',monospace;font-size:10px;color:${C.textMuted};letter-spacing:0.12em;text-transform:uppercase;white-space:nowrap;padding-right:8px;">${escapeHtml(label)}</td>
      <td style="border-top:1px dashed ${C.textMuted};width:100%;"></td>
    </tr></table>
  </td></tr>`;
}

// ── 渲染：cards 样式（ECHO 章节卡片模式） ──
function renderItemCard(item: EmailItem, index: number): string {
  const prio = PRIORITY_TAG[item.priority ?? 'low'] ?? PRIORITY_TAG.low;
  const accentColor = item.done ? C.tagGreen : C.primary;
  const doneMark = item.done ? '<span style="color:#4A7C59;font-size:14px;margin-right:4px;">&#x2713;</span>' : '';
  const timeBadge = item.time
    ? `<span style="font-family:'Courier New',monospace;font-size:14px;font-weight:700;color:${C.textPrimary};">${escapeHtml(item.time)}</span>`
    : '';
  const catDot = item.categoryColor ? dot(escapeHtml(item.categoryColor)) : '';
  const catName = item.categoryName
    ? `<span style="color:${C.textMuted};font-size:11px;font-family:'Courier New',monospace;">${escapeHtml(item.categoryName)}</span>`
    : '';
  const desc = item.desc ? `<p style="margin:6px 0 0 0;font-size:13px;color:${C.textSecondary};line-height:1.6;">${escapeHtml(item.desc)}</p>` : '';
  const urlLink = item.url
    ? `<p style="margin:6px 0 0 0;font-size:12px;"><a href="${escapeHtml(item.url)}" style="color:${C.primary};text-decoration:none;font-family:'Courier New',monospace;word-break:break-all;">${escapeHtml(item.url)}</a></p>`
    : '';

  // 黑色编号条头部（ECHO 章节 01/02/03 模式）
  const num = String(index + 1).padStart(2, '0');
  return `<tr><td style="padding:0 0 12px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bgWhite};border:2px solid ${C.borderBlack};border-radius:4px;overflow:hidden;${item.done ? 'opacity:0.6;' : ''}">
      <!-- 编号条 -->
      <tr><td style="background:${C.bgDark};padding:5px 14px;">
        <span style="font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:#FFFFFF;letter-spacing:0.15em;">${num}</span>
        ${timeBadge ? `<span style="float:right;font-family:'Courier New',monospace;font-size:12px;color:rgba(255,255,255,0.6);letter-spacing:0.1em;">${escapeHtml(item.time || '')}</span>` : ''}
      </td></tr>
      <!-- 内容区 -->
      <tr><td style="padding:12px 16px;">
        <div style="font-size:15px;color:${C.textPrimary};line-height:1.5;${item.done ? `text-decoration:line-through;color:${C.textMuted};` : ''}">${doneMark}${escapeHtml(item.text)}</div>
        ${desc}${urlLink}
        <div style="margin-top:8px;display:flex;align-items:center;gap:8px;">
          ${item.priority ? tag(prio.bg, prio.label) : ''}
          ${catDot ? `<span style="margin-left:4px;">${catDot}${catName}</span>` : ''}
          ${item.done ? tag(C.tagGreen, 'DONE') : ''}
        </div>
      </td></tr>
    </table>
  </td></tr>`;
}

// ── 渲染：list 样式 ──
function renderListItem(item: EmailItem): string {
  const pColor = PRIORITY_TAG[item.priority ?? 'low']?.bg ?? C.textMuted;
  const doneMark = item.done ? '<span style="color:#4A7C59;margin-right:6px;">&#x2713;</span>' : '';
  const timeTag = item.time ? `<span style="color:${C.textMuted};font-size:11px;margin-right:8px;font-family:'Courier New',monospace;">${escapeHtml(item.time)}</span>` : '';
  return `<tr><td style="padding:7px 0;border-bottom:1px solid ${C.borderCream};">
    ${dot(pColor)}${timeTag}${doneMark}<span style="font-size:14px;color:${C.textPrimary};${item.done ? `text-decoration:line-through;color:${C.textMuted};` : ''}">${escapeHtml(item.text)}</span>
  </td></tr>`;
}

// ── 渲染：keywords 样式（ECHO #tag 胶囊） ──
function renderKeywordItem(item: EmailItem, index: number): string {
  const num = index + 1;
  const numColor = num <= 3 ? C.tagRed : num <= 10 ? C.primary : C.textMuted;
  const doneMark = item.done ? ` ${tag(C.tagGreen, 'DONE')}` : '';
  // ECHO #tag 胶囊样式
  return `<tr><td style="padding:6px 0;">
    <span style="display:inline-block;padding:3px 12px;background:${C.bgCream};border:1px solid ${numColor};border-radius:999px;font-family:'Courier New',monospace;font-size:12px;color:${numColor};">
      <span style="font-weight:900;margin-right:4px;">${num}</span>${escapeHtml(item.text)}
    </span>${doneMark}
  </td></tr>`;
}

function renderSection(section: EmailSection, sectionIndex: number): string {
  const count = section.items.length;
  const sectionNum = String(sectionIndex + 1).padStart(2, '0');

  // section 标题：黑色条 + 橙色编号 + 标题文字（ECHO 章节标题模式）
  let html = `<tr><td style="padding:14px 0 0 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bgDark};border:2px solid ${C.borderBlack};border-radius:4px 4px 0 0;">
      <tr><td style="padding:6px 14px;">
        <span style="font-family:'Courier New',monospace;font-size:11px;font-weight:700;color:${C.primary};letter-spacing:0.15em;text-transform:uppercase;">SECTION ${sectionNum}</span>
        <span style="float:right;font-family:'Courier New',monospace;font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.1em;">${count > 0 ? `[${count} ITEMS]` : '[EMPTY]'}</span>
      </td></tr>
      <tr><td style="padding:0 14px 6px 14px;">
        <span style="font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:#FFFFFF;letter-spacing:0.1em;text-transform:uppercase;">${escapeHtml(section.title)}</span>
      </td></tr>
    </table>
  </td></tr>`;

  if (count === 0 && section.emptyMessage) {
    html += `<tr><td style="background:${C.bgWhite};border:2px solid ${C.borderBlack};border-top:none;border-radius:0 0 4px 4px;padding:16px;">
      <div style="color:${C.textMuted};font-size:13px;font-style:italic;font-family:'Courier New',monospace;text-align:center;">${escapeHtml(section.emptyMessage)}</div>
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
    itemsHtml = section.items.map((i, idx) => renderKeywordItem(i, idx)).join('');
  }

  html += `<tr><td style="background:${C.bgCream};border:2px solid ${C.borderBlack};border-top:none;border-radius:0 0 4px 4px;padding:12px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
  </td></tr>`;

  return html;
}

export function renderModeEmail(params: RenderEmailParams): { html: string; text: string; subject: string } {
  const { title, subtitle, sections, runAt, timezoneLabel, appUrl, footerNote } = params;
  const runStr = formatRunTimestamp(runAt);
  const subject = title;

  const sectionsHtml = sections.map((s, i) => renderSection(s, i)).join('');
  const footerLink = appUrl
    ? `<a href="${escapeHtml(appUrl)}" style="color:${C.primary};text-decoration:none;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">&#x23FB; cf-todo</a>`
    : `<span style="color:${C.textMuted};font-family:'Courier New',monospace;font-size:11px;">cf-todo</span>`;
  const footer = footerNote ?? '本邮件由 cf-todo 定时提醒服务自动发送。';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bgLight};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="min-height:100%;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- ═══ HEADER: 橙色条 + 品牌标题 ═══ -->
          <tr>
            <td style="background:${C.primary};border:2px solid ${C.borderBlack};border-radius:4px 4px 0 0;padding:24px;">
              <div style="font-family:'Courier New',monospace;font-size:28px;font-weight:900;color:#FFFFFF;letter-spacing:0.15em;text-transform:uppercase;line-height:1;">cf-todo</div>
              <div style="margin-top:8px;font-family:'Courier New',monospace;font-size:12px;color:rgba(255,255,255,0.65);letter-spacing:0.2em;text-transform:uppercase;">${escapeHtml(subtitle)}</div>
            </td>
          </tr>

          <!-- ═══ META BAR: 黄色条 + REC_DATE（ECHO LOGGED BY 模式） ═══ -->
          <tr>
            <td style="background:${C.tagYellow};border:2px solid ${C.borderBlack};border-top:none;padding:8px 16px;">
              ${dot(C.primary)}<span style="font-family:'Courier New',monospace;font-size:11px;font-weight:700;color:${C.textPrimary};letter-spacing:0.12em;text-transform:uppercase;">REC_DATE: ${escapeHtml(runStr)} (${escapeHtml(timezoneLabel)})</span>
            </td>
          </tr>

          <!-- ═══ DIVIDER: 虚线 + ARCHIVE_LABEL ═══ -->
          ${dashedDivider('// REMINDER_LOG')}

          <!-- ═══ SECTIONS ═══ -->
          ${sectionsHtml}

          <!-- ═══ FOOTER ═══ -->
          ${dashedDivider('// END')}
          <tr>
            <td style="padding:8px 0 16px 0;">
              <div style="font-size:11px;color:${C.textMuted};line-height:1.6;font-family:'Courier New',monospace;letter-spacing:0.05em;">
                ${escapeHtml(footer)}
                <br>${footerLink}
              </div>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding:0 0 4px 0;">
              <span style="font-family:'Courier New',monospace;font-size:10px;color:${C.textMuted};letter-spacing:0.2em;opacity:0.5;text-transform:uppercase;">[ END OF LOG ]</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // 纯文本回退
  const textParts: string[] = [`cf-todo ${title}`, subtitle, `REC_DATE: ${runStr} (${timezoneLabel})`, ''];
  sections.forEach((s, i) => {
    textParts.push(`[SECTION ${String(i + 1).padStart(2, '0')}] ${s.title} (${s.items.length})`);
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
  textParts.push('[ END OF LOG ]', 'cf-todo');
  const text = textParts.join('\n');

  return { html, text, subject };
}
