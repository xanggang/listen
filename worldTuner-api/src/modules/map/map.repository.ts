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
   * 按区分大小写的 public_id 游标读取点位，多读一条判断后续页，始终按相同键排序。
   */
  async findPage(after: string | undefined, limit: number) {
    const where = [
      publicStation,
      's.latitude BETWEEN -90 AND 90',
      's.longitude BETWEEN -180 AND 180',
    ];
    if (after) where.push('s.public_id COLLATE BINARY > ?');
    const { results } = await this.db
      .prepare(
        `SELECT s.public_id AS id, s.name, s.latitude AS geoLat, s.longitude AS geoLong FROM station s
      WHERE ${where.join(' AND ')} ORDER BY s.public_id COLLATE BINARY ASC LIMIT ?`,
      )
      .bind(...(after ? [after] : []), limit + 1)
      .all<MapPointRow>();
    return results;
  }
  /**
   * 全量快照只查询 public_id 和经纬度，不读取名称；排序保证 ETag 稳定。
   */
  async findAll(): Promise<Omit<MapPointRow, 'name'>[]> {
    const { results } = await this.db
      .prepare(
        `SELECT s.public_id AS id, s.latitude AS geoLat, s.longitude AS geoLong
       FROM station s WHERE ${publicStation}
       AND s.latitude BETWEEN -90 AND 90 AND s.longitude BETWEEN -180 AND 180
       ORDER BY s.public_id COLLATE BINARY ASC`,
      )
      .all<Omit<MapPointRow, 'name'>>();
    return results;
  }
}
