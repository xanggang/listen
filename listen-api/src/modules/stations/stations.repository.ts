import type { StationRow } from './stations.types.ts';
import type { StationQuery } from './stations.schema.ts';

export interface StationFilters {
  language?: string;
  tag?: string;
}
/** 构造字面子串匹配模式，转义反斜线、百分号和下划线等 LIKE 元字符。 */
function contains(value: string) {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}

export class StationRepository {
  private db: D1Database;
  /** 注入 D1 数据源，将 SQL 实现与业务编排分离。 */
  constructor(db: D1Database) {
    this.db = db;
  }

  /** 按旧版数值 id 查询单个电台，不存在时返回 null。 */
  findById(id: number) {
    return this.db.prepare('SELECT * FROM station WHERE id = ?').bind(id).first<StationRow>();
  }

  /** 组合参数化过滤条件，以稳定排序多读取一条记录供服务层判断下一页。 */
  async findPage(query: StationQuery, filters: StationFilters) {
    const where: string[] = [];
    const values: (string | number)[] = [];
    for (const [column, value] of [
      ['language', filters.language],
      ['tags', filters.tag],
    ] as const) {
      if (value !== undefined) {
        where.push(`${column} LIKE ? ESCAPE '\\'`);
        values.push(contains(value));
      }
    }
    if (query.keyword) {
      where.push(
        "(name LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\' OR language LIKE ? ESCAPE '\\')",
      );
      values.push(...Array(3).fill(contains(query.keyword)));
    }
    const { results } = await this.db
      .prepare(
        `SELECT * FROM station ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY votes DESC, id ASC LIMIT ? OFFSET ?`,
      )
      .bind(...values, query.pageSize + 1, query.offset)
      .all<StationRow>();
    return results;
  }
}
