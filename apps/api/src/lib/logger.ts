import pino, { type Logger } from 'pino';
import type { Env } from '../config/env';

export type { Logger };

export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>): Logger {
  const pretty = env.NODE_ENV === 'development';
  return pino({
    level: env.LOG_LEVEL,
    redact: ['req.headers.authorization', 'password', '*.password', 'token'],
    ...(pretty
      ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }
      : {}),
  });
}
