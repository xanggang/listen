# API 拆分实施说明

新增同级子项目 listen-api，详见 listen-api/README.md、docs/architecture.md 和 docs/openapi.json。

- listen-api：TypeScript + Hono，独立版本路由、业务服务、D1 repository、DTO 和中间件。
- listen：保留 Server Actions 兼容调用门面，SQL 全部移至 API；生产通过 LISTEN_API Service Binding 调用，开发支持 LISTEN_API_BASE_URL。
- Web 不再绑定 D1，公开 HTTP API 供后续 Flutter Android/iOS 使用。
- 修复分页漏项、结束判断、隐藏筛选条件与旧请求覆盖；新增列表错误重试。
- v1 暂时保留静态地图、数字电台 id、旧字段命名、offset 分页和模糊分类筛选。
- 未增加登录、账号、收藏同步、音频代理或地图新接口。

部署顺序：备份并核对目标 D1 → 审查/应用非破坏性迁移 → 发布 listen-api → 发布 Web。首版部署配置继承原 listen 数据库标识，不会自动创建远程数据库。

开发与校验命令详见 listen-api/README.md。新子项目当前不属于 listen 的 Git 仓库，需单独纳入版本控制。
