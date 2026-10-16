import { ApiError } from '../shared/errors.ts';
import { entityId } from '../shared/validation.ts';
import { pageQuery, text, httpUrl } from '../shared/input.ts';

/**
 * 管理筛选包含隐藏与失效电台，分类仍提交稳定 ID；状态值只能来自固定枚举。
 */
export function parseAdminStationQuery(params: URLSearchParams) {
  const page = pageQuery(params, ['countryId', 'languageId', 'tagId', 'visibility', 'status']);
  const filters: Partial<
    Record<'countryId' | 'languageId' | 'tagId' | 'visibility' | 'status', string>
  > = {};
  for (const field of ['countryId', 'languageId', 'tagId'] as const)
    if (params.has(field)) filters[field] = entityId(params.get(field), field);
  for (const [field, allowed] of [
    ['visibility', ['visible', 'hidden']],
    ['status', ['active', 'unverified', 'unavailable']],
  ] as const) {
    const value = params.get(field);
    if (value && !(allowed as readonly string[]).includes(value))
      throw new ApiError(400, 'INVALID_INPUT', `Invalid ${field}`);
    if (value) filters[field] = value;
  }
  return { ...page, ...filters };
}

/**
 * 编辑完整基本信息，保留字段白名单；更新时间用于乐观锁，坐标必须成对有效。
 */
export function parseStationEdit(body: Record<string, unknown>) {
  if (
    typeof body.status !== 'string' ||
    !['active', 'unverified', 'unavailable'].includes(body.status)
  )
    throw new ApiError(400, 'INVALID_INPUT', 'Invalid catalog status');
  const latitude = body.latitude;
  const longitude = body.longitude;
  if (!(
    (latitude === null && longitude === null) ||
    (typeof latitude === 'number' &&
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      typeof longitude === 'number' &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180)
  ))
    throw new ApiError(400, 'INVALID_INPUT', 'Coordinates must be a valid pair');
  return {
    expectedUpdatedAt: text(body.expectedUpdatedAt, 'expectedUpdatedAt', 100)!,
    name: text(body.name, 'name', 200)!,
    status: String(body.status),
    place: text(body.place, 'place', 200, true),
    countryId:
      body.countryId === null
        ? null
        : entityId(typeof body.countryId === 'string' ? body.countryId : null, 'countryId'),
    website: httpUrl(body.website, 'website'),
    favicon: httpUrl(body.favicon, 'favicon'),
    latitude,
    longitude,
  };
}

/**
 * 校验已有播放流的可编辑属性；不新增/删除流，不允许跨电台修改。
 */
export function parseStreamEdit(body: Record<string, unknown>) {
  const bitrate = body.bitrate;
  if (!(
    bitrate === null ||
    (typeof bitrate === 'number' && Number.isInteger(bitrate) && bitrate >= 0 && bitrate <= 100000)
  ))
    throw new ApiError(400, 'INVALID_INPUT', 'Invalid bitrate');
  if (typeof body.isHls !== 'boolean') throw new ApiError(400, 'INVALID_INPUT', 'Invalid isHls');
  return {
    expectedUpdatedAt: text(body.expectedUpdatedAt, 'expectedUpdatedAt', 100)!,
    url: httpUrl(body.url, 'url', false)!,
    resolvedUrl: httpUrl(body.resolvedUrl, 'resolvedUrl'),
    codec: text(body.codec, 'codec', 40, true),
    bitrate,
    isHls: body.isHls,
  };
}
