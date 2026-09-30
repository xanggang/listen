import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { createSnowflakeIdGenerator } from '../../v2/src/snowflake-id.mjs';
import { normalizeTag, proposeTag } from './report-tags.mjs';

const defaultSource = fileURLToPath(new URL('../data/radio-browser.sqlite', import.meta.url));
const defaultTarget = fileURLToPath(new URL('../../v2/data/worldtuner-v2.sqlite', import.meta.url));
const tagRulesPath = new URL('./tag-cleaning-rules.json', import.meta.url);
const tagTranslationsPath = new URL('./tag-names.zh-CN.json', import.meta.url);
const stationFields = ['name', 'website', 'favicon', 'country_id', 'place', 'votes', 'clickcount'];

/**
 * 取得用于去重的实际播放地址：优先使用已解析的流地址，缺失时回退到原始入口。
 * 只清理首尾空白，不改写大小写、协议、查询参数或尾斜杠，以免把不同流误判为同一地址。
 * @param {{url?: string | null, resolved_url?: string | null, url_resolved?: string | null}} stream 播放流字段。
 * @returns {string | null} 可比较的地址；两个字段都为空时返回 null。
 */
export function playbackKey(stream) {
  return clean(stream.resolved_url ?? stream.url_resolved) ?? clean(stream.url);
}

/** 清理来源文本；数字零与布尔值由调用方单独处理。 */
function clean(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** 验证可选非负整数；异常的来源统计或码率视为缺失。 */
function nonnegative(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** 验证坐标必须成对且处于经纬度范围内。 */
function coordinates(row) {
  return Number.isFinite(row.geo_lat) &&
    Number.isFinite(row.geo_long) &&
    row.geo_lat >= -90 &&
    row.geo_lat <= 90 &&
    row.geo_long >= -180 &&
    row.geo_long <= 180
    ? [row.geo_lat, row.geo_long]
    : [null, null];
}

/**
 * 为同一播放地址选择稳定的 Radio Browser 优先顺序：最近检查可用、票数、点击数，最后按 UUID。
 * 排在前面的记录优先提供非空字段，后面的记录仅补缺失字段；同一批数据重复运行会得到相同结果。
 */
function compareBrowserRows(a, b) {
  return (
    (b.lastcheckok === 1) - (a.lastcheckok === 1) ||
    (nonnegative(b.votes) ?? -1) - (nonnegative(a.votes) ?? -1) ||
    (nonnegative(b.clickcount) ?? -1) - (nonnegative(a.clickcount) ?? -1) ||
    a.stationuuid.localeCompare(b.stationuuid)
  );
}

/** 将同一来源的字段按优先级合并；空值不能覆盖已有值。 */
function firstValue(rows, field) {
  for (const row of rows) {
    const value = clean(row[field]);
    if (value !== null) return value;
  }
  return null;
}

/** 取得排序后首个合法非负整数，保留有效的零。 */
function firstNumber(rows, field) {
  for (const row of rows) {
    const value = nonnegative(row[field]);
    if (value !== null) return value;
  }
  return null;
}

/** 取得排序后首组成对且合法的经纬度，不混用不同记录的坐标。 */
function firstCoordinates(rows) {
  for (const row of rows) {
    const pair = coordinates(row);
    if (pair[0] !== null) return pair;
  }
  return [null, null];
}

/** 将 Radio Browser 的最后检查结果映射为目录状态；未知检查结果不推断不可用。 */
function browserStatus(row) {
  return row.lastcheckok === 1 ? 'active' : row.lastcheckok === 0 ? 'unavailable' : 'unverified';
}

/** 将已有台站的非空字段补入主记录；用于多个 Garden ID 命中同一流的情况。 */
function combineExisting(primary, secondary) {
  const merged = { ...primary };
  for (const field of stationFields) {
    if (merged[field] === null && secondary[field] !== null) merged[field] = secondary[field];
  }
  if (merged.latitude === null && secondary.latitude !== null) {
    merged.latitude = secondary.latitude;
    merged.longitude = secondary.longitude;
  }
  if (secondary.visibility_status === 'hidden') merged.visibility_status = 'hidden';
  return merged;
}

/** Radio Browser 的有效字段覆盖 Garden 字段；空值保留已有数据。 */
function combineBrowser(station, browser) {
  const merged = { ...station };
  for (const field of stationFields) {
    if (browser[field] !== null) merged[field] = browser[field];
  }
  if (browser.latitude !== null) {
    merged.latitude = browser.latitude;
    merged.longitude = browser.longitude;
  }
  merged.source_type =
    station.source_type === 'radio_garden' || station.source_type === 'both'
      ? 'both'
      : 'radio_browser';
  merged.catalog_status = browser.catalog_status;
  return merged;
}

/** 沿已合并的 ID 映射找到仍存在的台站，避免多播放流台站被再次匹配时引用已删除的 ID。 */
function canonicalStationId(id, mergedIds) {
  let current = id;
  while (mergedIds.has(current)) current = mergedIds.get(current);
  return current;
}

/** 根据逗号分隔字段收集不重复的非空值，保留原始显示文本。 */
function splitValues(value) {
  return (clean(value) ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** 根据来源 countrycode 匹配现有国家；合法但未知的代码按需建档。 */
function countryIdFor(rows, countryIds, insertCountry, nextId) {
  const code = firstValue(rows, 'countrycode')?.toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) return null;
  let id = countryIds.get(code);
  if (!id) {
    id = nextId();
    insertCountry.run(id, firstValue(rows, 'country') ?? code, code);
    countryIds.set(code, id);
  }
  return id;
}

/** 将一组同流 Radio Browser 记录变成一份台站字段，按稳定顺序逐字段补空值。 */
function browserStation(rows, countryId) {
  const [latitude, longitude] = firstCoordinates(rows);
  return {
    name: firstValue(rows, 'name'),
    website: firstValue(rows, 'homepage'),
    favicon: firstValue(rows, 'favicon'),
    country_id: countryId,
    place: firstValue(rows, 'state'),
    latitude,
    longitude,
    votes: firstNumber(rows, 'votes'),
    clickcount: firstNumber(rows, 'clickcount'),
    catalog_status: browserStatus(rows[0]),
  };
}

/**
 * 按实际播放地址把 Radio Browser 导入 V2。相同流归为一台，字段优先使用 Browser 非空值；
 * 所有原始 UUID 和 Garden ID 保留在 station_source。目标库已有 Browser 来源时拒绝重入，失败整体回滚。
 * @param {string} sourcePath Radio Browser 原始库路径，只读打开。
 * @param {string} targetPath 已建表的 V2 库路径。
 * @param {{workerId?: number}} [options] 同一目标库并发生成 ID 时独立的节点编号。
 * @returns {object} 导入、去重及跳过记录的统计。
 */
export function importRadioBrowser(
  sourcePath = defaultSource,
  targetPath = defaultTarget,
  options = {},
) {
  const sourceFile = resolve(sourcePath);
  const targetFile = resolve(targetPath);
  if (sourceFile === targetFile) throw new Error('源数据库和目标数据库不能是同一文件。');
  if (!existsSync(sourceFile)) throw new Error(`找不到 Radio Browser 原始库：${sourceFile}`);
  if (!existsSync(targetFile)) throw new Error(`找不到 V2 数据库：${targetFile}`);
  const nextId = createSnowflakeIdGenerator({ workerId: options.workerId });
  const tagRules = JSON.parse(readFileSync(tagRulesPath, 'utf8'));
  const tagTranslations = JSON.parse(readFileSync(tagTranslationsPath, 'utf8'));
  const tagAliases = new Map();
  for (const [targetName, names] of Object.entries(tagRules.aliases)) {
    for (const name of names) tagAliases.set(normalizeTag(name), targetName);
  }
  const source = new DatabaseSync(sourceFile, { readOnly: true });
  const target = new DatabaseSync(targetFile);
  let sourceTransaction = false;
  let targetTransaction = false;
  try {
    source.exec('BEGIN');
    sourceTransaction = true;
    target.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    if (
      target.prepare("SELECT 1 FROM station_source WHERE source = 'radio_browser' LIMIT 1").get()
    ) {
      throw new Error('V2 数据库已有 Radio Browser 来源记录，拒绝重复导入。');
    }
    const groups = new Map();
    const skipped = { missingUrl: 0, missingName: 0, missingUuid: 0 };
    for (const row of source.prepare('SELECT * FROM station ORDER BY stationuuid').iterate()) {
      const uuid = clean(row.stationuuid);
      const key = playbackKey(row);
      if (!uuid) {
        skipped.missingUuid++;
        continue;
      }
      if (!key) {
        skipped.missingUrl++;
        continue;
      }
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
    if (!groups.size) throw new Error('没有可导入的 Radio Browser 播放地址。');
    for (const [key, rows] of groups) {
      if (!rows.some((row) => clean(row.name))) {
        skipped.missingName += rows.length;
        groups.delete(key);
      }
    }
    if (!groups.size) throw new Error('没有可导入且有名称的 Radio Browser 电台。');
    target.exec('BEGIN IMMEDIATE');
    targetTransaction = true;
    // 兼容已有 V2 文件，为中文展示名补列；失败时与整批导入一起回滚。
    if (
      !target
        .prepare('PRAGMA table_info(tag)')
        .all()
        .some((row) => row.name === 'name_zh')
    ) {
      target.exec(
        'ALTER TABLE tag ADD COLUMN name_zh TEXT CHECK (name_zh IS NULL OR length(trim(name_zh)) > 0)',
      );
    }
    target.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_language_code_unique ON language(code) WHERE code IS NOT NULL',
    );
    const importedAt = new Date().toISOString();
    const existing = new Map();
    const canonicalIds = new Map();
    for (const stream of target
      .prepare('SELECT station_id, url, resolved_url FROM station_stream')
      .iterate()) {
      const key = playbackKey(stream);
      if (!key) continue;
      const ids = existing.get(key) ?? new Set();
      ids.add(stream.station_id);
      existing.set(key, ids);
    }
    const countryIds = new Map(
      target
        .prepare('SELECT code, id FROM country')
        .all()
        .map((row) => [row.code, row.id]),
    );
    const tagIds = new Map(
      target
        .prepare('SELECT normalized_name, id FROM tag ORDER BY id')
        .all()
        .map((row) => [row.normalized_name, row.id]),
    );
    const languageIds = new Map(
      target
        .prepare('SELECT lower(code) AS code, id FROM language WHERE code IS NOT NULL ORDER BY id')
        .all()
        .map((row) => [row.code, row.id]),
    );
    const insertCountry = target.prepare('INSERT INTO country (id, name, code) VALUES (?, ?, ?)');
    const getStation = target.prepare('SELECT * FROM station WHERE id = ?');
    const insertStation = target.prepare(`INSERT INTO station
      (id, name, website, favicon, country_id, place, latitude, longitude, votes, clickcount,
       source_type, catalog_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'radio_browser', ?, ?, ?)`);
    const updateStation = target.prepare(`UPDATE station SET
      name = ?, website = ?, favicon = ?, country_id = ?, place = ?, latitude = ?, longitude = ?,
      votes = ?, clickcount = ?, source_type = ?, catalog_status = ?, visibility_status = ?,
      updated_at = ? WHERE id = ?`);
    const insertSource = target.prepare(`INSERT INTO station_source
      (source, external_id, station_id, match_method, last_seen_at, source_updated_at)
      VALUES ('radio_browser', ?, ?, ?, ?, ?)`);
    const insertStream = target.prepare(`INSERT INTO station_stream
      (id, station_id, url, resolved_url, codec, bitrate, is_hls, is_primary,
       last_check_ok, last_checked_at, resolved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const streamExists = target.prepare(
      "SELECT 1 FROM station_stream WHERE station_id = ? AND url = ? AND coalesce(resolved_url, '') = ? LIMIT 1",
    );
    const insertTag = target.prepare(
      'INSERT INTO tag (id, name, normalized_name, name_zh) VALUES (?, ?, ?, ?)',
    );
    const insertStationTag = target.prepare(
      'INSERT OR IGNORE INTO station_tag (station_id, tag_id) VALUES (?, ?)',
    );
    const insertLanguage = target.prepare('INSERT INTO language (id, name, code) VALUES (?, ?, ?)');
    const insertStationLanguage = target.prepare(
      'INSERT OR IGNORE INTO station_language (station_id, language_id) VALUES (?, ?)',
    );
    const mergeSources = target.prepare(
      'UPDATE station_source SET station_id = ?, match_method = ? WHERE station_id = ?',
    );
    const mergeStreams = target.prepare(
      'UPDATE station_stream SET station_id = ?, is_primary = 0 WHERE station_id = ?',
    );
    const mergeLinks =
      target.prepare(`INSERT OR IGNORE INTO station_link (id, station_id, platform, url)
      SELECT id, ?, platform, url FROM station_link WHERE station_id = ?`);
    const deleteLinks = target.prepare('DELETE FROM station_link WHERE station_id = ?');
    const mergeTags = target.prepare(
      'INSERT OR IGNORE INTO station_tag SELECT ?, tag_id FROM station_tag WHERE station_id = ?',
    );
    const mergeLanguages = target.prepare(
      'INSERT OR IGNORE INTO station_language SELECT ?, language_id FROM station_language WHERE station_id = ?',
    );
    const deleteTags = target.prepare('DELETE FROM station_tag WHERE station_id = ?');
    const deleteLanguages = target.prepare('DELETE FROM station_language WHERE station_id = ?');
    const mergeModeration = target.prepare(
      'UPDATE moderation_record SET station_id = ? WHERE station_id = ?',
    );
    const deleteStation = target.prepare('DELETE FROM station WHERE id = ?');
    const stats = {
      sourceRows: 0,
      newStations: 0,
      matchedGarden: 0,
      duplicateBrowser: 0,
      mergedGarden: 0,
      streams: 0,
      tags: 0,
      languages: 0,
      skipped,
    };

    for (const [key, rows] of groups) {
      rows.sort(compareBrowserRows);
      const countryId = countryIdFor(rows, countryIds, insertCountry, nextId);
      const browser = browserStation(rows, countryId);
      const matches = [
        ...new Set(
          [...(existing.get(key) ?? [])].map((id) => canonicalStationId(id, canonicalIds)),
        ),
      ].sort();
      let stationId;
      let station;
      if (matches.length) {
        stationId = matches[0];
        station = getStation.get(stationId);
        for (const duplicateId of matches.slice(1)) {
          const duplicate = getStation.get(duplicateId);
          station = combineExisting(station, duplicate);
          mergeSources.run(stationId, 'playback_url', duplicateId);
          mergeStreams.run(stationId, duplicateId);
          mergeLinks.run(stationId, duplicateId);
          deleteLinks.run(duplicateId);
          mergeTags.run(stationId, duplicateId);
          mergeLanguages.run(stationId, duplicateId);
          deleteTags.run(duplicateId);
          deleteLanguages.run(duplicateId);
          mergeModeration.run(stationId, duplicateId);
          deleteStation.run(duplicateId);
          canonicalIds.set(duplicateId, stationId);
          stats.mergedGarden++;
        }
        station = combineBrowser(station, browser);
        updateStation.run(
          station.name,
          station.website,
          station.favicon,
          station.country_id,
          station.place,
          station.latitude,
          station.longitude,
          station.votes,
          station.clickcount,
          station.source_type,
          station.catalog_status,
          station.visibility_status,
          importedAt,
          stationId,
        );
        stats.matchedGarden++;
      } else {
        stationId = nextId();
        insertStation.run(
          stationId,
          browser.name,
          browser.website,
          browser.favicon,
          browser.country_id,
          browser.place,
          browser.latitude,
          browser.longitude,
          browser.votes,
          browser.clickcount,
          browser.catalog_status,
          importedAt,
          importedAt,
        );
        stats.newStations++;
      }
      for (const row of rows) {
        insertSource.run(
          row.stationuuid,
          stationId,
          'playback_url',
          importedAt,
          clean(row.lastchangetime_iso8601),
        );
        stats.sourceRows++;
      }
      stats.duplicateBrowser += rows.length - 1;
      const representative = rows[0];
      const rawUrl = clean(representative.url) ?? key;
      const resolvedUrl = clean(representative.url_resolved);
      if (!streamExists.get(stationId, rawUrl, resolvedUrl ?? '')) {
        insertStream.run(
          nextId(),
          stationId,
          rawUrl,
          resolvedUrl,
          clean(representative.codec),
          nonnegative(representative.bitrate),
          representative.hls === 0 || representative.hls === 1 ? representative.hls : null,
          matches.length ? 0 : 1,
          representative.lastcheckok === 0 || representative.lastcheckok === 1
            ? representative.lastcheckok
            : null,
          clean(representative.lastchecktime_iso8601),
          null,
        );
        stats.streams++;
      }
      for (const row of rows) {
        for (const name of splitValues(row.tags)) {
          const proposal = proposeTag(name, tagRules, tagAliases);
          if (proposal.action === 'ignore') continue;
          const normalized = proposal.target ?? normalizeTag(name);
          let tagId = tagIds.get(normalized);
          if (!tagId) {
            tagId = nextId();
            insertTag.run(tagId, normalized, normalized, tagTranslations[normalized] ?? null);
            tagIds.set(normalized, tagId);
            stats.tags++;
          }
          insertStationTag.run(stationId, tagId);
        }
        for (const codeText of splitValues(row.languagecodes)) {
          const code = codeText.toLowerCase();
          if (!/^[a-z]{2,3}(?:-[a-z0-9]+)?$/.test(code)) continue;
          let languageId = languageIds.get(code);
          if (!languageId) {
            languageId = nextId();
            const names = splitValues(row.language);
            const codes = splitValues(row.languagecodes);
            const name =
              names.length === codes.length
                ? names[codes.findIndex((item) => item.toLowerCase() === code)]
                : null;
            insertLanguage.run(languageId, name || code, code);
            languageIds.set(code, languageId);
            stats.languages++;
          }
          insertStationLanguage.run(stationId, languageId);
        }
      }
    }
    const integrity = target.prepare('PRAGMA integrity_check').get();
    const foreignKeys = target.prepare('PRAGMA foreign_key_check').all();
    if (integrity?.integrity_check !== 'ok' || foreignKeys.length) {
      throw new Error('导入后的 V2 数据库完整性或外键检查失败。');
    }
    target.exec('COMMIT');
    targetTransaction = false;
    source.exec('COMMIT');
    sourceTransaction = false;
    return stats;
  } catch (error) {
    if (targetTransaction) target.exec('ROLLBACK');
    if (sourceTransaction) source.exec('ROLLBACK');
    throw error;
  } finally {
    target.close();
    source.close();
  }
}

/** 读取命令行路径并执行本地导入，不请求网络或远程数据库。 */
function main() {
  const { values } = parseArgs({
    options: {
      source: { type: 'string' },
      target: { type: 'string' },
      'worker-id': { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(
      '用法：npm run process:radio-browser:v2 -- [--source 原始库] [--target V2库] [--worker-id 0-1023]',
    );
    return;
  }
  const workerId = values['worker-id'] === undefined ? 1 : Number(values['worker-id']);
  console.log(
    JSON.stringify(importRadioBrowser(values.source, values.target, { workerId }), null, 2),
  );
}

// 作为模块导入时不执行命令行入口。
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(`Radio Browser V2 导入失败：${error.message}`);
    process.exitCode = 1;
  }
}
