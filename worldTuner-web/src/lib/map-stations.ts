/**
 * 一次读取同源全量地图快照；浏览器通过 ETag 重新验证正文，避免复用旧主键格式的快照。
 * 元组顺序为 [public_id, longitude, latitude]，名称从详情获取，同坐标点不聚合。
 * 可取消请求；格式、计数或重复 ID 异常时拒绝不完整快照。
 */
export async function loadStationFeatures(
  signal: AbortSignal,
  onPage?: (data: GeoJSON.FeatureCollection<GeoJSON.Point>) => void,
  request: typeof fetch = fetch,
): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> {
  const response = await request('/api/map/snapshot', { signal, cache: 'no-cache' });
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
    if (!Array.isArray(value) || value.length !== 3) throw new Error('Invalid map point');
    const [id, longitude, latitude] = value;
    if (
      typeof id !== 'string' ||
      !/^[0-9A-Za-z]{7}$/.test(id) ||
      seen.has(id) ||
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
      properties: { id },
      geometry: { type: 'Point', coordinates: [longitude, latitude] },
    });
  }
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  onPage?.(data);
  return data;
}
