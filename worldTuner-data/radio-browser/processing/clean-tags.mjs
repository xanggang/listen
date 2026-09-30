import { existsSync, openSync, closeSync, readFileSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { normalizeTag, proposeTag } from './report-tags.mjs';

const defaultDb = fileURLToPath(new URL('../../v2/data/worldtuner-v2.sqlite', import.meta.url));
const rulesPath = new URL('./tag-cleaning-rules.json', import.meta.url);
const translationsPath = new URL('./tag-names.zh-CN.json', import.meta.url);
const chineseColumnSql =
  'ALTER TABLE tag ADD COLUMN name_zh TEXT CHECK (name_zh IS NULL OR length(trim(name_zh)) > 0)';

/** 为备份生成同目录的独立文件名，绝不覆盖之前的快照。 */
function defaultBackupPath(dbPath) {
  const stamp = new Date().toISOString().replaceAll(':', '-');
  return join(dirname(dbPath), `${basename(dbPath, '.sqlite')}-tags-${stamp}.sqlite`);
}

/** 统计标签及关联行数，供清洗前后和备份完整性核对。 */
function counts(db) {
  return {
    tags: db.prepare('SELECT count(*) AS n FROM tag').get().n,
    stationTags: db.prepare('SELECT count(*) AS n FROM station_tag').get().n,
  };
}

/** 检查支持的旧/新标签结构，返回是否已有中文列；其他新增字段拒绝处理以免丢失。 */
function verifySchema(db) {
  const tags = db.prepare('PRAGMA table_info(tag)').all();
  const links = db.prepare('PRAGMA table_info(station_tag)').all();
  // 按字段名核对固定导出结构，防止把不同版本的表当成当前结构。
  const tagFields = tags.map((row) => row.name).join(',');
  if (
    !['id,name,normalized_name', 'id,name,normalized_name,name_zh'].includes(tagFields) ||
    links.map((row) => row.name).join(',') !== 'station_id,tag_id'
  ) {
    throw new Error('标签表字段与清洗脚本不匹配，请先适配备份和恢复字段。');
  }
  return tagFields.endsWith(',name_zh');
}

/**
 * 在目标库保持事务锁时备份 tag 和 station_tag；备份不需要复制全部电台。
 * 备份中同时保存规则和逐项映射，原始标签 ID 与电台 ID 按字符串原样保存。
 * @param {DatabaseSync} db 保持稳定事务快照的 V2 连接。
 * @param {string} path 不存在的备份文件路径。
 * @param {object} metadata 此次操作的来源、规则与计划。
 * @returns {string} 已写入且通过数量及完整性验证的备份绝对路径。
 */
function backupTags(db, path, metadata) {
  const file = resolve(path);
  // 先独占创建文件，避免 SQLite 打开时复用已有备份。
  closeSync(openSync(file, 'wx'));
  const backup = new DatabaseSync(file);
  try {
    backup.exec(`PRAGMA foreign_keys = ON;
      CREATE TABLE tag (id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL, name_zh TEXT);
      CREATE TABLE station_tag (station_id TEXT NOT NULL, tag_id TEXT NOT NULL REFERENCES tag(id),
        PRIMARY KEY (station_id, tag_id));
      CREATE TABLE backup_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      BEGIN IMMEDIATE;`);
    const addTag = backup.prepare('INSERT INTO tag VALUES (?, ?, ?, ?)');
    for (const row of db.prepare('SELECT * FROM tag').iterate()) {
      addTag.run(row.id, row.name, row.normalized_name, row.name_zh ?? null);
    }
    const addLink = backup.prepare('INSERT INTO station_tag VALUES (?, ?)');
    for (const row of db.prepare('SELECT station_id, tag_id FROM station_tag').iterate()) {
      addLink.run(row.station_id, row.tag_id);
    }
    backup
      .prepare('INSERT INTO backup_metadata VALUES (?, ?)')
      .run('operation', JSON.stringify(metadata));
    const original = counts(db);
    const copied = counts(backup);
    if (
      original.tags !== copied.tags ||
      original.stationTags !== copied.stationTags ||
      backup.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' ||
      backup.prepare('PRAGMA foreign_key_check').all().length
    ) {
      throw new Error('标签备份校验失败，目标数据库未清洗。');
    }
    backup.exec('COMMIT');
    return file;
  } finally {
    backup.close();
  }
}

/**
 * 对所有标签制定映射：忽略项无目标，同义词指向标准名，未知项归一化后保留。
 * 每组优先保留已经采用标准名称的 ID，否则保留该组最小字符串 ID；不重建全部主键。
 * @param {object[]} tags 当前标签快照，按 id 升序。
 * @param {object} rules 规则草案，含明确别名与忽略项。
 * @param {Record<string, string>} translations 标准标签的中文展示名称，未知项保留已有译名。
 * @returns {{tags: object[], mapping: object[]}} 整理后的标签与每个原标签的去向。
 */
function createPlan(tags, rules, translations) {
  const aliases = new Map();
  for (const [target, names] of Object.entries(rules.aliases)) {
    for (const name of names) aliases.set(normalizeTag(name), normalizeTag(target));
  }
  const groups = new Map();
  const mapping = [];
  for (const tag of tags) {
    const proposal = proposeTag(tag.name, rules, aliases);
    const key = proposal.action === 'ignore' ? null : (proposal.target ?? normalizeTag(tag.name));
    const item = {
      oldId: tag.id,
      oldName: tag.name,
      action: proposal.action,
      reason: proposal.reason,
      targetName: key,
      targetId: null,
    };
    mapping.push(item);
    if (key !== null) {
      const group = groups.get(key) ?? [];
      group.push({ tag, item });
      groups.set(key, group);
    }
  }
  const cleaned = [];
  for (const [key, group] of groups) {
    // 原名已等于标准名时保留它的 ID，否则沿用该组第一条旧 ID。
    const primary = group.find((entry) => entry.tag.name === key) ?? group[0];
    // 合并时优先采用标准译名，否则沿用组内已有的非空中文字段。
    const existingChinese = group.find((entry) => entry.tag.name_zh?.trim());
    cleaned.push({
      id: primary.tag.id,
      name: key,
      normalized_name: key,
      name_zh: translations[key] ?? existingChinese?.tag.name_zh ?? null,
    });
    for (const entry of group) entry.item.targetId = primary.tag.id;
  }
  return { tags: cleaned, mapping };
}

/** 检查真实标签及关联与临时计划完全一致，同时检查外键与数据库完整性。 */
function verifyApplied(db) {
  const tagDifference = db
    .prepare(
      `SELECT
    (SELECT count(*) FROM (SELECT * FROM tag EXCEPT SELECT * FROM cleaned_tags)) +
    (SELECT count(*) FROM (SELECT * FROM cleaned_tags EXCEPT SELECT * FROM tag)) AS n`,
    )
    .get().n;
  const linkDifference = db
    .prepare(
      `SELECT
    (SELECT count(*) FROM (SELECT * FROM station_tag EXCEPT SELECT * FROM cleaned_station_tags)) +
    (SELECT count(*) FROM (SELECT * FROM cleaned_station_tags EXCEPT SELECT * FROM station_tag)) AS n`,
    )
    .get().n;
  if (
    tagDifference ||
    linkDifference ||
    db.prepare('PRAGMA foreign_key_check').all().length ||
    db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok'
  ) {
    throw new Error('清洗后的标签或关联与计划不一致，已取消写入。');
  }
}

/** 将临时计划原子写回 tag 和 station_tag；调用方负责开启事务及预先备份。 */
function applyTemporaryPlan(db) {
  db.exec(`DELETE FROM station_tag;
    DELETE FROM tag;
    INSERT INTO tag SELECT * FROM cleaned_tags;
    INSERT INTO station_tag SELECT * FROM cleaned_station_tags;`);
  verifyApplied(db);
}

/**
 * 清洗本地 V2 标签并重建关联；明确噪声删除、别名合并、未知标签保留。
 * 默认仅预览；apply=true 时先建立独立备份，再在同一事务中写回并核对全部关联。
 * @param {string} dbPath 已存在的本地 V2 数据库。
 * @param {{apply?: boolean, backupPath?: string}} [options] 写入开关和备份路径。
 * @returns {object} 清洗统计及备份文件路径；预览不生成备份、不写业务库。
 */
export function cleanTags(dbPath = defaultDb, options = {}) {
  const file = resolve(dbPath);
  if (!existsSync(file)) throw new Error(`找不到 V2 数据库：${file}`);
  const rules = JSON.parse(readFileSync(rulesPath, 'utf8'));
  const translations = JSON.parse(readFileSync(translationsPath, 'utf8'));
  const db = new DatabaseSync(file, { readOnly: !options.apply });
  let transaction = false;
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    db.exec(options.apply ? 'BEGIN IMMEDIATE' : 'BEGIN');
    transaction = true;
    const hasChinese = verifySchema(db);
    const before = counts(db);
    const plan = createPlan(db.prepare('SELECT * FROM tag ORDER BY id').all(), rules, translations);
    db.exec(`CREATE TEMP TABLE tag_mapping (old_id TEXT PRIMARY KEY, target_id TEXT);
      CREATE TEMP TABLE cleaned_tags (id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL, name_zh TEXT);
      CREATE TEMP TABLE cleaned_station_tags (station_id TEXT, tag_id TEXT, PRIMARY KEY (station_id, tag_id));`);
    const addMap = db.prepare('INSERT INTO tag_mapping VALUES (?, ?)');
    for (const row of plan.mapping) addMap.run(row.oldId, row.targetId);
    const addTag = db.prepare('INSERT INTO cleaned_tags VALUES (?, ?, ?, ?)');
    for (const row of plan.tags) addTag.run(row.id, row.name, row.normalized_name, row.name_zh);
    db.exec(`INSERT OR IGNORE INTO cleaned_station_tags
      SELECT st.station_id, m.target_id FROM station_tag st JOIN tag_mapping m ON m.old_id=st.tag_id
      WHERE m.target_id IS NOT NULL;`);
    const after = {
      tags: plan.tags.length,
      stationTags: db.prepare('SELECT count(*) AS n FROM cleaned_station_tags').get().n,
    };
    const summary = {
      applied: false,
      before,
      after,
      ignoredTags: 0,
      mergedTags: 0,
      reviewTagsKept: 0,
      associationsRemoved: before.stationTags - after.stationTags,
      backupPath: null,
      translatedTags: 0,
    };
    for (const row of plan.mapping) {
      if (row.targetId === null) summary.ignoredTags++;
      else if (row.targetId !== row.oldId) summary.mergedTags++;
      if (row.action === 'review') summary.reviewTagsKept++;
    }
    for (const row of plan.tags) if (row.name_zh !== null) summary.translatedTags++;
    if (options.apply) {
      summary.backupPath = backupTags(db, options.backupPath ?? defaultBackupPath(file), {
        source: file,
        createdAt: new Date().toISOString(),
        operation: 'clean',
        before,
        after,
        rules,
        translations,
        mapping: plan.mapping,
      });
      if (!hasChinese) db.exec(chineseColumnSql);
      applyTemporaryPlan(db);
      summary.applied = true;
    }
    db.exec('COMMIT');
    transaction = false;
    return summary;
  } catch (error) {
    if (transaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

/**
 * 从标签专用快照恢复两张表；当前状态会另行备份，原电台不存在时拒绝恢复以防悬空关联。
 * @param {string} dbPath 当前 V2 数据库。
 * @param {string} backupPath 标签专用备份文件。
 * @returns {object} 恢复后的行数及恢复前的备份路径。
 */
export function restoreTags(dbPath, backupPath) {
  const file = resolve(dbPath);
  const snapshot = resolve(backupPath);
  if (file === snapshot) throw new Error('备份和目标数据库不能是同一文件。');
  if (!existsSync(file) || !existsSync(snapshot)) throw new Error('目标数据库或标签备份不存在。');
  const source = new DatabaseSync(snapshot, { readOnly: true });
  const db = new DatabaseSync(file);
  let transaction = false;
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE;');
    transaction = true;
    const hasChinese = verifySchema(db);
    verifySchema(source);
    db.exec(`CREATE TEMP TABLE cleaned_tags (id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL, name_zh TEXT);
      CREATE TEMP TABLE cleaned_station_tags (station_id TEXT, tag_id TEXT, PRIMARY KEY (station_id, tag_id));`);
    const addTag = db.prepare('INSERT INTO cleaned_tags VALUES (?, ?, ?, ?)');
    for (const row of source.prepare('SELECT * FROM tag').iterate()) {
      addTag.run(row.id, row.name, row.normalized_name, row.name_zh ?? null);
    }
    const addLink = db.prepare('INSERT INTO cleaned_station_tags VALUES (?, ?)');
    for (const row of source.prepare('SELECT station_id, tag_id FROM station_tag').iterate()) {
      addLink.run(row.station_id, row.tag_id);
    }
    if (
      db
        .prepare(
          `SELECT 1 FROM cleaned_station_tags st LEFT JOIN station s ON s.id=st.station_id
      LEFT JOIN cleaned_tags t ON t.id=st.tag_id WHERE s.id IS NULL OR t.id IS NULL LIMIT 1`,
        )
        .get()
    ) {
      throw new Error('备份引用的电台或标签不存在，拒绝恢复。');
    }
    const safetyBackup = backupTags(db, defaultBackupPath(file), {
      operation: 'before_restore',
      source: file,
      restoreFrom: snapshot,
      createdAt: new Date().toISOString(),
    });
    if (!hasChinese) db.exec(chineseColumnSql);
    applyTemporaryPlan(db);
    const restored = counts(db);
    db.exec('COMMIT');
    transaction = false;
    return { restored, safetyBackup };
  } catch (error) {
    if (transaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    source.close();
    db.close();
  }
}

/** 默认生成预览；显式 --apply 清洗本地数据，--restore 恢复专用标签备份。 */
function main() {
  const { values } = parseArgs({
    options: {
      db: { type: 'string' },
      apply: { type: 'boolean' },
      backup: { type: 'string' },
      restore: { type: 'string' },
    },
  });
  if (values.restore && values.apply) throw new Error('--restore 和 --apply 不能同时使用。');
  const result = values.restore
    ? restoreTags(values.db ?? defaultDb, values.restore)
    : cleanTags(values.db ?? defaultDb, { apply: values.apply, backupPath: values.backup });
  console.log(JSON.stringify(result, null, 2));
}

// 引用模块进行测试时不执行 CLI。
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
