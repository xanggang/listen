import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { extractChannels, readPlaceIds, runBatch } from './crawler.mjs';
import {
  isComplete,
  listChannelIds,
  openStore,
  saveFailure,
  saveRedirect,
  saveSuccess,
  writeProgress,
} from './store.mjs';

const dataDirectory = new URL('../data/', import.meta.url);
const profilePath = fileURLToPath(new URL('../.browser-profile/', import.meta.url));
const endpoints = {
  places: 'places_channels',
  details: 'channel_details',
  streams: 'stream_redirect',
};

/**
 * 通过可见 Chrome 请求单条 JSON API；遇到 Cloudflare 验证时等待用户在窗口操作。
 * @param {import('playwright').Page} page 可见浏览器中的页面。
 * @param {string} pathname Radio Garden API 的固定路径。
 * @returns {Promise<{httpStatus: number, contentType: string, responseJson: string}>} 原始响应内容。
 */
async function requestJson(page, pathname) {
  const url = `https://radio.garden/api/ara/content/${pathname}?s=1&hl=zh-Hans`;
  let resolveJson;
  let rejectJson;
  const responsePromise = new Promise((resolve, reject) => {
    resolveJson = resolve;
    rejectJson = reject;
  });
  responsePromise.catch(() => {});
  let lastChallengeDiagnostics;
  const onResponse = (response) => {
    if (response.url() !== url) return;
    const contentType = response.headers()['content-type'] ?? '';
    if (response.status() === 200 && contentType.includes('application/json')) {
      resolveJson(response);
    } else if (response.status() === 403 && response.headers()['cf-mitigated'] === 'challenge') {
      const headers = response.headers();
      lastChallengeDiagnostics = {
        request_url: response.url(),
        final_url: response.url(),
        http_status: response.status(),
        headers: Object.fromEntries(
          ['cf-mitigated', 'cf-ray', 'cf-cache-status', 'server', 'content-type']
            .map((name) => [name, headers[name]])
            .filter(([, value]) => value),
        ),
        cloudflare_detected: true,
      };
      response
        .text()
        .then((body) => {
          lastChallengeDiagnostics.response_body_excerpt = body.slice(0, 2000);
          lastChallengeDiagnostics.response_body_truncated = body.length > 2000;
        })
        .catch(() => {});
    } else {
      const error = new Error(
        `HTTP ${response.status()}，Content-Type: ${contentType || 'unknown'}`,
      );
      error.httpStatus = response.status();
      error.diagnostics = {
        request_url: response.url(),
        final_url: response.url(),
        http_status: response.status(),
        headers: Object.fromEntries(
          ['cf-mitigated', 'cf-ray', 'cf-cache-status', 'server', 'content-type']
            .map((name) => [name, response.headers()[name]])
            .filter(([, value]) => value),
        ),
        cloudflare_detected:
          response.headers()['cf-mitigated'] === 'challenge' ||
          /Cloudflare|cf-chl-|Just a moment\.\.\./i.test(response.statusText()),
      };
      response
        .text()
        .then((body) => {
          error.diagnostics.response_body_excerpt = body.slice(0, 2000);
          error.diagnostics.response_body_truncated = body.length > 2000;
          rejectJson(error);
        })
        .catch(() => rejectJson(error));
    }
  };
  page.on('response', onResponse);
  const responseTimeout = setTimeout(() => {
    const error = new Error(
      lastChallengeDiagnostics
        ? '等待 Cloudflare 人工验证后的 JSON 响应超时（10 分钟）。'
        : '等待 JSON 响应超时（10 分钟）。',
    );
    error.httpStatus = lastChallengeDiagnostics?.http_status;
    error.diagnostics = lastChallengeDiagnostics ?? { request_url: url, timeout_ms: 600000 };
    rejectJson(error);
  }, 600000);
  let navigation;
  try {
    navigation = await page.goto(url, { waitUntil: 'commit', timeout: 30000 });
  } catch (error) {
    if (page.isClosed()) throw error;
    console.log(`导航没有收到响应：${error.message}；保持浏览器开启，等待 JSON。`);
    error.diagnostics = {
      request_url: url,
      error_name: error.name,
      cause: error.cause ? { name: error.cause.name, message: error.cause.message } : undefined,
    };
  }
  if (navigation?.headers()['cf-mitigated'] === 'challenge') {
    console.log('Cloudflare 要求人工验证，请在 Chrome 窗口中完成；最多等待十分钟。');
  } else if (navigation && navigation.status() !== 200) {
    const error = new Error(`HTTP ${navigation.status()}`);
    error.httpStatus = navigation.status();
    error.diagnostics = {
      request_url: url,
      final_url: navigation.url(),
      http_status: navigation.status(),
      headers: Object.fromEntries(
        ['cf-mitigated', 'cf-ray', 'cf-cache-status', 'server', 'content-type']
          .map((name) => [name, navigation.headers()[name]])
          .filter(([, value]) => value),
      ),
      cloudflare_detected: navigation.headers()['cf-mitigated'] === 'challenge',
    };
    throw error;
  }
  let response;
  try {
    response = await responsePromise;
  } finally {
    clearTimeout(responseTimeout);
    page.off('response', onResponse);
  }
  const bytes = await response.body();
  const responseJson = bytes.toString('utf8');
  const parsed = JSON.parse(responseJson);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.data) {
    throw new Error('响应不是有效的 Radio Garden JSON 对象。');
  }
  return {
    httpStatus: response.status(),
    contentType: response.headers()['content-type'] ?? 'application/json',
    responseJson,
    data: parsed,
  };
}

/**
 * 对已知频道获取 listen API 的重定向目标，不跟随重定向或下载音频。
 * @param {import('playwright').Page} page 持有 Radio Garden 会话 Cookie 的浏览器页。
 * @param {string} channelId 已验证的频道 ID。
 * @returns {Promise<{httpStatus: number, redirectUrl: string}>} HTTP 3xx 和目标流地址。
 */
async function requestStreamRedirect(page, channelId) {
  const url = `https://radio.garden/api/ara/content/listen/${channelId}/channel.mp3?s=1&hl=zh-Hans`;
  const response = await page.context().request.get(url, { maxRedirects: 0, timeout: 60000 });
  if (![301, 302, 303, 307, 308].includes(response.status())) {
    const status = response.status();
    const headers = response.headers();
    const body = (await response.text()).slice(0, 2000);
    await response.dispose();
    const error = new Error(`播放地址接口预期返回 HTTP 3xx，实际为 ${status}`);
    error.httpStatus = status;
    error.diagnostics = {
      request_url: url,
      http_status: status,
      headers: Object.fromEntries(
        ['cf-mitigated', 'cf-ray', 'cf-cache-status', 'server', 'content-type']
          .map((name) => [name, headers[name]])
          .filter(([, value]) => value),
      ),
      cloudflare_detected:
        headers['cf-mitigated'] === 'challenge' ||
        /Cloudflare|cf-chl-|Just a moment\.\.\./i.test(body),
      response_body_excerpt: body,
    };
    throw error;
  }
  const redirectUrl = response.headers().location;
  await response.dispose();
  if (!redirectUrl || !/^https?:\/\//i.test(redirectUrl)) {
    throw new Error('播放地址接口没有返回有效的 Location。');
  }
  return { httpStatus: response.status(), redirectUrl };
}

/**
 * 运行地点频道、频道详情或播放重定向中的一个阶段；默认处理所选阶段的全部 ID。
 */
async function main() {
  const { values } = parseArgs({
    options: {
      phase: { type: 'string' },
      limit: { type: 'string' },
      'delay-ms': { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(
      '用法：npm run sync:radio-garden -- --phase places|details|streams [--limit N] [--delay-ms N]',
    );
    return;
  }
  const phase = values.phase ?? 'places';
  if (!Object.hasOwn(endpoints, phase))
    throw new Error('--phase 必须为 places、details 或 streams。');
  const limit = values.limit === undefined ? Number.MAX_SAFE_INTEGER : Number(values.limit);
  const delayMs = values['delay-ms'] === undefined ? 1000 : Number(values['delay-ms']);
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    !Number.isSafeInteger(delayMs) ||
    delayMs < 0 ||
    delayMs > 60000
  ) {
    throw new Error('--limit 必须为正整数，--delay-ms 必须为 0 到 60000 的整数。');
  }
  await mkdir(dataDirectory, { recursive: true });
  const db = openStore();
  const context = await chromium.launchPersistentContext(profilePath, {
    channel: 'chrome',
    headless: false,
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.bringToFront();
    let ids;
    if (phase === 'places') ids = await readPlaceIds();
    else ids = listChannelIds(db);
    if (!ids.length && phase !== 'places') {
      throw new Error('没有已发现的频道 ID；请先运行 --phase places。');
    }
    const endpoint = endpoints[phase];
    const request =
      phase === 'places'
        ? async (browserPage, placeId) => {
            const response = await requestJson(browserPage, `page/${placeId}/channels`);
            const relations = extractChannels(response.data, placeId);
            return { ...response, relations };
          }
        : phase === 'details'
          ? async (browserPage, channelId) => requestJson(browserPage, `channel/${channelId}`)
          : requestStreamRedirect;
    console.log(
      `Radio Garden 阶段 ${phase}：本次最多处理 ${Math.min(ids.length, limit)}/${ids.length} 个 ID；独立数据库 ${fileURLToPath(new URL('radio-garden.sqlite', dataDirectory))}`,
    );
    const result = await runBatch({
      endpoint,
      ids,
      page,
      db,
      request,
      saveSuccess:
        phase === 'streams'
          ? async (_record, _relations, result) => saveRedirect(db, result)
          : async (record, relations) => saveSuccess(db, record, relations),
      saveFailure,
      isComplete: (name, id) => isComplete(db, name, id),
      limit,
      delayMs,
      progress: writeProgress,
    });
    console.log(JSON.stringify({ phase, ...result, totals: await writeProgress(db) }, null, 2));
    if (result.failed) process.exitCode = 1;
  } finally {
    await context.close();
    db.close();
  }
}

// 报告命令失败并返回非零状态，保留已成功保存的进度供后续续跑。
main().catch((error) => {
  console.error(`Radio Garden 采集失败：${error.message}`);
  process.exitCode = 1;
});
