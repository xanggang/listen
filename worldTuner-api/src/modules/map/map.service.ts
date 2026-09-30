import type { MapRepository } from './map.repository.ts';

export class MapService {
  private readonly repository: MapRepository;

  /**
   * 注入点位仓储；地图的分页响应组装与 HTTP 路由和 SQL 分离。
   */
  constructor(repository: MapRepository) {
    this.repository = repository;
  }

  /**
   * 组装轻量点位页；多读的一条不对外返回，无后续页时游标为 null。
   */
  async page(after: string | undefined, limit: number) {
    const rows = await this.repository.findPage(after, limit);
    const list = rows.slice(0, limit);
    return { list, nextCursor: rows.length > limit ? list[list.length - 1].id : null };
  }
}
