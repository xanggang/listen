# V2 本地数据库

本目录保存 V2 数据库建表定义和初始化脚本。目标结构与字段说明见[设计文档](docs/电台数据库设计.md)。

在 `worldTuner-data/` 下执行：

```bash
node v2/src/init.mjs
```

脚本在 `v2/data/worldtuner-v2.sqlite` 创建空 SQLite；目标文件已存在时拒绝覆盖。原始 Radio Garden、Radio Browser 数据库不受影响。数据库文件由 `worldTuner-data/.gitignore` 忽略，不提交到 Git。

本地 V2 库的生成主键与关联外键使用字符串。默认库 `v2/data/worldtuner-v2.sqlite` 已通过 [Radio Garden 数据处理脚本](../radio-garden/processing/README.md) 和 [Radio Browser 数据处理脚本](../radio-browser/processing/README.md) 导入数据；脚本拒绝对已有同源记录的库重复导入。`v2/worldtuner-v2.sqlite` 是独立的空库，默认脚本不会更新它。后续连接 SQLite 时需开启 `PRAGMA foreign_keys = ON`；布尔值用 `0`、`1` 或允许的 `NULL` 表示，时间使用 ISO 8601 文本。

## 为 station 增加随机 public_id

内部主键与外键继续使用原来的 19 位数字字符串。只有 `station` 增加 `public_id`，为 7 位区分大小写的随机 Base62 字符串，通过唯一索引防止重复。

使用本机 Node.js >= 22.18.0，在 `worldTuner-data/` 下执行：

```bash
node v2/src/station-public-ids.mjs \
  --input v2/data/worldtuner-v2.sqlite \
  --output v2/data/worldtuner-v2-public.sqlite
```

请使用保留原主键的 `worldtuner-v2.sqlite`，不要使用之前重写所有主键的 `worldtuner-v2-short.sqlite`。旧的 `shorten-ids.mjs` 已由此工具替代；已有 short 库不会被删除或修改。

脚本通过 SQLite 备份 API 完整复制源库（包含 WAL 中已提交的数据），在新库事务内增加字段及唯一索引，只为缺失值生成 `public_id`。已有值保持稳定；非法或重复的已有值会报错。所有原主键、外键、其他表、索引和业务字段保持不变。原库只读，目标文件必须不存在且父目录已存在；出错清理本次输出和临时文件，外键与完整性检查通过后才发布新库。脚本不连接远程 D1。

不同输出库首次生成的随机值不保证相同；确定对外使用的库后，后续应以它为输入，已有 public_id 不会重新生成。最终切换时请先停止源库写入，再生成最终副本，避免遗漏后续写入。

`schema.sql` 已增加该列；Radio Garden 与 Radio Browser 导入程序会在同一事务提交前补齐缺失 public_id，并保留仍存在电台的已有值。字段允许 NULL 以支持旧数据升级及事务内先导入后回填，脚本成功返回时所有电台都有 public_id。未接入该回填函数的其他写入程序仍须自行生成或补齐。

### 导入 D1

D1 空库执行 `worldTuner-data/v2/schema.sql`，直接创建完整结构及 public_id 唯一索引；数据需先在本地回填，建表不会生成随机 ID。

如果导入完整的已处理本地数据，应从 `worldtuner-v2-public.sqlite` 导出，使用现有 `db:export:catalog` 工具即可包含 public_id。目标业务表必须为空且已应用全部迁移；导出数据不能直接重复插入已有记录的远程库。初始化 SQL 只执行一次，不要对已有表重复执行。

API、电台地图、Web 与移动端已统一把 `station.public_id` 作为电台响应字段 `id`，详情和地图游标也使用该短 ID。内部关联仍使用 station.id；国家、标签、语种、流与链接 ID 保持原样。API 的 SQLite 来源需指向本工具输出的库。

行为验证（含十万条电台回填、原主键和关联保持不变、重复处理稳定性）：

```bash
node --test v2/test/station-public-ids.test.mjs
```

业务结构只维护 `worldTuner-data/v2/schema.sql`。`worldTuner-data/v2/migrations/0001_catalog.sql` 是指向它的相对符号链接，让 Wrangler 保持编号迁移记录；API 的初始化命令不变。发布或复制代码时保留 data/API 相邻目录和符号链接。
