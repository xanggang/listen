import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fetchStations } from '../src/client.mjs';
import { importStations, normalizeStation } from '../src/repository.mjs';

const station = {
  stationuuid: '11111111-1111-4111-8111-111111111111',
  name: "Radio ' One",
  url: 'https://example.com/live',
  tags: 'jazz,jazz, news',
  language: 'english',
  country: 'United Kingdom',
  countrycode: 'GB',
  has_extended_info: true,
};

// 迁移中的业务字段允许 null，保留失效或尚未补全的电台记录。
test('字段空值与迁移约定兼容', () => {
  const result = normalizeStation({ stationuuid: station.stationuuid, url: '', name: null });
  assert.equal(result.url, '');
  assert.equal(result.name, null);
  assert.equal(result.geo_lat, null);
});

// 最后一页不足 pageSize 时结束，必须按 offset 顺序收集各页。
test('分页拉取包含最后一页', async () => {
  const offsets = [];
  // 用两条完整页和一条尾页模拟三个电台。
  const request = async (url) => {
    const offset = Number(url.searchParams.get('offset'));
    offsets.push(offset);
    return Response.json(offset === 0 ? [station, station] : [station]);
  };
  const result = await fetchStations(['https://working.example'], request, 2);
  assert.deepEqual(offsets, [0, 2]);
  assert.equal(result.stations.length, 3);
});

// 重复同步必须更新原行，并对标签去重计数，同时保留未再出现的电台。
test('同步幂等，保留主键和历史记录，分类计数正确', () => {
  const db = new DatabaseSync(':memory:');
  try {
    assert.equal(importStations(db, [station], 'test').inserted, 1);
    const first = db.prepare('SELECT * FROM station').get();
    assert.equal(first.has_extended_info, 1);
    const tag = db.prepare("SELECT * FROM tags WHERE name = 'jazz'").get();
    assert.equal(tag.stationcount, 1);
    assert.equal(importStations(db, [{ ...station, votes: 8 }], 'test').updated, 1);
    assert.equal(db.prepare('SELECT id FROM station').get().id, first.id);
    assert.equal(db.prepare('SELECT votes FROM station').get().votes, 8);
    assert.equal(db.prepare("SELECT id FROM tags WHERE name = 'jazz'").get().id, tag.id);
    importStations(
      db,
      [{ ...station, stationuuid: '22222222-2222-4222-8222-222222222222' }],
      'test',
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM station').get().n, 2);
    assert.equal(
      db.prepare("SELECT stationcount FROM tags WHERE name = 'jazz'").get().stationcount,
      2,
    );
  } finally {
    db.close();
  }
});

// 不接受空数据、错误字段及重复 UUID，数据库内容必须保持原样。
test('非法输入不能部分写入', () => {
  const db = new DatabaseSync(':memory:');
  try {
    importStations(db, [station], 'test');
    for (const inputs of [
      [],
      [station, station],
      [{ ...station, votes: 'bad' }],
      [{ ...station, stationuuid: '' }],
    ]) {
      // 每种非法输入均应抛错，而不是跳过后报告成功。
      assert.throws(() => importStations(db, inputs, 'test'));
    }
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM radio_browser_sync_runs').get().n, 1);
  } finally {
    db.close();
  }
});

// 用数据库触发器模拟写入中途失败，验证先前更新与审计记录一起回滚。
test('数据库写入失败时整批回滚', () => {
  const db = new DatabaseSync(':memory:');
  try {
    importStations(db, [station], 'test');
    db.exec(
      "CREATE TRIGGER fail_insert BEFORE INSERT ON station BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    );
    // 第一条更新成功后，第二条插入失败；两条都不得提交。
    assert.throws(
      () =>
        importStations(
          db,
          [
            { ...station, name: 'changed' },
            { ...station, stationuuid: '22222222-2222-4222-8222-222222222222' },
          ],
          'test',
        ),
      /test failure/,
    );
    assert.equal(db.prepare('SELECT name FROM station').get().name, station.name);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM radio_browser_sync_runs').get().n, 1);
  } finally {
    db.close();
  }
});

// 模拟镜像持续失败后切换，验证请求标识、全量参数和超时信号。
test('镜像重试与切换', async () => {
  const urls = [];
  // 首个镜像返回 503；备用镜像提供有效数据。
  const request = async (url, options) => {
    urls.push(url.origin);
    assert.equal(url.searchParams.get('hidebroken'), 'false');
    assert.match(options.headers['User-Agent'], /WorldTuner/);
    assert.ok(options.signal);
    return url.hostname === 'broken.example'
      ? new Response('', { status: 503 })
      : Response.json([station]);
  };
  const result = await fetchStations(
    ['https://broken.example', 'https://working.example'],
    request,
  );
  assert.equal(result.server, 'https://working.example');
  assert.equal(urls.length, 3);
});
