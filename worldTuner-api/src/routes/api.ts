import { mapRoutes } from '../modules/map/map.routes.ts';
import { Hono } from 'hono';
import type { AppEnv } from '../types.ts';
import { stationRoutes } from '../modules/stations/stations.routes.ts';
import { languagesRoutes } from '../modules/catalog/languages.routes.ts';
import { tagsRoutes } from '../modules/catalog/tags.routes.ts';
import { countriesRoutes } from '../modules/catalog/countries.routes.ts';
import { healthRoutes } from '../modules/health/health.routes.ts';
import { metricsRoutes } from '../modules/metrics/metrics.routes.ts';

export const apiRoutes = new Hono<AppEnv>();
apiRoutes.route('/health', healthRoutes);
apiRoutes.route('/stations', stationRoutes);
apiRoutes.route('/languages', languagesRoutes);
apiRoutes.route('/tags', tagsRoutes);
apiRoutes.route('/countries', countriesRoutes);
apiRoutes.route('/metrics', metricsRoutes);

apiRoutes.route('/map', mapRoutes);
