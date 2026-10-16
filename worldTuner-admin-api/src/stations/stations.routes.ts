import { Hono } from 'hono';
import type { AdminEnv } from '../types.ts';
import { entityId, stationPublicId, validateParams } from '../shared/validation.ts';
import { jsonInput, text } from '../shared/input.ts';
import { ApiError } from '../shared/errors.ts';
import { ManagementStationRepository } from './stations.repository.ts';
import { ManagementStationService } from './stations.service.ts';
import { parseAdminStationQuery, parseStationEdit, parseStreamEdit } from './stations.schema.ts';
import { auditEvent } from '../audit/audit.service.ts';

export const managementStationRoutes = new Hono<AdminEnv>();
managementStationRoutes.get(
  '/',
  // 管理列表不应用公开可播放/可见过滤，也不使用公开缓存。
  async (c) =>
    c.json({
      data: await new ManagementStationRepository(c.env.DB).list(
        parseAdminStationQuery(new URL(c.req.url).searchParams),
      ),
    }),
);
managementStationRoutes.get(
  '/:id',
  // 参数先校验，再返回完整管理详情。
  async (c) => {
    validateParams(new URL(c.req.url).searchParams, []);
    return c.json({
      data: await new ManagementStationService(new ManagementStationRepository(c.env.DB)).detail(
        stationPublicId(c.req.param('id'), 'id'),
      ),
    });
  },
);
managementStationRoutes.put(
  '/:id',
  // 基本字段白名单与版本校验，审计只保存变更字段名。
  async (c) => {
    validateParams(new URL(c.req.url).searchParams, []);
    const id = stationPublicId(c.req.param('id'), 'id');
    const fields = [
      'expectedUpdatedAt',
      'name',
      'status',
      'place',
      'countryId',
      'website',
      'favicon',
      'latitude',
      'longitude',
    ];
    const input = parseStationEdit(await jsonInput(c, fields));
    return c.json({
      data: await new ManagementStationService(new ManagementStationRepository(c.env.DB)).edit(
        id,
        input,
        auditEvent(c, 'station.edit', 'station', id, fields.slice(1)),
      ),
    });
  },
);
managementStationRoutes.put(
  '/:id/visibility',
  // 上下架必须显式传入读取版本，防止覆盖其他管理员的修改。
  async (c) => {
    validateParams(new URL(c.req.url).searchParams, []);
    const id = stationPublicId(c.req.param('id'), 'id');
    const body = await jsonInput(c, ['expectedUpdatedAt', 'visibility']);
    if (typeof body.visibility !== 'string' || !['visible', 'hidden'].includes(body.visibility))
      throw new ApiError(400, 'INVALID_INPUT', 'Invalid visibility');
    return c.json({
      data: await new ManagementStationService(
        new ManagementStationRepository(c.env.DB),
      ).visibility(
        id,
        text(body.expectedUpdatedAt, 'expectedUpdatedAt', 100)!,
        String(body.visibility),
        auditEvent(c, 'station.visibility', 'station', id, ['visibility']),
      ),
    });
  },
);
managementStationRoutes.put(
  '/:id/streams/:streamId',
  // 播放地址修改独立路由，绑定电台版本和流归属，不在日志中输出 URL。
  async (c) => {
    validateParams(new URL(c.req.url).searchParams, []);
    const id = stationPublicId(c.req.param('id'), 'id');
    const streamId = entityId(c.req.param('streamId'), 'streamId');
    const fields = ['expectedUpdatedAt', 'url', 'resolvedUrl', 'codec', 'bitrate', 'isHls'];
    const input = parseStreamEdit(await jsonInput(c, fields));
    return c.json({
      data: await new ManagementStationService(new ManagementStationRepository(c.env.DB)).stream(
        id,
        streamId,
        input,
        auditEvent(c, 'station.stream', 'stream', streamId, fields.slice(1)),
      ),
    });
  },
);
