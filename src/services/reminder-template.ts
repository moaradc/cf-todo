/**
 * 提醒邮件 HTML 模板 —— 内联样式 + 表格布局，兼容主流邮件客户端。
 *
 * 设计要点：
 *   - 内联 CSS（Gmail / Outlook 不支持 <style>）
 *   - 表格布局（Outlook 不支持 flexbox / grid）
 *   - 最大宽度 600px，移动端自适应
 *   - prefers-color-scheme 暗色模式（在支持的客户端生效）
 *   - 文本 + 链接均使用 Web 安全字体栈
 */

import type { DueTodo } from './reminder-service';

const PRIORITY_LABEL: Record<string, string> = {
  high: '高',
  med: '中',
  low: '低',
};

const PRIORITY_COLOR: Record<string, string> = {
  high: '#ef4444',
  med: '#3b82f6',
  low: '#9ca3af',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatLocalTime(time: string): string {
  // time 已是 HH:MM 格式，原样展示；做一次轻量校验
  if (/^\d{2}:\d{2}$/.test(time)) return time;
  return time;
}

function formatRunTimestamp(d: Date): string {
  // d 已是「位移到目标时区」后的 Date，用 UTC getter 读取即为目标时区的壁钟时间
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const hh = pad2(d.getUTCHours());
  const mm = pad2(d.getUTCMinutes());
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function renderTodoCard(todo: DueTodo, tzLabel: string): string {
  const priority = PRIORITY_LABEL[todo.priority] ?? '低';
  const pColor = PRIORITY_COLOR[todo.priority] ?? PRIORITY_COLOR.low;
  const time = formatLocalTime(todo.time);

  const categoryDot = todo.categoryColor
    ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${escapeHtml(todo.categoryColor)};margin-right:6px;vertical-align:middle;"></span>`
    : '';
  const categoryName = todo.categoryName
    ? `<span style="color:#6b7280;font-size:12px;vertical-align:middle;">${escapeHtml(todo.categoryName)}</span>`
    : '';

  const urlLink = todo.url
    ? `<div style="margin-top:6px;font-size:12px;"><a href="${escapeHtml(todo.url)}" style="color:#3b82f6;text-decoration:none;word-break:break-all;">${escapeHtml(todo.url)}</a></div>`
    : '';

  const desc = todo.desc
    ? `<div style="margin-top:6px;color:#4b5563;font-size:13px;line-height:1.5;">${escapeHtml(todo.desc)}</div>`
    : '';

  return `
    <tr>
      <td style="padding:0 0 12px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;border-left:4px solid ${pColor};">
          <tr>
            <td style="padding:14px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:top;width:64px;">
                    <div style="font-size:15px;font-weight:600;color:#111827;line-height:1.2;">${escapeHtml(time)}</div>
                    <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${escapeHtml(tzLabel)}</div>
                  </td>
                  <td style="vertical-align:top;padding-left:12px;">
                    <div style="font-size:15px;color:#111827;line-height:1.5;">${escapeHtml(todo.text)}</div>
                    ${desc}
                    ${urlLink}
                    <div style="margin-top:8px;">
                      <span style="display:inline-block;padding:2px 8px;border-radius:10px;background:${pColor}1a;color:${pColor};font-size:11px;font-weight:600;">${priority}优先级</span>
                      ${categoryDot ? `<span style="margin-left:8px;">${categoryDot}${categoryName}</span>` : ''}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export interface TemplateData {
  todos: DueTodo[];
  runAt: Date;
  timezoneLabel: string;
  leadMinutes: number;
  appUrl?: string;
}

export function renderReminderEmail(data: TemplateData): { html: string; text: string; subject: string } {
  const { todos, runAt, timezoneLabel, leadMinutes, appUrl } = data;
  const count = todos.length;
  const runStr = formatRunTimestamp(runAt);

  const subject = `【待办提醒】${count} 项任务即将到期（${runStr}）`;

  const cards = todos.map((t) => renderTodoCard(t, timezoneLabel)).join('');

  const headerSubtitle = `未来 ${leadMinutes} 分钟内到期的待办事项`;
  const footerLink = appUrl
    ? `<a href="${escapeHtml(appUrl)}" style="color:#6b7280;text-decoration:none;">前往 cf-todo 查看</a>`
    : '<span style="color:#9ca3af;">cf-todo</span>';

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
              <div style="margin-top:6px;font-size:13px;color:rgba(255,255,255,0.85);">${escapeHtml(headerSubtitle)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <div class="text-primary" style="font-size:15px;color:#111827;line-height:1.6;">
                你好，当前有 <strong style="color:#6366f1;font-size:18px;">${count}</strong> 项待办即将到期，请及时处理。
              </div>
              <div class="text-muted" style="margin-top:4px;font-size:12px;color:#6b7280;">检查时间：${escapeHtml(runStr)}（${escapeHtml(timezoneLabel)}）</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 8px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${cards}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px 32px;">
              <div style="border-top:1px solid #e5e7eb;padding-top:16px;font-size:12px;color:#9ca3af;line-height:1.6;">
                本邮件由 cf-todo 定时提醒服务自动发送。如需关闭或修改提醒设置，请在应用「设置」中调整。
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

  // 纯文本回退：部分客户端 / 邮件预览会用
  const textLines = todos.map((t, i) => {
    const parts = [`[${i + 1}] ${t.time}  ${t.text}`];
    if (t.priority === 'high') parts.push('    优先级：高');
    if (t.categoryName) parts.push(`    分类：${t.categoryName}`);
    if (t.url) parts.push(`    链接：${t.url}`);
    return parts.join('\n');
  });
  const text = `cf-todo 待办提醒\n${headerSubtitle}\n检查时间：${runStr}（${timezoneLabel}）\n\n共有 ${count} 项即将到期：\n\n${textLines.join('\n\n')}\n\n--\n本邮件由 cf-todo 自动发送。`;

  return { html, text, subject };
}
