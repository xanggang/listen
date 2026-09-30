-- V2 业务库只保存整理后的数据；原始采集库保持独立。
CREATE TABLE country (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 19 AND id NOT GLOB '*[^0-9]*'),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  code TEXT NOT NULL UNIQUE CHECK (code GLOB '[A-Z][A-Z]')
);

CREATE TABLE station (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 19 AND id NOT GLOB '*[^0-9]*'),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  website TEXT,
  favicon TEXT,
  country_id TEXT REFERENCES country(id) ON DELETE SET NULL,
  place TEXT CHECK (place IS NULL OR length(trim(place)) > 0),
  latitude REAL,
  longitude REAL,
  votes INTEGER CHECK (votes IS NULL OR votes >= 0),
  clickcount INTEGER CHECK (clickcount IS NULL OR clickcount >= 0),
  source_type TEXT NOT NULL CHECK (source_type IN ('radio_browser', 'radio_garden', 'both')),
  catalog_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (catalog_status IN ('active', 'unverified', 'unavailable')),
  visibility_status TEXT NOT NULL DEFAULT 'visible'
    CHECK (visibility_status IN ('visible', 'hidden')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude IS NOT NULL AND longitude IS NOT NULL
      AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  )
);
CREATE INDEX idx_station_country ON station(country_id, id);
CREATE INDEX idx_station_visibility_catalog ON station(visibility_status, catalog_status, id);
CREATE INDEX idx_station_votes ON station(votes DESC, id ASC);

CREATE TABLE station_stream (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 19 AND id NOT GLOB '*[^0-9]*'),
  station_id TEXT NOT NULL REFERENCES station(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK (length(trim(url)) > 0),
  resolved_url TEXT,
  codec TEXT,
  bitrate INTEGER CHECK (bitrate IS NULL OR bitrate >= 0),
  is_hls INTEGER CHECK (is_hls IS NULL OR is_hls IN (0, 1)),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  last_check_ok INTEGER CHECK (last_check_ok IS NULL OR last_check_ok IN (0, 1)),
  last_checked_at TEXT,
  resolved_at TEXT
);
CREATE INDEX idx_station_stream_station ON station_stream(station_id, id);
CREATE UNIQUE INDEX idx_station_stream_primary ON station_stream(station_id) WHERE is_primary = 1;

CREATE TABLE station_link (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 19 AND id NOT GLOB '*[^0-9]*'),
  station_id TEXT NOT NULL REFERENCES station(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (length(trim(platform)) > 0),
  url TEXT NOT NULL CHECK (length(trim(url)) > 0),
  UNIQUE (station_id, platform, url)
);
CREATE INDEX idx_station_link_station ON station_link(station_id, id);

CREATE TABLE station_source (
  source TEXT NOT NULL CHECK (source IN ('radio_browser', 'radio_garden')),
  external_id TEXT NOT NULL CHECK (length(trim(external_id)) > 0),
  station_id TEXT NOT NULL REFERENCES station(id) ON DELETE CASCADE,
  match_method TEXT,
  last_seen_at TEXT NOT NULL,
  source_updated_at TEXT,
  PRIMARY KEY (source, external_id)
);
CREATE INDEX idx_station_source_station ON station_source(station_id, source);

CREATE TABLE tag (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 19 AND id NOT GLOB '*[^0-9]*'),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  normalized_name TEXT NOT NULL CHECK (length(trim(normalized_name)) > 0),
  -- 中文展示名；待审或尚未翻译的标签保持 NULL。
  name_zh TEXT CHECK (name_zh IS NULL OR length(trim(name_zh)) > 0)
);
CREATE INDEX idx_tag_normalized_name ON tag(normalized_name);

CREATE TABLE language (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 19 AND id NOT GLOB '*[^0-9]*'),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  code TEXT
);
CREATE INDEX idx_language_code ON language(code);
-- 语言代码是 Radio Browser 导入时的匹配键；NULL 仍可用于无代码的语种。
CREATE UNIQUE INDEX idx_language_code_unique ON language(code) WHERE code IS NOT NULL;

CREATE TABLE station_tag (
  station_id TEXT NOT NULL REFERENCES station(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (station_id, tag_id)
);
CREATE INDEX idx_station_tag_tag ON station_tag(tag_id, station_id);

CREATE TABLE station_language (
  station_id TEXT NOT NULL REFERENCES station(id) ON DELETE CASCADE,
  language_id TEXT NOT NULL REFERENCES language(id) ON DELETE CASCADE,
  PRIMARY KEY (station_id, language_id)
);
CREATE INDEX idx_station_language_language ON station_language(language_id, station_id);

CREATE TABLE moderation_record (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 19 AND id NOT GLOB '*[^0-9]*'),
  station_id TEXT NOT NULL REFERENCES station(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('complaint', 'report', 'block', 'unblock')),
  reason_code TEXT NOT NULL CHECK (length(trim(reason_code)) > 0),
  details TEXT,
  review_status TEXT CHECK (review_status IN ('pending', 'accepted', 'rejected')),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('anonymous', 'admin', 'system')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  CHECK (
    (event_type IN ('complaint', 'report') AND review_status IS NOT NULL)
    OR (event_type IN ('block', 'unblock') AND review_status IS NULL)
  )
);
CREATE INDEX idx_moderation_record_station ON moderation_record(station_id, created_at DESC, id DESC);
