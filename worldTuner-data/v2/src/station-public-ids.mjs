import { randomInt } from 'node:crypto';
import { closeSync, linkSync, openSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backup, DatabaseSync } from 'node:sqlite';
import { parseArgs } from 'node:util';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const publicIdPattern = /^[0-9A-Za-z]{7}$/;

/**
 * 使用安全随机源分配 7 位 Base62 public_id，碰撞时重试，不依赖原主键。
 * @param {Set<string>} used 已存在及本次已分配的 ID；成功后加入新值。
 * @returns {string} 当前集合内唯一的 ID；连续碰撞 100 次时抛错。
 */
export function generatePublicId(used) {
  for (let attempt = 0; attempt < 100; attempt++) {
    let id = '';
    for (let index = 0; index < 7; index++) id += alphabet[randomInt(alphabet.length)];
    if (!used.has(id)) {
      used.add(id);
      return id;
    }
  }
  throw new Error('public_id 连续碰撞，已停止处理。');
}

/**
 * 仅升级 station 并回填缺失的 public_id，已有值、19 位主键和其他业务数据保持不变。
 * 调用者必须在写事务内调用并负责回滚；唯一索引是最终唯一性保障。
 * @param {DatabaseSync} db 已开启写事务的本地业务库。
 * @returns {{total: number, filled: number, preserved: number}} 本次回填及保留的电台数量。
 */
export function ensureStationPublicIds(db) {
  if (!db.isTransaction) throw new Error('回填 public_id 必须在写事务中执行。');
  const invalidId = db
    .prepare(
      "SELECT id FROM station WHERE id IS NULL OR length(id)<>19 OR id GLOB '*[^0-9]*' LIMIT 1",
    )
    .get();
  if (invalidId) throw new Error('station 主键不是 19 位数字，请使用原始 worldtuner-v2.sqlite。');
  const columns = db.prepare('PRAGMA table_info(station)').all();
  // 旧库增加可空字段，允许数据导入在同一事务内先插入后补齐。
  if (!columns.some((column) => column.name === 'public_id')) {
    db.exec(`ALTER TABLE station ADD COLUMN public_id TEXT COLLATE BINARY
      CHECK (public_id IS NULL OR (length(public_id)=7 AND public_id NOT GLOB '*[^0-9A-Za-z]*'));`);
  }
  const used = new Set();
  for (const row of db
    .prepare('SELECT public_id FROM station WHERE public_id IS NOT NULL')
    .iterate()) {
    if (typeof row.public_id !== 'string' || !publicIdPattern.test(row.public_id)) {
      throw new Error('station 包含无效 public_id，拒绝覆盖已有值。');
    }
    if (used.has(row.public_id)) throw new Error('station 包含重复 public_id。');
    used.add(row.public_id);
  }
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_station_public_id ON station(public_id COLLATE BINARY);',
  );
  const preserved = used.size;
  const update = db.prepare('UPDATE station SET public_id=? WHERE id=? AND public_id IS NULL');
  // 先固定待回填主键，避免遍历正在被 UPDATE 修改的索引。
  const missing = db.prepare('SELECT id FROM station WHERE public_id IS NULL').all();
  for (const row of missing) update.run(generatePublicId(used), row.id);
  return { total: preserved + missing.length, filled: missing.length, preserved };
}

/**
 * 用 SQLite 在线备份生成完整新库，再事务回填 station.public_id；源库始终只读。
 * 目标及父目录须明确指定，拒绝覆盖已有文件，失败清理本次临时文件。
 * @param {string} input 保留 19 位主键的本地 SQLite，不是之前重写主键的 short 库。
 * @param {string} output 新数据库路径，父目录必须已存在。
 * @returns {Promise<{input: string, output: string, total: number, filled: number, preserved: number}>} 回填统计。
 */
export async function migrateStationPublicIds(input, output) {
  const inputPath = resolve(input);
  const outputPath = resolve(output);
  if (inputPath === outputPath) throw new Error('输入和输出不能是同一个文件。');
  const source = new DatabaseSync(inputPath, { readOnly: true });
  const temporaryPath = `${outputPath}.${process.pid}.${randomInt(2 ** 32)}.tmp`;
  let target;
  let reserved = false;
  let temporaryCreated = false;
  try {
    closeSync(openSync(outputPath, 'wx'));
    reserved = true;
    closeSync(openSync(temporaryPath, 'wx'));
    temporaryCreated = true;
    await backup(source, temporaryPath);
    target = new DatabaseSync(temporaryPath);
    target.exec('PRAGMA journal_mode=DELETE; PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
    const result = ensureStationPublicIds(target);
    if (target.prepare('PRAGMA foreign_key_check').all().length) {
      throw new Error('数据库存在失效外键，已停止处理。');
    }
    if (target.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') {
      throw new Error('数据库完整性校验失败。');
    }
    target.exec('COMMIT;');
    target.close();
    rmSync(outputPath);
    reserved = false;
    // 与输出同目录，发布已完整校验的库；若其他进程抢占目标则报错，绝不覆盖。
    linkSync(temporaryPath, outputPath);
    return { input: inputPath, output: outputPath, ...result };
  } finally {
    if (target?.isOpen) target.close();
    source.close();
    if (reserved) rmSync(outputPath, { force: true });
    if (temporaryCreated) {
      rmSync(temporaryPath, { force: true });
      rmSync(`${temporaryPath}-journal`, { force: true });
      rmSync(`${temporaryPath}-wal`, { force: true });
      rmSync(`${temporaryPath}-shm`, { force: true });
    }
  }
}

/**
 * 解析显式输入输出路径，生成包含 station.public_id 的新库并打印回填统计。
 */
async function main() {
  const { values } = parseArgs({
    options: { input: { type: 'string' }, output: { type: 'string' }, help: { type: 'boolean' } },
  });
  const usage =
    'node v2/src/station-public-ids.mjs --input 原库.sqlite --output 带public-id的库.sqlite';
  if (values.help) {
    console.log(usage);
    return;
  }
  if (!values.input || !values.output) throw new Error(usage);
  console.log(JSON.stringify(await migrateStationPublicIds(values.input, values.output), null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
