-- 行为测试种子数据：覆盖可见性、目录状态、播放流排序与译名聚合。
INSERT INTO country (id, name, code) VALUES ('0000000000000000001', 'China', 'CN');

INSERT INTO tag (id, name, normalized_name, name_en, name_zh) VALUES
  ('0000000000000000031', 'pop', 'pop', 'Pop', '流行'),
  ('0000000000000000032', 'jazz', 'jazz', 'Jazz', '爵士');

INSERT INTO language (id, name, name_en, name_zh, code) VALUES
  ('0000000000000000051', 'English', 'English', '英语', 'en'),
  ('0000000000000000052', '中文', 'Chinese', '中文', 'zh');

-- 公开电台：两个播放流（首选流检查通过），有坐标。
INSERT INTO station (id, name, website, favicon, country_id, place, latitude, longitude,
  votes, clickcount, source_type, catalog_status, visibility_status, created_at, updated_at) VALUES
  ('0000000000000001001', 'Radio One', 'https://one.example', NULL,
   '0000000000000000001', 'Shanghai', 31.230416, 121.473756,
   10, 100, 'both', 'active', 'visible', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

INSERT INTO station_stream (id, station_id, url, resolved_url, codec, bitrate, is_hls,
  is_primary, last_check_ok, last_checked_at, resolved_at) VALUES
  ('0000000000000002001', '0000000000000001001', 'http://stream.example/failed', NULL,
   'MP3', 128, NULL, 0, 0, '2026-01-01T00:00:00Z', NULL),
  ('0000000000000002002', '0000000000000001001', 'http://stream.example/primary',
   'http://resolved.example/primary', 'MP3', 128, NULL, 1, 1, '2026-01-01T00:00:00Z',
   '2026-01-01T00:00:00Z');

INSERT INTO station_link (id, station_id, platform, url) VALUES
  ('0000000000000003001', '0000000000000001001', 'website', 'https://one.example');

INSERT INTO station_tag (station_id, tag_id) VALUES
  ('0000000000000001001', '0000000000000000031'),
  ('0000000000000001001', '0000000000000000032');

INSERT INTO station_language (station_id, language_id) VALUES
  ('0000000000000001001', '0000000000000000051'),
  ('0000000000000001001', '0000000000000000052');

-- 公开电台：无播放流，有坐标，票数较低。
INSERT INTO station (id, name, website, favicon, country_id, place, latitude, longitude,
  votes, clickcount, source_type, catalog_status, visibility_status, created_at, updated_at) VALUES
  ('0000000000000001004', 'Radio Four', NULL, NULL,
   NULL, 'Beijing', 39.904200, 116.407396,
   5, 10, 'radio_browser', 'unverified', 'visible', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

-- 隐藏电台：不参与列表、详情、地图与计数。
INSERT INTO station (id, name, website, favicon, country_id, place, latitude, longitude,
  votes, clickcount, source_type, catalog_status, visibility_status, created_at, updated_at) VALUES
  ('0000000000000001002', 'Hidden Radio', NULL, NULL,
   '0000000000000000001', NULL, 30.0, 120.0,
   50, 0, 'radio_browser', 'active', 'hidden', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

-- 不可用电台：不参与列表、详情、地图与计数。
INSERT INTO station (id, name, website, favicon, country_id, place, latitude, longitude,
  votes, clickcount, source_type, catalog_status, visibility_status, created_at, updated_at) VALUES
  ('0000000000000001003', 'Dead Radio', NULL, NULL,
   NULL, NULL, 1.0, 1.0,
   60, 0, 'radio_browser', 'unavailable', 'visible', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
