import { ApiError } from '../../shared/errors.ts';
import { entityId, integer, validateParams } from '../../shared/validation.ts';

/**
 * 验证分页、筛选和关键词，限制页大小与深分页成本。
 */
export function parseStationQuery(params: URLSearchParams) {
  validateParams(params, ['page', 'pageSize', 'languagesId', 'tagsId', 'countriesId', 'keyword']);
  const page = integer(params.get('page'), 'page', 1, 10000);
  const pageSize = integer(params.get('pageSize'), 'pageSize', 20, 100);
  const offset = (page - 1) * pageSize;
  if (offset > 100000)
    throw new ApiError(400, 'INVALID_PARAMETER', 'Pagination offset exceeds 100000');
  const keyword = (params.get('keyword') ?? '').trim();
  if (keyword.length > 100)
    throw new ApiError(400, 'INVALID_PARAMETER', 'keyword must be <= 100 characters');
  return {
    page,
    pageSize,
    offset,
    keyword,
    languagesId: params.has('languagesId')
      ? entityId(params.get('languagesId'), 'languagesId')
      : undefined,
    tagsId: params.has('tagsId') ? entityId(params.get('tagsId'), 'tagsId') : undefined,
    countriesId: params.has('countriesId')
      ? entityId(params.get('countriesId'), 'countriesId')
      : undefined,
  };
}

export type StationQuery = ReturnType<typeof parseStationQuery>;
