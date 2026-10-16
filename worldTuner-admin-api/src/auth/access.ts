import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ApiError } from '../shared/errors.ts';

const resolvers = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/**
 * 仅使用服务端配置的 Cloudflare 团队签发者获取公钥；验证签名、audience、过期及 subject。
 * JWKS 的缓存、未知 kid 冷却与密钥轮换由 jose 处理，令牌内 URL 不参与网络请求。
 */
export async function verifyAccessToken(token: string, issuer: string, audience: string) {
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) || !audience) {
    throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'Access is not configured');
  }
  let resolver = resolvers.get(issuer);
  if (!resolver) {
    resolver = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer), {
      timeoutDuration: 5000,
    });
    // Worker 配置通常只有一个签发者，限制跨配置缓存数量。
    if (resolvers.size >= 4) resolvers.clear();
    resolvers.set(issuer, resolver);
  }
  try {
    const { payload } = await jwtVerify(token, resolver, {
      issuer,
      audience,
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp', 'iat'],
    });
    if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('Missing subject');
    return { issuer, subject: payload.sub };
  } catch {
    throw new ApiError(401, 'UNAUTHORIZED', 'Access authentication required');
  }
}
