CREATE TABLE IF NOT EXISTS admin_actors (
  id TEXT PRIMARY KEY NOT NULL,
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','viewer')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  UNIQUE(issuer, subject)
);
CREATE TABLE IF NOT EXISTS admin_audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changed_fields TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_events(created_at DESC,id);
-- 管理查询与处理入口先落地；客户端上报另行接入，不伪造样本数据。
CREATE TABLE IF NOT EXISTS client_error_events (
  id TEXT PRIMARY KEY NOT NULL,
  fingerprint TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('web','android')),
  app_version TEXT NOT NULL,
  event_type TEXT NOT NULL,
  error_code TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  station_id TEXT,
  request_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','ignored')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_client_errors_created ON client_error_events(created_at DESC,id);
CREATE INDEX IF NOT EXISTS idx_client_errors_status_created ON client_error_events(status,created_at DESC);
