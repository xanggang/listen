import assert from 'node:assert/strict';
import test from 'node:test';
import { buildListenApiUrl } from '../src/lib/listen-api-url.ts';

// 本地与线上采用同一拼接规则，地图、列表和写入统计均保留代理前缀。
test('API URLs preserve the service prefix and query parameters', () => {
  for (const base of ['https://tuner.naxi.fun/client', 'https://tuner.naxi.fun/client/']) {
    for (const path of [
      '/api/health',
      '/api/map/snapshot',
      '/api/metrics/visit',
      '/api/stations?page=2&keyword=%E4%B8%AD%E5%9B%BD',
    ]) {
      assert.equal(buildListenApiUrl(path, base).href, `https://tuner.naxi.fun/client${path}`);
    }
  }
  assert.equal(
    buildListenApiUrl('/api/health', 'http://127.0.0.1:8787').href,
    'http://127.0.0.1:8787/api/health',
  );
});
