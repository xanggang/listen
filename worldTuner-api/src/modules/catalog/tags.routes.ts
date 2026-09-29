import { Hono } from 'hono';
import { validator } from 'hono/validator';
import type { AppEnv } from '../../types.ts';
import { cacheResponse } from '../../middleware/cache.ts';
import { parseTagQuery } from './catalog.schema.ts';

export const tagsRoutes = new Hono<AppEnv>();
// 验证标签列表、关键词和偏移量，并保持公开数组响应格式。
tagsRoutes.get(
  '/',
  validator('query', (_, c) => parseTagQuery(new URL(c.req.url).searchParams)),
  cacheResponse(3600),
  // 支持按名称搜索和偏移量分页，旧客户端仍收到 data 数组。
  async (c) => {
    const { q, limit, offset } = c.req.valid('query');
    return c.json({ data: await c.get('services').catalog.searchTags(q, limit, offset) });
  },
);
