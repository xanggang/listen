import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const databasePath = fileURLToPath(new URL('../data/worldtuner-merged.sqlite', import.meta.url));

/**
 * 规范化标签的 Unicode、大小写和空白；不自动推测同义词。
 * @param {unknown} value 原始标签。
 * @returns {string | null} 规范化键。
 */
function normalizeTag(value) {
  if (typeof value !== 'string') return null;
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en') || null;
}

/**
 * 将主表的逗号分隔标签拆为单台去重的规范化键，并保存首次原始拼写。
 * @param {unknown} raw 主表原始 tags 字段。
 * @returns {Map<string, string>} 规范化键到原始词条。
 */
function splitRawTags(raw) {
  const result = new Map();
  if (typeof raw !== 'string') return result;
  for (const part of raw.split(',')) {
    const name = part.trim();
    const key = normalizeTag(name);
    if (key && !result.has(key)) result.set(key, name);
  }
  return result;
}

/**
 * 解析命令行，只允许指定 --apply 和一个可选规则文件。
 * @param {string[]} args 命令行参数。
 * @returns {{apply: boolean, rulesPath: string | null}} 已验证选项。
 */
function parseArgs(args) {
  let apply = false;
  let rulesPath = null;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--apply' && !apply) {
      apply = true;
    } else if (args[index] === '--rules' && !rulesPath && args[index + 1] && !args[index + 1].startsWith('--')) {
      rulesPath = resolve(args[++index]);
    } else {
      throw new Error('用法：node worldTuner-data/merged/src/split-tags.mjs [--apply] [--rules 规则文件.json]');
    }
  }
  return { apply, rulesPath };
}

/**
 * 读取人工定义的别名映射，拒绝空值、冲突和循环规则。
 * @param {string | null} path 可选 JSON 规则文件。
 * @returns {{aliases: Map<string, string>, labels: Map<string, string>}} 规范化别名及目标展示词。
 */
function readRules(path) {
  const aliases = new Map();
  const labels = new Map();
  if (!path) return { aliases, labels };
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.aliases || typeof parsed.aliases !== 'object' || Array.isArray(parsed.aliases)) {
    throw new Error('规则文件必须是 { "aliases": { "别名": "规范标签" } }');
  }
  for (const [rawAlias, rawTarget] of Object.entries(parsed.aliases)) {
    const alias = normalizeTag(rawAlias);
    const target = normalizeTag(rawTarget);
    if (!alias || !target || typeof rawTarget !== 'string') throw new Error(`无效的标签别名规则：${rawAlias}`);
    if (aliases.has(alias) && aliases.get(alias) !== target) throw new Error(`重复且冲突的标签别名：${rawAlias}`);
    if (alias !== target) aliases.set(alias, target);
    labels.set(target, rawTarget.trim());
  }
  for (const alias of aliases.keys()) resolveAlias(alias, aliases);
  return { aliases, labels };
}

/**
 * 沿人工别名链找到最终标签；循环规则直接中止拆分。
 * @param {string} key 标签规范化键。
 * @param {Map<string, string>} aliases 人工别名规则。
 * @returns {string} 最终规范标签键。
 */
function resolveAlias(key, aliases) {
  const seen = new Set();
  let current = key;
  while (aliases.has(current)) {
    if (seen.has(current)) throw new Error(`标签规则存在循环：${key}`);
    seen.add(current);
    current = aliases.get(current);
  }
  return current;
}

/**
 * 读取原字典与电台原始标签，生成拆分计划而不修改原始文本。
 * @param {DatabaseSync} db 合并库连接。
 * @param {Map<string, string>} aliases 人工别名规则。
 * @param {Map<string, string>} labels 规则目标展示词。
 * @returns {object} 字典、站点标签及预估计数。
 */
function buildPlan(db, aliases, labels) {
  const existing = db.prepare('SELECT id, name FROM tags ORDER BY id').all();
  const names = new Map();
  for (const row of existing) {
    const key = normalizeTag(row.name);
    if (key && !names.has(key)) names.set(key, row.name);
  }
  const stations = [];
  let taggedStations = 0;
  let rawTokens = 0;
  let tagLinks = 0;
  const usedCanonical = new Set();
  for (const row of db.prepare('SELECT id, tags FROM station_unified ORDER BY id').iterate()) {
    const rawTags = splitRawTags(row.tags);
    if (!rawTags.size) continue;
    taggedStations++;
    rawTokens += rawTags.size;
    const canonical = new Set();
    for (const [key, name] of rawTags) {
      if (!names.has(key)) names.set(key, name);
      const root = resolveAlias(key, aliases);
      canonical.add(root);
      usedCanonical.add(root);
    }
    tagLinks += canonical.size;
    stations.push({ id: row.id, canonical });
  }
  for (const [key, label] of labels) {
    if (!names.has(key)) names.set(key, label);
  }
  return { existing, names, stations, taggedStations, rawTokens, tagLinks, canonicalTags: usedCanonical.size };
}

/**
 * 在事务中创建新标签、设置别名、重建关联与计数，保留原标签 ID 和可见性设置。
 * @param {DatabaseSync} db 合并库写连接。
 * @param {object} plan 已计算的拆分计划。
 * @param {Map<string, string>} aliases 人工别名规则。
 * @param {string | null} rulesPath 规则文件路径，仅用于审计。
 */
function applyPlan(db, plan, aliases, rulesPath) {
  const idByKey = new Map();
  for (const row of plan.existing) {
    const key = normalizeTag(row.name);
    if (key && !idByKey.has(key)) idByKey.set(key, row.id);
  }
  const insertTag = db.prepare('INSERT INTO tags (name, stationcount, normalized_name, canonical_tag_id, is_visible) VALUES (?, 0, ?, NULL, 0)');
  for (const [key, name] of plan.names) {
    if (!idByKey.has(key)) idByKey.set(key, Number(insertTag.run(name, key).lastInsertRowid));
  }
  const updateTag = db.prepare('UPDATE tags SET normalized_name = ?, canonical_tag_id = ? WHERE id = ?');
  for (const row of db.prepare('SELECT id, name FROM tags ORDER BY id').all()) {
    const key = normalizeTag(row.name);
    const rootId = key ? idByKey.get(resolveAlias(key, aliases)) ?? null : null;
    updateTag.run(key, rootId === row.id ? null : rootId, row.id);
  }
  db.exec('DELETE FROM station_tag; UPDATE tags SET stationcount = 0');
  const insertLink = db.prepare('INSERT INTO station_tag (station_id, tag_id) VALUES (?, ?)');
  const increment = db.prepare('UPDATE tags SET stationcount = stationcount + 1 WHERE id = ?');
  for (const station of plan.stations) {
    for (const key of station.canonical) {
      const id = idByKey.get(key);
      if (!id) throw new Error(`找不到规范标签：${key}`);
      insertLink.run(station.id, id);
      increment.run(id);
    }
  }
  db.prepare('INSERT INTO tag_split_run (id, completed_at, tagged_stations, tag_links, canonical_tags, applied_rules) VALUES (1, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET completed_at = excluded.completed_at, tagged_stations = excluded.tagged_stations, tag_links = excluded.tag_links, canonical_tags = excluded.canonical_tags, applied_rules = excluded.applied_rules').run(new Date().toISOString(), plan.taggedStations, plan.tagLinks, plan.canonicalTags, rulesPath);
  if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('外键检查失败，标签拆分已回滚');
}

/**
 * 默认只输出拆分预览；--apply 才在合并库中执行可重跑的标签关系重建。
 * @param {string[]} args 命令行参数。
 */
function main(args) {
  const { apply, rulesPath } = parseArgs(args);
  if (!existsSync(databasePath)) throw new Error(`合并数据库不存在：${databasePath}`);
  const { aliases, labels } = readRules(rulesPath);
  const db = new DatabaseSync(databasePath, { readOnly: !apply });
  let transaction = false;
  try {
    db.exec(apply ? 'PRAGMA foreign_keys = ON; BEGIN IMMEDIATE' : 'PRAGMA query_only = ON; BEGIN');
    transaction = true;
    const plan = buildPlan(db, aliases, labels);
    if (apply) {
      applyPlan(db, plan, aliases, rulesPath);
      db.exec('COMMIT');
    } else {
      db.exec('ROLLBACK');
    }
    transaction = false;
    console.log(JSON.stringify({ mode: apply ? 'applied' : 'preview', taggedStations: plan.taggedStations, rawTokens: plan.rawTokens, tagLinks: plan.tagLinks, canonicalTags: plan.canonicalTags, explicitAliases: aliases.size }, null, 2));
  } catch (error) {
    if (transaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
