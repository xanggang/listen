# Radio Garden 数据源

使用可见 Chrome 会话访问两个 places 接口。通过 Playwright 的独立持久化配置保留会话；如果出现 Cloudflare 验证页，用户手动完成，脚本最多等待 10 分钟。不会自动点击验证或保证后续请求免于验证。

采集程序使用独立的 `data/radio-garden.sqlite`，成功 API 响应原文和关联数据只保存到该 SQLite，不再新写响应 JSON 文件；错误诊断写入 `log/api-errors.jsonl`，进度元数据写入 `data/`。不使用或改写 `worldTuner-api` 的迁移及 Radio Browser 数据库。以前运行留下的 JSON 数据文件不会被脚本更新或删除。

## 运行

需要 Node.js >= 22.18 和已安装的 Google Chrome。在 `worldTuner-data/` 执行：

```bash
npm ci
npm run fetch:radio-garden
```

只顺序访问以下两个接口，间隔 1 秒，参数均为 `s=1&hl=zh-Hans`：

- `https://radio.garden/api/ara/content/places-core-columnar?s=1&hl=zh-Hans`
- `https://radio.garden/api/ara/content/places-details-columnar?s=1&hl=zh-Hans`

浏览器窗口会自动打开；需要验证时在窗口中手动操作，成功取得两个响应后自动关闭。超时或关闭窗口将结束运行，可重新执行。独立配置保存在 `.browser-profile/` 并排除 Git，不读取日常 Chrome 配置。

## 输出

`places-core-columnar` 与 `places-details-columnar` 的成功响应原文保存到 `data/radio-garden.sqlite` 的 `api_responses` 表，进度摘要只将 URL、状态、时间和字节数写入 `data/browser-fetch-result.json`。请求失败写入 `log/api-errors.jsonl`。此前采集遗留的 `places-*.json` 等文件不会被新脚本更新或删除。

首次浏览器实测成功：核心与详情各包含 11,490 个地点，两份版本一致；详情包含 225 个国家条目。响应原文现在保存在独立 SQLite 中。

## 第二步：前五个地点页面测试

在 `worldTuner-data/` 运行 `npm run fetch:radio-garden:pages`。脚本将 `data/placesIDs.js` 的 `export const ids = [...]` 作为 JSON 数组读取，不执行该文件，仅选前五个 ID，顺序请求 `page/{id}?s=1&hl=zh-Hans`，间隔一秒。

原始响应保存到独立 SQLite 的 `place_page` 记录，请求进度元数据写入 `data/pages-fetch-result.json`。再次执行会重新请求这五项并更新 SQLite；尚未启用全量或断点续传。遇到 Cloudflare 验证时等待手动操作，其他 HTTP 错误中止并记入日志。

2026-09-28 实测五项均返回 HTTP 200，对应 Moscow、Berlin、Vienna、Milan、Cologne，响应 `data.map` 与请求 ID 一致。此接口返回地点页面及多个推荐区块，不是完整电台目录；样本中的首个电台区块仅包含 7 项（含浏览入口），不能把 `data.count` 当作本次下载的电台数量。

## 全量采集程序

在 `worldTuner-data/` 执行：

```bash
npm run sync:radio-garden -- --phase places --limit 5
npm run sync:radio-garden -- --phase places
npm run sync:radio-garden -- --phase details
npm run sync:radio-garden -- --phase streams
```

上面的 `sync:radio-garden` 使用可见 Chrome。保留原脚本的同时，新增纯接口版：

```bash
npm run sync:radio-garden:api -- --phase places --limit 5
npm run sync:radio-garden:api -- --phase places
npm run sync:radio-garden:api -- --phase details
npm run sync:radio-garden:api -- --phase streams
```

接口版使用 Node 原生 `fetch`，直接 GET Radio Garden API，不启动浏览器；暂时网络错误和 5xx 最多重试三次，403/Cloudflare 验证页记入错误日志，不解析或保存验证页。两套程序共用本数据源的 SQLite 和成功进度，可任选其一续跑。

`places` 请求每个地点的 `/page/{placeId}/channels`，原样写入 SQLite 并从频道 URL 建立地点关系；`details` 按已发现的去重频道 ID 请求 `/channel/{channelId}`，原样写入 SQLite；`streams` 单独请求 listen endpoint，禁用重定向跟随，将重定向结果写入 SQLite，不读取音频流。以上阶段不再把响应数据写入独立 JSON 文件。

独立 SQLite 中 `api_responses` 表只保存成功响应原文、HTTP 状态和时间；`place_channels` 保存地点与频道关系。请求失败追加到 `log/api-errors.jsonl`，每行包含时间、接口阶段、实体 ID、请求 URL、HTTP 状态、错误类型、Cloudflare 判定、关键响应头和最多 2000 字符的响应正文片段，不写入 SQLite；旧版本已写入 SQLite 的失败记录会在启动时迁移到该日志并清除。成功记录会自动跳过，失败项没有成功记录，因此重跑时会再次请求。`data/sync-progress.json` 和 `data/pages-fetch-result.json` 提供进度记录。默认串行、每次间隔一秒，可使用 `--limit N` 小批量执行或 `--delay-ms N` 调整间隔。

2026-09-28 试跑 `/page/MQfEnBji/channels` 时，Chrome 导航和命令行请求均等待至连接超时；该轮没有产生频道列表记录。已实现对 `href`、`url` 和嵌套 `page.url` 的频道 ID 提取；遇到数量字段与结构不匹配时会记录失败，避免静默当作空列表。直接接口版提供后续重试路径，执行五地点命令可确认接口当前是否恢复。

直接接口版首次试跑时，SQLite 中前五个地点已有成功记录并被跳过；对第六个地点 `3QbMs4L3` 的 Node `fetch` 连续三次得到 `fetch failed`。该失败会保存在 `log/api-errors.jsonl`，前五个地点响应和频道关联保留，可在网络恢复后继续用接口版重试。
