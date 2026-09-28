import { setTimeout as delay } from 'node:timers/promises';

const API_ROOT = 'https://radio.garden/api/ara/content';
const USER_AGENT = 'WorldTuner-Data/1.0 (Radio Garden metadata sync)';
const DIAGNOSTIC_HEADERS = [
  'cf-mitigated',
  'cf-ray',
  'cf-cache-status',
  'server',
  'retry-after',
  'content-type',
  'location',
];

/**
 * 从响应中提取有限长度的诊断信息，便于判断 Cloudflare 拦截且避免记录 Cookie 等敏感头。
 * @param {Response} response 已收到的 HTTP 响应。
 * @param {string} url 发出的请求 URL。
 * @param {string} [body] 已读取的响应正文。
 * @returns {object} 可安全写入错误日志的响应诊断字段。
 */
function responseDiagnostics(response, url, body = '') {
  const headers = Object.fromEntries(
    DIAGNOSTIC_HEADERS.map((name) => [name, response.headers.get(name)]).filter(([, value]) => value),
  );
  const excerpt = body.slice(0, 2000);
  return {
    request_url: url,
    final_url: response.url || url,
    http_status: response.status,
    status_text: response.statusText,
    headers,
    cloudflare_detected:
      response.headers.get('cf-mitigated') === 'challenge' ||
      /cf-chl-|__cf_chl|Just a moment\.\.\.|Cloudflare Ray ID/i.test(excerpt),
    response_body_excerpt: excerpt,
    response_body_truncated: body.length > 2000,
  };
}

/**
 * 对固定 Radio Garden API 路径发送普通 HTTP GET，不启动浏览器或尝试解验证码。
 * @param {string} pathname 调用方构造并校验过的 API 相对路径。
 * @param {{redirect?: RequestRedirect, fetchImpl?: typeof fetch, retry?: boolean}} [options] 请求行为。
 * @returns {Promise<{httpStatus: number, contentType: string, responseJson: string, data: object}>} 原始 JSON 文本和解析数据。
 */
export async function getJson(pathname, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = new URL(pathname, `${API_ROOT}/`);
  if (url.origin !== 'https://radio.garden' || !url.pathname.startsWith('/api/ara/content/')) {
    throw new Error('拒绝请求 Radio Garden API 之外的地址。');
  }
  const retry = options.retry ?? true;
  const maxAttempts = retry ? 3 : 1;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        redirect: options.redirect ?? 'follow',
        signal: AbortSignal.timeout(30000),
      });
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok) {
        const challenged = response.headers.get('cf-mitigated') === 'challenge';
        const responseBody = await response.text();
        const error = new Error(
          challenged
            ? `HTTP ${response.status}：Radio Garden 返回 Cloudflare 验证页。`
            : `HTTP ${response.status}：${url.pathname}`,
        );
        error.httpStatus = response.status;
        error.diagnostics = responseDiagnostics(response, url.href, responseBody);
        error.retryable = response.status === 429 || response.status >= 500;
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('retry-after'));
          error.retryAfterMs =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter * 1000, 300000)
              : 5000;
        }
        throw error;
      }
      if (!contentType.toLowerCase().includes('application/json')) {
        const responseBody = await response.text();
        const error = new Error(
          `HTTP ${response.status} 返回非 JSON 响应（${contentType || '无 Content-Type'}）。`,
        );
        error.httpStatus = response.status;
        error.diagnostics = responseDiagnostics(response, url.href, responseBody);
        error.retryable = false;
        throw error;
      }
      const responseJson = await response.text();
      let data;
      try {
        data = JSON.parse(responseJson);
      } catch {
        const error = new Error('接口返回了无效 JSON。');
        error.httpStatus = response.status;
        error.diagnostics = responseDiagnostics(response, url.href, responseJson);
        throw error;
      }
      if (!data || typeof data !== 'object' || Array.isArray(data) || !data.data) {
        const error = new Error('接口 JSON 缺少 data 对象。');
        error.httpStatus = response.status;
        error.diagnostics = responseDiagnostics(response, url.href, responseJson);
        throw error;
      }
      return { httpStatus: response.status, contentType, responseJson, data };
    } catch (error) {
      lastError = error;
      error.diagnostics ??= {
        request_url: url.href,
        error_name: error.name,
        cause: error.cause
          ? { name: error.cause.name, message: error.cause.message, code: error.cause.code }
          : undefined,
      };
      if (attempt >= maxAttempts || error.retryable === false || error.httpStatus === 403)
        throw error;
      const waitMs = error.retryAfterMs ?? attempt * 2000;
      console.warn(
        `${url.pathname} 第 ${attempt} 次请求失败，${waitMs}ms 后重试：${error.message}`,
      );
      await delay(waitMs);
    }
  }
  throw lastError;
}

/**
 * 读取地点的已注册电台列表，保留服务端原始 JSON 供文件和 SQLite 保存。
 * @param {string} placeId 已校验的 Radio Garden 地点 ID。
 * @param {object} [options] 注入 fetch 和重试参数，仅供调用方与本地验证使用。
 */
export async function getPlaceChannels(placeId, options) {
  return getJson(`page/${encodeURIComponent(placeId)}/channels?s=1&hl=zh-Hans`, options);
}

/**
 * 读取单个频道详情；频道 ID 必须来自地点频道列表。
 * @param {string} channelId 已校验的 Radio Garden 频道 ID。
 * @param {object} [options] 注入 fetch 和重试参数。
 */
export async function getChannelDetails(channelId, options) {
  return getJson(`channel/${encodeURIComponent(channelId)}?s=1&hl=zh-Hans`, options);
}

/**
 * 获取播放接口的 3xx Location，不跟随跳转，也不请求或下载音频内容。
 * @param {string} channelId 已校验的 Radio Garden 频道 ID。
 * @param {object} [options] 注入 fetch 和重试参数。
 * @returns {Promise<{httpStatus: number, redirectUrl: string}>} 流地址重定向信息。
 */
export async function getStreamRedirect(channelId, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = new URL(
    `listen/${encodeURIComponent(channelId)}/channel.mp3?s=1&hl=zh-Hans`,
    `${API_ROOT}/`,
  );
  const response = await fetchImpl(url, {
    headers: { Accept: '*/*', 'User-Agent': USER_AGENT },
    redirect: 'manual',
    signal: AbortSignal.timeout(30000),
  });
  const status = response.status;
  const location = response.headers.get('location');
  const responseBody = [301, 302, 303, 307, 308].includes(status) ? '' : await response.text();
  if (![301, 302, 303, 307, 308].includes(status)) {
    const error = new Error(
      status === 403 && response.headers.get('cf-mitigated') === 'challenge'
        ? 'Radio Garden 返回 Cloudflare 验证页。'
        : `播放接口预期返回 HTTP 3xx，实际为 HTTP ${status}。`,
    );
    error.httpStatus = status;
    error.diagnostics = responseDiagnostics(response, url.href, responseBody);
    throw error;
  }
  if (!location) {
    const error = new Error('播放接口的重定向响应没有 Location。');
    error.httpStatus = status;
    error.diagnostics = responseDiagnostics(response, url.href);
    throw error;
  }
  return { httpStatus: status, redirectUrl: new URL(location, url).href };
}
