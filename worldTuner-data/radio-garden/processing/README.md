# Radio Garden 数据处理

此目录与 `src/` 并列，用于放置 Radio Garden 原始数据的解析、清洗、校验和字段转换方法，为后续生成 V2 电台数据做准备。`src/` 保留现有采集与同步脚本。

`import-v2.mjs` 从只读的 Radio Garden 采集库读取频道详情、地点与播放重定向，在单个事务中写入已建表的 V2 数据库。不会请求网络，也不会修改采集库。

在 `worldTuner-data/` 下运行：

```bash
npm run init:v2
npm run process:radio-garden:v2
```

已有 V2 库时无需重复初始化。命令支持 `--source` 和 `--target` 指定数据库路径，`--worker-id 0-1023` 指定雪花式字符串 ID 的生成节点，默认 `0`；多个并发写入进程必须使用不同节点编号。目标库已有 Radio Garden 来源记录时拒绝重复导入。结果会列出未采集详情的频道数量、异常的 `page` 响应 ID、无国家代码的名称及缺少重定向的流数量。缺失地点或无效频道详情会使整批导入回滚。

`station.place` 保存频道详情的 `place.title`，坐标按 `place.id` 从地点表取得；`station.website` 原样保存 `website` 字符串，`social[]` 转为 `station_link`。国家代码仅从已整理的国家名称映射取得，无法确认时 `country_id` 留空。播放流的原始地址为 Radio Garden 的 listen 接口，重定向地址存入 `resolved_url`；流可用性、HLS、票数、点击数、标签和语种均不做推断。
