import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractChannels, runBatch } from '../src/crawler.mjs';

// 从地点频道接口识别频道 URL，去重并排除地点与“更多”入口。
test('频道列表能从不同 URL 字段提取并去重', () => {
  const payload = {
    data: {
      content: [
        {
          itemsType: 'channel',
          items: [
            { title: 'One', href: '/listen/one/Abc12345' },
            { title: 'One duplicate', url: '/listen/one/Abc12345' },
            { page: { type: 'channel', title: 'Two', url: '/listen/two/Zyx98765' } },
            { type: 'place', url: '/visit/nearby/Place001' },
            { type: 'more', url: '/visit/all/More0001' },
          ],
        },
      ],
    },
  };
  assert.deepEqual(extractChannels(payload, 'Place0001'), [
    { placeId: 'Place0001', channelId: 'Abc12345', title: 'One duplicate' },
    { placeId: 'Place0001', channelId: 'Zyx98765', title: 'Two' },
  ]);
});

// 有频道总数但响应结构未知时中止，避免把未支持格式误报成空列表。
test('未知的频道列表结构显式失败', () => {
  assert.throws(
    () =>
      extractChannels(
        { data: { count: 5, content: [{ items: [{ title: 'unknown' }] }] } },
        'Place0001',
      ),
    /未解析到频道 ID/,
  );
});

// 续跑会跳过成功项，记录失败项并继续处理其后的 ID。
test('批次续跑、继续执行并记录失败项', async () => {
  const failures = [];
  const saved = [];
  const result = await runBatch({
    endpoint: 'test',
    ids: ['already', 'ok', 'broken'],
    limit: 3,
    delayMs: 0,
    page: {},
    db: {},
    request: async (_page, id) => {
      if (id === 'broken') throw new Error('temporary');
      return { responseJson: '{}', httpStatus: 200 };
    },
    saveSuccess: async (_record, _relations, original) => {
      saved.push(original);
    },
    saveFailure: (failure) => failures.push(failure),
    isComplete: (_endpoint, id) => id === 'already',
    progress: async () => ({ counts: [] }),
  });
  assert.deepEqual(result, { completed: 1, skipped: 1, failed: 1 });
  assert.equal(saved.length, 1);
  assert.equal(failures[0].entityId, 'broken');
});
