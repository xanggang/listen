# API 模块与扩展规范

## 请求路径

`index → app → v1 子路由 → 参数校验 → 路由缓存 → service → repository → D1`

全局 requestContext/CORS/read rate limit 在路由前执行。Hono onError 统一输出安全错误；路由负责 HTTP 输入输出。新增受保护写入模块时应在对应子路由挂鉴权，不能复用公开缓存。

## 职责边界

- index.ts：仅导出 Worker；app.ts：全局策略；routes/v1.ts：注册模块，不写业务分支。
- routes：HTTP 路径、参数验证器、模块中间件和响应封装。
- schema：解析和验证外部输入，输出明确类型；拒绝未知、重复参数。
- service：业务编排，例如将字典 id 解析为过滤条件、判断详情不存在、计算分页。
- repository：参数化 SQL、存储行类型，无 HTTP、无 Hono Context。数据库表名来自代码固定映射。
- dto：明确数据库列到 API 字段的映射，保留 nullable 语义。
- middleware：限流、缓存、错误、CORS、请求标识，按职责独立。
- services.ts：每个请求组装依赖，不保存跨请求用户状态。单元测试可注入对应 repository 替身。

语言/标签/国家属于分类字典模块，拥有各自 routes 文件，共享 catalog service/repository，避免为完全相同的读取过程复制三套 SQL。以后某一类出现独立业务，可直接拆成独立模块，不影响外部路径。

## 新增模块范例

增加 favorites 时：在 modules/favorites 下定义 types/schema/repository/service/routes，在 services.ts 注册服务，在 routes/v1.ts 挂载 `/favorites`，在该子路由加入身份验证与数据归属判断。不要把 SQL 添加到 app.ts 或 routes/v1.ts，不要为用户响应启用公共缓存。

## 契约与兼容

Web Server Actions 仅作兼容门面，未来 Server Components 也可调用服务端 apiGet；移动端直接调用 HTTP JSON。后端变更必须同步 OpenAPI 和契约测试，不要求 Dart 依赖 TypeScript 类型。

v1 保留原 numeric id、offset 分页与旧字段名称；stationuuid 已返回，后续可新增 uuid 查询路由。数据库改名通过 DTO 隔离，破坏性 API 变更新增版本。

## 验证层次

API 契约测试覆盖真实 SQLite 查询、参数、分页、字典、DTO、缓存隔离、限流和错误；模块 service 可独立注入替身测试。Wrangler 联调用于验证真实 D1、Cache API、Service Binding 的行为。Web 类型检查验证兼容门面；HTTP Server Action 联调验证 Web 到独立服务。
