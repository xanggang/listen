import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dataDirectory = new URL('../data/', import.meta.url);
const sourceNames = ['places-core-columnar', 'places-details-columnar'];

/**
 * 从采集数据库读取一对成功的地点总览响应；缺少任意一份时明确报错。
 * @param {DatabaseSync} db Radio Garden 专用 SQLite 连接。
 * @returns {unknown[]} 依次返回 core 和 details 原始响应。
 */
export function readColumnarResponses(db) {
  const responses = [];
  const lookup = db.prepare(
    "SELECT response_json FROM api_responses WHERE endpoint = ? AND entity_id = 'all' AND status = 'success'",
  );
  for (const name of sourceNames) {
    const row = lookup.get(name);
    if (!row?.response_json) throw new Error(`采集数据库缺少 ${name} 的成功响应。`);
    responses.push(JSON.parse(row.response_json));
  }
  return responses;
}

/**
 * 将两份按列存储的响应按数组下标合并；拒绝版本不一致和无效索引、坐标。
 * @param {unknown} core 原始 places-core-columnar 响应。
 * @param {unknown} details 原始 places-details-columnar 响应。
 * @returns {{version: string, places: object[]}} 可直接存入 SQLite 的地点记录。
 */
export function normalizePlaces(core, details) {
  if (!core || !details || typeof core !== 'object' || typeof details !== 'object') {
    throw new Error('两个 columnar 响应都必须是 JSON 对象。');
  }
  if (core.apiVersion !== 1 || details.apiVersion !== 1) {
    throw new Error('不支持的 Radio Garden apiVersion。');
  }
  if (
    typeof core.version !== 'string' ||
    core.version !== details.version ||
    core.version !== core.data?.version ||
    details.version !== details.data?.version
  ) {
    throw new Error('两个响应的 version 不一致，不能按下标合并。');
  }
  const { ids, lngs, lats, sizes, boosts } = core.data;
  const { titles, countryIdx, countries } = details.data;
  const columns = { ids, lngs, lats, sizes, boosts, titles, countryIdx };
  if (!Array.isArray(ids) || !Array.isArray(countries)) {
    throw new Error('地点 ID 或国家字典不是数组。');
  }
  for (const [name, values] of Object.entries(columns)) {
    if (!Array.isArray(values) || values.length !== ids.length) {
      throw new Error(`${name} 列长度与 ids 不一致。`);
    }
  }
  const seen = new Set();
  const places = ids.map((id, index) => {
    // 同一个下标才属于同一个地点；countryIdx 则是 countries 的字典下标。
    const longitude = lngs[index];
    const latitude = lats[index];
    const countryIndex = countryIdx[index];
    const title = titles[index];
    const size = sizes[index];
    const boost = boosts[index];
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id) || seen.has(id)) {
      throw new Error(`第 ${index} 行的地点 ID 无效或重复。`);
    }
    if (
      typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    ) {
      throw new Error(`地点 ${id} 的经纬度无效。`);
    }
    if (
      typeof title !== 'string' || !title.trim() ||
      !Number.isInteger(countryIndex) || typeof countries[countryIndex] !== 'string' || !countries[countryIndex].trim() ||
      !Number.isInteger(size) || size < 0 ||
      (boost !== 0 && boost !== 1)
    ) {
      throw new Error(`地点 ${id} 的详情、国家索引或统计字段无效。`);
    }
    seen.add(id);
    return {
      id,
      title,
      country: countries[countryIndex],
      longitude,
      latitude,
      size,
      boost,
      sourceIndex: index,
    };
  });
  return { version: core.version, places };
}

/**
 * 在独立采集数据库中原子替换归一化地点；仅改动 radio_garden_places 表。
 * @param {DatabaseSync} db Radio Garden 专用 SQLite 连接。
 * @param {{version: string, places: object[]}} normalized 已校验的数据。
 * @returns {number} 写入的地点数。
 */
export function saveNormalizedPlaces(db, normalized) {
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS radio_garden_places (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      country TEXT NOT NULL,
      longitude REAL NOT NULL,
      latitude REAL NOT NULL,
      size INTEGER NOT NULL,
      boost INTEGER NOT NULL CHECK (boost IN (0, 1)),
      source_index INTEGER NOT NULL UNIQUE,
      source_version TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_radio_garden_places_country ON radio_garden_places(country);
    CREATE INDEX IF NOT EXISTS idx_radio_garden_places_coordinates ON radio_garden_places(latitude, longitude);
  `);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('DELETE FROM radio_garden_places');
    const insert = db.prepare(`
      INSERT INTO radio_garden_places
        (id, title, country, longitude, latitude, size, boost, source_index, source_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const place of normalized.places) {
      insert.run(
        place.id, place.title, place.country, place.longitude, place.latitude,
        place.size, place.boost, place.sourceIndex, normalized.version,
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return normalized.places.length;
}

/**
 * 仅从本数据源 SQLite 读取原始响应并原子重建地点表，不访问网络或生产数据库。
 */
function main() {
  if (process.argv.length > 2) throw new Error('用法：npm run normalize:radio-garden');
  const databasePath = fileURLToPath(new URL('radio-garden.sqlite', dataDirectory));
  if (!existsSync(databasePath)) throw new Error('请先运行 npm run fetch:radio-garden 采集地点总览。');
  const db = new DatabaseSync(databasePath);
  try {
    const [core, details] = readColumnarResponses(db);
    const normalized = normalizePlaces(core, details);
    const count = saveNormalizedPlaces(db, normalized);
    const countries = db.prepare('SELECT COUNT(DISTINCT country) AS count FROM radio_garden_places').get().count;
    console.log(`已整理 ${count} 个地点、${countries} 个国家或地区，版本 ${normalized.version}。`);
  } finally {
    db.close();
  }
}

// 仅在直接执行此文件时运行命令行入口，测试导入时不触碰本地数据库。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`地点整理失败：${error.message}`);
    process.exitCode = 1;
  }
}
