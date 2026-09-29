import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const databasePath = fileURLToPath(new URL('../data/worldtuner-merged.sqlite', import.meta.url));

/**
 * 仅规范化展示名称的 Unicode、大小写和空白，用于筛掉完全同名的组。
 * @param {unknown} value 电台名称。
 * @returns {string | null} 可比较的名称。
 */
function normalizeName(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en') || null : null;
}

/**
 * 对最终流地址规范化主机和末尾斜杠，保留查询参数和路径大小写。
 * @param {unknown} value 电台流地址。
 * @returns {string | null} 可比较的 URL。
 */
function normalizeStream(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * 将字段安全地编码为 CSV 单元格，避免换行和引号破坏报告结构。
 * @param {unknown} value 要输出的值。
 * @returns {string} 双引号包裹的 CSV 文本。
 */
function csv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/**
 * 只读列出共享最终流和国家、但名称不同的跨来源候选组。
 */
function main() {
  if (!existsSync(databasePath)) throw new Error(`合并数据库不存在：${databasePath}`);
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    db.exec('PRAGMA query_only = ON; BEGIN');
    const browserByStream = new Map();
    const browserRows = db.prepare("SELECT id, name, countrycode, url_resolved FROM station_unified WHERE source_type IN ('radio_browser', 'both')");
    for (const row of browserRows.iterate()) {
      const stream = normalizeStream(row.url_resolved);
      const country = row.countrycode?.trim().toUpperCase();
      if (!stream || !country) continue;
      const key = `${country}\0${stream}`;
      if (!browserByStream.has(key)) browserByStream.set(key, []);
      browserByStream.get(key).push(row);
    }
    process.stdout.write('garden_id,garden_name,browser_ids,browser_names,countrycode,url_resolved\n');
    const gardenRows = db.prepare("SELECT id, name, countrycode, url_resolved FROM station_unified WHERE source_type = 'radio_garden'");
    for (const garden of gardenRows.iterate()) {
      const stream = normalizeStream(garden.url_resolved);
      const country = garden.countrycode?.trim().toUpperCase();
      if (!stream || !country) continue;
      const candidates = browserByStream.get(`${country}\0${stream}`);
      if (!candidates?.length) continue;
      const browserIds = [];
      const browserNames = [];
      let sameName = false;
      for (const candidate of candidates) {
        browserIds.push(candidate.id);
        browserNames.push(candidate.name);
        if (normalizeName(candidate.name) === normalizeName(garden.name)) sameName = true;
      }
      if (sameName) continue;
      const fields = [garden.id, garden.name, browserIds.join('|'), browserNames.join(' | '), country, stream];
      const cells = [];
      for (const field of fields) cells.push(csv(field));
      process.stdout.write(`${cells.join(',')}\n`);
    }
    db.exec('ROLLBACK');
  } finally {
    db.close();
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
