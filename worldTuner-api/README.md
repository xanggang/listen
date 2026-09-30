# worldTuner API

API 基于 `worldTuner-data/v2/schema.sql` 的新业务库，按电台、播放流、国家、标签及语种关联查询。旧表和旧接口已移除，统一前缀为 `/api`；所有实体 ID 使用 19 位字符串并保留前导零。

详细的接口、双数据库架构、启动和迁移说明见 [项目文档](../docs/api-mobile-new-catalog.md)。机器可读契约见 [OpenAPI](docs/openapi.json)。

## SQLite 本地启动

需要 Node.js >= 22.18.0。从本目录运行：

```bash
pnpm install
cp .env.sqlite.example .env.sqlite
pnpm dev:sqlite
```

默认读取 `../worldTuner-data/v2/data/worldtuner-v2.sqlite`，电台库只读；访问统计写入 `.local/metrics.sqlite`。示例配置监听 `0.0.0.0:8787`，可从安卓模拟器或局域网手机访问。不要误用 `v2/worldtuner-v2.sqlite` 空库。

健康检查：`http://localhost:8787/api/health`。

## D1 本地启动

D1 和 SQLite 共用仓储 SQL、service、DTO、路由及输入校验。切换数据库只切换启动入口，不需要修改移动端代码。

```bash
pnpm db:migrate:local
pnpm db:export:catalog ../worldTuner-data/v2/data/worldtuner-v2.sqlite /tmp/worldtuner-catalog.sql
pnpm exec wrangler d1 execute DB --local --file /tmp/worldtuner-catalog.sql
pnpm dev --ip 0.0.0.0
```

导出为数据 SQL，不包含建表语句和统计信息；输出文件必须不存在。导入只执行一次，目标业务表必须为空，重复导入会因主键冲突失败。完整数据有数万电台，本地调试优先用 SQLite，可省去复制数据到 D1 的步骤。

## D1 发布配置

`wrangler.jsonc` 的 `database_id` 当前是占位 UUID，必须替换成**新建且使用新表结构**的 D1 数据库 ID。不要把新迁移应用到原来的 `listen` 旧库。

新 D1 应先应用 `migrations/` 的建表迁移，再导入上面的数据 SQL，验证后部署。线上 Web 的 Origin 要写入 `ALLOWED_ORIGINS`。远程迁移、导入与部署属于独立发布操作，本次开发没有执行。

## 目录职责

- `src/database/`：最小数据库契约，D1 可直接实现。
- `runtime/`：SQLite 适配器、Node HTTP 服务、单进程限流和只读数据导出工具；不打入 Worker。
- `src/modules/`：按业务划分 routes、schema、service、repository 和 DTO。
- `src/middleware/`：请求上下文、CORS、限流、错误及 Worker 缓存。
- `migrations/`：新库建表和匿名统计表，支持 SQLite/D1。

## scripts

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动本地 Worker，使用本地 D1 |
| `pnpm dev:sqlite` | 启动 Node API，读取本地 SQLite 和 `.env.sqlite` |
| `pnpm db:migrate:local` | 只迁移本地 D1，不修改远程库 |
| `pnpm db:export:catalog source.sqlite output.sql` | 只读导出新业务数据，供一次性 D1 导入 |
| `pnpm typegen` | 生成 Worker 平台类型 |
| `pnpm typecheck` | 分别检查 Worker 和 Node 运行入口 |
| `pnpm test` | 内存库行为测试、SQL 绑定一致性及统计事务验证 |
| `pnpm format` / `pnpm format:check` | 整理或检查源代码、运行入口和测试格式 |
| `pnpm build` | Worker dry-run 构建，不发布 |
| `pnpm check` | 格式、类型、测试和 dry-run 构建 |
| `pnpm deploy` | 发布 Worker，需事先配置真实新库 ID 和数据 |

## 全量地图与缓存

首页使用 `GET /api/map/snapshot` 获取 `[id, name, 经度, 纬度]` 全量元组，支持 gzip、ETag/304。`MAP_SNAPSHOT_CACHE_TTL_SECONDS` 默认 300；Worker 在 `wrangler.jsonc` 配置，SQLite 在 `.env.sqlite` 配置，0 禁用。详见[地图缓存文档](../docs/map-snapshot-cache.md)。
