import { Hono } from 'hono';
import type { AppEnv } from '../../types.ts';
import { ApiError } from '../../shared/errors.ts';
import { validateParams } from '../../shared/validation.ts';
import { parseVisitInput } from './metrics.schema.ts';

export const metricsRoutes = new Hono<AppEnv>();

metricsRoutes.post(
  '/visit',
  /** 限制请求体大小、字段和页面名后写入统计；不返回可查询的用户数据。 */
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
    await c.get('services').metrics.recordVisit(parseVisitInput(body));
    return c.json({ data: { recorded: true } });
  },
);
