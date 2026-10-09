import { ensureCatalogNames } from '../../v2/src/catalog-names.mjs';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { backupTags } from './clean-tags.mjs';
import { normalizeTag } from './report-tags.mjs';
import { createSnowflakeIdGenerator } from '../../v2/src/snowflake-id.mjs';

const defaultDb = fileURLToPath(new URL('../../v2/data/worldtuner-v2.sqlite', import.meta.url));
const defaultDirectory = fileURLToPath(
  new URL('../../v2/docs/标签清洗报告/AI处理包/', import.meta.url),
);

/**
 * 读取逐行 JSON；忽略空行，解析失败时报告行号，不接受空文件。
 */
export function readJsonLines(path) {
  const rows = [];
  for (const [index, line] of readFileSync(path, 'utf8').split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      throw new Error(`${path} 第 ${index + 1} 行不是合法 JSON。`);
    }
  }
  if (!rows.length) throw new Error('输入文件为空。');
  return rows;
}

/**
 * 校验结果与输入及当前快照逐项一致，递归展开连续映射，拒绝循环与译名冲突。
 * 未列入本轮输入的标签保持原记录；拆分目标分配不同 ID，优先沿用准确标准名的旧 ID。
 * @param {object[]} tags 当前数据库标签快照。
 * @param {object[]} input AI 处理前的原始输入。
 * @param {object[]} results AI 输出，要求每个输入 ID 恰好一条。
 * @returns {{tags: object[], mapping: object[]}} 全量标签计划和一对多关联映射。
 */
export function planAiTags(tags, input, results) {
  const current = new Map();
  for (const tag of tags) current.set(tag.id, tag);
  const expected = new Map();
  for (const row of input) {
    if (typeof row.id !== 'string' || expected.has(row.id))
      throw new Error('输入 ID 非字符串或重复。');
    if (current.get(row.id)?.name !== row.name) throw new Error(`输入与当前数据库不同：${row.id}`);
    expected.set(row.id, row.name);
  }
  if (results.length !== input.length) throw new Error('输出数量与输入不同。');
  const byId = new Map();
  const byName = new Map();
  for (const row of results) {
    if (typeof row.id !== 'string' || !expected.has(row.id) || byId.has(row.id))
      throw new Error('输出 ID 缺失、未知或重复。');
    if (row.original_name !== expected.get(row.id)) throw new Error(`原名不一致：${row.id}`);
    if (
      !['keep', 'merge', 'drop', 'split'].includes(row.action) ||
      !['high', 'medium', 'low'].includes(row.confidence)
    )
      throw new Error(`动作或置信度无效：${row.id}`);
    if (typeof row.reason !== 'string' || !row.reason.trim() || !Array.isArray(row.targets))
      throw new Error(`缺少原因或目标：${row.id}`);
    const n = row.targets.length;
    if (
      (row.action === 'drop' && n !== 0) ||
      (row.action === 'split' && n < 2) ||
      (['keep', 'merge'].includes(row.action) && n !== 1)
    )
      throw new Error(`目标数量无效：${row.id}`);
    const names = new Set();
    for (const target of row.targets) {
      if (
        typeof target.name !== 'string' ||
        !normalizeTag(target.name) ||
        (target.name_zh !== null && (typeof target.name_zh !== 'string' || !target.name_zh.trim()))
      )
        throw new Error(`目标名称或中文无效：${row.id}`);
      const name = normalizeTag(target.name);
      if (names.has(name)) throw new Error(`目标重复：${row.id}`);
      names.add(name);
    }
    const name = normalizeTag(row.original_name);
    if (byName.has(name)) throw new Error(`原名归一化冲突：${name}`);
    byId.set(row.id, row);
    byName.set(name, row);
  }
  const groups = new Map();
  const mapping = [];
  // 递归展开中间分类；自指向单目标是保留项，其他环路或指向删除项拒绝执行。
  function terminalTargets(target, visiting = new Set()) {
    const name = normalizeTag(target.name);
    const next = byName.get(name);
    if (!next || (next.targets.length === 1 && normalizeTag(next.targets[0].name) === name))
      return [{ name, name_zh: target.name_zh }];
    if (visiting.has(name)) throw new Error(`发现映射循环：${name}`);
    if (next.action === 'drop') throw new Error(`目标同时被删除：${name}`);
    const path = new Set(visiting);
    path.add(name);
    const targets = [];
    for (const item of next.targets) targets.push(...terminalTargets(item, path));
    return targets;
  }
  for (const tag of tags) {
    const result = byId.get(tag.id);
    const targets = result ? result.targets : [{ name: tag.name, name_zh: tag.name_zh }];
    const resolved = new Map();
    for (const target of targets) {
      for (const item of terminalTargets(target)) {
        const existing = resolved.get(item.name);
        if (existing?.name_zh && item.name_zh && existing.name_zh !== item.name_zh)
          throw new Error(`中文冲突：${item.name}`);
        resolved.set(item.name, { ...item, name_zh: item.name_zh ?? existing?.name_zh ?? null });
      }
    }
    const item = {
      oldId: tag.id,
      oldName: tag.name,
      action: result?.action ?? 'unchanged',
      confidence: result?.confidence ?? null,
      reason: result?.reason ?? '本轮输入外的原有标准标签保持。',
      targets: [],
    };
    mapping.push(item);
    for (const target of resolved.values()) {
      const group = groups.get(target.name) ?? {
        name: target.name,
        name_zh: null,
        entries: [],
        id: null,
      };
      if (group.name_zh && target.name_zh && group.name_zh !== target.name_zh)
        throw new Error(`同一目标的中文冲突：${target.name}`);
      group.name_zh ??= target.name_zh;
      group.entries.push({ tag, item });
      groups.set(target.name, group);
    }
  }
  const used = new Set();
  // 第一遍预留标准名准确匹配的 ID，避免它被其他合并组提前占用。
  for (const group of groups.values()) {
    const exact = group.entries.find((entry) => normalizeTag(entry.tag.name) === group.name);
    if (exact && !used.has(exact.tag.id)) {
      group.id = exact.tag.id;
      used.add(group.id);
    }
  }
  const generateId = createSnowflakeIdGenerator({ workerId: 5 });
  const cleaned = [];
  for (const group of groups.values()) {
    if (!group.id) {
      const available = group.entries.find((entry) => !used.has(entry.tag.id));
      if (available) group.id = available.tag.id;
      else {
        do {
          group.id = generateId();
        } while (used.has(group.id) || current.has(group.id));
      }
      used.add(group.id);
    }
    cleaned.push({
      id: group.id,
      name: group.name,
      normalized_name: group.name,
      name_zh: group.name_zh,
      name_en:
        group.entries.find(
          // 标准名称未变化时保留已校订英文；拆分或新目标按新名称初始化。
          (entry) => normalizeTag(entry.tag.name) === group.name && entry.tag.name_en?.trim(),
        )?.tag.name_en ?? group.name,
    });
    for (const entry of group.entries)
      entry.item.targets.push({ id: group.id, name: group.name, name_zh: group.name_zh });
  }
  return { tags: cleaned, mapping };
}

/**
 * 预览或备份后原子导入 AI 结果，按一对多映射重建全部关联；失败时整体回滚。
 * @param {{dbPath?: string, inputPath?: string, resultPath?: string, apply?: boolean, backupPath?: string}} options 本地路径与写入开关。
 * @returns {object} 数量、备份路径和校验结论；预览只使用临时表，不修改业务数据。
 */
export function applyAiTags(options = {}) {
  const file = resolve(options.dbPath ?? defaultDb);
  const inputPath = resolve(options.inputPath ?? join(defaultDirectory, '全部剩余标签.jsonl'));
  const resultPath = resolve(options.resultPath ?? join(defaultDirectory, '全部处理结果.jsonl'));
  const input = readJsonLines(inputPath);
  const results = readJsonLines(resultPath);
  const db = new DatabaseSync(file, { readOnly: !options.apply });
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    db.exec(options.apply ? 'BEGIN IMMEDIATE' : 'BEGIN');
    const originalTags = db.prepare('SELECT * FROM tag ORDER BY id').all();
    const before = {
      tags: originalTags.length,
      stationTags: db.prepare('SELECT count(*) n FROM station_tag').get().n,
    };
    const plan = planAiTags(originalTags, input, results);
    db.exec(`CREATE TEMP TABLE ai_mapping (old_id TEXT, target_id TEXT, PRIMARY KEY(old_id,target_id));
      CREATE TEMP TABLE ai_tags (id TEXT PRIMARY KEY, name TEXT, normalized_name TEXT, name_zh TEXT, name_en TEXT);
      CREATE TEMP TABLE ai_links (station_id TEXT, tag_id TEXT, PRIMARY KEY(station_id,tag_id));`);
    const insertTag = db.prepare('INSERT INTO ai_tags VALUES (?,?,?,?,?)');
    for (const tag of plan.tags)
      insertTag.run(tag.id, tag.name, tag.normalized_name, tag.name_zh, tag.name_en);
    const insertMap = db.prepare('INSERT INTO ai_mapping VALUES (?,?)');
    for (const item of plan.mapping)
      for (const target of item.targets) insertMap.run(item.oldId, target.id);
    db.exec(
      'INSERT OR IGNORE INTO ai_links SELECT s.station_id,m.target_id FROM station_tag s JOIN ai_mapping m ON s.tag_id=m.old_id',
    );
    const after = {
      tags: plan.tags.length,
      stationTags: db.prepare('SELECT count(*) n FROM ai_links').get().n,
      translatedTags: db.prepare('SELECT count(*) n FROM ai_tags WHERE name_zh IS NOT NULL').get()
        .n,
    };
    const summary = {
      applied: Boolean(options.apply),
      before,
      after,
      inputCount: input.length,
      actions: {},
      backupPath: null,
      verified: false,
    };
    for (const row of results) summary.actions[row.action] = (summary.actions[row.action] ?? 0) + 1;
    if (options.apply) {
      const backupPath =
        options.backupPath ??
        join(
          dirname(file),
          `worldtuner-v2-ai-tags-${new Date().toISOString().replaceAll(':', '-')}.sqlite`,
        );
      summary.backupPath = backupTags(db, backupPath, {
        operation: 'ai-tags',
        source: file,
        inputPath,
        resultPath,
        createdAt: new Date().toISOString(),
        before,
        after,
        results,
        mapping: plan.mapping,
      });
      ensureCatalogNames(db, ['tag']);
      db.exec(
        'DELETE FROM station_tag; DELETE FROM tag; INSERT INTO tag (id,name,normalized_name,name_zh,name_en) SELECT id,name,normalized_name,name_zh,name_en FROM ai_tags; INSERT INTO station_tag SELECT * FROM ai_links;',
      );
      const difference = db
        .prepare(
          `SELECT
        (SELECT count(*) FROM (SELECT id,name,normalized_name,name_zh,name_en FROM tag EXCEPT SELECT id,name,normalized_name,name_zh,name_en FROM ai_tags)) +
        (SELECT count(*) FROM (SELECT id,name,normalized_name,name_zh,name_en FROM ai_tags EXCEPT SELECT id,name,normalized_name,name_zh,name_en FROM tag)) +
        (SELECT count(*) FROM (SELECT * FROM station_tag EXCEPT SELECT * FROM ai_links)) +
        (SELECT count(*) FROM (SELECT * FROM ai_links EXCEPT SELECT * FROM station_tag)) n`,
        )
        .get().n;
      if (
        difference ||
        db.prepare('PRAGMA foreign_key_check').all().length ||
        db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok'
      )
        throw new Error('写回校验失败，事务已回滚。');
      summary.verified = true;
    }
    db.exec('COMMIT');
    return summary;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

/**
 * 解析预览或写回选项；仅直接执行模块时运行。
 */
function main() {
  const { values } = parseArgs({
    options: {
      db: { type: 'string' },
      input: { type: 'string' },
      results: { type: 'string' },
      apply: { type: 'boolean', default: false },
    },
  });
  console.log(
    JSON.stringify(
      applyAiTags({
        dbPath: values.db,
        inputPath: values.input,
        resultPath: values.results,
        apply: values.apply,
      }),
      null,
      2,
    ),
  );
}

// 导入模块供测试时不会自动修改数据库。
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
