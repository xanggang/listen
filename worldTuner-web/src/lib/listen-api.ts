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

/** 从服务端请求独立 API；开发模式直连本地 Worker，生产默认使用绑定，十秒超时。 */
export async function apiGet<T>(path: string): Promise<T> {
  const incoming = await headers();
  const ip = incoming.get('cf-connecting-ip');
  const requestHeaders: Record<string, string> = { Accept: 'application/json' };
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
  if (!response.ok)
    throw new ListenApiError(response.status, `Listen API returned ${response.status}`);
  const body = (await response.json()) as { data: T };
  return body.data;
}
