import test from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { mapSnapshotProxyResponse } from '../src/lib/map-snapshot-response.ts';

// Node gzip 与 ETag/缓存头保持一致，压缩不会改动业务正文。
test('Web snapshot compresses once and preserves cache headers', async () => {
  const body = '{"data":{"count":0,"points":[]}}';
  const headers = {
    'Content-Type': 'application/json',
    ETag: 'W/"test"',
    'Cache-Control': 'public, max-age=299',
  };
  const compressed = mapSnapshotProxyResponse(new Response(body, { headers }), 'gzip', false);
  assert.equal(compressed.headers.get('Content-Encoding'), 'gzip');
  assert.equal(gunzipSync(new Uint8Array(await compressed.arrayBuffer())).toString(), body);
  assert.equal(compressed.headers.get('ETag'), headers.ETag);
  assert.equal(compressed.headers.get('Cache-Control'), headers['Cache-Control']);
  const identity = mapSnapshotProxyResponse(
    new Response(body, { headers }),
    'gzip;q=0, *;q=1',
    false,
  );
  assert.equal(identity.headers.get('Content-Encoding'), null);
  assert.equal(await identity.text(), body);
  // Worker 的外层 Response 才执行自动编码，路由不手动再压缩。
  const automatic = mapSnapshotProxyResponse(new Response(body, { headers }), 'gzip', true);
  assert.equal(automatic.headers.get('Content-Encoding'), 'gzip');
  assert.equal(await automatic.text(), body);
});

// 条件响应必须无正文，也不能携带 gzip 编码头。
test('Web snapshot forwards empty 304', async () => {
  const response = mapSnapshotProxyResponse(
    new Response(null, { status: 304, headers: { ETag: 'W/"test"' } }),
    'gzip',
    false,
  );
  assert.equal(response.status, 304);
  assert.equal(response.headers.get('Content-Encoding'), null);
  assert.equal(await response.text(), '');
});
