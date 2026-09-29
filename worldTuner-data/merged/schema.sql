PRAGMA foreign_keys = ON;

-- 保留 v1 station 字段，新增合并后可追溯的来源信息。
CREATE TABLE station_unified (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  changeuuid TEXT,
  stationuuid TEXT,
  name TEXT,
  url TEXT,
  url_resolved TEXT,
  homepage TEXT,
  favicon TEXT,
  tags TEXT,
  country TEXT,
  countrycode TEXT,
  iso_3166_2 TEXT,
  state TEXT,
  language TEXT,
  languagecodes TEXT,
  votes INTEGER,
  lastchangetime TEXT,
  lastchangetime_iso8601 TEXT,
  codec TEXT,
  bitrate INTEGER,
  hls INTEGER,
  lastcheckok INTEGER,
  lastchecktime TEXT,
  lastchecktime_iso8601 TEXT,
  lastcheckoktime TEXT,
  lastcheckoktime_iso8601 TEXT,
  lastlocalchecktime TEXT,
  lastlocalchecktime_iso8601 TEXT,
  clicktimestamp TEXT,
  clicktimestamp_iso8601 TEXT,
  clickcount INTEGER,
  clicktrend INTEGER,
  ssl_error INTEGER,
  geo_lat REAL,
  geo_long REAL,
  geo_distance REAL,
  has_extended_info INTEGER,
  source_type TEXT NOT NULL CHECK (source_type IN ('radio_browser', 'radio_garden', 'both')),
  name_source TEXT CHECK (name_source IN ('radio_browser', 'radio_garden', 'manual')),
  url_source TEXT CHECK (url_source IN ('radio_browser', 'radio_garden', 'manual')),
  country_source TEXT CHECK (country_source IN ('radio_browser', 'radio_garden', 'manual')),
  geo_source TEXT CHECK (geo_source IN ('radio_browser', 'radio_garden', 'manual')),
  catalog_status TEXT NOT NULL CHECK (catalog_status IN ('active', 'unverified', 'unavailable')),
  url_resolved_at TEXT,
  merged_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (geo_lat IS NULL AND geo_long IS NULL)
    OR (geo_lat IS NOT NULL AND geo_long IS NOT NULL
      AND geo_lat BETWEEN -90 AND 90 AND geo_long BETWEEN -180 AND 180)
  )
);

CREATE UNIQUE INDEX idx_station_unified_uuid ON station_unified(stationuuid) WHERE stationuuid IS NOT NULL;
CREATE INDEX idx_station_unified_votes_id ON station_unified(votes DESC, id ASC);
CREATE INDEX idx_station_unified_country ON station_unified(countrycode, id);
CREATE INDEX idx_station_unified_status ON station_unified(catalog_status, id);

CREATE TABLE station_source (
  source TEXT NOT NULL CHECK (source IN ('radio_browser', 'radio_garden')),
  external_id TEXT NOT NULL,
  station_id INTEGER NOT NULL REFERENCES station_unified(id),
  garden_place_id TEXT,
  match_method TEXT NOT NULL CHECK (
    match_method IN ('original', 'stream_name_country', 'homepage_name_country', 'previous', 'manual')
  ),
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (source, external_id)
);
CREATE INDEX idx_station_source_station ON station_source(station_id);

-- 字典字段延续 v1；关联表负责精确的多值关系。
CREATE TABLE countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  iso_3166_1 TEXT,
  stationcount INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_countries_count_id ON countries(stationcount DESC, id ASC);

CREATE TABLE languages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  iso_639 TEXT,
  stationcount INTEGER NOT NULL DEFAULT 0,
  normalized_name TEXT
);
CREATE INDEX idx_languages_normalized ON languages(normalized_name);
CREATE INDEX idx_languages_count_id ON languages(stationcount DESC, id ASC);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  stationcount INTEGER NOT NULL DEFAULT 0,
  normalized_name TEXT,
  canonical_tag_id INTEGER REFERENCES tags(id),
  is_visible INTEGER NOT NULL DEFAULT 0 CHECK (is_visible IN (0, 1))
);
CREATE INDEX idx_tags_normalized ON tags(normalized_name);
CREATE INDEX idx_tags_count_id ON tags(stationcount DESC, id ASC);

CREATE TABLE station_language (
  station_id INTEGER NOT NULL REFERENCES station_unified(id),
  language_id INTEGER NOT NULL REFERENCES languages(id),
  PRIMARY KEY (station_id, language_id)
);
CREATE INDEX idx_station_language_language ON station_language(language_id, station_id);

CREATE TABLE station_tag (
  station_id INTEGER NOT NULL REFERENCES station_unified(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (station_id, tag_id)
);
CREATE INDEX idx_station_tag_tag ON station_tag(tag_id, station_id);

CREATE TABLE merge_run (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  generated_at TEXT NOT NULL,
  browser_count INTEGER NOT NULL,
  garden_count INTEGER NOT NULL,
  matched_count INTEGER NOT NULL,
  garden_only_count INTEGER NOT NULL,
  unmatched_without_name INTEGER NOT NULL
);

-- 清洗只记录实际修改的字段；无法安全修复的问题单独留待人工判断。
CREATE TABLE data_cleaning_change (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id INTEGER NOT NULL REFERENCES station_unified(id),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT NOT NULL,
  changed_at TEXT NOT NULL
);
CREATE INDEX idx_data_cleaning_change_station ON data_cleaning_change(station_id, id);

CREATE TABLE data_quality_issue (
  station_id INTEGER NOT NULL REFERENCES station_unified(id),
  field_name TEXT NOT NULL,
  issue_code TEXT NOT NULL,
  raw_value TEXT,
  detected_at TEXT NOT NULL,
  PRIMARY KEY (station_id, field_name, issue_code)
);

CREATE TABLE data_cleaning_run (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  completed_at TEXT NOT NULL,
  changed_stations INTEGER NOT NULL,
  changed_fields INTEGER NOT NULL,
  issue_count INTEGER NOT NULL
);

CREATE TABLE tag_split_run (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  completed_at TEXT NOT NULL,
  tagged_stations INTEGER NOT NULL,
  tag_links INTEGER NOT NULL,
  canonical_tags INTEGER NOT NULL,
  applied_rules TEXT
);
