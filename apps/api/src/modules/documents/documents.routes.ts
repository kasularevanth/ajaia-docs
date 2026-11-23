import { Router } from 'express';
import {
  CreateDocumentSchema,
  IdParamSchema,
  ListDocumentsQuerySchema,
  UpdateDocumentSchema,
} from '@ajaia/shared';
import type { AppContext } from '../../context';
import { parse } from '../../lib/errors';
import { currentUser } from '../../middleware';
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  updateDocument,
} from './documents.service';

export function documentsRouter({ db }: AppContext): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { scope } = parse(ListDocumentsQuerySchema, req.query);
    res.json({ documents: await listDocuments(db, currentUser(req).id, scope) });
  });

  router.post('/', async (req, res) => {
    const input = parse(CreateDocumentSchema, req.body ?? {});
    res.status(201).json({ document: await createDocument(db, currentUser(req).id, input) });
  });

  router.get('/:id', async (req, res) => {
    const { id } = parse(IdParamSchema, req.params);
    res.json({ document: await getDocument(db, id, currentUser(req).id) });
  });

  router.patch('/:id', async (req, res) => {
    const { id } = parse(IdParamSchema, req.params);
    const input = parse(UpdateDocumentSchema, req.body);
    res.json({ document: await updateDocument(db, id, currentUser(req).id, input) });
  });

  router.delete('/:id', async (req, res) => {
    const { id } = parse(IdParamSchema, req.params);
    await deleteDocument(db, id, currentUser(req).id);
    res.status(204).end();
  });

  return router;
}
