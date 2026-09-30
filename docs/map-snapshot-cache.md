# 全量地图快照与缓存

Web、Android 首页现在一次调用 `GET /api/map/snapshot` 获取全部公开且有有效坐标的电台，不再按 5000 条循环加载。不聚合点位。隐藏、不可用、没有坐标的电台不返回；点击后仍调用电台详情接口获取播放地址。

```json
{"data":{"count":1,"points":[["0363513228099059713","Radio",-87.90647,43.0389]]}}
```

元组固定为 **[id, name, 经度, 纬度]**。ID 是字符串，保留前导零和 19 位精度。坐标保留五位小数。`count` 等于数组长度。不接受查询参数。已有 `/api/map/stations` 分页接口继续保留，但首页不再调用。

## 配置位置

- Cloudflare：`worldTuner-api/wrangler.jsonc` 的 `vars.MAP_SNAPSHOT_CACHE_TTL_SECONDS`，默认 `"300"`。
- SQLite：复制 `worldTuner-api/.env.sqlite.example` 到 `.env.sqlite`，设置 `MAP_SNAPSHOT_CACHE_TTL_SECONDS=300`，重启服务。
- 单位是秒，范围 0～86400；0 禁用服务端快照缓存，客户端每次校验，适合本地编辑数据。非法值回退到 300，超限截为 86400。
- `CACHE_ENABLED=false` 只关闭 Cloudflare Cache API；SQLite 默认如此，仍按上述 TTL 使用进程缓存和客户端缓存。
- 两个客户端直接遵循接口的 `Cache-Control`。改变服务端配置不会立即删除设备或浏览器之前的有效缓存，它们仍会在原有有效期内到期。

## 缓存如何工作

1. API 按稳定的 ID 顺序查询，只读取四个地图字段。首次请求或过期时生成 JSON、gzip 和内容 SHA-256 弱 ETag。
2. 同一数据库连接的进程内缓存复用生成任务；Worker 额外把成功正文保存到所在数据中心的 `caches.default`，编码、格式版本、TTL 分别进入缓存键。缓存中不保存 Origin、请求 ID 或用户数据。缓存未命中时正常查询数据，无法保证所有数据中心只生成一次。
3. 响应按 `Accept-Encoding` 协商 gzip，显式 `gzip;q=0` 使用未压缩 JSON。返回 `Vary: Accept-Encoding`，避免编码混用。Worker 已压缩正文设置 `encodeBody: manual`，避免重复压缩。边缘缓存内部以不透明字节和私有编码标记存储，发送时才设置 Content-Encoding；私有标头不对外暴露。
4. API 返回 `Cache-Control: public, max-age=剩余秒数` 和 `ETag`。各层使用同一绝对到期时间，不会每次命中又重新给足 5 分钟。
5. Web 通过同源 `/api/map/snapshot` 转发至 API，保留条件请求、ETag 和剩余 TTL，浏览器使用标准 HTTP 缓存。上游取 identity，避免 Node fetch 自动解压后标头失配。Web 出口在 Node 显式 gzip，Cloudflare 运行时交给 OpenNext 外层 Response 自动编码，避免重复压缩。`next dev` 会把 Web 响应缓存时间覆写为 0，生产模式才按 API 的剩余 TTL 缓存。
6. Android 把 JSON、ETag、到期时间写成应用缓存目录中的 `worldtuner-map-tuple-1.json.gz`。有效期内不请求网络；过期发送 `If-None-Match`，304 时复用正文，200 时替换。文件保存 API 来源，切换环境时不会串用。系统清理文件或文件损坏时重新下载。大 JSON 解码在后台 isolate 完成。

304 不包含正文，Android 按其缓存头更新有效期。失败响应不写缓存，过期缓存不无限延期，也没有自动使用过期数据的离线兜底。安卓网络 gzip 由 `http` 的 IOClient 自动处理，不要二次解压 `bodyBytes`。

## 更新与限制

当前按需生成缓存，不是定时预生成，也没有引入 R2。数据更新会在原 TTL 到期后、下一次读取时反映；已经打开的地图不会定时自动重载。隐藏电台需要立刻阻止播放时，详情接口仍按当前数据判断可见性。编辑数据可临时设置 TTL 为 0，或等待原缓存过期；改配置不能召回客户端已有正文。

本地 `wrangler dev` 的 Cache API 行为不代表线上跨请求持久性，线上缓存按数据中心保存，不是全球共享缓存。参见 [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)、[Response 编码](https://developers.cloudflare.com/workers/runtime-apis/response/)、[Next.js compress](https://nextjs.org/docs/app/api-reference/config/next-config-js/compress)。正式部署仍需验证真实 Worker 冷启动、D1 查询时间和资源用量。

## 本地验证

```bash
curl --compressed -D /tmp/worldtuner-map.headers \
  http://127.0.0.1:8787/api/map/snapshot \
  -o /tmp/worldtuner-map.json

# 替换为上一步响应中的完整 ETag；数据未改变时应返回 304。
curl -i -H 'If-None-Match: W/"替换实际哈希"' \
  http://127.0.0.1:8787/api/map/snapshot
```

Android 模拟器 API 根地址使用 `http://10.0.2.2:8787`，真机使用电脑局域网地址。新增配置需要重启 API、重新运行 Flutter；Flutter 热重载不会重新读取构建环境变量。

## 本次验证结果

当前实际库返回 42,704 个有效公开点位。元组 JSON 为 2,795,700 字节，gzip 为 1,034,710 字节（约减少 63%）。名称保留，因此体积仍高于只传 ID 和坐标的方案。未变化时 ETag 条件请求返回 304、正文为零字节。

API 自动测试覆盖 gzip/identity、可见性、坐标顺序、ETag、TTL 过期、禁用缓存与 D1/SQLite 契约一致性。Flutter 自动测试覆盖快照解析、本地复用、304、损坏缓存恢复与 gzip 文件。真实 Dart IOClient 验证了全量 gzip 自动解压；隔离本地 Worker/D1 验证了 gzip 响应可正常解码。没有执行远程迁移或部署，未截图或运行真机。

Web 隔离生产构建通过，实际 HTTP 全量 gzip 与 304 转发通过。Web 自动测试 7 项、API 14 项、Flutter 20 项通过；Web lint 保留 3 个已有图片警告。Cloudflare 上的 Web 出口与真机渲染仍需部署后验证。
