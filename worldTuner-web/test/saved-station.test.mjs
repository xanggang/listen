import assert from 'node:assert/strict';
import test from 'node:test';
import { readSavedStations, toPlayableStation } from '../src/lib/saved-station.ts';

const station = {
  id: 7,
  name: '  Radio Seven  ',
  url: 'https://example.com/live',
  urlResolved: '',
  favicon: 'https://example.com/icon.png',
  country: 'France',
  language: 'French',
  votes: 12,
};

test('只保留本地播放所需字段并清理文字',
  // 电台快照不应把 API 的额外字段写入浏览器收藏。
  () => {
    const saved = toPlayableStation({ ...station, secret: 'not saved' });
    assert.equal(saved?.name, 'Radio Seven');
    assert.equal(saved?.url, station.url);
    assert.equal(saved && 'secret' in saved, false);
  },
);

test('忽略坏协议、无效 id 和损坏的单条记录',
  // 单条坏数据不能使整个收藏或历史列表丢失。
  () => {
    assert.equal(toPlayableStation({ ...station, id: 0 }), null);
    assert.equal(toPlayableStation({ ...station, url: 'javascript:alert(1)' }), null);
    const restored = readSavedStations([null, station, { ...station, id: 0 }], 30);
    assert.deepEqual(restored.map((item) => item.id), [7]);
  },
);

test('恢复时按 id 去重并遵守长度上限',
  // 多次播放同一台只应占用一条历史记录。
  () => {
    const restored = readSavedStations([
      station,
      { ...station, name: 'Duplicate' },
      { ...station, id: 8 },
    ], 1);
    assert.deepEqual(restored.map((item) => item.id), [7]);
  },
);
