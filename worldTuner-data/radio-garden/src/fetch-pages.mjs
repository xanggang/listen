import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { openStore, saveFailure, saveSuccess } from './store.mjs';

const sourceDirectory = new URL('../', import.meta.url);
const dataDirectory = new URL('data/', sourceDirectory);

/**
 * 将 placesIDs.js 当作数据读取，不执行其中的 JavaScript；仅返回前五个合法 ID。
 * @returns {Promise<string[]>} 保持原文件顺序的五个地点 ID；格式不符时抛错。
 */
async function readFirstFiveIds() {
  const source = await readFile(new URL('placesIDs.js', dataDirectory), 'utf8');
  const match = source.match(/^\s*export\s+const\s+ids\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
  if (!match) throw new Error('placesIDs.js 必须是 export const ids = [...] 格式。');
  const ids = JSON.parse(match[1]);
  if (!Array.isArray(ids) || ids.length < 5) throw new Error('需要至少五个地点 ID。');
  const selected = ids.slice(0, 5);
  for (const id of selected) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) {
      throw new Error('地点 ID 包含非法字符。');
    }
  }
  if (new Set(selected).size !== 5) throw new Error('前五个 ID 中存在重复项。');
  return selected;
}

/**
 * 导航至地点接口并将原始 JSON 保存到 SQLite；验证页由用户手动操作，最多等待十分钟。
 * @param {import('playwright').Page} page 独立持久化浏览器中的页面。
 * @param {string} id 已校验的地点 ID。
 * @param {import('node:sqlite').DatabaseSync} db Radio Garden 专用 SQLite 连接。
 * @returns {Promise<object>} 本次请求的状态和字节数。
 */
async function fetchPage(page, id, db) {
  const url = `https://radio.garden/api/ara/content/page/${id}?s=1&hl=zh-Hans`;
  console.log(`请求 ${id}：${url}`);
  const pending = page.waitForResponse(
    // 只接收当前接口的成功 JSON，忽略验证 HTML 和其他页面资源。
    (response) =>
      response.url() === url &&
      response.status() === 200 &&
      (response.headers()['content-type'] ?? '').includes('application/json'),
    { timeout: 600000 },
  );
  // 导航失败时，监听器可能随后才退出；提前处理其 rejection。
  pending.catch(() => {});
  const navigation = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (navigation?.headers()['cf-mitigated'] === 'challenge') {
    console.log('遇到 Cloudflare 验证页，请在 Chrome 中手动完成验证；最多等待十分钟。');
  } else if (navigation && navigation.status() !== 200) {
    throw new Error(`HTTP ${navigation.status()}，停止本次测试。`);
  }
  const response = await pending;
  const body = await response.body();
  const responseJson = body.toString('utf8');
  const parsed = JSON.parse(responseJson);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.data) {
    throw new Error(`${id} 响应缺少 data，拒绝保存为成功数据。`);
  }
  await saveSuccess(db, {
    endpoint: 'place_page',
    entityId: id,
    httpStatus: response.status(),
    contentType: response.headers()['content-type'],
    responseJson,
  });
  console.log(`已将地点 ${id} 的响应保存到 SQLite（${body.length} 字节）`);
  return {
    id,
    url,
    http_status: response.status(),
    bytes: body.length,
    saved_at: new Date().toISOString(),
  };
}

/**
 * 仅测试原文件前五个地点，单并发、间隔一秒；每次成功即更新进度记录。
 * 任何失败都会写入错误日志并关闭浏览器，不继续扩大采集范围。
 */
async function main() {
  const ids = await readFirstFiveIds();
  const db = openStore();
  console.log(`本次仅测试前五个 ID：${ids.join(', ')}`);
  let context;
  const results = [];
  try {
    context = await chromium.launchPersistentContext(
      fileURLToPath(new URL('.browser-profile/', sourceDirectory)),
      { channel: 'chrome', headless: false },
    );
    const page = context.pages()[0] ?? (await context.newPage());
    await page.bringToFront();
    for (const id of ids) {
      try {
        results.push(await fetchPage(page, id, db));
      } catch (error) {
        const requestUrl = `https://radio.garden/api/ara/content/page/${id}?s=1&hl=zh-Hans`;
        await saveFailure({
          endpoint: 'place_page',
          entityId: id,
          httpStatus: error.httpStatus,
          errorName: error.name,
          requestUrl,
          diagnostics: error.diagnostics ?? { request_url: requestUrl },
          error: error.message,
        });
        throw error;
      }
      await writeFile(
        new URL('pages-fetch-result.json', dataDirectory),
        `${JSON.stringify({ requested_ids: ids, completed: results.length, results }, null, 2)}\n`,
      );
      if (id !== ids.at(-1)) await delay(1000);
    }
    console.log(`测试完成：${results.length}/5 个接口响应已保存。`);
  } finally {
    if (context) await context.close();
    db.close();
  }
}

// 向命令行报告失败并返回非零退出码，避免将部分完成误认为成功。
main().catch((error) => {
  console.error(`地点页面测试未完成：${error.message}`);
  process.exitCode = 1;
});
