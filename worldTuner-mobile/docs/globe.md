# Android 3D 地球

地图页使用 `webview_flutter` 加载随应用打包的 `assets/globe/index.html`。其中的 MapTiler SDK JS v4.1.0 开启 `globe` 投影、卫星影像和 DEM 地形；JavaScript 只负责渲染每个电台点位和地图手势，不做点位聚合。Flutter 负责通过 `/api/map/snapshot` 获取地图点位、校验脚本消息、通过 Worker 查询电台详情，以及收藏和播放。明暗主题由 Flutter 设置传入脚本；语言仍由 Flutter 控制。

首页快照只包含 `[public_id, longitude, latitude]`，不下载名称；电台卡片名称由详情接口或列表定位请求提供。点选、播放光圈和列表跳转均按 ID 处理，不依赖快照名称。缓存及发布注意事项见[地图缓存文档](../../docs/map-snapshot-cache.md)。

安卓与 Web 显式使用同一底图 `https://api.maptiler.com/maps/satellite-v4/style.json`，不依赖 SDK 的 `MapStyle.SATELLITE` 别名。两端启用地形，夸张系数为 1.35，初始中心为 `[20, 25]`、缩放为 0.9，最大缩放为 15。修改 `assets/globe/globe.js` 后重新运行应用，确保 WebView 加载新版打包资源；仅热重载 Flutter 页面不保证脚本刷新。

首页采用沉浸式地图布局：地球延伸到透明状态栏后方，品牌、电台数量、操作提示和选中电台卡片悬浮显示；播放器与底部导航保留固定触控区域。播放器在未选电台时也显示引导占位，选台后更新封面和控制。MapTiler 标志和数据署名仍显示在地图底部。其他页面继续使用常规标题栏和安全区。

SDK 的 JS、CSS 和 BSD 3-Clause 许可证一并放在 `assets/globe/`，避免运行时依赖 CDN。卫星影像及地形瓦片仍需访问 MapTiler 服务，因此设备必须联网，且构建时必须传入 `MAPTILER_API_KEY`。密钥属于客户端公开配置，应在 MapTiler 控制台设置合适的配额和限制，不能当作服务端密钥使用。

交互：单指拖动旋转地球，双指缩放/倾斜；点击任一电台点位，在 Flutter 卡片中显示详情。近景点位会适度放大，触控命中范围覆盖点位中心周围约 22 CSS 像素；远景范围缩小到 14 CSS 像素，避免密集点位抢占地图点击。范围内有多个可见点位时选最近的一个。相同或相近坐标的点可能视觉重叠，但数据和图层都不会将它们合并。点击标记本身不自动播放。近景地形的可见程度取决于当前缩放、观察角度和 DEM 数据。

列表行的收藏按钮前提供“在地图上定位”：通过 `StationMapRequest` 通知主导航切换到已有地图，等待地球与点位就绪后平滑移动到电台位置并放大到 zoom 7，显示定位标记及电台卡片。重复点击同一电台仍可重新定位，定位不会修改播放或收藏状态。坐标优先使用当前地图快照，以电台数据中的有效坐标兜底；两者都无有效坐标时显示提示，不移动到虚构位置。

设计稿中的三层外环、虚线轨道与方位字母由不接收触摸的 HUD 绘制；球面经纬辅助线则由真实经纬度 GeoJSON 图层绘制，会随地球旋转。外环在地图放大或倾斜后淡出，球面辅助线在近景隐藏，避免遮挡卫星影像与电台点位。方位字母是装饰，不显示虚构的坐标或频率数据。

地图资源更换版本时，同步更新 JS、CSS、许可证并在模拟器验证加载、点位、主题和点击。地图脚本与 Flutter 之间只传递 `ready`、`error` 和 7 位 Base62 电台 public_id；详情始终来自 Worker。脚本来源：[MapTiler SDK JS](https://github.com/maptiler/maptiler-sdk-js)，[globe + terrain 官方示例](https://docs.maptiler.com/sdk-js/examples/globe-terrain/)。
