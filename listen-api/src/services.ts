import { CatalogRepository } from './modules/catalog/catalog.repository.ts';
import { CatalogService } from './modules/catalog/catalog.service.ts';
import { StationRepository } from './modules/stations/stations.repository.ts';
import { StationService } from './modules/stations/stations.service.ts';

// Request-scoped dependency assembly. Services do not depend on HTTP or Hono.
/** 组装请求级依赖；集中管理 repository/service 的构造关系。 */
export function createServices(db: D1Database) {
  const catalog = new CatalogService(new CatalogRepository(db));
  return { catalog, stations: new StationService(new StationRepository(db), catalog) };
}
