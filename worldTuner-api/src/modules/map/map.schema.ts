import { stationPublicId, integer, validateParams } from '../../shared/validation.ts';

/**
 * 验证 7 位 public_id 点位游标与页大小，拒绝未知、重复参数和过大响应。
 */
export function parseMapQuery(params: URLSearchParams) {
  validateParams(params, ['after', 'limit']);
  return {
    after: params.has('after') ? stationPublicId(params.get('after'), 'after') : undefined,
    limit: integer(params.get('limit'), 'limit', 2000, 5000),
  };
}
