import { requireMetricsDatabase } from './database/metrics-database.ts';
import type { SqlDatabase } from './database/database.ts';
import { CatalogRepository } from './modules/catalog/catalog.repository.ts';
import { CatalogService } from './modules/catalog/catalog.service.ts';
import { StationRepository } from './modules/stations/stations.repository.ts';
import { StationService } from './modules/stations/stations.service.ts';
import { MapService } from './modules/map/map.service.ts';
import { MapRepository } from './modules/map/map.repository.ts';
import { MetricsRepository } from './modules/metrics/metrics.repository.ts';
import { MetricsService } from './modules/metrics/metrics.service.ts';

/**
 * 只组装客户端业务服务；统计在使用时校验独立数据库，不隐式写入目录库。
 */
export function createServices(db: SqlDatabase, metricsDb?: SqlDatabase) {
  const catalog = new CatalogService(new CatalogRepository(db));
  return {
    catalog,
    map: new MapService(new MapRepository(db)),
    stations: new StationService(new StationRepository(db), catalog),
    /**
     * 延迟创建统计服务；缺配置时仅统计上报失败，业务读取仍然可用。
     */
    get metrics(): MetricsService {
      const database = requireMetricsDatabase({ DB: db, METRICS_DB: metricsDb });
      return new MetricsService(new MetricsRepository(database));
    },
  };
}
