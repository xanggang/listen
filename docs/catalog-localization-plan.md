# 标签与语言中英文名称统一

范围：worldTuner-data、worldTuner-api、worldTuner-mobile、worldTuner-web（PC）。国家与电台名称不属于本次翻译范围。

## 约定

- `name` 保留现有名称与匹配语义；`name_en` 为独立英文展示名，首次迁移由 name 回填；`name_zh` 保留已有中文译名。
- 中文：name_zh → name_en → name；英文：name_en → name。空白字符串视为缺失。
- ID、normalized_name、语言 code 与关联保持不变。首次复制不能保证所有名称已经是英文，后续可以独立修正 name_en。
- 搜索同时匹配原文、英文和中文。名称随界面语言即时变化，字典缓存不按界面语言拆分。

## 执行步骤

- [x] data：更新新库 schema；提供可重复执行、先备份的旧 SQLite 迁移；适配导入、标签清洗与备份恢复，保留英文展示名。
- [x] API：新增增量 D1 迁移；返回两种展示名；标签与电台关键词支持中英文；更新 OpenAPI、测试和部署说明。
- [x] 移动端：统一展示名称和搜索匹配，覆盖排行榜、发现、搜索和完整筛选面板。
- [x] PC Web：统一展示名称，覆盖发现和排行榜的标签、语言选项。
- [x] 验证：data/API/Web/Flutter 检查和行为测试；备份后迁移本地 v2 数据库，核对关联与名称。远程数据库不修改。

## 本次完成与验证（2026-10-08）

- API：类型检查、格式检查、15 项测试及 Worker dry-run 构建通过。覆盖 SQLite / D1 形状绑定一致性、增量迁移、新旧缓存隔离和中英文搜索。
- Mobile：Flutter analyze 无问题，24 项测试通过，包括名称兜底、收藏往返和既有排行榜重试。
- PC Web：TypeScript、9 项测试和 ESLint 通过（3 条既有 img 优化警告）。临时副本的 Next 生产构建通过，未改动用户正在使用的 `.next`；副本保留 next-intl，省略 Cloudflare 开发绑定初始化，未验证远程部署。
- Data：全量 37 项测试，34 通过、3 个既有失败。失败项是 Radio Browser 原始同步测试引用已不存在的 `worldTuner-api/migrations/0001_existing_schema.sql`，与本次 v2 字典迁移无关。本次迁移、清洗和 AI 清洗的 7 项专项测试全部通过，覆盖英文校订保留、旧备份恢复和事务回滚。
- 使用本地真实业务库通过 API 入口验证标签、语言、中文标签搜索与中文语种电台搜索，均返回 200 且有数据。未截图，未进行真机视觉验证。

## 本地数据库状态

已迁移 `worldTuner-data/v2/data/worldtuner-v2.sqlite`，回填 8,656 个标签和 167 个语言的英文名。迁移前完整备份：

`worldTuner-data/v2/data/worldtuner-v2-catalog-names-2026-10-08T11-24-08.948Z.sqlite`

对备份和迁移后数据库逐表比较原有字段内容摘要，10 张表全部一致，外键检查通过。包含 81,904 个电台、107,768 条标签关联和 37,571 条语言关联。没有清洗或重新导入本地实际数据。备份为本地文件，不纳入 Git。

## 更新顺序

1. 当前本地默认 SQLite 已完成升级，重启 API 后使用新代码。其他 SQLite 部署先在 worldTuner-data 执行 `npm run migrate:v2:catalog-names -- --db /实际路径/catalog.sqlite` 预览，再加 `--apply` 备份并迁移。
2. D1 按历史迁移顺序应用到 `0005_catalog_name_en.sql`，再更新 Worker；本次没有修改远程数据库。具体命令见 API README。
3. 更新 Web，刷新页面；移动端完整重启 App 重新加载字典。后续切换语言只重算展示，不额外请求字典。
4. 初始 `name_en` 是复制原名，尚未对全部名称做人工英文翻译。可以独立修正 `name_en`，不改原名、匹配键与关系；部署新译名后按 API 缓存 TTL 等待刷新或调整响应缓存版本。

实现与命令分别记录在四个子项目的 README，API 契约同步在 OpenAPI。
