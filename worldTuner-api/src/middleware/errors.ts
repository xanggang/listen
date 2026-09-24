import type { ErrorHandler } from 'hono';
import type { AppEnv } from '../types.ts';
import { ApiError } from '../shared/errors.ts';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
export const errorHandler: ErrorHandler<AppEnv> =
  /** 将业务异常转换为一致的 HTTP 错误；内部异常仅在服务端日志记录。 */
  (error, c) => {
    const requestId = c.get('requestId');
    if (error instanceof ApiError) {
      if (error.status === 429) c.header('Retry-After', '60');
      return c.json(
        { error: { code: error.code, message: error.message, requestId } },
        error.status as ContentfulStatusCode,
      );
    }
    console.error(JSON.stringify({ event: 'api_error', requestId, message: error.message }));
    return c.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Service temporarily unavailable', requestId } },
      500,
    );
  };
