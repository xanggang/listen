import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../src/index.ts';
import { SQLiteDatabase } from '../runtime/sqlite.ts';
import { LocalRateLimiter } from '../runtime/rate-limit.ts';
import type { ApiBindings } from '../src/types.ts';
import type { SqlDatabase, SqlStatement, SqlValue } from '../src/database/database.ts';

/**
 * 构造大于 Number 安全范围的 19 位测试 ID，避免测试意外依赖数值转换。
 */
function id(value: number): string {
  return `1234567890123456${String(value).padStart(3, '0')}`;
}
let db: SQLiteDatabase;
let env: ApiBindings;
let pending: Promise<unknown>[];
let cache: Map<string, Response>;

/**
 * 在内存创建与数据项目完全一致的新表结构，不接触已整理的真实库。
 */
function fixture(): SQLiteDatabase {
  const database = new SQLiteDatabase(':memory:', false);
  database.connection.exec(
    readFileSync(new URL('../migrations/0001_catalog.sql', import.meta.url), 'utf8'),
  );
  database.connection.exec(
    readFileSync(new URL('../migrations/0002_visit_metrics.sql', import.meta.url), 'utf8'),
  );
  database.connection.prepare('INSERT INTO country VALUES (?, ?, ?)').run(id(101), 'China', 'CN');
  database.connection
    .prepare('INSERT INTO language VALUES (?, ?, ?)')
    .run(id(102), 'English', 'en');
  database.connection.prepare('INSERT INTO tag VALUES (?, ?, ?)').run(id(103), 'pop', 'pop');
  database.connection.prepare('INSERT INTO tag VALUES (?, ?, ?)').run(id(104), 'kpop', 'kpop');
  for (let n = 1; n <= 25; n++) {
    database.connection
      .prepare(
        `INSERT INTO station (id,name,country_id,place,latitude,longitude,votes,source_type,catalog_status,visibility_status,created_at,updated_at)
      VALUES (?, ?, ?, 'Shanghai', 30, 120, 100, 'both', 'unverified', 'visible', '2026-09-30T00:00:00Z', '2026-09-30T00:00:00Z')`,
      )
      .run(id(n), n === 1 ? '100% Radio' : `Station ${n}`, id(101));
    database.connection
      .prepare(
        `INSERT INTO station_stream (id,station_id,url,resolved_url,is_primary) VALUES (?, ?, 'http://radio.test', 'https://radio.test', 1)`,
      )
      .run(id(200 + n), id(n));
    database.connection
      .prepare('INSERT INTO station_tag VALUES (?, ?)')
      .run(id(n), id(n % 2 ? 103 : 104));
    database.connection.prepare('INSERT INTO station_language VALUES (?, ?)').run(id(n), id(102));
  }
  return database;
}

// 每个测试隔离数据库、限流及缓存，避免顺序影响断言。
beforeEach(() => {
  db = fixture();
  pending = [];
  cache = new Map();
  env = {
    DB: db,
    ALLOWED_ORIGINS: 'https://web.test',
    READ_LIMITER: new LocalRateLimiter(180),
    SEARCH_LIMITER: new LocalRateLimiter(30),
    METRICS_LIMITER: new LocalRateLimiter(60),
  };
  Object.assign(globalThis, {
    caches: {
      default: {
        // 缓存克隆模拟 Worker 响应流隔离。
        async match(key: Request) {
          return cache.get(key.url)?.clone();
        },
        // 写缓存供命中测试使用。
        async put(key: Request, response: Response) {
          cache.set(key.url, response);
        },
      },
    },
  });
});
// 释放测试连接，不生成本地或远程数据库文件。
afterEach(() => db.close());

/**
 * 调用真实 Worker HTTP 入口，等待缓存任务后返回响应。
 */
async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await worker.fetch(new Request(`https://api.test/api${path}`, options), env, {
    // 捕获后台缓存任务，让响应断言保持确定性。
    waitUntil(promise: Promise<unknown>) {
      pending.push(promise);
    },
  } as ExecutionContext);
  await Promise.all(pending);
  pending = [];
  return response;
}

// 验证新库 ID 字符串、稳定分页和无重复记录。
test('station pagination preserves 19-digit IDs and stable ordering', async () => {
  const first = (await (await request('/stations?pageSize=10')).json()) as {
    data: { list: { id: string }[]; hasMore: boolean };
  };
  const last = (await (await request('/stations?page=3&pageSize=10')).json()) as {
    data: { list: { id: string }[]; hasMore: boolean; nextPage: number | null };
  };
  assert.equal(first.data.list[0].id, id(1));
  assert.equal(first.data.hasMore, true);
  assert.equal(last.data.list.length, 5);
  assert.equal(last.data.list[0].id, id(21));
  assert.equal(last.data.hasMore, false);
  assert.equal(last.data.nextPage, null);
});

// 关联 ID 精确匹配 pop 不会匹配 kpop；关键词覆盖地点和字面通配符。
test('relational filters are exact and keyword searches are literal', async () => {
  const response = (await (
    await request(
      `/stations?tagsId=${id(103)}&languagesId=${id(102)}&countriesId=${id(101)}&pageSize=100`,
    )
  ).json()) as { data: { list: { id: string }[] } };
  assert.equal(response.data.list.length, 13);
  assert.ok(
    response.data.list.every(
      // 仅奇数电台关联 pop 标签。
      (row) => Number(row.id.slice(-3)) % 2 === 1,
    ),
  );
  assert.equal((await request(`/stations?tagsId=${id(999)}`)).status, 400);
  const wildcard = (await (await request('/stations?keyword=%25')).json()) as {
    data: { list: unknown[] };
  };
  assert.equal(wildcard.data.list.length, 1);
  const place = (await (await request('/stations?keyword=Shanghai&pageSize=100')).json()) as {
    data: { list: unknown[] };
  };
  assert.equal(place.data.list.length, 25);
});

// 公开 API 在列表、地图、字典数量及详情中采用一致的可见性口径。
test('hidden and unavailable stations never appear in public endpoints', async () => {
  db.connection.prepare("UPDATE station SET visibility_status = 'hidden' WHERE id = ?").run(id(1));
  db.connection
    .prepare("UPDATE station SET catalog_status = 'unavailable' WHERE id = ?")
    .run(id(2));
  assert.equal((await request(`/stations/${id(1)}`)).status, 404);
  assert.equal((await request(`/stations/${id(2)}`)).status, 404);
  const stations = (await (await request('/stations?pageSize=100')).json()) as {
    data: { list: unknown[] };
  };
  assert.equal(stations.data.list.length, 23);
  const tags = (await (await request('/tags')).json()) as { data: { stationcount: number }[] };
  assert.equal(
    tags.data.reduce(
      // 关联统计排除不可见电台。
      (total, row) => total + row.stationcount,
      0,
    ),
    23,
  );
  const points = (await (await request('/map/stations')).json()) as { data: { list: unknown[] } };
  assert.equal(points.data.list.length, 23);
});

// 默认选流优先非失败流，所有流与链接仅在详情加载。
test('detail selects an eligible stream and exposes stream metadata and links', async () => {
  db.connection
    .prepare('UPDATE station_stream SET last_check_ok = 0 WHERE station_id = ?')
    .run(id(1));
  db.connection
    .prepare(
      'INSERT INTO station_stream (id,station_id,url,last_check_ok,is_hls) VALUES (?,?,?,1,NULL)',
    )
    .run(id(300), id(1), 'https://backup.test/live');
  db.connection
    .prepare('INSERT INTO station_link VALUES (?,?,?,?)')
    .run(id(301), id(1), 'web', 'https://site.test');
  const { data } = (await (await request(`/stations/${id(1)}`)).json()) as {
    data: {
      id: string;
      url: string;
      geoLat: number;
      sourceType: string;
      streams: { id: string; hls: null }[];
      links: unknown[];
    };
  };
  assert.equal(data.id, id(1));
  assert.equal(data.url, 'https://backup.test/live');
  assert.equal(data.streams[0].id, id(300));
  assert.equal(data.streams[0].hls, null);
  assert.equal(data.geoLat, 30);
  assert.equal(data.sourceType, 'both');
  assert.equal(data.links.length, 1);
});

// 游标分页不受排序票数变化影响，范围错误和重复参数均在查询前拒绝。
test('map cursor pagination uses string IDs without gaps', async () => {
  const first = (await (await request('/map/stations?limit=10')).json()) as {
    data: { list: unknown[]; nextCursor: string };
  };
  const next = (await (
    await request(`/map/stations?limit=20&after=${first.data.nextCursor}`)
  ).json()) as { data: { list: { id: string }[]; nextCursor: null } };
  assert.equal(first.data.nextCursor, id(10));
  assert.equal(next.data.list[0].id, id(11));
  assert.equal(next.data.list.length, 15);
  assert.equal(next.data.nextCursor, null);
  for (const path of [
    '/stations/42',
    '/stations/0',
    '/stations?pageSize=101',
    '/stations?page=1&page=2',
    '/stations?tagsId=abc',
    '/map/stations?limit=5001',
    '/map/stations?after=42',
  ]) {
    assert.equal((await request(path)).status, 400, path);
  }
});

// 标签分页与代码字段验证真实关联数量，不使用旧版预存计数。
test('catalog search paginates and returns country and language codes', async () => {
  const countries = (await (await request('/countries')).json()) as {
    data: { id: string; code: string; stationcount: number }[];
  };
  assert.equal(countries.data[0].code, 'CN');
  assert.equal(countries.data[0].stationcount, 25);
  const language = (await (await request('/languages')).json()) as { data: { code: string }[] };
  assert.equal(language.data[0].code, 'en');
  const tags = (await (await request('/tags?q=pop&limit=1&offset=1')).json()) as {
    data: { name: string }[];
  };
  assert.equal(tags.data[0].name, 'kpop');
  assert.equal((await request('/tags?limit=1001')).status, 400);
});

/**
 * 使用 D1 的异步语句形态包装同一 SQL 引擎，验证仓储没有 SQLite 专属 API 依赖。
 */
function d1Binding(database: SQLiteDatabase): SqlDatabase {
  return {
    // 包装独立参数绑定、first/all/run 的 D1 形态。
    prepare(sql: string): SqlStatement {
      let values: SqlValue[] = [];
      const statement = {
        // 模拟 D1 绑定值。
        bind(...args: SqlValue[]) {
          values = args;
          return statement;
        },
        // 单行查询返回 null 而不是 undefined。
        async first<T>(): Promise<T | null> {
          return (database.connection.prepare(sql).get(...values) as T | undefined) ?? null;
        },
        // 列表查询保持 D1 results 包装。
        async all<T>(): Promise<{ results: T[] }> {
          return { results: database.connection.prepare(sql).all(...values) as T[] };
        },
        // 写入交给真正的 SQLite 事务适配器，不在测试中实现非原子批次。
        async run() {
          return database.connection.prepare(sql).run(...values);
        },
      };
      return statement;
    },
    // 测试此绑定仅用于读取；统计事务另外验证实际 SQLite 适配器。
    async batch() {
      throw new Error('Not used by this read parity fixture');
    },
  };
}

// 两种数据库绑定运行相同 HTTP 业务，响应完全一致。
test('D1-shaped binding and SQLite adapter return identical catalog, detail and map data', async () => {
  env.CACHE_ENABLED = 'false';
  for (const path of [
    '/stations?pageSize=3',
    `/stations/${id(1)}`,
    `/stations?tagsId=${id(103)}`,
    '/tags',
    '/languages',
    '/countries',
    '/map/stations?limit=3',
    '/map/snapshot',
  ]) {
    env.DB = db;
    const sqlite = await (await request(path)).json();
    env.DB = d1Binding(db);
    const d1 = await (await request(path)).json();
    assert.deepEqual(d1, sqlite, path);
  }
});

// 缓存不会绕过限流或复用请求 ID；旧接口路径不保留。
test('cache, CORS, rate limits and sanitized errors remain enforced', async () => {
  const first = await request('/tags', { headers: { Origin: 'https://web.test' } });
  const second = await request('/tags');
  assert.equal(first.headers.get('Access-Control-Allow-Origin'), 'https://web.test');
  assert.equal(second.headers.get('Access-Control-Allow-Origin'), null);
  assert.notEqual(first.headers.get('X-Request-Id'), second.headers.get('X-Request-Id'));
  env.READ_LIMITER = {
    // 拒绝全部请求，验证缓存命中也受限流约束。
    async limit() {
      return { success: false };
    },
  };
  assert.equal((await request('/tags')).status, 429);
});

// 独立统计库保存 PV/UV，读取库没有写入；异常批次完全回滚。
test('metrics support atomic PV UV writes, rollup and separate databases', async () => {
  const metrics = new SQLiteDatabase(':memory:', false);
  metrics.connection.exec(
    readFileSync(new URL('../migrations/0002_visit_metrics.sql', import.meta.url), 'utf8'),
  );
  env.METRICS_DB = metrics;
  try {
    for (let n = 0; n < 2; n++) {
      assert.equal(
        (
          await request('/metrics/visit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              visitorId: '123e4567-e89b-42d3-a456-426614174000',
              page: 'map',
              source: 'android',
            }),
          })
        ).status,
        200,
      );
    }
    assert.equal(
      metrics.connection.prepare('SELECT SUM(pv) AS count FROM metric_daily_views').get()?.count,
      2,
    );
    assert.equal(
      metrics.connection.prepare('SELECT COUNT(*) AS count FROM metric_daily_unique').get()?.count,
      1,
    );
    assert.equal(
      db.connection.prepare('SELECT COUNT(*) AS count FROM metric_daily_views').get()?.count,
      0,
    );
    await assert.rejects(
      metrics.batch([
        metrics.prepare("INSERT INTO metric_daily_views VALUES ('2000-01-01','android','map',1)"),
        metrics.prepare('INSERT INTO nonexistent_table VALUES (1)'),
      ]),
    );
    assert.equal(
      metrics.connection
        .prepare("SELECT COUNT(*) AS count FROM metric_daily_views WHERE day='2000-01-01'")
        .get()?.count,
      0,
    );
    const { createServices } = await import('../src/services.ts');
    await createServices(db, metrics).metrics.rollup(new Date('2027-02-01T00:00:00Z'));
    assert.equal(
      metrics.connection.prepare('SELECT SUM(uv) AS count FROM metric_daily_uv').get()?.count,
      1,
    );
    assert.equal(
      metrics.connection.prepare('SELECT COUNT(*) AS count FROM metric_daily_unique').get()?.count,
      0,
    );
  } finally {
    metrics.close();
  }
});

// 防止数据工程与 API 的建表结构悄然漂移。
test('API catalog migration exactly matches the v2 data schema', () => {
  assert.equal(
    readFileSync(new URL('../migrations/0001_catalog.sql', import.meta.url), 'utf8'),
    readFileSync(new URL('../../worldTuner-data/v2/schema.sql', import.meta.url), 'utf8'),
  );
});

// 非法写入、旧路径和私有数据库异常均不能泄漏内部信息。
test('new API rejects legacy paths, unexpected writes and personal metrics fields', async () => {
  assert.equal((await request('/v1/stations')).status, 404);
  assert.equal((await request('/stations', { method: 'POST' })).status, 405);
  assert.equal(
    (
      await request('/metrics/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId: '123e4567-e89b-42d3-a456-426614174000',
          source: 'android',
          page: 'map',
          email: 'private@test.example',
        }),
      })
    ).status,
    400,
  );
  env.CACHE_ENABLED = 'false';
  env.DB = {
    // 模拟不可用连接，验证错误响应不包含内部路径。
    prepare() {
      throw new Error('private database path failure');
    },
    // 批处理不会在此测试调用。
    async batch() {
      return [];
    },
  };
  const failure = await request('/tags');
  assert.equal(failure.status, 500);
  assert.ok(!(await failure.text()).includes('private database'));
});

// 数据导出保留字符串 ID、引号和未知值，且不覆盖已有输出。
test('catalog export imports into an empty new schema without data loss', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { backup } = await import('node:sqlite');
  const { exportCatalog } = await import('../runtime/export-catalog.ts');
  const directory = mkdtempSync(join(tmpdir(), 'worldtuner-export-'));
  const source = join(directory, 'source.sqlite');
  const output = join(directory, 'catalog.sql');
  const target = new SQLiteDatabase(':memory:', false);
  try {
    db.connection.prepare('UPDATE station SET name = ? WHERE id = ?').run("O'Reilly\nRadio", id(1));
    await backup(db.connection, source);
    const counts = exportCatalog(source, output);
    assert.equal(counts.station, 25);
    const sql = readFileSync(output, 'utf8');
    assert.ok(!sql.includes('BEGIN TRANSACTION'));
    assert.ok(!sql.includes('CREATE TABLE'));
    target.connection.exec(
      readFileSync(new URL('../migrations/0001_catalog.sql', import.meta.url), 'utf8'),
    );
    target.connection.exec(sql);
    assert.equal(
      target.connection.prepare('SELECT name FROM station WHERE id = ?').get(id(1))?.name,
      "O'Reilly\nRadio",
    );
    assert.equal(target.connection.prepare('SELECT COUNT(*) AS n FROM station_tag').get()?.n, 25);
    assert.throws(
      // 已有导出必须保留，第二次需要选择另一个文件名。
      () => exportCatalog(source, output),
    );
    assert.equal(readFileSync(output, 'utf8'), sql);
    assert.deepEqual(target.connection.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    target.close();
    rmSync(directory, { recursive: true });
  }
});

// 压缩后的全量快照仍遵守可见性、字符串 ID 和固定经纬度顺序。
test('map snapshot gzip, conditional requests and encoding negotiation', async () => {
  const { gunzipSync } = await import('node:zlib');
  db.connection.prepare("UPDATE station SET visibility_status = 'hidden' WHERE id = ?").run(id(1));
  db.connection
    .prepare('UPDATE station SET longitude = -87.906471, latitude = 43.038901 WHERE id = ?')
    .run(id(2));
  const response = await request('/map/snapshot', {
    headers: { 'Accept-Encoding': 'gzip', Origin: 'https://web.test' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Encoding'), 'gzip');
  assert.match(response.headers.get('Cache-Control')!, /public, max-age=/);
  assert.match(response.headers.get('Vary')!, /Accept-Encoding/);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://web.test');
  assert.equal(response.headers.get('X-Snapshot-Expires'), null);
  assert.equal(response.headers.get('X-Snapshot-Encoding'), null);
  const data = JSON.parse(gunzipSync(new Uint8Array(await response.arrayBuffer())).toString()).data;
  assert.equal(data.count, 24);
  assert.deepEqual(data.points[0], [id(2), 'Station 2', -87.90647, 43.0389]);
  const etag = response.headers.get('ETag')!;
  assert.match(etag, /^W\/"[a-f0-9]{64}"$/);
  const unchanged = await request('/map/snapshot', {
    headers: { 'If-None-Match': `"other", ${etag}` },
  });
  assert.equal(unchanged.status, 304);
  assert.equal(await unchanged.text(), '');
  assert.equal(unchanged.headers.get('ETag'), etag);
  const identity = await request('/map/snapshot', {
    headers: { 'Accept-Encoding': 'gzip;q=0, *;q=1' },
  });
  assert.equal(identity.headers.get('Content-Encoding'), null);
  assert.equal(identity.headers.get('ETag'), etag);
  assert.deepEqual(((await identity.json()) as { data: unknown }).data, data);
  assert.equal((await request('/map/snapshot?limit=5000')).status, 400);
  assert.ok(
    [...cache.values()].every(
      // 边缘共享缓存不得保存某次请求的 CORS 或请求标识。
      (entry) =>
        !entry.headers.has('Access-Control-Allow-Origin') && !entry.headers.has('X-Request-Id'),
    ),
  );
});

// SQLite 进程缓存必须真实过期，Worker 边缘缓存也不能无限延长 TTL。
test('snapshot expires, changes ETag and supports zero TTL', async () => {
  const started = Date.now();
  let now = started;
  mock.method(
    Date,
    'now',
    // 控制时钟避免依赖等待或真实数据文件。
    () => now,
  );
  try {
    for (const edge of ['false', 'true']) {
      env.CACHE_ENABLED = edge;
      env.MAP_SNAPSHOT_CACHE_TTL_SECONDS = '60';
      const first = await request('/map/snapshot');
      const etag = first.headers.get('ETag')!;
      db.connection
        .prepare('UPDATE station SET name = ? WHERE id = ?')
        .run(`Changed ${edge}`, id(1));
      now += 10000;
      const cached = await request('/map/snapshot', { headers: { 'If-None-Match': etag } });
      assert.equal(cached.status, 304);
      assert.equal(cached.headers.get('Cache-Control'), 'public, max-age=50');
      now += 61000;
      const refreshed = await request('/map/snapshot', { headers: { 'If-None-Match': etag } });
      assert.equal(refreshed.status, 200);
      assert.notEqual(refreshed.headers.get('ETag'), etag);
      assert.equal(
        ((await refreshed.json()) as { data: { points: string[][] } }).data.points[0][1],
        `Changed ${edge}`,
      );
      now += 61000;
    }
    env.MAP_SNAPSHOT_CACHE_TTL_SECONDS = '0';
    const before = await request('/map/snapshot');
    db.connection.prepare('UPDATE station SET name = ? WHERE id = ?').run('Immediate', id(1));
    const after = await request('/map/snapshot', {
      headers: { 'If-None-Match': before.headers.get('ETag')! },
    });
    assert.equal(after.status, 200);
    assert.equal(after.headers.get('Cache-Control'), 'public, max-age=0');
  } finally {
    mock.restoreAll();
  }
});
