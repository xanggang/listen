import { Hono } from 'hono';
import { validator } from 'hono/validator';
import type { AppEnv } from '../../types.ts';
import { cacheResponse } from '../../middleware/cache.ts';
import { parseCatalogQuery } from './catalog.schema.ts';

export const tagsRoutes = new Hono<AppEnv>();
tagsRoutes.get(
  '/',
  validator('query' /** 验证标签列表的 limit，默认返回 30 项。 */, (_, c) =>
    parseCatalogQuery(new URL(c.req.url).searchParams, 30),
  ),
  cacheResponse(3600),
  /** 调用字典服务并封装标签列表的公开响应。 */
  async (c) =>
    c.json({ data: await c.get('services').catalog.list('tags', c.req.valid('query').limit) }),
);
