import { Hono } from 'hono';
import { validator } from 'hono/validator';
import type { AppEnv } from '../../types.ts';
import { entityId, validateParams } from '../../shared/validation.ts';
import { cacheResponse } from '../../middleware/cache.ts';
import { searchRateLimit } from '../../middleware/rate-limit.ts';
import { parseStationQuery } from './stations.schema.ts';

export const stationRoutes = new Hono<AppEnv>();
stationRoutes.get(
  '/',
  validator(
    'query' /**
     * 在访问数据库或缓存之前解析并验证电台列表参数。
     */,
    (_, c) => parseStationQuery(new URL(c.req.url).searchParams),
  ),
  searchRateLimit,
  cacheResponse(
    /**
     * 关键词搜索不使用公共缓存，普通列表缓存五分钟。
     */
    (c) => (c.req.query('keyword')?.trim() ? 0 : 300),
  ),
  /**
   * 使用验证后的参数调用电台服务并返回统一 JSON 包装。
   */
  async (c) => c.json({ data: await c.get('services').stations.list(c.req.valid('query')) }),
);
stationRoutes.get(
  '/:id',
  validator(
    'param' /**
     * 验证详情 id，并拒绝详情接口不支持的查询参数。
     */,
    (params, c) => {
      validateParams(new URL(c.req.url).searchParams, []);
      return { id: entityId(params.id, 'id') };
    },
  ),
  cacheResponse(300),
  /**
   * 读取电台详情；不存在时由服务层抛出统一异常。
   */
  async (c) => c.json({ data: await c.get('services').stations.detail(c.req.valid('param').id) }),
);
