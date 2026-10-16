import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureCountryNames, migrateCountryNames } from '../src/country-names.mjs';

// 创建旧国家表并保留关联，用名称与代码冲突检查不会按原名猜测身份。
test('country migration reuses coded names and preserves custom labels and relations', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE country (id TEXT PRIMARY KEY, name TEXT, code TEXT);
      CREATE TABLE station (id TEXT PRIMARY KEY, country_id TEXT REFERENCES country(id));
      INSERT INTO country VALUES ('1','China','CN'),('2','Ambiguous','XX'),('3','Afghanistan','AF');
      INSERT INTO station VALUES ('4','1');`);
    const result = ensureCountryNames(db);
    assert.equal(result.translated, 2);
    assert.equal(result.untranslated.length, 1);
    assert.equal(db.prepare('SELECT name_zh FROM country WHERE id=?').get('1').name_zh, '中国');
    assert.equal(db.prepare('SELECT name_zh FROM country WHERE id=?').get('2').name_zh, null);
    db.prepare('UPDATE country SET name_en=?,name_zh=? WHERE id=?').run(
      'Custom English',
      '自定义中文',
      '1',
    );
    assert.equal(ensureCountryNames(db).translated, 0);
    assert.equal(
      db.prepare('SELECT name_zh FROM country WHERE id=?').get('1').name_zh,
      '自定义中文',
    );
    assert.equal(
      db.prepare('SELECT name_en FROM country WHERE id=?').get('1').name_en,
      'Custom English',
    );
    assert.equal(db.prepare('SELECT name FROM country WHERE id=?').get('1').name, 'China');
    assert.equal(db.prepare('SELECT country_id FROM station').get().country_id, '1');
  } finally {
    db.close();
  }
});

// 预览只读，迁移前备份可用于恢复原有三列结构。
test('country CLI migration previews and backs up before applying', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'worldtuner-countries-'));
  const file = join(directory, 'catalog.sqlite');
  const db = new DatabaseSync(file);
  db.exec(
    "CREATE TABLE country (id TEXT PRIMARY KEY,name TEXT,code TEXT); INSERT INTO country VALUES ('1','Germany','DE');",
  );
  db.close();
  try {
    assert.equal((await migrateCountryNames(file)).applied, false);
    const result = await migrateCountryNames(file, { apply: true });
    const old = new DatabaseSync(result.backup, { readOnly: true });
    const current = new DatabaseSync(file, { readOnly: true });
    try {
      assert.equal(old.prepare('SELECT * FROM country').get().name_zh, undefined);
      assert.equal(current.prepare('SELECT * FROM country').get().name_zh, '德国');
      assert.equal(result.translated, 1);
    } finally {
      old.close();
      current.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// 异常代码只允许精确的展示别名，其他 XX 不得自动译成法国。
test('explicit France alias translates display without rewriting invalid code', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(
      "CREATE TABLE country (id TEXT PRIMARY KEY,name TEXT,code TEXT); INSERT INTO country VALUES ('1','France','XX'),('2','Other','XX');",
    );
    ensureCountryNames(db);
    assert.equal(db.prepare("SELECT name_zh FROM country WHERE id='1'").get().name_zh, '法国');
    assert.equal(db.prepare("SELECT code FROM country WHERE id='1'").get().code, 'XX');
    assert.equal(db.prepare("SELECT name_zh FROM country WHERE id='2'").get().name_zh, null);
  } finally {
    db.close();
  }
});

// D1 初始化基线支持本地译名回填，导入前处理保留人工名称和稳定 ID。
test('D1 baseline supports country localization without overwriting translations', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
    db.exec(`INSERT INTO country (id,name,code,name_zh) VALUES
      ('1234567890123456701','Afghanistan','AF',NULL),
      ('1234567890123456702','France','XX',NULL),
      ('1234567890123456703','Niue','NU','自定义译名');`);
    ensureCountryNames(db);
    assert.equal(db.prepare("SELECT name_zh FROM country WHERE code='AF'").get().name_zh, '阿富汗');
    assert.equal(db.prepare("SELECT name_zh FROM country WHERE code='XX'").get().name_zh, '法国');
    assert.equal(db.prepare("SELECT name_zh FROM country WHERE code='NU'").get().name_zh, '自定义译名');
  } finally {
    db.close();
  }
});
