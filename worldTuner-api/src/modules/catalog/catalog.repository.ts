import type { SqlDatabase } from '../../database/database.ts';
import type { CatalogKind, CatalogItem } from './catalog.types.ts';
import { publicStation } from '../../database/catalog-policy.ts';

// 固定映射限定表名和关系字段；外部输入永远不作为 SQL 标识符。
const tables = { languages: 'language', tags: 'tag', countries: 'country' } as const;
const relations = {
  languages: ['station_language', 'language_id'],
  tags: ['station_tag', 'tag_id'],
} as const;

/**
 * 按公开电台关联统计分类数量，过滤零关联分类，国家和语种使用 code 字段。
 */
function catalogSql(kind: CatalogKind): string {
  const table = tables[kind];
  const code = kind === 'tags' ? '' : ', x.code';
  const join =
    kind === 'countries'
      ? 'JOIN station s ON s.country_id = x.id'
      : `JOIN ${relations[kind][0]} r ON r.${relations[kind][1]} = x.id JOIN station s ON s.id = r.station_id`;
  return `SELECT x.id, x.name${code}, COUNT(*) AS stationcount FROM ${table} x ${join} WHERE ${publicStation}`;
}
export class CatalogRepository {
  private readonly db: SqlDatabase;
  /**
   * 注入统一连接；分类业务不依赖 Worker 或 Node 的运行环境。
   */
  constructor(db: SqlDatabase) {
    this.db = db;
  }

  /**
   * 返回按公开关联数量排序的分类，不依赖来源库预计算的 stationcount。
   */
  async list(kind: CatalogKind, limit: number): Promise<CatalogItem[]> {
    const { results } = await this.db
      .prepare(`${catalogSql(kind)} GROUP BY x.id ORDER BY stationcount DESC, x.id ASC LIMIT ?`)
      .bind(limit)
      .all<CatalogItem>();
    return results;
  }
  /**
   * 使用字面名称匹配分页检索标签，分类数量与电台可见性采用相同口径。
   */
  async searchTags(query: string, limit: number, offset: number): Promise<CatalogItem[]> {
    const escaped = query.replace(/[\\%_]/g, '\\$&');
    const { results } = await this.db
      .prepare(
        `${catalogSql('tags')} AND (? = '' OR x.name LIKE ? ESCAPE '\\') GROUP BY x.id ORDER BY stationcount DESC, x.id ASC LIMIT ? OFFSET ?`,
      )
      .bind(query, `%${escaped}%`, limit, offset)
      .all<CatalogItem>();
    return results;
  }
  /**
   * 按实体 ID 校验分类存在性，业务层不再依赖名称做模糊关联。
   */
  findName(kind: CatalogKind, id: string) {
    return this.db
      .prepare(`SELECT name FROM ${tables[kind]} WHERE id = ?`)
      .bind(id)
      .first<{ name: string | null }>();
  }
}
