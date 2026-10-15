import { ApiError } from '../../shared/errors.ts';
import type { AdminRepository } from './admin.repository.ts';
import type { StationVisibility } from './admin.types.ts';

export class AdminService {
  private readonly repository: AdminRepository;
  /**
   * 注入管理仓储，业务层不依赖 Hono、Worker 或 Node 运行环境。
   */
  constructor(repository: AdminRepository) {
    this.repository = repository;
  }

  /**
   * 上下架已有电台，更新时间使用服务端 UTC 秒；不存在返回与 Java 一致的 404。
   * 缓存按既有 TTL 到期刷新，不将管理响应写入公开缓存。
   */
  async setVisibility(id: string, visibility: StationVisibility) {
    const updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    if (!(await this.repository.setVisibility(id, visibility, updatedAt))) {
      throw new ApiError(404, 'STATION_NOT_FOUND', 'Station not found');
    }
    return { id, visibility };
  }
}
