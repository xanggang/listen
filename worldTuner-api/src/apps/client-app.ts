import { createBaseApp } from './base-app.ts';
import { apiRoutes } from '../routes/api.ts';
import { ApiError } from '../shared/errors.ts';

export const clientApp = createBaseApp();
clientApp.route('/api', apiRoutes);
clientApp.notFound(
  // 管理路径统一 404；现有业务路径不支持的写方法保持 405 契约。
  (c) => {
    if (c.req.path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      c.header('Allow', 'GET, HEAD, OPTIONS');
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'This method is not supported');
    }
    throw new ApiError(404, 'NOT_FOUND', 'Endpoint not found');
  },
);
