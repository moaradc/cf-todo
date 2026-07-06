/**
 * 提醒邮件 HTML 模板 —— section-based 通用布局，支持多模式提醒。
 *
 * 各模式（timed / daily / priority / hot_search）只需组装 EmailSection[]
 * 传入 renderModeEmail，无需各自维护完整 HTML 骨架。
 *
 * 兼容性：内联 CSS + 表格布局（Outlook 不支持 flexbox/grid），
 * prefers-color-scheme 暗色模式，最大宽度 600px 移动端自适应。
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
const PRIORITY_COLOR: Record<string, string> = { high: '#ef4444', med: '#3b82f6', low: '#9ca3af' };

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }

function formatRunTimestamp(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

function renderItemCard(item: EmailItem, tzLabel: string): string {
  const pColor = PRIORITY_COLOR[item.priority ?? 'low'] ?? PRIORITY_COLOR.low;
  const pLabel = PRIORITY_LABEL[item.priority ?? 'low'] ?? '低';
  const timeBadge = item.time
    ? `<div style="font-size:15px;font-weight:600;color:#111827;line-height:1.2;">${escapeHtml(item.time)}</div><div style="font-size:11px;color:#9ca3af;margin-top:2px;">${escapeHtml(tzLabel)}</div>`
    : '';
  const doneMark = item.done ? '<span style="color:#22c55e;font-size:14px;margin-right:4px;">✓</span>' : '';
  const catDot = item.categoryColor
    ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${escapeHtml(item.categoryColor)};margin-right:6px;vertical-align:middle;"></span>`
    : '';
  const catName = item.categoryName
    ? `<span style="color:#6b7280;font-size:12px;vertical-align:middle;">${escapeHtml(item.categoryName)}</span>`
    : '';
  const desc = item.desc ? `<div style="margin-top:6px;color:#4b5563;font-size:13px;line-height:1.5;">${escapeHtml(item.desc)}</div>` : '';
  const urlLink = item.url ? `<div style="margin-top:6px;font-size:12px;"><a href="${escapeHtml(item.url)}" style="color:#3b82f6;text-decoration:none;word-break:break-all;">${escapeHtml(item.url)}</a></div>` : '';
  const prioTag = item.priority
    ? `<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:${pColor}1a;color:${pColor};font-size:11px;font-weight:600;">${pLabel}优先级</span>`
    : '';
  const catTag = catDot ? `<span style="margin-left:8px;">${catDot}${catName}</span>` : '';

  const hasLeftCol = !!timeBadge;
  return `<tr><td style="padding:0 0 12px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;${item.done ? 'opacity:0.65;' : ''}border-left:4px solid ${item.done ? '#22c55e' : pColor};">
      <tr><td style="padding:14px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${hasLeftCol ? `<td style="vertical-align:top;width:64px;">${timeBadge}</td>` : ''}
            <td style="vertical-align:top;${hasLeftCol ? 'padding-left:12px;' : ''}">
              <div style="font-size:15px;color:#111827;line-height:1.5;${item.done ? 'text-decoration:line-through;color:#9ca3af;' : ''}">${doneMark}${escapeHtml(item.text)}</div>
              ${desc}${urlLink}
              ${(prioTag || catTag) ? `<div style="margin-top:8px;">${prioTag}${catTag}</div>` : ''}
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

function renderListItem(item: EmailItem): string {
  const pColor = PRIORITY_COLOR[item.priority ?? 'low'] ?? PRIORITY_COLOR.low;
  const doneMark = item.done ? '<span style="color:#22c55e;margin-right:6px;">✓</span>' : '';
  const timeTag = item.time ? `<span style="color:#6b7280;font-size:12px;margin-right:8px;">${escapeHtml(item.time)}</span>` : '';
  return `<tr><td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${pColor};margin-right:8px;vertical-align:middle;"></span>
    ${timeTag}${doneMark}<span style="font-size:14px;color:#111827;${item.done ? 'text-decoration:line-through;color:#9ca3af;' : ''}">${escapeHtml(item.text)}</span>
  </td></tr>`;
}

function renderKeywordItem(item: EmailItem, index: number): string {
  const num = index + 1;
  const numColor = num <= 3 ? '#ef4444' : num <= 10 ? '#f59e0b' : '#6b7280';
  return `<tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
    <span style="display:inline-block;width:24px;color:${numColor};font-weight:700;font-size:14px;">${num}</span>
    <span style="font-size:14px;color:#111827;">${escapeHtml(item.text)}</span>
  </td></tr>`;
}

function renderSection(section: EmailSection, tzLabel: string): string {
  const count = section.items.length;
  const header = `<tr><td style="padding:16px 24px 8px 24px;">
    <div style="font-size:14px;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin-bottom:4px;">${escapeHtml(section.title)} ${count > 0 ? `<span style="color:#9ca3af;font-weight:400;font-size:12px;">(${count})</span>` : ''}</div>
  </td></tr>`;

  if (count === 0 && section.emptyMessage) {
    return header + `<tr><td style="padding:8px 24px;"><div style="color:#9ca3af;font-size:13px;font-style:italic;">${escapeHtml(section.emptyMessage)}</div></td></tr>`;
  }

  const style = section.listStyle ?? 'cards';
  let itemsHtml = '';
  if (style === 'cards') {
    itemsHtml = section.items.map((i) => renderItemCard(i, tzLabel)).join('');
  } else if (style === 'list') {
    itemsHtml = section.items.map((i) => renderListItem(i)).join('');
  } else {
    itemsHtml = section.items.map((i, idx) => renderKeywordItem(i, idx)).join('');
  }

  return header + `<tr><td style="padding:0 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table></td></tr>`;
}

export function renderModeEmail(params: RenderEmailParams): { html: string; text: string; subject: string } {
  const { title, subtitle, sections, runAt, timezoneLabel, appUrl, footerNote } = params;
  const runStr = formatRunTimestamp(runAt);
  const subject = title;

  const sectionsHtml = sections.map((s) => renderSection(s, timezoneLabel)).join('');
  const footerLink = appUrl
    ? `<a href="${escapeHtml(appUrl)}" style="color:#6b7280;text-decoration:none;">前往 cf-todo 查看</a>`
    : '<span style="color:#9ca3af;">cf-todo</span>';
  const footer = footerNote ?? '本邮件由 cf-todo 定时提醒服务自动发送。如需关闭或修改提醒设置，请在应用「设置」中调整。';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(subject)}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .shell { background:#0f172a !important; }
      .card-outer { background:#1e293b !important; border-color:#334155 !important; }
      .text-primary { color:#f1f5f9 !important; }
      .text-muted { color:#94a3b8 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="min-height:100%;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);background-color:#6366f1;padding:28px 32px;">
              <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">cf-todo</div>
              <div style="margin-top:6px;font-size:13px;color:rgba(255,255,255,0.85);">${escapeHtml(subtitle)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <div class="text-muted" style="font-size:12px;color:#6b7280;">检查时间：${escapeHtml(runStr)}（${escapeHtml(timezoneLabel)}）</div>
            </td>
          </tr>
          ${sectionsHtml}
          <tr>
            <td style="padding:8px 32px 28px 32px;">
              <div style="border-top:1px solid #e5e7eb;padding-top:16px;font-size:12px;color:#9ca3af;line-height:1.6;">
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
  const textParts: string[] = [`cf-todo ${title}`, subtitle, `检查时间：${runStr}（${timezoneLabel}）`, ''];
  for (const s of sections) {
    textParts.push(`【${s.title}】(${s.items.length})`);
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
  textParts.push('--', '本邮件由 cf-todo 自动发送。');
  const text = textParts.join('\n');

  return { html, text, subject };
}
