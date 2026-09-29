import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { NextRequest } from 'next/server';
import { getListenApiBaseUrl } from '@/lib/listen-api-config';

// 同源转发匿名访问记录，浏览器无需获知 Worker 的部署地址。
export async function POST(request: NextRequest): Promise<Response> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return new Response(null, { status: 415 });
  const body = await request.text();
  if (body.length > 1024) return new Response(null, { status: 413 });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const clientIp = request.headers.get('cf-connecting-ip');
  if (clientIp) headers['CF-Connecting-IP'] = clientIp;
  const options = { method: 'POST', headers, body, signal: AbortSignal.timeout(5000) };
  try {
    const baseUrl = getListenApiBaseUrl();
    const response = baseUrl
      ? await fetch(new URL('/api/v1/metrics/visit', baseUrl), { ...options, cache: 'no-store' })
      : await (async () => {
          // 生产环境使用 Web Worker 已有的 API Service Binding。
          const { env } = await getCloudflareContext({ async: true });
          if (!env.LISTEN_API) throw new Error('LISTEN_API binding is missing');
          return env.LISTEN_API.fetch('https://listen-api.internal/api/v1/metrics/visit', options);
        })();
    return new Response(null, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
