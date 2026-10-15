# Java 业务接口同步到 worldTuner-api

本次仅同步已有业务能力，不迁移 Java 文件日志、Logback、systemd、部署脚本或 JVM 配置；不拆分部署，也不操作远程数据库。

## 对齐结果

| 功能 | worldTuner-api 状态 |
| --- | --- |
| 公开健康检查 | 已有，保持兼容 |
| 电台列表、详情、分页和播放流/外链 | 已有，保持字符串 ID、筛选及可见性规则 |
| 国家/语言/标签中英文展示 | 已有，保留原名与全部译名，不要求客户端传语言 |
| 标签搜索及分页 | 已有，匹配原名、中英文 |
| 国家 ID 精确筛选及国家中文/英文/代码关键词 | 已有并保留，不退化为 Java 当前的仅国家原名匹配 |
| 地图游标分页、全量元组、gzip/ETag | 已有，保持现有契约与缓存机制 |
| 匿名访问上报、汇总及保留期 | 已有，不添加用户体系或更多采集字段 |
| 管理端健康检查 | 新增 GET /admin/api/health，要求认证 |
| 电台上下架 | 新增 PUT /admin/api/stations/:id/visibility，要求认证 |

Java 目前没有管理端统计查询或日志检索业务接口，本次不预先实现未来需求。Java 详情组装部分字段遗漏不向 Worker 复制：Worker 保留 place、countryEn、countryZh 等已支持字段。没有修改 Java 代码。

## 管理业务配置

Worker 使用 Secret，不写入 wrangler.jsonc 的公开变量：

```bash
cd worldTuner-api
pnpm exec wrangler secret put ADMIN_TOKEN
```

只在用户决定发布时执行以上命令；本次没有设置远程 Secret。Wrangler 本地开发可在未提交的 `.dev.vars` 写入 `ADMIN_TOKEN=你的随机密钥`。

SQLite 在 `.env.sqlite` 设置 `ADMIN_TOKEN`，重启服务后才会开启独立的管理写连接。公开 API 仍使用只读目录连接；访问统计仍写独立统计库。ADMIN_TOKEN 未配置或全空白时，管理接口统一返回 401，不启用管理写连接；没有开发默认密钥。

两个管理接口沿用 Java 的 Authorization: Bearer 协议。仅上下架接口支持 PUT，状态仅为 visible/hidden，ID 保持 19 位字符串。更新 UTC 时间，不修改名称、播放地址或关联。只接受 JSON，正文不超过 1024 字节；错误参数 400，未知电台 404，媒体类型错误 415，超限 413。

管理响应始终 no-store，所有业务请求继续受现有限流约束。浏览器管理调用仅对白名单 Origin 放行 PUT 和 Authorization，公开接口不增加 PUT 权限。数据库绑定没有实现 SQL 权限隔离，公开只读是路由与业务层约束；SQLite 另有只读连接保护。

## 缓存和数据

管理写入后，已存在的公开缓存按原 TTL 到期刷新，不承诺跨边缘节点即时失效。当前字典缓存最长 3600 秒，列表/详情与地图分别沿用已有 TTL；SQLite JSON 缓存关闭，地图内存缓存仍受配置控制。需要立即验收下架效果时可在独立测试环境关闭缓存，不修改生产策略。

国家译名来自现有 v2 数据；D1 仍需按顺序应用至 0007_country_names_complete.sql，SQLite 迁移见 country-localization.md。本次没有新增表或破坏性迁移。

## 验证

21 项 Worker 业务测试通过，包含原有 16 项、管理端鉴权/输入约束、上下架后的详情/搜索/分类/地图过滤、以及直接加载 Java 契约测试 schema 和样例验证中文响应、ID、详情播放流。相关测试使用内存 SQLite，不修改实际业务库。既有测试继续覆盖 D1 形状绑定兼容，新增测试确认 SQLite 管理写连接不改变公开连接的只读保护。类型检查、格式检查及 Worker dry-run 构建通过，未执行远程部署。
