import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { applyAiTags, planAiTags } from '../processing/apply-ai-tags.mjs';
import { restoreTags } from '../processing/clean-tags.mjs';

/** 创建可合并、可拆分和可删除的结果项；ID 参数始终使用字符串。 */
function result(id, name, action, targets) {
  return { id, original_name: name, action, targets, confidence: 'high', reason: '测试明确映射。' };
}

// 覆盖连续映射、多个拆分目标的新 ID、准确标准名 ID 的保留以及中文冲突和循环拒绝。
test('AI 计划展开连续映射并拒绝不一致结果', () => {
  const tags = [
    { id: '0000000000000000001', name: 'a', name_zh: null },
    { id: '0000000000000000002', name: 'b', name_zh: null },
    { id: '0000000000000000003', name: 'rock', name_zh: '摇滚' },
  ];
  const input = [
    { id: '0000000000000000001', name: 'a' },
    { id: '0000000000000000002', name: 'b' },
  ];
  const rows = [
    result('0000000000000000001', 'a', 'merge', [{ name: 'b', name_zh: null }]),
    result('0000000000000000002', 'b', 'split', [
      { name: 'rock', name_zh: '摇滚' },
      { name: 'new genre', name_zh: '新风格' },
      { name: 'other genre', name_zh: '另一风格' },
    ]),
  ];
  const plan = planAiTags(tags, input, rows);
  assert.equal(plan.tags.length, 3);
  assert.equal(plan.tags.find((tag) => tag.name === 'rock').id, '0000000000000000003');
  assert.equal(new Set(plan.tags.map((tag) => tag.id)).size, 3);
  assert.equal(plan.mapping[0].targets.length, 3);
  assert.ok(!plan.tags.some((tag) => tag.name === 'b'));
  assert.throws(() => planAiTags(tags, input, [rows[0], rows[0]]), /重复/u);
  const cycle = [
    rows[0],
    result('0000000000000000002', 'b', 'merge', [{ name: 'a', name_zh: null }]),
  ];
  assert.throws(() => planAiTags(tags, input, cycle), /循环/u);
  const conflict = [
    result('0000000000000000001', 'a', 'merge', [{ name: 'rock', name_zh: '错误译名' }]),
    rows[1],
  ];
  assert.throws(() => planAiTags(tags, input, conflict), /中文冲突/u);
});

// 在真实 SQLite 上核对一对多映射、关联去重、完整备份与逐行恢复。
test('AI 入库支持拆分并可从备份恢复全部关联', () => {
  const directory = mkdtempSync(join(tmpdir(), 'worldtuner-ai-tags-'));
  const path = join(directory, 'catalog.sqlite');
  const inputPath = join(directory, 'input.jsonl');
  const resultPath = join(directory, 'result.jsonl');
  const backupPath = join(directory, 'backup.sqlite');
  const db = new DatabaseSync(path);
  try {
    db.exec(readFileSync(new URL('../../v2/schema.sql', import.meta.url), 'utf8'));
    db.exec(`INSERT INTO station (id,name,source_type,created_at,updated_at) VALUES
      ('0000000000000000001','A','radio_browser','now','now'),('0000000000000000002','B','radio_browser','now','now');
      INSERT INTO tag VALUES ('0000000000000000001','rock','rock','摇滚'),('0000000000000000002','rock jazz','rock jazz',NULL),('0000000000000000003','noise metadata','noise metadata',NULL);
      INSERT INTO station_tag VALUES ('0000000000000000001','0000000000000000001'),('0000000000000000001','0000000000000000002'),('0000000000000000002','0000000000000000002'),('0000000000000000001','0000000000000000003');`);
    const originalTags = db.prepare('SELECT * FROM tag ORDER BY id').all();
    const originalLinks = db.prepare('SELECT * FROM station_tag ORDER BY station_id,tag_id').all();
    writeFileSync(
      inputPath,
      JSON.stringify({ id: '0000000000000000002', name: 'rock jazz' }) +
        '\n' +
        JSON.stringify({ id: '0000000000000000003', name: 'noise metadata' }) +
        '\n',
    );
    const rows = [
      result('0000000000000000002', 'rock jazz', 'split', [
        { name: 'rock', name_zh: '摇滚' },
        { name: 'jazz', name_zh: '爵士' },
      ]),
      result('0000000000000000003', 'noise metadata', 'drop', []),
    ];
    writeFileSync(resultPath, rows.map(JSON.stringify).join('\n') + '\n');
    const preview = applyAiTags({ dbPath: path, inputPath, resultPath });
    assert.deepEqual(preview.after, { tags: 2, stationTags: 4, translatedTags: 2 });
    assert.deepEqual(db.prepare('SELECT * FROM tag ORDER BY id').all(), originalTags);
    const applied = applyAiTags({ dbPath: path, inputPath, resultPath, apply: true, backupPath });
    assert.equal(applied.verified, true);
    assert.equal(
      db.prepare('SELECT id FROM tag WHERE name=?').get('rock').id,
      '0000000000000000001',
    );
    assert.equal(db.prepare('SELECT count(*) n FROM station_tag').get().n, 4);
    restoreTags(path, backupPath);
    assert.deepEqual(db.prepare('SELECT * FROM tag ORDER BY id').all(), originalTags);
    assert.deepEqual(
      db.prepare('SELECT * FROM station_tag ORDER BY station_id,tag_id').all(),
      originalLinks,
    );
    db.exec(
      "CREATE TRIGGER reject_ai_tag BEFORE INSERT ON tag BEGIN SELECT RAISE(ABORT,'blocked'); END;",
    );
    assert.throws(
      () =>
        applyAiTags({
          dbPath: path,
          inputPath,
          resultPath,
          apply: true,
          backupPath: join(directory, 'rollback.sqlite'),
        }),
      /blocked/u,
    );
    assert.deepEqual(db.prepare('SELECT * FROM tag ORDER BY id').all(), originalTags);
    assert.deepEqual(
      db.prepare('SELECT * FROM station_tag ORDER BY station_id,tag_id').all(),
      originalLinks,
    );
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
