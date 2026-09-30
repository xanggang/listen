import { openSync, closeSync, writeFileSync, unlinkSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import type { SQLOutputValue } from 'node:sqlite';
import { SQLiteDatabase } from './sqlite.ts';

// 只导出新业务库固定表，按外键依赖顺序排列；统计库和原始采集库不参与。
const tables = [
  'country',
  'tag',
  'language',
  'station',
  'station_stream',
  'station_link',
  'station_source',
  'station_tag',
  'station_language',
  'moderation_record',
] as const;

/**
 * 将可信本地 SQLite 值序列化为 SQL 字面量；字符串保留前导零，单引号按 SQLite 规则转义。
 */
function literal(value: SQLOutputValue): string {
  if (value === null) return 'NULL';
  if (typeof value === 'string') {
    if (value.includes('\0')) throw new Error('NUL in catalog text cannot be exported');
    return `'${value.replaceAll("'", "''")}'`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'bigint') return String(value);
  throw new Error('Unsupported catalog value');
}

/**
 * 只读导出数据到新的 SQL 文件；目标必须不存在，失败时删除不完整输出。
 * 先在新的 D1 上应用建表迁移，再执行本文件；导入前必须确认目标业务表为空。
 */
export function exportCatalog(source: string, output: string): Record<string, number> {
  if (realpathSync(source) === resolve(output)) throw new Error('Output must differ from source');
  const db = new SQLiteDatabase(source);
  let fd: number | undefined;
  try {
    fd = openSync(output, 'wx');
    let buffer =
      '-- worldTuner catalog data only; import once into an empty migrated database.\nPRAGMA defer_foreign_keys = ON;\n';
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const statement = db.connection.prepare(`SELECT * FROM ${table}`);
      statement.setReadBigInts(true);
      const columns = statement
        .columns()
        .map(
          // 固定表的列名仍按标识符规则引用，避免将列名当值处理。
          (column) => `"${column.name.replaceAll('"', '""')}"`,
        )
        .join(',');
      counts[table] = 0;
      for (const row of statement.iterate()) {
        const sql = `INSERT INTO ${table} (${columns}) VALUES (${Object.values(row).map(literal).join(',')});\n`;
        if (Buffer.byteLength(sql) > 95000)
          throw new Error(`Catalog row exceeds safe SQL statement size: ${table}`);
        buffer += sql;
        counts[table]++;
        if (Buffer.byteLength(buffer) >= 65536) {
          writeFileSync(fd, buffer);
          buffer = '';
        }
      }
    }
    if (buffer) writeFileSync(fd, buffer);
    closeSync(fd);
    fd = undefined;
    return counts;
  } catch (error) {
    if (fd !== undefined) {
      closeSync(fd);
      unlinkSync(output);
    }
    throw error;
  } finally {
    db.close();
  }
}

// 直接运行才执行导出；测试导入函数时不产生文件。
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const source =
    process.argv[2] ??
    fileURLToPath(new URL('../../worldTuner-data/v2/data/worldtuner-v2.sqlite', import.meta.url));
  const output = process.argv[3];
  if (!output) throw new Error('Usage: pnpm db:export:catalog [source.sqlite] output.sql');
  console.log(JSON.stringify(exportCatalog(resolve(source), resolve(output))));
}
