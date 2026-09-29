import type { PlayableStation } from '@/types/playable-station';

/** 从 API 或本地存储读取可用的 HTTP(S) 地址，拒绝其他协议。 */
function webUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** 读取可选的展示文字，防止损坏的本地记录进入页面。 */
function label(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : null;
}

/** 将完整电台或持久化 JSON 校验并缩减为播放与列表需要的字段。 */
export function toPlayableStation(value: unknown): PlayableStation | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const id = record.id;
  const name = label(record.name);
  const url = webUrl(record.url);
  const urlResolved = webUrl(record.urlResolved);
  if (!Number.isSafeInteger(id) || Number(id) <= 0 || !name || (!url && !urlResolved)) {
    return null;
  }
  return {
    id: Number(id),
    name,
    url: url ?? urlResolved ?? '',
    urlResolved,
    favicon: webUrl(record.favicon),
    country: label(record.country),
    language: label(record.language),
    votes: Number.isSafeInteger(record.votes) && Number(record.votes) >= 0
      ? Number(record.votes)
      : null,
  };
}

/** 单条校验、按 id 去重并限制本地列表长度，坏数据不影响其余记录。 */
export function readSavedStations(value: unknown, limit: number): PlayableStation[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const stations: PlayableStation[] = [];
  for (const item of value) {
    const station = toPlayableStation(item);
    if (station && !seen.has(station.id)) {
      seen.add(station.id);
      stations.push(station);
    }
    if (stations.length >= limit) break;
  }
  return stations;
}
