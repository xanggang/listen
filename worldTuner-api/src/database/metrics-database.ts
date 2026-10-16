import type { SqlDatabase } from './database.ts';
import type { ApiBindings } from '../types.ts';
import { ApiError } from '../shared/errors.ts';

/**
 * 要求显式绑定独立统计库；仅统计请求/定时任务调用，配置缺失不影响电台读取。
 */
export function requireMetricsDatabase(env: Pick<ApiBindings, 'DB' | 'METRICS_DB'>): SqlDatabase {
  if (!env.METRICS_DB || env.METRICS_DB === env.DB) {
    throw new ApiError(503, 'METRICS_UNAVAILABLE', 'Metrics database is not configured separately');
  }
  return env.METRICS_DB;
}
