import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
  typescript: {
    // !! 警告 !!
    // 即使项目中存在类型错误，也允许生产构建成功完成。
    // 这在快速部署时很有用，但建议不要长期忽略类型错误。
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
