import type { StationRow, StreamRow } from './stations.types.ts';

/**
 * 生成电台展示 DTO；ID 保持字符串，未知来源统计保持 null，缺流时 URL 为空。
 */
export function stationDto(row: StationRow) {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    favicon: row.favicon,
    place: row.place,
    countryId: row.country_id,
    country: row.country,
    countrycode: row.countrycode,
    geoLat: row.geo_lat,
    geoLong: row.geo_long,
    votes: row.votes,
    clickcount: row.clickcount,
    sourceType: row.source_type,
    catalogStatus: row.catalog_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    url: row.url,
    urlResolved: row.url_resolved,
    codec: row.codec,
    bitrate: row.bitrate,
    hls: row.hls,
    lastcheckok: row.lastcheckok,
    tags: row.tags,
    language: row.language,
    languagecodes: row.languagecodes,
  };
}

/**
 * 将播放流字段映射为客户端字段，保留未知检查状态和 HLS 的 null。
 */
export function streamDto(row: StreamRow) {
  return {
    id: row.id,
    url: row.url,
    urlResolved: row.resolved_url,
    codec: row.codec,
    bitrate: row.bitrate,
    hls: row.is_hls,
    isPrimary: row.is_primary === 1,
    lastcheckok: row.last_check_ok,
    lastCheckedAt: row.last_checked_at,
    resolvedAt: row.resolved_at,
  };
}
