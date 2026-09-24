# WorldTuner Mobile

Flutter 客户端，当前先完成 Android 版本；iOS 工程仅保留基础脚手架，后续再做平台适配。首版与现有 Web 共用独立的 Cloudflare Worker API，提供地图、发现搜索、全球/语言/流派榜单、网络电台播放和本地主题/语言设置。无需用户账户。

## 环境配置

API 根地址由构建变量 `API_BASE_URL` 注入，**不包含** `/api/v1`。客户端统一拼接 v1 路径。地图密钥由 `MAPTILER_API_KEY` 注入；未配置时仍可看到点位，但没有卫星底图。两者均没有写死在源码中。

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

将设备 ID 换成 `flutter devices` 的实际输出。MapTiler key 可暂时省略，此时电台点位仍会显示，但没有卫星底图。也可以复制 `env/example.json` 为 `env/local.json`，然后执行 `flutter run -d emulator-5554 --dart-define-from-file=env/local.json`。示例文件使用当前 Web 的公开 MapTiler key 和 Android 模拟器的本地 API 地址；切换环境时修改 `env/local.json`。

`10.0.2.2` 是 Android 模拟器访问电脑本地 Worker 的地址。Debug 构建只对这个地址放行 HTTP；正式构建仍要求 HTTPS API。真机调试建议使用可访问的 HTTPS 测试地址。现有地图快照的 9200 个流地址中有 2143 个是 HTTP；当前正式构建遵循 Android 默认网络安全策略，这部分电台可能无法播放，需后续明确传输策略。

调试时在 `flutter run` 终端按 `r` 热重载、`R` 热重启、`q` 退出；终端会给出 DevTools 链接。若刚启动模拟器时未显示设备，等 Android 启动完成后重试 `flutter devices`。本机 Flutter 可用完整路径 `/Users/lin/development/flutter/bin/flutter`。

若只想安装已构建的 Debug APK，可以运行：

```sh
/Users/lin/Library/Android/sdk/platform-tools/adb install -r build/app/outputs/flutter-apk/app-debug.apk
```

直接安装 APK 不支持 Flutter 热重载和 Dart 断点；日常调试使用 `flutter run`。

## 数据与结构

- `lib/core`：构建配置、API 客户端和界面文案。
- `lib/features/stations`：电台模型、分页结果、搜索和榜单。
- `lib/features/map`：Web 当前地图点位快照、聚合地图、点选详情。
- `lib/features/player`：全局播放器、系统媒体控制和迷你播放器。
- `lib/features/settings`：本地语言与主题设置。
- `lib/features/shell`：四个主入口。

地图点位来自现有 Web 的 `public/data.json` 快照，详情由 Worker 查询。点位快照更新时，需同步 `assets/data/stations.json`；未来可改成 API 地图点位接口。

## 验证

```sh
flutter analyze
flutter test
flutter build apk --debug --dart-define-from-file=env/local.json
```
