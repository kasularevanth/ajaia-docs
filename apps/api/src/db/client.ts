import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '../lib/logger';
import * as schema from './schema';

/** Both drivers expose the same Drizzle query-builder API; we type against node-postgres. */
export type Database = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: Database;
  driver: 'pg' | 'pglite';
  migrate: () => Promise<void>;
  ping: () => Promise<void>;
  close: () => Promise<void>;
}

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'drizzle');

interface DbOptions {
  databaseUrl?: string;
  /** Directory for PGlite data, or `memory://` for an ephemeral in-memory database (tests). */
  pgliteDataDir?: string;
  logger?: Logger;
}

export async function createDb({ databaseUrl, pgliteDataDir, logger }: DbOptions): Promise<DbHandle> {
  if (databaseUrl) {
    const { Pool } = (await import('pg')).default;
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
    });
    // Neon closes idle connections; don't let that crash the process.
    pool.on('error', (err) => logger?.warn({ err }, 'postgres pool error'));
    const db = drizzle(pool, { schema });
    return {
      db,
      driver: 'pg',
      migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_DIR }),
      ping: async () => {
        await db.execute(sql`select 1`);
      },
      close: () => pool.end(),
    };
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const dataDir = pgliteDataDir ?? 'memory://';
  if (!dataDir.startsWith('memory://')) mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const pgliteDb = drizzle(client, { schema });
  return {
    db: pgliteDb as unknown as Database,
    driver: 'pglite',
    migrate: () => migrate(pgliteDb, { migrationsFolder: MIGRATIONS_DIR }),
    ping: async () => {
      await pgliteDb.execute(sql`select 1`);
    },
    close: () => client.close(),
  };
}
