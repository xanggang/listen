# 业务数据库迁移

业务表结构唯一来源是 `../schema.sql`。`0001_catalog.sql` 为指向它的相对符号链接，不维护第二份 SQL；数据初始化、API 测试与 Cloudflare D1 使用同一份表结构。

API 的 wrangler.jsonc 从本目录发现迁移，原有 `pnpm db:migrate:local` 和 `wrangler d1 migrations apply DB --remote` 命令保持不变。克隆/打包项目时须保留符号链接及其目标，并保留 API/data 的相邻目录关系。

当前以空库首次初始化为基线。正式执行后不要重写已部署的基线；后续结构变更在这里新增编号迁移，并在 data 项目中同步维护新建库所需的结构。运营库迁移统一在 worldTuner-data/operations/migrations，由两个独立 API 引用。

`0002_admin_outbox.sql` 新增管理操作的可靠审计发件箱。客户端不写该表；管理端把业务修改与事件原子提交，再幂等投递到运营库。新建 SQLite 的 schema.sql 仅含电台业务表，启动本地管理服务时单独初始化 outbox。
