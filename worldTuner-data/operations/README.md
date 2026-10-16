# 运营数据库结构

两个独立后端使用同一个运营数据库，迁移仅在此维护，不在客户端或管理 API 项目中复制。

- migrations/0001_operations.sql：匿名页面 PV、日 UV、月 MAU 及短期去重表。
- migrations/0002_admin.sql：管理员身份、操作审计、客户端错误报告表。

两个 API 的 wrangler.jsonc 都将 METRICS_DB.migrations_dir 指向此目录；原有迁移名称与内容不变，不因源码目录移动重复执行或复制数据。D1 中的迁移记录按文件名识别。SQLite 客户端只初始化统计表，管理服务额外初始化管理表。

数据库文件和 Secret 不入库。配置两个本地服务的 METRICS_SQLITE_PATH 指向同一文件，才可查看客户端已上报的统计；不自动搬迁或覆盖已有 SQLite 文件。
