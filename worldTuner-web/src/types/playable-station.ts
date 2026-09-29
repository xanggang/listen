// 播放器与本地收藏只持有必要的公共电台字段，不保存 API 的完整记录。
export interface PlayableStation {
  id: number;
  name: string;
  url: string;
  urlResolved: string | null;
  favicon: string | null;
  country: string | null;
  language: string | null;
  votes: number | null;
}
