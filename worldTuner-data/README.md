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
    src/        # 可见浏览器采集入口
    data/       # 原始 JSON 和采集记录
    README.md
```

需要 Node.js >= 22.18。Radio Browser 无第三方运行依赖；Radio Garden 使用 Playwright 和本机 Google Chrome，先运行 `npm ci` 安装依赖。

```bash
cd worldTuner-data
npm run sync:radio-browser
npm test
```

[Radio Browser 使用说明](radio-browser/README.md)。此数据源直接读取同级 `worldTuner-api/migrations/` 的现有建表和索引 SQL，保持业务表字段一致；需保留仓库目录关系。输出为独立 SQLite，不自动导入 Wrangler 本地或远程 D1。

[Radio Garden 使用说明](radio-garden/README.md)：保留浏览器采集命令 `npm run sync:radio-garden`，也可运行纯接口版本 `npm run sync:radio-garden:api`。两者共用 Radio Garden 自己的 SQLite。
