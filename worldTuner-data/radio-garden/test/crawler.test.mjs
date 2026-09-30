import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { extractChannels, readPlaceIds, runBatch } from '../src/crawler.mjs';

// 频道采集直接从已整理的地点表读取 ID，并按来源下标保持顺序。
test('地点 ID 来自归一化后的 SQLite', () => {
  const db = new DatabaseSync(':memory:');
  try {
    assert.throws(() => readPlaceIds(db), /缺少地点表/);
    db.exec('CREATE TABLE radio_garden_places (id TEXT PRIMARY KEY, source_index INTEGER NOT NULL)');
    assert.throws(() => readPlaceIds(db), /地点表为空/);
    db.exec("INSERT INTO radio_garden_places VALUES ('second', 1), ('first', 0)");
    assert.deepEqual(readPlaceIds(db), ['first', 'second']);
  } finally {
    db.close();
  }
});

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
    db: {},
    request: async (id) => {
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
