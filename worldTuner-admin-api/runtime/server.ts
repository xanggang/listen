import { serve } from '@hono/node-server';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SQLiteDatabase } from './sqlite.ts';
import { LocalRateLimiter } from './rate-limit.ts';
import { adminApp } from '../src/app.ts';
import type { AdminBindings } from '../src/types.ts';
import { deliverAudit } from '../src/audit/audit.repository.ts';

const apiRoot = fileURLToPath(new URL('../', import.meta.url));
const token = process.env.ADMIN_LOCAL_TOKEN;
if (!token || token.length < 32)
  throw new Error('Set ADMIN_LOCAL_TOKEN to at least 32 characters in .env.sqlite');
const catalogPath = resolve(
  process.env.SQLITE_PATH ??
    resolve(apiRoot, '../worldTuner-data/v2/data/worldtuner-v2-public.sqlite'),
);
const metricsPath = resolve(
  process.env.METRICS_SQLITE_PATH ?? resolve(apiRoot, '.local/metrics.sqlite'),
);
if (!existsSync(catalogPath) || catalogPath === metricsPath)
  throw new Error('Configure separate existing catalog and operations database paths');
mkdirSync(dirname(metricsPath), { recursive: true });
// 本地管理模式显式打开写连接；客户端独立进程仍保持只读。
const catalog = new SQLiteDatabase(catalogPath, false);
const metrics = new SQLiteDatabase(metricsPath, false);
catalog.connection.exec(
  readFileSync(
    new URL('../../worldTuner-data/v2/migrations/0002_admin_outbox.sql', import.meta.url),
    'utf8',
  ),
);
for (const name of ['0001_operations.sql', '0002_admin.sql'])
  metrics.connection.exec(
    readFileSync(
      new URL(`../../worldTuner-data/operations/migrations/${name}`, import.meta.url),
      'utf8',
    ),
  );
// 只为本地模式初始化固定身份，生产管理员必须由受控 SQL 显式分配。
metrics.connection
  .prepare(
    "INSERT INTO admin_actors(id,issuer,subject,email,role) VALUES ('local-owner','local','local-owner','local@localhost','owner') ON CONFLICT(issuer,subject) DO NOTHING",
  )
  .run();
const env: AdminBindings = {
  DB: catalog,
  METRICS_DB: metrics,
  DEPLOYMENT_ENV: 'local',
  ADMIN_LOCAL_TOKEN: token,
  ADMIN_ORIGIN: process.env.ADMIN_ORIGIN ?? 'http://127.0.0.1:5173',
  ADMIN_LIMITER: new LocalRateLimiter(120),
};
const port = Number(process.env.PORT ?? 8788);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid ADMIN_PORT');
const server = serve(
  {
    hostname: '127.0.0.1',
    port,
    // 客户端不能伪造 Cloudflare IP 标头规避本地限流。
    fetch: (request, nodeEnv) => {
      request.headers.set('CF-Connecting-IP', nodeEnv.incoming.socket.remoteAddress ?? 'unknown');
      return adminApp.fetch(request, env);
    },
  },
  // 不输出本地密钥、请求正文或播放流地址。
  () => console.log(`worldTuner Admin API http://127.0.0.1:${port}`),
);
const timer = setInterval(
  // 审计交付失败保留原始 outbox，后续重试，不使管理进程退出。
  () =>
    void deliverAudit(catalog, metrics).catch(
      // 日志只记录固定事件，避免打印数据库错误或输入。
      () => console.error('admin_audit_delivery_failed'),
    ),
  60000,
);
timer.unref();
/**
 * 停止接收请求后再关闭写连接，保证在途事务不被强行中断。
 */
function shutdown() {
  clearInterval(timer);
  server.close(
    // HTTP 请求全部结束后释放两库连接。
    () => {
      catalog.close();
      metrics.close();
    },
  );
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
