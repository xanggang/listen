import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const databasePath = fileURLToPath(new URL('../data/worldtuner-merged.sqlite', import.meta.url));
const urlProtocols = new Set(['http:', 'https:', 'mms:', 'rtsp:', 'rtmp:', 'icy:']);
const cleanFields = ['name', 'country', 'countrycode', 'homepage', 'url', 'url_resolved'];

/**
 * 只归一展示文本的 Unicode 与空白，不推测名称的语义。
 * @param {unknown} value 数据库字段。
 * @returns {string | null} 规范化文本。
 */
function displayText(value) {
  return typeof value === 'string' ? value.normalize('NFKC').replace(/\s+/g, ' ').trim() || null : null;
}

/**
 * URL 只修剪首尾空白，保留流媒体路径与查询参数。
 * @param {unknown} value 原 URL。
 * @returns {string | null} 修剪后的 URL。
 */
function urlText(value) {
  return typeof value === 'string' ? value.trim() || null : null;
}

/**
 * 报告明显无法识别的 URL，但不自动删除来源地址。
 * @param {string | null} value URL 文本。
 * @returns {boolean} 是否属于可识别的电台协议。
 */
function recognizedUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return urlProtocols.has(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/**
 * 只选择国家字典中名称与二字母代码唯一对应的记录，供缺失代码时补全。
 * @param {DatabaseSync} db 合并库连接。
 * @returns {Map<string, string>} 规范化国家名称到代码的映射。
 */
function countryCodes(db) {
  const candidates = new Map();
  for (const row of db.prepare('SELECT name, iso_3166_1 FROM countries').iterate()) {
    const name = displayText(row.name)?.toLocaleLowerCase('en');
    const code = displayText(row.iso_3166_1)?.toUpperCase();
    if (!name || !code || !/^[A-Z]{2}$/.test(code)) continue;
    if (!candidates.has(name)) candidates.set(name, new Set());
    candidates.get(name).add(code);
  }
  const result = new Map();
  for (const [name, codes] of candidates) {
    if (codes.size === 1) result.set(name, codes.values().next().value);
  }
  return result;
}

/**
 * 对单台电台产生可审计的安全修改和无法自动修复的问题。
 * @param {object} row 待检查的电台字段。
 * @param {Map<string, string>} codes 唯一国家名称映射。
 * @returns {{values: object, changes: object[], issues: object[]}} 清洗计划。
 */
function planStation(row, codes) {
  const values = {
    name: displayText(row.name),
    country: displayText(row.country),
    countrycode: displayText(row.countrycode)?.toUpperCase() ?? null,
    homepage: urlText(row.homepage),
    url: urlText(row.url),
    url_resolved: urlText(row.url_resolved),
  };
  const issues = [];
  if (values.countrycode && !/^[A-Z]{2}$/.test(values.countrycode)) {
    issues.push(['countrycode', 'invalid_country_code', row.countrycode]);
    values.countrycode = row.countrycode;
  }
  if (!values.countrycode && values.country) {
    values.countrycode = codes.get(values.country.toLocaleLowerCase('en')) ?? null;
  }
  if (!values.name) issues.push(['name', 'missing_name', row.name]);
  if (!values.url && !values.url_resolved) issues.push(['url', 'missing_stream_url', null]);
  for (const field of ['homepage', 'url', 'url_resolved']) {
    if (values[field] && !recognizedUrl(values[field])) {
      issues.push([field, 'unrecognized_url', values[field]]);
    }
  }
  const changes = [];
  for (const field of cleanFields) {
    if (values[field] !== row[field]) {
      const reason = field === 'countrycode' && !row.countrycode ? 'country_dictionary' : 'safe_normalization';
      changes.push([field, row[field], values[field], reason]);
    }
  }
  return { values, changes, issues };
}

/**
 * 按清洗后的国家名称重算目录计数，同时保留原字典 ID 与未命中词条。
 * @param {DatabaseSync} db 已开启写事务的合并库。
 */
function rebuildCountries(db) {
  const ids = new Map();
  for (const row of db.prepare('SELECT id, name FROM countries ORDER BY id').iterate()) {
    if (row.name && !ids.has(row.name)) ids.set(row.name, row.id);
  }
  db.exec('UPDATE countries SET stationcount = 0');
  const insert = db.prepare('INSERT INTO countries (name, iso_3166_1, stationcount) VALUES (?, ?, 0)');
  const update = db.prepare('UPDATE countries SET stationcount = ? WHERE id = ?');
  const grouped = db.prepare("SELECT country, MIN(countrycode) AS min_code, MAX(countrycode) AS max_code, COUNT(*) AS total FROM station_unified WHERE country IS NOT NULL AND country <> '' GROUP BY country");
  for (const row of grouped.iterate()) {
    let id = ids.get(row.country);
    if (!id) {
      const code = row.min_code === row.max_code && /^[A-Z]{2}$/.test(row.min_code ?? '') ? row.min_code : null;
      id = Number(insert.run(row.country, code).lastInsertRowid);
      ids.set(row.country, id);
    }
    update.run(row.total, id);
  }
}

/**
 * 默认只预览；--apply 在合并库的单个事务中应用清洗并记录审计。
 * @param {string[]} args 仅允许可选参数 --apply。
 */
function main(args) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--apply')) {
    throw new Error('用法：node worldTuner-data/merged/src/clean.mjs [--apply]');
  }
  if (!existsSync(databasePath)) throw new Error(`合并数据库不存在：${databasePath}`);
  const apply = args.includes('--apply');
  const db = new DatabaseSync(databasePath, { readOnly: !apply });
  let transaction = false;
  try {
    db.exec(apply ? 'PRAGMA foreign_keys = ON; BEGIN IMMEDIATE' : 'PRAGMA query_only = ON; BEGIN');
    transaction = true;
    const codes = countryCodes(db);
    const timestamp = new Date().toISOString();
    const update = apply ? db.prepare('UPDATE station_unified SET name = ?, country = ?, countrycode = ?, homepage = ?, url = ?, url_resolved = ?, updated_at = ? WHERE id = ?') : null;
    const audit = apply ? db.prepare('INSERT INTO data_cleaning_change (station_id, field_name, old_value, new_value, reason, changed_at) VALUES (?, ?, ?, ?, ?, ?)') : null;
    const issueInsert = apply ? db.prepare('INSERT INTO data_quality_issue (station_id, field_name, issue_code, raw_value, detected_at) VALUES (?, ?, ?, ?, ?)') : null;
    if (apply) db.exec('DELETE FROM data_quality_issue');
    let scanned = 0;
    let changedStations = 0;
    let changedFields = 0;
    let issueCount = 0;
    const rows = db.prepare('SELECT id, name, country, countrycode, homepage, url, url_resolved FROM station_unified ORDER BY id').all();
    for (const row of rows) {
      scanned++;
      const plan = planStation(row, codes);
      if (plan.changes.length) {
        changedStations++;
        changedFields += plan.changes.length;
        if (apply) {
          update.run(plan.values.name, plan.values.country, plan.values.countrycode, plan.values.homepage, plan.values.url, plan.values.url_resolved, timestamp, row.id);
          for (const change of plan.changes) audit.run(row.id, ...change, timestamp);
        }
      }
      issueCount += plan.issues.length;
      if (apply) {
        for (const issue of plan.issues) issueInsert.run(row.id, ...issue, timestamp);
      }
    }
    if (apply) {
      rebuildCountries(db);
      db.prepare('INSERT INTO data_cleaning_run (id, completed_at, changed_stations, changed_fields, issue_count) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET completed_at = excluded.completed_at, changed_stations = excluded.changed_stations, changed_fields = excluded.changed_fields, issue_count = excluded.issue_count').run(timestamp, changedStations, changedFields, issueCount);
      if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('外键检查失败，清洗已回滚');
      db.exec('COMMIT');
    } else {
      db.exec('ROLLBACK');
    }
    transaction = false;
    console.log(JSON.stringify({ mode: apply ? 'applied' : 'preview', scanned, changedStations, changedFields, issueCount }, null, 2));
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
