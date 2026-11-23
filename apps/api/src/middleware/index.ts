import type { ErrorRequestHandler, Request, RequestHandler } from 'express';
import multer from 'multer';
import type { UserRef } from '@ajaia/shared';
import type { Env } from '../config/env';
import { verifyToken } from '../lib/auth';
import { AppError, Errors } from '../lib/errors';
import type { Logger } from '../lib/logger';

export function requireAuth(env: Env): RequestHandler {
  return (req, _res, next) => {
    const [scheme, token] = (req.get('authorization') ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw Errors.unauthorized();
    req.user = verifyToken(token, env.JWT_SECRET);
    next();
  };
}

export function currentUser(req: Request): UserRef {
  if (!req.user) throw Errors.unauthorized();
  return req.user;
}

export function requestLogger(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const start = performance.now();
    res.on('finish', () => {
      const status = res.statusCode;
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      logger[level](
        {
          method: req.method,
          path: req.originalUrl,
          status,
          ms: Math.round(performance.now() - start),
          userId: req.user?.id,
        },
        'request',
      );
    });
    next();
  };
}

export const notFoundHandler: RequestHandler = (req) => {
  throw new AppError(404, 'NOT_FOUND', `No API route for ${req.method} ${req.path}`);
};

export function errorHandler(logger: Logger, maxUploadMb: number): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const send = (status: number, code: string, message: string, details?: unknown) => {
      res.status(status).json({ error: { code, message, ...(details !== undefined ? { details } : {}) } });
    };

    if (err instanceof AppError) return send(err.status, err.code, err.message, err.details);

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return send(413, 'FILE_TOO_LARGE', `That file is too large. The limit is ${maxUploadMb} MB.`);
      }
      return send(400, 'VALIDATION_ERROR', 'Upload exactly one file in the "file" field');
    }

    if (err?.type === 'entity.too.large') {
      return send(413, 'PAYLOAD_TOO_LARGE', 'This document is too large to save (limit 1 MB).');
    }
    if (err?.type === 'entity.parse.failed') {
      return send(400, 'VALIDATION_ERROR', 'Request body is not valid JSON');
    }

    logger.error({ err, method: req.method, path: req.originalUrl }, 'unhandled error');
    return send(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
  };
}
