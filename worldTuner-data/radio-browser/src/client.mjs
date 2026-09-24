import { resolveSrv } from 'node:dns/promises';
import { setTimeout as delay } from 'node:timers/promises';

const LIMIT = 1000000;

/**
 * 从官方 SRV 记录发现 HTTPS 镜像并随机排列；DNS 失败时由调用者指定镜像。
 * @returns {Promise<string[]>} 可依次尝试的镜像地址。
 */
export async function discoverMirrors() {
  const records = await resolveSrv('_api._tcp.radio-browser.info');
  const mirrors = [];
  for (const record of records) {
    const host = record.name.replace(/\.$/, '');
    if (host.endsWith('.api.radio-browser.info')) mirrors.push(`https://${host}`);
  }
  for (let i = mirrors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mirrors[i], mirrors[j]] = [mirrors[j], mirrors[i]];
  }
  if (!mirrors.length)
    throw new Error('未发现 Radio Browser 镜像，请使用 --server 指定 HTTPS 镜像。');
  return [...new Set(mirrors)];
}

/**
 * 按名称排序分页读取全部电台；单页失败重试，切换镜像时重新下载以避免混用分页。
 * 分页期间上游变化可能导致重复或遗漏；重复 UUID 在写入时拒绝，不删除旧记录。
 * @param {string[]} mirrors 按尝试顺序排列的 HTTPS 镜像。
 * @param {typeof fetch} request 可替换的请求实现，供离线测试使用。
 * @param {number} pageSize 每页数量，必须为 1 到 10000 的整数。
 * @returns {Promise<{stations: unknown[], server: string}>} 原始数据及实际镜像。
 */
export async function fetchStations(mirrors, request = fetch, pageSize = 5000) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 10000) {
    throw new Error('pageSize 必须在 1 到 10000 之间。');
  }
  const errors = [];
  for (const server of mirrors) {
    const base = new URL(server);
    if (base.protocol !== 'https:' || base.username || base.password) {
      throw new Error('--server 必须是无认证信息的 HTTPS 地址。');
    }
    const stations = [];
    try {
      for (let offset = 0; offset < LIMIT; offset += pageSize) {
        const url = new URL('/json/stations', base);
        url.search = new URLSearchParams({
          limit: String(pageSize),
          offset: String(offset),
          order: 'name',
          hidebroken: 'false',
        }).toString();
        let page;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            console.log(`拉取 ${url.origin}，offset=${offset}，第 ${attempt + 1} 次尝试…`);
            const response = await request(url, {
              headers: { 'User-Agent': 'WorldTuner-LocalSync/1.0', Accept: 'application/json' },
              signal: AbortSignal.timeout(60000),
            });
            if (!response.ok) {
              await response.body?.cancel();
              throw new Error(`HTTP ${response.status}`);
            }
            page = await response.json();
            if (!Array.isArray(page) || page.length > pageSize) throw new Error('无效的分页响应。');
            break;
          } catch (error) {
            if (attempt === 1) throw error;
            await delay(2000);
          }
        }
        stations.push(...page);
        if (page.length < pageSize) {
          if (!stations.length) throw new Error('响应为空，拒绝导入。');
          return { stations, server: base.origin };
        }
        await delay(300);
      }
      throw new Error('达到安全数量上限，拒绝导入不完整数据。');
    } catch (error) {
      errors.push(`${base.origin}: ${error.message}`);
    }
  }
  throw new Error(`所有镜像请求失败：\n${errors.join('\n')}`);
}
