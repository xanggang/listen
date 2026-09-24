-- Non-destructive baseline: safe for an existing listen database.
CREATE TABLE IF NOT EXISTS "station" (
   "id" INTEGER PRIMARY KEY AUTOINCREMENT,
   "changeuuid" TEXT,
   "stationuuid" TEXT,
   "name" TEXT,
   "url" TEXT,
   "url_resolved" TEXT,
   "homepage" TEXT,
   "favicon" TEXT,
   "tags" TEXT,
   "country" TEXT,
   "countrycode" TEXT,
   "iso_3166_2" TEXT,
   "state" TEXT,
   "language" TEXT,
   "languagecodes" TEXT,
   "votes" INTEGER,
   "lastchangetime" TEXT,           -- SQLite 建议将日期存为 TEXT (YYYY-MM-DD HH:MM:SS)
   "lastchangetime_iso8601" TEXT,
   "codec" TEXT,
   "bitrate" INTEGER,
   "hls" INTEGER,
   "lastcheckok" INTEGER,
   "lastchecktime" TEXT,
   "lastchecktime_iso8601" TEXT,
   "lastcheckoktime" TEXT,
   "lastcheckoktime_iso8601" TEXT,
   "lastlocalchecktime" TEXT,
   "lastlocalchecktime_iso8601" TEXT,
   "clicktimestamp" TEXT,
   "clicktimestamp_iso8601" TEXT,
   "clickcount" INTEGER,
   "clicktrend" INTEGER,
   "ssl_error" INTEGER,
   "geo_lat" REAL,                  -- SQLite 中 double/float 对应 REAL
   "geo_long" REAL,
   "geo_distance" REAL,
   "has_extended_info" INTEGER      -- SQLite 没有 boolean/tinyint，通常用 0 或 1 表示
);
CREATE TABLE IF NOT EXISTS "languages" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT, -- D1 中使用 INTEGER PRIMARY KEY 实现自增
  "name" TEXT,                            -- SQLite 推荐使用 TEXT
  "iso_639" TEXT,
  "stationcount" INTEGER
);
CREATE TABLE IF NOT EXISTS `tags` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT, -- D1 中使用 INTEGER PRIMARY KEY 实现自增
  `name` varchar(255) DEFAULT NULL,
  `stationcount` int DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS `countries` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT, -- D1 中使用 INTEGER PRIMARY KEY 实现自增
  `name` varchar(255) DEFAULT NULL,
  `iso_3166_1` varchar(255) DEFAULT NULL,
  `stationcount` int DEFAULT NULL
);
