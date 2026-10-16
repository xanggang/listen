# 业务数据库迁移

业务表结构唯一来源是 `../schema.sql`。`0001_catalog.sql` 为指向它的相对符号链接，不维护第二份 SQL；数据初始化、API 测试与 Cloudflare D1 使用同一份表结构。

API 的 wrangler.jsonc 从本目录发现迁移，原有 `pnpm db:migrate:local` 和 `wrangler d1 migrations apply DB --remote` 命令保持不变。克隆/打包项目时须保留符号链接及其目标，并保留 API/data 的相邻目录关系。

当前以空库首次初始化为基线。正式执行后不要重写已部署的基线；后续结构变更在这里新增编号迁移，并在 data 项目中同步维护新建库所需的结构。统计迁移仍由 API 的 migrations/operations 维护。
