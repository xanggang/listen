# api-java 方案设计

日期：2026-10-09  
状态：方案讨论稿，未开始编码

## 1. 目标与范围

新建 Java 后端项目 `api-java`，作为 WorldTuner 下一代 API：

1. **第一阶段（本期）**：对齐现有 `worldTuner-api`（Cloudflare Worker）的全部对外能力，使用 SQLite 数据库，保证现有 Web（Next.js）与 App（Flutter）在切换到 Java API 后可以正常使用。
2. **架构预留**：从第一天起按多端划分——App、Web 客户端、后台管理系统三个场景，公开只读 API 与管理 API 隔离，鉴权与 DTO 不互相渗透。
3. **不做的事**：本期不做用户账户体系、不做云同步、不做后台管理界面的前端（只提供管理 API）；不迁移生产 D1 数据，SQLite 直接复用 `worldTuner-data/v2` 的业务库。

## 2. 需要对齐的现有功能清单

契约基准：`worldTuner-api/docs/openapi.json`（base path `/api`）。Java 版第一阶段的验收标准就是「响应结构与现有 Worker 一致，客户端零改动可用」。

| 接口                   | 方法   | 说明                                                                                          |
| -------------------- | ---- | ------------------------------------------------------------------------------------------- |
| `/api/health`        | GET  | 健康检查                                                                                        |
| `/api/stations`      | GET  | 电台列表：`page`、`pageSize`、`keyword`、`tagsId`、`languagesId`、`countriesId`，关键词同时匹配名称/标签/语种原名及中英文 |
| `/api/stations/{id}` | GET  | 电台详情（含播放流、标签、语种、国家）                                                                         |
| `/api/map/snapshot`  | GET  | 全量地图点位元组 `[id, name, 经度, 纬度]`，gzip + ETag/304，缓存 TTL 可配置（现默认 300s）                          |
| `/api/map/stations`  | GET  | 地图点位辅助接口                                                                                    |
| `/api/tags`          | GET  | 标签字典：`limit`、`offset`、`q`，返回 `name` / `name_en` / `name_zh`                                 |
| `/api/languages`     | GET  | 语种字典：`limit`，含中英文名与语言代码                                                                     |
| `/api/countries`     | GET  | 国家字典：`limit`                                                                                |
| `/api/metrics/visit` | POST | 匿名访问统计（随机 UUID + 固定页面名，写独立统计库）                                                              |

必须一并迁移的横切行为：

- **CORS**：`ALLOWED_ORIGINS` 白名单，行为与 Worker 中间件一致。
- **限流**：现有 Worker 有单进程限流中间件；Java 版至少提供等价的按 IP 限流。
- **统一错误格式**：错误响应结构以现有 `errors.ts` 产出为准，客户端按此解析。
- **缓存语义**：`/api/map/snapshot` 的 ETag、304、gzip、TTL（0 禁用）必须完整复刻，Web 与 App 都依赖它做缓存。
- **ID 语义**：所有实体 ID 是 19 位数字字符串且保留前导零，Java 侧必须全程用 `String` 接收和返回，禁止用 `Long` 承载（会丢前导零）。
- **译名规则**：标签/语种 `name_zh → name_en → name` 聚合逻辑在 service 层实现，与现有规则一致。

## 3. 技术选型

| 项      | 选型                                                   | 理由                                                               |
| ------ | ---------------------------------------------------- | ---------------------------------------------------------------- |
| 语言/版本  | Java 21 (LTS)                                        | 当前 LTS，record、虚拟线程可用                                             |
| 框架     | Spring Boot 3.x（web + validation）                    | 生态成熟，springdoc 可直接生成 OpenAPI 与现有契约对照；后台管理后续加 Spring Security 顺滑  |
| 构建     | Maven 多模块                                            | 三端分包需要清晰模块边界（见第 4 节）                                             |
| 数据访问   | MyBatis（手写 SQL + `#{}` 参数绑定）                         | 现有 Worker 的 repository 全是手写参数绑定 SQL，可直接平移；SQLite 方言下 JPA 支持差，不推荐 |
| 驱动/连接池 | `org.xerial:sqlite-jdbc` + HikariCP                  | 事实标准                                                             |
| API 文档 | springdoc-openapi                                    | 自动生成 `/v3/api-docs`，与 `openapi.json` 做契约比对                       |
| 测试     | JUnit 5 + MockMvc / Testcontainers（或直接用临时 SQLite 文件） | 契约测试保证与旧 API 响应一致                                                |

**为什么不是 Spring WebFlux / Quarkus**：当前流量规模（数万电台的只读目录 + 低频统计写入）远不需要响应式；虚拟线程（`spring.threads.virtual.enabled=true`）已足够覆盖 IO 密集场景，开发成本最低。

## 4. 多端架构：三端分包方案（回答"分三个子包还是放一起"）

### 结论

**一个 Maven 工程、三个 API 子模块 + 共享模块，一个（或两个）可执行启动器。** App 与 Web 公开接口当前完全相同，业务逻辑共享；后台管理是写操作 + 鉴权，必须物理隔离。

```text
api-java/
  pom.xml                          # 父工程，统一依赖版本
  worldtuner-common/               # 通用：错误码、统一响应/错误结构、工具、常量
  worldtuner-domain/               # 实体 + MyBatis mapper + 业务 service（不感知 Web 层）
  worldtuner-client-api/           # 面向 App / Web 客户端的公开只读 API
    └─ 内部再按端分包：app / web（见下）
  worldtuner-admin-api/            # 后台管理系统 API（鉴权 + 写操作，本期仅骨架）
  worldtuner-bootstrap/            # Spring Boot 启动器：装配数据源、配置、打包成单个 jar
```

### 三端如何落位

在 `worldtuner-client-api` 内按端分包，而不是三个平级大模块：

```text
worldtuner-client-api/src/main/java/.../client/
  shared/          # app 与 web 共用的 controller + DTO（当前 9 个接口落在这里）
  app/             # App 专属预留：将来收藏、播放历史、推送绑定等需要设备鉴权的接口
  web/             # Web 专属预留：将来地图快照聚合、SSR 专用聚合接口等
```

- **当前阶段**：app 和 web 的接口没有差异，全部放 `shared`；`app/`、`web/` 只放包说明占位。这样避免了同一接口写两份 controller，又保留了将来分化的位置——分化时把接口从 `shared` 移到对应端包即可，service 层不动。
- **admin 单独成模块**：管理 API 的鉴权、审计、写操作与公开 API 性质完全不同，不能和公开接口混在同一模块里。本期实现：`/admin/api/**` 路径前缀 + 静态 Token 鉴权（配置文件注入）+ 电台上下架、`catalog_status` 审核、译名校订等写接口的骨架（可先只实现 1~2 个真实接口验证链路，其余按需求排期）。

### 为什么不放一个包里

公开 API 是无鉴权只读、会被 CORS 直接暴露给浏览器；管理 API 是有鉴权写操作。混在一起时，DTO 泄露、路径误配、鉴权覆盖不全的风险都会出现。分包（分模块）的成本在项目初期最低，后期几乎不可能低成本拆开。

### 部署形态

- 默认：`worldtuner-bootstrap` 打成**单个可执行 jar**，同时暴露公开 API 和 admin API（不同路径前缀 + 各自的鉴权/CORS 配置）。
- 预留：如果将来 admin 需要独立部署/内网隔离，只需用同一套 domain 模块新增一个仅装配 admin 的 bootstrap，业务层零改动。

## 5. 数据库设计

### 库文件与读写分离

沿用现有架构的关键决策——**目录库只读，统计写独立库**：

| 库   | 文件                                             | 读写 | 说明                                              |
| --- | ---------------------------------------------- | -- | ----------------------------------------------- |
| 目录库 | `worldTuner-data/v2/data/worldtuner-v2.sqlite` | 只读 | 表结构与 `v2/schema.sql` 完全一致，Java 项目不写这个库，不做迁移     |
| 统计库 | `metrics.sqlite`（独立路径，可配置）                     | 读写 | 访问统计表，建表语句参考 `worldTuner-api/migrations/` 的统计迁移 |

配置双数据源（两个独立的 `DataSource` + 各自的 `SqlSessionFactory`），mapper 按包自动路由：`repository.catalog.*` → 目录库，`repository.metrics.*` → 统计库。

### SQLite 并发注意事项（Java 多线程与 Worker 不同）

- 连接池：目录库可开多个只读连接（`mode=ro`）；统计库写连接建议 `maximumPoolSize=1`，开启 `journal_mode=WAL`、`busy_timeout=5000`。
- `/api/metrics/visit` 在 Worker 里是低频写入；Java 侧可先同步写，若压测出瓶颈再做内存聚合 + 定时批量落库（本期不做，文档留档）。
- SQLite 文件路径全部走配置（`worldtuner.catalog.db-path`、`worldtuner.metrics.db-path`），不硬编码，方便容器挂载。

## 6. 工程分层（对齐现有约定）

与 `AGENTS.md` 对 Worker 项目的分层要求保持一致：

```text
client-api / admin-api 内部：
  controller   # HTTP 输入输出、参数接收、状态码；不做业务
  dto          # 对外字段映射；admin 与 client 的 DTO 禁止互相引用
  service      # 业务规则（译名聚合、分页边界、ETag 计算等都在这里）
  repository   # MyBatis mapper，只写 SQL，参数一律 #{} 绑定
```

关键实现要点：

- **请求校验**：用 Bean Validation（`@Valid` + schema 类）复刻现有 `*.schema.ts` 的约束：`page/pageSize` 范围、关键词长度、非法 `tagsId/languagesId/countriesId` 直接 4xx，不静默退化为全量查询。
- **ETag/304**：`/api/map/snapshot` 用内容哈希（或快照版本号）生成 ETag，`Cache-Control` 与 TTL 配置对齐现有 `MAP_SNAPSHOT_CACHE_TTL_SECONDS`；gzip 用 Servlet 容器压缩（`server.compression`）即可。
- **错误响应**：在 `worldtuner-common` 定义统一错误结构 + 全局 `@RestControllerAdvice`，字段与现有错误中间件一致（以 `worldTuner-api/src/middleware/errors.ts` 为准核对）。
- **限流**：先做按 IP 的简单固定窗口/令牌桶（Resilience4j 或手写过滤器），路径与阈值做成配置。

## 7. 契约兼容与验收

1. 把 `worldTuner-api/docs/openapi.json` 作为契约基准复制到 `api-java/docs/` 下冻结。
2. 写契约测试：对每个接口，用同一份数据分别跑旧 Worker（`pnpm dev:sqlite`）与新 Java 服务，diff 响应 JSON（忽略字段顺序）。至少覆盖：正常分页、边界分页、关键词命中中/英/原名、多筛选组合、空结果、非法参数、304 协商。
3. 客户端切换验收：
   - Web 本地把 `LISTEN_API_BASE_URL` 指向 Java 服务，回归地图、发现、榜单、播放、收藏（本地存储不依赖 API 格式变化）。
   - Flutter 用 `env/local.json` 指向 Java 服务，回归地图快照加载、点选详情、播放、语言切换。
4. 上线切换：生产环境 Web 走 Service Binding 指向 Worker；切 Java 时改为公网 HTTPS 地址 + CORS 白名单即可，客户端不需要发版（App 的 `API_BASE_URL` 是构建期注入，App 端如需切换需要重新打包——这是唯一需要协调的点，文档中明确记录）。

## 8. 实施计划

| 阶段      | 内容                                                          | 产出                    |
| ------- | ----------------------------------------------------------- | --------------------- |
| P0 骨架   | 父工程 + 5 个模块 + 双数据源 + 全局错误/配置 + health 接口                    | 空壳可启动，`/api/health` 通 |
| P1 目录接口 | tags / languages / countries / stations 列表与详情 + 译名聚合 + 契约测试 | 客户端可跑通发现、榜单           |
| P2 地图   | map/snapshot（gzip + ETag/304 + TTL）+ map/stations           | 客户端地球可用               |
| P3 统计   | metrics 库建表 + visit 上报 + 限流 + CORS                          | 横切能力齐，替换完成            |
| P4 管理骨架 | admin Token 鉴权 + 1~2 个写接口（如电台 visibility 上下架）               | 多端三包结构闭环              |
| P5 收尾   | 全量契约 diff 报告、双客户端回归记录、部署文档                                  | 可发布状态                 |

## 9. 风险与待确认项

1. **App 换地址需要重新打包**（构建期注入），切换生产 API 时 App 发版节奏需要提前定。
2. **SQLite 写并发**：如果下一版本把更多写能力（收藏、上报）放进 Java 端且仍用 SQLite，需要尽早评估；届时建议统计/业务写库分离甚至引入独立数据库，本期先不做。
3. **admin 的鉴权强度**：静态 Token 只适合过渡，接入真实用户体系后要换 Spring Security + 审计日志，admin 模块的 DTO 与 controller 结构要按此设计。
4. **`/api/map/stations` 的具体语义**需要在实现前对照源码确认（是否与 snapshot 有重叠、是否可标记废弃）。
5. 现有 Worker 的限流阈值、CORS 默认值等配置细节实现时从 `wrangler.jsonc` 与中间件源码中提取，不凭记忆假设。

---

以上为方案稿。确认后从 P0 骨架开始搭建。
