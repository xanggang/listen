import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AdminEnv } from './types.ts';
import { ApiError } from './shared/errors.ts';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { authenticateAdmin } from './auth/auth.middleware.ts';
import { csrfToken } from './auth/csrf.ts';
import { managementStationRoutes } from './stations/stations.routes.ts';
import { managementCatalogRoutes } from './catalog/catalog.routes.ts';
import { managementAnalyticsRoutes } from './analytics/analytics.routes.ts';
import { managementReportRoutes } from './reports/reports.routes.ts';
import { managementAuditRoutes } from './audit/audit.routes.ts';
import { deliverAudit } from './audit/audit.repository.ts';
import { validateParams } from './shared/validation.ts';

export const adminApp = new Hono<AdminEnv>();
adminApp.use(
  '*',
  /**
   * 管理端独立请求上下文及限流，所有响应禁止缓存；不记录 Cookie、Token 和原始 URL。
   */
  async (c, next) => {
    c.set('requestId', crypto.randomUUID());
    c.header('X-Request-Id', c.get('requestId'));
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('X-Frame-Options', 'DENY');
    if (c.env.DEPLOYMENT_ENV !== 'local')
      c.header(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      );
    if (
      c.env.ADMIN_LIMITER &&
      !(await c.env.ADMIN_LIMITER.limit({ key: c.req.header('CF-Connecting-IP') ?? 'unknown' }))
        .success
    )
      throw new ApiError(429, 'RATE_LIMITED', 'Too many admin requests');
    await next();
    if (['PUT', 'POST', 'PATCH', 'DELETE'].includes(c.req.method) && c.res.ok) {
      try {
        await deliverAudit(c.env.DB, c.env.METRICS_DB);
      } catch {
        // 业务事务已提交，审计留在 outbox 中等待 Cron 重试；不谎报保存失败诱发重复操作。
        console.error(
          JSON.stringify({ event: 'audit_delivery_failed', requestId: c.get('requestId') }),
        );
      }
    }
  },
);
adminApp.use(
  '*',
  bodyLimit({
    maxSize: 16384,
    // 在解析 JSON 前阻止超大请求，包括没有 Content-Length 的分块正文。
    onError: () => {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Payload exceeds 16 KB');
    },
  }),
);
adminApp.use('*', authenticateAdmin);
adminApp.get(
  '/admin/api/me',
  // 返回当前角色及短期 CSRF token，不返回 Access JWT 或开发密钥。
  async (c) => {
    validateParams(new URL(c.req.url).searchParams, []);
    return c.json({
      data: {
        ...c.get('actor'),
        authMode: c.env.DEPLOYMENT_ENV === 'local' ? 'local' : 'access',
        csrfToken: await csrfToken(c.env, c.get('actor').id, c.get('credential')),
        cacheNotice:
          '公开列表、详情与字典的服务端缓存为 60 秒，地图按配置 TTL 刷新；App 已加载的内存列表需重新进入或重启后获取，不保证即时全局刷新。',
      },
    });
  },
);
adminApp.get(
  '/admin/api/health',
  // 管理健康检查也需要身份，不提供未认证配置探测入口。
  (c) => {
    validateParams(new URL(c.req.url).searchParams, []);
    return c.json({ data: { status: 'ok', service: 'worldtuner-admin-api' } });
  },
);
adminApp.route('/admin/api/stations', managementStationRoutes);
adminApp.route('/admin/api/catalog', managementCatalogRoutes);
adminApp.route('/admin/api/analytics', managementAnalyticsRoutes);
adminApp.route('/admin/api/reports', managementReportRoutes);
adminApp.route('/admin/api/audit', managementAuditRoutes);
adminApp.get(
  '/admin/api/logs',
  // 首版只提供固定 Cloudflare 控制台入口，不向浏览器暴露 API Token 或任意查询代理。
  (c) => {
    validateParams(new URL(c.req.url).searchParams, []);
    const account = c.env.CLOUDFLARE_ACCOUNT_ID;
    return c.json({
      data: {
        mode: 'console',
        queryEnabled: false,
        consoleUrl:
          account && /^[a-f0-9]{32}$/.test(account)
            ? `https://dash.cloudflare.com/${account}/workers-and-pages`
            : 'https://dash.cloudflare.com/',
        message: '运行日志由 Cloudflare Workers Logs 保存；首版从控制台按请求 ID 查询。',
      },
    });
  },
);
adminApp.get(
  '*',
  // 页面与静态资源统一走上方鉴权；所有未知 API 返回 JSON 404，不能回退 HTML。
  async (c) => {
    if (c.req.path.startsWith('/admin/api') || c.req.path.startsWith('/api') || !c.env.ASSETS)
      throw new ApiError(404, 'NOT_FOUND', 'Endpoint not found');
    return c.env.ASSETS.fetch(c.req.raw);
  },
);
adminApp.notFound(
  // 管理端没有公开写入或任意方法通配接口。
  () => {
    throw new ApiError(404, 'NOT_FOUND', 'Endpoint not found');
  },
);
adminApp.onError(
  // 仅返回安全业务错误，内部错误不把 SQL、数据库路径或认证信息交给前端。
  (error, c) => {
    const status = error instanceof ApiError ? error.status : 500;
    const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
    if (status >= 500)
      console.error(JSON.stringify({ event: 'admin_error', requestId: c.get('requestId'), code }));
    if (status === 429) c.header('Retry-After', '60');
    return c.json(
      {
        error: {
          code,
          message: error instanceof ApiError ? error.message : 'Service temporarily unavailable',
          requestId: c.get('requestId'),
        },
      },
      status as ContentfulStatusCode,
    );
  },
);
