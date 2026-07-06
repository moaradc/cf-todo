/**
 * Resend API 客户端 —— 基于 fetch 的轻量封装，适配 Cloudflare Workers 运行时。
 *
 * 不使用官方 `resend` SDK：SDK 依赖 Node.js 模块，bundle 体积大且在 Workers
 * 上需额外兼容层；Resend REST API 本身只是单一 POST，直接 fetch 更干净。
 *
 * 端点：POST https://api.resend.com/emails
 * 鉴权：Authorization: Bearer <RESEND_API_KEY>
 * 幂等：Idempotency-Key 头（24h 内同 key 复用，避免重复发信）
 * 成功响应：{ id: "uuid" }
 * 失败响应：{ message: string, name?: string } 或非 JSON 体
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 15000;
const IDEMPOTENCY_KEY_MAX_LEN = 256;

export interface ResendEmailPayload {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
  /**
   * 幂等键。24h 内对同一 key 的重复请求，Resend 只发一次邮件。
   * 调用方应保证唯一且稳定（如 `cf-todo:<todo_id>@<due_at>`），
   * 超过 256 字符会被截断（仍保持 SHA-256 稳定前缀）。
   */
  idempotencyKey?: string;
}

export interface ResendSendResult {
  ok: boolean;
  id?: string;
  error?: string;
  status?: number;
}

function normalizeRecipients(to: string | string[]): string[] {
  const arr = Array.isArray(to) ? to : [to];
  return arr.map((s) => s.trim()).filter(Boolean);
}

function isValidEmail(email: string): boolean {
  // 简单格式校验，避免明显错误打到 API
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function extractAddress(mailbox: string): string {
  // 支持 "Name <addr@x.com>" 格式，提取尖括号内地址
  const m = mailbox.match(/<([^>]+)>/);
  return m ? m[1].trim() : mailbox.trim();
}

/**
 * 规范化幂等键：截断到 Resend 限制的 256 字符。
 *
 * 截断策略：直接取前 256 字符。调用方应优先用 SHA-256 hex 这种定长短串
 * （32 字符），不会触发截断；万一调用方传了长串也兜底不报错。
 */
function normalizeIdempotencyKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  const trimmed = key.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.length > IDEMPOTENCY_KEY_MAX_LEN
    ? trimmed.slice(0, IDEMPOTENCY_KEY_MAX_LEN)
    : trimmed;
}

export function validatePayload(payload: ResendEmailPayload): string | null {
  if (!payload.from) return 'from is required';
  if (!isValidEmail(extractAddress(payload.from))) return `invalid from address: ${payload.from}`;
  const recipients = normalizeRecipients(payload.to);
  if (recipients.length === 0) return 'to must be a non-empty string or array';
  for (const r of recipients) {
    if (!isValidEmail(extractAddress(r))) return `invalid recipient: ${r}`;
  }
  if (!payload.subject?.trim()) return 'subject is required';
  if (!payload.html && !payload.text) return 'either html or text is required';
  return null;
}

/**
 * 调用 Resend API 发送邮件。
 *
 * 失败模式（均返回 { ok: false }，不抛异常，便于调用方统一处理）：
 *   - payload 校验失败
 *   - 网络错误 / 超时
 *   - Resend 返回非 2xx（含 422 校验错误、429 限流、5xx 服务异常）
 *
 * 注意：429 限流时不应重试（Resend 限流窗口较长），调用方应记录并跳过。
 */
export async function sendEmail(
  apiKey: string,
  payload: ResendEmailPayload,
): Promise<ResendSendResult> {
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY is not set' };
  }

  const validationError = validatePayload(payload);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  // 序列化时排除 idempotencyKey：它属于 HTTP 头而非 Resend body 字段，
  // 混入 body 会触发 Resend 422 校验错误。
  const { idempotencyKey: _omit, ...bodyFields } = payload;
  const body = JSON.stringify(bodyFields);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  const idempotencyKey = normalizeIdempotencyKey(_omit);
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `network error: ${msg}` };
  } finally {
    clearTimeout(timer);
  }

  if (response.status >= 200 && response.status < 300) {
    let id: string | undefined;
    try {
      const data = (await response.json()) as { id?: string };
      id = data?.id;
    } catch {
      // 成功响应体无法解析不视为失败，id 缺省
    }
    return { ok: true, id };
  }

  // 非 2xx：尝试解析错误体
  let errorMsg = `HTTP ${response.status}`;
  try {
    const text = await response.text();
    if (text) {
      try {
        const data = JSON.parse(text) as { message?: string; name?: string; error?: string };
        const parts = [data.name, data.message || data.error].filter(Boolean);
        if (parts.length) errorMsg = parts.join(': ');
      } catch {
        errorMsg = text.slice(0, 200);
      }
    }
  } catch {
    // 响应体读取失败，保留 HTTP 状态码
  }
  return { ok: false, status: response.status, error: errorMsg };
}
