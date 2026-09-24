import type { StationRow } from './stations.types.ts';

const aliases = {
  url_resolved: 'urlResolved',
  lastchangetime_iso8601: 'lastchangetimeIso8601',
  lastchecktime_iso8601: 'lastchecktimeIso8601',
  lastcheckoktime_iso8601: 'lastcheckoktimeIso8601',
  lastlocalchecktime_iso8601: 'lastlocalchecktimeIso8601',
  clicktimestamp_iso8601: 'clicktimestampIso8601',
  ssl_error: 'sslError',
  geo_lat: 'geoLat',
  geo_long: 'geoLong',
  geo_distance: 'geoDistance',
  has_extended_info: 'hasExtendedInfo',
} as const;

export type StationDto = {
  [
    K in keyof StationRow as K extends keyof typeof aliases ? (typeof aliases)[K] : K
  ]: StationRow[K];
};
// Mapping is deliberately centralized; storage columns never leak into route handlers.
/** 将数据库列映射到 v1 电台契约，保留空值及现有 Web 字段命名。 */
export function stationDto(row: StationRow): StationDto {
  return Object.fromEntries(
    Object.entries(row).map(
      /** 逐项转换已知列名；未重命名的契约字段保留原名。 */
      ([key, value]) => [(aliases as Record<string, string>)[key] ?? key, value],
    ),
  ) as StationDto;
}
