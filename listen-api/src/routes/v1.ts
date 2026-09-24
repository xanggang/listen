import { Hono } from 'hono';
import type { AppEnv } from '../types.ts';
import { stationRoutes } from '../modules/stations/stations.routes.ts';
import { languagesRoutes } from '../modules/catalog/languages.routes.ts';
import { tagsRoutes } from '../modules/catalog/tags.routes.ts';
import { countriesRoutes } from '../modules/catalog/countries.routes.ts';
import { healthRoutes } from '../modules/health/health.routes.ts';

export const v1 = new Hono<AppEnv>();
v1.route('/health', healthRoutes);
v1.route('/stations', stationRoutes);
v1.route('/languages', languagesRoutes);
v1.route('/tags', tagsRoutes);
v1.route('/countries', countriesRoutes);
