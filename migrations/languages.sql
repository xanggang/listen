-- ----------------------------
-- Table structure for languages
-- ----------------------------
DROP TABLE IF EXISTS "languages";

CREATE TABLE "languages" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT, -- D1 中使用 INTEGER PRIMARY KEY 实现自增
  "name" TEXT,                            -- SQLite 推荐使用 TEXT
  "iso_639" TEXT,
  "stationcount" INTEGER
);


-- npx wrangler d1 execute listen --local --file=./migrations/languages.sql
