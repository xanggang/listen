import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types.ts';
export const corsPolicy: MiddlewareHandler<AppEnv> =
  /** 根据环境中的来源白名单处理浏览器跨域；此策略不承担身份认证。 */
  async (c, next) =>
    cors({
      /** 仅回显配置中允许的 Origin，避免开放任意浏览器来源。 */
      origin: (origin) =>
        c.env.ALLOWED_ORIGINS.split(',')
          .map(/** 去除来源配置周围空白，保持域名精确匹配。 */ (x) => x.trim())
          .includes(origin)
          ? origin
          : undefined,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
      exposeHeaders: ['X-Request-Id', 'Retry-After'],
    })(c, next);
