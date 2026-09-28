import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const databasePath = fileURLToPath(new URL('../../radio-garden/data/radio-garden.sqlite', import.meta.url));
const cldrBaseUrl = 'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-localenames-full/main';
const execFileAsync = promisify(execFile);

// Radio Garden 的部分名称与 CLDR 英文标准名不同；这里只映射身份，不直接改写源名称。
const countryCodesByAlias = {
  'Bosnia and Herzegovina': 'BA',
  Palestine: 'PS',
  'Hong Kong': 'HK',
  'Saint Vincent and the Grenadines': 'VC',
  'Antigua and Barbuda': 'AG',
  'Saint Kitts and Nevis': 'KN',
  'Saint Lucia': 'LC',
  'Bailiwick of Jersey': 'JE',
  'Saint-Pierre et Miquelon': 'PM',
  'Collectivity of Saint Martin': 'MF',
  'Trinidad and Tobago': 'TT',
  'The Gambia': 'GM',
  'Guiné-Bissau': 'GW',
  'Saint Barthélemy': 'BL',
  'Bailiwick of Guernsey': 'GG',
  Macau: 'MO',
  'São Tomé and Príncipe': 'ST',
  'Turks and Caicos Islands': 'TC',
  'Wallis and Futuna': 'WF',
  'Democratic Republic of the Congo': 'CD',
  'The Bahamas': 'BS',
  'Federated States of Micronesia': 'FM',
  'Saint Helena': 'SH',
};

// 三个地点不在 CLDR 的国家或地区代码表中，保留空代码并单独标明来源。
const localNames = {
  Madeira: '马德拉群岛',
  Tahiti: '塔希提岛',
  Azores: '亚速尔群岛',
};

// 优先采用 CLDR 的短名或变体；没有合适变体的名称才手工指定。
const displayOverrides = {
  'Hong Kong': { key: 'HK-alt-short' },
  Macau: { key: 'MO-alt-short' },
  Palestine: { key: 'PS-alt-short' },
  'Democratic Republic of the Congo': { key: 'CD-alt-variant' },
  'Federated States of Micronesia': { name: '密克罗尼西亚联邦' },
};

/**
 * 规范英文地区名以匹配 CLDR；只消除重音、标点和大小写差异，不猜测地理身份。
 * @param {string} name 英文国家或地区名称。
 * @returns {string} 用于精确查找的规范键。
 */
function nameKey(name) {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * 从 CLDR 远程仓库取一份小型名称表；失败时抛错，不写入不完整映射。
 * @param {'en' | 'zh'} locale CLDR 语言代码。
 * @param {(url: string) => Promise<unknown>} request 可注入的下载函数，供离线测试使用。
 * @returns {Promise<Record<string, string>>} 地区代码到当地语言名称的映射。
 */
export async function fetchTerritories(locale, request = downloadJson) {
  const url = `${cldrBaseUrl}/${locale}/territories.json`;
  const payload = await request(url);
  const names = payload?.main?.[locale]?.localeDisplayNames?.territories;
  if (!names || typeof names !== 'object' || Array.isArray(names)) {
    throw new Error(`CLDR ${locale} 缺少 territories 对象。`);
  }
  return names;
}

/**
 * 通过系统 curl 读取固定的 HTTPS JSON；进程参数分开传递，不使用 shell。
 * @param {string} url CLDR 官方 JSON 地址。
 * @returns {Promise<unknown>} 解析后的响应对象。
 */
async function downloadJson(url) {
  const { stdout } = await execFileAsync(
    'curl',
    ['--fail', '--silent', '--show-error', '--location', '--retry', '2', '--max-time', '30', url],
    { maxBuffer: 1_000_000 },
  );
  return JSON.parse(stdout);
}

/**
 * 将 Radio Garden 国家或地区名与 CLDR 代码一一对应；未覆盖项直接报错供人工审查。
 * @param {string[]} countries 当前 Radio Garden 快照的不同国家或地区名。
 * @param {Record<string, string>} english CLDR 英文名称表。
 * @param {Record<string, string>} chinese CLDR 中文名称表。
 * @returns {{nameEn: string, nameZh: string, regionCode: string | null, source: string}[]} 完整映射。
 */
export function buildCountryNames(countries, english, chinese) {
  const codesByEnglish = new Map();
  for (const [code, name] of Object.entries(english)) {
    if (!/^[A-Z]{2}$/.test(code) || typeof name !== 'string') continue;
    const key = nameKey(name);
    const codes = codesByEnglish.get(key) ?? [];
    codes.push(code);
    codesByEnglish.set(key, codes);
  }
  return countries.map((nameEn) => {
    if (localNames[nameEn]) {
      return { nameEn, nameZh: localNames[nameEn], regionCode: null, source: 'manual' };
    }
    const candidates = codesByEnglish.get(nameKey(nameEn)) ?? [];
    const code = countryCodesByAlias[nameEn] ?? (candidates.length === 1 ? candidates[0] : null);
    if (!code) throw new Error(`无法唯一匹配地区：${nameEn}`);
    const override = displayOverrides[nameEn];
    const nameZh = override?.name ?? chinese[override?.key ?? code];
    if (typeof nameZh !== 'string' || !nameZh.trim()) {
      throw new Error(`CLDR 缺少 ${nameEn} (${code}) 的中文名称。`);
    }
    return {
      nameEn,
      nameZh,
      regionCode: code,
      source: override?.name ? 'manual' : 'cldr',
    };
  });
}

/**
 * 将已完整校验的中文名称原子写入独立表；地点及爬虫原始数据不变。
 * @param {DatabaseSync} db Radio Garden 专用 SQLite 连接。
 * @param {{nameEn: string, nameZh: string, regionCode: string | null, source: string}[]} names 地区映射。
 */
export function saveCountryNames(db, names) {
  db.exec(`
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS radio_garden_country_names (
      name_en TEXT PRIMARY KEY,
      name_zh TEXT NOT NULL,
      region_code TEXT,
      source TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE VIEW IF NOT EXISTS radio_garden_places_zh AS
      SELECT p.*, n.name_zh AS country_zh, n.region_code AS country_code
      FROM radio_garden_places AS p
      LEFT JOIN radio_garden_country_names AS n ON n.name_en = p.country;
  `);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('DELETE FROM radio_garden_country_names');
    const insert = db.prepare(`
      INSERT INTO radio_garden_country_names (name_en, name_zh, region_code, source, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const entry of names) {
      insert.run(entry.nameEn, entry.nameZh, entry.regionCode, entry.source, now);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * 首次生成映射时请求两份小型 CLDR 表；已有完整映射时直接使用 SQLite 缓存。
 */
async function main() {
  const refresh = process.argv[2] === '--refresh';
  if (process.argv[2] && !refresh) {
    throw new Error('用法：npm run localize:radio-garden:countries -- [--refresh]');
  }
  const db = new DatabaseSync(databasePath);
  try {
    const countries = db.prepare('SELECT DISTINCT country FROM radio_garden_places ORDER BY country')
      .all().map((row) => row.country);
    if (!countries.length) throw new Error('地点表为空，请先运行 normalize:radio-garden。');
    // 初次运行时名称表可能尚未创建，先检查 schema 再检查覆盖率。
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'radio_garden_country_names'").get();
    if (!refresh && hasTable) {
      const coverage = db.prepare(`
        SELECT COUNT(DISTINCT n.name_en) AS matched
        FROM radio_garden_places AS p
        JOIN radio_garden_country_names AS n ON n.name_en = p.country
      `).get().matched;
      if (coverage === countries.length) {
        console.log(`已缓存 ${countries.length} 个中文地区名；使用 --refresh 才重新请求 CLDR。`);
        return;
      }
    }
    const [english, chinese] = await Promise.all([
      fetchTerritories('en'),
      fetchTerritories('zh'),
    ]);
    const names = buildCountryNames(countries, english, chinese);
    saveCountryNames(db, names);
    console.log(`已整理 ${names.length} 个国家或地区中文名；手工名称 ${names.filter((name) => name.source === 'manual').length} 个。`);
  } finally {
    db.close();
  }
}

// 作为命令运行时才访问数据库和网络，模块导入仅提供可测试的转换函数。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`中文地区名整理失败：${error.message}`);
    process.exitCode = 1;
  });
}
