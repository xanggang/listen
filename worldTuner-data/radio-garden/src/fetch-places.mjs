import { mkdir, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { openStore, saveFailure, saveSuccess } from './store.mjs';

const sourceDirectory = new URL('../', import.meta.url);
const dataDirectory = new URL('data/', sourceDirectory);
const endpoints = ['places-core-columnar', 'places-details-columnar'];
const verificationTimeout = 10 * 60 * 1000;

/**
 * 等待指定接口的成功 JSON 响应；遇到验证页保留窗口，由用户手动操作。
 * 只接受目标 URL 的 HTTP 200 JSON，不把验证页或其他网络响应当作数据。
 * @param {import('playwright').Page} page 独立浏览器会话中的页面。
 * @param {string} name 固定 endpoints 列表中的接口名称。
 * @param {import('node:sqlite').DatabaseSync} db Radio Garden 专用 SQLite 连接。
 * @returns {Promise<object>} SQLite 保存状态及请求元数据。
 */
async function saveEndpoint(page, name, db) {
  const url = `https://radio.garden/api/ara/content/${name}?s=1&hl=zh-Hans`;
  console.log(`正在访问 ${url}`);
  console.log('如出现验证页，请在 Chrome 窗口中手动完成；脚本最多等待 10 分钟。');

  // 在导航前监听响应，避免遗漏首次导航或手动验证后的自动重载。
  const responsePromise = page.waitForResponse(
    // 仅选择当前指定接口的成功 JSON 响应。
    (response) =>
      response.url() === url &&
      response.status() === 200 &&
      (response.headers()['content-type'] ?? '').includes('application/json'),
    { timeout: verificationTimeout },
  );
  // 导航尚未完成时也处理监听超时，避免未处理的 Promise rejection。
  responsePromise.catch(() => {});
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (error) {
    if (page.isClosed()) throw error;
    console.log(`导航未正常结束：${error.message}；继续等待手动验证后的 JSON 响应。`);
  }
  const response = await responsePromise;
  const body = await response.body();
  const responseJson = body.toString('utf8');
  const parsed = JSON.parse(responseJson);
  if (!parsed || typeof parsed !== 'object') throw new Error(`${name} 响应不是 JSON 对象或数组。`);
  await saveSuccess(db, {
    endpoint: name,
    entityId: 'all',
    httpStatus: response.status(),
    contentType: response.headers()['content-type'],
    responseJson,
  });
  console.log(`已将 ${name} 原始响应保存到 SQLite（${body.length} 字节）`);
  return {
    url,
    http_status: response.status(),
    content_type: response.headers()['content-type'],
    bytes: body.length,
    saved_at: new Date().toISOString(),
    result: 'success',
  };
}

/**
 * 使用独立的可见 Chrome 配置采集两个接口；不读取用户日常浏览器配置。
 * 按顺序将原始响应写入 SQLite，成功一项即记录进度；异常保留已保存数据并返回非零退出码。
 */
async function main() {
  await mkdir(dataDirectory, { recursive: true });
  const db = openStore();
  let context;
  try {
    context = await chromium.launchPersistentContext(
      fileURLToPath(new URL('.browser-profile/', sourceDirectory)),
      { channel: 'chrome', headless: false },
    );
    const page = context.pages()[0] ?? (await context.newPage());
    await page.bringToFront();
    const responses = [];
    for (const name of endpoints) {
      let result;
      try {
        result = await saveEndpoint(page, name, db);
      } catch (error) {
        const requestUrl = `https://radio.garden/api/ara/content/${name}?s=1&hl=zh-Hans`;
        await saveFailure({
          endpoint: name,
          entityId: 'all',
          httpStatus: error.httpStatus,
          errorName: error.name,
          requestUrl,
          diagnostics: error.diagnostics ?? { request_url: requestUrl },
          error: error.message,
        });
        throw error;
      }
      responses.push(result);
      await writeFile(
        new URL('browser-fetch-result.json', dataDirectory),
        `${JSON.stringify({ recorded_at: new Date().toISOString(), responses }, null, 2)}\n`,
      );
      if (name !== endpoints.at(-1)) await delay(2000);
    }
    console.log('两个接口均已保存到 SQLite。');
  } finally {
    if (context) await context.close();
    db.close();
  }
}

// 对命令行报告失败；超时后可重新执行并复用独立浏览器配置。
main().catch((error) => {
  console.error(`采集未完成：${error.message}`);
  process.exitCode = 1;
});
