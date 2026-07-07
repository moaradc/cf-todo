/**
 * 提醒邮件 HTML 模板 —— ECHO 复古未来终端风格。
 * 参考 ECHO 奇点日志设计语言：橙色主色 + 黑色粗边框 + 偏移阴影 + 等宽字体标签。
 * 内联 CSS + 表格布局，兼容主流邮件客户端。
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

const PRIORITY_LABEL: Record<string, string> = { high: '高', med: '中', low: '低' };
const PRIORITY_COLOR: Record<string, string> = { high: '#CC3333', med: '#E85D04', low: '#8A8A8A' };
const PRIORITY_BG: Record<string, string> = { high: '#CC3333', med: '#F5A623', low: '#8A8A8A' };

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }

function formatRunTimestamp(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

function renderItemCard(item: EmailItem): string {
  const pColor = PRIORITY_COLOR[item.priority ?? 'low'] ?? PRIORITY_COLOR.low;
  const pBg = PRIORITY_BG[item.priority ?? 'low'] ?? PRIORITY_BG.low;
  const pLabel = PRIORITY_LABEL[item.priority ?? 'low'] ?? '低';
  const accentColor = item.done ? '#4A7C59' : pColor;
  const timeBadge = item.time
    ? `<div style="font-family:'Courier New',monospace;font-size:15px;font-weight:700;color:#1A1A1A;line-height:1.2;">${escapeHtml(item.time)}</div>`
    : '';
  const doneMark = item.done ? '<span style="color:#4A7C59;font-size:14px;margin-right:4px;">&#x2713;</span>' : '';
  const catDot = item.categoryColor
    ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${escapeHtml(item.categoryColor)};margin-right:6px;vertical-align:middle;"></span>`
    : '';
  const catName = item.categoryName
    ? `<span style="color:#8A8A8A;font-size:11px;vertical-align:middle;font-family:'Courier New',monospace;">${escapeHtml(item.categoryName)}</span>`
    : '';
  const desc = item.desc ? `<div style="margin-top:6px;color:#4A4A4A;font-size:13px;line-height:1.5;">${escapeHtml(item.desc)}</div>` : '';
  const urlLink = item.url ? `<div style="margin-top:6px;font-size:12px;"><a href="${escapeHtml(item.url)}" style="color:#E85D04;text-decoration:none;word-break:break-all;font-family:'Courier New',monospace;">${escapeHtml(item.url)}</a></div>` : '';
  const prioTag = item.priority
    ? `<span style="display:inline-block;padding:2px 8px;background:${pBg};color:#FFFFFF;font-size:10px;font-weight:700;font-family:'Courier New',monospace;letter-spacing:0.1em;text-transform:uppercase;border-radius:2px;">${pLabel}</span>`
    : '';
  const catTag = catDot ? `<span style="margin-left:8px;">${catDot}${catName}</span>` : '';
  const hasLeft = !!timeBadge;

  return `<tr><td style="padding:0 0 10px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:2px solid #000000;border-radius:4px;${item.done ? 'opacity:0.65;' : ''}">
      <tr><td style="padding:14px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${hasLeft ? `<td style="vertical-align:top;width:60px;border-right:2px solid #000000;padding-right:12px;">${timeBadge}<div style="font-size:10px;color:#8A8A8A;margin-top:2px;font-family:'Courier New',monospace;">TIME</div></td>` : ''}
            <td style="vertical-align:top;${hasLeft ? 'padding-left:14px;' : ''}">
              <div style="font-size:15px;color:#1A1A1A;line-height:1.5;${item.done ? 'text-decoration:line-through;color:#8A8A8A;' : ''}">${doneMark}${escapeHtml(item.text)}</div>
              ${desc}${urlLink}
              ${prioTag ? `<div style="margin-top:8px;">${prioTag}${catTag}</div>` : ''}
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

function renderListItem(item: EmailItem): string {
  const pColor = PRIORITY_COLOR[item.priority ?? 'low'] ?? PRIORITY_COLOR.low;
  const doneMark = item.done ? '<span style="color:#4A7C59;margin-right:6px;">&#x2713;</span>' : '';
  const timeTag = item.time ? `<span style="color:#8A8A8A;font-size:11px;margin-right:8px;font-family:'Courier New',monospace;">${escapeHtml(item.time)}</span>` : '';
  return `<tr><td style="padding:7px 0;border-bottom:1px solid #E8E0D0;">
    <span style="display:inline-block;width:6px;height:6px;background:${pColor};margin-right:8px;vertical-align:middle;"></span>
    ${timeTag}${doneMark}<span style="font-size:14px;color:#1A1A1A;${item.done ? 'text-decoration:line-through;color:#8A8A8A;' : ''}">${escapeHtml(item.text)}</span>
  </td></tr>`;
}

function renderKeywordItem(item: EmailItem, index: number): string {
  const num = index + 1;
  const numColor = num <= 3 ? '#CC3333' : num <= 10 ? '#E85D04' : '#8A8A8A';
  const doneMark = item.done ? '<span style="color:#4A7C59;margin-left:6px;">&#x2713;</span>' : '';
  return `<tr><td style="padding:7px 0;border-bottom:1px solid #E8E0D0;">
    <span style="display:inline-block;width:24px;color:${numColor};font-weight:900;font-size:14px;font-family:'Courier New',monospace;">${num}</span>
    <span style="font-size:14px;color:#1A1A1A;">${escapeHtml(item.text)}</span>${doneMark}
  </td></tr>`;
}

function renderSection(section: EmailSection): string {
  const count = section.items.length;
  // section 标题：橙色填充 + 黑色粗边框
  const header = `<tr><td style="padding:14px 0 0 0;">
    <div style="background:#E85D04;border:2px solid #000000;padding:6px 12px;border-radius:4px 4px 0 0;">
      <span style="font-family:'Courier New',monospace;font-size:12px;font-weight:700;color:#FFFFFF;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(section.title)}${count > 0 ? ` (${count})` : ''}</span>
    </div>
  </td></tr>`;

  if (count === 0 && section.emptyMessage) {
    return header + `<tr><td style="background:#FFFFFF;border:2px solid #000000;border-top:none;border-radius:0 0 4px 4px;padding:12px 16px;">
      <div style="color:#8A8A8A;font-size:13px;font-style:italic;font-family:'Courier New',monospace;">${escapeHtml(section.emptyMessage)}</div>
    </td></tr>`;
  }

  const style = section.listStyle ?? 'cards';
  let itemsHtml = '';
  if (style === 'cards') {
    itemsHtml = section.items.map(renderItemCard).join('');
  } else if (style === 'list') {
    itemsHtml = section.items.map(renderListItem).join('');
  } else {
    itemsHtml = section.items.map((i, idx) => renderKeywordItem(i, idx)).join('');
  }

  // 内容区：白底 + 黑色粗边框（与标题条无缝衔接）
  return header + `<tr><td style="background:#FAF6EE;border:2px solid #000000;border-top:none;border-radius:0 0 4px 4px;padding:12px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
  </td></tr>`;
}

export function renderModeEmail(params: RenderEmailParams): { html: string; text: string; subject: string } {
  const { title, subtitle, sections, runAt, timezoneLabel, appUrl, footerNote } = params;
  const runStr = formatRunTimestamp(runAt);
  const subject = title;

  const sectionsHtml = sections.map(renderSection).join('');
  const footerLink = appUrl
    ? `<a href="${escapeHtml(appUrl)}" style="color:#E85D04;text-decoration:none;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;">&#x23FB; cf-todo</a>`
    : '<span style="color:#8A8A8A;font-family:\'Courier New\',monospace;font-size:11px;">cf-todo</span>';
  const footer = footerNote ?? '本邮件由 cf-todo 定时提醒服务自动发送。';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="min-height:100%;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- HEADER: 橙色条 + 黑色底边 -->
          <tr>
            <td style="background:#E85D04;border:2px solid #000000;border-radius:4px 4px 0 0;padding:20px 24px;">
              <div style="font-family:'Courier New',monospace;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:0.12em;text-transform:uppercase;">cf-todo</div>
              <div style="margin-top:4px;font-family:'Courier New',monospace;font-size:12px;color:rgba(255,255,255,0.7);letter-spacing:0.15em;text-transform:uppercase;">${escapeHtml(subtitle)}</div>
            </td>
          </tr>

          <!-- META BAR: 黄色条 + 检查时间 -->
          <tr>
            <td style="background:#F5A623;border:2px solid #000000;border-top:none;padding:8px 16px;">
              <span style="display:inline-block;width:8px;height:8px;background:#E85D04;border-radius:50%;margin-right:8px;vertical-align:middle;"></span>
              <span style="font-family:'Courier New',monospace;font-size:11px;font-weight:700;color:#1A1A1A;letter-spacing:0.1em;">REC_DATE: ${escapeHtml(runStr)} (${escapeHtml(timezoneLabel)})</span>
            </td>
          </tr>

          <!-- CONTENT: sections -->
          ${sectionsHtml}

          <!-- FOOTER -->
          <tr>
            <td style="padding:16px 0;">
              <div style="border-top:2px solid #000000;padding-top:12px;font-size:11px;color:#8A8A8A;line-height:1.6;font-family:'Courier New',monospace;letter-spacing:0.05em;">
                ${escapeHtml(footer)}
                <br>${footerLink}
              </div>
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
  for (const s of sections) {
    textParts.push(`[${s.title}] (${s.items.length})`);
    if (s.items.length === 0 && s.emptyMessage) {
      textParts.push('  ' + s.emptyMessage);
    } else {
      s.items.forEach((item, i) => {
        const bits = [`  [${i + 1}]`];
        if (item.time) bits.push(item.time);
        bits.push(item.text);
        if (item.done) bits.push('(已完成)');
        textParts.push(bits.join(' '));
      });
    }
    textParts.push('');
  }
  textParts.push('--', '[ END OF LOG ]', 'cf-todo');
  const text = textParts.join('\n');

  return { html, text, subject };
}
