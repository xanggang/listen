import { Hono } from 'hono';
import type { AdminEnv } from '../types.ts';
import { pageQuery, jsonInput, text } from '../shared/input.ts';
import { ApiError } from '../shared/errors.ts';
import { validateParams } from '../shared/validation.ts';
import { auditEvent } from '../audit/audit.service.ts';
import { listReports, updateReport } from './reports.repository.ts';
const statuses = ['open', 'resolved', 'ignored'];
export const managementReportRoutes = new Hono<AdminEnv>();
managementReportRoutes.get(
  '/',
  // 查询错误样本的处理状态，状态枚举在进入数据库前检查。
  async (c) => {
    const params = new URL(c.req.url).searchParams;
    const query = pageQuery(params, ['status']);
    const status = params.get('status');
    if (status && !statuses.includes(status))
      throw new ApiError(400, 'INVALID_INPUT', 'Invalid status');
    return c.json({
      data: {
        ...(await listReports(c.env.METRICS_DB, status, query.pageSize, query.offset)),
        page: query.page,
        pageSize: query.pageSize,
      },
    });
  },
);
managementReportRoutes.put(
  '/:id/status',
  // 报告 ID 和状态按白名单处理，管理员身份来自认证上下文。
  async (c) => {
    validateParams(new URL(c.req.url).searchParams, []);
    const id = text(c.req.param('id'), 'id', 100)!;
    const body = await jsonInput(c, ['status', 'expectedStatus']);
    if (
      typeof body.status !== 'string' ||
      typeof body.expectedStatus !== 'string' ||
      !statuses.includes(body.status) ||
      !statuses.includes(body.expectedStatus)
    )
      throw new ApiError(400, 'INVALID_INPUT', 'Invalid status');
    return c.json({
      data: await updateReport(
        c.env.METRICS_DB,
        id,
        String(body.status),
        String(body.expectedStatus),
        auditEvent(c, 'report.status', 'report', id, ['status']),
      ),
    });
  },
);
