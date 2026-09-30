# Radio Garden 数据采集

本目录通过 Radio Garden API 采集地点、频道和播放流地址，保存到独立的 `data/radio-garden.sqlite`。它是本地数据采集程序，不提供客户端 API，也不下载音频或修改 Radio Browser、D1 数据库。

接口结构参考：[Radio Garden OpenAPI](https://jonasrmichel.github.io/radio-garden-openapi/)。实际采集字段以本目录代码和保存的原始响应为准。

## 数据流程

```text
places-core-columnar + places-details-columnar
  └─ api_responses（原始 JSON）
       └─ normalize → radio_garden_places（地点 ID、名称、国家、经纬度）
            └─ places → place_channels（地点与频道关系）
                 ├─ details → api_responses（频道详情）
                 └─ streams → api_responses（播放重定向地址）
```

`places` 阶段直接读取 `radio_garden_places` 的地点 ID。`details` 和 `streams` 都从 `place_channels` 读取去重后的频道 ID，因此必须先完成 `places` 阶段。

## 运行

要求 Node.js **22.18+**。以下命令均在 `worldTuner-data/` 目录执行，不需要 Chrome 或 Playwright。

```bash
# 1. 获取两份地点总览原始响应。
npm run fetch:radio-garden

# 2. 从原始响应整理地点、国家和坐标。
npm run normalize:radio-garden

# 3. 先用少量地点检查接口，再采集全部频道关系。
npm run sync:radio-garden:api -- --phase places --limit 5
npm run sync:radio-garden:api -- --phase places

# 4. 采集频道详情和播放地址。
npm run sync:radio-garden:api -- --phase details
npm run sync:radio-garden:api -- --phase streams
```

`fetch:radio-garden` 使用 Node 原生 `fetch` 顺序请求 `places-core-columnar`、`places-details-columnar`，并保存成功响应原文。`normalize:radio-garden` 校验两份响应版本、列长度和坐标后，原子重建地点表。`places` 请求每个地点的频道列表；`details` 获取频道详情；`streams` 只读取 listen 接口的 3xx `Location`，不跟随跳转或下载音频。

`sync:radio-garden:api` 支持 `--limit N` 和 `--delay-ms N`，默认每次请求间隔 1000 毫秒。`--limit` 只取候选 ID 列表前 N 项，其中已完成的会跳过；重新运行会继续处理未成功的项。HTTP 403 或 Cloudflare 验证页会记录为失败，不尝试绕过验证。失败可查看 `log/api-errors.jsonl`，网络恢复后重新运行同一命令即可重试。

需要国家或地区中文名称时，地点整理完成后运行[地名本地化命令](../geo-localization/README.md)：

```bash
npm run localize:radio-garden:countries
```

## 数据存在哪里

endpoint 类型：
> stream_redirect 重定向地址
> places_channels 地点和频道
> channel_details 频道详情

| 表或文件 | 内容 |
| --- | --- |
| `data/radio-garden.sqlite` → `api_responses` | 成功的原始响应、HTTP 状态和采集时间；`stream_redirect` 行含最终流地址 |
| `data/radio-garden.sqlite` → `radio_garden_places` | 整理后的地点 ID、名称、国家、经纬度及来源版本 |
| `data/radio-garden.sqlite` → `place_channels` | 地点与频道的对应关系和频道标题 |
| `data/radio-garden.sqlite` → `radio_garden_country_names` | 可选的国家或地区中文名映射，由本地化命令生成 |
| `data/sync-progress.json` | 各频道采集阶段的成功数量和关系数量摘要 |
| `log/api-errors.jsonl` | 失败请求及诊断信息；失败响应不作为成功数据写入 SQLite |

`api_responses` 使用 `(endpoint, entity_id)` 唯一标识成功记录。常见 `endpoint` 为 `places-core-columnar`、`places-details-columnar`、`places_channels`、`channel_details`、`stream_redirect`。地点总览的 `entity_id` 是 `all`；频道阶段的 ID 来自地点频道关系。

从 `worldTuner-data/` 目录查询当前进度：

```bash
sqlite3 -readonly radio-garden/data/radio-garden.sqlite "SELECT endpoint, COUNT(*) AS completed FROM api_responses WHERE status = 'success' GROUP BY endpoint ORDER BY endpoint;"
sqlite3 -readonly radio-garden/data/radio-garden.sqlite "SELECT COUNT(*) AS places FROM radio_garden_places;"
sqlite3 -readonly radio-garden/data/radio-garden.sqlite "SELECT COUNT(DISTINCT channel_id) AS channels FROM place_channels;"
```

## 代码入口

- `src/fetch-places.mjs`：请求两份地点总览原始响应。
- `src/normalize-places.mjs`：从 SQLite 读取原始响应，校验并整理地点。
- `src/sync-api.mjs`：运行 `places`、`details`、`streams` 三个频道阶段。
- `src/api/client.mjs`：统一请求 Radio Garden API、处理重试和响应错误。
- `src/crawler.mjs`：读取地点 ID、解析频道关系、跳过成功项并控制请求间隔。
- `src/store.mjs`：保存 SQLite 原始数据、频道关系、进度和错误日志。
- `processing/import-v2.mjs`：把已采集的 Radio Garden 频道整理并导入本地 V2 数据库，使用方法见 [数据处理说明](processing/README.md)。

地点 `size` 是 Radio Garden 提供的源字段，不代表本地已采集频道数；实际数量请查询 `place_channels`。
