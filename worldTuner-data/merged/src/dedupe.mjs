import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const databasePath = fileURLToPath(new URL('../data/worldtuner-merged.sqlite', import.meta.url));
const maximumDistanceKm = 25;

/**
 * 对名称和地区只规范化 Unicode、大小写和空白，不推测近似名称。
 * @param {unknown} value 数据库字段。
 * @returns {string | null} 可比较的键。
 */
function normalizeText(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en') || null : null;
}

/**
 * 规范化最终流地址，保留查询参数和路径大小写以避免误合并。
 * @param {unknown} value 电台的 url_resolved。
 * @returns {string | null} 可比较的 HTTP(S) URL。
 */
function normalizeStream(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * 比较主页主机；不同官网主机提示可能是不同频道或转播站。
 * @param {unknown} value 电台主页。
 * @returns {string | null} 去除 www 前缀后的主机名。
 */
function homepageHost(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * 使用球面距离判断两条电台坐标是否可能属于同一地点。
 * @param {{geo_lat: number, geo_long: number}} first 第一组坐标。
 * @param {{geo_lat: number, geo_long: number}} second 第二组坐标。
 * @returns {number} 两点间公里数。
 */
function distanceKm(first, second) {
  const radians = Math.PI / 180;
  const lat1 = first.geo_lat * radians;
  const lat2 = second.geo_lat * radians;
  const deltaLat = (second.geo_lat - first.geo_lat) * radians;
  const deltaLong = (second.geo_long - first.geo_long) * radians;
  const arc = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLong / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(arc)));
}

/**
 * 检查一组相同名称和流地址的电台是否存在明显的地点冲突。
 * @param {object[]} group 候选电台。
 * @returns {'coordinate' | 'state' | 'homepage' | null} 不能自动合并的原因。
 */
function locationConflict(group) {
  const points = group.filter((row) => row.geo_lat != null && row.geo_long != null);
  for (let first = 0; first < points.length; first++) {
    for (let second = first + 1; second < points.length; second++) {
      if (distanceKm(points[first], points[second]) > maximumDistanceKm) return 'coordinate';
    }
  }
  const states = new Set();
  for (const row of group) {
    const state = normalizeText(row.state);
    if (state) states.add(state);
  }
  if (states.size > 1) return 'state';
  const homepages = new Set();
  for (const row of group) {
    const host = homepageHost(row.homepage);
    if (host) homepages.add(host);
  }
  return homepages.size > 1 ? 'homepage' : null;
}

/**
 * 优先保留已经融合的记录，再保留 Browser 记录及其最小 ID。
 * @param {object} row 电台。
 * @returns {number} 越小越优先的来源顺序。
 */
function sourceRank(row) {
  if (row.source_type === 'both') return 0;
  if (row.source_type === 'radio_browser') return 1;
  return 2;
}

/**
 * 按相同名称、国家代码和最终流地址生成保守去重计划。
 * @param {DatabaseSync} db 合并库连接。
 * @returns {{groups: object[][], skippedCoordinate: number, skippedState: number, skippedHomepage: number, removedRows: number}} 可执行计划。
 */
function buildPlan(db) {
  const candidates = new Map();
  for (const row of db.prepare('SELECT * FROM station_unified ORDER BY id').iterate()) {
    const name = normalizeText(row.name);
    const country = normalizeText(row.countrycode)?.toUpperCase();
    const stream = normalizeStream(row.url_resolved);
    if (!name || !country || !/^[A-Z]{2}$/.test(country) || !stream) continue;
    const key = `${name}\0${country}\0${stream}`;
    if (!candidates.has(key)) candidates.set(key, []);
    candidates.get(key).push(row);
  }
  const groups = [];
  let skippedCoordinate = 0;
  let skippedState = 0;
  let skippedHomepage = 0;
  let removedRows = 0;
  for (const group of candidates.values()) {
    if (group.length < 2) continue;
    const conflict = locationConflict(group);
    if (conflict === 'coordinate') {
      skippedCoordinate++;
      continue;
    }
    if (conflict === 'state') {
      skippedState++;
      continue;
    }
    if (conflict === 'homepage') {
      skippedHomepage++;
      continue;
    }
    // 相同证据下固定保留 ID，确保重复运行时的选择稳定。
    group.sort((a, b) => sourceRank(a) - sourceRank(b) || a.id - b.id);
    groups.push(group);
    removedRows += group.length - 1;
  }
  return { groups, skippedCoordinate, skippedState, skippedHomepage, removedRows };
}

/**
 * 合并逗号分隔的语言或标签原始文本，按规范化值去重并保留首次拼写。
 * @param {object[]} group 同一电台的候选记录。
 * @param {'language' | 'tags'} field 需要合并的原始字段。
 * @returns {string | null} 合并后的原始值。
 */
function unionTerms(group, field) {
  const terms = new Map();
  for (const row of group) {
    for (const part of (row[field] ?? '').split(',')) {
      const value = part.trim();
      const key = normalizeText(value);
      if (key && !terms.has(key)) terms.set(key, value);
    }
  }
  return terms.size ? [...terms.values()].join(',') : null;
}

/**
 * 将候选记录的非空基础字段补入保留记录，保持其原始 ID 和 UUID。
 * @param {object[]} group 已按保留优先级排序的候选组。
 * @returns {object} 合并后需要更新的字段。
 */
function mergedValues(group) {
  const keeper = group[0];
  const result = {
    homepage: keeper.homepage,
    favicon: keeper.favicon,
    country: keeper.country,
    country_source: keeper.country_source,
    url: keeper.url,
    url_source: keeper.url_source,
    geo_lat: keeper.geo_lat,
    geo_long: keeper.geo_long,
    geo_source: keeper.geo_source,
    tags: unionTerms(group, 'tags'),
    language: unionTerms(group, 'language'),
    catalog_status: group.some((row) => row.catalog_status === 'active') ? 'active' : keeper.catalog_status,
  };
  for (const row of group.slice(1)) {
    for (const field of ['homepage', 'favicon', 'country', 'url']) {
      if (!result[field] && row[field]) {
        result[field] = row[field];
        if (field === 'country') result.country_source = row.country_source;
        if (field === 'url') result.url_source = row.url_source;
      }
    }
    if (result.geo_lat == null && result.geo_long == null && row.geo_lat != null && row.geo_long != null) {
      result.geo_lat = row.geo_lat;
      result.geo_long = row.geo_long;
      result.geo_source = row.geo_source;
    }
  }
  return result;
}

/**
 * 在单个写事务中迁移来源、关联和审计，再删除重复行并记录旧 ID 映射。
 * @param {DatabaseSync} db 合并库写连接。
 * @param {object[][]} groups 待合并候选组。
 * @param {string} timestamp 本次操作时间。
 */
function mergeGroups(db, groups, timestamp) {
  const updateKeeper = db.prepare('UPDATE station_unified SET homepage = ?, favicon = ?, country = ?, country_source = ?, url = ?, url_source = ?, geo_lat = ?, geo_long = ?, geo_source = ?, tags = ?, language = ?, catalog_status = ?, source_type = ?, updated_at = ? WHERE id = ?');
  const moveSource = db.prepare('UPDATE station_source SET station_id = ? WHERE station_id = ?');
  const moveLanguage = db.prepare('INSERT OR IGNORE INTO station_language (station_id, language_id) SELECT ?, language_id FROM station_language WHERE station_id = ?');
  const moveTag = db.prepare('INSERT OR IGNORE INTO station_tag (station_id, tag_id) SELECT ?, tag_id FROM station_tag WHERE station_id = ?');
  const moveIssues = db.prepare('INSERT OR IGNORE INTO data_quality_issue (station_id, field_name, issue_code, raw_value, detected_at) SELECT ?, field_name, issue_code, raw_value, detected_at FROM data_quality_issue WHERE station_id = ?');
  const moveAudit = db.prepare('UPDATE data_cleaning_change SET station_id = ? WHERE station_id = ?');
  const moveAliases = db.prepare('UPDATE station_alias SET station_id = ? WHERE station_id = ?');
  const insertAlias = db.prepare('INSERT INTO station_alias (old_station_id, station_id, match_method, merged_at) VALUES (?, ?, ?, ?)');
  const deleteStation = db.prepare('DELETE FROM station_unified WHERE id = ?');
  const sourceKinds = db.prepare('SELECT DISTINCT source FROM station_source WHERE station_id = ?');
  for (const group of groups) {
    const keeper = group[0];
    const values = mergedValues(group);
    for (const duplicate of group.slice(1)) {
      moveSource.run(keeper.id, duplicate.id);
      moveLanguage.run(keeper.id, duplicate.id);
      moveTag.run(keeper.id, duplicate.id);
      moveIssues.run(keeper.id, duplicate.id);
      moveAudit.run(keeper.id, duplicate.id);
      moveAliases.run(keeper.id, duplicate.id);
      insertAlias.run(duplicate.id, keeper.id, 'same_name_country_stream', timestamp);
      db.prepare('DELETE FROM data_quality_issue WHERE station_id = ?').run(duplicate.id);
      db.prepare('DELETE FROM station_language WHERE station_id = ?').run(duplicate.id);
      db.prepare('DELETE FROM station_tag WHERE station_id = ?').run(duplicate.id);
      deleteStation.run(duplicate.id);
    }
    const kinds = new Set();
    for (const row of sourceKinds.iterate(keeper.id)) kinds.add(row.source);
    const sourceType = kinds.size === 2 ? 'both' : kinds.has('radio_browser') ? 'radio_browser' : 'radio_garden';
    updateKeeper.run(values.homepage, values.favicon, values.country, values.country_source, values.url, values.url_source, values.geo_lat, values.geo_long, values.geo_source, values.tags, values.language, values.catalog_status, sourceType, timestamp, keeper.id);
  }
}

/**
 * 在删除重复行后，从最终电台和关联表重算所有目录计数。
 * @param {DatabaseSync} db 已开启写事务的合并库。
 */
function rebuildCounts(db) {
  db.exec(`
    UPDATE countries SET stationcount = CASE
      WHEN id = (SELECT MIN(other.id) FROM countries AS other WHERE other.name = countries.name)
      THEN (SELECT COUNT(*) FROM station_unified WHERE country = countries.name)
      ELSE 0 END;
    UPDATE languages SET stationcount = (SELECT COUNT(*) FROM station_language WHERE language_id = languages.id);
    UPDATE tags SET stationcount = (SELECT COUNT(*) FROM station_tag WHERE tag_id = tags.id);
  `);
}

/**
 * 默认仅预览可安全合并的数量；--apply 才修改 merged 数据库。
 * @param {string[]} args 命令行参数，仅允许可选的 --apply。
 */
function main(args) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--apply')) {
    throw new Error('用法：node worldTuner-data/merged/src/dedupe.mjs [--apply]');
  }
  if (!existsSync(databasePath)) throw new Error(`合并数据库不存在：${databasePath}`);
  const apply = args.includes('--apply');
  const db = new DatabaseSync(databasePath, { readOnly: !apply });
  let transaction = false;
  try {
    db.exec(apply ? 'PRAGMA foreign_keys = ON; BEGIN IMMEDIATE' : 'PRAGMA query_only = ON; BEGIN');
    transaction = true;
    const plan = buildPlan(db);
    if (apply) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS station_alias (
          old_station_id INTEGER PRIMARY KEY,
          station_id INTEGER NOT NULL REFERENCES station_unified(id),
          match_method TEXT NOT NULL,
          merged_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_station_alias_station ON station_alias(station_id);
        CREATE TABLE IF NOT EXISTS dedupe_run (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          completed_at TEXT NOT NULL,
          merged_groups INTEGER NOT NULL,
          removed_rows INTEGER NOT NULL,
          skipped_coordinate_groups INTEGER NOT NULL,
          skipped_state_groups INTEGER NOT NULL,
          skipped_homepage_groups INTEGER NOT NULL
        );
      `);
      const timestamp = new Date().toISOString();
      mergeGroups(db, plan.groups, timestamp);
      rebuildCounts(db);
      db.prepare('INSERT INTO dedupe_run (id, completed_at, merged_groups, removed_rows, skipped_coordinate_groups, skipped_state_groups, skipped_homepage_groups) VALUES (1, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET completed_at = excluded.completed_at, merged_groups = excluded.merged_groups, removed_rows = excluded.removed_rows, skipped_coordinate_groups = excluded.skipped_coordinate_groups, skipped_state_groups = excluded.skipped_state_groups, skipped_homepage_groups = excluded.skipped_homepage_groups').run(timestamp, plan.groups.length, plan.removedRows, plan.skippedCoordinate, plan.skippedState, plan.skippedHomepage);
      if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('外键检查失败，去重已回滚');
      if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('数据库完整性检查失败，去重已回滚');
      db.exec('COMMIT');
    } else {
      db.exec('ROLLBACK');
    }
    transaction = false;
    console.log(JSON.stringify({ mode: apply ? 'applied' : 'preview', groups: plan.groups.length, rowsToMerge: plan.removedRows, skippedCoordinateGroups: plan.skippedCoordinate, skippedStateGroups: plan.skippedState, skippedHomepageGroups: plan.skippedHomepage }, null, 2));
  } catch (error) {
    if (transaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
