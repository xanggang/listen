import { ApiError } from '../shared/errors.ts';
import { validateParams } from '../shared/validation.ts';

/**
 * UTC 日范围最多 31 天，平台只有 web/android；拒绝无效日期与未知参数。
 */
export function analyticsQuery(params: URLSearchParams) {
  validateParams(params, ['from', 'to', 'source']);
  const today = new Date().toISOString().slice(0, 10);
  const to = params.get('to') ?? today;
  const end = Date.parse(to);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
    !Number.isFinite(end) ||
    new Date(end).toISOString().slice(0, 10) !== to
  )
    throw new ApiError(400, 'INVALID_INPUT', 'Invalid UTC date');
  const from = params.get('from') ?? new Date(end - 6 * 86400000).toISOString().slice(0, 10);
  for (const day of [from, to]) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(Date.parse(day)) ||
      new Date(day).toISOString().slice(0, 10) !== day
    )
      throw new ApiError(400, 'INVALID_INPUT', 'Invalid UTC date');
  }
  if (from > to || to > today || (Date.parse(to) - Date.parse(from)) / 86400000 > 30)
    throw new ApiError(
      400,
      'INVALID_INPUT',
      'Date range must be at most 31 days and not in the future',
    );
  const source = params.get('source');
  if (source && !['web', 'android'].includes(source))
    throw new ApiError(400, 'INVALID_INPUT', 'Invalid source');
  return { from, to, source };
}
