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
 * 组装统一业务服务；SQLite 可单独注入统计库，D1 默认使用同一绑定。
 */
export function createServices(db: SqlDatabase, metricsDb: SqlDatabase = db) {
  const catalog = new CatalogService(new CatalogRepository(db));
  return {
    catalog,
    map: new MapService(new MapRepository(db)),
    stations: new StationService(new StationRepository(db), catalog),
    metrics: new MetricsService(new MetricsRepository(metricsDb)),
  };
}
