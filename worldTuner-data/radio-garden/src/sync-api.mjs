import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { extractChannels, readPlaceIds, runBatch } from './crawler.mjs';
import { getChannelDetails, getPlaceChannels, getStreamRedirect } from './api/client.mjs';
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
const endpoints = {
  places: 'places_channels',
  details: 'channel_details',
  streams: 'stream_redirect',
};

/**
 * 通过 Node 原生 fetch 独立执行一个采集阶段；无 Chrome 会话，遇 Cloudflare 验证记失败并停止。
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
      '用法：npm run sync:radio-garden:api -- --phase places|details|streams [--limit N] [--delay-ms N]',
    );
    return;
  }
  const phase = values.phase ?? 'places';
  if (!Object.hasOwn(endpoints, phase))
    throw new Error('--phase 必须为 places、details 或 streams。');
  const limit = values.limit === undefined ? Number.MAX_SAFE_INTEGER : Number(values.limit);
  const delayMs = values['delay-ms'] === undefined ? 2000 : Number(values['delay-ms']);
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
  try {
    let ids;
    if (phase === 'places') ids = await readPlaceIds();
    else ids = listChannelIds(db);
    if (!ids.length && phase !== 'places') {
      throw new Error('没有已发现的频道 ID；请先运行 --phase places。');
    }
    const endpoint = endpoints[phase];
    const request =
      phase === 'places'
        ? async (_page, placeId) => {
            const response = await getPlaceChannels(placeId);
            const relations = extractChannels(response.data, placeId);
            return { ...response, relations };
          }
        : phase === 'details'
          ? async (_page, channelId) => getChannelDetails(channelId)
          : async (_page, channelId) => getStreamRedirect(channelId);
    console.log(
      `Radio Garden 直接接口阶段 ${phase}：本次最多处理 ${Math.min(ids.length, limit)}/${ids.length} 个 ID。`,
    );
    const result = await runBatch({
      endpoint,
      ids,
      page: null,
      db,
      request,
      saveSuccess:
        phase === 'streams'
          ? async (_record, _relations, original) => saveRedirect(db, original)
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
    db.close();
  }
}

// 用清晰错误结束失败阶段，SQLite 会保留已完成项以便之后续跑。
main().catch((error) => {
  console.error(`Radio Garden 直接接口采集失败：${error.message}`);
  process.exitCode = 1;
});
