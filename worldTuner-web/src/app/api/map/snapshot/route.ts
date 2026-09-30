import type { NextRequest } from 'next/server';
import { apiFetch } from '@/lib/listen-api';
import { mapSnapshotProxyResponse } from '@/lib/map-snapshot-response';

/**
 * 同源转发全量地图与条件请求，正文保持原始四字段元组。
 * 上游请求 identity 避免自动解压后的标头失配；出口按运行时协商压缩。
 * 只转发公开缓存头，错误不缓存，也不把 CORS 或客户端标识写入公共响应。
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (request.nextUrl.search) {
    return Response.json(
      { error: { message: 'Snapshot does not accept query parameters' } },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  try {
    const upstreamHeaders: Record<string, string> = { 'Accept-Encoding': 'identity' };
    const etag = request.headers.get('If-None-Match');
    if (etag) upstreamHeaders['If-None-Match'] = etag;
    const upstream = await apiFetch('/api/map/snapshot', upstreamHeaders);
    if (upstream.status !== 200 && upstream.status !== 304) {
      return Response.json(
        { error: { message: 'Map data unavailable' } },
        { status: upstream.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return mapSnapshotProxyResponse(upstream, request.headers.get('Accept-Encoding'));
  } catch {
    return Response.json(
      { error: { message: 'Map data unavailable' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
