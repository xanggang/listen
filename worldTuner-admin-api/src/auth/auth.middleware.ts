import { createMiddleware } from 'hono/factory';
import type { AdminActor, AdminEnv } from '../types.ts';
import { ApiError } from '../shared/errors.ts';
import { verifyAccessToken } from './access.ts';
import { csrfToken, secretsEqual } from './csrf.ts';

/**
 * 所有页面与 API 统一鉴权；生产只接受经过签名验证且在运营库启用的 Access 身份。
 * 显式 local 环境且 URL 为 loopback 时自动使用本地管理员，生产不使用此分支。
 */
export const authenticateAdmin = createMiddleware<AdminEnv>(async (c, next) => {
  let issuer: string;
  let subject: string;
  let credential: string;
  if (c.env.DEPLOYMENT_ENV === 'local') {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(c.req.url).hostname)) {
      throw new ApiError(403, 'LOCAL_ONLY', 'Local authentication requires loopback');
    }
    // 本地开发无需浏览器凭据，CSRF 仍绑定本地身份与服务进程。
    credential = '';
    issuer = 'local';
    subject = 'local-owner';
  } else {
    credential = c.req.header('Cf-Access-Jwt-Assertion') ?? '';
    if (!credential) throw new ApiError(401, 'UNAUTHORIZED', 'Access authentication required');
    const identity = await verifyAccessToken(
      credential,
      c.env.ACCESS_ISSUER ?? '',
      c.env.ACCESS_AUDIENCE ?? '',
    );
    issuer = identity.issuer;
    subject = identity.subject;
  }
  const actor = await c.env.METRICS_DB.prepare(
    'SELECT id,email,role FROM admin_actors WHERE issuer=? AND subject=? AND enabled=1',
  )
    .bind(issuer, subject)
    .first<AdminActor>();
  if (!actor || !['owner', 'viewer'].includes(actor.role))
    throw new ApiError(403, 'FORBIDDEN', 'Administrator is not enabled');
  c.set('actor', actor);
  c.set('credential', credential);
  if (!['GET', 'HEAD'].includes(c.req.method)) {
    if (actor.role !== 'owner') throw new ApiError(403, 'FORBIDDEN', 'Read-only administrator');
    if (
      c.req.header('Origin') !== c.env.ADMIN_ORIGIN ||
      new URL(c.req.url).origin !== c.env.ADMIN_ORIGIN
    ) {
      throw new ApiError(403, 'INVALID_ORIGIN', 'Same-origin request required');
    }
    const supplied = c.req.header('X-CSRF-Token') ?? '';
    const current = Math.floor(Date.now() / 1800000);
    const valid =
      supplied &&
      ((await secretsEqual(supplied, await csrfToken(c.env, actor.id, credential, current))) ||
        (await secretsEqual(supplied, await csrfToken(c.env, actor.id, credential, current - 1))));
    if (!valid) throw new ApiError(403, 'INVALID_CSRF', 'Refresh the page before saving');
  }
  await next();
});
