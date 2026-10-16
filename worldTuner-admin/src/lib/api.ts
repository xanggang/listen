import type { Session } from './contracts.ts';
let csrf = '';
export class AdminApiError extends Error {
  readonly status: number;
  readonly requestId: string | undefined;
  /**
   * 保留安全错误与请求 ID 供界面排查，不包含认证头或原始响应正文。
   */
  constructor(status: number, message: string, requestId?: string) {
    super(message);
    this.status = status;
    this.requestId = requestId;
  }
}
/**
 * 同源请求仅访问管理 API，写请求携带内存 CSRF；失败保留 HTTP 状态和请求 ID。
 */
export async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'PUT';
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  if (!path.startsWith('/admin/api/') || path.includes('://'))
    throw new Error('Invalid admin API path');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.method === 'PUT') {
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = csrf;
  }
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });
  const payload: unknown = await response.json().catch(
    // Access 会话过期可能返回 HTML，转换为统一错误，不向界面回显原文。
    () => null,
  );
  if (!response.ok) {
    const error =
      payload && typeof payload === 'object' && 'error' in payload
        ? payload.error
        : null;
    const message =
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
        ? error.message
        : '请求失败，请刷新登录状态后重试';
    throw new AdminApiError(
      response.status,
      message,
      response.headers.get('X-Request-Id') ?? undefined,
    );
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload))
    throw new AdminApiError(502, '接口返回格式异常');
  return payload.data as T;
}
/**
 * 获取会话时刷新 CSRF，写入前可调用以避免半小时页面停留导致失效。
 */
export async function loadSession(): Promise<Session> {
  const session = await apiRequest<Session>('/admin/api/me');
  csrf = session.csrfToken;
  return session;
}
/**
 * 保存前刷新当前身份及 CSRF，失败不自动重试写请求，避免重复修改。
 */
export async function save<T>(path: string, body: unknown): Promise<T> {
  await loadSession();
  return apiRequest<T>(path, { method: 'PUT', body });
}
/**
 * 将异常转换为可读文本；请求 ID 便于与服务端诊断关联。
 */
export function errorMessage(error: unknown): string {
  return error instanceof AdminApiError
    ? `${error.message}${error.requestId ? `（请求 ${error.requestId}）` : ''}`
    : error instanceof Error
      ? error.message
      : '操作失败，请重试';
}
