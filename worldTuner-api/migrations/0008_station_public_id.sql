-- 仅为电台增加对外短 ID，保留所有原有主键和外键；已有数据由离线脚本回填。
ALTER TABLE station ADD COLUMN public_id TEXT COLLATE BINARY
  CHECK (public_id IS NULL OR (length(public_id) = 7 AND public_id NOT GLOB '*[^0-9A-Za-z]*'));
CREATE UNIQUE INDEX idx_station_public_id ON station(public_id COLLATE BINARY);
