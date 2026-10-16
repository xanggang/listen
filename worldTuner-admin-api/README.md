# WorldTuner 管理 API

独立管理后端项目，负责管理员认证、电台管理、分类译名、访问分析、错误报告管理和操作审计。与 `worldTuner-api`（客户端）并列维护，各自有 package.json、依赖、测试、启动入口及 wrangler.jsonc，不互相导入源码。

## 结构

- `src/index.ts`：管理 Worker HTTP / Cron 入口。
- `src/app.ts`：鉴权、安全中间件、管理路由和受保护静态资源装配。
- `src/stations/*.routes.ts`：电台列表、详情、基本字段、上下架与播放流接口。
- `src/catalog/*.routes.ts`：国家、语言、标签搜索及译名校订。
- `src/analytics/*.routes.ts`：总览、PV/UV、月 MAU。
- `src/reports/*.routes.ts`：错误样本查询与处理状态。
- `src/audit/*.routes.ts`：操作审计查询及 outbox 幂等交付。
- `src/auth/`：Cloudflare Access 验签、管理员白名单与角色、CSRF。
- `runtime/`：本项目自己的 SQLite 运行适配和本地限流，不依赖客户端 API 安装目录。
- `docs/openapi.json`：完整管理接口契约，统一前缀 `/admin/api`。

## 本地启动

使用电脑已安装的 pnpm，不在项目内安装 pnpm 或创建 store。

```sh
cd /Users/lin/Documents/www/lin/worldtuner/worldTuner-admin-api
command -v pnpm
pnpm install
# 已存在时编辑，避免覆盖本机配置。
test -f .env.sqlite || cp .env.sqlite.example .env.sqlite
pnpm dev:sqlite
```

默认监听 `127.0.0.1:8788`。local 模式仅允许 loopback URL，自动使用已启用的 local-owner 身份，无需配置或输入密钥；CSRF 签名密钥由进程自动生成，写入仍检查同源、角色及 CSRF。生产始终使用 Access。业务库需完成 public_id 与译名处理。

为读取原客户端上报的 PV/UV，示例的 `METRICS_SQLITE_PATH` 指向客户端已有 `.local/metrics.sqlite`；这是可配置的数据库文件地址，不是源码依赖。也可以将两个 API 的该变量设为同一个绝对路径。不自动移动、复制或覆盖原数据库。不使用示例配置时，本项目默认统计文件为自己的 `.local/metrics.sqlite`。

管理前端仍在相邻 `worldTuner-admin`，另一个终端运行 `pnpm dev`，浏览器打开 `http://127.0.0.1:5173`；其同源代理仍指向本管理服务 8788。

## 构建与部署

```sh
pnpm typecheck
pnpm test
pnpm format:check

# 先在 ../worldTuner-admin 执行 pnpm build，准备静态资源。
pnpm build       # 管理 Worker dry-run
pnpm deploy      # 完成生产配置与预发布验收后单独执行
```

生产通过本项目 `wrangler.jsonc` 部署为 `worldtuner-admin` Worker，静态管理页面仍由该 Worker 的 ASSETS 提供。同目录的配置不影响客户端 `worldtuner-api`。

业务与运营迁移只有一份，分别位于 `worldTuner-data/v2/migrations` 和 `worldTuner-data/operations/migrations`。两个 API 的 D1 绑定指向同一组真实数据库；迁移文件名称保持不变，没有因为移动目录而重置迁移记录。

```sh
pnpm db:migrate:local
# 生产库迁移必须在核对目标与备份后另行执行：
pnpm exec wrangler d1 migrations apply DB --remote
pnpm exec wrangler d1 migrations apply METRICS_DB --remote
```

管理端需要配置真实 Access issuer/audience、ADMIN_ORIGIN、CSRF_SECRET、显式管理员身份和运营 D1 ID。详见 [管理端开发与部署](../docs/管理端开发与部署.md)。本轮没有发布或修改远程数据库。
