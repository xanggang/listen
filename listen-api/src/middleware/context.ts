import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types.ts';
import { createServices } from '../services.ts';
export const requestContext = createMiddleware<AppEnv>(
  /** 初始化请求标识和请求级服务依赖，并设置公共安全响应头。 */ async (c, next) => {
    const id = crypto.randomUUID();
    c.set('requestId', id);
    c.set('services', createServices(c.env.DB));
    c.header('X-Request-Id', id);
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Cache-Control', 'no-store');
    await next();
  },
);
