import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/index.ts';

let db;
let env;
let pending;
let cache;
let reads;
beforeEach(
  /** 为每个测试创建隔离的 SQLite 数据、限流替身和缓存，防止测试互相影响。 */
  () => {
    db?.close();
    db = new DatabaseSync(':memory:');
    for (const name of ['0001_existing_schema.sql', '0002_query_indexes.sql'])
      db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
    db.exec(`INSERT INTO languages(id,name,stationcount) VALUES(1,'English',10),(2,'Chinese',2);
    INSERT INTO tags(id,name,stationcount) VALUES(1,'pop',9),(2,'jazz',3);
    INSERT INTO countries(id,name,stationcount) VALUES(1,'China',2);`);
    const insert = db.prepare(
      'INSERT INTO station(id,name,url,url_resolved,language,tags,votes,geo_lat,geo_long) VALUES(?,?,?,?,?,?,?,?,?)',
    );
    for (let i = 1; i <= 25; i++)
      insert.run(
        i,
        i === 1 ? '100% Radio' : `Station ${i}`,
        'http://radio.test',
        'https://radio.test',
        i <= 20 ? 'English' : 'Chinese',
        i % 2 ? 'pop' : 'jazz',
        100,
        30,
        120,
      );
    reads = 0;
    env = {
      ALLOWED_ORIGINS: 'https://web.test',
      READ_LIMITER: { /** 模拟请求仍有可用限流额度。 */ limit: async () => ({ success: true }) },
      SEARCH_LIMITER: { /** 模拟请求仍有可用限流额度。 */ limit: async () => ({ success: true }) },
      DB: {
        /** 用内存 SQLite 模拟 D1 prepare，保留绑定参数与实际 SQL 语义。 */
        prepare(sql) {
          let args = [];
          const stmt = {
            /** 保存 SQL 绑定参数并返回可链式调用的语句。 */
            bind(...values) {
              args = values;
              return stmt;
            },
            /** 执行单行查询，并累计数据库读取次数。 */
            async first() {
              reads++;
              return db.prepare(sql).get(...args) ?? null;
            },
            /** 执行列表查询，包装成 D1 results 结构。 */
            async all() {
              reads++;
              return { results: db.prepare(sql).all(...args) };
            },
          };
          return stmt;
        },
      },
    };
    cache = new Map();
    globalThis.caches = {
      default: {
        /** 返回缓存克隆，模拟 Cache API 的响应流隔离。 */
        async match(key) {
          return cache.get(key.url)?.clone();
        },
        /** 保存测试缓存项以验证后续命中。 */
        async put(key, response) {
          cache.set(key.url, response);
        },
      },
    };
    pending = [];
  },
);
/** 调用真实应用入口并等待后台缓存任务，返回可断言的 HTTP 响应。 */
async function request(path, options = {}) {
  const response = await worker.fetch(new Request(`https://api.test/api/v1${path}`, options), env, {
    /** 收集后台任务，供请求辅助函数等待完成。 */
    waitUntil(p) {
      pending.push(p);
    },
  });
  await Promise.all(pending);
  return response;
}

test('stable pagination has no skipped rows and reports the last page' /** 验证：stable pagination has no skipped rows and reports the last page。 */, async () => {
  const first = await (await request('/stations?pageSize=10')).json();
  const second = await (await request('/stations?page=2&pageSize=10')).json();
  const last = await (await request('/stations?page=3&pageSize=10')).json();
  assert.deepEqual(
    first.data.list.map(/** 提取电台 id，验证分页顺序及完整性。 */ (x) => x.id),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.deepEqual(
    second.data.list.map(/** 提取电台 id，验证分页顺序及完整性。 */ (x) => x.id),
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  );
  assert.equal(last.data.list.length, 5);
  assert.equal(last.data.hasMore, false);
  assert.equal(last.data.nextPage, null);
});
test('validation rejects abusive or ambiguous queries before reading D1' /** 验证：validation rejects abusive or ambiguous queries before reading D1。 */, async () => {
  for (const query of [
    'page=0',
    'pageSize=101',
    'page=1.2',
    'page=10000&pageSize=100',
    'page=1&page=2',
    'unknown=x',
    `keyword=${'a'.repeat(101)}`,
  ]) {
    assert.equal((await request(`/stations?${query}`)).status, 400, query);
  }
  assert.equal(reads, 0);
});
test('filter IDs, combined filters and literal wildcard searches' /** 验证：filter IDs, combined filters and literal wildcard searches。 */, async () => {
  const result = await (await request('/stations?languagesId=2&tagsId=1')).json();
  assert.deepEqual(
    result.data.list.map(/** 提取电台 id，验证分页顺序及完整性。 */ (x) => x.id),
    [21, 23, 25],
  );
  assert.equal((await request('/stations?languagesId=999')).status, 400);
  const literal = await (await request('/stations?keyword=%25')).json();
  assert.equal(literal.data.list.length, 1);
});
test('detail uses Web DTO names and proper not-found responses' /** 验证：detail uses Web DTO names and proper not-found responses。 */, async () => {
  const { data } = await (await request('/stations/1')).json();
  assert.equal(data.urlResolved, 'https://radio.test');
  assert.equal(data.geoLat, 30);
  assert.equal(data.url_resolved, undefined);
  assert.equal((await request('/stations/999')).status, 404);
  assert.equal((await request('/stations/0')).status, 400);
});
test('dictionary endpoints are sorted and bounded' /** 验证：dictionary endpoints are sorted and bounded。 */, async () => {
  assert.equal((await (await request('/languages?limit=1')).json()).data.length, 1);
  assert.equal((await (await request('/tags')).json()).data.length, 2);
  assert.equal((await (await request('/countries')).json()).data.length, 1);
  assert.equal((await request('/tags?limit=1001')).status, 400);
});
test('cached data avoids DB reads but never reuses CORS or request IDs' /** 验证：cached data avoids DB reads but never reuses CORS or request IDs。 */, async () => {
  const first = await request('/stations?page=1&pageSize=10', {
    headers: { Origin: 'https://web.test' },
  });
  const count = reads;
  const second = await request('/stations?pageSize=10&page=1', {
    headers: { Origin: 'https://other.test' },
  });
  assert.equal(reads, count);
  assert.equal(first.headers.get('Access-Control-Allow-Origin'), 'https://web.test');
  assert.equal(second.headers.get('Access-Control-Allow-Origin'), null);
  assert.notEqual(first.headers.get('X-Request-Id'), second.headers.get('X-Request-Id'));
});
test('rate limiting also applies to cache hits and search has a separate limit' /** 验证：rate limiting also applies to cache hits and search has a separate limit。 */, async () => {
  await request('/stations');
  env.READ_LIMITER.limit = /** 模拟限流额度耗尽。 */ async () => ({ success: false });
  const response = await request('/stations');
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
  env.READ_LIMITER.limit = /** 模拟请求仍有可用限流额度。 */ async () => ({ success: true });
  env.SEARCH_LIMITER.limit = /** 模拟限流额度耗尽。 */ async () => ({ success: false });
  assert.equal((await request('/stations?keyword=radio')).status, 429);
});
test('read-only API and sanitized errors' /** 验证：read-only API and sanitized errors。 */, async () => {
  assert.equal((await request('/stations', { method: 'POST' })).status, 405);
  assert.equal((await request('/missing')).status, 404);
  assert.equal((await request('/stations', { method: 'OPTIONS' })).status, 204);
  env.DB.prepare =
    /** 模拟内部数据库错误，验证对外响应不泄露细节。 */
    () => {
      throw new Error('private database failure');
    };
  const response = await request('/stations');
  assert.equal(response.status, 500);
  assert.equal((await response.text()).includes('private database failure'), false);
});
test('migrations are non-destructive and idempotent' /** 验证：migrations are non-destructive and idempotent。 */, () => {
  db.exec(readFileSync(new URL('../migrations/0001_existing_schema.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0002_query_indexes.sql', import.meta.url), 'utf8'));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM station').get().n, 25);
  const plan = db
    .prepare('EXPLAIN QUERY PLAN SELECT * FROM station ORDER BY votes DESC, id ASC LIMIT 20')
    .all();
  assert.ok(
    plan.some(
      /** 检查执行计划是否使用榜单排序索引。 */
      (x) => x.detail.includes('idx_station_votes_id'),
    ),
  );
});
