import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { cleanTags, restoreTags } from '../processing/clean-tags.mjs';

/** 创建两台电台及标准名、别名、技术信息、语言与未知风格标签，覆盖关系合并。 */
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'worldtuner-clean-tags-'));
  const path = join(directory, 'catalog.sqlite');
  const db = new DatabaseSync(path);
  db.exec(readFileSync(new URL('../../v2/schema.sql', import.meta.url), 'utf8'));
  db.exec(`INSERT INTO station (id,name,source_type,created_at,updated_at) VALUES
    ('0000000000000000001','A','radio_browser','now','now'),
    ('0000000000000000002','B','radio_browser','now','now');
    INSERT INTO tag (id, name, normalized_name) VALUES
      ('0000000000000000010','pop','pop'),
      ('0000000000000000011','pop music','pop music'),
      ('0000000000000000012','english','english'),
      ('0000000000000000013','128 kbps','128 kbps'),
      ('0000000000000000014','rare style','rare style'),
      ('0000000000000000015',' RARE  STYLE ',' rare  style '),
      ('0000000000000000016','80s','80s');
    INSERT INTO station_tag VALUES
      ('0000000000000000001','0000000000000000010'),
      ('0000000000000000001','0000000000000000011'),
      ('0000000000000000002','0000000000000000011'),
      ('0000000000000000001','0000000000000000012'),
      ('0000000000000000001','0000000000000000013'),
      ('0000000000000000001','0000000000000000014'),
      ('0000000000000000002','0000000000000000015'),
      ('0000000000000000002','0000000000000000016');`);
  db.prepare('UPDATE tag SET name_zh = ? WHERE name = ?').run('稀有风格', 'rare style');
  db.close();
  return { directory, path, backup: join(directory, 'tags-backup.sqlite') };
}

/** 只读取得两张标签表的全部记录，便于检查预览、回滚及恢复是否逐行一致。 */
function snapshot(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return {
      tags: db.prepare('SELECT * FROM tag ORDER BY id').all(),
      links: db.prepare('SELECT * FROM station_tag ORDER BY station_id,tag_id').all(),
    };
  } finally {
    db.close();
  }
}

// 清洗前的快照必须完整，合并去重不能丢失其他电台关联，恢复应逐行还原。
test('备份、清洗及恢复保持标签关系完整', () => {
  const f = fixture();
  try {
    const original = snapshot(f.path);
    const preview = cleanTags(f.path);
    assert.deepEqual(snapshot(f.path), original);
    assert.deepEqual(preview.after, { tags: 3, stationTags: 5 });
    const result = cleanTags(f.path, { apply: true, backupPath: f.backup });
    assert.deepEqual(snapshot(f.backup), original);
    assert.equal(result.ignoredTags, 2);
    assert.equal(result.mergedTags, 2);
    const cleaned = snapshot(f.path);
    assert.equal(cleaned.tags.length, 3);
    assert.equal(cleaned.links.length, 5);
    assert.equal(cleaned.tags[0].id, '0000000000000000010');
    assert.equal(cleaned.tags[0].name_zh, '流行音乐');
    assert.equal(cleaned.tags[1].name, 'rare style');
    assert.equal(cleaned.tags[1].name_zh, '稀有风格');
    assert.equal(cleaned.tags[2].name, '80s');
    const again = cleanTags(f.path);
    assert.deepEqual(again.before, again.after);
    restoreTags(f.path, f.backup);
    assert.deepEqual(snapshot(f.path), original);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

// 先前生成的三列快照仍可恢复到含中文列的新表，不删除表结构或破坏关联。
test('旧版标签备份可以恢复到新增中文列的库', () => {
  const f = fixture();
  try {
    const legacyPath = join(f.directory, 'legacy.sqlite');
    const legacy = new DatabaseSync(legacyPath);
    legacy.exec(`CREATE TABLE tag (id TEXT PRIMARY KEY, name TEXT, normalized_name TEXT);
      CREATE TABLE station_tag (station_id TEXT, tag_id TEXT, PRIMARY KEY(station_id,tag_id));
      INSERT INTO tag VALUES ('0000000000000000010','old pop','old pop');
      INSERT INTO station_tag VALUES ('0000000000000000001','0000000000000000010');`);
    legacy.close();
    restoreTags(f.path, legacyPath);
    const restored = snapshot(f.path);
    assert.equal(restored.tags.length, 1);
    assert.equal(restored.tags[0].name, 'old pop');
    assert.equal(restored.tags[0].name_zh, null);
    assert.equal(restored.links.length, 1);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

// 任何写回失败都应回滚两张表，已经生成的原始快照仍能使用。
test('写回失败时整体回滚并保留备份', () => {
  const f = fixture();
  try {
    const original = snapshot(f.path);
    const db = new DatabaseSync(f.path);
    db.exec(
      "CREATE TRIGGER fail_tag BEFORE INSERT ON tag BEGIN SELECT RAISE(ABORT,'test failure'); END",
    );
    db.close();
    assert.throws(() => cleanTags(f.path, { apply: true, backupPath: f.backup }), /test failure/);
    assert.deepEqual(snapshot(f.path), original);
    assert.deepEqual(snapshot(f.backup), original);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});
