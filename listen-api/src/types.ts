import type { createServices } from './services.ts';
export type AppEnv = {
  Bindings: Env;
  Variables: { requestId: string; services: ReturnType<typeof createServices> };
};
