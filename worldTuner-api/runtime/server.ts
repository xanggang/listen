import { serve } from '@hono/node-server';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from '../src/app.ts';
import type { ApiBindings } from '../src/types.ts';
import { SQLiteDatabase } from './sqlite.ts';
import { LocalRateLimiter } from './rate-limit.ts';
import { MetricsService } from '../src/modules/metrics/metrics.service.ts';
import { MetricsRepository } from '../src/modules/metrics/metrics.repository.ts';

const apiRoot = fileURLToPath(new URL('../', import.meta.url));
const catalogPath = resolve(
  process.env.SQLITE_PATH ?? resolve(apiRoot, '../worldTuner-data/v2/data/worldtuner-v2.sqlite'),
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
mkdirSync(dirname(metricsPath), { recursive: true });
const metrics = new SQLiteDatabase(metricsPath, false);
metrics.connection.exec(
  readFileSync(new URL('../migrations/0002_visit_metrics.sql', import.meta.url), 'utf8'),
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
      return app.fetch(request, env);
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
    // 所有 HTTP 请求结束后关闭两条连接。
    () => {
      catalog.close();
      metrics.close();
    },
  );
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
