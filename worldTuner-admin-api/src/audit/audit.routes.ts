import { Hono } from 'hono';
import type { AdminEnv } from '../types.ts';
import { pageQuery } from '../shared/input.ts';
import { listAudit } from './audit.repository.ts';
export const managementAuditRoutes = new Hono<AdminEnv>();
managementAuditRoutes.get(
  '/',
  // 审计只读分页；不提供修改、删除或执行任意日志查询的接口。
  async (c) => {
    const query = pageQuery(new URL(c.req.url).searchParams);
    return c.json({
      data: {
        ...(await listAudit(c.env.METRICS_DB, query.pageSize, query.offset)),
        page: query.page,
        pageSize: query.pageSize,
      },
    });
  },
);
