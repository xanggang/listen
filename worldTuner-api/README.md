# listen-api

独立 Cloudflare Worker，使用 TypeScript + Hono + D1，为 Web 和 Android 提供游客电台 API 与最小匿名访问量上报接口；iOS 后续接入。Web 项目在同级 `worldTuner-web/`，原 Server Actions 仅保留兼容调用门面，不再执行 SQL。

## package.json 脚本说明

`package.json` 必须保持标准 JSON，不能在 `scripts` 中直接写 `//` 注释。各命令的用途记录在这里；运行时使用 `pnpm <脚本名>`。

| 脚本 | 作用 |
|---|---|
| `dev` | 用 Wrangler 在本地 8787 端口启动 API，支持修改源码后重新加载；使用本地 D1。 |
| `db:migrate:local` | 将 `migrations/` 中尚未应用的迁移执行到**本地** D1；不导入电台数据，也不操作远程数据库。 |
| `typegen` | 根据 `wrangler.jsonc` 生成 Worker 绑定和运行时类型；修改 D1、限流等绑定后执行。 |
| `typecheck` | 运行 TypeScript 静态检查，不生成 JavaScript 文件。 |
| `test` | 运行 `test/*.test.ts` 中的自动测试；使用测试内存数据库，不改动本地 D1 文件。 |
| `format` | 用 Prettier 自动格式化 `src/` 和 `test/`，会修改这些源文件。 |
| `format:check` | 只检查上述文件的格式，不修改文件。 |
| `build` | 让 Wrangler 打包到 `dist/` 并进行部署预检；带 `--dry-run`，**不会发布**。 |
| `check` | 依次执行格式检查、类型检查、测试、打包预检；任一步失败就停止。 |
| `deploy` | 执行 `wrangler deploy`，**会发布到 Cloudflare**；不负责数据库迁移。 |

常用顺序：日常开发运行 `dev`；提交前运行 `check`；变更绑定后先运行 `typegen`。`deploy` 是线上发布命令，和仅验证打包的 `build` 不同。

## 本地开发

电台数据同步工具位于独立的 [`worldTuner-data/radio-browser`](../worldTuner-data/radio-browser/README.md)，业务表结构继续以本项目 `migrations/` 为准。

需要 Node.js >= 22.18（测试使用 node:sqlite）及 pnpm。

```bash
pnpm install
pnpm db:migrate:local
pnpm dev
```

默认地址 `http://127.0.0.1:8787`。新建本地数据库为空。如需要现有电台数据，**仅在新的本地数据库**先导入快照，再应用迁移：

```bash
pnpm exec wrangler d1 execute DB --local --file=./data/listen-d1-export.sql > import-local.log
pnpm db:migrate:local
```

快照导入不幂等；不要重复导入已有数据的库。本项目 `.wrangler/` 独立于 Web 的本地数据目录。迁移脚本本身使用 CREATE IF NOT EXISTS，不删除原表和数据。

另开终端启动 Web：

```bash
cd ../worldTuner-web
# 已有 .env.local 时只合并该变量，不要覆盖文件。
# LISTEN_API_BASE_URL=http://127.0.0.1:8787
pnpm dev
```

Web 开发模式默认直连 `http://127.0.0.1:8787`；端口或主机不同时可按 `.env.example` 在 Web 的 `.env.local` 覆盖 `LISTEN_API_BASE_URL`。生产默认使用 `LISTEN_API` Service Binding。

## 接口

全部前缀 `/api/v1`，游客访问，无登录密钥。电台和字典接口只读；唯一写入接口是受限的匿名访问量上报。错误采用 HTTP 状态码及 `{error:{code,message,requestId}}`；成功采用 `{data:...}`。

| GET 路径 | 参数 / 返回 |
|---|---|
| `/health` | 服务存活状态；不探测 D1 |
| `/stations` | page 默认 1，pageSize 默认 20/最大 100；keyword 最长 100；languagesId、tagsId、countriesId 可同时筛选 |
| `/stations/{id}` | 现有数值 id，保留地图兼容性；不存在 404 |
| `/languages` | limit 默认 1000，最大 1000 |
| `/tags` | limit 默认 30，最大 1000；可用 `q` 按名称搜索、`offset` 分页，响应仍为数组 |
| `/countries` | limit 默认 30，最大 1000 |

`POST /metrics/visit` 只接受匿名 UUID、`web`/`android` 平台和固定页面名，并汇总 PV、日 UV 与月活；没有公开读取接口。数据口径、保留期和本地 SQL 见 [`docs/metrics.md`](docs/metrics.md)。

列表 data 为 `{list,page,pageSize,hasMore,nextPage}`，不返回虚假的 total。排序为 votes DESC、id ASC；offset 最大 100000，page 最大 10000。并发更新票数仍可能使 offset 分页发生漂移。未来如改游标，需保持 v1 兼容或增加版本。

字段映射兼容现有 Web Station：`url_resolved → urlResolved`、`geo_lat → geoLat` 等；`stationuuid`、`countrycode` 和 `iso_3166_2` 保留既有名称。数据库空值保持 null，旧时间字符串没有伪装成标准 ISO 日期。完整字段见 `docs/openapi.json`。

第一步保留语言、标签的 substring 筛选含义，输入中的 % 和 _ 按普通字符处理。此类 LIKE 搜索仍可能扫描数据，后续再做分类关联表和搜索索引。地图视口/聚合、用户体系、音频代理不在本次范围；Web 地图仍使用原静态数据。

## 模块结构

详见 `docs/architecture.md`。核心原则：路由不写 SQL，repository 不操作 HTTP，service 不依赖 Hono。

```text
src/
  index.ts                 Worker 导出
  app.ts                   中间件和版本路由组装
  routes/v1.ts             v1 模块注册
  services.ts              请求级依赖组装
  middleware/              上下文、CORS、限流、缓存、错误处理
  shared/                  通用异常和参数校验
  modules/
    stations/              路由、schema、service、repository、DTO、类型
    catalog/               语言/标签/国家独立路由，共享字典查询服务
    health/                健康接口
    metrics/               匿名访问校验、日期哈希与 D1 汇总
```

## 防滥用与缓存

- 全局 180 次/60秒/IP，关键词搜索额外 30 次/60秒/IP，配置在 wrangler.jsonc。
- 匿名访问上报使用独立 60 次/60秒/IP 限流；请求体最多 1024 字符，拒绝任何额外字段和公共缓存。
- IP 由 Cloudflare 提供，不能用客户端自报 userId 替代；缺失 IP 共享 unknown 桶。共享网络可能误限流，需要观察后调整。
- Cloudflare 限流按地点计算且最终一致，不是全球精准计费额度。
- 仅成功的公开 JSON 缓存在 Worker Cache API：列表/详情 300 秒，字典 3600 秒；搜索不缓存。
- 每次请求先限流，参数验证后查缓存。缓存不保存 CORS 或请求 ID。缓存失败回退正常查询。
- 响应 no-store，避免浏览器额外缓存掩盖服务端限流；缓存命中仍会执行 Worker。
- ALLOWED_ORIGINS 配置浏览器跨域白名单。CORS 不阻止非浏览器调用，也不是鉴权。
- 无客户端数据库凭证；统计写入不作为用户身份或安全凭证。

## 检查与部署

```bash
pnpm check
pnpm typegen  # 修改绑定配置后执行
```

测试使用内存 SQLite 与 D1 适配器、模拟 Cache/RateLimit；真实运行时还需 Wrangler 本地联调。`build` 只是 dry-run，不部署。

生产步骤：核实 wrangler 中目标 D1（当前继承旧 listen 数据库）、为限流 namespace 确认账号内唯一编号、按需设置生产 Web 域名的 ALLOWED_ORIGINS；先备份旧库并审查迁移，再显式应用远程迁移、部署 API，最后发布 Web。Web 服务绑定指向 `listen-api`，两者需同一 Cloudflare 账号。不要将 localhost URL 配进生产 Web。

本次开发不自动应用远程迁移或部署。新 API 位于旧 Git 仓库外：当前只有 listen/ 是 Git 仓库，提交 Web 不会自动包含 listen-api；发布前应将新子项目纳入版本控制或规划上层仓库。
