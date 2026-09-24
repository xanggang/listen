# listen 项目分析与重开发准备

分析日期：2026-09-24  
源码目录：`/Users/lin/Documents/www/lin/worldtuner/listen`  
目标：Flutter 安卓客户端 + Cloudflare Workers 独立后台 + Cloudflare D1 数据库。

本文区分「现有实现」「已确认问题」「重开发建议」。本次仅分析和整理，未修改原项目，未连接线上数据库，未执行导入、部署或播放验证。数据统计来自本地 SQL 导出，不代表当前线上状态。

## 1. 核心判断

listen（产品名 WorldTuner）是一个通过地图、搜索、榜单发现并收听全球网络电台的 Web 应用。

已有后端基础就是 Cloudflare Workers + D1：Next.js 通过 OpenNext 部署，Server Actions 直接访问 D1。后续不是从零迁移数据库技术，而是把业务接口从 Next.js 中拆出，建立适合 Flutter 调用的 HTTP JSON API。

最值得保留的是电台数据、字段含义、发现与榜单规则、中英文文案及四个主要入口。React 页面、Zustand 和 HTML audio 播放实现需要按 Flutter / Android 生命周期重新实现。

建议先做无登录版本，完成地图选台、搜索、榜单、稳定播放、后台播放、中英文和主题；收藏、历史可作为新增本地功能。账号与云同步属于扩展需求，尚未得到确认。

## 2. 代码结构与技术栈

| 位置 | 职责 |
|---|---|
| `src/app/page.tsx` | 首页跳转到 `/player` |
| `src/app/player/page.tsx` | 地图选择电台、查询详情、触发播放 |
| `src/app/discover/page.tsx` | 关键词搜索、分页列表 |
| `src/app/leaderboard/page.tsx` | 全球 / 语言 / 标签榜单 |
| `src/app/settings/page.tsx` | 语言、主题及部分占位设置 |
| `src/app/layout.tsx` | 全局播放器、底部导航、主题和国际化 |
| `src/app/actions/actions.ts` | D1 查询，当前业务服务入口 |
| `src/app/store/useStationStore.ts` | 当前电台与播放标记，浏览器本地持久化 |
| `src/components/Map.tsx` | MapTiler 地图、静态点位、点击定位 |
| `src/components/PlayerCard.tsx` | HTML audio 播放与暂停 |
| `src/types/index.ts` | 业务类型与查询类型 |
| `messages/en.json`、`messages/zh.json` | 中英文文案 |
| `public/data.json` | 独立静态地图数据，约 1.9 MB |
| `migrations/*.sql` | 四张业务表建表脚本，带 DROP TABLE |
| `script/listen-d1-export.sql` | 本地 D1 数据快照，约 77 MB |
| `script/db.js` | MySQL → 本地 D1 手工搬运脚本 |
| `wrangler.jsonc` | OpenNext Worker 与 D1 的 DB 绑定 |

依赖声明：Next.js 15.5.9、React 19.1.4、TypeScript、Zustand 5、next-intl 4、next-themes、MapTiler SDK 3、Tailwind 4、SCSS、OpenNext Cloudflare、Wrangler 4。版本取自 package.json，范围声明不等于实际安装版本。

README 中 Prisma 接入说明与现状不一致：当前查询使用 D1 prepare / bind，没有 Prisma 查询层。`/db` 是占位页面，不是可用管理后台。

## 3. 功能完成度

| 功能 | 现有实现 | 重开发处理 |
|---|---|---|
| 地图浏览电台 | 卫星底图；一次加载静态点位；点选后查询详情 | 保留体验，改为视口点位接口与聚合 |
| 电台搜索 | 名称、标签、语言 LIKE；500ms 防抖 | 保留，补并发请求保护、空态、错误重试 |
| 全球榜单 | votes 倒序 | 保留，明确是数据源票数，不是本应用听众数 |
| 语言 / 分类榜单 | 取前 30 个语言 / 标签，按名称模糊匹配 | 保留，修复筛选切换和分页 |
| 播放 / 暂停 | 全局 HTML audio，直接访问 station.url | Android 原生音频生命周期重建 |
| 跨页面播放器 | 根布局挂载播放器 | Flutter 全局音频服务 + 迷你播放器 |
| 后台 / 锁屏播放 | 未见原生媒体服务实现 | 安卓版本核心验收项 |
| 语言 | 中文、英文，Cookie 保存 | Flutter 本地化和本地偏好 |
| 主题 | next-themes；开关显示有同步问题 | 单一主题状态源 |
| 收藏、音量、更多操作 | 占位或注释，不是完整功能 | 按新增需求设计 |
| 地图自动居中设置 / 清缓存 | 注释或仅打印日志 | 后续决定范围 |
| 关于 | 仅打印日志 | 新版补基础信息页 |
| 用户账号 / 云收藏 / 收听历史 | 未见完整业务实现 | 不应误认为已有功能 |

现有链路：页面 → Server Action → D1 → 页面 / Zustand → HTML audio → 电台流地址。地图先读静态 JSON，再按数值 id 查 D1，存在两套数据源。

## 4. 数据盘点与质量

将 SQL 快照装载到临时内存 SQLite 后统计，未执行原仓库迁移脚本。

| 表 / 指标 | 数量或结论 |
|---|---:|
| station | 51,707 |
| languages | 601 |
| tags | 10,137 |
| countries | 244 |
| User | 1 条示例记录；未见账号业务 |
| stationuuid 空值 / 空串 | 0 |
| stationuuid 重复组 | 0 |
| lastcheckok = 1 | 51,277 |
| lastcheckok = 0 | 430 |
| 同时具有经纬度 | 9,200 |
| 经纬度在合法范围内 | 9,199 |
| 原始 url 使用 HTTP | 22,141 |
| url_resolved 使用 HTTP | 22,165 |
| url_resolved 缺失 / 空串 | 84 |
| 静态地图点位 | 9,200 |
| 地图 id 在快照中缺失 / 名称不一致 | 0 / 0 |

地图和快照目前在 id、名称上匹配，但代码没有同步机制；未来重新导入或变更 id 后仍可能错配。经纬度存在不等于地理位置真实准确。

格式分布：MP3 35,260；AAC+ 7,922；AAC 6,397；UNKNOWN 1,491；OGG 539；另有视频混合编码、FLV 和空值。不能只拿一个 MP3 链接作为播放器验收依据。

`lastchecktime_iso8601` 名字虽然带 ISO8601，实际快照值是 `Tue Nov ... GMT+0800 ...` 形式，不能按字段名直接假设标准格式。抽查及字符串聚合结果涉及 2025 年 11 月；本次没有完成全部时间字段的语义解析，不能将字符串 MIN/MAX 当成准确时间范围。历史 lastcheckok 也不能保证现在可播。

### 字段分组

- 身份：id、stationuuid、changeuuid。
- 展示：name、homepage、favicon、country、countrycode、state、iso_3166_2。
- 分类：tags、language、languagecodes，目前为文本、多值混在字符串中。
- 播放：url、url_resolved、codec、bitrate、hls、ssl_error。
- 地理：geo_lat、geo_long、geo_distance。
- 热度：votes、clickcount、clicktrend、clicktimestamp 及其时间变体。
- 数据健康：lastcheckok、多组 lastcheck / lastchange 时间、has_extended_info。

导出中仅见 User.email 唯一索引，station、languages、tags、countries 没有显式业务索引。对当前榜单 SQL 执行 EXPLAIN QUERY PLAN，得到 `SCAN station` 和 `USE TEMP B-TREE FOR ORDER BY`。

## 5. 已确认问题与优先级

| 优先级 | 位置 | 问题与影响 |
|---|---|---|
| 高 | `leaderboard/page.tsx` fetchStations | 把 `(pageNum - 1) * 10` 当作 page 传入，服务端又计算 `(page - 1) * pageSize`。第二页实际 offset 90，应为 10，产生漏项。第一页传 0 也违反接口语义。 |
| 高 | `discover/page.tsx` | `setHasMore(list.length <= PAGE_SIZE)` 对正常返回的 0～20 条几乎总为 true，结束状态错误。 |
| 高 | `actions.ts` / `types/index.ts` | D1 返回 snake_case，Station 却定义 urlResolved、geoLat 等 camelCase，仅类型断言，无实际转换。当前 url/name 可用不代表整个对象契约正确。 |
| 高 | `leaderboard/page.tsx` | 切换榜单类型仅变更 type，不清除 language/tag，也不以 type 控制请求，全球榜可能继续使用隐藏过滤条件。 |
| 高 | `migrations/*.sql` | 使用 DROP TABLE 重建，不能直接作为生产增量迁移。 |
| 高 | `actions.ts` | 缺少 page/pageSize 范围和关键词长度校验；非法语言/标签 id 会忽略过滤，退化为广泛查询。 |
| 中 | `PlayerCard.tsx` | 只使用原始 url；没有统一缓冲、超时、重试、流结束与运行期错误状态。未见 Android 后台媒体能力。 |
| 中 | `useStationStore.ts` | 持久化 isPlaying，恢复后标记可能与实际引擎不同，应持久化电台并由引擎产生运行态。 |
| 中 | 两个列表页 | 未防止旧请求覆盖新筛选结果；榜单请求没有 try/finally，失败可能持续 loading，另有人为 1 秒等待。 |
| 中 | `Map.tsx` | 整包加载地图数据，无视口限制与聚合；API key 写在源码，需明确用途和限制；外部名称通过 setHTML 拼接，若数据含 HTML 会被解析。 |
| 中 | `settings/page.tsx` | nightMode 与 theme 分开保存，开关状态可能与真实主题不同。 |
| 中 | `script/db.js` | 硬编码数据库连接配置，MySQL 驱动和端口/命名组合可疑，需核实源库类型；脚本缺少幂等 upsert 与可靠断点恢复。整理文档不复制连接密码。 |
| 中 | `next.config.ts` | 构建跳过类型和 ESLint 错误，构建成功不足以证明正确。 |
| 中 | 国际化 | 部分标题、按钮提示硬编码英文；Cookie locale 未统一按允许值校验。 |
| 低 | README、`/db`、mock | 文档过时，残留示例和未使用代码，应在新项目中移除或单独归档。 |

已运行 `tsc --noEmit --incremental false`：退出码 2，报 `src/app/actions/actions.ts(8,18): Property 'DB' does not exist on type 'CloudflareEnv'`。这是类型声明问题；不据此断言运行时 D1 绑定失效。

原仓库已有 README.md、script/db.js、script/listen-d1-export.sql、pnpm-workspace.yaml 的未提交状态；本次没有改动这些文件。

## 6. 推荐重开发结构

```text
Flutter Android
  ├─ 地图 / 发现 / 榜单 / 设置
  ├─ 全局音频服务 → 直接访问电台音频源
  └─ HTTP JSON → Cloudflare Worker
                    ├─ 参数校验 / DTO 映射 / 错误处理 / 缓存
                    ├─ D1 查询
                    └─ 独立的数据同步入口（受保护）
```

Worker 提供目录和元数据，不默认中转长期音频流。Flutter 直接播放源地址，数据库和 Cloudflare 管理凭证只留在服务端。

建议目录：

```text
worldtuner-next/
  apps/mobile/          Flutter 客户端
  services/api/         TypeScript Worker
  database/migrations/  编号、可审查的 D1 增量迁移
  tools/import/         清洗、导入、统计与校验
  contracts/            HTTP 契约和示例
  docs/                 需求、架构、验收说明
```

Flutter 分层按 features（map/discover/leaderboard/player/settings）、数据仓储、API 客户端、全局音频服务组织。状态管理具体库可在启动开发时确定；关键是播放器只有一个实例，页面销毁不销毁播放服务。

播放器可评估 just_audio + audio_service，覆盖音频引擎及后台媒体控制；官方包说明支持相应职责，实际协议与设备兼容性仍需真机验证。[just_audio](https://pub.dev/documentation/just_audio/latest/) / [audio_service](https://pub.dev/packages/audio_service)

地图供应商待定：现项目使用 MapTiler 卫星底图。先验证 Flutter 对应 SDK、图层能力、密钥限制、授权费用和目标地区网络，再决定是否保留原底图。

## 7. 建议 API 草案

以下是新设计，不是现有接口。统一前缀 `/api/v1`，响应使用 camelCase，日期使用 UTC ISO8601，允许缺失的字段显式为 null。

| 方法 / 路径 | 用途及约束 |
|---|---|
| GET `/health` | 服务基本健康状态，不输出敏感配置 |
| GET `/stations` | keyword、language、tag、countryCode、cursor、limit；默认 20，建议最大 100 |
| GET `/stations/{stationUuid}` | 电台详情，找不到返回 404 |
| GET `/leaderboards` | scope=global/language/tag、对应 filter、cursor、limit；scope 决定唯一过滤模式 |
| GET `/languages` | 可选 limit，按电台数排序 |
| GET `/tags` | 可选 limit，按电台数排序 |
| GET `/countries` | 国家维度，现版尚未接入用户流程 |
| GET `/map/stations` | bbox、zoom；限制响应点数，低缩放返回聚合，高缩放返回简化点位 |

列表响应建议：`{data: [...], pageInfo: {hasMore, nextCursor}}`；详情响应 `{data: {...}}`；错误 `{error: {code, message, requestId}}` 并使用对应 HTTP 状态码。

分页按 `votes DESC, id ASC` 稳定排序，以 votes/id 组合游标；查询 limit+1 条确定 hasMore。游标应绑定筛选条件。导入更新票数会使跨页结果漂移，首版客户端按 uuid 去重并支持刷新；要求严格快照时再增加数据版本。

搜索首版可限制长度并保留 LIKE，但须承认 `%关键词%` 一般不能靠普通 B-tree 索引消除扫描。分类改为关联表精确匹配；后续根据语言和中文搜索需求再评估全文索引。

地图接口需约定 bbox 顺序、跨越日期变更线的行为、zoom 范围、聚合类型与最大返回数，不能只是无上限导出全部 station。

## 8. D1 演进与迁移策略

保留现有数据快照作为源资产，优先使用 stationuuid 作为外部稳定标识。当前没有空值和重复，但数据库尚无对应约束，后续同步仍需验证。

建议模型：

| 表 | 目的 / 关键约束 |
|---|---|
| stations | 内部 id 主键；station_uuid 唯一；名称、播放地址、地理、健康和热度等 |
| languages / tags / countries | 字典，采用清洗后的稳定 code 或唯一名称策略 |
| station_languages / station_tags | 多对多关联，复合主键去重，支持精确筛选 |
| sync_runs | 同步来源、时间、数量、结果和错误摘要 |

建议对榜单排序、国家过滤和关联表反向查询建立匹配索引，使用 EXPLAIN QUERY PLAN 与 D1 实际查询统计验证。坐标索引需要结合 bbox 查询实测，单个复合索引不等于完整空间索引。Cloudflare 官方说明索引可降低查询扫描行数与延迟。[D1 索引指南](https://developers.cloudflare.com/d1/best-practices/use-indexes/)

迁移顺序：

1. 保存当前 SQL 快照及校验值，记录源库 / 导出日期 / 行数；不要覆盖唯一备份。
2. 在独立开发库建新表。现有 DROP TABLE 脚本仅供理解，不能套用到旧线上库。
3. 清洗 uuid、URL、布尔标记、时间、空值和分类分隔符；非法坐标置为不可展示并保留问题记录。
4. 以 uuid upsert 导入主表，保留旧 id 到新 id 的映射，构建字典及关联关系。
5. 明确保留历史原始时间还是转换为 UTC；不能把本地时间无条件加 Z。
6. 核对行数、uuid 唯一性、关联完整性、样本播放地址、地图点位和榜单顺序。
7. Flutter 改用 uuid；不依赖旧静态 JSON 的数值 id。
8. 测试环境验证后再规划生产切换和回滚；源库保持可追溯。

数据字段像 Radio Browser 格式，但仓库不足以确认原始来源、授权、更新频率或同步协议。正式建立自动同步前应核实，不把推测当成既定来源。收藏 / 历史若首版本地存储，不需要立即新增云端用户表。

## 9. 安卓重点验收

- 连续切换电台、缓冲、超时、断流、重试、离线后恢复，UI 状态跟随音频引擎。
- 锁屏、后台、通知栏暂停/继续、耳机操作、拔耳机、音频焦点打断。
- 进程重启恢复上次电台但不直接相信持久化的 isPlaying。
- MP3、AAC、AAC+、OGG、HLS、重定向链接抽样；不支持格式给出明确状态。
- 数据中大量 HTTP 音频源，开发时必须核对 Android 网络安全配置及链接跳转；不能假定所有流都是 HTTPS。
- 后台媒体服务配置以最终 targetSdk 和插件官方要求为准；至少覆盖实际目标 Android 版本与一台真机。
- 搜索快速输入、切筛选、加载末页、失败重试、重复结果和空结果。
- 全球视口聚合、跨日期变更线、无坐标电台、地图加载失败；无坐标电台仍可通过列表搜索。
- 中英文、系统主题与手动主题、较大字体、小屏和安全区域。

## 10. 建议实施顺序

1. **接口与数据基础**：完成 DTO、增量迁移、索引、导入脚本、列表/详情/字典接口，修正旧分页语义。
2. **可收听的最小客户端**：发现页 + 搜索 + 全局播放器，先验证真实流与后台播放。
3. **主要功能齐备**：榜单、地图视口接口与聚合、中英文、主题、关于。
4. **增强及发布准备**：按确认范围加入本地收藏/历史；真机稳定性、错误体验、安装包构建及分环境配置。

后续需确定的产品事项：是否坚持卫星地图；首版是否加入收藏/历史；是否需要登录云同步；电台数据来源与更新方式；主要用户地区；安卓最低版本和分发渠道。它们不影响先完成接口与播放器验证，但会影响正式实现范围。

## 11. 本次验证边界

完成：核心页面、组件、服务端查询、数据类型、配置、迁移和导入脚本阅读；本地 SQL 快照表结构与质量统计；地图 id/名称一致性检查；榜单 SQL 执行计划检查；TypeScript 静态检查。

未完成也未声称完成：页面视觉走查、运行时交互测试、逐个音频源可用性检查、线上 D1 对比、Flutter 或 Worker 新项目实现。本文是后续开发基线，不是已经交付的新安卓应用。
