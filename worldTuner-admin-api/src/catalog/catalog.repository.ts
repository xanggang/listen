import type { SqlDatabase } from '../database/database.ts';
import type { AuditEvent } from '../types.ts';
import { auditedChange } from '../audit/audit.repository.ts';
import { searchPattern } from '../shared/input.ts';

export const catalogTables = { countries: 'country', languages: 'language', tags: 'tag' } as const;
export type CatalogKind = keyof typeof catalogTables;
export interface AdminCatalogItem {
  id: string;
  name: string;
  nameEn: string | null;
  nameZh: string | null;
  code: string | null;
}
export class ManagementCatalogRepository {
  private readonly db: SqlDatabase;
  /**
   * 目录表名仅来自固定映射，用户输入不能作为 SQL 标识符。
   */
  constructor(db: SqlDatabase) {
    this.db = db;
  }
  /**
   * 按原名、中文、英文分页查找全部分类，包含尚无可播放电台的分类。
   */
  async list(kind: CatalogKind, q: string, limit: number, offset: number) {
    const table = catalogTables[kind];
    const code = kind === 'tags' ? 'NULL' : 'code';
    const pattern = searchPattern(q);
    const where =
      "name LIKE ? ESCAPE '\\' OR name_en LIKE ? ESCAPE '\\' OR name_zh LIKE ? ESCAPE '\\'";
    const [list, count] = await Promise.all([
      this.db
        .prepare(
          `SELECT id,name,name_en AS nameEn,name_zh AS nameZh,${code} AS code FROM ${table} WHERE ${where} ORDER BY name,id LIMIT ? OFFSET ?`,
        )
        .bind(pattern, pattern, pattern, limit, offset)
        .all<AdminCatalogItem>(),
      this.db
        .prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE ${where}`)
        .bind(pattern, pattern, pattern)
        .first<{ total: number }>(),
    ]);
    return { list: list.results, total: count?.total ?? 0 };
  }
  /**
   * 只校订展示名，以旧展示名作为乐观锁；保留原名、代码、ID 和全部关联。
   */
  async edit(
    kind: CatalogKind,
    id: string,
    input: {
      nameEn: string | null;
      nameZh: string | null;
      expectedNameEn: string | null;
      expectedNameZh: string | null;
    },
    event: AuditEvent,
  ) {
    await auditedChange(
      this.db,
      this.db
        .prepare(
          `UPDATE ${catalogTables[kind]} SET name_en=?,name_zh=? WHERE id=? AND name_en IS ? AND name_zh IS ?`,
        )
        .bind(input.nameEn, input.nameZh, id, input.expectedNameEn, input.expectedNameZh),
      event,
    );
    return this.db
      .prepare(
        `SELECT id,name,name_en AS nameEn,name_zh AS nameZh,${kind === 'tags' ? 'NULL' : 'code'} AS code FROM ${catalogTables[kind]} WHERE id=?`,
      )
      .bind(id)
      .first<AdminCatalogItem>();
  }
}
