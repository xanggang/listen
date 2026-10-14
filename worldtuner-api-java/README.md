# worldtuner-api-java

WorldTuner 的下一版后端 API，用 Java 重写现有 Cloudflare Worker（`worldTuner-api`）的功能。当前基于 **SQLite** 数据库，目标是让现有客户端（Web / 移动端）零改动即可切换过来。

## 技术栈

| 项目 | 版本 / 选型 |
| --- | --- |
| 语言 | Java 21 |
| 框架 | Spring Boot 3.5 |
| 构建 | Maven（多模块） |
| ORM | MyBatis（手写参数绑定 SQL，与 Worker 版平移） |
| 数据库 | SQLite（sqlite-jdbc） |
| 连接池 | HikariCP |
| 文档 | springdoc-openapi |

## 模块划分

一个父工程 `worldtuner-api-java`（`pom.xml`），下面 5 个模块，按依赖自底向上：

```
worldtuner-api-java/
├── worldtuner-common        # 通用：错误码、统一响应包装、参数校验工具
├── worldtuner-domain        # 领域：实体、MyBatis mapper、业务 service（不含 HTTP）
├── worldtuner-client-api    # 公开只读 API 的 Controller（app / web / shared 分包）
├── worldtuner-admin-api     # 后台管理 API 的 Controller（鉴权 + 写操作）
└── worldtuner-bootstrap     # 启动器：数据源装配、过滤器、统一异常、打包成单个可执行 jar
```

依赖关系：

```
common ◄── domain ◄── client-api ──┐
        ◄── domain ◄── admin-api  ─┤── bootstrap（可执行 jar）
```

### worldtuner-common

对外层与领域层共享的基础设施，不依赖 Spring Web：

- `ApiError` — 统一错误结构（`code` / `message`），与 Worker 版错误格式逐字段对齐。
- `ApiResult` — 统一响应包装（成功 `data`，失败 `error`）。
- `QueryValidation` — 查询参数校验（整数、19 位实体 ID、分页参数），等价于 Worker 版 `validation.ts`。

### worldtuner-domain

业务核心，只依赖 `common` 和 MyBatis，不感知 HTTP：

- `catalog/` — 国家 / 标签 / 语种三类字典的实体与 `CatalogService`（译名 `name_zh → name_en → name` 聚合、按电台数排序）。
- `stations/` — 电台实体（`StationRow` / `StreamRow` / `LinkRow`）、`StationService`（详情组装、稳定分页）。
- `map/` — 地图点位实体、`MapService`、`MapSnapshotBuilder`（元组序列化）、`MapSnapshotCache`（gzip + ETag 缓存）。
- `metrics/` — 访问统计实体、`MetricsService`、`VisitInputParser`（PV / 日 UV / 月活去重）。
- `admin/` — 管理端 `AdminStationService`（电台可见性写操作）。
- `repository/catalog/` — 目录库 mapper + SQL Provider（`CatalogMapper`、`StationMapper`、`MapMapper`、`AdminStationMapper`）。
- `repository/metrics/` — 统计库 mapper（`MetricsMapper`）。

> 注意：`@Service` 组件位于 `com.worldtuner.domain` 包，启动类通过 `scanBasePackages` 显式扫描进来。

### worldtuner-client-api

公开只读 API 的 HTTP 层，只依赖 `domain`。为多端预留了分包，当前 app / web 接口完全一致，都落在 `shared`：

- `client/shared/` — 现有 9 个公开接口的 Controller（`HealthController`、`StationController`、`CatalogController`、`MapController`、`MetricsController`），以及查询参数解析、ETag 支持。
- `client/app/`、`client/web/` — 占位包（`package-info.java`），留给将来 App 与 Web 分化出的收藏、推送、聚合接口。

### worldtuner-admin-api

后台管理 API，与公开 API 物理隔离（独立模块 + 独立 `AdminController`）：

- `AdminController` — `/admin/api/health` 探活，`PUT /admin/api/stations/{id}/visibility` 改电台可见性。
- 所有 `/admin/**` 请求经过 `AdminTokenFilter` 静态 Token 鉴权。

### worldtuner-bootstrap

启动装配层，把上面所有模块拼成可运行的进程：

- `WorldTunerApplication` — `@SpringBootApplication` 启动类，扫描 bootstrap / domain / client / admin 四个包。
- `DataSourceConfig` — **双数据源**：`catalog`（v2 目录库，公开 API 只读）与 `metrics`（统计库，独立文件，WAL），按 mapper 包路由到各自的 `SqlSessionFactory`。
- `web/` — 横切过滤器：`RequestContextFilter`、`CorsFilter`、`RateLimitFilter`、`AdminTokenFilter`、`JsonCacheFilter`、`ApiErrorCatchFilter`、`GlobalExceptionHandler`。
- `MetricsSchemaInitializer` — 启动时初始化统计库表结构。
- `MetricsRollupScheduler` — 定时汇总统计（月活等）。
- `resources/application.yml` — 端口、库路径、缓存 TTL、CORS 白名单、限流额度、admin token 等。

## 对外接口

与现有 Worker 版对齐的 9 个公开接口（前缀 `/api`）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/stations` | 电台列表（分页 / 筛选 / 搜索） |
| GET | `/api/stations/{id}` | 电台详情 |
| GET | `/api/tags` | 标签字典（支持搜索） |
| GET | `/api/languages` | 语种字典 |
| GET | `/api/countries` | 国家字典 |
| GET | `/api/map/stations` | 地图点位分页 |
| GET | `/api/map/snapshot` | 地图全量快照（gzip + ETag/304） |
| POST | `/api/metrics/visit` | 匿名访问统计上报 |

管理端（前缀 `/admin/api`，需 Token）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/admin/api/health` | 管理端探活 |
| PUT | `/admin/api/stations/{id}/visibility` | 设置电台可见性 |

## 如何启动

### 环境要求

- JDK 21（本机 `corretto-21.0.11`）
- Maven 3.9+（本机工具目录 `/Users/lin/.workbuddy/binaries/maven/apache-maven-3.9.9/bin/mvn`）

### 1. 打包

在项目根目录执行：

```bash
cd /Users/lin/Documents/www/lin/worldtuner/worldtuner-api-java

export JAVA_HOME=/Users/lin/Library/Java/JavaVirtualMachines/corretto-21.0.11/Contents/Home
export MVN=/Users/lin/.workbuddy/binaries/maven/apache-maven-3.9.9/bin/mvn

# 跑测试（含契约行为测试）
$MVN test

# 打包成可执行 fat jar
$MVN -DskipTests package
```

产物：`worldtuner-bootstrap/target/worldtuner-bootstrap-0.1.0-SNAPSHOT.jar`

> 说明：本机网络经本地代理且 TLS 不稳定，Maven 首次拉依赖可能失败。所有依赖已缓存到 `~/.m2/repository`，遇到网络问题时用**离线模式**打包：`$MVN -o -DskipTests package`。

### 2. 运行

```bash
java -jar worldtuner-bootstrap/target/worldtuner-bootstrap-0.1.0-SNAPSHOT.jar
```

默认配置（`application.yml`）：

- 端口：`8787`
- 目录库：`../worldTuner-data/v2/data/worldtuner-v2.sqlite`（相对启动目录，**建议在项目根目录启动**）
- 统计库：`.local/metrics.sqlite`（自动创建）
- admin token：`change-me`

验证：

```bash
curl http://127.0.0.1:8787/api/health
# => {"data":{"service":"worldtuner-api","status":"ok"}}
```

> 注意：如果在 WorkBuddy / CodeBuddy 这类 IDE 的沙箱环境里跑，环境变量 `SERVER__PORT` 会被注入并覆盖 `server.port`（Spring 环境变量优先级高于 yml）。启动前先清掉它即可：
> `env -u SERVER__PORT -u SERVER_PORT java -jar ...jar`
> 在你自己独立的终端里启动则没有这个问题，默认就是 8787。

### 3. 覆盖配置

所有配置项都能通过环境变量或命令行覆盖：

```bash
# 换端口
java -jar .../worldtuner-bootstrap-0.1.0-SNAPSHOT.jar --server.port=9000

# 换库路径 / token
java -jar .../worldtuner-bootstrap-0.1.0-SNAPSHOT.jar \
  --worldtuner.catalog-db-path=/abs/path/worldtuner-v2.sqlite \
  --worldtuner.metrics-db-path=/abs/path/metrics.sqlite \
  --worldtuner.admin-token=your-secret
```

## 关键约定

- **19 位字符串 ID** 全程用 `String`，避免丢失前导零。
- **译名聚合**：`name_zh → name_en → name` 三层回退。
- **双数据源**：目录库只读、统计库独立写库，SQL 全部参数绑定。
- **SQLite 并发注意**：统计库开 WAL + `busy_timeout=5000`，写池收窄，避免锁竞争。
- 所有新增/修改函数必须有中文注释（项目 `AGENTS.md` 规范，单行注释用 `//`）。


## 部署