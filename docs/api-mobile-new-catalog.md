# 新业务库 API 与安卓客户端

API 和 mobile 已改为只使用 `worldTuner-data/v2` 定义的新结构，不再保留旧查询、旧接口或数据版本切换。接口前缀为 `/api`，根地址仍由移动端的 `API_BASE_URL` 构建变量提供。

## 数据库适配

业务仓储只依赖 `SqlDatabase` 的 `prepare/bind/first/all/run/batch` 契约。Cloudflare Worker 使用 D1 原生绑定；Node 入口使用 `runtime/sqlite.ts` 将 `node:sqlite` 包装成相同接口。HTTP 输入校验、service、DTO 和 SQL 共用，不复制业务代码。

Worker 使用 Cloudflare 限流、Cache API 和 Cron。SQLite 入口使用单进程 IP 限流，不使用 Worker Cache API；每小时及启动时补做匿名统计汇总。SQLite 的同步查询适合当前本地和单实例服务，多实例限流需统一配置反向代理。`node:sqlite` 在当前 Node 22 中仍为实验性模块，支持的最低 Node 版本为 22.18.0。

SQLite 只读打开电台业务库，统计另写 `.local/metrics.sqlite`，不在启动时修改已有电台库。D1 默认在同一个绑定内保存业务和统计表，统计 repository 的事务写入保持独立。

## 公开数据规则

- 只展示 `visibility_status = visible` 且 `catalog_status != unavailable` 的电台；未验证电台仍展示。
- 列表、搜索、地图和分类数量使用同一可见性条件。隐藏或不可用电台的详情返回 404。
- 标签、语种、国家按关联 ID 精确筛选，`pop` 不会意外匹配 `kpop`。
- 搜索覆盖名称、地点、国家、标签、语种。`%`、`_` 和反斜线作为字面文本处理。
- 分类数量从公开电台的关联表统计，只返回有关联的分类；不是源库预存的数量。
- 默认播放流只选择 HTTP(S) 入口，优先未标记检查失败的流，再按 `is_primary` 和 ID 排序。`resolved_url` 保留来源值，实际播放可用性仍由播放器判断。
- 详情包含排序后的全部 HTTP(S) 流和网站/社交链接。来源外部 ID、举报和审核记录不对外暴露。
- 实体 ID 全程为 19 位字符串，保留前导零；新库不提供旧 ID 映射。

## 接口

响应采用 `{ "data": ... }`；错误采用 `{ "error": { "code", "message", "requestId" } }`。详细字段见 [OpenAPI](../worldTuner-api/docs/openapi.json)。

| 路径 | 参数及用途 |
| --- | --- |
| `GET /api/health` | 存活检查，不探测数据库 |
| `GET /api/stations` | `page`、`pageSize`、`keyword`、`tagsId`、`languagesId`、`countriesId`；票数倒序、ID 升序 |
| `GET /api/stations/{id}` | 19 位字符串 ID，详情含 `streams` 和 `links` |
| `GET /api/tags` | `q`、`limit`、`offset`，标签搜索与分页 |
| `GET /api/countries` | `limit`，国家及关联数量 |
| `GET /api/languages` | `limit`，语种及关联数量 |
| `GET /api/map/snapshot` | 全量四字段元组，gzip + ETag，TTL 可配置 |
| `GET /api/map/stations` | `limit` 最大 5000、可选 `after` 字符串游标 |
| `POST /api/metrics/visit` | 保留匿名 PV/UV 上报字段，不收集新增用户资料 |

列表分页最大每页 100，offset 不超过 100000。分类列表最多 1000。地图只返回 `id/name/geoLat/geoLong` 和 `nextCursor`；游标为 null 表示完成。按 ID 分页不会因票数变动而跳页；多页读取不是数据库快照，期间新增数据可能到下一次刷新才出现。

## SQLite 调试

```bash
cd /Users/lin/Documents/www/lin/worldtuner/worldTuner-api
pnpm install
cp .env.sqlite.example .env.sqlite
pnpm dev:sqlite
```

默认业务库是 `/Users/lin/Documents/www/lin/worldtuner/worldTuner-data/v2/data/worldtuner-v2.sqlite`，可用 `SQLITE_PATH` 替换。`v2/worldtuner-v2.sqlite` 是另一个空库，不能混用。配置的相对路径从 API 启动目录解析。

复制的配置监听 `0.0.0.0:8787`；与正在运行的 Wrangler 二选一，避免端口冲突。访问 `http://localhost:8787/api/health` 验证服务。

## 安卓运行

```bash
cd /Users/lin/Documents/www/lin/worldtuner/worldTuner-mobile
/Users/lin/development/flutter/bin/flutter run -d <设备ID> --dart-define-from-file=env/lan.json
```

`env/lan.json` 的 `API_BASE_URL` 使用电脑局域网根地址，例如 `http://192.168.137.226:8787/`；安卓模拟器也可使用 `http://10.0.2.2:8787/`。根地址不包含 `/api`，客户端会自动拼接。

收藏、历史、榜单和筛选 ID 已改为字符串。收藏的旧数值 ID 仅在读取历史缓存时转成字符串并保留已保存播放地址，不承诺对应新库；新库没有旧 ID 映射。地图不再读取应用内旧快照，改为 API 全量压缩元组快照，结合 ETag 和本地文件缓存，点选详情与点位使用同一数据源；不做点位聚合，保留触控缩放和正在播放的光圈。

语言切换、夜间模式、播放器、搜索、榜单和本地收藏的界面入口保留。Web 已同步新路径与字符串 ID；地图使用同源全量快照转发，浏览器遵循 API 缓存头。规则见[地图缓存文档](map-snapshot-cache.md)。

## 新 D1 初始化与发布

使用新建 D1 数据库，避免将新表迁移应用到已有 `listen` 表。当前 `wrangler.jsonc` 的数据库 ID 是占位值，发布前必须替换。数据库创建、远程导入和发布需作为单独发布步骤执行。

```bash
cd /Users/lin/Documents/www/lin/worldtuner/worldTuner-api
pnpm exec wrangler d1 create worldtuner
```

把返回的数据库 ID 填入 `wrangler.jsonc`。在 API 和数据结构均已审查、确认目标新库为空后：

```bash
pnpm exec wrangler d1 migrations apply DB --remote
pnpm db:export:catalog ../worldTuner-data/v2/data/worldtuner-v2.sqlite /tmp/worldtuner-catalog.sql
pnpm exec wrangler d1 execute DB --remote --file /tmp/worldtuner-catalog.sql
pnpm check
pnpm deploy
```

导出只读，不包含统计数据；输出文件必须不存在，避免覆盖。SQL 没有事务控制语句，按外键顺序输出、保持字符串 ID，单条语句超过安全大小时拒绝导出。失败会删除不完整输出。仅在已建好新表、业务数据为空的目标库导入一次；导入失败应核对目标数据，不能直接重复执行。导出期间应暂停数据整理写入以获得一致数据。

本地 D1 使用 `pnpm db:migrate:local` 和 `wrangler d1 execute DB --local --file ...`，再运行 `pnpm dev`。本地 D1 与现有 SQLite 是不同文件，不会自动同步。

## 验证范围

自动测试使用隔离内存库，覆盖字符串 ID、关联精确筛选、公开可见性、播放流选择、分类统计、地图分页、D1 形态绑定与 SQLite 返回一致性、统计事务及新表结构一致性。另用真实导入库只读检查 SQLite HTTP 接口、本地 D1 检查 Worker 路由。

没有在开发验证中修改远程 D1，也没有执行正式部署；真机地图渲染和实际电台音频需要设备运行检查。
