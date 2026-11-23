import { createApp } from './app';
import { loadEnv } from './config/env';
import { createDb } from './db/client';
import { seedDemoData } from './db/seed';
import { createLogger } from './lib/logger';

async function main() {
  const env = loadEnv();
  const logger = createLogger(env);

  const handle = await createDb({
    databaseUrl: env.DATABASE_URL || undefined,
    pgliteDataDir: env.PGLITE_DATA_DIR,
    logger,
  });
  logger.info({ driver: handle.driver }, 'database ready');

  // Render free instances have no pre-deploy hook: migrations + seed are idempotent and run at boot.
  await handle.migrate();
  logger.info('migrations applied');
  if (env.SEED_DEMO_DATA) {
    await seedDemoData(handle.db, { password: env.DEMO_PASSWORD, bcryptRounds: env.BCRYPT_ROUNDS, logger });
  }

  const app = createApp({ db: handle.db, env, logger, ping: handle.ping });
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      handle.close().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
