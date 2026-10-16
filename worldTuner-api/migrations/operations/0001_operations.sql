-- 页面访问量永久保留；匿名去重值仅在滚动汇总窗口内保存。
CREATE TABLE IF NOT EXISTS metric_daily_views (
  day TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('web', 'android')),
  page TEXT NOT NULL,
  pv INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, source, page)
);

CREATE TABLE IF NOT EXISTS metric_daily_unique (
  day TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('web', 'android')),
  visitor_hash TEXT NOT NULL,
  PRIMARY KEY (day, source, visitor_hash)
);

CREATE TABLE IF NOT EXISTS metric_monthly_unique (
  month TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('web', 'android')),
  visitor_hash TEXT NOT NULL,
  PRIMARY KEY (month, source, visitor_hash)
);

CREATE TABLE IF NOT EXISTS metric_daily_uv (
  day TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('web', 'android')),
  uv INTEGER NOT NULL,
  PRIMARY KEY (day, source)
);

CREATE TABLE IF NOT EXISTS metric_monthly_mau (
  month TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('web', 'android')),
  mau INTEGER NOT NULL,
  PRIMARY KEY (month, source)
);
