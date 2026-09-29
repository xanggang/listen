# Radio Browser + Radio Garden 本地合并库

本目录包含建表 SQL、合并、基础数据清洗、保守去重和标签拆分脚本。合并脚本读取两套现有 SQLite，生成独立的 `merged/data/worldtuner-merged.sqlite`。所有后续脚本只操作这张新库，不会更新、迁移或删除两个原始数据库，也不会连接 D1。

## 运行条件

- Node.js 22.13 或更新版本，需要内置的 `node:sqlite`。
- 源文件保持在以下路径：
  - `worldTuner-data/radio-browser/data/radio-browser.sqlite`
  - `worldTuner-data/radio-garden/data/radio-garden.sqlite`
- 建议先让 Radio Garden 采集任务完成。脚本对源库使用只读事务快照；采集仍在进行时，本次结果只包含快照时已提交的数据。

## 第 1 步：合并两套电台

在项目根目录执行：

```bash
node worldTuner-data/merged/src/build.mjs
```

已有目标库时，脚本默认报错并保留旧库。确认需要重建后执行：

```bash
node worldTuner-data/merged/src/build.mjs --replace
```

重建时会读取旧合并库，尽量保留 Radio Garden 专属电台的内部 ID。脚本先在 `merged/data` 写临时库；外键与 SQLite 完整性检查通过后，才用新文件替换目标库。构建失败会清理临时文件，并保留原目标库。

## 第 2 步：清洗基础字段

先预览，再应用：

```bash
node worldTuner-data/merged/src/clean.mjs
node worldTuner-data/merged/src/clean.mjs --apply
```

清洗范围是电台名称、国家名称、国家代码以及 URL 的安全规范化。名称统一 Unicode 和空白；URL 仅去掉首尾空白；缺失国家代码时仅从唯一匹配的国家字典项补全。非法代码、无法识别的 URL、缺失名称或流地址只记入 `data_quality_issue`，不会猜测或删除。实际字段变化会记录在 `data_cleaning_change`。重复运行不会反复修改已规范化的字段。

## 第 3 步：保守去重

合并阶段只把唯一的 Radio Browser 候选与 Radio Garden 频道匹配。因此 Radio Browser 自身的重复，以及同一流地址对应多个 Browser 候选时的跨源重复，可能仍是多行。先预览，再应用：

```bash
node worldTuner-data/merged/src/dedupe.mjs
node worldTuner-data/merged/src/dedupe.mjs --apply
```

去重脚本只自动合并**规范化名称、二字母国家代码和最终流地址都相同**的电台。若坐标相距超过 25 公里、州/省字段冲突或官网主机不同，整组跳过。仅相同流地址、名称不同的频道不会自动合并，因为共用流或转播可能确实是不同电台。

脚本保留一条电台，并把其他来源 ID、语言、标签和清洗审计迁到保留记录；旧内部 ID 记入 `station_alias`。运行记录在 `dedupe_run`。重复运行只处理仍有多行的组。去重会改变 `station_unified` 的行数，切换 API 时需要通过 `station_alias` 解析旧 ID。

对于共享最终流地址和国家、但名称不同的跨来源记录，可生成只读候选报告后逐组核对：

```bash
node worldTuner-data/merged/src/review-duplicates.mjs > worldTuner-data/merged/duplicate-candidates.csv
```

报告只列线索，不会自动合并；共享流地址的转播站可能是不同电台。

## 第 4 步：拆分标签

先预览，再应用：

```bash
node worldTuner-data/merged/src/split-tags.mjs
node worldTuner-data/merged/src/split-tags.mjs --apply
```

脚本按逗号拆分 `station_unified.tags`，对单台标签去重，按 Unicode、大小写和空白归一，并重建 `station_tag` 与 `tags.stationcount`。主表原始 `tags` 不变，v1 标签 ID 和 `is_visible` 不变；异写标签通过 `canonical_tag_id` 指向规范标签。脚本可以重跑。

如要人工指定同义词，请复制并修改 [tag-rules.example.json](tag-rules.example.json)，再在预览和应用时使用相同规则文件：

```bash
node worldTuner-data/merged/src/split-tags.mjs --rules worldTuner-data/merged/tag-rules.example.json
node worldTuner-data/merged/src/split-tags.mjs --apply --rules worldTuner-data/merged/tag-rules.example.json
```

示例规则只演示格式；请核对其业务含义后再使用。脚本拒绝循环别名规则，不做模糊匹配。每次应用都会依据主表原始标签完整重建关联，适合修改规则后重新运行。

## 数据约定

- `station_unified` 保留 v1 `station` 字段，增加来源、字段出处与目录状态。Radio Browser 电台沿用原 `id`；Radio Garden 专属电台使用从 `1000000001` 开始的 ID。
- `station_source` 保留每条电台对应的原始来源 ID。来源为 `both` 时，`station_unified` 只有一行、`station_source` 有两行。Radio Garden 的频道 ID 不伪装成 Radio Browser 的 UUID。
- 自动匹配要求名称、国家代码一致，并且最终流地址或主页地址唯一。多候选、缺少国家代码、证据相冲突时保留为两条电台，供以后人工核对。
- Radio Garden 的 `url` 使用频道播放入口，`url_resolved` 保存采集到的重定向地址；没有可信名称或重定向地址的频道保留并标为 `unverified`。
- `tags` 和 `language` 原始文本保留在主表；合并时构建 `station_language`，运行第 4 步后构建 `station_tag`。同名标签按大小写和空白规范化后指向最小的原 v1 标签 ID，原有异写词条仍保留。新标签默认 `is_visible = 0`，不会自动进入人工精选列表。
- `countries`、`languages`、`tags` 尽量保留 v1 字典 ID，并按合并后的电台重新计算计数。Radio Garden 没有提供的标签、语言、票数等字段保持 `NULL`。

## 运行后检查

```bash
sqlite3 worldTuner-data/merged/data/worldtuner-merged.sqlite 'SELECT * FROM merge_run;'
sqlite3 worldTuner-data/merged/data/worldtuner-merged.sqlite 'PRAGMA integrity_check;'
sqlite3 worldTuner-data/merged/data/worldtuner-merged.sqlite 'PRAGMA foreign_key_check;'
sqlite3 worldTuner-data/merged/data/worldtuner-merged.sqlite 'SELECT * FROM data_cleaning_run;'
sqlite3 worldTuner-data/merged/data/worldtuner-merged.sqlite 'SELECT * FROM dedupe_run;'
sqlite3 worldTuner-data/merged/data/worldtuner-merged.sqlite 'SELECT * FROM tag_split_run;'
```

本脚本只生成本地合并库；现有 API 仍使用原来的 D1，切换 API 和部署数据应单独处理。
