import { integer, validateParams } from '../../shared/validation.ts';
import { ApiError } from '../../shared/errors.ts';
/** 解析字典列表参数；拒绝未知或重复参数，并限制最多返回 1000 项。 */
export function parseCatalogQuery(params: URLSearchParams, defaultLimit: number) {
  validateParams(params, ['limit']);
  return { limit: integer(params.get('limit'), 'limit', defaultLimit, 1000) };
}

/**
 * 解析标签搜索参数；保留原有 limit 契约，并限制关键词和翻页深度。
 */
export function parseTagQuery(params: URLSearchParams) {
  validateParams(params, ['limit', 'q', 'offset']);
  const q = (params.get('q') ?? '').trim();
  if (q.length > 100) throw new ApiError(400, 'INVALID_PARAMETER', 'q must be <= 100 characters');
  const rawOffset = params.get('offset');
  if (rawOffset !== null && !/^(0|[1-9]\d*)$/.test(rawOffset))
    throw new ApiError(400, 'INVALID_PARAMETER', 'offset must be a non-negative integer');
  const offset = rawOffset === null ? 0 : Number(rawOffset);
  if (!Number.isSafeInteger(offset) || offset > 100000)
    throw new ApiError(400, 'INVALID_PARAMETER', 'offset must be <= 100000');
  return { limit: integer(params.get('limit'), 'limit', 30, 1000), q, offset };
}
