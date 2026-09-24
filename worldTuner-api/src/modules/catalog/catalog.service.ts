import { ApiError } from '../../shared/errors.ts';
import type { CatalogRepository } from './catalog.repository.ts';
import type { CatalogKind } from './catalog.types.ts';
export class CatalogService {
  private repository: CatalogRepository;
  /** 注入字典数据访问依赖，便于独立测试业务规则。 */
  constructor(repository: CatalogRepository) {
    this.repository = repository;
  }
  /** 返回指定类型的字典列表，沿用 repository 的稳定排序。 */
  list(kind: CatalogKind, limit: number) {
    return this.repository.list(kind, limit);
  }
  /** 解析可选筛选 id；不存在或名称为空时拒绝请求，避免意外返回全量列表。 */
  async resolveName(kind: CatalogKind, id?: number): Promise<string | undefined> {
    if (id === undefined) return undefined;
    const row = await this.repository.findName(kind, id);
    if (!row?.name) throw new ApiError(400, 'INVALID_FILTER', `Unknown ${kind} id`);
    return row.name;
  }
}
