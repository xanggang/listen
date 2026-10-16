import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiRequest,
  loadSession,
  save,
  AdminApiError,
} from '../src/lib/api.ts';
// 每个用例恢复网络 mock；本地连接不配置或发送开发密钥。
afterEach(() => {
  mock.restoreAll();
});
// 管理请求始终同源，自动读取本地会话且不发送开发认证头。
test('admin client rejects external URLs and requests preserve same-origin security', async () => {
  await assert.rejects(apiRequest('https://evil.invalid/admin/api/me'));
  mock.method(
    globalThis,
    'fetch',
    // 检查请求只带必要标头，并从安全契约读取 data。
    async (path: string, options: RequestInit) => {
      assert.equal(path, '/admin/api/me');
      assert.equal(options.credentials, 'same-origin');
      assert.equal(options.cache, 'no-store');
      assert.equal(new Headers(options.headers).get('Authorization'), null);
      return Response.json({
        data: { id: 'owner', role: 'owner', csrfToken: 'csrf-value' },
      });
    },
  );
  assert.equal((await loadSession()).role, 'owner');
});
// 每次写入前刷新会话与 CSRF，乐观锁正文原样传递，不自动重试保存。
test('save refreshes csrf and retains optimistic version', async () => {
  const calls: string[] = [];
  mock.method(
    globalThis,
    'fetch',
    // 第一轮返回会话，第二轮检查真实写入头和版本正文。
    async (path: string, options: RequestInit) => {
      calls.push(path);
      if (path.endsWith('/me'))
        return Response.json({ data: { csrfToken: 'new-csrf' } });
      assert.equal(options.method, 'PUT');
      assert.equal(
        new Headers(options.headers).get('X-CSRF-Token'),
        'new-csrf',
      );
      assert.deepEqual(JSON.parse(String(options.body)), {
        expectedUpdatedAt: 'version',
      });
      return Response.json({ data: { saved: true } });
    },
  );
  await save('/admin/api/stations/Abc1234', { expectedUpdatedAt: 'version' });
  assert.equal(calls.length, 2);
});
// Access 过期可能返回 HTML；显示安全错误及请求 ID，不向界面输出整页或密钥。
test('API failures retain status and request ID without exposing raw response', async () => {
  mock.method(
    globalThis,
    'fetch',
    // 模拟过期认证返回的 HTML。
    async () =>
      new Response('<html>private response</html>', {
        status: 401,
        headers: { 'X-Request-Id': 'request-1' },
      }),
  );
  await assert.rejects(
    apiRequest('/admin/api/me'),
    // 判断错误元信息，不依赖服务端错误页文案。
    (error: unknown) =>
      error instanceof AdminApiError &&
      error.status === 401 &&
      error.requestId === 'request-1' &&
      !error.message.includes('private'),
  );
});
