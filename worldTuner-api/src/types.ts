import type { createServices } from './services.ts';
import type { SqlDatabase } from './database/database.ts';
export interface ApiBindings {
  DB: SqlDatabase;
  METRICS_DB?: SqlDatabase;
  CACHE_ENABLED?: string;
  MAP_SNAPSHOT_CACHE_TTL_SECONDS?: string;
  ALLOWED_ORIGINS: string;
  READ_LIMITER: Pick<RateLimit, 'limit'>;
  SEARCH_LIMITER: Pick<RateLimit, 'limit'>;
  METRICS_LIMITER: Pick<RateLimit, 'limit'>;
}
export type AppEnv = {
  Bindings: ApiBindings;
  Variables: { requestId: string; services: ReturnType<typeof createServices> };
};
