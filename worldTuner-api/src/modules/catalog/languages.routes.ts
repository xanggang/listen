import { Hono } from 'hono';
import { validator } from 'hono/validator';
import type { AppEnv } from '../../types.ts';
import { cacheResponse } from '../../middleware/cache.ts';
import { parseCatalogQuery } from './catalog.schema.ts';

export const languagesRoutes = new Hono<AppEnv>();
languagesRoutes.get(
  '/',
  validator(
    'query' /**
     * 验证语言列表的 limit；默认返回最多 1000 项。
     */,
    (_, c) => parseCatalogQuery(new URL(c.req.url).searchParams, 1000),
  ),
  cacheResponse(3600),
  /**
   * 调用字典服务并封装语言列表的公开响应。
   */
  async (c) =>
    c.json({ data: await c.get('services').catalog.list('languages', c.req.valid('query').limit) }),
);
