import type { SqlDatabase, SqlValue } from '../../database/database.ts';
import type { StationQuery } from './stations.schema.ts';
import type { StationRow, StreamRow, LinkRow } from './stations.types.ts';

import { publicStation } from '../../database/catalog-policy.ts';

// 优先非失败流，再取首选流；固定 ID 用于稳定选择，空流不会冒充可播放地址。
export const streamOrder =
  'CASE WHEN st.last_check_ok = 0 THEN 1 ELSE 0 END, st.is_primary DESC, st.id ASC';
const projection = `s.id, s.name, s.website, s.favicon,
  s.place, s.country_id, s.latitude AS geo_lat, s.longitude AS geo_long,
  s.votes, s.clickcount, s.source_type, s.catalog_status,
  s.created_at, s.updated_at,
  c.name AS country, c.code AS countrycode,
  st.url, st.resolved_url AS url_resolved, st.codec, st.bitrate,
  st.is_hls AS hls, st.last_check_ok AS lastcheckok,
  (SELECT group_concat(name, ',') FROM (SELECT t.name FROM station_tag r JOIN tag t ON t.id = r.tag_id WHERE r.station_id = s.id ORDER BY t.id)) AS tags,
  (SELECT group_concat(name, ',') FROM (SELECT l.name FROM station_language r JOIN language l ON l.id = r.language_id WHERE r.station_id = s.id ORDER BY l.id)) AS language,
  (SELECT group_concat(code, ',') FROM (SELECT l.code FROM station_language r JOIN language l ON l.id = r.language_id WHERE r.station_id = s.id ORDER BY l.id)) AS languagecodes`;
const joins = `LEFT JOIN country c ON c.id = s.country_id
  LEFT JOIN station_stream st ON st.id = (
    SELECT st.id FROM station_stream st WHERE st.station_id = s.id
    AND (st.url LIKE 'http://%' OR st.url LIKE 'https://%')
    ORDER BY ${streamOrder} LIMIT 1)`;

/**
 * 将用户文本转换为字面 LIKE 模式，避免通配符改变搜索范围。
 */
function contains(value: string): string {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}
export class StationRepository {
  private readonly db: SqlDatabase;
  /**
   * 注入共同数据库契约，查询只依赖 D1 和 SQLite 支持的 SQL。
   */
  constructor(db: SqlDatabase) {
    this.db = db;
  }
  /**
   * 使用字符串主键读取公开详情；隐藏、不可用和不存在的电台均返回 null。
   */
  findById(id: string) {
    return this.db
      .prepare(`SELECT ${projection} FROM station s ${joins} WHERE ${publicStation} AND s.id = ?`)
      .bind(id)
      .first<StationRow>();
  }
  /**
   * 按关联 ID 精确筛选；关键词覆盖名称、地点、国家、标签与语种，稳定分页。
   */
  async findPage(query: StationQuery) {
    const where = [publicStation];
    const values: SqlValue[] = [];
    if (query.countriesId) {
      where.push('s.country_id = ?');
      values.push(query.countriesId);
    }
    if (query.tagsId) {
      where.push('EXISTS (SELECT 1 FROM station_tag r WHERE r.station_id = s.id AND r.tag_id = ?)');
      values.push(query.tagsId);
    }
    if (query.languagesId) {
      where.push(
        'EXISTS (SELECT 1 FROM station_language r WHERE r.station_id = s.id AND r.language_id = ?)',
      );
      values.push(query.languagesId);
    }
    if (query.keyword) {
      where.push(`(s.name LIKE ? ESCAPE '\\' OR s.place LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\'
        OR EXISTS (SELECT 1 FROM station_tag r JOIN tag t ON t.id = r.tag_id WHERE r.station_id = s.id AND t.name LIKE ? ESCAPE '\\')
        OR EXISTS (SELECT 1 FROM station_language r JOIN language l ON l.id = r.language_id WHERE r.station_id = s.id AND l.name LIKE ? ESCAPE '\\'))`);
      for (let i = 0; i < 5; i++) values.push(contains(query.keyword));
    }
    const { results } = await this.db
      .prepare(
        `SELECT ${projection} FROM station s ${joins}
      WHERE ${where.join(' AND ')} ORDER BY s.votes DESC, s.id ASC LIMIT ? OFFSET ?`,
      )
      .bind(...values, query.pageSize + 1, query.offset)
      .all<StationRow>();
    return results;
  }
  /**
   * 只在详情请求读取全部 HTTP(S) 播放流，排序与列表的默认播放流保持一致。
   */
  async streams(id: string): Promise<StreamRow[]> {
    const { results } = await this.db
      .prepare(
        `SELECT st.* FROM station_stream st WHERE st.station_id = ?
      AND (st.url LIKE 'http://%' OR st.url LIKE 'https://%') ORDER BY ${streamOrder}`,
      )
      .bind(id)
      .all<StreamRow>();
    return results;
  }
  /**
   * 读取网站和社交链接，不将来源身份或处理记录暴露给客户端。
   */
  async links(id: string): Promise<LinkRow[]> {
    const { results } = await this.db
      .prepare('SELECT id, platform, url FROM station_link WHERE station_id = ? ORDER BY id')
      .bind(id)
      .all<LinkRow>();
    return results;
  }
}
