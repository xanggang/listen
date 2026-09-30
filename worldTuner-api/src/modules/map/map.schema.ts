import { entityId, integer, validateParams } from '../../shared/validation.ts';

/**
 * 验证点位游标与页大小，拒绝未知或重复参数，防止深分页和过大响应。
 */
export function parseMapQuery(params: URLSearchParams) {
  validateParams(params, ['after', 'limit']);
  return {
    after: params.has('after') ? entityId(params.get('after'), 'after') : undefined,
    limit: integer(params.get('limit'), 'limit', 2000, 5000),
  };
}
