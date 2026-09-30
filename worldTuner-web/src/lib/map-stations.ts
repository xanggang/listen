/**
 * 一次读取同源全量地图快照；浏览器按 Cache-Control 和 ETag 复用 HTTP 缓存。
 * 元组顺序为 [id, name, longitude, latitude]，同坐标电台保持独立、不聚合。
 * 可取消请求；格式、计数或重复 ID 异常时拒绝不完整快照。
 */
export async function loadStationFeatures(
  signal: AbortSignal,
  onPage?: (data: GeoJSON.FeatureCollection<GeoJSON.Point>) => void,
  request: typeof fetch = fetch,
): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> {
  const response = await request('/api/map/snapshot', { signal, cache: 'default' });
  if (!response.ok) throw new Error('Map API unavailable');
  const payload: unknown = await response.json();
  if (typeof payload !== 'object' || payload === null || !('data' in payload))
    throw new Error('Invalid map response');
  const snapshot = payload.data;
  if (
    typeof snapshot !== 'object' ||
    snapshot === null ||
    !('points' in snapshot) ||
    !Array.isArray(snapshot.points) ||
    !('count' in snapshot) ||
    snapshot.count !== snapshot.points.length
  ) {
    throw new Error('Invalid map snapshot');
  }
  const data: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: 'FeatureCollection',
    features: [],
  };
  const seen = new Set<string>();
  for (const value of snapshot.points) {
    if (!Array.isArray(value) || value.length !== 4) throw new Error('Invalid map point');
    const [id, name, longitude, latitude] = value;
    if (
      typeof id !== 'string' ||
      !/^\d{19}$/.test(id) ||
      seen.has(id) ||
      typeof name !== 'string' ||
      typeof latitude !== 'number' ||
      !Number.isFinite(latitude) ||
      Math.abs(latitude) > 90 ||
      typeof longitude !== 'number' ||
      !Number.isFinite(longitude) ||
      Math.abs(longitude) > 180
    )
      throw new Error('Invalid map point');
    seen.add(id);
    data.features.push({
      type: 'Feature',
      properties: { id, name },
      geometry: { type: 'Point', coordinates: [longitude, latitude] },
    });
  }
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  onPage?.(data);
  return data;
}
