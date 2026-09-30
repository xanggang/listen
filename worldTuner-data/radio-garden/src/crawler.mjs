import { setTimeout as delay } from 'node:timers/promises';

/**
 * 从已整理的地点表读取 ID；采集频道前必须先完成地点总览归一化。
 * @param {import('node:sqlite').DatabaseSync} db Radio Garden 专用数据库。
 * @returns {string[]} 按来源下标排列的地点 ID。
 */
export function readPlaceIds(db) {
  const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'radio_garden_places'").get();
  if (!table) throw new Error('缺少地点表；请先运行 npm run normalize:radio-garden。');
  const ids = [];
  for (const row of db.prepare('SELECT id FROM radio_garden_places ORDER BY source_index').iterate()) {
    ids.push(row.id);
  }
  if (!ids.length) throw new Error('地点表为空；请先运行 npm run normalize:radio-garden。');
  return ids;
}

/**
 * 从 places/{id}/channels 响应里提取频道引用，只接受电台频道项及其 listen 路径。
 * @param {unknown} payload Radio Garden 原始 JSON 响应。
 * @param {string} placeId 当前地点 ID，用于生成关系记录。
 * @returns {{placeId: string, channelId: string, title: string | null}[]} 去重后的频道引用。
 */
export function extractChannels(payload, placeId) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !payload.data ||
    typeof payload.data !== 'object'
  ) {
    throw new Error('地点频道响应缺少 data 对象。');
  }
  const content = payload.data.content;
  if (!Array.isArray(content)) throw new Error('地点频道响应缺少 data.content 数组。');
  const found = new Map();
  for (const section of content) {
    if (!section || typeof section !== 'object' || !Array.isArray(section.items)) continue;
    for (const item of section.items) {
      if (!item || typeof item !== 'object') continue;
      const page = item.page && typeof item.page === 'object' ? item.page : item;
      const href = page.href ?? page.url ?? item.href ?? item.url;
      const type = page.type ?? item.type ?? section.itemsType;
      if (type && type !== 'channel') continue;
      if (typeof href !== 'string') continue;
      const match = href.match(/\/listen\/[^/?#]+\/([A-Za-z0-9_-]+)(?:[?#].*)?$/);
      if (!match) continue;
      const channelId = match[1];
      found.set(channelId, { placeId, channelId, title: page.title ?? item.title ?? null });
    }
  }
  if (!found.size && payload.data.count > 0) {
    throw new Error('响应有频道总数但未解析到频道 ID，可能存在未支持的分页格式。');
  }
  return [...found.values()];
}

/**
 * 按次序请求一个阶段的实体；失败写入错误日志后继续，间隔请求以减轻服务压力。
 * @param {object} options 阶段请求和保存所需依赖。
 * @param {string} options.endpoint 台账中的接口类型。
 * @param {string[]} options.ids 当前阶段的实体 ID。
 * @param {import('node:sqlite').DatabaseSync} options.db Radio Garden 专用 SQLite。
 * @param {(id: string) => Promise<object>} options.request 单个实体的 API 请求。
 * @param {(record: object) => Promise<void>} options.saveSuccess 成功记录落盘函数。
 * @param {(failure: object) => Promise<void>} options.saveFailure 失败日志写入函数。
 * @param {(endpoint: string, id: string) => boolean} options.isComplete 已完成检查。
 * @param {number} options.limit 此次最多处理的 ID 数量。
 * @param {number} options.delayMs 请求间隔毫秒。
 * @param {(db: import('node:sqlite').DatabaseSync) => Promise<object>} options.progress 进度落盘函数。
 * @returns {Promise<{completed: number, skipped: number, failed: number}>} 本次阶段结果。
 */
export async function runBatch(options) {
  let completed = 0;
  let skipped = 0;
  let failed = 0;
  const ids = options.ids.slice(0, options.limit);
  for (let index = 0; index < ids.length; index++) {
    const id = ids[index];
    if (options.isComplete(options.endpoint, id)) {
      skipped++;
      continue;
    }
    try {
      const result = await options.request(id);
      const record = { endpoint: options.endpoint, entityId: id, ...result };
      const relations = result.relations ?? [];
      await options.saveSuccess(record, relations, result);
      completed++;
    } catch (error) {
      failed++;
      await options.saveFailure({
        endpoint: options.endpoint,
        entityId: id,
        httpStatus: error.httpStatus,
        errorName: error.name,
        requestUrl: error.diagnostics?.request_url,
        diagnostics: error.diagnostics,
        error: error.message,
      });
      console.error(`${options.endpoint} ${id} 失败：${error.message}`);
    }
    if ((index + 1) % 25 === 0) {
      const state = await options.progress(options.db);
      console.log(
        `${options.endpoint}: ${index + 1}/${ids.length}，本阶段成功 ${completed}，失败 ${failed}；${JSON.stringify(state.counts)}`,
      );
    }
    if (index + 1 < ids.length) await delay(options.delayMs);
  }
  await options.progress(options.db);
  return { completed, skipped, failed };
}
