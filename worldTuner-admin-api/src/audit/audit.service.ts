import type { Context } from 'hono';
import type { AdminEnv, AuditEvent } from '../types.ts';

/**
 * 审计身份、时间与 requestId 仅取自服务端上下文；变更摘要只保存字段名。
 */
export function auditEvent(
  c: Context<AdminEnv>,
  action: string,
  entityType: string,
  entityId: string,
  changedFields: string[],
): AuditEvent {
  return {
    id: crypto.randomUUID(),
    actorId: c.get('actor').id,
    action,
    entityType,
    entityId,
    changedFields: JSON.stringify(changedFields),
    requestId: c.get('requestId'),
    createdAt: new Date().toISOString(),
  };
}
