import { readFileSync, existsSync, openSync, closeSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DatabaseSync, backup } from 'node:sqlite';
import { ensureCatalogNames } from './catalog-names.mjs';

const defaultDatabase = fileURLToPath(new URL('../data/worldtuner-v2.sqlite', import.meta.url));
const names = JSON.parse(
  readFileSync(new URL('../../geo-localization/data/country-names.json', import.meta.url), 'utf8'),
);

/**
 * 复用已缓存名称，仅按明确国家代码填补中文；未覆盖代码保留原名兜底，不猜测身份。
 * 调用方负责备份及事务；重复执行不覆盖人工译名，不修改原名、代码或关联。
 * @param {DatabaseSync} db 可写 v2 业务库。
 * @returns {{translated: number, untranslated: object[]}} 新填中文数量和未覆盖国家。
 */
export function ensureCountryNames(db) {
  ensureCatalogNames(db, ['country']);
  const update = db.prepare(
    'UPDATE country SET name_zh = ? WHERE code = ? AND (name_zh IS NULL OR length(trim(name_zh)) = 0)',
  );
  let translated = 0;
  for (const entry of names) {
    if (entry.code) translated += Number(update.run(entry.name_zh, entry.code).changes);
  }
  return {
    translated,
    untranslated: db
      .prepare('SELECT id, name, code FROM country WHERE name_zh IS NULL ORDER BY code')
      .all(),
  };
}

/**
 * 默认只读预览；明确 apply 后先完整备份，再事务升级国家表并验证外键。
 * @param {string} database 已存在的本地 v2 数据库路径。
 * @param {{apply?: boolean, backupPath?: string}} options 写入开关及不可覆盖的备份路径。
 * @returns {Promise<object>} 升级结果、覆盖报告与备份位置。
 */
export async function migrateCountryNames(database = defaultDatabase, options = {}) {
  const file = resolve(database);
  if (!existsSync(file)) throw new Error(`Database not found: ${file}`);
  const db = new DatabaseSync(file, { readOnly: !options.apply });
  let transaction = false;
  try {
    const countries = db.prepare('SELECT id, name, code FROM country ORDER BY code').all();
    const codes = new Set(
      names
        .filter(
          // 手工地区没有国家代码，不按名称推断归属。
          (entry) => entry.code,
        )
        .map(
          // 代码是唯一的身份匹配键。
          (entry) => entry.code,
        ),
    );
    if (!options.apply)
      return {
        applied: false,
        database: file,
        total: countries.length,
        unmatched: countries.filter(
          // 输出未覆盖代码供后续补齐，预览不修改原库。
          (entry) => !codes.has(entry.code),
        ),
      };
    const stamp = new Date().toISOString().replaceAll(':', '-');
    const snapshot = resolve(
      options.backupPath ??
        join(dirname(file), `${basename(file, '.sqlite')}-country-names-${stamp}.sqlite`),
    );
    closeSync(openSync(snapshot, 'wx'));
    await backup(db, snapshot);
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;');
    transaction = true;
    const result = ensureCountryNames(db);
    if (db.prepare('PRAGMA foreign_key_check').all().length)
      throw new Error('Foreign key check failed');
    db.exec('COMMIT');
    transaction = false;
    return { applied: true, database: file, backup: snapshot, ...result };
  } catch (error) {
    if (transaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

/**
 * 解析本地迁移参数；默认预览，显式 --apply 才备份并写入。
 */
async function main() {
  const { values } = parseArgs({
    options: { db: { type: 'string' }, apply: { type: 'boolean' }, backup: { type: 'string' } },
  });
  console.log(
    JSON.stringify(
      await migrateCountryNames(values.db ?? defaultDatabase, {
        apply: values.apply,
        backupPath: values.backup,
      }),
      null,
      2,
    ),
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
