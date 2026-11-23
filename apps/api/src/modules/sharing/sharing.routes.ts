import { Router } from 'express';
import { IdParamSchema, ShareParamSchema, ShareRequestSchema } from '@ajaia/shared';
import type { AppContext } from '../../context';
import { parse } from '../../lib/errors';
import { currentUser } from '../../middleware';
import { listShares, removeShare, upsertShare } from './sharing.service';

export function sharingRouter({ db }: AppContext): Router {
  const router = Router();

  router.get('/:id/shares', async (req, res) => {
    const { id } = parse(IdParamSchema, req.params);
    res.json(await listShares(db, id, currentUser(req).id));
  });

  router.put('/:id/shares', async (req, res) => {
    const { id } = parse(IdParamSchema, req.params);
    const input = parse(ShareRequestSchema, req.body);
    res.json({ share: await upsertShare(db, id, currentUser(req).id, input) });
  });

  router.delete('/:id/shares/:userId', async (req, res) => {
    const { id, userId } = parse(ShareParamSchema, req.params);
    await removeShare(db, id, currentUser(req).id, userId);
    res.status(204).end();
  });

  return router;
}
