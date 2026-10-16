// 播放器与本地收藏的 id 使用 7 位 public_id，只保存必要的公开播放字段。
export interface PlayableStation {
  id: string;
  name: string;
  url: string;
  urlResolved: string | null;
  favicon: string | null;
  country: string | null;
  countryEn?: string | null;
  countryZh?: string | null;
  language: string | null;
  languageEn?: string | null;
  languageZh?: string | null;
  votes: number | null;
}
