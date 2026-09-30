import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeTag, proposeTag } from '../processing/report-tags.mjs';

const rules = JSON.parse(
  readFileSync(new URL('../processing/tag-cleaning-rules.json', import.meta.url), 'utf8'),
);
const translations = JSON.parse(
  readFileSync(new URL('../processing/tag-names.zh-CN.json', import.meta.url), 'utf8'),
);
const aliases = new Map();
for (const [target, names] of Object.entries(rules.aliases)) {
  for (const name of names) aliases.set(normalizeTag(name), target);
}

// 所有标准类别必须有中文且别名指向唯一类别，避免导入与清洗互相覆盖含义。
test('词典中的中文与别名映射完整且无冲突', () => {
  const seen = new Map();
  assert.equal(new Set(rules.keep).size, rules.keep.length);
  for (const key of rules.keep) {
    assert.ok(translations[key]?.trim(), `${key} 缺少中文`);
    assert.ok(!rules.ignore.includes(key), `${key} 同时被保留和删除`);
  }
  for (const [target, names] of Object.entries(rules.aliases)) {
    assert.ok(rules.keep.includes(target));
    for (const name of names) {
      const key = normalizeTag(name);
      assert.ok(!seen.has(key) || seen.get(key) === target, `${key} 别名冲突`);
      assert.ok(!rules.keep.includes(key) || key === target, `${key} 同时是其他标准名`);
      seen.set(key, target);
    }
  }
});

// 格式变体只能映射到完整的已知风格；未知部分和语义模糊项保留供下一轮处理。
test('多语言和拼写变体归并且保留模糊标签', () => {
  for (const [name, target] of [
    ['progressive-rock', 'progressive rock'],
    ['blackmetal', 'black metal'],
    ['music country', 'country'],
    ['música variada', 'eclectic'],
    ['rock music', 'rock'],
    ['джаз', 'jazz'],
    ["1980's", '80s'],
    ['top 40 hits', 'top 40'],
  ]) {
    assert.equal(proposeTag(name, rules, aliases).target, target);
  }
  for (const name of [
    'classic',
    'regional',
    'latin',
    'bach',
    'french house',
    'rock / unknown style',
  ]) {
    assert.equal(proposeTag(name, rules, aliases).action, 'review', name);
  }
  assert.equal(proposeTag('mexican music', rules, aliases).action, 'keep');
  assert.equal(proposeTag('country', rules, aliases).action, 'keep');
});

// 只删除完整的频率、语种或网址，不因内容中出现单位、语言词或 URL 就删除整段。
test('技术与语言噪声按完整标签识别', () => {
  for (const name of [
    '99.3 fm',
    'am1557',
    '128 kbps',
    '国语',
    'https://example.com/live',
    'méxico',
  ]) {
    assert.equal(proposeTag(name, rules, aliases).action, 'ignore', name);
  }
  for (const name of ['rock 99.3 fm', 'https://example.com jazz station', 'english folk unknown']) {
    assert.equal(proposeTag(name, rules, aliases).action, 'review', name);
  }
});
