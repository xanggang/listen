import type { NextRequest } from 'next/server';
import { apiGet, ListenApiError } from '@/lib/listen-api';

/**
 * 同源转发点位页到统一 API，保持字符串游标；未知或重复参数在转发前拒绝。
 */
export async function GET(request: NextRequest): Promise<Response> {
  const input = request.nextUrl.searchParams;
  for (const key of input.keys()) {
    if (!['after', 'limit'].includes(key) || input.getAll(key).length !== 1) {
      return Response.json({ error: { message: 'Invalid map query' } }, { status: 400 });
    }
  }
  const after = input.get('after');
  const rawLimit = input.get('limit') ?? '5000';
  if ((after !== null && !/^\d{19}$/.test(after)) || !/^[1-9]\d*$/.test(rawLimit) || Number(rawLimit) > 5000) {
    return Response.json({ error: { message: 'Invalid map query' } }, { status: 400 });
  }
  const query = new URLSearchParams({ limit: rawLimit });
  if (after !== null) query.set('after', after);
  try {
    const data = await apiGet<unknown>(`/api/map/stations?${query}`);
    return Response.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: { message: 'Map data unavailable' } }, {
      status: error instanceof ListenApiError ? error.status : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
