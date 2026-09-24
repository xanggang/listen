import { ApiError } from './errors.ts';

/** 解析安全的正整数；仅在参数缺失时使用默认值，非法值抛出 400。 */
export function integer(
  value: string | null,
  name: string,
  fallback?: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (value === null && fallback !== undefined) return fallback;
  if (!value || !/^[1-9]\d*$/.test(value))
    throw new ApiError(400, 'INVALID_PARAMETER', `${name} must be a positive integer`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n > max)
    throw new ApiError(400, 'INVALID_PARAMETER', `${name} must be <= ${max}`);
  return n;
}

/** 拒绝未声明或重复的查询参数，避免不同组件产生不一致解释。 */
export function validateParams(params: URLSearchParams, allowed: string[]) {
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) {
      throw new ApiError(400, 'INVALID_PARAMETER', `Unknown or repeated parameter: ${key}`);
    }
  }
}
