import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { discoverMirrors, fetchStations } from './client.mjs';
import { importStations } from './repository.mjs';

/**
 * 执行一次本地同步：先完整下载和校验，再事务写库；失败返回非零退出码。
 * --db 指定独立 SQLite 文件，--server 可覆盖自动发现；不连接远程 D1。
 */
async function main() {
  const { values } = parseArgs({
    options: { db: { type: 'string' }, server: { type: 'string' }, help: { type: 'boolean' } },
  });
  if (values.help) {
    console.log(
      '用法：npm run sync:radio-browser -- [--db /path/to/radio.sqlite] [--server https://镜像域名]',
    );
    return;
  }
  const path = values.db
    ? resolve(values.db)
    : fileURLToPath(new URL('../data/radio-browser.sqlite', import.meta.url));
  const mirrors = values.server ? [values.server] : await discoverMirrors();
  const { stations, server } = await fetchStations(mirrors);
  console.log(`收到 ${stations.length} 条电台，准备写入 ${path}`);
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    console.log(
      JSON.stringify({ database: path, server, ...importStations(db, stations, server) }, null, 2),
    );
  } finally {
    db.close();
  }
}

// 输出可诊断的失败原因；不把未完成的同步报告为成功。
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
