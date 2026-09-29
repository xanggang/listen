# WorldTuner Web

Web 界面沿用 Android 客户端的 Aether 设计色板、Inter/Plus Jakarta Sans 字体、四栏导航和常驻胶囊播放器。地图页使用 MapTiler 的卫星 3D 地球与地形；发现、榜单、我的和 VIP 规划页使用同一套深浅主题样式。语言在“我的”页面切换，主题可选跟随系统、浅色或深色。

无账户版本的收藏与最近播放只保存在当前浏览器的本地存储中。点击地图、发现或榜单中的电台会更新最近播放；最近播放最多保留 30 台。播放器和电台列表均可切换收藏，音频加载失败会退出播放态并显示提示。清除浏览器站点数据会清除这些本地记录。地球页按需读取 `public/data.json`，不把整份点位快照打进页面脚本，且不聚合点位。

Web 路由进入时通过同源 `/api/metrics/visit` 向独立 Worker 上报最小匿名访问量，用于 PV、日 UV 和月活汇总。只发送浏览器本地随机 UUID 和固定页面名，不上传查询参数或搜索词；上报失败不影响页面。口径见 [`worldTuner-api/docs/metrics.md`](../worldTuner-api/docs/metrics.md)。

Next.js Web 客户端。电台列表、详情和分类数据统一由同级 `../worldTuner-api` Cloudflare Worker 提供；Web 不直接连接 D1。地图暂时使用 `public/data.json` 中的静态点位。

## 本地开发

先在 `../worldTuner-api` 中运行 `pnpm db:migrate:local` 和 `pnpm dev`，默认监听 `http://127.0.0.1:8787`。API 数据导入与迁移说明见 `../worldTuner-api/README.md`。

然后启动 Web：

```bash
pnpm install
LISTEN_API_BASE_URL=http://127.0.0.1:8787 pnpm dev
```

也可以将 `.env.example` 中的变量加入现有 `.env.local`。开发时显式指定 API 地址便于分别调试两个服务。不设置变量时，Web 会尝试使用本地 Wrangler 的 `LISTEN_API` Service Binding。

## 配置与部署

- `wrangler.jsonc` 只配置 Web 所需的 OpenNext 资源和指向 `listen-api` Worker 的 Service Binding。
- 生产环境不设置 `LISTEN_API_BASE_URL`，Web 通过 Service Binding 调用 API。先部署 API，再部署 Web。
- Web 仍需 `@opennextjs/cloudflare` 和 `wrangler` 来运行与部署，但 D1 绑定、迁移和电台数据归 `listen-api` 管理。
- 修改 Wrangler 绑定后执行 `pnpm cf-typegen` 更新 `cloudflare-env.d.ts`。
- `pnpm build` 构建 Next.js；`pnpm preview` 在本地预览 Cloudflare 构建；`pnpm deploy` 会发布到 Cloudflare。
- `pnpm lint` 使用 ESLint CLI 检查源码；`pnpm exec tsc --noEmit` 可单独检查 TypeScript 类型。
- `pnpm test`（Node.js 22）验证浏览器本地收藏与历史记录的字段校验、坏数据恢复和去重规则。

历史电台 SQL 快照现位于 `../worldTuner-api/data/listen-d1-export.sql`，不属于 Web 构建资产。项目整体分析见 `../docs/listen项目分析与重开发准备.md`。
