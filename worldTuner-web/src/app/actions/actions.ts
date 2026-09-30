'use server';

// Compatibility facade for existing Web components; all SQL lives in listen-api.
import { apiGet, ListenApiError } from '@/lib/listen-api';
import type { Tags, Languages, Countries, Station } from '@/types';

/**
 * 通过独立 API 获取语言字典，兼容现有设置页。
 */
export async function getLanguages() {
  return apiGet<Languages[]>('/api/languages?limit=1000');
}
/**
 * 获取电台数排名前 30 的语言选项。
 */
export async function getTopLanguages() {
  return apiGet<Languages[]>('/api/languages?limit=30');
}
/**
 * 获取电台数排名前 30 的标签选项。
 */
export async function getTopTags() {
  return apiGet<Tags[]>('/api/tags?limit=30');
}
/**
 * 获取电台数排名前 30 的国家选项，供发现页筛选。
 */
export async function getTopCountries() {
  return apiGet<Countries[]>('/api/countries?limit=30');
}

interface SearchType {
  page: number;
  pageSize: number;
  languagesId?: string;
  tagsId?: string;
  countriesId?: string;
  keyword?: string;
}

/**
 * 序列化 Web 查询参数并调用独立分页接口，不在 Web 执行 SQL。
 */
export async function getStations(query: SearchType) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return apiGet<{
    list: Station[];
    page: number;
    pageSize: number;
    hasMore: boolean;
    nextPage: number | null;
  }>(`/api/stations?${params}`);
}

/**
 * 使用新库的 19 位字符串 ID 获取电台；只有真实 404 转换为 null，其他异常继续传播。
 */
export async function getStationById(id: string): Promise<Station | null> {
  if (!/^\d{19}$/.test(id)) throw new Error('Invalid station id');
  try {
    return await apiGet<Station>(`/api/stations/${id}`);
  } catch (error) {
    if (error instanceof ListenApiError && error.status === 404) return null;
    throw error;
  }
}
