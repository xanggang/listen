import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { DatabaseSync } from 'node:sqlite';

const defaultDb = fileURLToPath(new URL('../../v2/data/worldtuner-v2.sqlite', import.meta.url));
const defaultOutput = fileURLToPath(new URL('../../v2/docs/标签清洗报告', import.meta.url));
const rulesPath = new URL('./tag-cleaning-rules.json', import.meta.url);
const translationsPath = new URL('./tag-names.zh-CN.json', import.meta.url);

/**
 * 生成保守的标签比较文本，不删除重音符号或标点，避免合并不同含义。
 * @param {string} value 原始标签。
 * @returns {string} NFKC、去首尾空白、小写并折叠连续空白后的文本。
 */
export function normalizeTag(value) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
}

/**
 * 精确识别纯语言名及纯符号/表情；只输出忽略建议，不修改语种关系。
 * 含语言词的音乐风格和品牌名称不按子串匹配，避免误删 french house 等有内容含义的标签。
 * @param {string} key 已归一化的完整标签。
 * @param {string[]} languages 已明确列出的语言名称。
 * @returns {string | null} 忽略原因，混合文本和未知语言名返回 null。
 */
function nonContentReason(key, languages) {
  if (languages.includes(key))
    return '语言信息：完整标签为语言名称，建议从标签分类中移除；不据此补写语种。';
  if (!/[\p{L}\p{N}]/u.test(key)) return '装饰信息：纯表情或符号，不用于内容分类。';
  if (
    /^(?:[:;=8x][-^']?[)(/\\dpоo]|[oಠt][_.-][oಠt])$/iu.test(key) ||
    ['¯\\_(ツ)_/¯', '(≧▽≦)', '(◕‿◕)'].includes(key)
  ) {
    return '装饰信息：颜文字，不用于内容分类。';
  }
  return null;
}

/**
 * 识别整项都是频率、码率或音频格式的标签，供报告建议忽略；不从标签反推播放流字段。
 * 无单位小数仅在草案设定的 FM 范围内视为频率，整数与年代词保持待审或原有分类。
 * 混有音乐风格、地名或介绍的文本不整项删除，避免丢失内容标签。
 * @param {string} key 已归一化的标签文本。
 * @param {{bareFmMin: number, bareFmMax: number, formats: string[]}} rules 技术标签草案。
 * @returns {string | null} 明确匹配的原因；没有匹配则返回 null。
 */
function technicalReason(key, rules) {
  if (
    /^\d{2,3}\.\d{1,2}$/u.test(key) &&
    Number(key) >= rules.bareFmMin &&
    Number(key) <= rules.bareFmMax
  ) {
    return '技术信息：疑似 FM 频率，不用于内容分类。';
  }
  if (/^(?:(?:fm|am)\s*)?\d+(?:[.,]\d+)?\s*(?:mhz|khz)(?:\s*(?:fm|am))?$/u.test(key)) {
    return '技术信息：带单位的播出频率，不用于内容分类。';
  }
  if (/^(?:(?:fm|am)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:fm|am))$/u.test(key)) {
    return '技术信息：完整标签为 FM/AM 频率，不用于内容分类。';
  }
  if (/^\d+\s*(?:kbps|kbit(?:\/s)?|kb\/s)(?:\s*(?:aac\+?|mp3|flac|ogg|opus))?$/u.test(key)) {
    return '技术信息：音频码率，不用于内容分类。';
  }
  if (rules.formats.includes(key) || /^\d+\s+(?:aac\+?|mp3|flac|ogg|opus)$/u.test(key)) {
    return '技术信息：音频格式或音质描述，不用于内容分类。';
  }
  return null;
}

/**
 * 根据精确词典提出标签动作；已知风格的拼写变体可归并，未知混合文本保留。
 * @param {string} name 原标签文本。
 * @param {object} rules 明确的保留、别名、忽略和待审规则。
 * @param {Map<string, string>} aliases 别名到标准标签的映射。
 * @returns {{action: string, target: string | null, reason: string}} 清洗与导入共用的分类结果。
 */
export function proposeTag(name, rules, aliases) {
  const key = normalizeTag(name);
  if (aliases.has(key))
    return { action: 'merge', target: aliases.get(key), reason: '已确认的精确别名或同义写法。' };
  if (rules.ignore.includes(key))
    return { action: 'ignore', target: null, reason: '泛化词或传输方式，对内容分类帮助较小。' };
  const nonContent = nonContentReason(key, rules.languages);
  if (nonContent) return { action: 'ignore', target: null, reason: nonContent };
  if (rules.review[key]) return { action: 'review', target: null, reason: rules.review[key] };
  if (rules.keep.includes(key))
    return { action: 'keep', target: key, reason: '已列入标准标签候选，保留细分含义。' };
  // 仅在候选唯一时归并空格、连字符及 music 前后缀；不拆分未知词组或多风格标签。
  const style = key.replace(/^(?:music|música|musica)\s+|\s+music$/gu, '');
  const compact = style.replace(/[\s-]/gu, '');
  const candidates = [];
  for (const target of rules.keep) {
    if (target.replace(/[\s-]/gu, '') === compact) candidates.push(target);
  }
  if (candidates.length === 1)
    return {
      action: 'merge',
      target: candidates[0],
      reason: '唯一已知风格的空格、连字符或 music 前后缀变体。',
    };
  const technical = technicalReason(key, rules.technical);
  if (technical) return { action: 'ignore', target: null, reason: technical };
  if (/^(?:https?:\/\/|www\.)\S+$/iu.test(key))
    return { action: 'ignore', target: null, reason: '完整标签为网址，属于链接信息。' };
  if (/https?:\/\/|www\./iu.test(name))
    return {
      action: 'review',
      target: null,
      reason: '含网址，疑似误填或宣传文本，建议核查后移除。',
    };
  if (name.length > 80)
    return {
      action: 'review',
      target: null,
      reason: '超过 80 字符，疑似说明文字；不按长度直接删除。',
    };
  if (/\b(\S+)(?:\s+\1){3,}/iu.test(name))
    return { action: 'review', target: null, reason: '连续重复内容，疑似噪声。' };
  return { action: 'review', target: null, reason: '尚未建立规则；低频不等于无效，不自动删除。' };
}

/** 转义 Markdown 表格中的用户标签，避免换行或竖线破坏报告。 */
function cell(value) {
  return String(value ?? '—')
    .replaceAll('|', '\\|')
    .replace(/[\r\n]+/gu, ' ');
}

/** 将标签建议整理成可阅读的 Markdown 表格；名称最多显示 120 字符。 */
function table(rows) {
  const lines = [
    '| 原标签 | 电台数 | 建议 | 标准标签 | 原因 |',
    '| --- | ---: | --- | --- | --- |',
  ];
  const labels = { keep: '保留', merge: '合并', ignore: '忽略', review: '待审' };
  for (const row of rows) {
    lines.push(
      `| ${cell(row.name.slice(0, 120))} | ${row.stationCount} | ${labels[row.action]} | ${cell(row.target)} | ${cell(row.reason)} |`,
    );
  }
  return lines.join('\n');
}

/**
 * 只读分析 V2 标签与关联，输出完整 JSON 和高频/异常 Markdown；不修改数据库。
 * @param {string} dbPath 本地 V2 SQLite 路径。
 * @param {string} outputPath 报告目录；同名报告会更新。
 * @returns {object} 标签、关联和建议数量统计。
 */
export function reportTags(dbPath = defaultDb, outputPath = defaultOutput) {
  const rules = JSON.parse(readFileSync(rulesPath, 'utf8'));
  const translations = JSON.parse(readFileSync(translationsPath, 'utf8'));
  const aliases = new Map();
  for (const [target, names] of Object.entries(rules.aliases)) {
    for (const name of names) aliases.set(normalizeTag(name), target);
  }
  const db = new DatabaseSync(resolve(dbPath), { readOnly: true });
  try {
    db.exec('BEGIN');
    const rows = db
      .prepare(
        `SELECT t.id, t.name, count(st.station_id) AS stationCount
      FROM tag t LEFT JOIN station_tag st ON st.tag_id = t.id
      GROUP BY t.id ORDER BY stationCount DESC, t.name, t.id`,
      )
      .all();
    const byId = new Map();
    const canonicalTags = new Map();
    for (const row of rows) {
      Object.assign(row, proposeTag(row.name, rules, aliases), { examples: [] });
      row.nameZh = row.target ? (translations[row.target] ?? null) : null;
      if (row.target) {
        if (!row.nameZh) throw new Error(`标准标签 ${row.target} 缺少中文名称。`);
        const canonical = canonicalTags.get(row.target) ?? {
          key: row.target,
          nameZh: row.nameZh,
          originalNames: [],
          stations: new Set(),
        };
        canonical.originalNames.push(row.name);
        canonicalTags.set(row.target, canonical);
      }
      byId.set(row.id, row);
    }
    const affected = { keep: new Set(), merge: new Set(), ignore: new Set(), review: new Set() };
    const projectedLinks = new Set();
    for (const link of db
      .prepare(
        `SELECT st.tag_id, s.id, s.name FROM station_tag st
      JOIN station s ON s.id = st.station_id ORDER BY st.tag_id, s.id`,
      )
      .iterate()) {
      const tag = byId.get(link.tag_id);
      if (tag.target) canonicalTags.get(tag.target).stations.add(link.id);
      affected[tag.action].add(link.id);
      if (tag.examples.length < 2) tag.examples.push({ stationId: link.id, name: link.name });
      // 待审项暂时保留；合并项按目标名称去掉重复关联，只模拟不写入。
      if (tag.action !== 'ignore')
        projectedLinks.add(`${link.id}\0${tag.target ?? normalizeTag(tag.name)}`);
    }
    const summary = {
      tags: rows.length,
      stationTags: 0,
      singleStationTags: 0,
      actions: {},
      projectedStationTags: projectedLinks.size,
      generatedAt: new Date().toISOString(),
    };
    for (const action of Object.keys(affected)) {
      summary.actions[action] = {
        tags: 0,
        associations: 0,
        distinctStations: affected[action].size,
      };
    }
    for (const row of rows) {
      summary.stationTags += row.stationCount;
      if (row.stationCount === 1) summary.singleStationTags++;
      summary.actions[row.action].tags++;
      summary.actions[row.action].associations += row.stationCount;
    }
    db.exec('COMMIT');
    const output = resolve(outputPath);
    mkdirSync(output, { recursive: true });
    writeFileSync(
      `${output}/全部标签建议.json`,
      JSON.stringify({ summary, rulesStatus: rules.status, tags: rows }, null, 2) + '\n',
    );
    const bilingual = [];
    for (const tag of canonicalTags.values()) {
      bilingual.push({
        key: tag.key,
        nameZh: tag.nameZh,
        stationCount: tag.stations.size,
        originalNames: tag.originalNames,
      });
    }
    // 按合并后的电台覆盖量排序，数量相同时按稳定英文键排序。
    bilingual.sort((a, b) => b.stationCount - a.stationCount || a.key.localeCompare(b.key));
    writeFileSync(`${output}/标准标签中英对照.json`, JSON.stringify(bilingual, null, 2) + '\n');
    const bilingualLines = [
      '# 标准标签中英对照',
      '',
      `当前保留和合并规则形成 ${bilingual.length} 个标准标签。本表按当前数据库模拟标签归并，生成报告不会写入数据库。`,
      '',
      '英文键用于规则匹配，中文名用于展示；关联电台数按原标签及其别名合并后去重计算。未确定含义的待审标签暂不翻译。少见地方音乐采用音译，并保留英文键供核查。',
      '',
      '| 英文键 | 中文名 | 合并后电台数 | 来源写法 |',
      '| --- | --- | ---: | --- |',
    ];
    for (const tag of bilingual) {
      bilingualLines.push(
        `| ${cell(tag.key)} | ${cell(tag.nameZh)} | ${tag.stationCount} | ${cell(tag.originalNames.join('、'))} |`,
      );
    }
    writeFileSync(`${output}/标准标签中英对照.md`, bilingualLines.join('\n') + '\n');
    const totals = [];
    for (const [action, value] of Object.entries(summary.actions)) {
      totals.push(
        `| ${action} | ${value.tags} | ${value.associations} | ${value.distinctStations} |`,
      );
    }
    const merges = [];
    const ignores = [];
    const anomalies = [];
    for (const row of rows) {
      if (row.action === 'merge') merges.push(row);
      if (row.action === 'ignore') ignores.push(row);
      if (/https?:\/\/|www\./iu.test(row.name) || row.name.length > 80) anomalies.push(row);
    }
    const markdown = `# 标签清洗建议报告\n\n生成时间：${summary.generatedAt}\n\n本报告只读分析当前数据库，生成报告不会写入业务数据。数据源：\`${resolve(dbPath)}\`。\n\n现有 ${summary.tags} 个标签、${summary.stationTags} 条电台标签关联；其中 ${summary.singleStationTags} 个标签只关联一台电台。各动作覆盖的电台会重叠，不能相加。\n\n| 建议动作 | 标签数 | 关联数 | 涉及电台数 |\n| --- | ---: | ---: | ---: |\n${totals.join('\n')}\n\n若只应用明确的合并和忽略候选、保留全部待审标签，预计剩余 ${summary.projectedStationTags} 条关联；这只是模拟值。\n\n## 规则边界\n\n- 只做 NFKC、去空白与小写比较，不全局删除重音符号或标点。\n- 音乐风格、节目类型与年代可以保留；细分风格不归并到父类。\n- country 是乡村音乐；classic、latin、地域音乐等需要区别含义。\n- 不按频次删除，不按空格或斜杠自动拆分，不从标签直接补写国家和语种。\n- merge/ignore 使用明确规则；未知标签保留原始含义，后续可继续扩充规则。\n- 完整 JSON 保留原标签 ID、建议、原因和两条电台样例。\n\n## 高频前 150 个标签\n\n${table(rows.slice(0, 150))}\n\n## 所有明确别名候选\n\n${table(merges)}\n\n## 所有忽略候选\n\n${table(ignores)}\n\n## 异常文本样例（前 60 个）\n\n${table(anomalies.slice(0, 60))}\n`;
    writeFileSync(`${output}/标签清洗建议.md`, markdown);
    return summary;
  } finally {
    db.close();
  }
}

/** 解析本地输入输出路径，打印只读报告统计。 */
function main() {
  const { values } = parseArgs({ options: { db: { type: 'string' }, output: { type: 'string' } } });
  console.log(JSON.stringify(reportTags(values.db, values.output), null, 2));
}

// 作为模块载入时不生成报告。
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
