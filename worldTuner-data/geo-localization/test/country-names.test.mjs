import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  buildCountryNames,
  fetchTerritories,
  saveCountryNames,
} from '../src/sync-country-names.mjs';

// 标准地区、Radio Garden 别名及无代码的地名应各自保留正确来源。
test('中文地区映射区分 CLDR 与手工名称', () => {
  const names = buildCountryNames(
    ['Germany', 'Hong Kong', 'Madeira'],
    { DE: 'Germany', HK: 'Hong Kong SAR China' },
    { DE: '德国', HK: '中国香港特别行政区', 'HK-alt-short': '香港' },
  );
  assert.deepEqual(names, [
    { nameEn: 'Germany', nameZh: '德国', regionCode: 'DE', source: 'cldr' },
    { nameEn: 'Hong Kong', nameZh: '香港', regionCode: 'HK', source: 'cldr' },
    { nameEn: 'Madeira', nameZh: '马德拉群岛', regionCode: null, source: 'manual' },
  ]);
});

// 未识别的名称不能被猜测翻译，也不能产生部分地区映射。
test('未知名称或缺失中文名称时失败', () => {
  assert.throws(() => buildCountryNames(['Unknown'], {}, {}), /无法唯一匹配/);
  assert.throws(() => buildCountryNames(['Germany'], { DE: 'Germany' }, {}), /缺少.*中文名称/);
});

// 用注入的请求验证 CLDR 响应结构，不在测试中访问网络。
test('CLDR 下载要求 territories 对象', async () => {
  const response = await fetchTerritories('zh', async () => ({
    main: { zh: { localeDisplayNames: { territories: { DE: '德国' } } } },
  }));
  assert.equal(response.DE, '德国');
  await assert.rejects(
    fetchTerritories('zh', async () => ({ main: { zh: {} } })),
    /缺少 territories/,
  );
});

// 本地化写入仅更换名称表，通过视图读取中文名且保留地点原文。
test('中文名称表和视图可重复更新', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE radio_garden_places (id TEXT PRIMARY KEY, title TEXT, country TEXT);
      INSERT INTO radio_garden_places VALUES ('one', 'Berlin', 'Germany');
    `);
    saveCountryNames(db, [
      { nameEn: 'Germany', nameZh: '德国', regionCode: 'DE', source: 'cldr' },
    ]);
    assert.deepEqual(
      { ...db.prepare('SELECT title, country, country_zh FROM radio_garden_places_zh').get() },
      { title: 'Berlin', country: 'Germany', country_zh: '德国' },
    );
    saveCountryNames(db, [
      { nameEn: 'Germany', nameZh: '德意志', regionCode: 'DE', source: 'manual' },
    ]);
    assert.equal(db.prepare('SELECT name_zh FROM radio_garden_country_names').get().name_zh, '德意志');
    assert.equal(db.prepare('SELECT country FROM radio_garden_places').get().country, 'Germany');
  } finally {
    db.close();
  }
});
