import type { Env } from './config/env';
import type { Database } from './db/client';
import type { Logger } from './lib/logger';

/** Dependencies injected into the Express app (real ones in server.ts, in-memory ones in tests). */
export interface AppContext {
  db: Database;
  env: Env;
  logger: Logger;
  ping: () => Promise<void>;
}
