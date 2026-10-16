import { createBaseApp } from './apps/base-app.ts';
import { ApiError } from './shared/errors.ts';
import { adminRoutes } from './modules/admin/admin.routes.ts';
import { apiRoutes } from './routes/api.ts';

// 历史组合应用仅保留兼容测试；客户端 Worker 和 SQLite 不使用此入口。
export const app = createBaseApp();
app.route('/api', apiRoutes);
app.route('/admin/api', adminRoutes);
app.notFound(
  /**
   * 为未注册路径返回 404，并拒绝统计入口之外的写入方法。
   */
  (c) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      c.header('Allow', 'GET, HEAD, OPTIONS');
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'This method is not supported');
    }
    throw new ApiError(404, 'NOT_FOUND', 'Endpoint not found');
  },
);
