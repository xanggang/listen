import { createMiddleware } from 'hono/factory';
import { ApiError } from '../shared/errors.ts';
import type { AppEnv } from '../types.ts';
/**
 * 创建指定限流绑定的中间件；游客使用 Cloudflare 提供的 IP 作为粗粒度标识。
 */
export function rateLimit(binding: 'READ_LIMITER' | 'SEARCH_LIMITER' | 'METRICS_LIMITER') {
  /**
   * 在业务和缓存前扣减额度，超限抛出统一的 429 异常。
   */
  return createMiddleware<AppEnv>(async (c, next) => {
    // CF supplies the IP on public requests. Missing IPs share a conservative bucket.
    // IP limits are a guest abuse heuristic, not user identity or a billing cap.
    const key = c.req.header('CF-Connecting-IP') || 'unknown';
    if (!(await c.env[binding].limit({ key })).success) {
      throw new ApiError(429, 'RATE_LIMITED', 'Too many requests');
    }
    await next();
  });
}

export const requestRateLimit = createMiddleware<AppEnv>(
  /**
   * 统计写入使用独立额度；其余请求继续沿用原有只读额度。
   */ async (c, next) => {
    const binding =
      c.req.method === 'POST' && c.req.path === '/api/metrics/visit'
        ? 'METRICS_LIMITER'
        : 'READ_LIMITER';
    return rateLimit(binding)(c, next);
  },
);
export const searchRateLimit = createMiddleware<AppEnv>(
  /**
   * 仅对包含非空关键词的请求叠加搜索额度，避免影响普通列表读取。
   */ async (c, next) => {
    if (c.req.query('keyword')?.trim()) return rateLimit('SEARCH_LIMITER')(c, next);
    await next();
  },
);
