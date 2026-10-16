import { Hono } from 'hono';
import type { AdminEnv } from '../types.ts';
import { ApiError } from '../shared/errors.ts';
import { entityId, validateParams } from '../shared/validation.ts';
import { jsonInput, pageQuery, text, nullableSnapshot } from '../shared/input.ts';
import { auditEvent } from '../audit/audit.service.ts';
import {
  ManagementCatalogRepository,
  catalogTables,
  type CatalogKind,
} from './catalog.repository.ts';

/**
 * 校验分类路径，只接受固定三类，不允许输入任意表名。
 */
function catalogKind(value: string): CatalogKind {
  if (!Object.hasOwn(catalogTables, value))
    throw new ApiError(404, 'NOT_FOUND', 'Catalog not found');
  return value as CatalogKind;
}
export const managementCatalogRoutes = new Hono<AdminEnv>();
managementCatalogRoutes.get(
  '/:kind',
  // 分类名称按分页返回，前端可搜索全部标签而非下载整个字典。
  async (c) => {
    const kind = catalogKind(c.req.param('kind'));
    const query = pageQuery(new URL(c.req.url).searchParams);
    return c.json({
      data: {
        ...(await new ManagementCatalogRepository(c.env.DB).list(
          kind,
          query.q,
          query.pageSize,
          query.offset,
        )),
        page: query.page,
        pageSize: query.pageSize,
      },
    });
  },
);
managementCatalogRoutes.put(
  '/:kind/:id',
  // 展示名可清空后由客户端兜底；旧值必须同时提交，冲突返回 409。
  async (c) => {
    validateParams(new URL(c.req.url).searchParams, []);
    const kind = catalogKind(c.req.param('kind'));
    const id = entityId(c.req.param('id'), 'id');
    const body = await jsonInput(c, ['nameEn', 'nameZh', 'expectedNameEn', 'expectedNameZh']);
    const input = {
      nameEn: text(body.nameEn, 'nameEn', 200, true),
      nameZh: text(body.nameZh, 'nameZh', 200, true),
      expectedNameEn: nullableSnapshot(body.expectedNameEn, 'expectedNameEn'),
      expectedNameZh: nullableSnapshot(body.expectedNameZh, 'expectedNameZh'),
    };
    return c.json({
      data: await new ManagementCatalogRepository(c.env.DB).edit(
        kind,
        id,
        input,
        auditEvent(c, 'catalog.edit', kind, id, ['nameEn', 'nameZh']),
      ),
    });
  },
);
