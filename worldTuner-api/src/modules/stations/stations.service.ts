import { ApiError } from '../../shared/errors.ts';
import type { CatalogService } from '../catalog/catalog.service.ts';
import type { StationRepository } from './stations.repository.ts';
import type { StationQuery } from './stations.schema.ts';
import { stationDto, streamDto } from './stations.dto.ts';

export class StationService {
  private readonly repository: StationRepository;
  private readonly catalog: CatalogService;
  /**
   * 注入电台和分类依赖；所有运行环境共用相同业务规则。
   */
  constructor(repository: StationRepository, catalog: CatalogService) {
    this.repository = repository;
    this.catalog = catalog;
  }
  /**
   * 只返回公开电台；播放流和链接仅在详情请求时加载。
   */
  async detail(id: string) {
    const row = await this.repository.findById(id);
    if (!row) throw new ApiError(404, 'STATION_NOT_FOUND', 'Station not found');
    const [streams, links] = await Promise.all([
      this.repository.streams(id),
      this.repository.links(id),
    ]);
    return { ...stationDto(row), streams: streams.map(streamDto), links };
  }
  /**
   * 校验关联分类后进行精确筛选；多读一条记录判断是否有下一页。
   */
  async list(query: StationQuery) {
    await Promise.all([
      this.catalog.validateId('languages', query.languagesId),
      this.catalog.validateId('tags', query.tagsId),
      this.catalog.validateId('countries', query.countriesId),
    ]);
    const rows = await this.repository.findPage(query);
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
