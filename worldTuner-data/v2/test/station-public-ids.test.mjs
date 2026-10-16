import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureStationPublicIds, migrateStationPublicIds } from '../src/station-public-ids.mjs';

const id = '1234567890123456789';

/**
 * 从旧迁移建表，构造原主键、外键和一个额外表，验证整库复制不会漏数据。
 * @returns {{directory: string, input: string, output: string}} 临时文件路径，由测试清理。
 */
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'worldtuner-public-id-'));
  const input = join(directory, 'source.sqlite');
  const output = join(directory, 'public.sqlite');
  const db = new DatabaseSync(input);
  try {
    db.exec(
      readFileSync(
        new URL('../../../worldTuner-api/migrations/0001_catalog.sql', import.meta.url),
        'utf8',
      ),
    );
    db.exec(`
      INSERT INTO country (id,name,code) VALUES ('${id}','China','CN');
      INSERT INTO station (id,name,country_id,source_type,created_at,updated_at,votes)
        VALUES ('${id}','Radio A','${id}','both','2026-01-01','2026-01-02',9007199254740993);
      INSERT INTO station_stream (id,station_id,url,is_primary)
        VALUES ('${id}','${id}','https://example.com/live',1);
      CREATE TABLE extra (value TEXT);
      INSERT INTO extra VALUES ('keep');
    `);
  } finally {
    db.close();
  }
  return { directory, input, output };
}

// 整库保留所有原始内容，仅新增 station.public_id，重复处理不改变已分配值。
test('adds stable station public IDs while preserving primary keys and other tables', async () => {
  const { directory, input, output } = fixture();
  try {
    const original = readFileSync(input);
    const result = await migrateStationPublicIds(input, output);
    assert.equal(result.filled, 1);
    assert.equal(result.total, 1);
    assert.deepEqual(readFileSync(input), original);
    const db = new DatabaseSync(output);
    try {
      const station = db.prepare('SELECT id,country_id,public_id,updated_at FROM station').get();
      assert.equal(station.id, id);
      assert.equal(station.country_id, id);
      assert.equal(station.updated_at, '2026-01-02');
      assert.match(station.public_id, /^[0-9A-Za-z]{7}$/);
      assert.equal(db.prepare('SELECT id,station_id FROM station_stream').get().station_id, id);
      assert.equal(db.prepare('SELECT id FROM station_stream').get().id, id);
      assert.equal(db.prepare('SELECT value FROM extra').get().value, 'keep');
      const votes = db.prepare('SELECT votes FROM station');
      votes.setReadBigInts(true);
      assert.equal(votes.get().votes, 9007199254740993n);
      db.exec('BEGIN;');
      assert.deepEqual(ensureStationPublicIds(db), { total: 1, filled: 0, preserved: 1 });
      db.exec('COMMIT;');
      assert.equal(db.prepare('SELECT public_id FROM station').get().public_id, station.public_id);
      // 新列的 CHECK 拒绝非法字符。
      assert.throws(() => db.prepare('UPDATE station SET public_id=?').run('bad!123'), /CHECK/);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
      for (const table of [
        'country',
        'station_stream',
        'station_link',
        'tag',
        'language',
        'moderation_record',
      ]) {
        for (const column of db.prepare(`PRAGMA table_info(${table})`).all()) {
          assert.notEqual(column.name, 'public_id');
        }
      }
    } finally {
      db.close();
    }
    // 输出存在时拒绝覆盖。
    await assert.rejects(migrateStationPublicIds(input, output), /EEXIST/);
    // 禁止原地处理。
    await assert.rejects(migrateStationPublicIds(input, input), /同一个文件/);
    const repeated = join(directory, 'repeated.sqlite');
    assert.equal((await migrateStationPublicIds(output, repeated)).filled, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// 使用不满足原主键约束或失效外键的数据时，拒绝发布输出文件。
test('rejects rewritten primary keys and invalid relations, cleaning failed output', async () => {
  const { directory, input, output } = fixture();
  try {
    let db = new DatabaseSync(input);
    db.exec("PRAGMA foreign_keys=OFF; UPDATE station_stream SET station_id='9999999999999999999';");
    db.close();
    await assert.rejects(migrateStationPublicIds(input, output), /失效外键/);
    assert.equal(existsSync(output), false);
    db = new DatabaseSync(input);
    db.exec(`PRAGMA foreign_keys=OFF; PRAGMA ignore_check_constraints=ON;
      UPDATE station SET id='abc1234';`);
    db.close();
    await assert.rejects(migrateStationPublicIds(input, output), /19 位数字/);
    assert.deepEqual(readdirSync(directory), ['source.sqlite']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// D1 升级 SQL 与本地回填兼容，唯一索引区分大小写并拒绝重复值。
test('D1 migration and new schema support the same public ID constraints', () => {
  const { directory, input } = fixture();
  const db = new DatabaseSync(input);
  try {
    db.exec(
      readFileSync(
        new URL('../../../worldTuner-api/migrations/0008_station_public_id.sql', import.meta.url),
        'utf8',
      ),
    );
    db.exec(`UPDATE station SET public_id='Ab123xy';
      INSERT INTO station (id,public_id,name,source_type,created_at,updated_at)
      VALUES ('1234567890123456790','ab123xy','Radio B','radio_browser','2026','2026');`);
    // 同一值被数据库唯一约束拒绝，只有大小写不同的值可以共存。
    assert.throws(() => db.prepare('UPDATE station SET public_id=?').run('Ab123xy'), /UNIQUE/);
    db.exec('BEGIN;');
    assert.equal(ensureStationPublicIds(db).preserved, 2);
    db.exec('COMMIT;');
    const fresh = new DatabaseSync(':memory:');
    try {
      fresh.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
      assert.ok(
        fresh.prepare("SELECT name FROM pragma_table_info('station') WHERE name='public_id'").get(),
      );
      assert.ok(
        fresh.prepare("SELECT name FROM sqlite_schema WHERE name='idx_station_public_id'").get(),
      );
    } finally {
      fresh.close();
    }
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

// 十万条数据完成回填后 public_id 唯一，原主键仍为 19 位且再次执行不会重分配。
test('backfills 100000 stations and preserves existing public IDs', async () => {
  const { directory, input, output } = fixture();
  try {
    const source = new DatabaseSync(input);
    try {
      source.exec('BEGIN;');
      const insert = source.prepare(
        "INSERT INTO station (id,name,source_type,created_at,updated_at) VALUES (?,?,'radio_browser','2026','2026')",
      );
      for (let index = 0; index < 99999; index++) {
        insert.run(String(2000000000000000000n + BigInt(index)), `Radio ${index}`);
      }
      source.exec('COMMIT;');
    } finally {
      source.close();
    }
    assert.equal((await migrateStationPublicIds(input, output)).filled, 100000);
    const db = new DatabaseSync(output);
    try {
      assert.equal(
        db.prepare('SELECT count(DISTINCT public_id) AS n FROM station').get().n,
        100000,
      );
      assert.equal(
        db.prepare('SELECT count(*) AS n FROM station WHERE length(id)=19').get().n,
        100000,
      );
      db.exec('BEGIN;');
      assert.equal(ensureStationPublicIds(db).filled, 0);
      db.exec('COMMIT;');
    } finally {
      db.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
