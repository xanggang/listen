# worldTuner Mobile

Flutter 客户端，当前先完成 Android 版本；iOS 工程仅保留基础脚手架，后续再做平台适配。首版与现有 Web 共用独立的 Cloudflare Worker API，提供地图、发现搜索、全球/语言/流派榜单、网络电台播放和本地主题/语言设置。无需用户账户。

Android 会向 Worker 异步上报匿名页面访问，用于按平台汇总 PV、日 UV 和月活；只发送本机随机 UUID 与固定页面名，不包含搜索词或播放记录。统计失败不影响应用使用。口径见 [`worldTuner-api/docs/metrics.md`](../worldTuner-api/docs/metrics.md)。

当前界面采用 `files/stitch_global_web_radio_app` 的 Aether Daybreak / Midnight Sonic 设计规范：欢迎页、地图、发现、排行榜、个人中心和常驻播放器共用同一套深浅色组件。首次启动展示欢迎／注册入口；顶部“去登录”直接进入应用，首版不执行鉴权，注册按钮会提示功能尚未开放。进入状态保存在本机，后续启动直接进入首页。“我的”可进入 VIP 权益规划页，该页没有购买入口，展示期间仍保留播放器。个人中心可选“跟随系统 / 日间 / 深色”，并可即时切换简体中文与英语；语言、主题、收藏和最近播放记录均保存在设备本地，重启后恢复。发现页的国家筛选通过 Worker 的 `countriesId` 参数获取真实结果。

设计稿和 PRD 中的实时听众数、曲目识别、VIP 订阅、FLAC/DVR、云端同步尚无对应服务或产品能力。当前榜单使用 API 的票数；地图以可旋转的 3D 地球展示卫星影像、地形与电台点位。完整功能边界见 `docs/design-implementation.md`。

## 环境配置

API 根地址由构建变量 `API_BASE_URL` 注入，**不包含** `/api/v1`。客户端统一拼接 v1 路径。地图密钥由 `MAPTILER_API_KEY` 注入；未配置时地球不可用。两者均没有写死在源码中。

`env/local.json` 已加入 .gitignore。正式构建时另行传入生产环境的 HTTPS API 地址。构建变量会进入客户端安装包，不应放入服务端密钥；MapTiler key 应在其管理后台限制使用范围。

## Android 模拟器启动与调试

先在一个终端启动本地 Worker，随后可用 `curl http://localhost:8787/api/v1/health` 确认服务返回正常：

```sh
cd /Users/lin/Documents/www/lin/worldtuner/worldTuner-api
pnpm dev
```

若本地 D1 尚无电台数据，请先按 API 项目 README 初始化：确认是全新的本地数据库后，**仅导入一次** `data/listen-d1-export.sql`，再运行 `pnpm db:migrate:local`。已有数据时不要重复导入快照。

在另一个终端确认模拟器已完全启动，并查看设备 ID：

```sh
cd /Users/lin/Documents/www/lin/worldtuner/worldTuner-mobile
flutter devices
```

例如显示 `emulator-5554` 时，直接运行：

```sh
flutter run -d emulator-5554 \
  --dart-define=API_BASE_URL=http://10.0.2.2:8787 \
  --dart-define=MAPTILER_API_KEY=你的地图Key
```

将设备 ID 换成 `flutter devices` 的实际输出。可以复制 `env/example.json` 为 `env/local.json`，然后执行 `flutter run -d emulator-5554 --dart-define-from-file=env/local.json`。示例文件使用当前 Web 的公开 MapTiler key 和 Android 模拟器的本地 API 地址；切换环境时修改 `env/local.json`。

`10.0.2.2` 是 Android 模拟器访问电脑本地 Worker 的地址。Debug 构建对这个地址及 `192.168.137.226` 放行 HTTP；正式构建仍要求 HTTPS API。局域网 IP 改变时，需要同步修改启动配置和 Debug 网络配置。现有地图快照的 9200 个流地址中有 2143 个是 HTTP；当前正式构建遵循 Android 默认网络安全策略，这部分电台可能无法播放，需后续明确传输策略。

调试时在 `flutter run` 终端按 `r` 热重载、`R` 热重启、`q` 退出；终端会给出 DevTools 链接。若刚启动模拟器时未显示设备，等 Android 启动完成后重试 `flutter devices`。本机 Flutter 可用完整路径 `/Users/lin/development/flutter/bin/flutter`。

若只想安装已构建的 Debug APK，可以运行：

```sh
/Users/lin/Library/Android/sdk/platform-tools/adb install -r build/app/outputs/flutter-apk/app-debug.apk
```

直接安装 APK 不支持 Flutter 热重载和 Dart 断点；日常调试使用 `flutter run`。

手机远程调试可使用 `env/lan.json`，其中 `API_BASE_URL` 为 `http://192.168.137.226:8787/`：

```sh
flutter run -d 'adb-IRNZOVUODE4XPJJ7-Qspsil._adb-tls-connect._tcp' --dart-define-from-file=env/lan.json
```

运行前确认手机与电脑在同一局域网，并在手机浏览器打开 `http://192.168.137.226:8787/api/v1/health` 检查 Worker 是否可达。Worker 需要监听可由局域网访问的地址。

## 数据与结构

- `lib/core`：构建配置、API 客户端和界面文案。
- `lib/features/stations`：电台模型、分页结果、搜索和榜单。
- `lib/features/map`：地图点位快照、3D 地球通信、点选详情。
- `lib/features/player`：全局播放器、系统媒体控制和迷你播放器。
- `lib/features/settings`：本地语言与主题设置。
- `lib/features/onboarding`：首次启动欢迎页和本地进入状态。
- `lib/features/vip`：VIP 权益概念页，当前没有购买或会员状态。
- `lib/features/shell`：四个主入口。

地图点位来自现有 Web 的 `public/data.json` 快照，详情由 Worker 查询。点位快照更新时，需同步 `assets/data/stations.json`；未来可改成 API 地图点位接口。

地球由随 APK 打包的 MapTiler SDK JS 在 Android WebView 中渲染，使用卫星影像与 DEM 地形。拖动可旋转地球，双指缩放并查看近景地形；点击小点获取电台详情。地图交互与资源说明见 `docs/globe.md`。

## 验证

```sh
flutter analyze
flutter test
flutter build apk --debug --dart-define-from-file=env/local.json
```
