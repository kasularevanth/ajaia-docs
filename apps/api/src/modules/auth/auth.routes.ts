import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { LoginSchema } from '@ajaia/shared';
import type { AppContext } from '../../context';
import { parse } from '../../lib/errors';
import { currentUser, requireAuth } from '../../middleware';
import { getUser, login } from './auth.service';

export function authRouter(ctx: AppContext): Router {
  const router = Router();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => ctx.env.NODE_ENV === 'test',
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Please wait a few minutes.' },
      });
    },
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const input = parse(LoginSchema, req.body);
    res.json(await login(ctx, input));
  });

  router.get('/me', requireAuth(ctx.env), async (req, res) => {
    res.json({ user: await getUser(ctx, currentUser(req).id) });
  });

  return router;
}
