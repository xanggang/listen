# Radio Browser → V2 数据处理

在 `worldTuner-data/` 目录执行：

```bash
npm run process:radio-browser:v2
# 可选：--source 原始库路径 --target V2 库路径 --worker-id 0-1023
```

默认只读 `radio-browser/data/radio-browser.sqlite`，写入 `v2/data/worldtuner-v2.sqlite`。源库不会修改；已存在 Radio Browser 来源记录时拒绝再次导入。整批写入在事务中完成，出错回滚。

按 `url_resolved`（缺失时用 `url`）的完整地址精确去重。相同地址的 Radio Browser 记录与已有 Radio Garden 电台合并；所有来源 ID 保留在 `station_source`。非空字段优先取 Radio Browser，空值保留 Radio Garden 字段。同来源记录按最后检查、票数、点击数和 UUID 稳定排序后逐字段补空值。无地址或同组无名称的记录跳过并计数。详见 [设计文档](../../v2/docs/电台数据库设计.md)。
