# WorldTuner Data

独立的数据采集项目。每个数据源使用单独目录，包含实现、测试、使用说明和本地产物；后续数据源与 `radio-browser/` 平级添加。

```text
worldTuner-data/
  package.json
  radio-browser/
    src/        # API 请求、数据库写入和命令入口
    test/       # 离线行为测试
    data/       # 本地 SQLite（不提交 Git）
    README.md
  radio-garden/
    src/        # Radio Garden API 采集与地点整理
    data/       # 本地 SQLite 和采集进度
    README.md
```

需要 Node.js >= 22.18。两个数据源均使用 Node 内置能力采集，不需要浏览器运行环境。

```bash
cd worldTuner-data
npm run sync:radio-browser
npm test
```

[Radio Browser 使用说明](radio-browser/README.md)。此数据源来自radio_browser， 同步程序暂时找不到了

[Radio Garden 使用说明](radio-garden/README.md)：此数据源用法参考radio-garden/README.md

[Radio Garden 地区名本地化](geo-localization/README.md)：独立命令 `npm run localize:radio-garden:countries` 为已整理地点关联中文国家或地区名；已有完整结果时不再请求远程 CLDR。

## v2 字典名称

`tag`、`language` 使用 `name`（原始匹配名称）、`name_en`（独立英文展示名）、`name_zh`（中文展示名）。首次升级把缺失英文名从 `name` 回填，不代表全部原名已核验为英文。后续可校订英文展示名，无须更改 `normalized_name`、语言代码或关联 ID。中文客户端使用中文→英文→原文；英文客户端使用英文→原文。

```bash
npm run migrate:v2:catalog-names
npm run migrate:v2:catalog-names -- --apply
# 指定自定义业务库：
npm run migrate:v2:catalog-names -- --db /实际路径/catalog.sqlite --apply
```

默认只读预览；`--apply` 在原库旁创建完整 SQLite 备份后事务升级。可用 `--backup /备份路径.sqlite` 指定位置，已有备份不会覆盖。只升级统一 v2 业务库，不修改 Radio Browser / Radio Garden 原始采集库。两个导入流程补齐展示字段；标签清洗、AI 清洗与备份恢复支持英文名并保留已校订值。

国家字典现在也支持 `name_en`、`name_zh`，复用 geo-localization 的现有名称快照。用 `npm run migrate:v2:country-names` 预览，加 `-- --apply` 完整备份后升级；自定义业务库可传 `--db`。两个 v2 导入器自动填补新国家名称。未覆盖代码保留英文，不猜测身份。
