import { integer, validateParams } from '../../shared/validation.ts';
/** 解析字典列表参数；拒绝未知或重复参数，并限制最多返回 1000 项。 */
export function parseCatalogQuery(params: URLSearchParams, defaultLimit: number) {
  validateParams(params, ['limit']);
  return { limit: integer(params.get('limit'), 'limit', defaultLimit, 1000) };
}
