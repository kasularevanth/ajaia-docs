import { z } from 'zod';
import { DEFAULT_MAX_UPLOAD_MB, DEMO_PASSWORD } from '@ajaia/shared';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    /** Empty → embedded PGlite (local dev). Set → node-postgres (Neon in production). */
    DATABASE_URL: z.string().trim().default(''),
    PGLITE_DATA_DIR: z.string().default('.data/pglite'),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(DEFAULT_MAX_UPLOAD_MB),
    SEED_DEMO_DATA: booleanString.default(true),
    DEMO_PASSWORD: z.string().min(6).default(DEMO_PASSWORD),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(14).default(10),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.DATABASE_URL.length > 0, {
    message: 'DATABASE_URL is required in production',
    path: ['DATABASE_URL'],
  });

export type Env = z.output<typeof EnvSchema> & { corsOrigins: string[] };

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.') || 'env'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return {
    ...result.data,
    corsOrigins: result.data.CORS_ORIGINS.split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean),
  };
}

/** Loads `.env` (if present, for local dev) and validates process.env. Fails fast with a readable message. */
export function loadEnv(): Env {
  try {
    process.loadEnvFile('.env');
  } catch {
    // No .env file — expected on Render, where variables come from the dashboard / render.yaml.
  }
  return parseEnv(process.env);
}
