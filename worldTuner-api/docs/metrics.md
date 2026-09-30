# 匿名访问量统计

首版只统计页面访问量，不建立账户、设备档案或行为轨迹。Web 与 Android 在本机各保存一个随机 UUID；一次页面进入向 `POST /api/metrics/visit` 发送 `visitorId`、`source` 和固定 `page`。不传 URL 查询参数、搜索词、播放内容、IP、地理位置或设备信息。Android 直接请求新 API；旧 Web 转发尚需同步接口地址。未来 iOS 接入时需要扩展 `source` 白名单和契约。

## 口径

- **PV**：页面实际展示一次记 1。Web 路由进入和 Android 主导航切换均计入；Android 长时间后台恢复或跨 UTC 日期恢复也补记 1。不会把电台 API 请求数算成 PV。
- **日 UV**：同一 `source` 下，一个客户端随机 UUID 在同一个 UTC 日只计 1。每个平台分别计算；同一人使用 Web 和 Android 会算两次。
- **月活（MAU）**：同一 `source` 下，一个客户端随机 UUID 在同一个 UTC 月只计 1。无法识别真实个人，也无法跨设备合并。
- **增长**：按日 UV 或按月 MAU 的时间序列计算环比。当前不定义“新用户”，因为卸载重装、清除浏览器存储和换设备都会生成新 UUID，不能可靠判定真人首次使用。

Worker 使用自己的 UTC 接收时间确定日期，分别对 `day + visitorId` 和 `month + visitorId` 做 SHA-256；D1 只保存这两个不同的哈希，不保存原始 UUID，日与月标识之间不能直接关联。每日 00:10 UTC 的 Cron 将已结束周期写入汇总表，然后删除 35 天以前的日哈希和两个月以前的月哈希。永久保留的表只有每日 PV、每日 UV 和每月 MAU 数值。统计是匿名客户端估算，公开写接口有独立的每 IP 60 次/分钟限流、1024 字符体积上限及严格字段白名单；它不是鉴权、反作弊或计费数据。

## 本地验证

新迁移 `0002_visit_metrics.sql` 只新增统计表，不修改电台表。启动本地 Worker 前运行：

```sh
cd /Users/lin/Documents/www/lin/worldtuner/worldTuner-api
pnpm db:migrate:local
pnpm dev
```

可发送一次匿名访问：

```sh
curl -X POST http://127.0.0.1:8787/api/metrics/visit \
  -H 'Content-Type: application/json' \
  -d '{"visitorId":"8b9f4bb9-00cb-4b55-8b88-7db20822e618","source":"android","page":"map"}'
```

在本地 D1 查看 PV：

```sh
pnpm exec wrangler d1 execute DB --local --command="SELECT day, source, SUM(pv) AS pv FROM metric_daily_views GROUP BY day, source ORDER BY day DESC, source"
```

查看历史日 UV 与当天 UV：

```sql
SELECT day, source, uv FROM metric_daily_uv
UNION ALL
SELECT u.day, u.source, COUNT(*) AS uv FROM metric_daily_unique u
WHERE NOT EXISTS (
  SELECT 1 FROM metric_daily_uv r WHERE r.day = u.day AND r.source = u.source
)
GROUP BY u.day, u.source
ORDER BY day DESC, source;
```

查看已结束月份的 MAU 与当月 MAU：

```sql
SELECT month, source, mau FROM metric_monthly_mau
UNION ALL
SELECT u.month, u.source, COUNT(*) AS mau FROM metric_monthly_unique u
WHERE NOT EXISTS (
  SELECT 1 FROM metric_monthly_mau r WHERE r.month = u.month AND r.source = u.source
)
GROUP BY u.month, u.source
ORDER BY month DESC, source;
```

本地可访问 `/cdn-cgi/handler/scheduled` 手动触发汇总。远程 D1 迁移和 Worker 部署必须分别审查后手动执行；日常测试不改生产数据库。当前没有统计展示页面或公开读取接口。

SQLite API 将统计写入 `.local/metrics.sqlite`，电台库只读；启动时和每小时补做汇总。完整启动说明见 [新库接入文档](../../docs/api-mobile-new-catalog.md)。
