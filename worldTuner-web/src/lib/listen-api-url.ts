/**
 * 将内部 /api/... 路径追加到服务根地址，保留 /client 等代理前缀及查询参数。
 * baseUrl 不包含 /api 或具体接口路径；同时兼容本地根地址与尾部斜杠。
 */
export function buildListenApiUrl(path: string, baseUrl: string): URL {
  return new URL(path.replace(/^\/+/, ''), `${baseUrl.replace(/\/+$/, '')}/`);
}
