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

D1 在 worldTuner-api 下应用增量迁移 `0006_country_names.sql`（先前迁移应已按顺序应用）：

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
