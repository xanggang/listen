import type { ApiBindings } from './types.ts';
import { clientApp } from './apps/client-app.ts';
import { requireMetricsDatabase } from './database/metrics-database.ts';
import { MetricsRepository } from './modules/metrics/metrics.repository.ts';
import { MetricsService } from './modules/metrics/metrics.service.ts';

export default {
  /**
   * 仅挂载客户端业务路由；管理模块不会进入此部署入口。
   */
  async fetch(request: Request, env: ApiBindings, context: ExecutionContext): Promise<Response> {
    return clientApp.fetch(request, env, context);
  },

  /**
   * 每日在独立统计库汇总匿名访问量；缺少绑定时失败，绝不回退写业务库。
   */
  async scheduled(_controller: ScheduledController, env: ApiBindings): Promise<void> {
    await new MetricsService(new MetricsRepository(requireMetricsDatabase(env))).rollup();
  },
};
