import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types.ts';
import { ApiError } from '../shared/errors.ts';

/**
 * 验证 Bearer Token；未配置 ADMIN_TOKEN 时默认拒绝，密钥不进入日志或响应。
 * 对固定长度 SHA-256 摘要遍历比较，避免按明文前缀提前退出。
 */
export const adminAuth = createMiddleware<AppEnv>(async (c, next) => {
  const expected = c.env.ADMIN_TOKEN;
  const header = c.req.header('Authorization');
  const presented = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
  if (!expected?.trim() || !presented)
    throw new ApiError(401, 'UNAUTHORIZED', 'Admin token required');
  const encoder = new TextEncoder();
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(presented)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const actual = new Uint8Array(actualHash);
  const target = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < actual.length; index++) difference |= actual[index] ^ target[index];
  if (difference !== 0) throw new ApiError(401, 'UNAUTHORIZED', 'Admin token required');
  await next();
});
