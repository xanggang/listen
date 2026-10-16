import type { SqlDatabase } from '../database/database.ts';
import type { AuditEvent } from '../types.ts';
import { ApiError } from '../shared/errors.ts';
export interface ErrorReport {
  id: string;
  fingerprint: string;
  platform: string;
  appVersion: string;
  eventType: string;
  errorCode: string;
  message: string;
  status: string;
  createdAt: string;
  requestId: string | null;
  stationId: string | null;
}

/**
 * 错误样本分页只返回摘要，未接入上报时诚实返回空列表；不暴露堆栈中的潜在密钥。
 */
export async function listReports(
  db: SqlDatabase,
  status: string | null,
  limit: number,
  offset: number,
) {
  const [list, count] = await Promise.all([
    db
      .prepare(
        'SELECT id,fingerprint,platform,app_version AS appVersion,event_type AS eventType,error_code AS errorCode,message,status,created_at AS createdAt,request_id AS requestId,station_id AS stationId FROM client_error_events WHERE (? IS NULL OR status=?) ORDER BY created_at DESC,id LIMIT ? OFFSET ?',
      )
      .bind(status, status, limit, offset)
      .all<ErrorReport>(),
    db
      .prepare('SELECT COUNT(*) AS total FROM client_error_events WHERE (? IS NULL OR status=?)')
      .bind(status, status)
      .first<{ total: number }>(),
  ]);
  return { list: list.results, total: count?.total ?? 0, ingestionEnabled: false };
}

/**
 * 报告状态与审计在运营库同一事务中写入，旧状态不匹配时拒绝覆盖。
 */
export async function updateReport(
  db: SqlDatabase,
  id: string,
  status: string,
  expected: string,
  event: AuditEvent,
) {
  await db.batch([
    db
      .prepare('UPDATE client_error_events SET status=? WHERE id=? AND status=?')
      .bind(status, id, expected),
    db
      .prepare(
        'INSERT INTO admin_audit_events(id,actor_id,action,entity_type,entity_id,changed_fields,request_id,created_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1',
      )
      .bind(
        event.id,
        event.actorId,
        event.action,
        event.entityType,
        event.entityId,
        event.changedFields,
        event.requestId,
        event.createdAt,
      ),
  ]);
  if (!(await db.prepare('SELECT id FROM admin_audit_events WHERE id=?').bind(event.id).first()))
    throw new ApiError(409, 'EDIT_CONFLICT', 'Report changed or no longer exists');
  return { id, status };
}
