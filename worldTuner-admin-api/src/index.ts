import { adminApp } from './app.ts';
import type { AdminBindings } from './types.ts';
import { deliverAudit } from './audit/audit.repository.ts';

export default {
  /**
   * 管理 Worker 仅装配管理路由与受保护静态资源，不注册客户端 API。
   */
  fetch(request: Request, env: AdminBindings, context: ExecutionContext) {
    return adminApp.fetch(request, env, context);
  },
  /**
   * 补投审计 outbox；仅清理已经确认交付七天的事件，未交付事件永久保留待重试。
   */
  async scheduled(_controller: ScheduledController, env: AdminBindings) {
    await deliverAudit(env.DB, env.METRICS_DB);
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
    await env.DB.prepare(
      'DELETE FROM admin_outbox WHERE id IN (SELECT id FROM admin_outbox WHERE delivered_at IS NOT NULL AND delivered_at<? LIMIT 1000)',
    )
      .bind(cutoff)
      .run();
  },
};
