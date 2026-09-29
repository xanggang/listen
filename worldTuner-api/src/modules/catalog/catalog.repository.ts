import type { CatalogItem, CatalogKind } from './catalog.types.ts';
// SQL identifiers come exclusively from this fixed map, never request input.
const tables: Record<CatalogKind, string> = {
  languages: 'languages',
  tags: 'tags',
  countries: 'countries',
};
export class CatalogRepository {
  private db: D1Database;
  /** 注入当前请求使用的 D1 连接，不保留 HTTP 上下文。 */
  constructor(db: D1Database) {
    this.db = db;
  }
  /** 按电台数量及 id 稳定排序读取字典，表名仅来自固定映射。 */
  async list(kind: CatalogKind, limit: number) {
    const { results } = await this.db
      .prepare(`SELECT * FROM ${tables[kind]} ORDER BY stationcount DESC, id ASC LIMIT ?`)
      .bind(limit)
      .all<CatalogItem>();
    return results;
  }
  /**
   * 按标签名称搜索并分页，LIKE 通配符按字面匹配，排序与字典列表一致。
   */
  async searchTags(query: string, limit: number, offset: number) {
    const escaped = query.replace(/[\\%_]/g, '\\$&');
    const { results } = await this.db
      .prepare(
        "SELECT * FROM tags WHERE (? = '' OR name LIKE ? ESCAPE '\\') ORDER BY stationcount DESC, id ASC LIMIT ? OFFSET ?",
      )
      .bind(query, `%${escaped}%`, limit, offset)
      .all<CatalogItem>();
    return results;
  }
  /** 按字典主键读取名称，用于把筛选 id 转换为现有存储格式。 */
  findName(kind: CatalogKind, id: number) {
    return this.db
      .prepare(`SELECT name FROM ${tables[kind]} WHERE id = ?`)
      .bind(id)
      .first<{ name: string | null }>();
  }
}
