# V2 本地数据库

本目录保存 V2 数据库建表定义和初始化脚本。目标结构见[设计文档](../../docs/V2版本/电台数据库设计.md)。

在 `worldTuner-data/` 下执行：

```bash
node v2/src/init.mjs
```

脚本在 `v2/data/worldtuner-v2.sqlite` 创建空 SQLite；目标文件已存在时拒绝覆盖。原始 Radio Garden、Radio Browser 数据库不受影响。数据库文件由 `worldTuner-data/.gitignore` 忽略，不提交到 Git。

当前只建表，尚未导入电台数据。后续连接 SQLite 时需开启 `PRAGMA foreign_keys = ON`；布尔值用 `0`、`1` 或允许的 `NULL` 表示，时间使用 ISO 8601 文本。
