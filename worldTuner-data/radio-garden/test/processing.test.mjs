import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { importRadioGarden, parseChannel } from '../processing/import-v2.mjs';

const schema = readFileSync(new URL('../../v2/schema.sql', import.meta.url), 'utf8');

/**
 * 创建最小的采集库及空 V2 库，供导入与事务测试使用。
 * @returns {{directory: string, sourcePath: string, targetPath: string}} 临时文件路径。
 */
function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'radio-garden-processing-'));
  const sourcePath = join(directory, 'source.sqlite');
  const targetPath = join(directory, 'target.sqlite');
  const source = new DatabaseSync(sourcePath);
  source.exec(`
    CREATE TABLE api_responses (
      endpoint TEXT NOT NULL, entity_id TEXT NOT NULL, status TEXT NOT NULL,
      response_json TEXT, redirect_url TEXT, fetched_at TEXT NOT NULL,
      PRIMARY KEY (endpoint, entity_id)
    );
    CREATE TABLE radio_garden_places (
      id TEXT PRIMARY KEY, latitude REAL NOT NULL, longitude REAL NOT NULL
    );
    CREATE TABLE radio_garden_country_names (name_en TEXT PRIMARY KEY, region_code TEXT);
    CREATE TABLE place_channels (place_id TEXT, channel_id TEXT);
    INSERT INTO radio_garden_places VALUES ('place-1', 48.2, 16.3);
    INSERT INTO radio_garden_country_names VALUES ('Austria', 'AT');
    INSERT INTO place_channels VALUES ('place-1', 'channel-1');
  `);
  source
    .prepare(
      `
    INSERT INTO api_responses (endpoint, entity_id, status, response_json, fetched_at)
    VALUES ('channel_details', 'channel-1', 'success', ?, '2026-09-30T00:00:00Z')
  `,
    )
    .run(
      JSON.stringify({
        data: {
          type: 'channel',
          id: 'channel-1',
          title: 'Test Radio',
          place: { id: 'place-1', title: 'Vienna' },
          country: { title: 'Austria' },
          website: 'https://example.org',
          social: [{ platform: 'facebook', url: 'https://facebook.com/example' }],
        },
      }),
    );
  source
    .prepare(
      `
    INSERT INTO api_responses (endpoint, entity_id, status, redirect_url, fetched_at)
    VALUES ('stream_redirect', 'channel-1', 'success', 'https://stream.example.org/live', '2026-09-30T00:01:00Z')
  `,
    )
    .run();
  source.close();
  const target = new DatabaseSync(targetPath);
  target.exec(schema);
  target.close();
  return { directory, sourcePath, targetPath };
}

// 验证地点、国家、网站、播放重定向和社交链接在 V2 中的对应关系。
test('导入有效频道并拒绝重复导入', () => {
  const fixture = createFixture();
  try {
    const result = importRadioGarden(fixture.sourcePath, fixture.targetPath);
    assert.equal(result.stations, 1);
    assert.equal(result.streams, 1);
    assert.equal(result.links, 1);
    assert.equal(result.missingDetails, 0);
    const db = new DatabaseSync(fixture.targetPath, { readOnly: true });
    try {
      const station = db
        .prepare(
          `
        SELECT s.name, s.website, s.place, s.latitude, s.longitude, s.votes,
          s.clickcount, c.code AS country_code
        FROM station s JOIN country c ON c.id = s.country_id
      `,
        )
        .get();
      assert.deepEqual(
        { ...station },
        {
          name: 'Test Radio',
          website: 'https://example.org',
          place: 'Vienna',
          latitude: 48.2,
          longitude: 16.3,
          votes: null,
          clickcount: null,
          country_code: 'AT',
        },
      );
      assert.equal(
        db.prepare('SELECT resolved_url FROM station_stream').get().resolved_url,
        'https://stream.example.org/live',
      );
      assert.equal(db.prepare('SELECT platform FROM station_link').get().platform, 'facebook');
      const idTypes = db
        .prepare(
          `
        SELECT typeof(s.id) AS station_id, typeof(c.id) AS country_id,
          typeof(t.id) AS stream_id, typeof(l.id) AS link_id,
          typeof(t.station_id) AS stream_station_id
        FROM station s JOIN country c ON c.id = s.country_id
          JOIN station_stream t ON t.station_id = s.id
          JOIN station_link l ON l.station_id = s.id
      `,
        )
        .get();
      assert.deepEqual(
        { ...idTypes },
        {
          station_id: 'text',
          country_id: 'text',
          stream_id: 'text',
          link_id: 'text',
          stream_station_id: 'text',
        },
      );
      assert.match(db.prepare('SELECT id FROM station').get().id, /^\d{19}$/);
      assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
    } finally {
      db.close();
    }
    assert.throws(() => importRadioGarden(fixture.sourcePath, fixture.targetPath), /拒绝重复导入/);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

// 缺少引用地点时，导入必须整体回滚，不能留下部分电台。
test('缺失地点导致整批回滚', () => {
  const fixture = createFixture();
  try {
    const source = new DatabaseSync(fixture.sourcePath);
    source.exec("DELETE FROM radio_garden_places WHERE id = 'place-1'");
    source.close();
    assert.throws(
      () => importRadioGarden(fixture.sourcePath, fixture.targetPath),
      /地点表中不存在/,
    );
    const target = new DatabaseSync(fixture.targetPath, { readOnly: true });
    try {
      assert.equal(target.prepare('SELECT COUNT(*) AS count FROM station').get().count, 0);
      assert.equal(target.prepare('SELECT COUNT(*) AS count FROM country').get().count, 0);
    } finally {
      target.close();
    }
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

// 接口误返回 page 时应单独识别，未知格式仍需报错。
test('仅跳过已知的 page 响应', () => {
  assert.equal(parseChannel('page-1', JSON.stringify({ data: { type: 'page' } })), null);
  assert.throws(
    () => parseChannel('channel-1', JSON.stringify({ data: { type: 'other' } })),
    /无效/,
  );
});
