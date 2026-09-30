import { Hono } from 'hono';
import type { AppEnv } from '../../types.ts';
import { validateParams } from '../../shared/validation.ts';
export const healthRoutes = new Hono<AppEnv>();
healthRoutes.get(
  '/' /**
   * 返回服务存活状态；不执行数据库探测，且拒绝无效查询参数。
   */,
  (c) => {
    validateParams(new URL(c.req.url).searchParams, []);
    return c.json({ data: { status: 'ok', service: 'worldtuner-api' } });
  },
);
