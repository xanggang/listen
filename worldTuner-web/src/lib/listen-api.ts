import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { headers } from 'next/headers';
import { getListenApiBaseUrl } from './listen-api-config';

export class ListenApiError extends Error {
  /** 保留 HTTP 状态，供兼容门面区分不存在与服务故障。 */
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * 读取独立 API 的原始响应，保留 ETag、304 和缓存头；额外标头由服务端固定调用点提供。
 * 开发模式直连本地服务，生产默认使用 Worker 绑定，十秒超时。
 */
export async function apiFetch(
  path: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const incoming = await headers();
  const ip = incoming.get('cf-connecting-ip');
  const requestHeaders: Record<string, string> = { Accept: 'application/json', ...extraHeaders };
  if (ip) requestHeaders['CF-Connecting-IP'] = ip;
  const options = { method: 'GET', headers: requestHeaders, signal: AbortSignal.timeout(10000) };
  const baseUrl = getListenApiBaseUrl();
  let response: Response;
  if (baseUrl) {
    // Explicit override for local development or a non-Cloudflare Web host.
    response = await fetch(new URL(path, baseUrl), { ...options, cache: 'no-store' });
  } else {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.LISTEN_API) throw new Error('LISTEN_API binding or LISTEN_API_BASE_URL is required');
    // 使用 URL + init，避免 Next.js 与 Wrangler 的 Request 实现跨运行时不兼容。
    response = await env.LISTEN_API.fetch(`https://listen-api.internal${path}`, options);
  }
  return response;
}

/**
 * 解包成功的 JSON 响应，HTTP 错误保留状态供 Server Actions 和界面处理。
 */
export async function apiGet<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok)
    throw new ListenApiError(response.status, `Listen API returned ${response.status}`);
  const body = (await response.json()) as { data: T };
  return body.data;
}
