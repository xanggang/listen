import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPlaceCatalogs } from '../src/fetch-places.mjs';

// 两份地点响应按顺序通过 API 获取，成功后各自写入采集台账。
test('地点总览采集使用 API 并保存两份原始响应', async () => {
  const requested = [];
  const saved = [];
  const completed = await fetchPlaceCatalogs({}, {
    request: async (path) => {
      requested.push(path);
      return { httpStatus: 200, contentType: 'application/json', responseJson: '{"data":{}}' };
    },
    save: async (_db, record) => {
      saved.push(record);
    },
    onFailure: async () => {
      throw new Error('不应记录失败');
    },
    sleep: async () => {},
  });
  assert.deepEqual(completed, ['places-core-columnar', 'places-details-columnar']);
  assert.deepEqual(requested, [
    'places-core-columnar?s=1&hl=zh-Hans',
    'places-details-columnar?s=1&hl=zh-Hans',
  ]);
  assert.deepEqual(saved.map((record) => record.endpoint), completed);
  assert.ok(saved.every((record) => record.entityId === 'all'));
});

// 第二份响应失败时保留已保存的第一份，并记录诊断后中止。
test('地点总览失败会记录错误且不会伪装为成功', async () => {
  const saved = [];
  const failures = [];
  await assert.rejects(
    fetchPlaceCatalogs({}, {
      request: async (path) => {
        if (path.startsWith('places-details-columnar')) throw new Error('API unavailable');
        return { httpStatus: 200, contentType: 'application/json', responseJson: '{"data":{}}' };
      },
      save: async (_db, record) => {
        saved.push(record);
      },
      onFailure: async (record) => {
        failures.push(record);
      },
      sleep: async () => {},
    }),
    /API unavailable/,
  );
  assert.equal(saved.length, 1);
  assert.equal(failures[0].endpoint, 'places-details-columnar');
});
