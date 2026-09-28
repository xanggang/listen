import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  normalizePlaces,
  readColumnarResponses,
  saveNormalizedPlaces,
} from '../src/normalize-places.mjs';

// 验证真实快照的列对齐关系、国家字典索引及经纬度顺序。
test('现有 columnar 快照可还原地点和国家', async () => {
  const [core, details] = await readColumnarResponses('files');
  const result = normalizePlaces(core, details);
  assert.equal(result.places.length, 11490);
  assert.deepEqual(result.places[0], {
    id: 'MQfEnBji',
    title: 'Moscow',
    country: 'Russia',
    longitude: 37.6173,
    latitude: 55.755825,
    size: 344,
    boost: 0,
    sourceIndex: 0,
  });
  assert.equal(new Set(result.places.map((place) => place.country)).size, 225);
});

// 版本错位与无效国家下标必须在写库前失败，避免静默生成错误地理信息。
test('拒绝版本不一致和越界的国家索引', async () => {
  const [core, details] = await readColumnarResponses('files');
  assert.throws(() => normalizePlaces(core, { ...details, version: 'different' }), /version 不一致/);
  const invalid = {
    ...details,
    data: { ...details.data, countryIdx: [...details.data.countryIdx] },
  };
  invalid.data.countryIdx[0] = invalid.data.countries.length;
  assert.throws(() => normalizePlaces(core, invalid), /国家索引/);
});

// 重复执行只替换该归一化表，不触碰原始响应及地点频道关系。
test('归一化结果可原子重建且保留其他表', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE api_responses (marker TEXT); INSERT INTO api_responses VALUES (\'raw\');');
    const first = {
      version: 'v1',
      places: [{ id: 'one', title: 'One', country: 'A', longitude: 2, latitude: 1, size: 3, boost: 0, sourceIndex: 0 }],
    };
    assert.equal(saveNormalizedPlaces(db, first), 1);
    const second = {
      version: 'v2',
      places: [{ id: 'two', title: 'Two', country: 'B', longitude: 4, latitude: 3, size: 5, boost: 1, sourceIndex: 0 }],
    };
    assert.equal(saveNormalizedPlaces(db, second), 1);
    assert.deepEqual({ ...db.prepare('SELECT id, source_version FROM radio_garden_places').get() }, {
      id: 'two', source_version: 'v2',
    });
    assert.equal(db.prepare('SELECT marker FROM api_responses').get().marker, 'raw');
    const invalid = {
      version: 'v3',
      places: [second.places[0], { ...second.places[0], id: 'three' }],
    };
    assert.throws(() => saveNormalizedPlaces(db, invalid), /UNIQUE constraint failed/);
    assert.equal(db.prepare('SELECT id FROM radio_garden_places').get().id, 'two');
  } finally {
    db.close();
  }
});
