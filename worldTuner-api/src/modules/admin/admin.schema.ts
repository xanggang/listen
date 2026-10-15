import { ApiError } from '../../shared/errors.ts';
import type { StationVisibility } from './admin.types.ts';

/**
 * 校验管理端上下架状态；与 Java 契约一致，仅允许 visible 和 hidden。
 * 其他 JSON 字段不参与更新，状态缺失或类型错误返回 400。
 */
export function parseVisibility(body: unknown): StationVisibility {
  if (body !== null && typeof body === 'object' && !Array.isArray(body) && 'visibility' in body) {
    if (body.visibility === 'visible' || body.visibility === 'hidden') return body.visibility;
  }
  throw new ApiError(400, 'INVALID_PARAMETER', "visibility must be 'visible' or 'hidden'");
}
