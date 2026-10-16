import { Hono } from 'hono';
import type { AdminEnv } from '../types.ts';
import { analyticsQuery } from './analytics.schema.ts';
import { readAnalytics, readCatalogSummary } from './analytics.repository.ts';
export const managementAnalyticsRoutes = new Hono<AdminEnv>();
managementAnalyticsRoutes.get(
  '/',
  // 分平台日/月活口径，读取有限时间范围内的统计数据。
  async (c) =>
    c.json({
      data: await readAnalytics(c.env.METRICS_DB, analyticsQuery(new URL(c.req.url).searchParams)),
    }),
);
managementAnalyticsRoutes.get(
  '/overview',
  // 总览复用同一统计口径，不把 UV 作为注册用户或装机量。
  async (c) => {
    const query = analyticsQuery(new URL(c.req.url).searchParams);
    const [metrics, catalog] = await Promise.all([
      readAnalytics(c.env.METRICS_DB, query),
      readCatalogSummary(c.env.DB),
    ]);
    return c.json({ data: { ...metrics, catalog } });
  },
);
