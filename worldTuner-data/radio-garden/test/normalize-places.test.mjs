import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  normalizePlaces,
  readColumnarResponses,
  saveNormalizedPlaces,
} from '../src/normalize-places.mjs';

const core = {
  apiVersion: 1,
  version: 'v1',
  data: {
    version: 'v1',
    ids: ['Place001', 'Place002'],
    lngs: [37.6173, 13.405],
    lats: [55.755825, 52.52],
    sizes: [344, 120],
    boosts: [0, 1],
  },
};
const details = {
  apiVersion: 1,
  version: 'v1',
  data: {
    version: 'v1',
    titles: ['Moscow', 'Berlin'],
    countryIdx: [0, 1],
    countries: ['Russia', 'Germany'],
  },
};

// 原始 API 响应只从专用 SQLite 读取，并按相同列下标还原地点。
test('SQLite 中的 columnar 响应可还原地点和国家', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE api_responses (endpoint TEXT, entity_id TEXT, status TEXT, response_json TEXT)');
    const insert = db.prepare("INSERT INTO api_responses VALUES (?, 'all', 'success', ?)");
    insert.run('places-core-columnar', JSON.stringify(core));
    insert.run('places-details-columnar', JSON.stringify(details));
    const [storedCore, storedDetails] = readColumnarResponses(db);
    const result = normalizePlaces(storedCore, storedDetails);
    assert.deepEqual(result.places[0], {
      id: 'Place001',
      title: 'Moscow',
      country: 'Russia',
      longitude: 37.6173,
      latitude: 55.755825,
      size: 344,
      boost: 0,
      sourceIndex: 0,
    });
    assert.equal(result.places.length, 2);
  } finally {
    db.close();
  }
});

// 任一总览响应缺失时直接中止，避免用不完整的地点数据继续采集。
test('缺少地点总览响应时明确报错', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE api_responses (endpoint TEXT, entity_id TEXT, status TEXT, response_json TEXT)');
    assert.throws(() => readColumnarResponses(db), /缺少 places-core-columnar/);
  } finally {
    db.close();
  }
});

// 版本错位与越界国家下标必须在写库前失败。
test('拒绝版本不一致和越界国家索引', () => {
  assert.throws(() => normalizePlaces(core, { ...details, version: 'different' }), /version 不一致/);
  const invalid = {
    ...details,
    data: { ...details.data, countryIdx: [details.data.countries.length, 1] },
  };
  assert.throws(() => normalizePlaces(core, invalid), /国家索引/);
});

// 重复执行只替换地点表，异常时保留原有地点和其他表。
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
