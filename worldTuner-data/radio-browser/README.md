# Radio Browser 本地同步

使用官方 [Radio Browser API](https://docs.radio-browser.info/) 拉取电台，无需 API Key，需 Node.js >= 22.18。

以下命令在 `worldTuner-data/` 目录执行：

```bash
node radio-browser/src/sync.mjs
# 等价命令：npm run sync:radio-browser
# 自定义目标文件或镜像：
node radio-browser/src/sync.mjs --db ./radio-browser/data/radio-browser.sqlite --server https://de1.api.radio-browser.info
```

默认写入 `worldTuner-data/radio-browser/data/radio-browser.sqlite`，文件已加入 Git 忽略。它是独立 SQLite，**不会自动成为 Wrangler 本地 D1 的数据源**，也不修改远程 D1。不要把 `--db` 指向正在运行的 Wrangler 内部数据库。现有 HTTP API 契约不变。

- 表字段直接复用 `worldTuner-api/migrations/0001_existing_schema.sql`，查询索引复用 `worldTuner-api/migrations/0002_query_indexes.sql`。电台按 `stationuuid` 匹配，保留本地数值 `id`；忽略上游 `serveruuid` 等额外字段，缺失可选字段保存为 null，`has_extended_info` 转换为 0/1。
- `languages`、`tags`、`countries` 从本地全部电台统计，包含失效电台；逗号分隔分类去重计数。国家代码写入 `iso_3166_1`；语言名称与代码不保证一一对应，因此新语言 `iso_639` 留空，已有值保留。分类 id 保留，已无成员的旧分类计数归零。
- 自动通过官方 DNS SRV 发现并随机选择镜像；每页 5000 条，页间等待 300ms，每次请求超时 60 秒，失败等待 2 秒后重试一次，再换镜像从头下载。发送 `WorldTuner-LocalSync/1.0` User-Agent。
- 先下载全部页面并校验，再在单个事务内写入。异常回滚；既有库存在重复 stationuuid 时中止，避免擅自合并旧 id。新增唯一索引防止重复写入。
- 再次执行会全量拉取并更新已有记录，不是基于变更时间的增量同步。保留上游已删除的电台；不下载音频或图片。offset 分页不是快照，上游并发变更可能造成遗漏；发现重复 UUID 会拒绝整批导入，可稍后重跑。
- `radio_browser_sync_runs` 是独立同步审计表，记录完成时间、镜像和新增/更新数量。业务表不增加字段。

离线测试：`node --test radio-browser/test/radio-browser.test.mjs`（或 `npm run test:radio-browser`），覆盖分页、镜像失败切换、重复同步、字段校验及事务回滚。工具使用 Node 原生模块，无需新增依赖。

