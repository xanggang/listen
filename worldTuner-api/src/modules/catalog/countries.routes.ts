import { Hono } from 'hono';
import { validator } from 'hono/validator';
import type { AppEnv } from '../../types.ts';
import { cacheResponse } from '../../middleware/cache.ts';
import { parseCatalogQuery } from './catalog.schema.ts';

export const countriesRoutes = new Hono<AppEnv>();
countriesRoutes.get(
  '/',
  validator('query' /** 验证国家列表的 limit，默认返回 30 项。 */, (_, c) =>
    parseCatalogQuery(new URL(c.req.url).searchParams, 30),
  ),
  cacheResponse(3600),
  /** 调用字典服务并封装国家列表的公开响应。 */
  async (c) =>
    c.json({ data: await c.get('services').catalog.list('countries', c.req.valid('query').limit) }),
);
