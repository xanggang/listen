import { ApiError } from '../../shared/errors.ts';
import type { CatalogRepository } from './catalog.repository.ts';
import type { CatalogKind } from './catalog.types.ts';
export class CatalogService {
  private repository: CatalogRepository;
  /**
   * 注入字典数据访问依赖，便于独立测试业务规则。
   */
  constructor(repository: CatalogRepository) {
    this.repository = repository;
  }
  /**
   * 返回指定类型的字典列表，沿用 repository 的稳定排序。
   */
  list(kind: CatalogKind, limit: number) {
    return this.repository.list(kind, limit);
  }
  /**
   * 分页搜索标签，空关键词也沿用相同的热度排序。
   */
  searchTags(query: string, limit: number, offset: number) {
    return this.repository.searchTags(query, limit, offset);
  }
  /**
   * 验证可选分类 ID；未知 ID 返回 400，防止误返回全量电台。
   */
  async validateId(kind: CatalogKind, id?: string): Promise<void> {
    if (id === undefined) return;
    if (!(await this.repository.findName(kind, id)))
      throw new ApiError(400, 'INVALID_FILTER', `Unknown ${kind} id`);
  }
}
