import type { SqlDatabase } from '../../database/database.ts';
import { publicStation } from '../../database/catalog-policy.ts';

export interface MapPointRow {
  id: string;
  name: string;
  geoLat: number;
  geoLong: number;
}
export class MapRepository {
  private readonly db: SqlDatabase;
  /**
   * 注入数据库连接，地图点位与详情来自同一数据源。
   */
  constructor(db: SqlDatabase) {
    this.db = db;
  }
  /**
   * 按 ID 游标读取轻量点位，多读一条判断后续页，避免 8 万点一次返回。
   */
  async findPage(after: string | undefined, limit: number) {
    const where = [
      publicStation,
      's.latitude BETWEEN -90 AND 90',
      's.longitude BETWEEN -180 AND 180',
    ];
    if (after) where.push('s.id > ?');
    const { results } = await this.db
      .prepare(
        `SELECT s.id, s.name, s.latitude AS geoLat, s.longitude AS geoLong FROM station s
      WHERE ${where.join(' AND ')} ORDER BY s.id ASC LIMIT ?`,
      )
      .bind(...(after ? [after] : []), limit + 1)
      .all<MapPointRow>();
    return results;
  }
  /**
   * 读取所有公开且坐标有效的电台，固定排序保证快照和 ETag 稳定。
   */
  async findAll(): Promise<MapPointRow[]> {
    const { results } = await this.db
      .prepare(
        `SELECT s.id, s.name, s.latitude AS geoLat, s.longitude AS geoLong
       FROM station s WHERE ${publicStation}
       AND s.latitude BETWEEN -90 AND 90 AND s.longitude BETWEEN -180 AND 180
       ORDER BY s.id ASC`,
      )
      .all<MapPointRow>();
    return results;
  }
}
