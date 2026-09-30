import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { AppEnv } from '../types.ts';

// Route-specific opt-in. Cache JSON only, without CORS headers or request IDs.
// Validation and rate limiting must run before this middleware.
/**
 * 创建公开 JSON 响应缓存中间件；必须挂在参数校验和限流之后。
 */
export function cacheResponse(ttl: number | ((c: Context<AppEnv>) => number)) {
  /**
   * 按路由 TTL 读取缓存，未命中时执行后续业务并仅缓存成功响应。
   */
  return createMiddleware<AppEnv>(async (c, next) => {
    if (c.env.CACHE_ENABLED === 'false') return next();
    const seconds = typeof ttl === 'number' ? ttl : ttl(c);
    if (seconds <= 0) return next();
    const url = new URL(c.req.url);
    url.searchParams.sort();
    const key = new Request(url.toString());
    let hit: Response | undefined;
    try {
      hit = await caches.default.match(key);
    } catch {
      // 缓存失败不影响业务读取。
    }
    if (hit) return c.json(await hit.json());
    await next();
    if (c.res.status !== 200) return;
    const response = c.res.clone();
    c.executionCtx.waitUntil(
      (
        /**
         * 异步保存 JSON 数据，不保存请求标识或跨域响应头。
         */
        async () => {
          await caches.default.put(
            key,
            Response.json(await response.json(), {
              headers: { 'Cache-Control': `public, max-age=${seconds}` },
            }),
          );
        }
      )().catch(
        /**
         * 记录缓存写入失败；缓存不可用不影响已完成的业务响应。
         */
        () => console.warn('cache_write_failed'),
      ),
    );
  });
}
