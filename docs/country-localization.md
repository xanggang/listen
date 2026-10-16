# 国家名称中英文切换

## 数据与展示

复用现有 `radio-garden/data/radio-garden.sqlite` 的 `radio_garden_country_names`，将 225 条映射导出为 `worldTuner-data/geo-localization/data/country-names.json`，保留来源与原同步时间。本次不下载新数据、不修改原始采集库。JSON 快照纳入版本管理，导入、SQLite 升级及 D1 迁移使用相同映射。

统一 `country` 表新增 `name_en`、`name_zh`。英文首次从原 `name` 回填，中文严格按 `code` 匹配现有映射；不修改 ID、原名、代码或电台关联。重复执行保留人工校订的中英文名。没有代码的手工地区不被当作国家自动关联。

- 中文：`name_zh → name_en → name`；英文：`name_en → name`。
- 国家字典接口返回全部展示名；电台接口新增 `countryEn`、`countryZh`，原 `country` 保留。
- 电台关键词支持国家原名、中英文与代码，精确国家筛选继续使用 ID。
- 移动端国家筛选支持中英文与代码搜索；中文界面按展示名排序，隐藏英文 A–Z 索引，英文保留。没有增加拼音依赖，也没有实现拼音搜索。
- 移动端与 Web 的发现、排行榜、电台列表、地图选台信息、播放器使用本地化国家名；收藏持久化保留译名，历史收藏回退原名。
- 字典包含所有译名，切换语言不重新请求。JSON 缓存版本升级为 `country-names-1`，隔离旧响应；地图点位快照格式保持不变。

## 本地升级结果（2026-10-12）

业务库 `worldTuner-data/v2/data/worldtuner-v2.sqlite` 已备份并迁移。236 个国家／地区中，221 个填入中文，15 个保留英文兜底。10 张表的原有字段逐表摘要比较一致，外键检查通过。

完整备份：`worldTuner-data/v2/data/worldtuner-v2-country-names-2026-10-12T03-26-21.377Z.sqlite`（本地文件，不提交 Git）。

未覆盖代码：AF、AQ、BQ、CC、CG、IO、MV、NU、PF、PW、SS、TF、TM、UM、XX。其中 XX 原名为 France，代码异常，本次未推断或修正其身份。后续补齐映射或修正数据时单独审查。

## 其他环境更新顺序

SQLite 在 worldTuner-data 下运行：

```bash
# 默认只读预览
npm run migrate:v2:country-names -- --db /实际路径/catalog.sqlite
# 先完整备份，再事务迁移；可用 --backup 指定一个不存在的备份路径
npm run migrate:v2:country-names -- --db /实际路径/catalog.sqlite --apply
```

随后重启 API。当前本地默认库已经完成此操作，无须再重复迁移。

D1 已按远程空库统一整理为 `worldTuner-data/v2/schema.sql`，直接包含国家中英文列。先在本地处理译名，再初始化 D1 并导入完整数据：

```bash
pnpm db:migrate:local
# 正式环境发布时单独执行，本次未操作远程数据库
pnpm exec wrangler d1 migrations apply DB --remote
```

先迁移数据库，再更新 API，然后刷新 Web、完整重启移动端。现有空库可以使用新 schema 初始化，两个 v2 导入流程在事务结束前回填新国家的展示名。

## 验证

- API：类型、格式检查、16 项测试与 Worker dry-run 构建通过，包含国家 ID 筛选、中英文及代码搜索。
- Web：TypeScript、10 项测试与 ESLint 通过（保留 3 条既有 img 优化警告）。
- Mobile：analyze 通过，24 项原有/模型测试和 1 项新增国家筛选组件测试通过；组件测试验证中文显示、英文回退、语言切换复用缓存及中文/代码搜索。
- Data：39 项测试中 36 通过；3 项既有 Radio Browser 原始同步测试仍因缺少历史文件 `0001_existing_schema.sql` 失败。本次国家迁移及现有 v2 导入测试通过。
- 本地真实数据库通过 API 入口验证国家列表与“中国”电台搜索，均返回 200 和中文国家名。没有截图或真机验收，没有远程部署。

后续需要刷新翻译时，先更新现有名称源，再审查 JSON 快照差异；SQLite 可重复执行迁移补齐缺失译名，D1 通过新的增量迁移补齐，已发布历史迁移不改写。

## Java API 与安卓排行榜补齐（2026-10-15）

Java 的国家字典原先遗漏 `name_en`、`name_zh`，现已补齐；电台响应同步返回 `countryEn`、`countryZh`。安卓无需自带国家翻译表，复用 API 数据和已有展示兜底。

排行榜新增国家榜，支持热门国家、查看全部、中英文/代码搜索、清除筛选及非热门项回显。前三名与分页列表统一使用 `countriesId`。国家字典按需加载并缓存。

需重新打包上传 Java JAR、重启服务，再完整重启 App 清除内存中的旧字典。如果服务器数据库还没有国家译名字段，先按本文 SQLite 迁移步骤升级业务库；本次没有修改服务器数据库或发布服务。

## 补齐国家名称与面板语言排序（2026-10-15）

补齐原先缺少的 14 个代码对应中文名，来源为 Unicode CLDR 中文地区表：
https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-localenames-full/main/zh/territories.json

另为 `code=XX AND name=France` 添加严格限定的显示别名“法国”，不修改异常代码或电台关联；其他 XX 不会套用此译名。已有人工译名不会覆盖。国家面板在构建时按当前语言的展示名重新排序，切换语言无需重新请求。

本地库已备份后补齐 15 项，现在 236 项都有中文显示名。原始数据逐表摘要一致，外键检查通过。备份：`worldTuner-data/v2/data/worldtuner-v2-country-names-2026-10-15T08-53-51.549Z.sqlite`。

服务器 SQLite 在更新代码/名称 JSON 后执行：

```bash
# 在 worldTuner-data 目录，使用服务器实际数据库路径
npm run migrate:v2:country-names -- --db /opt/worldtuner/worldtuner-v2.sqlite
npm run migrate:v2:country-names -- --db /opt/worldtuner/worldtuner-v2.sqlite --apply
sudo systemctl restart worldtuner
```

或者先备份服务器目录库，再同步本地已补齐的业务库。不要覆盖服务器的 `metrics.sqlite`。D1 的译名随本地处理后的数据导入，不再单独执行国家补充迁移。本次未操作服务器。

验证：4 项数据迁移测试、5 项 Flutter 国家面板/排行榜测试及 Flutter analyze 通过。
