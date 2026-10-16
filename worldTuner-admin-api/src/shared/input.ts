import type { Context } from 'hono';
import type { AdminEnv } from '../types.ts';
import { ApiError } from './errors.ts';
import { integer, validateParams } from './validation.ts';

/**
 * 只允许 JSON 对象及明确声明的字段；统一限制输入字节，拒绝额外字段避免批量赋值。
 */
export async function jsonInput(
  c: Context<AdminEnv>,
  fields: string[],
): Promise<Record<string, unknown>> {
  if (c.req.header('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON required');
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.length > 16384) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Payload exceeds 16 KB');
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, 'INVALID_INPUT', 'Invalid JSON');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError(400, 'INVALID_INPUT', 'JSON object required');
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).some(
      // 拒绝不在当前业务白名单中的属性。
      (key) => !fields.includes(key),
    )
  )
    throw new ApiError(400, 'INVALID_INPUT', 'Unexpected field');
  return body;
}

/**
 * 校验可空文本；空字符串归一化为 null，非空文本按字段长度限制。
 */
export function text(value: unknown, field: string, max: number, nullable = false): string | null {
  if (nullable && (value === null || value === '')) return null;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new ApiError(400, 'INVALID_INPUT', `Invalid ${field}`);
  return value.trim();
}

/**
 * 播放和网站地址只接受无账号密码的 HTTP(S)，不在服务端请求用户提交的 URL。
 */
export function httpUrl(value: unknown, field: string, nullable = true): string | null {
  const result = text(value, field, 2048, nullable);
  if (result === null) return null;
  try {
    const url = new URL(result);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return result;
  } catch {
    // 无效 URL 在下方统一转换为输入错误。
  }
  throw new ApiError(400, 'INVALID_INPUT', `Invalid ${field} URL`);
}

/**
 * 限制管理列表页大小、翻页深度及关键字；额外参数由调用方显式声明。
 */
export function pageQuery(params: URLSearchParams, extra: string[] = []) {
  validateParams(params, ['page', 'pageSize', 'q', ...extra]);
  const page = integer(params.get('page'), 'page', 1, 1000);
  const pageSize = integer(params.get('pageSize'), 'pageSize', 20, 50);
  const q = params.get('q')?.trim() ?? '';
  if (q.length > 100) throw new ApiError(400, 'INVALID_INPUT', 'Search exceeds 100 characters');
  return { page, pageSize, q, offset: (page - 1) * pageSize };
}

/**
 * 将查询词转义为 LIKE 字面量，通配符不能扩展搜索范围。
 */
export function searchPattern(value: string): string {
  return `%${value.replace(
    /[\\%_]/g,
    // SQLite LIKE 使用反斜线转义用户输入中的通配符。
    (character) => `\\${character}`,
  )}%`;
}

/**
 * 乐观锁快照保持读取时的原始文本，不 trim 或归一化，避免人工译名因空白无法保存。
 */
export function nullableSnapshot(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 200)
    throw new ApiError(400, 'INVALID_INPUT', `Invalid ${field}`);
  return value;
}
