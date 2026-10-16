# WorldTuner 管理中心

独立 React + TypeScript + Vite + Ant Design 6 前端。管理后端在相邻 `worldTuner-admin-api` 中独立入口、独立 Worker 部署，前后端在生产同源，不与客户端 Worker 混合发布。

## 已实现

- 工作台与访问分析：真实 PV、按平台日 UV、月 MAU，UTC 时间范围，最多 31 天。
- 电台管理：名称/公开 ID 查找，国家/语言/标签、可见性和目录状态筛选；详情、基本字段、播放流编辑、软上下架。
- 分类译名：国家/地区、语言与标签的分页搜索，中英文校订，保留原名、ID、代码和关联。
- 错误报告：已有样本查询与处理状态；客户端上报尚未接入，空库明确显示无数据。
- 操作审计：管理写入生成审计；业务 outbox 与修改同事务，失败后幂等重试投递运营库。
- 运行日志：Cloudflare 控制台入口及请求 ID 查询指引；暂不提供网页日志代理。
- owner / viewer、生产 Access 验签、本地免登录连接、同源写入与 CSRF、版本冲突处理、夜间模式。

不提供公开管理员注册、硬删除、收藏管理、普通用户账户、全局即时缓存失效或演示统计。

## 界面与交互

- 使用 Ant Design 的 Layout、Menu、Table、Form、Drawer、Modal、Select、Tag 与反馈组件，统一中文界面与亮暗主题。
- 导航使用 hash 地址，支持书签、刷新定位及浏览器前进后退；窄屏改用抽屉导航。
- 电台筛选支持重置，国家/语言/标签使用远程搜索；服务端列表固定每页 20 条，支持跳页。
- 电台基本信息和播放流在详情抽屉中编辑，译名在弹窗中校订。未保存时关闭或切换编辑区会确认放弃；上下架单独确认。
- 表单校验、请求加载、空数据、失败重试与保存反馈使用统一组件。并发冲突保留输入，可手动重新加载；viewer 不显示写入入口。
- 生产 CSP 允许 Ant Design 所需的内联样式，不生成 nonce 或改写 HTML；脚本仍限制为同源，Access、角色、同源与 CSRF 校验保持原有契约。

## 本地运行（两个终端）

依赖 Node >=22.18，使用电脑中已安装的 pnpm。仅首次安装：`pnpm install`，不要在项目内安装 pnpm 或创建 store。

先启动管理 API：

```sh
cd /Users/lin/Documents/www/lin/worldtuner/worldTuner-admin-api
command -v pnpm
# 已有配置时不要覆盖。
test -f .env.sqlite || cp .env.sqlite.example .env.sqlite
pnpm dev:sqlite
```

API 默认仅监听 `127.0.0.1:8788`。目录库必须已有完整业务结构及 public_id，本地管理启动会显式打开业务写连接、创建 outbox；运营库初始化统计与管理表。只在 local 模式初始化固定 local-owner，不自动创建生产管理员。

前端：

```sh
cd /Users/lin/Documents/www/lin/worldtuner/worldTuner-admin
pnpm install
pnpm dev
```

打开 **http://127.0.0.1:5173** 即可直接进入管理端，本地无需配置或输入密钥。使用该地址而非 localhost，须与 `.env.sqlite` 的 `ADMIN_ORIGIN` 一致。Vite 将 `/admin/api` 代理到 8788，保留同源 Host。浏览器不要直接请求 8788。

如果要同时调试客户端，可另起 8787 的客户端 API。两者共享业务与运营文件，客户端只读业务库，不启用管理路由。不要让 Java 旧进程与管理端同时执行电台管理写入，旧写入可能不具备本轮版本与审计语义。

## 构建与部署

```sh
# 管理前端
pnpm typecheck
pnpm test
pnpm format:check
pnpm build

# 管理 Worker（从 worldTuner-admin-api 目录运行）
pnpm build   # dry-run，不发布
# 完成下文生产配置与预发布验收后才运行：
pnpm deploy
```

管理 Worker 使用 `wrangler.jsonc`，加载此项目 dist 静态资源，`run_worker_first=true` 保证页面及资源也进入鉴权。管理 API 有自己的依赖和基础设施适配，不导入客户端 API 源码；两库迁移统一来自 data 项目。客户端入口保持独立。

生产配置、管理员初始化、D1 迁移与接口说明见 [管理端开发与部署](../docs/管理端开发与部署.md)。本轮没有创建 Access 应用或操作远程数据库，也没有发布。
