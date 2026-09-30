import { Hono } from 'hono';
import { validator } from 'hono/validator';
import type { AppEnv } from '../../types.ts';
import { cacheResponse } from '../../middleware/cache.ts';
import { mapSnapshotResponse } from '../../middleware/map-snapshot.ts';
import { parseMapQuery } from './map.schema.ts';

export const mapRoutes = new Hono<AppEnv>();
mapRoutes.get('/snapshot', mapSnapshotResponse);
mapRoutes.get(
  '/stations',
  validator(
    'query',
    // 点位参数在数据库访问和缓存命中前统一校验。
    (_, c) => parseMapQuery(new URL(c.req.url).searchParams),
  ),
  cacheResponse(300),
  // 返回与当前库详情 ID 一致的点位页，不包含播放地址。
  async (c) => {
    const query = c.req.valid('query');
    return c.json({ data: await c.get('services').map.page(query.after, query.limit) });
  },
);
