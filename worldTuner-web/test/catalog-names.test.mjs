import assert from 'node:assert/strict';
import test from 'node:test';
import {
  catalogDisplayName,
  catalogMatches,
  stationLanguageLabel,
} from '../src/lib/catalog-names.ts';

// 验证展示兜底和跨语言搜索，名称转换不修改筛选 ID 或原名。
test('catalog names localize without changing identity and match all names', () => {
  const item = { id: '123', name: '原始', name_en: ' Rock ', name_zh: ' 摇滚 ' };
  assert.equal(catalogDisplayName(item, 'zh-CN'), '摇滚');
  assert.equal(catalogDisplayName(item, 'en'), 'Rock');
  assert.equal(catalogDisplayName({ ...item, name_zh: ' ' }, 'zh'), 'Rock');
  assert.equal(catalogDisplayName({ name: 'Legacy' }, 'zh'), 'Legacy');
  for (const query of ['原始', 'ROCK', '摇滚', '']) assert.equal(catalogMatches(item, query), true);
  assert.equal(catalogMatches(item, 'jazz'), false);
  assert.equal(item.id, '123');
  assert.equal(item.name, '原始');
});

// 验证旧收藏回退及缺失语种时省略展示。
test('station languages support translated and legacy saved records', () => {
  assert.equal(
    stationLanguageLabel({ language: 'original', languageEn: 'English', languageZh: '英语' }, 'zh'),
    '英语',
  );
  assert.equal(
    stationLanguageLabel({ language: 'original', languageEn: 'English', languageZh: ' ' }, 'zh'),
    'English',
  );
  assert.equal(stationLanguageLabel({ language: 'legacy' }, 'en'), 'legacy');
  assert.equal(stationLanguageLabel({ language: null }, 'zh'), null);
});
