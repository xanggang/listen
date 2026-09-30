import type { SqlDatabase } from '../../database/database.ts';
import { MapRepository } from './map.repository.ts';

export type MapTuple = [id: string, name: string, longitude: number, latitude: number];
export interface MapSnapshot {
  body: Uint8Array<ArrayBuffer>;
  gzip: Uint8Array<ArrayBuffer>;
  etag: string;
  expiresAt: number;
}
interface SnapshotEntry {
  ttl: number;
  expiresAt: number;
  pending: Promise<MapSnapshot>;
}
const snapshots = new WeakMap<SqlDatabase, SnapshotEntry>();

/**
 * 将配置解析为秒数；0 禁用缓存，非法值回退到 300，最大允许一天。
 */
export function snapshotTtl(value: string | undefined): number {
  if (value === undefined || !/^\d+$/.test(value)) return 300;
  return Math.min(Number(value), 86400);
}

/**
 * 获取数据库对应的完整快照，同一实例的并发请求共用生成任务。
 * TTL 从查询开始计时；失败不会缓存，0 秒时每次重新读取数据库。
 */
export async function getMapSnapshot(db: SqlDatabase, ttl: number): Promise<MapSnapshot> {
  const current = snapshots.get(db);
  if (current && current.ttl === ttl && current.expiresAt > Date.now()) return current.pending;
  const expiresAt = Date.now() + ttl * 1000;
  const pending = buildSnapshot(db, expiresAt);
  const entry = { ttl, expiresAt, pending };
  snapshots.set(db, entry);
  try {
    return await pending;
  } catch (error) {
    if (snapshots.get(db) === entry) snapshots.delete(db);
    throw error;
  }
}

/**
 * 只序列化四个地图字段；经纬度保留五位小数，ID 保持字符串。
 * 内容哈希作为弱 ETag，让 identity 和 gzip 两种编码共用内容版本。
 */
async function buildSnapshot(db: SqlDatabase, expiresAt: number): Promise<MapSnapshot> {
  const rows = await new MapRepository(db).findAll();
  const points: MapTuple[] = rows.map(
    // 坐标顺序固定为经度、纬度，与 GeoJSON 一致。
    (row) => [row.id, row.name, Number(row.geoLong.toFixed(5)), Number(row.geoLat.toFixed(5))],
  );
  const body = new Uint8Array(
    new TextEncoder().encode(JSON.stringify({ data: { count: points.length, points } })),
  );
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', body));
  const hash = Array.from(
    digest,
    // 每个字节转换为两位十六进制，避免不同内容出现歧义。
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
  const stream = new Response(body).body!.pipeThrough(new CompressionStream('gzip'));
  const gzip = new Uint8Array(await new Response(stream).arrayBuffer());
  return { body, gzip, etag: `W/"${hash}"`, expiresAt };
}
