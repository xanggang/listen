import { readFileSync } from 'node:fs';

const textFields =
  `changeuuid stationuuid name url url_resolved homepage favicon tags country countrycode iso_3166_2 state language languagecodes lastchangetime lastchangetime_iso8601 codec lastchecktime lastchecktime_iso8601 lastcheckoktime lastcheckoktime_iso8601 lastlocalchecktime lastlocalchecktime_iso8601 clicktimestamp clicktimestamp_iso8601`.split(
    ' ',
  );
const integerFields =
  `votes bitrate hls lastcheckok clickcount clicktrend ssl_error has_extended_info`.split(' ');
const realFields = ['geo_lat', 'geo_long', 'geo_distance'];
const fields = [...textFields, ...integerFields, ...realFields];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 校验外部电台字段，忽略未知字段，把缺失值规范为 null；非法输入中止整个同步。
 * @param {unknown} input API 返回的单条记录。
 * @returns {Record<string, string | number | null>} 与本地 station 表对应的值。
 */
export function normalizeStation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('电台必须是对象。');
  if (typeof input.stationuuid !== 'string' || !uuidPattern.test(input.stationuuid)) {
    throw new Error('stationuuid 缺失或格式错误。');
  }
  const result = {};
  for (const field of textFields) {
    const value = input[field] ?? null;
    if (value !== null && typeof value !== 'string') throw new Error(`${field} 必须是字符串。`);
    result[field] = value;
  }
  result.stationuuid = input.stationuuid.toLowerCase();
  for (const field of [...integerFields, ...realFields]) {
    let value = input[field] ?? null;
    if (field === 'has_extended_info' && typeof value === 'boolean') value = Number(value);
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new Error(`${field} 必须是有限数值。`);
    }
    if (value !== null && integerFields.includes(field) && !Number.isSafeInteger(value)) {
      throw new Error(`${field} 必须是安全整数。`);
    }
    result[field] = value;
  }
  return result;
}

/**
 * 在单一事务内合并电台并从本地全量电台重建分类计数；保留所有已有行的 id。
 * 不删除上游已消失的电台；重复 UUID 的旧库或任何错误都会回滚本次修改。
 * @param {import('node:sqlite').DatabaseSync} db 独立本地 SQLite 连接。
 * @param {unknown[]} inputs 非空 API 电台数组。
 * @param {string} server 本次来源地址，仅记录审计信息，不参与 SQL 标识符。
 * @returns {{received: number, inserted: number, updated: number}} 同步数量。
 */
export function importStations(db, inputs, server) {
  if (!Array.isArray(inputs) || !inputs.length) throw new Error('拒绝导入空数据。');
  const stations = [];
  const seen = new Set();
  for (const input of inputs) {
    const station = normalizeStation(input);
    if (seen.has(station.stationuuid)) throw new Error(`重复 UUID：${station.stationuuid}`);
    seen.add(station.stationuuid);
    stations.push(station);
  }
  db.exec('PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE');
  try {
    db.exec(
      readFileSync(
        new URL('../../../worldTuner-api/migrations/0001_existing_schema.sql', import.meta.url),
        'utf8',
      ),
    );
    db.exec(
      readFileSync(
        new URL('../../../worldTuner-api/migrations/0002_query_indexes.sql', import.meta.url),
        'utf8',
      ),
    );
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS sync_station_uuid ON station(stationuuid)');
    const lookup = db.prepare('SELECT id FROM station WHERE stationuuid = ?');
    // 字段全部来自上面的固定白名单；外部值始终通过占位符绑定。
    const placeholders = fields.map(() => '?').join(', ');
    // 把固定字段列表转换为 UPDATE 的赋值表达式。
    const assignments = fields.map((field) => `${field} = ?`).join(', ');
    const insert = db.prepare(
      `INSERT INTO station (${fields.join(', ')}) VALUES (${placeholders})`,
    );
    const update = db.prepare(`UPDATE station SET ${assignments} WHERE id = ?`);
    let inserted = 0;
    let updated = 0;
    for (const station of stations) {
      const existing = lookup.get(station.stationuuid);
      // 绑定值顺序与固定字段顺序保持一致。
      const values = fields.map((field) => station[field]);
      if (existing) {
        update.run(...values, existing.id);
        updated++;
      } else {
        insert.run(...values);
        inserted++;
      }
    }
    rebuildCatalogs(db);
    db.exec(`CREATE TABLE IF NOT EXISTS radio_browser_sync_runs (
      id INTEGER PRIMARY KEY, completed_at TEXT NOT NULL, server TEXT NOT NULL,
      received INTEGER NOT NULL, inserted INTEGER NOT NULL, updated INTEGER NOT NULL
    )`);
    db.prepare(
      'INSERT INTO radio_browser_sync_runs (completed_at, server, received, inserted, updated) VALUES (?, ?, ?, ?, ?)',
    ).run(new Date().toISOString(), server, stations.length, inserted, updated);
    db.exec('COMMIT');
    return { received: stations.length, inserted, updated };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * 按本地电台的分类成员关系计数，每台在每个分类中最多计一次；已有分类 id 保持稳定。
 * 语言代码无法可靠地与多语言名称一一对应，保持已有 iso_639，新分类留空。
 * @param {import('node:sqlite').DatabaseSync} db 必须处于调用者的事务中。
 */
function rebuildCatalogs(db) {
  for (const [table, field] of [
    ['tags', 'tags'],
    ['languages', 'language'],
    ['countries', 'country'],
  ]) {
    const counts = new Map();
    for (const station of db
      .prepare(`SELECT ${field} AS value, countrycode FROM station`)
      .iterate()) {
      const names =
        table === 'countries' ? [station.value ?? ''] : (station.value ?? '').split(',');
      const unique = new Set();
      for (const name of names) if (name.trim()) unique.add(name.trim());
      for (const name of unique) {
        const item = counts.get(name) ?? { count: 0, code: null };
        item.count++;
        if (station.countrycode) item.code = station.countrycode;
        counts.set(name, item);
      }
    }
    db.exec(`UPDATE ${table} SET stationcount = 0`);
    const lookup = db.prepare(`SELECT id FROM ${table} WHERE name = ?`);
    const insert = db.prepare(`INSERT INTO ${table} (name, stationcount) VALUES (?, ?)`);
    const update = db.prepare(`UPDATE ${table} SET stationcount = ? WHERE name = ?`);
    for (const [name, item] of counts) {
      if (lookup.get(name)) update.run(item.count, name);
      else insert.run(name, item.count);
      if (table === 'countries') {
        db.prepare('UPDATE countries SET iso_3166_1 = ? WHERE name = ?').run(item.code, name);
      }
    }
  }
}
