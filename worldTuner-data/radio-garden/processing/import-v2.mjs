import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { createSnowflakeIdGenerator } from '../../v2/src/snowflake-id.mjs';

const defaultSource = fileURLToPath(new URL('../data/radio-garden.sqlite', import.meta.url));
const defaultTarget = fileURLToPath(new URL('../../v2/data/worldtuner-v2.sqlite', import.meta.url));
const streamBase = 'https://radio.garden/api/ara/content/listen/';

/**
 * 验证频道详情并提取 V2 所需字段；地点坐标由调用方按 place.id 关联。
 * @param {string} entityId 采集台账中的频道 ID。
 * @param {string} responseJson 原始频道详情 JSON。
 * @returns {object | null} 有效频道数据；意外返回的 page 数据返回 null。
 */
export function parseChannel(entityId, responseJson) {
  let response;
  try {
    response = JSON.parse(responseJson);
  } catch {
    throw new Error(`频道 ${entityId} 的详情不是有效 JSON。`);
  }
  const data = response?.data;
  if (data?.type === 'page') return null;
  if (
    data?.type !== 'channel' ||
    data.id !== entityId ||
    typeof data.title !== 'string' ||
    !data.title.trim() ||
    typeof data.place?.id !== 'string' ||
    !data.place.id.trim() ||
    typeof data.place.title !== 'string' ||
    !data.place.title.trim() ||
    typeof data.country?.title !== 'string' ||
    !data.country.title.trim() ||
    (data.website !== undefined && data.website !== null && typeof data.website !== 'string') ||
    (data.social !== undefined && data.social !== null && !Array.isArray(data.social))
  ) {
    throw new Error(`频道 ${entityId} 的详情缺少必要字段或字段类型无效。`);
  }
  const social = data.social ?? [];
  for (const link of social) {
    if (
      !link ||
      typeof link.platform !== 'string' ||
      !link.platform.trim() ||
      typeof link.url !== 'string' ||
      !link.url.trim()
    ) {
      throw new Error(`频道 ${entityId} 存在无效的 social 链接。`);
    }
  }
  return {
    id: entityId,
    name: data.title.trim(),
    website: data.website ?? null,
    placeId: data.place.id,
    place: data.place.title.trim(),
    country: data.country.title.trim(),
    social,
  };
}

/**
 * 在 V2 库中导入 Radio Garden 频道；整批写入使用事务，已有同源记录时拒绝重复导入。
 * 原始库只读，缺失地点或无效详情会中止并回滚目标库。
 * @param {string} sourcePath Radio Garden 采集库路径。
 * @param {string} targetPath 已建表的 V2 库路径。
 * @param {{workerId?: number}} [options] 同一数据库并发写入时唯一的生成节点编号。
 * @returns {object} 导入数量、跳过的 page ID 和无国家代码的来源名称。
 */
export function importRadioGarden(
  sourcePath = defaultSource,
  targetPath = defaultTarget,
  options = {},
) {
  const sourceFile = resolve(sourcePath);
  const targetFile = resolve(targetPath);
  if (sourceFile === targetFile) throw new Error('源数据库和目标数据库不能是同一文件。');
  if (!existsSync(sourceFile)) throw new Error(`找不到 Radio Garden 采集库：${sourceFile}`);
  if (!existsSync(targetFile))
    throw new Error(`找不到 V2 数据库，请先运行 npm run init:v2：${targetFile}`);
  const nextId = createSnowflakeIdGenerator({ workerId: options.workerId });

  const source = new DatabaseSync(sourceFile, { readOnly: true });
  const target = new DatabaseSync(targetFile);
  let sourceTransaction = false;
  let targetTransaction = false;
  try {
    source.exec('BEGIN');
    sourceTransaction = true;
    target.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    if (
      target.prepare('SELECT 1 FROM station_source WHERE source = ? LIMIT 1').get('radio_garden')
    ) {
      throw new Error('V2 数据库已有 Radio Garden 来源记录，拒绝重复导入。');
    }
    target.exec('BEGIN IMMEDIATE');
    targetTransaction = true;

    const countryCodes = new Map(
      source
        .prepare(
          'SELECT name_en, region_code FROM radio_garden_country_names WHERE region_code IS NOT NULL',
        )
        .all()
        .filter((row) => /^[A-Z]{2}$/.test(row.region_code))
        .map((row) => [row.name_en, row.region_code]),
    );
    const findCountry = target.prepare('SELECT id FROM country WHERE code = ?');
    const addCountry = target.prepare('INSERT INTO country (id, name, code) VALUES (?, ?, ?)');
    const addStation = target.prepare(`
      INSERT INTO station
        (id, name, website, place, country_id, latitude, longitude, source_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'radio_garden', ?, ?)
    `);
    const addSource = target.prepare(`
      INSERT INTO station_source (source, external_id, station_id, last_seen_at)
      VALUES ('radio_garden', ?, ?, ?)
    `);
    const addStream = target.prepare(`
      INSERT INTO station_stream
        (id, station_id, url, resolved_url, is_primary, resolved_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `);
    const addLink = target.prepare(`
      INSERT INTO station_link (id, station_id, platform, url) VALUES (?, ?, ?, ?)
      ON CONFLICT(station_id, platform, url) DO NOTHING
    `);
    const rows = source.prepare(`
      SELECT a.entity_id, a.response_json, a.fetched_at AS detail_fetched_at,
        p.id AS place_id, p.latitude, p.longitude,
        s.redirect_url, s.fetched_at AS stream_fetched_at
      FROM api_responses a
      LEFT JOIN radio_garden_places p
        ON p.id = json_extract(a.response_json, '$.data.place.id')
      LEFT JOIN api_responses s
        ON s.endpoint = 'stream_redirect' AND s.entity_id = a.entity_id AND s.status = 'success'
      WHERE a.endpoint = 'channel_details' AND a.status = 'success'
      ORDER BY a.entity_id
    `);
    const missingDetails = source
      .prepare(
        `
      SELECT COUNT(DISTINCT p.channel_id) AS count
      FROM place_channels p
      LEFT JOIN api_responses a
        ON a.endpoint = 'channel_details' AND a.entity_id = p.channel_id AND a.status = 'success'
      WHERE a.entity_id IS NULL
    `,
      )
      .get().count;
    const importedAt = new Date().toISOString();
    const skippedPages = [];
    const unknownCountries = new Map();
    let stations = 0;
    let streams = 0;
    let links = 0;
    let unresolvedStreams = 0;

    for (const row of rows.iterate()) {
      const channel = parseChannel(row.entity_id, row.response_json);
      if (!channel) {
        skippedPages.push(row.entity_id);
        continue;
      }
      if (
        row.place_id !== channel.placeId ||
        !Number.isFinite(row.latitude) ||
        !Number.isFinite(row.longitude)
      ) {
        throw new Error(
          `频道 ${channel.id} 引用的地点 ${channel.placeId} 在地点表中不存在或坐标无效。`,
        );
      }
      const countryCode = countryCodes.get(channel.country);
      let countryId = null;
      if (countryCode) {
        countryId = findCountry.get(countryCode)?.id;
        if (countryId === undefined) {
          countryId = nextId();
          addCountry.run(countryId, channel.country, countryCode);
        }
      } else {
        unknownCountries.set(channel.country, (unknownCountries.get(channel.country) ?? 0) + 1);
      }
      const stationId = nextId();
      addStation.run(
        stationId,
        channel.name,
        channel.website,
        channel.place,
        countryId,
        row.latitude,
        row.longitude,
        importedAt,
        importedAt,
      );
      addSource.run(channel.id, stationId, row.detail_fetched_at);
      const streamUrl = `${streamBase}${encodeURIComponent(channel.id)}/channel.mp3?s=1&hl=zh-Hans`;
      addStream.run(
        nextId(),
        stationId,
        streamUrl,
        row.redirect_url ?? null,
        row.stream_fetched_at ?? null,
      );
      for (const link of channel.social) {
        links += addLink.run(nextId(), stationId, link.platform.trim(), link.url.trim()).changes;
      }
      stations++;
      streams++;
      if (!row.redirect_url) unresolvedStreams++;
    }
    if (!stations) throw new Error('没有可导入的 Radio Garden 频道详情。');
    const integrity = target.prepare('PRAGMA integrity_check').get();
    const foreignKeys = target.prepare('PRAGMA foreign_key_check').all();
    if (integrity?.integrity_check !== 'ok' || foreignKeys.length) {
      throw new Error('导入后的 V2 数据库完整性或外键检查失败。');
    }
    target.exec('COMMIT');
    targetTransaction = false;
    source.exec('COMMIT');
    sourceTransaction = false;
    return {
      stations,
      streams,
      links,
      unresolvedStreams,
      missingDetails,
      skippedPages,
      unknownCountries: Object.fromEntries([...unknownCountries].sort()),
    };
  } catch (error) {
    if (targetTransaction) target.exec('ROLLBACK');
    if (sourceTransaction) source.exec('ROLLBACK');
    throw error;
  } finally {
    target.close();
    source.close();
  }
}

/** 解析本地数据库路径并执行一次 Radio Garden 导入，不访问网络。 */
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
      '用法：npm run process:radio-garden:v2 -- [--source 采集库] [--target V2库] [--worker-id 0-1023]',
    );
    return;
  }
  const workerId = values['worker-id'] === undefined ? 0 : Number(values['worker-id']);
  console.log(
    JSON.stringify(importRadioGarden(values.source, values.target, { workerId }), null, 2),
  );
}

// 测试导入模块时不执行命令行入口。
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(`Radio Garden V2 导入失败：${error.message}`);
    process.exitCode = 1;
  }
}
