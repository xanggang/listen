# 首页地图快照与缓存

`GET /api/map/snapshot` 返回全部公开且有有效坐标的电台，不分页、不聚合。每条点位固定为 `[public_id, longitude, latitude]`，坐标保留五位小数，名称不在快照中。点选、播放和列表跳转定位均使用 public_id；名称从电台详情或已有列表数据获取。

```json
{"data":{"count":1,"points":[["0aB12xY",-87.90647,43.0389]]}}
```

- API 支持 gzip、弱 ETag 和条件请求 `If-None-Match`，内容未变时返回无正文的 304。
- `MAP_SNAPSHOT_CACHE_TTL_SECONDS` 默认 300 秒，0 禁用缓存，最大 86400 秒。Worker 在 `wrangler.jsonc` 配置，SQLite 在 `.env.sqlite` 配置。
- Worker 使用边缘 Cache API，SQLite 使用进程缓存。缓存键包含 `tuple-public-id-coordinates-1`、压缩编码和 TTL，避免命中旧四字段快照。
- Web 通过 Next.js 同源代理转发，浏览器每次加载重新验证缓存；安卓保存 gzip 缓存文件，TTL 内复用正文，过期携带 ETag 检查更新。
- 安卓新缓存文件为 `worldtuner-map-coordinates-1.json.gz`，旧 `worldtuner-map-public-id-1.json.gz` 不再读取。损坏缓存会重新下载。

此次由四字段改为三字段，需要配套更新 API、Web 和安卓。尚未更新的旧客户端不能解析新快照；先在本地联调，再同步发布，勿把旧安卓包直接连接新契约。分页接口 `/api/map/stations` 和详情接口的名称字段保持原样。
