import { Hono } from 'hono';
import type { AppEnv } from '../../types.ts';
import { ApiError } from '../../shared/errors.ts';
import { validateParams } from '../../shared/validation.ts';
import { parseVisitInput } from './metrics.schema.ts';

export const metricsRoutes = new Hono<AppEnv>();

metricsRoutes.post(
  '/visit',
  /**
   * 先校验请求，再写入独立统计库；配置缺失返回 503，不影响业务读取。
   */
  async (c) => {
    validateParams(new URL(c.req.url).searchParams, []);
    if (!c.req.header('Content-Type')?.toLowerCase().startsWith('application/json'))
      throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON body required');
    const length = Number(c.req.header('Content-Length') ?? 0);
    if (length > 1024) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Visit payload too large');
    const raw = await c.req.text();
    if (raw.length > 1024) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Visit payload too large');
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError(400, 'INVALID_METRIC', 'Invalid JSON body');
    }
    const input = parseVisitInput(body);
    await c.get('services').metrics.recordVisit(input);
    return c.json({ data: { recorded: true } });
  },
);
