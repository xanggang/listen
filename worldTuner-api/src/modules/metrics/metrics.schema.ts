import { ApiError } from '../../shared/errors.ts';
import { metricPages, type VisitInput } from './metrics.types.ts';

const visitorIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 仅接受匿名 UUID、平台和固定页面名；拒绝额外字段以防误上传个人信息。 */
export function parseVisitInput(value: unknown): VisitInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new ApiError(400, 'INVALID_METRIC', 'Invalid visit payload');
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== 3 ||
    !Object.keys(input).every((key) => ['visitorId', 'source', 'page'].includes(key)) ||
    typeof input.visitorId !== 'string' ||
    !visitorIdPattern.test(input.visitorId) ||
    (input.source !== 'web' && input.source !== 'android') ||
    typeof input.page !== 'string' ||
    !metricPages.includes(input.page as (typeof metricPages)[number])
  )
    throw new ApiError(400, 'INVALID_METRIC', 'Invalid visit payload');
  return input as unknown as VisitInput;
}
