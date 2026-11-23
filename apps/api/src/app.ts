import cors from 'cors';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import type { AppContext } from './context';
import { errorHandler, notFoundHandler, requestLogger, requireAuth } from './middleware';
import { authRouter } from './modules/auth/auth.routes';
import { documentsRouter } from './modules/documents/documents.routes';
import { importRouter } from './modules/import/import.routes';
import { sharingRouter } from './modules/sharing/sharing.routes';

export const API_VERSION = '1.0.0';

export function createApp(ctx: AppContext): Express {
  const { env, logger } = ctx;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render terminates TLS at a proxy; needed for correct client IPs (rate limiting).

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || env.corsOrigins.includes(origin)),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'test') app.use(requestLogger(logger));

  app.get('/', (_req, res) => {
    res.json({ name: 'Ajaia Docs API', version: API_VERSION, health: '/api/health' });
  });

  app.get('/api/health', async (_req, res) => {
    try {
      await ctx.ping();
      res.json({ status: 'ok', db: 'ok', version: API_VERSION });
    } catch (err) {
      logger.error({ err }, 'health check failed');
      res.status(503).json({ status: 'degraded', db: 'unreachable', version: API_VERSION });
    }
  });

  app.use('/api/auth', authRouter(ctx));

  const docs = Router();
  docs.use(requireAuth(env));
  docs.use(importRouter(ctx));
  docs.use(documentsRouter(ctx));
  docs.use(sharingRouter(ctx));
  app.use('/api/documents', docs);

  app.use('/api', notFoundHandler);
  app.use(errorHandler(logger, env.MAX_UPLOAD_MB));
  return app;
}
