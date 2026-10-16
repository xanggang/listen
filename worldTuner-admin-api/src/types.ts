import type { SqlDatabase } from './database/database.ts';

export interface AdminActor {
  id: string;
  email: string;
  role: 'owner' | 'viewer';
}
export interface AdminBindings {
  DB: SqlDatabase;
  METRICS_DB: SqlDatabase;
  ASSETS?: Fetcher;
  ADMIN_LIMITER?: Pick<RateLimit, 'limit'>;
  DEPLOYMENT_ENV: 'local' | 'production';
  ADMIN_ORIGIN: string;
  ACCESS_ISSUER?: string;
  ACCESS_AUDIENCE?: string;
  CSRF_SECRET?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
}
export type AdminEnv = {
  Bindings: AdminBindings;
  Variables: { requestId: string; actor: AdminActor; credential: string };
};
export interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  changedFields: string;
  requestId: string;
  createdAt: string;
}
