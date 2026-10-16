import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { SQLiteDatabase } from '../runtime/sqlite.ts';
import { adminApp } from '../src/app.ts';
import type { AdminBindings } from '../src/types.ts';
import { deliverAudit } from '../src/audit/audit.repository.ts';

const token = 'local-development-token-12345678901234567890';
const country = '1234567890123456701';
const station = '1234567890123456702';
const stream = '1234567890123456703';
let db: SQLiteDatabase;
let ops: SQLiteDatabase;
let env: AdminBindings;
let csrf = '';
// 每个用例使用独立内存库，管理测试不读写真实目录或生产 D1。
beforeEach(async () => {
  db = new SQLiteDatabase(':memory:', false);
  ops = new SQLiteDatabase(':memory:', false);
  db.connection.exec(
    readFileSync(new URL('../../worldTuner-data/v2/schema.sql', import.meta.url), 'utf8'),
  );
  db.connection.exec(
    readFileSync(
      new URL('../../worldTuner-data/v2/migrations/0002_admin_outbox.sql', import.meta.url),
      'utf8',
    ),
  );
  for (const file of ['0001_operations.sql', '0002_admin.sql'])
    ops.connection.exec(
      readFileSync(
        new URL(`../../worldTuner-data/operations/migrations/${file}`, import.meta.url),
        'utf8',
      ),
    );
  ops.connection
    .prepare(
      "INSERT INTO admin_actors VALUES ('owner','local','local-owner','admin@test.invalid','owner',1)",
    )
    .run();
  db.connection
    .prepare(
      "INSERT INTO country(id,name,code,name_en,name_zh) VALUES (?,'China','CN','China','中国')",
    )
    .run(country);
  for (const [id, publicId, visibility] of [
    [station, 'Abc1234', 'visible'],
    ['1234567890123456704', 'Abc1235', 'hidden'],
  ])
    db.connection
      .prepare(
        "INSERT INTO station(id,public_id,name,country_id,source_type,catalog_status,visibility_status,created_at,updated_at) VALUES (?,?,'Radio',?,'both','active',?,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')",
      )
      .run(id, publicId, country, visibility);
  db.connection
    .prepare(
      "INSERT INTO station_stream(id,station_id,url,is_primary) VALUES (?,?,'http://radio.invalid/live',1)",
    )
    .run(stream, station);
  env = {
    DB: db,
    METRICS_DB: ops,
    DEPLOYMENT_ENV: 'local',
    ADMIN_ORIGIN: 'http://127.0.0.1:5173',
    ADMIN_LOCAL_TOKEN: token,
  };
  csrf = '';
  const response = await call('/me');
  csrf = ((await response.json()) as { data: { csrfToken: string } }).data.csrfToken;
});
// 断开全部测试数据库并恢复网络 mock，不保留认证凭据。
afterEach(() => {
  db.close();
  ops.close();
  mock.restoreAll();
});

/**
 * 调用独立管理入口；默认模拟同源浏览器身份，测试可显式覆盖安全标头。
 */
async function call(path: string, options: RequestInit = {}, authenticated = true) {
  const headers = new Headers({ ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) });
  if (options.method && options.method !== 'GET') {
    headers.set('Origin', env.ADMIN_ORIGIN);
    headers.set('Content-Type', 'application/json');
    headers.set('X-CSRF-Token', csrf);
  }
  new Headers(options.headers).forEach(
    // 安全失败用例可覆盖单个请求标头。
    (value, key) => headers.set(key, value),
  );
  return adminApp.fetch(
    new Request(
      `${env.ADMIN_ORIGIN}${path.startsWith('/admin/') || path === '/' ? path : `/admin/api${path}`}`,
      { ...options, headers },
    ),
    env,
  );
}

// 角色、CSRF 与凭据只由受保护会话接口返回，所有管理响应 no-store。
test('admin authentication fails closed and me returns bounded session', async () => {
  assert.equal((await call('/me', {}, false)).status, 401);
  const response = await call('/me');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = (await response.json()) as { data: { id: string; role: string; csrfToken: string } };
  assert.equal(body.data.role, 'owner');
  assert.equal(body.data.csrfToken.length, 64);
  assert.ok(!JSON.stringify(body).includes(token));
  ops.connection.prepare("UPDATE admin_actors SET enabled=0 WHERE id='owner'").run();
  assert.equal((await call('/me')).status, 403);
});

// 本地密钥不能在生产环境或非 loopback URL 使用，静态资源也不绕过生产鉴权。
test('production rejects local bearer and protects static assets', async () => {
  env.DEPLOYMENT_ENV = 'production';
  env.ASSETS = {
    // 只有经过认证的请求才能进入静态资源绑定。
    fetch: async () => new Response('private admin html'),
  } as unknown as Fetcher;
  assert.equal((await call('/me')).status, 401);
  assert.equal((await call('/')).status, 401);
  env.DEPLOYMENT_ENV = 'local';
  assert.equal(
    (
      await adminApp.fetch(
        new Request('https://example.com/admin/api/me', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        env,
      )
    ).status,
    403,
  );
});

// 每种管理写入都由统一中间件执行角色、同源与 CSRF 检查。
test('writes enforce owner, origin and csrf on every route', async () => {
  const body = JSON.stringify({ visibility: 'hidden', expectedUpdatedAt: '2026-01-01T00:00:00Z' });
  assert.equal(
    (
      await call('/stations/Abc1234/visibility', {
        method: 'PUT',
        body,
        headers: { Origin: 'https://evil.invalid' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call('/stations/Abc1234/visibility', {
        method: 'PUT',
        body,
        headers: { 'X-CSRF-Token': 'wrong' },
      })
    ).status,
    403,
  );
  ops.connection.prepare("UPDATE admin_actors SET role='viewer' WHERE id='owner'").run();
  assert.equal((await call('/stations')).status, 200);
  for (const path of [
    '/stations/Abc1234/visibility',
    `/catalog/countries/${country}`,
    '/reports/report/status',
  ])
    assert.equal((await call(path, { method: 'PUT', body })).status, 403);
});

// 管理列表包括隐藏数据，管理入口不注册公开客户端路由。
test('management lists hidden stations without registering client routes', async () => {
  const body = (await (await call('/stations')).json()) as {
    data: { list: { id: string }[]; total: number };
  };
  assert.equal(body.data.total, 2);
  assert.deepEqual(
    body.data.list.map(
      // 验证 DTO 仅暴露 public_id。
      (row) => row.id,
    ),
    ['Abc1234', 'Abc1235'],
  );
  assert.equal((await call(`/stations?countryId=${country}&visibility=hidden`)).status, 200);
  assert.equal((await call('/stations?visibility=all')).status, 400);
  const response = await adminApp.fetch(
    new Request(`${env.ADMIN_ORIGIN}/api/stations`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    env,
  );
  assert.equal(response.status, 404);
});

// 保存与审计写在各自正确数据库，原状态版本重放不能覆盖已保存结果。
test('visibility update uses optimistic locking and durable audit', async () => {
  const options = {
    method: 'PUT',
    body: JSON.stringify({ visibility: 'hidden', expectedUpdatedAt: '2026-01-01T00:00:00Z' }),
  };
  const result = await call('/stations/Abc1234/visibility', options);
  assert.equal(result.status, 200);
  const updated = (await result.json()) as { data: { updatedAt: string } };
  assert.notEqual(updated.data.updatedAt, '2026-01-01T00:00:00Z');
  assert.equal((await call('/stations/Abc1234/visibility', options)).status, 409);
  assert.equal(
    ops.connection.prepare('SELECT COUNT(*) AS count FROM admin_audit_events').get()?.count,
    1,
  );
  assert.equal(
    db.connection
      .prepare('SELECT COUNT(*) AS count FROM admin_outbox WHERE delivered_at IS NOT NULL')
      .get()?.count,
    1,
  );
  await deliverAudit(db, ops);
  assert.equal(
    ops.connection.prepare('SELECT COUNT(*) AS count FROM admin_audit_events').get()?.count,
    1,
  );
});

// 运营故障不能丢失已经提交的审计，恢复后使用同一事件 ID 去重投递。
test('audit survives operations failure and retry delivery is idempotent', async () => {
  ops.connection.exec('DROP TABLE admin_audit_events');
  const response = await call('/stations/Abc1234/visibility', {
    method: 'PUT',
    body: JSON.stringify({ visibility: 'hidden', expectedUpdatedAt: '2026-01-01T00:00:00Z' }),
  });
  assert.equal(response.status, 200);
  assert.equal(
    db.connection
      .prepare('SELECT COUNT(*) AS count FROM admin_outbox WHERE delivered_at IS NULL')
      .get()?.count,
    1,
  );
  ops.connection.exec(
    readFileSync(
      new URL('../../worldTuner-data/operations/migrations/0002_admin.sql', import.meta.url),
      'utf8',
    ),
  );
  await deliverAudit(db, ops);
  await deliverAudit(db, ops);
  assert.equal(
    ops.connection.prepare('SELECT COUNT(*) AS count FROM admin_audit_events').get()?.count,
    1,
  );
});

// 编辑流只允许自身关联；输入无效或数据库拒绝时不会留下半次业务修改。
test('station edits validate urls, coordinates, stream ownership and version', async () => {
  const base = {
    expectedUpdatedAt: '2026-01-01T00:00:00Z',
    name: 'Updated',
    status: 'active',
    place: null,
    countryId: country,
    website: null,
    favicon: null,
    latitude: 30,
    longitude: 120,
  };
  assert.equal(
    (
      await call('/stations/Abc1234', {
        method: 'PUT',
        body: JSON.stringify({ ...base, latitude: 91 }),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call('/stations/Abc1234', {
        method: 'PUT',
        body: JSON.stringify({ ...base, website: 'javascript:alert(1)' }),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call('/stations/Abc1234', {
        method: 'PUT',
        body: JSON.stringify({ ...base, unknown: 'field' }),
      })
    ).status,
    400,
  );
  const streamEdit = {
    expectedUpdatedAt: base.expectedUpdatedAt,
    url: 'https://new.invalid/live',
    resolvedUrl: null,
    codec: 'mp3',
    bitrate: 128,
    isHls: false,
  };
  assert.equal(
    (
      await call(`/stations/Abc1235/streams/${stream}`, {
        method: 'PUT',
        body: JSON.stringify(streamEdit),
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call(`/stations/Abc1234/streams/${stream}`, {
        method: 'PUT',
        body: JSON.stringify(streamEdit),
      })
    ).status,
    200,
  );
  assert.equal(
    db.connection.prepare('SELECT url FROM station_stream WHERE id=?').get(stream)?.url,
    streamEdit.url,
  );
  assert.equal(
    (await call('/stations/Abc1234', { method: 'PUT', body: JSON.stringify(base) })).status,
    409,
  );
});

// 翻译冲突不覆盖人工校订，不允许输入任意表名或改写来源原名。
test('catalog edits preserve identity and detect translation conflicts', async () => {
  const body = JSON.stringify({
    nameEn: 'China',
    nameZh: '中华人民共和国',
    expectedNameEn: 'China',
    expectedNameZh: '中国',
  });
  assert.equal((await call(`/catalog/countries/${country}`, { method: 'PUT', body })).status, 200);
  assert.equal((await call(`/catalog/countries/${country}`, { method: 'PUT', body })).status, 409);
  assert.equal(db.connection.prepare('SELECT name FROM country').get()?.name, 'China');
  assert.equal((await call('/catalog/sqlite_master')).status, 404);
  assert.equal((await call('/catalog/countries?q=%E4%B8%AD')).status, 200);
});

// 日 UV 使用去重或历史汇总二选一，月活不由日 UV 累计得到。
test('analytics uses UTC, per-platform UV and nonduplicated monthly counts', async () => {
  const day = new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  ops.connection.prepare("INSERT INTO metric_daily_views VALUES (?,'web','map',5)").run(day);
  ops.connection.prepare("INSERT INTO metric_daily_unique VALUES (?,'web','hash')").run(day);
  ops.connection.prepare("INSERT INTO metric_monthly_unique VALUES (?,'web','hash')").run(month);
  ops.connection.prepare("INSERT INTO metric_daily_uv VALUES (?,'web',3)").run(day);
  const response = await call(`/analytics?from=${day}&to=${day}`);
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    data: { daily: { pv: number; uv: number }[]; monthly: { mau: number }[] };
  };
  assert.equal(body.data.daily[0].pv, 5);
  assert.equal(body.data.daily[0].uv, 3);
  assert.equal(body.data.monthly[0].mau, 1);
  for (const query of [
    'from=invalid',
    'to=invalid',
    'from=2020-01-01&to=2026-01-01',
    'source=ios',
    'from=2026-02-30',
  ])
    assert.equal((await call(`/analytics?${query}`)).status, 400);
  assert.equal((await call('/analytics/overview')).status, 200);
});

// 报告处理与审计同库事务，首版运行日志入口只返回固定控制台地址。
test('reports, audit and logs return honest capabilities and require bounded inputs', async () => {
  const empty = (await (await call('/reports')).json()) as { data: { ingestionEnabled: boolean } };
  assert.equal(empty.data.ingestionEnabled, false);
  ops.connection
    .prepare(
      "INSERT INTO client_error_events(id,fingerprint,platform,app_version,event_type,error_code,message,created_at) VALUES ('r1','f','android','1.0','playback','source','Failed','2026-01-01')",
    )
    .run();
  const options = {
    method: 'PUT',
    body: JSON.stringify({ status: 'resolved', expectedStatus: 'open' }),
  };
  assert.equal((await call('/reports/r1/status', options)).status, 200);
  assert.equal((await call('/reports/r1/status', options)).status, 409);
  const audit = (await (await call('/audit')).json()) as { data: { total: number } };
  assert.equal(audit.data.total, 1);
  const logs = (await (await call('/logs')).json()) as {
    data: { queryEnabled: boolean; consoleUrl: string };
  };
  assert.equal(logs.data.queryEnabled, false);
  assert.equal(logs.data.consoleUrl, 'https://dash.cloudflare.com/');
  assert.equal((await call('/reports?pageSize=100000')).status, 400);
  assert.equal((await call('/admin/api/not-found')).status, 404);
  assert.equal(
    (await call('/stations/Abc1234', { method: 'PUT', body: 'x'.repeat(17000) })).status,
    413,
  );
});

// 真正签名的 JWT 覆盖 issuer/audience/过期/签名校验与身份白名单，不只测请求头存在。
test('Access validates signed JWT, audience, issuer, expiry and explicit admin mapping', async () => {
  const issuer = `https://team-${crypto.randomUUID().slice(0, 8)}.cloudflareaccess.com`;
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test-key';
  jwk.alg = 'RS256';
  mock.method(
    globalThis,
    'fetch',
    // 只允许服务端配置的证书地址，令牌声明不能控制网络目标。
    async (url: unknown) => {
      assert.equal(String(url), `${issuer}/cdn-cgi/access/certs`);
      return Response.json({ keys: [jwk] });
    },
  );
  env.DEPLOYMENT_ENV = 'production';
  env.ACCESS_ISSUER = issuer;
  env.ACCESS_AUDIENCE = 'admin-audience';
  env.CSRF_SECRET = token;
  ops.connection
    .prepare(
      "INSERT INTO admin_actors VALUES ('access-owner',?,'subject-1','access@test.invalid','owner',1)",
    )
    .run(issuer);
  /**
   * 构造可单独覆盖错误 claim 的测试令牌，不使用真实 Access 凭据。
   */
  async function signed(
    aud = 'admin-audience',
    iss = issuer,
    exp = Math.floor(Date.now() / 1000) + 300,
    subject = 'subject-1',
  ) {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject(subject)
      .setIssuer(iss)
      .setAudience(aud)
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(privateKey);
  }
  const valid = await signed();
  assert.equal(
    (await call('/me', { headers: { 'Cf-Access-Jwt-Assertion': valid } }, false)).status,
    200,
  );
  for (const invalid of [
    await signed('wrong'),
    await signed('admin-audience', 'https://evil.invalid'),
    await signed('admin-audience', issuer, 1),
    `${valid.slice(0, -10)}abcdefghij`,
  ])
    assert.equal(
      (await call('/me', { headers: { 'Cf-Access-Jwt-Assertion': invalid } }, false)).status,
      401,
    );
  assert.equal(
    (
      await call(
        '/me',
        {
          headers: {
            'Cf-Access-Jwt-Assertion': await signed(
              'admin-audience',
              issuer,
              Math.floor(Date.now() / 1000) + 300,
              'unknown-sub',
            ),
          },
        },
        false,
      )
    ).status,
    403,
  );
});

// 基本编辑可修正目录状态，外键输入错误应在业务层返回 400，不产生半次审计。
test('basic station edits persist validated fields and reject missing countries', async () => {
  const body = {
    expectedUpdatedAt: '2026-01-01T00:00:00Z',
    name: 'Corrected Radio',
    status: 'unavailable',
    place: 'Shanghai',
    countryId: country,
    website: 'https://radio.invalid',
    favicon: null,
    latitude: 31,
    longitude: 121,
  };
  const invalid = await call('/stations/Abc1234', {
    method: 'PUT',
    body: JSON.stringify({ ...body, countryId: '9999999999999999999' }),
  });
  assert.equal(invalid.status, 400);
  const saved = await call('/stations/Abc1234', { method: 'PUT', body: JSON.stringify(body) });
  assert.equal(saved.status, 200);
  const data = (await saved.json()) as { data: { name: string; status: string; latitude: number } };
  assert.equal(data.data.name, body.name);
  assert.equal(data.data.status, 'unavailable');
  assert.equal(data.data.latitude, 31);
  assert.equal(
    ops.connection.prepare('SELECT COUNT(*) AS count FROM admin_audit_events').get()?.count,
    1,
  );
});

// JSON 对象不能通过字符串强制转换触发内部异常，枚举输入必须先校验原始类型。
test('enum payload objects are rejected as input errors', async () => {
  const response = await call('/stations/Abc1234/visibility', {
    method: 'PUT',
    body: JSON.stringify({
      visibility: { toString: null },
      expectedUpdatedAt: '2026-01-01T00:00:00Z',
    }),
  });
  assert.equal(response.status, 400);
  assert.equal(
    (
      await call('/reports/r1/status', {
        method: 'PUT',
        body: JSON.stringify({ status: { toString: null }, expectedStatus: 'open' }),
      })
    ).status,
    400,
  );
});
