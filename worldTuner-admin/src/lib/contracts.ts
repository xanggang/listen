export interface Session {
  id: string;
  email: string;
  role: 'owner' | 'viewer';
  authMode: 'local' | 'access';
  csrfToken: string;
  cacheNotice: string;
}
export interface Page<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface CatalogItem {
  id: string;
  name: string;
  nameEn: string | null;
  nameZh: string | null;
  code: string | null;
}
export type CatalogKind = 'countries' | 'languages' | 'tags';
export interface Station {
  id: string;
  name: string;
  place: string | null;
  countryId: string | null;
  country: string | null;
  website: string | null;
  favicon: string | null;
  latitude: number | null;
  longitude: number | null;
  visibility: 'visible' | 'hidden';
  status: string;
  source: string;
  updatedAt: string;
}
export interface Stream {
  id: string;
  url: string;
  resolvedUrl: string | null;
  codec: string | null;
  bitrate: number | null;
  isHls: number | null;
  isPrimary: number;
}
export interface StationDetail extends Station {
  streams: Stream[];
}
export interface Analytics {
  from: string;
  to: string;
  timezone: 'UTC';
  daily: { day: string; source: string; pv: number; uv: number }[];
  monthly: { month: string; source: string; mau: number }[];
}
export interface Overview extends Analytics {
  catalog: { visibility: string; status: string; count: number }[];
}
export interface Report {
  id: string;
  platform: string;
  appVersion: string;
  eventType: string;
  errorCode: string;
  message: string;
  status: string;
  createdAt: string;
  requestId: string | null;
  stationId: string | null;
}
export interface Audit {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  changedFields: string;
  requestId: string;
  createdAt: string;
}
export interface Logs {
  mode: 'console';
  queryEnabled: false;
  consoleUrl: string;
  message: string;
}
