import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { importRadioBrowser, playbackKey } from '../processing/import-v2.mjs';

const schema = readFileSync(new URL('../../v2/schema.sql', import.meta.url), 'utf8');

/** 创建带有两个同流 Garden 频道的临时原始库和 V2 库。 */
function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'radio-browser-processing-'));
  const sourcePath = join(directory, 'source.sqlite');
  const targetPath = join(directory, 'target.sqlite');
  const source = new DatabaseSync(sourcePath);
  source.exec(`CREATE TABLE station (
    stationuuid TEXT, name TEXT, url TEXT, url_resolved TEXT, homepage TEXT, favicon TEXT,
    country TEXT, countrycode TEXT, state TEXT, votes INTEGER, clickcount INTEGER,
    geo_lat REAL, geo_long REAL, lastcheckok INTEGER, lastchangetime_iso8601 TEXT,
    codec TEXT, bitrate INTEGER, hls INTEGER, lastchecktime_iso8601 TEXT,
    tags TEXT, language TEXT, languagecodes TEXT
  )`);
  const insert = source.prepare(`INSERT INTO station VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
  )`);
  insert.run(
    'rb-1',
    'Browser Radio',
    'https://example.com/playlist.pls',
    'https://stream.example.com/live',
    'https://browser.example',
    null,
    'Austria',
    'AT',
    'Vienna',
    10,
    20,
    48.2,
    16.3,
    1,
    '2026-01-01T00:00:00Z',
    'MP3',
    128,
    0,
    '2026-01-02T00:00:00Z',
    'Rock,Pop',
    'English',
    'eng',
  );
  insert.run(
    'rb-2',
    'Other Name',
    'https://example.com/other.pls',
    'https://stream.example.com/live',
    null,
    'https://icon.example/icon.png',
    '',
    '',
    '',
    3,
    4,
    null,
    null,
    0,
    null,
    null,
    null,
    null,
    null,
    'Jazz',
    null,
    'deu',
  );
  insert.run(
    'rb-3',
    'New Radio',
    'https://new.example/live',
    'https://new.example/live',
    'https://new.example',
    null,
    'Germany',
    'DE',
    null,
    0,
    0,
    null,
    null,
    1,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  );
  source.close();
  const target = new DatabaseSync(targetPath);
  target.exec(schema);
  target.exec(`
    INSERT INTO country VALUES ('0000000000000000001', 'Austria', 'AT');
    INSERT INTO station (id, name, website, source_type, created_at, updated_at)
      VALUES ('0000000000000000002', 'Garden A', 'https://garden.example', 'radio_garden', '2026-01-01', '2026-01-01');
    INSERT INTO station (id, name, source_type, created_at, updated_at)
      VALUES ('0000000000000000003', 'Garden B', 'radio_garden', '2026-01-01', '2026-01-01');
    INSERT INTO station_stream (id, station_id, url, resolved_url, is_primary)
      VALUES ('0000000000000000004', '0000000000000000002', 'https://garden/a', 'https://stream.example.com/live', 1);
    INSERT INTO station_stream (id, station_id, url, resolved_url, is_primary)
      VALUES ('0000000000000000005', '0000000000000000003', 'https://garden/b', 'https://stream.example.com/live', 1);
    INSERT INTO station_source VALUES ('radio_garden', 'garden-a', '0000000000000000002', NULL, '2026-01-01', NULL);
    INSERT INTO station_source VALUES ('radio_garden', 'garden-b', '0000000000000000003', NULL, '2026-01-01', NULL);
  `);
  target.close();
  return { directory, sourcePath, targetPath };
}

// 解析地址优先，空解析地址回退到原始地址；不合并看起来相似的不同 URL。
test('播放地址去重键保留 URL 的原始语义', () => {
  assert.equal(
    playbackKey({ url: ' https://a/list.pls ', url_resolved: ' https://b/live ' }),
    'https://b/live',
  );
  assert.equal(playbackKey({ url: 'https://a/live', url_resolved: '' }), 'https://a/live');
  assert.equal(playbackKey({ url: '', url_resolved: '' }), null);
});

// 同流跨来源与 Browser 内部都应合并；Browser 非空字段优先，所有来源 ID 保留。
test('导入时按实际流合并电台并保持来源关系', () => {
  const fixture = createFixture();
  try {
    const result = importRadioBrowser(fixture.sourcePath, fixture.targetPath);
    assert.equal(result.newStations, 1);
    assert.equal(result.matchedGarden, 1);
    assert.equal(result.mergedGarden, 1);
    assert.equal(result.duplicateBrowser, 1);
    const db = new DatabaseSync(fixture.targetPath, { readOnly: true });
    try {
      assert.equal(db.prepare('SELECT count(*) n FROM station').get().n, 2);
      const merged = db.prepare("SELECT * FROM station WHERE source_type = 'both'").get();
      assert.equal(merged.name, 'Browser Radio');
      assert.equal(merged.website, 'https://browser.example');
      assert.equal(merged.favicon, 'https://icon.example/icon.png');
      assert.equal(merged.votes, 10);
      assert.equal(merged.place, 'Vienna');
      assert.equal(
        db.prepare('SELECT count(*) n FROM station_source WHERE station_id = ?').get(merged.id).n,
        4,
      );
      assert.equal(
        db.prepare('SELECT count(*) n FROM station_tag WHERE station_id = ?').get(merged.id).n,
        3,
      );
      assert.equal(
        db.prepare('SELECT count(*) n FROM station_language WHERE station_id = ?').get(merged.id).n,
        2,
      );
      assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
    } finally {
      db.close();
    }
    assert.throws(() => importRadioBrowser(fixture.sourcePath, fixture.targetPath), /拒绝重复导入/);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});
