import { ApiError } from '../../shared/errors.ts';
import type { CatalogService } from '../catalog/catalog.service.ts';
import type { StationRepository } from './stations.repository.ts';
import type { StationQuery } from './stations.schema.ts';
import { stationDto } from './stations.dto.ts';

export class StationService {
  private repository: StationRepository;
  private catalog: CatalogService;
  /** 注入电台 repository 和分类服务，业务层不依赖路由框架。 */
  constructor(repository: StationRepository, catalog: CatalogService) {
    this.repository = repository;
    this.catalog = catalog;
  }
  /** 读取并映射电台详情，不存在时返回明确的业务异常。 */
  async detail(id: number) {
    const row = await this.repository.findById(id);
    if (!row) throw new ApiError(404, 'STATION_NOT_FOUND', 'Station not found');
    return stationDto(row);
  }
  /** 解析分类筛选并组装分页 DTO，通过额外一条记录确定 hasMore。 */
  async list(query: StationQuery) {
    const language = await this.catalog.resolveName('languages', query.languagesId);
    const tag = await this.catalog.resolveName('tags', query.tagsId);
    const rows = await this.repository.findPage(query, { language, tag });
    const hasMore = rows.length > query.pageSize;
    return {
      list: rows.slice(0, query.pageSize).map(stationDto),
      page: query.page,
      pageSize: query.pageSize,
      hasMore,
      nextPage: hasMore ? query.page + 1 : null,
    };
  }
}
