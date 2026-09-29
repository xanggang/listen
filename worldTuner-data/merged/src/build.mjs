import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = fileURLToPath(new URL('../', import.meta.url));
const browserPath = resolve(root, '../radio-browser/data/radio-browser.sqlite');
const gardenPath = resolve(root, '../radio-garden/data/radio-garden.sqlite');
const outputPath = resolve(root, 'data/worldtuner-merged.sqlite');
const stationFields = `id changeuuid stationuuid name url url_resolved homepage favicon tags country countrycode iso_3166_2 state language languagecodes votes lastchangetime lastchangetime_iso8601 codec bitrate hls lastcheckok lastchecktime lastchecktime_iso8601 lastcheckoktime lastcheckoktime_iso8601 lastlocalchecktime lastlocalchecktime_iso8601 clicktimestamp clicktimestamp_iso8601 clickcount clicktrend ssl_error geo_lat geo_long geo_distance has_extended_info`.split(' ');
const metadataFields = `source_type name_source url_source country_source geo_source catalog_status url_resolved_at merged_at updated_at`.split(' ');

/**
 * 将外部来源的非空文本转换为可用于比较和展示的字符串。
 * @param {unknown} value SQLite 或 JSON 中的字段值。
 * @returns {string | null} 修剪后的文本；空值返回 null。
 */
function cleanText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * 为保守的跨源匹配规范化名称；只处理 Unicode、大小写和连续空白。
 * @param {unknown} value 电台名称。
 * @returns {string | null} 可比较的名称。
 */
function normalizeName(value) {
  const text = cleanText(value);
  return text ? text.normalize('NFKC').toLocaleLowerCase('en').replace(/\s+/g, ' ') : null;
}

/**
 * 规范化 URL 的主机、默认端口和末尾斜杠，保留路径和查询参数以避免误合并。
 * @param {unknown} value 原始 URL。
 * @returns {string | null} 可比较的 HTTP(S) URL。
 */
function normalizeUrl(value) {
  const text = cleanText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * 仅接受合法的经纬度成对数值，避免输出半组或越界坐标。
 * @param {unknown} latitude 纬度。
 * @param {unknown} longitude 经度。
 * @returns {{lat: number, long: number} | null} 可写入的坐标。
 */
function coordinates(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { lat: latitude, long: longitude };
}

/**
 * 从固定的来源库中只读打开 SQLite，并在本次构建期间保持一致的读快照。
 * @param {string} path 代码中固定的源库路径。
 * @returns {DatabaseSync} 已开启读事务的连接。
 */
function openSource(path) {
  if (!existsSync(path)) throw new Error(`找不到源数据库：${path}`);
  const db = new DatabaseSync(path, { readOnly: true });
  db.exec('PRAGMA query_only = ON; BEGIN');
  return db;
}

/**
 * 读取上一版输出的 Radio Garden 专属 ID，重建时尽可能保持对外 ID 稳定。
 * @returns {Map<string, number>} channel ID 到旧的内部 ID；首次构建为空。
 */
function previousGardenIds() {
  const ids = new Map();
  if (!existsSync(outputPath)) return ids;
  const db = new DatabaseSync(outputPath, { readOnly: true });
  try {
    for (const row of db.prepare("SELECT s.external_id, s.station_id FROM station_source s JOIN station_unified u ON u.id = s.station_id WHERE s.source = 'radio_garden' AND u.source_type = 'radio_garden'").iterate()) {
      ids.set(row.external_id, row.station_id);
    }
  } finally {
    db.close();
  }
  return ids;
}

/**
 * 从浏览器库读取 v1 电台与字典，保留原站点 ID 和所有 v1 字段。
 * @param {DatabaseSync} db 只读 Radio Browser 连接。
 * @param {string} timestamp 本次合并时间。
 * @returns {{stations: Map<number, object>, catalogs: object}} 可继续融合的数据。
 */
function readBrowser(db, timestamp) {
  const stations = new Map();
  for (const row of db.prepare(`SELECT ${stationFields.join(', ')} FROM station ORDER BY id`).iterate()) {
    const geo = coordinates(row.geo_lat, row.geo_long);
    stations.set(row.id, {
      ...row,
      geo_lat: geo?.lat ?? null,
      geo_long: geo?.long ?? null,
      source_type: 'radio_browser',
      name_source: cleanText(row.name) ? 'radio_browser' : null,
      url_source: cleanText(row.url) ? 'radio_browser' : null,
      country_source: cleanText(row.country) || cleanText(row.countrycode) ? 'radio_browser' : null,
      geo_source: geo ? 'radio_browser' : null,
      catalog_status: cleanText(row.url) || cleanText(row.url_resolved) ? 'active' : 'unavailable',
      url_resolved_at: null,
      merged_at: timestamp,
      updated_at: timestamp,
    });
  }
  const catalogs = {};
  for (const table of ['countries', 'languages', 'tags']) {
    // 字典表名只取自代码中的固定列表，不接受外部输入。
    catalogs[table] = db.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
  }
  return { stations, catalogs };
}

/**
 * 汇集 Radio Garden 的频道关系、详情、重定向和地点资料；缺失详情的频道也保留。
 * @param {DatabaseSync} db 只读 Radio Garden 连接。
 * @returns {{channels: Map<string, object>, places: Map<string, object>, countryCodes: Map<string, string>}} 源数据快照。
 */
function readGarden(db) {
  const channels = new Map();
  const places = new Map();
  const countryCodes = new Map();
  for (const row of db.prepare('SELECT * FROM radio_garden_places').iterate()) places.set(row.id, row);
  for (const row of db.prepare('SELECT name_en, region_code FROM radio_garden_country_names').iterate()) {
    if (cleanText(row.region_code)) countryCodes.set(row.name_en.toLocaleLowerCase('en'), row.region_code.toUpperCase());
  }
  for (const row of db.prepare('SELECT place_id, channel_id, channel_title FROM place_channels ORDER BY place_id, channel_id').iterate()) {
    const channel = getChannel(channels, row.channel_id);
    channel.placeIds.add(row.place_id);
    channel.relationTitle ??= cleanText(row.channel_title);
  }
  for (const row of db.prepare("SELECT entity_id, response_json FROM api_responses WHERE endpoint = 'channel_details' AND status = 'success'").iterate()) {
    if (!row.response_json) continue;
    let parsed;
    try {
      parsed = JSON.parse(row.response_json);
    } catch {
      throw new Error(`Radio Garden 频道详情 JSON 无法解析：${row.entity_id}`);
    }
    const channel = getChannel(channels, row.entity_id);
    channel.details = parsed?.data ?? null;
  }
  for (const row of db.prepare("SELECT entity_id, redirect_url, fetched_at FROM api_responses WHERE endpoint = 'stream_redirect' AND status = 'success'").iterate()) {
    const channel = getChannel(channels, row.entity_id);
    channel.redirectUrl = cleanText(row.redirect_url);
    channel.redirectAt = row.fetched_at;
  }
  return { channels, places, countryCodes };
}

/**
 * 获取或初始化单个 Radio Garden 频道聚合对象。
 * @param {Map<string, object>} channels 聚合映射。
 * @param {string} id 来源频道 ID。
 * @returns {object} 可填充的频道对象。
 */
function getChannel(channels, id) {
  let channel = channels.get(id);
  if (!channel) {
    channel = { id, placeIds: new Set(), details: null, relationTitle: null, redirectUrl: null, redirectAt: null };
    channels.set(id, channel);
  }
  return channel;
}

/**
 * 为每个可比较的 URL、名称和国家组合建立候选索引。
 * @param {Map<number, object>} stations 原始 Radio Browser 电台。
 * @returns {{streams: Map<string, Set<number>>, homepages: Map<string, Set<number>>}} 匹配索引。
 */
function indexBrowser(stations) {
  const streams = new Map();
  const homepages = new Map();
  for (const station of stations.values()) {
    const name = normalizeName(station.name);
    const country = cleanText(station.countrycode)?.toUpperCase();
    if (!name || !country) continue;
    for (const value of [station.url_resolved, station.url]) {
      const url = normalizeUrl(value);
      if (url) addCandidate(streams, `${url}\0${name}\0${country}`, station.id);
    }
    const homepage = normalizeUrl(station.homepage);
    if (homepage) addCandidate(homepages, `${homepage}\0${name}\0${country}`, station.id);
  }
  return { streams, homepages };
}

/**
 * 把固定键下的候选电台 ID 收集为集合，供唯一匹配判断使用。
 * @param {Map<string, Set<number>>} index 候选索引。
 * @param {string} key URL、名称和国家的组合。
 * @param {number} id Radio Browser 电台 ID。
 */
function addCandidate(index, key, id) {
  if (!index.has(key)) index.set(key, new Set());
  index.get(key).add(id);
}

/**
 * 从候选索引中只取唯一结果，多候选时拒绝自动匹配。
 * @param {Map<string, Set<number>>} index 候选索引。
 * @param {string | null} url 规范化后的 URL。
 * @param {string | null} name 规范化后的名称。
 * @param {string | null} country 两字母国家代码。
 * @returns {number | null} 唯一候选的 ID。
 */
function uniqueCandidate(index, url, name, country) {
  if (!url || !name || !country) return null;
  const candidates = index.get(`${url}\0${name}\0${country}`);
  return candidates?.size === 1 ? candidates.values().next().value : null;
}

/**
 * 从频道详情和地点表确定国家、坐标及展示名称，不推断无法确认的国家代码。
 * @param {object} channel 汇集后的频道。
 * @param {Map<string, object>} places Radio Garden 地点。
 * @param {Map<string, string>} countryCodes 已知国家名称到代码的映射。
 * @returns {object} 供匹配和写入使用的基础字段。
 */
function gardenBasics(channel, places, countryCodes) {
  const details = channel.details;
  const detailPlace = cleanText(details?.place?.id);
  const relationPlace = channel.placeIds.size === 1 ? channel.placeIds.values().next().value : null;
  const placeId = detailPlace ?? relationPlace;
  const place = placeId ? places.get(placeId) : null;
  const detailCountry = cleanText(details?.country?.title);
  const placeCountry = cleanText(place?.country);
  const countryName = detailCountry ?? placeCountry;
  const sameCountry = !detailCountry || !placeCountry || detailCountry.toLocaleLowerCase('en') === placeCountry.toLocaleLowerCase('en');
  const countryCode = (countryName ? countryCodes.get(countryName.toLocaleLowerCase('en')) : null)
    ?? (sameCountry && placeCountry ? countryCodes.get(placeCountry.toLocaleLowerCase('en')) : null)
    ?? null;
  return {
    name: cleanText(details?.title) ?? channel.relationTitle,
    homepage: cleanText(details?.website),
    country: countryName,
    countrycode: countryCode,
    geo: coordinates(place?.latitude, place?.longitude),
    placeId,
  };
}

/**
 * 将 Garden 频道并入唯一 Browser 候选；其余频道分配稳定的新 ID。
 * @param {Map<number, object>} stations Browser 电台，函数会在内存中修改。
 * @param {object} garden Garden 快照。
 * @param {Map<string, number>} oldIds 上次 Garden 专属 ID。
 * @param {string} timestamp 本次构建时间。
 * @returns {{sources: object[], matched: number, gardenOnly: number, unnamed: number}} 来源关系和计数。
 */
function mergeGarden(stations, garden, oldIds, timestamp) {
  const index = indexBrowser(stations);
  const sources = [];
  let nextId = 1_000_000_001;
  const usedIds = new Set(stations.keys());
  const reservedIds = new Set(oldIds.values());
  let matched = 0;
  let gardenOnly = 0;
  let unnamed = 0;
  for (const channel of garden.channels.values()) {
    const basics = gardenBasics(channel, garden.places, garden.countryCodes);
    const name = normalizeName(basics.name);
    const streamId = uniqueCandidate(index.streams, normalizeUrl(channel.redirectUrl), name, basics.countrycode);
    const homepageId = uniqueCandidate(index.homepages, normalizeUrl(basics.homepage), name, basics.countrycode);
    const conflict = streamId && homepageId && streamId !== homepageId;
    const browserId = conflict ? null : streamId ?? homepageId;
    let stationId;
    let matchMethod;
    if (browserId) {
      stationId = browserId;
      matchMethod = streamId ? 'stream_name_country' : 'homepage_name_country';
      enrichBrowser(stations.get(browserId), basics, channel);
      matched++;
    } else {
      const oldId = oldIds.get(channel.id);
      if (oldId && oldId > 1_000_000_000 && !usedIds.has(oldId)) {
        stationId = oldId;
      } else {
        while (usedIds.has(nextId) || reservedIds.has(nextId)) nextId++;
        stationId = nextId++;
      }
      usedIds.add(stationId);
      matchMethod = oldId === stationId ? 'previous' : 'original';
      stations.set(stationId, makeGardenStation(stationId, channel, basics, timestamp));
      gardenOnly++;
      if (!basics.name) unnamed++;
    }
    sources.push({ source: 'radio_garden', external_id: channel.id, station_id: stationId, garden_place_id: basics.placeId, match_method: matchMethod, last_seen_at: timestamp });
  }
  return { sources, matched, gardenOnly, unnamed };
}

/**
 * 只用 Garden 的非空字段补足已匹配的 Browser 电台，并保留 Browser 原始值。
 * @param {object} station 待补足的 Browser 电台。
 * @param {object} basics Garden 基础字段。
 * @param {object} channel Garden 频道。
 */
function enrichBrowser(station, basics, channel) {
  station.source_type = 'both';
  if (!cleanText(station.name) && basics.name) {
    station.name = basics.name;
    station.name_source = 'radio_garden';
  }
  if (!cleanText(station.homepage) && basics.homepage) station.homepage = basics.homepage;
  if (!cleanText(station.url)) {
    station.url = `https://radio.garden/api/ara/content/listen/${encodeURIComponent(channel.id)}/channel.mp3`;
    station.url_source = 'radio_garden';
    if (channel.redirectUrl) station.catalog_status = 'active';
  }
  if (!cleanText(station.url_resolved) && channel.redirectUrl) {
    station.url_resolved = channel.redirectUrl;
    station.url_resolved_at = channel.redirectAt;
  }
  if (!cleanText(station.country) && basics.country) {
    station.country = basics.country;
    station.country_source = 'radio_garden';
  }
  if (!cleanText(station.countrycode) && basics.countrycode) {
    station.countrycode = basics.countrycode;
    station.country_source = 'radio_garden';
  }
  if (station.geo_lat == null && station.geo_long == null && basics.geo) {
    station.geo_lat = basics.geo.lat;
    station.geo_long = basics.geo.long;
    station.geo_source = 'radio_garden';
  }
}

/**
 * 构造 Garden 专属电台，未取得名称或重定向的记录标为待验证。
 * @param {number} id 新库内部 ID。
 * @param {object} channel Garden 频道。
 * @param {object} basics Garden 基础字段。
 * @param {string} timestamp 合并时间。
 * @returns {object} 兼容 v1 字段并带来源信息的电台。
 */
function makeGardenStation(id, channel, basics, timestamp) {
  const row = {};
  for (const field of stationFields) row[field] = null;
  row.id = id;
  row.name = basics.name ?? `Radio Garden ${channel.id}`;
  row.url = `https://radio.garden/api/ara/content/listen/${encodeURIComponent(channel.id)}/channel.mp3`;
  row.url_resolved = channel.redirectUrl;
  row.homepage = basics.homepage;
  row.country = basics.country;
  row.countrycode = basics.countrycode;
  row.geo_lat = basics.geo?.lat ?? null;
  row.geo_long = basics.geo?.long ?? null;
  return {
    ...row,
    source_type: 'radio_garden',
    name_source: basics.name ? 'radio_garden' : null,
    url_source: 'radio_garden',
    country_source: basics.country || basics.countrycode ? 'radio_garden' : null,
    geo_source: basics.geo ? 'radio_garden' : null,
    catalog_status: basics.name && channel.redirectUrl ? 'active' : 'unverified',
    url_resolved_at: channel.redirectUrl ? channel.redirectAt : null,
    merged_at: timestamp,
    updated_at: timestamp,
  };
}

/**
 * 保留 v1 字典行的 ID 和名称，重置派生计数；标签关联留给独立脚本处理。
 * @param {DatabaseSync} db 新库连接。
 * @param {object} catalogs Browser 的原始字典。
 * @returns {object} 可供关联表重建使用的字典索引。
 */
function copyCatalogs(db, catalogs) {
  const countryByName = new Map();
  const languageByName = new Map();
  const insertCountry = db.prepare('INSERT INTO countries (id, name, iso_3166_1, stationcount) VALUES (?, ?, ?, 0)');
  const insertLanguage = db.prepare('INSERT INTO languages (id, name, iso_639, stationcount, normalized_name) VALUES (?, ?, ?, 0, ?)');
  const insertTag = db.prepare('INSERT INTO tags (id, name, stationcount, normalized_name, canonical_tag_id, is_visible) VALUES (?, ?, 0, ?, ?, 0)');
  for (const row of catalogs.countries) {
    insertCountry.run(row.id, row.name, row.iso_3166_1);
    if (cleanText(row.name) && !countryByName.has(row.name)) countryByName.set(row.name, row.id);
  }
  for (const row of catalogs.languages) {
    const key = normalizeName(row.name);
    insertLanguage.run(row.id, row.name, row.iso_639, key);
    if (key && !languageByName.has(key)) languageByName.set(key, row.id);
  }
  for (const row of catalogs.tags) {
    const key = normalizeName(row.name);
    insertTag.run(row.id, row.name, key, null);
  }
  return { countryByName, languageByName };
}

/**
 * 将逗号分隔的原始语言拆成单台去重的成员集合，保留原始字段。
 * @param {unknown} value v1 文本字段。
 * @returns {Map<string, string>} 规范化值到首次出现的原始名称。
 */
function members(value) {
  const result = new Map();
  for (const part of (cleanText(value) ?? '').split(',')) {
    const name = cleanText(part);
    const key = normalizeName(name);
    if (key && !result.has(key)) result.set(key, name);
  }
  return result;
}

/**
 * 从最终电台重建国家计数和语言成员关系，保留标签给后续独立拆分。
 * @param {DatabaseSync} db 新库连接。
 * @param {Map<number, object>} stations 合并后的电台。
 * @param {object} indexes 已复制字典的索引。
 */
function rebuildCatalogs(db, stations, indexes) {
  const getCountry = db.prepare('INSERT INTO countries (name, iso_3166_1, stationcount) VALUES (?, ?, 0)');
  const getLanguage = db.prepare('INSERT INTO languages (name, stationcount, normalized_name) VALUES (?, 0, ?)');
  const countryCount = db.prepare('UPDATE countries SET stationcount = stationcount + 1 WHERE id = ?');
  const languageCount = db.prepare('UPDATE languages SET stationcount = stationcount + 1 WHERE id = ?');
  const linkLanguage = db.prepare('INSERT INTO station_language (station_id, language_id) VALUES (?, ?)');
  for (const station of stations.values()) {
    const countryName = cleanText(station.country);
    if (countryName) {
      let id = indexes.countryByName.get(countryName);
      if (!id) {
        id = Number(getCountry.run(countryName, cleanText(station.countrycode)).lastInsertRowid);
        indexes.countryByName.set(countryName, id);
      }
      countryCount.run(id);
    }
    for (const [key, name] of members(station.language)) {
      let id = indexes.languageByName.get(key);
      if (!id) {
        id = Number(getLanguage.run(name, key).lastInsertRowid);
        indexes.languageByName.set(key, id);
      }
      linkLanguage.run(station.id, id);
      languageCount.run(id);
    }
  }
}

/**
 * 在临时 SQLite 中写入合并结果，验证外键和文件完整性后提交事务。
 * @param {DatabaseSync} db 临时目标库连接。
 * @param {Map<number, object>} stations 所有电台。
 * @param {object[]} gardenSources Garden 来源关系。
 * @param {object} catalogs Browser 字典。
 * @param {object} counts 合并计数。
 * @param {string} timestamp 本次构建时间。
 */
function writeMerged(db, stations, gardenSources, catalogs, counts, timestamp) {
  db.exec('PRAGMA foreign_keys = ON; BEGIN IMMEDIATE');
  try {
    db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
    const indexes = copyCatalogs(db, catalogs);
    const fields = [...stationFields, ...metadataFields];
    const placeholders = Array(fields.length).fill('?').join(', ');
    const insertStation = db.prepare(`INSERT INTO station_unified (${fields.join(', ')}) VALUES (${placeholders})`);
    const insertSource = db.prepare('INSERT INTO station_source (source, external_id, station_id, garden_place_id, match_method, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const station of stations.values()) {
      // 字段名只取自上面的固定白名单，实际电台值全部通过占位符绑定。
      const values = [];
      for (const field of fields) values.push(station[field]);
      insertStation.run(...values);
      if (station.stationuuid) insertSource.run('radio_browser', station.stationuuid, station.id, null, 'original', timestamp);
    }
    for (const source of gardenSources) {
      insertSource.run(source.source, source.external_id, source.station_id, source.garden_place_id, source.match_method, source.last_seen_at);
    }
    rebuildCatalogs(db, stations, indexes);
    db.prepare('INSERT INTO merge_run (id, generated_at, browser_count, garden_count, matched_count, garden_only_count, unmatched_without_name) VALUES (1, ?, ?, ?, ?, ?, ?)').run(timestamp, counts.browser, counts.garden, counts.matched, counts.gardenOnly, counts.unnamed);
    const foreignKeys = db.prepare('PRAGMA foreign_key_check').all();
    if (foreignKeys.length) throw new Error(`外键检查失败：${foreignKeys.length} 条`);
    const integrity = db.prepare('PRAGMA integrity_check').get();
    if (integrity.integrity_check !== 'ok') throw new Error(`SQLite 完整性检查失败：${integrity.integrity_check}`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * 构建新数据库：源库只读，目标先写临时文件，验证成功后才替换正式文件。
 * @param {string[]} args 命令行参数；仅支持显式的 --replace。
 */
function main(args) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--replace')) {
    throw new Error('用法：node merged/src/build.mjs [--replace]');
  }
  if (existsSync(outputPath) && !args.includes('--replace')) {
    throw new Error(`目标数据库已存在；如需重建请传 --replace：${outputPath}`);
  }
  const oldIds = args.includes('--replace') ? previousGardenIds() : new Map();
  const timestamp = new Date().toISOString();
  const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
  let browser;
  let garden;
  let output;
  try {
    browser = openSource(browserPath);
    garden = openSource(gardenPath);
    const { stations, catalogs } = readBrowser(browser, timestamp);
    const browserCount = stations.size;
    const gardenData = readGarden(garden);
    const result = mergeGarden(stations, gardenData, oldIds, timestamp);
    mkdirSync(dirname(outputPath), { recursive: true });
    output = new DatabaseSync(temporaryPath);
    writeMerged(output, stations, result.sources, catalogs, {
      browser: browserCount,
      garden: gardenData.channels.size,
      ...result,
    }, timestamp);
    output.close();
    output = null;
    browser.close();
    browser = null;
    garden.close();
    garden = null;
    renameSync(temporaryPath, outputPath);
    console.log(JSON.stringify({ output: outputPath, browser: browserCount, garden: gardenData.channels.size, matched: result.matched, gardenOnly: result.gardenOnly, unnamed: result.unnamed }, null, 2));
  } finally {
    output?.close();
    browser?.close();
    garden?.close();
    rmSync(temporaryPath, { force: true });
    rmSync(`${temporaryPath}-journal`, { force: true });
    rmSync(`${temporaryPath}-wal`, { force: true });
    rmSync(`${temporaryPath}-shm`, { force: true });
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
