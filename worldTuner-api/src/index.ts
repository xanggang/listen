import type { ApiBindings } from './types.ts';
import { app } from './app.ts';
import { MetricsRepository } from './modules/metrics/metrics.repository.ts';
import { MetricsService } from './modules/metrics/metrics.service.ts';

export default {
  /**
   * 将 HTTP 请求交给 Hono；统计写入不会影响原有只读路由。
   */
  async fetch(request: Request, env: ApiBindings, context: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, context);
  },

  /**
   * 每日汇总匿名访问量并清理超过保留期的去重值。
   */
  async scheduled(_controller: ScheduledController, env: ApiBindings): Promise<void> {
    await new MetricsService(new MetricsRepository(env.METRICS_DB ?? env.DB)).rollup();
  },
};
