import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // ESLint 由 pnpm lint 单独执行；生产构建仍会检查 TypeScript。
  eslint: { ignoreDuringBuilds: true },
};

// 在 next dev 中提供 Cloudflare Service Binding 的本地访问。
initOpenNextCloudflareForDev();

export default withNextIntl(nextConfig);
