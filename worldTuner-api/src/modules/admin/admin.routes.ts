import { Hono } from 'hono';
import type { AppEnv } from '../../types.ts';
import { adminAuth } from '../../middleware/admin-auth.ts';
import { ApiError } from '../../shared/errors.ts';
import { entityId, validateParams } from '../../shared/validation.ts';
import { parseVisibility } from './admin.schema.ts';

export const adminRoutes = new Hono<AppEnv>();
adminRoutes.use('*', adminAuth);
adminRoutes.get(
  '/health',
  // 管理端探活同样要求认证，不读取业务表或泄漏运行配置。
  (c) => {
    validateParams(new URL(c.req.url).searchParams, []);
    return c.json({ data: { status: 'ok', service: 'worldtuner-admin-api' } });
  },
);
adminRoutes.put(
  '/stations/:id/visibility',
  // 限定 JSON 请求体与实体 ID，只调用独立管理业务，不开放任意数据库写入。
  async (c) => {
    validateParams(new URL(c.req.url).searchParams, []);
    const id = entityId(c.req.param('id'), 'id');
    if (!c.req.header('Content-Type')?.toLowerCase().startsWith('application/json')) {
      throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON body required');
    }
    if (Number(c.req.header('Content-Length') ?? 0) > 1024)
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Admin payload too large');
    const raw = await c.req.text();
    if (new TextEncoder().encode(raw).length > 1024)
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Admin payload too large');
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError(400, 'INVALID_PARAMETER', 'Invalid JSON body');
    }
    return c.json({ data: await c.get('services').admin.setVisibility(id, parseVisibility(body)) });
  },
);
