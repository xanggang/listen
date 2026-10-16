import type { SqlDatabase, SqlStatement } from '../database/database.ts';
import type { AuditEvent } from '../types.ts';
import { ApiError } from '../shared/errors.ts';

const fields =
  'id,actor_id AS actorId,action,entity_type AS entityType,entity_id AS entityId,changed_fields AS changedFields,request_id AS requestId,created_at AS createdAt';

/**
 * 条件更新成功后才在同一事务插入 outbox；失败或版本冲突均不产生成功审计。
 * 后续关联更新只允许在本次事件存在时执行，所有值由仓储层绑定。
 */
export async function auditedChange(
  db: SqlDatabase,
  change: SqlStatement,
  event: AuditEvent,
  following: SqlStatement[] = [],
): Promise<void> {
  await db.batch([
    change,
    db
      .prepare(
        `INSERT INTO admin_outbox(id,actor_id,action,entity_type,entity_id,changed_fields,request_id,created_at)
      SELECT ?,?,?,?,?,?,?,? WHERE changes()=1`,
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
    ...following,
  ]);
  if (!(await db.prepare('SELECT id FROM admin_outbox WHERE id=?').bind(event.id).first()))
    throw new ApiError(
      409,
      'EDIT_CONFLICT',
      'Record changed or no longer exists; reload before saving',
    );
}

/**
 * 将有限批次 outbox 幂等投递到运营库；失败保留业务事件，下次请求/定时任务重试。
 * 两库不宣称一个事务，运营库写入成功后才标记投递完成。
 */
export async function deliverAudit(db: SqlDatabase, operations: SqlDatabase): Promise<void> {
  const { results } = await db
    .prepare(
      `SELECT ${fields} FROM admin_outbox WHERE delivered_at IS NULL ORDER BY created_at,id LIMIT 100`,
    )
    .all<AuditEvent>();
  if (!results.length) return;
  const writes = [];
  for (const event of results) {
    writes.push(
      operations
        .prepare(
          `INSERT INTO admin_audit_events(id,actor_id,action,entity_type,entity_id,changed_fields,request_id,created_at)
      VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
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
    );
  }
  await operations.batch(writes);
  const marks = [];
  for (const event of results)
    marks.push(
      db
        .prepare('UPDATE admin_outbox SET delivered_at=? WHERE id=? AND delivered_at IS NULL')
        .bind(new Date().toISOString(), event.id),
    );
  await db.batch(marks);
}

/**
 * 分页查询已投递审计，不返回原始请求、Token 或完整播放地址。
 */
export async function listAudit(db: SqlDatabase, limit: number, offset: number) {
  const [list, count] = await Promise.all([
    db
      .prepare(
        `SELECT ${fields} FROM admin_audit_events ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,
      )
      .bind(limit, offset)
      .all<AuditEvent>(),
    db.prepare('SELECT COUNT(*) AS total FROM admin_audit_events').first<{ total: number }>(),
  ]);
  return { list: list.results, total: count?.total ?? 0 };
}
