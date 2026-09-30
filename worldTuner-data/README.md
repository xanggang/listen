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
