/**
 * utils.js 类型声明
 *
 * utils.js 是纯 JS（allowJs=true，checkJs=false），TS 推断其函数签名为 any。
 * 本声明文件提供精确类型，让中间件层有类型推断。
 * 阶段 5+ 迁移 utils.js 到 TS 时本文件可删除。
 */

/** cookie 解析结果：name → value 映射。 */
export interface CookieMap {
  [name: string]: string;
}

export declare const APP_VERSION: string;
export declare const DB_SCHEMA: number;
export declare const CHANGELOG: unknown;
export declare const DEFAULT_CATEGORY_COLOR: string;
export declare const MAX_BROWSER_UA: number;

export declare function parseCookies(request: Request): CookieMap;
export declare function sign(data: string, secret: string): Promise<string>;
export declare function verify(data: string, signature: string, secret: string): Promise<boolean>;
export declare function generateSessionToken(): string;
/** 恒定时间比较（HMAC），用于密码 + API Key。secret 必须为常量。 */
export declare function secureCompare(a: string, b: string, secret: string): Promise<boolean>;

export declare function getDayOfWeek(date: string): number;
export declare function formatDateStr(date: Date | string): string;
export declare function offsetDate(date: string, days: number): string;
export declare function fetchHotSearchData(providerName?: string): Promise<unknown>;
/** 统一错误响应。 */
export declare function apiError(message: string, status?: number): Response;
export declare function normalizePriority(p: string | undefined): string;
export declare function parseJsonField(v: unknown): string;
export declare function validateStatsDateRange(start: string | null, end: string | null): { ok: true } | { ok: false; error: string };
