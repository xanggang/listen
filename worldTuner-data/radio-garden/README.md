# Radio Garden 数据源

使用可见 Chrome 会话访问两个 places 接口，保存原始 JSON。通过 Playwright 的独立持久化配置保留会话；如果出现 Cloudflare 验证页，用户手动完成，脚本最多等待 10 分钟。不会自动点击验证或保证后续请求免于验证。

## 运行

需要 Node.js >= 22.18 和已安装的 Google Chrome。在 `worldTuner-data/` 执行：

```bash
npm ci
npm run fetch:radio-garden
```

只顺序访问以下两个接口，间隔 2 秒，参数均为 `s=1&hl=zh-Hans`：

- `https://radio.garden/api/ara/content/places-core-columnar?s=1&hl=zh-Hans`
- `https://radio.garden/api/ara/content/places-details-columnar?s=1&hl=zh-Hans`

浏览器窗口会自动打开；需要验证时在窗口中手动操作，成功取得两个响应后自动关闭。超时或关闭窗口将结束运行，可重新执行。独立配置保存在 `.browser-profile/` 并排除 Git，不读取日常 Chrome 配置。

## 输出

- `data/places-core-columnar.json`：原始核心列式数据。
- `data/places-details-columnar.json`：原始详情列式数据。
- `data/browser-fetch-result.json`：最近一次浏览器采集的 URL、状态、时间和字节数。
- `data/browser-status.png`：最近一次导航截图，仅本地保存。
- `data/fetch-result.json` 和 `data/failed-responses/`：早期命令行请求返回 403 的历史记录，不代表本次浏览器采集结果。

仅在 HTTP 200、Content-Type 为 JSON 且可解析为对象/数组时保存文件；原始响应字节不做格式化，先写临时文件再重命名。每个成功文件独立保存；如果第二个接口失败，第一个文件仍保留，可根据采集记录和响应版本判断是否成套。

首次浏览器实测成功：核心与详情各包含 11,490 个地点，两份版本一致；详情包含 225 个国家条目。这一步仅保存原始响应，尚未转换或导入数据库。
