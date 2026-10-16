import type { AdminBindings } from '../types.ts';
import { ApiError } from '../shared/errors.ts';

/**
 * 固定长度摘要比较用于开发密钥和 CSRF，不按输入前缀提前退出。
 */
export async function secretsEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const first = new Uint8Array(a);
  const second = new Uint8Array(b);
  let difference = 0;
  for (let index = 0; index < first.length; index++) difference |= first[index] ^ second[index];
  return difference === 0;
}

/**
 * 生成绑定管理员、当前认证凭据与半小时窗口的 HMAC；凭据和密钥不返回浏览器。
 */
export async function csrfToken(
  env: AdminBindings,
  actorId: string,
  credential: string,
  window = Math.floor(Date.now() / 1800000),
): Promise<string> {
  const secret = env.DEPLOYMENT_ENV === 'local' ? env.ADMIN_LOCAL_TOKEN : env.CSRF_SECRET;
  if (!secret || secret.length < 32)
    throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'CSRF secret requires at least 32 characters');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(JSON.stringify([actorId, credential, window])),
  );
  return Array.from(
    new Uint8Array(digest),
    // 以固定宽度编码摘要，保留前导零。
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}
