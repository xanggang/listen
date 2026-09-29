import 'server-only';

/**
 * 解析服务端 API 地址：开发模式默认直连本地 Worker，生产模式默认使用 Service Binding。
 * 显式设置 LISTEN_API_BASE_URL 时覆盖默认值，供其他本地端口或非 Cloudflare 主机使用。
 */
export function getListenApiBaseUrl(): string | undefined {
  if (process.env.LISTEN_API_BASE_URL) return process.env.LISTEN_API_BASE_URL;
  if (process.env.NODE_ENV === 'development') return 'http://127.0.0.1:8787';
  return undefined;
}
