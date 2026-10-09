import { existsSync, openSync, closeSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DatabaseSync, backup } from 'node:sqlite';

const tables = ['tag', 'language'];
const defaultDatabase = fileURLToPath(new URL('../data/worldtuner-v2.sqlite', import.meta.url));

/**
 * 为固定的标签/语言表补齐展示字段，仅回填缺失的英文名，不改 ID、原名或关联。
 * 调用方负责事务与备份；导入脚本可在已有事务内复用此方法。
 * @param {DatabaseSync} db 可写业务库连接。
 * @param {Array<'tag'|'language'>} selected 固定表名子集，标签专用备份可只升级 tag。
 * @returns {Record<string, number>} 每张表回填的行数。
 */
export function ensureCatalogNames(db, selected = tables) {
  if (
    selected.some(
      // SQL 标识符只能来自固定字典表映射。
      (table) => !tables.includes(table),
    )
  )
    throw new Error('Unsupported catalog table');
  const filled = {};
  for (const table of selected) {
    const columns = new Set(
      db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map(
          // 只按已存在的字段名判断升级需求。
          (column) => column.name,
        ),
    );
    if (!columns.has('name')) throw new Error(`Missing catalog table: ${table}`);
    for (const field of ['name_zh', 'name_en']) {
      if (!columns.has(field))
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${field} TEXT
        CHECK (${field} IS NULL OR length(trim(${field})) > 0)`);
    }
    filled[table] = Number(
      db
        .prepare(
          `UPDATE ${table} SET name_en = trim(name)
      WHERE name_en IS NULL OR length(trim(name_en)) = 0`,
        )
        .run().changes,
    );
  }
  return filled;
}

/**
 * 预览或升级本地 SQLite；写入前备份全库，事务失败整体回滚，备份绝不覆盖。
 * @param {string} database 已存在的 SQLite 文件。
 * @param {{apply?: boolean, backupPath?: string}} options 明确写入开关和可选备份位置。
 * @returns {Promise<object>} 待补字段或实际回填数量、备份位置。
 */
export async function migrateCatalogNames(database = defaultDatabase, options = {}) {
  const file = resolve(database);
  if (!existsSync(file)) throw new Error(`Database not found: ${file}`);
  const db = new DatabaseSync(file, { readOnly: !options.apply });
  let transaction = false;
  try {
    const pending = {};
    for (const table of tables) {
      const fields = db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map(
          // 预览不读取或修改原始采集库。
          (column) => column.name,
        );
      if (!fields.includes('name')) throw new Error(`Missing catalog table: ${table}`);
      pending[table] = ['name_en', 'name_zh'].filter(
        // 只报告当前业务库尚未包含的展示字段。
        (field) => !fields.includes(field),
      );
    }
    if (!options.apply) return { applied: false, database: file, pending };
    const stamp = new Date().toISOString().replaceAll(':', '-');
    const snapshot = resolve(
      options.backupPath ??
        join(dirname(file), `${basename(file, '.sqlite')}-catalog-names-${stamp}.sqlite`),
    );
    closeSync(openSync(snapshot, 'wx'));
    await backup(db, snapshot);
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;');
    transaction = true;
    const filled = ensureCatalogNames(db);
    if (db.prepare('PRAGMA foreign_key_check').all().length)
      throw new Error('Foreign key check failed');
    db.exec('COMMIT');
    transaction = false;
    return { applied: true, database: file, backup: snapshot, filled };
  } catch (error) {
    if (transaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

/**
 * 默认预览，显式 --apply 才备份并迁移指定本地数据库。
 */
async function main() {
  const { values } = parseArgs({
    options: {
      db: { type: 'string' },
      apply: { type: 'boolean' },
      backup: { type: 'string' },
    },
  });
  console.log(
    JSON.stringify(
      await migrateCatalogNames(values.db ?? defaultDatabase, {
        apply: values.apply,
        backupPath: values.backup,
      }),
      null,
      2,
    ),
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
