/**
 * 判断 gzip 是否可接受；显式 q=0 覆盖通配符，未知编码使用 identity。
 */
function acceptsGzip(value: string | null): boolean {
  const weights = new Map<string, number>();
  for (const item of (value ?? '').split(',')) {
    const [encoding, ...parameters] = item.trim().toLowerCase().split(';');
    const quality = parameters.find(
      // q 是客户端声明的编码质量权重。
      (parameter) => parameter.trim().startsWith('q='),
    );
    weights.set(encoding, quality === undefined ? 1 : Number(quality.trim().slice(2)));
  }
  return (weights.get('gzip') ?? weights.get('*') ?? 0) > 0;
}

/**
 * 保留快照缓存头并协商 Web 出口压缩；不解析或重新组装元组 JSON。
 * Node 显式压缩流，Cloudflare 由 OpenNext 外层 Response 自动按 Content-Encoding 编码。
 * WebSocketPair 是 Worker 运行时的能力标识，避免外层自动编码与手工 gzip 叠加。
 * 304 无正文；automaticEncoding 可注入以测试两种运行时的编码职责。
 */
export function mapSnapshotProxyResponse(
  upstream: Response,
  acceptEncoding: string | null,
  automaticEncoding = 'WebSocketPair' in globalThis,
): Response {
  const headers = new Headers({ Vary: 'Accept-Encoding' });
  for (const key of ['Content-Type', 'Cache-Control', 'ETag']) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  let body = upstream.status === 304 ? null : upstream.body;
  if (body && acceptsGzip(acceptEncoding)) {
    headers.set('Content-Encoding', 'gzip');
    if (!automaticEncoding) body = body.pipeThrough(new CompressionStream('gzip'));
  }
  return new Response(body, { status: upstream.status, headers });
}
