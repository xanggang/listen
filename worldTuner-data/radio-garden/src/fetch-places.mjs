import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { getJson } from './api/client.mjs';
import { openStore, saveFailure, saveSuccess } from './store.mjs';

const endpoints = ['places-core-columnar', 'places-details-columnar'];

/**
 * 顺序采集两份地点总览原始响应；每份成功结果立即存入 Radio Garden 专用 SQLite。
 * @param {import('node:sqlite').DatabaseSync} db Radio Garden 数据库连接。
 * @param {{request?: typeof getJson, save?: typeof saveSuccess, onFailure?: typeof saveFailure, sleep?: typeof delay}} [options] 可替换的请求与持久化依赖，供离线测试使用。
 * @returns {Promise<string[]>} 本次成功保存的接口名称，失败时保留先前成功项并抛出错误。
 */
export async function fetchPlaceCatalogs(db, options = {}) {
  const request = options.request ?? getJson;
  const save = options.save ?? saveSuccess;
  const onFailure = options.onFailure ?? saveFailure;
  const sleep = options.sleep ?? delay;
  const completed = [];
  for (const endpoint of endpoints) {
    try {
      const response = await request(`${endpoint}?s=1&hl=zh-Hans`);
      await save(db, {
        endpoint,
        entityId: 'all',
        httpStatus: response.httpStatus,
        contentType: response.contentType,
        responseJson: response.responseJson,
      });
      completed.push(endpoint);
      console.log(`${endpoint} 已保存到 Radio Garden SQLite。`);
    } catch (error) {
      await onFailure({
        endpoint,
        entityId: 'all',
        httpStatus: error.httpStatus,
        errorName: error.name,
        requestUrl: error.diagnostics?.request_url,
        diagnostics: error.diagnostics,
        error: error.message,
      });
      throw error;
    }
    if (completed.length < endpoints.length) await sleep(1000);
  }
  return completed;
}

/**
 * 打开独立采集库并使用 Node 原生 fetch 获取地点总览，不启动浏览器。
 */
async function main() {
  const db = openStore();
  try {
    await fetchPlaceCatalogs(db);
  } finally {
    db.close();
  }
}

// 直接执行时才访问网络；被离线测试导入时不触发采集。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Radio Garden 地点总览采集失败：${error.message}`);
    process.exitCode = 1;
  });
}
