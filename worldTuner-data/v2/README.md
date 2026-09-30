# V2 本地数据库

本目录保存 V2 数据库建表定义和初始化脚本。目标结构与字段说明见[设计文档](docs/电台数据库设计.md)。

在 `worldTuner-data/` 下执行：

```bash
node v2/src/init.mjs
```

脚本在 `v2/data/worldtuner-v2.sqlite` 创建空 SQLite；目标文件已存在时拒绝覆盖。原始 Radio Garden、Radio Browser 数据库不受影响。数据库文件由 `worldTuner-data/.gitignore` 忽略，不提交到 Git。

本地 V2 库的生成主键与关联外键使用字符串。默认库 `v2/data/worldtuner-v2.sqlite` 已通过 [Radio Garden 数据处理脚本](../radio-garden/processing/README.md) 和 [Radio Browser 数据处理脚本](../radio-browser/processing/README.md) 导入数据；脚本拒绝对已有同源记录的库重复导入。`v2/worldtuner-v2.sqlite` 是独立的空库，默认脚本不会更新它。后续连接 SQLite 时需开启 `PRAGMA foreign_keys = ON`；布尔值用 `0`、`1` 或允许的 `NULL` 表示，时间使用 ISO 8601 文本。
