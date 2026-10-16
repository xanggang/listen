import { Hono } from 'hono';
import type { AppEnv } from '../types.ts';
import { requestContext } from '../middleware/context.ts';
import { corsPolicy } from '../middleware/cors.ts';
import { requestRateLimit } from '../middleware/rate-limit.ts';
import { errorHandler } from '../middleware/errors.ts';

/**
 * 组装无业务路由的基础应用；各入口独立注册路由，避免客户端加载管理写入模块。
 */
export function createBaseApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use('*', requestContext, corsPolicy, requestRateLimit);
  app.onError(errorHandler);
  return app;
}
