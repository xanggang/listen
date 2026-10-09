import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ensureCatalogNames, migrateCatalogNames } from '../src/catalog-names.mjs';

/**
 * 创建旧结构和关联，验证增量升级而不是重建 ID。
 */
function legacy(db) {
  db.exec(`CREATE TABLE tag (id TEXT PRIMARY KEY, name TEXT, normalized_name TEXT);
    CREATE TABLE language (id TEXT PRIMARY KEY, name TEXT, name_zh TEXT, code TEXT);
    CREATE TABLE station_tag (station_id TEXT, tag_id TEXT);
    INSERT INTO tag VALUES ('0000000000000000001','rock','rock');
    INSERT INTO language VALUES ('0000000000000000002','english','英语','en');
    INSERT INTO station_tag VALUES ('0000000000000000003','0000000000000000001');`);
}

// 原名、中文名和关联保持不变，重复升级不会覆盖人工英文修正。
test('catalog migration is idempotent and preserves names and relations', () => {
  const db = new DatabaseSync(':memory:');
  try {
    legacy(db);
    assert.deepEqual(ensureCatalogNames(db), { tag: 1, language: 1 });
    db.prepare('UPDATE tag SET name_en = ? WHERE id = ?').run('Rock music', '0000000000000000001');
    assert.deepEqual(ensureCatalogNames(db), { tag: 0, language: 0 });
    const tag = db.prepare('SELECT * FROM tag').get();
    assert.equal(tag.name, 'rock');
    assert.equal(tag.name_en, 'Rock music');
    assert.equal(db.prepare('SELECT name_zh FROM language').get().name_zh, '英语');
    assert.equal(db.prepare('SELECT tag_id FROM station_tag').get().tag_id, tag.id);
  } finally {
    db.close();
  }
});

// 写入前完整备份，预览不改变字段，备份路径不能被再次覆盖。
test('preview is read-only and applying creates a restorable backup', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'worldtuner-catalog-'));
  const path = join(directory, 'catalog.sqlite');
  const snapshot = join(directory, 'before.sqlite');
  const db = new DatabaseSync(path);
  try {
    legacy(db);
  } finally {
    db.close();
  }
  try {
    const preview = await migrateCatalogNames(path);
    assert.equal(preview.applied, false);
    assert.deepEqual(preview.pending.tag, ['name_en', 'name_zh']);
    assert.equal(existsSync(snapshot), false);
    const result = await migrateCatalogNames(path, { apply: true, backupPath: snapshot });
    assert.equal(result.applied, true);
    const before = new DatabaseSync(snapshot, { readOnly: true });
    const after = new DatabaseSync(path, { readOnly: true });
    try {
      assert.equal(before.prepare('SELECT * FROM tag').get().name_en, undefined);
      assert.equal(after.prepare('SELECT name_en FROM tag').get().name_en, 'rock');
    } finally {
      before.close();
      after.close();
    }
    await assert.rejects(
      migrateCatalogNames(path, { apply: true, backupPath: snapshot }),
      /EEXIST/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
