import { serve } from '@hono/node-server';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientApp } from '../src/apps/client-app.ts';
import type { ApiBindings } from '../src/types.ts';
import { SQLiteDatabase } from './sqlite.ts';
import { LocalRateLimiter } from './rate-limit.ts';
import { MetricsService } from '../src/modules/metrics/metrics.service.ts';
import { MetricsRepository } from '../src/modules/metrics/metrics.repository.ts';

const apiRoot = fileURLToPath(new URL('../', import.meta.url));
const catalogPath = resolve(
  process.env.SQLITE_PATH ??
    resolve(apiRoot, '../worldTuner-data/v2/data/worldtuner-v2-public.sqlite'),
);
const metricsPath = resolve(
  process.env.METRICS_SQLITE_PATH ?? resolve(apiRoot, '.local/metrics.sqlite'),
);
if (!existsSync(catalogPath)) throw new Error(`Catalog SQLite file not found: ${catalogPath}`);
if (catalogPath === metricsPath)
  throw new Error('Metrics SQLite must be separate from the read-only catalog');
const catalog = new SQLiteDatabase(catalogPath);
// 提前验证结构，避免空库或错误路径启动后每个接口都返回 503。
const requiredTables = [
  'country',
  'station',
  'station_stream',
  'tag',
  'language',
  'station_tag',
  'station_language',
  'station_link',
];
for (const table of requiredTables) {
  if (
    !catalog.connection
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table)
  ) {
    catalog.close();
    throw new Error(`Missing catalog table: ${table}`);
  }
}
// 展示字段必须先通过独立迁移升级；服务保持目录数据库只读。
for (const table of ['tag', 'language', 'country']) {
  const columns = catalog.connection.prepare(`PRAGMA table_info(${table})`).all();
  for (const field of ['name_en', 'name_zh']) {
    // 仅检查固定字典表的结构，不自动写入或修改现有目录。
    if (!columns.some((column) => column.name === field)) {
      catalog.close();
      throw new Error(
        `Missing catalog column: ${table}.${field}. Run worldTuner-data ${table === 'country' ? 'migrate:v2:country-names' : 'migrate:v2:catalog-names'} with --db ${catalogPath} --apply before starting API.`,
      );
    }
  }
}
// 对外 ID 必须先离线回填；错误配置在启动时报告，不在请求中修改业务库。
const stationColumns = catalog.connection.prepare('PRAGMA table_info(station)').all();
// 检查固定电台表是否具备新的对外标识列。
if (!stationColumns.some((column) => column.name === 'public_id')) {
  catalog.close();
  throw new Error(
    'Missing station.public_id. Run v2/src/station-public-ids.mjs and set SQLITE_PATH to its output before starting API.',
  );
}
if (catalog.connection.prepare('SELECT 1 FROM station WHERE public_id IS NULL LIMIT 1').get()) {
  catalog.close();
  throw new Error('Missing station public IDs. Backfill station.public_id before starting API.');
}
mkdirSync(dirname(metricsPath), { recursive: true });
const metrics = new SQLiteDatabase(metricsPath, false);
metrics.connection.exec(
  readFileSync(new URL('../migrations/operations/0001_operations.sql', import.meta.url), 'utf8'),
);
const env: ApiBindings = {
  DB: catalog,
  METRICS_DB: metrics,
  CACHE_ENABLED: 'false',
  MAP_SNAPSHOT_CACHE_TTL_SECONDS: process.env.MAP_SNAPSHOT_CACHE_TTL_SECONDS,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000',
  READ_LIMITER: new LocalRateLimiter(180),
  SEARCH_LIMITER: new LocalRateLimiter(30),
  METRICS_LIMITER: new LocalRateLimiter(60),
};
const port = Number(process.env.PORT ?? '8787');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const host = process.env.HOST ?? '127.0.0.1';
const server = serve(
  {
    hostname: host,
    port,
    // 使用真实连接地址覆盖客户端伪造的 CF 标头，再进入共同的 HTTP 中间件。
    fetch: (request, nodeEnv) => {
      request.headers.set('CF-Connecting-IP', nodeEnv.incoming.socket.remoteAddress ?? 'unknown');
      return clientApp.fetch(request, env);
    },
  },
  // 仅输出服务地址和数据库路径，不记录用户标识或播放流参数。
  () =>
    console.log(
      `worldTuner API (SQLite) http://${host}:${port}\nCatalog (read-only): ${catalogPath}\nMetrics: ${metricsPath}`,
    ),
);
const metricsService = new MetricsService(new MetricsRepository(metrics));
// SQLite 没有 Worker Cron；每小时补做汇总，重算已完成周期可安全重入。
const rollupTimer = setInterval(
  // 汇总失败只记录运维错误，不退出正在处理读取请求的服务。
  () => void metricsService.rollup().catch(() => console.error('metrics_rollup_failed')),
  60 * 60 * 1000,
);
rollupTimer.unref();
void metricsService.rollup().catch(
  // 启动时补齐服务停机期间未执行的汇总。
  () => console.error('metrics_rollup_failed'),
);
let stopping = false;
/**
 * 停止接收请求后释放本地连接，避免在尚有请求时关闭 SQLite。
 */
function shutdown(): void {
  if (stopping) return;
  stopping = true;
  clearInterval(rollupTimer);
  server.close(
    // 所有 HTTP 请求结束后关闭只读目录及独立统计连接。
    () => {
      catalog.close();
      metrics.close();
    },
  );
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
