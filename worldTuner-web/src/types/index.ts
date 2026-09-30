// import request from '@/utils/request'
// import { mock1 } from '@/api/mocl.ts'

// 定义类型
// 筛选相关
export enum FilterEnums {
  ALL = 'all',
  By_Language = 'byLanguage',
  By_Genre = 'byGenre',
}

// 语言实体
export interface Languages {
  id: string;
  name: string;
  code: string | null;
  stationcount: number;
}

// 国家实体
export interface Countries {
  id: string;
  name: string;
  code: string | null;
  stationcount: number;
}

// 标签实体
export interface Tags {
  id: string;
  name: string;
  stationcount: number;
}

// 新业务库的电台展示字段；实体 ID 始终保留字符串和前导零。
export interface Station {
  id: string;
  name: string;
  url: string | null;
  urlResolved: string | null;
  website: string | null;
  favicon: string | null;
  place: string | null;
  countryId: string | null;
  country: string | null;
  countrycode: string | null;
  tags: string | null;
  language: string | null;
  languagecodes: string | null;
  votes: number | null;
  codec: string | null;
  bitrate: number | null;
  hls: number | null;
  lastcheckok: number | null;
  clickcount: number | null;
  geoLat: number | null;
  geoLong: number | null;
  sourceType: 'radio_browser' | 'radio_garden' | 'both';
  catalogStatus: 'active' | 'unverified';
  createdAt: string;
  updatedAt: string;
  rank?: number;
}

// 分页查询参数
export interface PageQueryDTO {
  page: number;
  pageSize: number;
}

// 电台查询参数
export interface StationQuery {
  id?: string;
  name?: string;
  country?: string;
  language?: string;
  tags?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}

// 分页结果
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// API响应
export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}
