-- 管理写入与审计事件在同一个业务事务中提交；不保存完整请求或播放 URL。
CREATE TABLE IF NOT EXISTS admin_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changed_fields TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_outbox_pending ON admin_outbox(delivered_at, created_at, id);
