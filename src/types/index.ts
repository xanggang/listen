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
  id: number;
  name: string;
  iso_639: string;
  stationcount: number;
}

// 国家实体
export interface Countries {
  id: number;
  name: string;
  iso_3166_1: string;
  stationcount: number;
}

// 标签实体
export interface Tags {
  id: number;
  name: string;
  stationcount: number;
}

// 电台实体
export interface Station {
  id: number;
  changeuuid: string;
  stationuuid: string;
  name: string;
  url: string;
  urlResolved: string;
  homepage: string;
  favicon: string;
  tags: string;
  country: string;
  countrycode: string;
  iso_3166_2: string;
  state: string;
  language: string;
  languagecodes: string;
  votes: number;
  lastchangetime: string;
  lastchangetimeIso8601: string;
  codec: string;
  bitrate: number;
  hls: number;
  lastcheckok: number;
  lastchecktime: string;
  lastchecktimeIso8601: string;
  lastcheckoktime: string;
  lastcheckoktimeIso8601: string;
  lastlocalchecktime: string;
  lastlocalchecktimeIso8601: string;
  clicktimestamp: string;
  clicktimestampIso8601: string;
  clickcount: number;
  clicktrend: number;
  sslError: number;
  geoLat: number;
  geoLong: number;
  geoDistance: number;
  hasExtendedInfo: number;

  rank?: number
}

// 分页查询参数
export interface PageQueryDTO {
  page: number;
  pageSize: number;
}

// 电台查询参数
export interface StationQuery {
  id?: number;
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

