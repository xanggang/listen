# worldTuner API

API 基于 `worldTuner-data/v2/schema.sql` 的新业务库，按电台、播放流、国家、标签及语种关联查询。旧表和旧接口已移除，公开接口前缀为 `/api`，受保护的管理业务接口前缀为 `/admin/api`；电台对外 `id` 使用 7 位随机 Base62 `station.public_id`，区分大小写；国家、标签、语种、播放流和链接 ID 仍为 19 位字符串。内部主键及外键保持不变。

详细的接口、双数据库架构、启动和迁移说明见 [项目文档](../docs/api-mobile-new-catalog.md)。机器可读契约见 [OpenAPI](docs/openapi.json)。

## SQLite 本地启动

需要 Node.js >= 22.18.0。从本目录运行：

```bash
pnpm install
cp .env.sqlite.example .env.sqlite
pnpm dev:sqlite
```

默认读取 `../worldTuner-data/v2/data/worldtuner-v2-public.sqlite`，电台库只读；访问统计写入 `.local/metrics.sqlite`。示例配置监听 `0.0.0.0:8787`，可从安卓模拟器或局域网手机访问。不要误用 `v2/worldtuner-v2.sqlite` 空库。

健康检查：`http://localhost:8787/api/health`。

## D1 本地启动

D1 和 SQLite 共用仓储 SQL、service、DTO、路由及输入校验。切换数据库只切换启动入口，不需要修改移动端代码。

```bash
pnpm db:migrate:local
pnpm db:export:catalog ../worldTuner-data/v2/data/worldtuner-v2-public.sqlite /tmp/worldtuner-catalog.sql
pnpm exec wrangler d1 execute DB --local --file /tmp/worldtuner-catalog.sql
pnpm dev --ip 0.0.0.0
```

导出为数据 SQL，不包含建表语句和统计信息；输出文件必须不存在。导入只执行一次，目标业务表必须为空，重复导入会因主键冲突失败。完整数据有数万电台，本地调试优先用 SQLite，可省去复制数据到 D1 的步骤。

## D1 发布配置

`wrangler.jsonc` 已绑定新建的 D1 数据库 `tuner`（ID：`81316922-1a07-407f-be7d-51a383ee242a`）。不要把新迁移应用到原来的 `listen` 旧库。

新 D1 应先应用 `migrations/` 的建表迁移，再导入上面的数据 SQL，验证后部署。线上 Web 的 Origin 要写入 `ALLOWED_ORIGINS`。远程迁移、导入与部署属于独立发布操作，本次开发没有执行。

`0008_station_public_id.sql` 仅为 `station` 增加可空的 7 位随机 `public_id` 及区分大小写的唯一索引，内部 19 位主键和所有外键保持不变。已有电台需用 [本地回填工具](../worldTuner-data/v2/README.md#为-station-增加随机-public_id) 生成 public_id；迁移 SQL 不自动回填远程记录。向空库导入数据时，先应用全部迁移，再从 `worldtuner-v2-public.sqlite` 导出数据 SQL。电台列表、详情、地图快照、点位游标和管理接口的 `id` 均映射为 public_id，详情通过内部主键加载关联流与链接；公开接口不会回退使用 station.id。未回填 public_id 的电台不进入公开结果和分类计数。

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

## 标签与语言展示名迁移

标签和语言接口保留 `name` 原名，并返回 `name_en`、`name_zh`。国家接口同样返回中英文展示名，国家扩展迁移见下文。电台 DTO 保留 `language`，新增 `languageEn`，`languageZh` 按每种语种逐项执行中文→英文→原名后聚合。标签及电台关键词搜索同时匹配原名、中英文；筛选仍传 ID。

现有 SQLite 目录先升级，再重启 API。进入 `worldTuner-data`：

```bash
npm run migrate:v2:catalog-names -- --db /实际路径/worldtuner-v2.sqlite
npm run migrate:v2:catalog-names -- --db /实际路径/worldtuner-v2.sqlite --apply
```

第一条只预览。第二条先备份全库，再事务补齐 `name_en`/`name_zh`；英文仅回填缺失值，保留既有中文、英文校订、ID 和关联。API 不自动迁移业务库，缺字段时启动会提示迁移命令。

D1 使用迁移 `0003`、`0004`、`0005_catalog_name_en.sql`，按顺序升级已有库，不重新执行历史建表文件。本地运行 `pnpm db:migrate:local`；正式库在发布前单独运行 `pnpm exec wrangler d1 migrations apply DB --remote`。本次开发没有操作远程库。

字典缓存仍保存所有语言字段，不按客户端语言拆分。JSON Cache API 内部键使用 `_response_schema=station-public-id-1`，避免发布后命中不含译名的旧缓存；客户端仍调用原 URL，地图快照独立使用 `tuple-public-id-1` 缓存版本。今后改变响应格式时同步更新该内部版本。

## 国家名称（后续扩展）

国家接口现在也返回 `name_en`、`name_zh`，电台 DTO 新增 `countryEn`、`countryZh`，原 `country` 不变。国家中文来自现有本地映射，不在请求时访问第三方。SQLite 先执行 data 项目的 `migrate:v2:country-names -- --db /实际路径/catalog.sqlite --apply`（自动备份），再重启服务；D1 按顺序升级至 `0006_country_names.sql`。JSON 缓存内部版本现为 `station-public-id-1`。完整覆盖报告与命令见主项目 `docs/country-localization.md`。

## Java 业务接口同步

已补齐 Java 的 `GET /admin/api/health`、`PUT /admin/api/stations/:id/visibility`，仅管理端支持鉴权后的上下架写入；公开业务接口保持兼容。密钥为 `ADMIN_TOKEN`，未配置时默认拒绝访问。Worker 使用 Secret；SQLite 在 `.env.sqlite` 配置密钥后开启独立管理写连接，公开目录连接继续只读。

本次保留国家、标签、语种中英文及国家中文搜索；跳过 Java 的日志、systemd 和部署实现。接口配置、同步清单、缓存生效边界与验证见 [业务同步说明](../docs/java-worker-business-sync.md)。管理接口没有公开缓存，既有公开缓存按 TTL 刷新。

## 电台 public_id 切换

OpenAPI 2.0.0 表示本次电台 ID 契约切换，不兼容原 19 位电台 ID 请求；URL 仍使用 `/api/stations/{id}`，响应字段名仍为 `id`，不会额外返回内部主键或重复的 public_id 字段。分类筛选参数继续接受 19 位 ID。点位分页的 after/nextCursor 为 7 位 public_id，按 BINARY 顺序比较和排序；完整地图元组为 `[public_id,name,longitude,latitude]`。

SQLite 启动前先生成包含 public_id 的处理库，再将 `SQLITE_PATH` 指向该文件（已有 `.env.sqlite` 也要手动更新）；启动检查会拒绝缺列或未完成回填的库。D1 发布前先应用 `0008` 并导入/回填 public_id 数据，随后更新 API、Web 和移动端。仅执行 `0008` 不会生成已有电台的 public_id，已有远程数据不能直接重复插入。远程发布与数据写入均需单独执行。
