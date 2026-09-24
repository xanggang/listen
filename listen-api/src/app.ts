import { Hono } from 'hono';
import type { AppEnv } from './types.ts';
import { ApiError } from './shared/errors.ts';
import { requestContext } from './middleware/context.ts';
import { corsPolicy } from './middleware/cors.ts';
import { rateLimit } from './middleware/rate-limit.ts';
import { errorHandler } from './middleware/errors.ts';
import { v1 } from './routes/v1.ts';

export const app = new Hono<AppEnv>();
app.use('*', requestContext, corsPolicy, rateLimit('READ_LIMITER'));
app.route('/api/v1', v1);
app.notFound(
  /** 为未注册路径返回 404，并明确拒绝首版不支持的写入方法。 */
  (c) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      c.header('Allow', 'GET, HEAD, OPTIONS');
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Only read operations are supported');
    }
    throw new ApiError(404, 'NOT_FOUND', 'Endpoint not found');
  },
);
app.onError(errorHandler);
