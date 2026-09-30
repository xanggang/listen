import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStationFeatures } from '../src/lib/map-stations.ts';

// 全量元组一次获取，前导零 ID、中文名称及同坐标的不同电台保持原样。
test('地图一次加载全量元组并启用浏览器缓存', async () => {
  const ids = ['0363513228099059713', '0363513228099059714'];
  let calls = 0;
  const result = await loadStationFeatures(
    new AbortController().signal,
    undefined,
    // 校验新的同源地址和 HTTP 缓存模式。
    async (input, options) => {
      calls++;
      assert.equal(input, '/api/map/snapshot');
      assert.equal(options.cache, 'default');
      return Response.json({
        data: {
          count: 2,
          points: ids.map(
            // 相同坐标保留两个独立 ID，不能进行点位聚合。
            (id) => [id, '电台', -87.90647, 43.0389],
          ),
        },
      });
    },
  );
  assert.equal(calls, 1);
  assert.deepEqual(
    result.features.map(
      // ID 不经过 Number 转换。
      (feature) => feature.properties.id,
    ),
    ids,
  );
  assert.deepEqual(result.features[0].geometry.coordinates, [-87.90647, 43.0389]);
});

// 格式错误或 HTTP 错误不应在地图展示为成功加载的空数据。
test('坏元组、错误计数和 HTTP 失败中止加载', async () => {
  for (const data of [
    { count: 1, points: [] },
    { count: 1, points: [['0363513228099059713', 'Bad', 120, 100]] },
  ]) {
    await assert.rejects(
      loadStationFeatures(
        new AbortController().signal,
        undefined,
        // 模拟不满足快照契约的数据。
        async () => Response.json({ data }),
      ),
      /Invalid map/,
    );
  }
  await assert.rejects(
    loadStationFeatures(
      new AbortController().signal,
      undefined,
      // 暂时不可用应交给界面重试。
      async () => new Response(null, { status: 503 }),
    ),
    /Map API unavailable/,
  );
});
