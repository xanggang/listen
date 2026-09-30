import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const directory = fileURLToPath(new URL('../', import.meta.url));
const databasePath = resolve(directory, 'data/worldtuner-v2.sqlite');
const schemaPath = resolve(directory, 'schema.sql');

/**
 * 在临时文件中创建空的 V2 SQLite，校验后原子放到目标路径。
 * 目标库已存在时拒绝覆盖；失败时清除本次临时文件，不触碰采集库。
 * @param {string} outputPath 新数据库的绝对路径。
 * @returns {number} 创建的业务表数量。
 */
export function initializeV2Database(outputPath = databasePath) {
  if (existsSync(outputPath)) throw new Error(`V2 数据库已存在：${outputPath}`);
  mkdirSync(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  if (existsSync(temporaryPath)) throw new Error(`临时数据库已存在：${temporaryPath}`);
  const schema = readFileSync(schemaPath, 'utf8');
  const db = new DatabaseSync(temporaryPath);
  let transactionOpen = false;
  try {
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('BEGIN IMMEDIATE;');
    transactionOpen = true;
    db.exec(schema);
    db.exec('COMMIT;');
    transactionOpen = false;
    const integrity = db.prepare('PRAGMA integrity_check').get();
    const foreignKeys = db.prepare('PRAGMA foreign_key_check').all();
    if (integrity?.integrity_check !== 'ok' || foreignKeys.length) {
      throw new Error('V2 数据库完整性或外键检查失败。');
    }
    const count = db
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .get().count;
    db.close();
    if (existsSync(outputPath)) throw new Error(`V2 数据库已存在：${outputPath}`);
    renameSync(temporaryPath, outputPath);
    return count;
  } catch (error) {
    if (db.isOpen) {
      if (transactionOpen) db.exec('ROLLBACK;');
      db.close();
    }
    rmSync(temporaryPath, { force: true });
    throw error;
  }
}

/** 创建默认路径下的空 V2 库，并报告数据库路径与表数量。 */
function main() {
  if (process.argv.length > 2) throw new Error('用法：node v2/src/init.mjs');
  const count = initializeV2Database();
  console.log(`已创建 ${databasePath}，包含 ${count} 张空业务表。`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
