import type { Context } from 'hono';
import type { AppEnv } from '../types.ts';
import { ApiError } from '../shared/errors.ts';
import { getMapSnapshot, snapshotTtl } from '../modules/map/map.snapshot.ts';

/**
 * 按 Accept-Encoding 的质量权重决定是否提供 gzip；显式 q=0 优先于通配符。
 */
function acceptsGzip(value: string | undefined): boolean {
  const weights = new Map<string, number>();
  for (const item of (value ?? '').split(',')) {
    const [encoding, ...params] = item.trim().toLowerCase().split(';');
    const quality = params.find(
      // 只读取 q 参数，其余扩展参数不参与编码选择。
      (param) => param.trim().startsWith('q='),
    );
    weights.set(encoding, quality === undefined ? 1 : Number(quality.trim().slice(2)));
  }
  return (weights.get('gzip') ?? weights.get('*') ?? 0) > 0;
}

/**
 * GET 的 If-None-Match 使用弱比较，并支持多个标签和通配符。
 */
function matchesEtag(value: string | undefined, etag: string): boolean {
  return (value ?? '').split(',').some(
    // 编码不同但语义相同的正文可以共享校验结果。
    (item) => item.trim() === '*' || item.trim().replace(/^W\//, '') === etag.replace(/^W\//, ''),
  );
}

/**
 * 返回完整地图快照：Worker 使用边缘 Cache API，SQLite 使用进程缓存。
 * 缓存键区分编码和 TTL；内部过期时间避免多层缓存反复延长有效期。
 * 只缓存公开正文，不缓存请求标识、CORS、304 或失败响应。
 */
export async function mapSnapshotResponse(c: Context<AppEnv>): Promise<Response> {
  const url = new URL(c.req.url);
  if (url.search)
    throw new ApiError(400, 'INVALID_QUERY', 'Snapshot does not accept query parameters');
  const ttl = snapshotTtl(c.env.MAP_SNAPSHOT_CACHE_TTL_SECONDS);
  const gzip = acceptsGzip(c.req.header('Accept-Encoding'));
  url.searchParams.set('format', 'tuple-1-opaque-cache');
  url.searchParams.set('encoding', gzip ? 'gzip' : 'identity');
  url.searchParams.set('ttl', String(ttl));
  const key = new Request(url);
  const edgeEnabled = ttl > 0 && c.env.CACHE_ENABLED !== 'false';
  let response: Response | undefined;
  if (edgeEnabled) {
    try {
      const cached = await caches.default.match(key);
      if (cached && Number(cached.headers.get('X-Snapshot-Expires')) > Date.now())
        response = cached;
    } catch {
      // 本地或 Cache API 暂时不可用时继续使用数据库对应的进程缓存。
    }
  }
  if (!response) {
    const snapshot = await getMapSnapshot(c.env.DB, ttl);
    const remaining = Math.max(0, Math.floor((snapshot.expiresAt - Date.now()) / 1000));
    response = new Response(gzip ? snapshot.gzip : snapshot.body, {
      // 正文已经 gzip 编码，Worker 不得再次压缩；Node 忽略这个扩展选项。
      encodeBody: 'manual',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${remaining}`,
        ETag: snapshot.etag,
        'X-Snapshot-Expires': String(snapshot.expiresAt),
        // 缓存层把压缩字节作为不透明正文保存，不能再次按 Content-Encoding 编码。
        ...(gzip ? { 'X-Snapshot-Encoding': 'gzip' } : {}),
      },
    });
    if (edgeEnabled && remaining > 0) {
      c.executionCtx.waitUntil(
        caches.default.put(key, response.clone()).catch(
          // 缓存写入失败不会改变已经生成的成功响应。
          () => console.warn('map_snapshot_cache_write_failed'),
        ),
      );
    }
  }
  const expires = Number(response.headers.get('X-Snapshot-Expires'));
  const headers = new Headers(response.headers);
  headers.delete('X-Snapshot-Expires');
  const encoding = headers.get('X-Snapshot-Encoding');
  headers.delete('X-Snapshot-Encoding');
  if (encoding) headers.set('Content-Encoding', encoding);
  headers.delete('Age');
  headers.set(
    'Cache-Control',
    `public, max-age=${Math.max(0, Math.floor((expires - Date.now()) / 1000))}`,
  );
  headers.set('Vary', 'Accept-Encoding');
  // 覆盖请求上下文的默认 no-store，使快照的公开 TTL 实际生效。
  c.header('Cache-Control', headers.get('Cache-Control')!);
  if (matchesEtag(c.req.header('If-None-Match'), headers.get('ETag')!)) {
    headers.delete('Content-Encoding');
    return new Response(null, { status: 304, headers });
  }
  return new Response(response.body, { headers, encodeBody: 'manual' });
}
