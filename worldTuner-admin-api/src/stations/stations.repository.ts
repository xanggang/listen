import type { SqlDatabase, SqlValue } from '../database/database.ts';
import type { AuditEvent } from '../types.ts';
import { auditedChange } from '../audit/audit.repository.ts';
import { searchPattern } from '../shared/input.ts';
import type {
  parseAdminStationQuery,
  parseStationEdit,
  parseStreamEdit,
} from './stations.schema.ts';

export interface AdminStation {
  id: string;
  name: string;
  place: string | null;
  countryId: string | null;
  country: string | null;
  website: string | null;
  favicon: string | null;
  latitude: number | null;
  longitude: number | null;
  visibility: 'visible' | 'hidden';
  status: string;
  source: string;
  updatedAt: string;
}
export interface AdminStream {
  id: string;
  url: string;
  resolvedUrl: string | null;
  codec: string | null;
  bitrate: number | null;
  isHls: number | null;
  isPrimary: number;
}
const projection = `s.public_id AS id,s.name,s.place,s.country_id AS countryId,COALESCE(c.name_zh,c.name_en,c.name) AS country,s.website,s.favicon,s.latitude,s.longitude,s.visibility_status AS visibility,s.catalog_status AS status,s.source_type AS source,s.updated_at AS updatedAt`;

export class ManagementStationRepository {
  private readonly db: SqlDatabase;
  /**
   * 注入管理业务库，所有写入在本仓储实现乐观锁及审计 outbox。
   */
  constructor(db: SqlDatabase) {
    this.db = db;
  }

  /**
   * 查询包含下架/失效站点的有界列表；关联筛选使用 EXISTS，避免重复电台。
   */
  async list(query: ReturnType<typeof parseAdminStationQuery>) {
    const where = ['s.public_id IS NOT NULL'];
    const values: SqlValue[] = [];
    if (query.q) {
      where.push("(s.name LIKE ? ESCAPE '\\' OR s.public_id=?)");
      values.push(searchPattern(query.q), query.q);
    }
    for (const [key, column] of [
      ['countryId', 's.country_id'],
      ['visibility', 's.visibility_status'],
      ['status', 's.catalog_status'],
    ] as const) {
      if (query[key]) {
        where.push(`${column}=?`);
        values.push(query[key]);
      }
    }
    for (const [key, table, column] of [
      ['languageId', 'station_language', 'language_id'],
      ['tagId', 'station_tag', 'tag_id'],
    ] as const) {
      if (query[key]) {
        where.push(
          `EXISTS(SELECT 1 FROM ${table} rel WHERE rel.station_id=s.id AND rel.${column}=?)`,
        );
        values.push(query[key]);
      }
    }
    const clause = where.join(' AND ');
    const [list, count] = await Promise.all([
      this.db
        .prepare(
          `SELECT ${projection} FROM station s LEFT JOIN country c ON c.id=s.country_id WHERE ${clause} ORDER BY s.public_id COLLATE BINARY LIMIT ? OFFSET ?`,
        )
        .bind(...values, query.pageSize, query.offset)
        .all<AdminStation>(),
      this.db
        .prepare(`SELECT COUNT(*) AS total FROM station s WHERE ${clause}`)
        .bind(...values)
        .first<{ total: number }>(),
    ]);
    return {
      list: list.results,
      total: count?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /**
   * 按公开 ID 返回管理详情及关联流；不暴露电台内部主键。
   */
  async detail(id: string) {
    const station = await this.db
      .prepare(
        `SELECT ${projection} FROM station s LEFT JOIN country c ON c.id=s.country_id WHERE s.public_id COLLATE BINARY=?`,
      )
      .bind(id)
      .first<AdminStation>();
    if (!station) return null;
    const { results } = await this.db
      .prepare(
        `SELECT id,url,resolved_url AS resolvedUrl,codec,bitrate,is_hls AS isHls,is_primary AS isPrimary FROM station_stream WHERE station_id=(SELECT id FROM station WHERE public_id COLLATE BINARY=?) ORDER BY is_primary DESC,id`,
      )
      .bind(id)
      .all<AdminStream>();
    return { ...station, streams: results };
  }

  /**
   * 国家 ID 必须存在于业务字典，提前返回输入错误而非触发外键异常。
   */
  async hasCountry(id: string): Promise<boolean> {
    return Boolean(await this.db.prepare('SELECT id FROM country WHERE id=?').bind(id).first());
  }

  /**
   * 版本匹配时保存基本字段；审计与修改原子提交，外键约束阻止无效国家。
   */
  async edit(
    id: string,
    input: ReturnType<typeof parseStationEdit>,
    updatedAt: string,
    event: AuditEvent,
  ) {
    await auditedChange(
      this.db,
      this.db
        .prepare(
          `UPDATE station SET name=?,catalog_status=?,place=?,country_id=?,website=?,favicon=?,latitude=?,longitude=?,updated_at=? WHERE public_id COLLATE BINARY=? AND updated_at=?`,
        )
        .bind(
          input.name,
          input.status,
          input.place,
          input.countryId,
          input.website,
          input.favicon,
          input.latitude,
          input.longitude,
          updatedAt,
          id,
          input.expectedUpdatedAt,
        ),
      event,
    );
  }

  /**
   * 上下架要求匹配最新版本；不硬删除电台与关联数据。
   */
  async visibility(
    id: string,
    expected: string,
    visibility: string,
    updatedAt: string,
    event: AuditEvent,
  ) {
    await auditedChange(
      this.db,
      this.db
        .prepare(
          'UPDATE station SET visibility_status=?,updated_at=? WHERE public_id COLLATE BINARY=? AND updated_at=?',
        )
        .bind(visibility, updatedAt, id, expected),
      event,
    );
  }

  /**
   * 先锁定站点版本与流所属关系，再在同批事务更新播放流，不改变 primary 标志。
   */
  async stream(
    id: string,
    streamId: string,
    input: ReturnType<typeof parseStreamEdit>,
    updatedAt: string,
    event: AuditEvent,
  ) {
    await auditedChange(
      this.db,
      this.db
        .prepare(
          'UPDATE station SET updated_at=? WHERE public_id COLLATE BINARY=? AND updated_at=? AND EXISTS(SELECT 1 FROM station_stream WHERE id=? AND station_id=station.id)',
        )
        .bind(updatedAt, id, input.expectedUpdatedAt, streamId),
      event,
      [
        this.db
          .prepare(
            'UPDATE station_stream SET url=?,resolved_url=?,codec=?,bitrate=?,is_hls=? WHERE id=? AND EXISTS(SELECT 1 FROM admin_outbox WHERE id=?)',
          )
          .bind(
            input.url,
            input.resolvedUrl,
            input.codec,
            input.bitrate,
            input.isHls ? 1 : 0,
            streamId,
            event.id,
          ),
      ],
    );
  }
}
