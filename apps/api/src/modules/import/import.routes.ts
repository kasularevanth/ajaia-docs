import { Router } from 'express';
import multer from 'multer';
import type { AppContext } from '../../context';
import { Errors } from '../../lib/errors';
import { currentUser } from '../../middleware';
import { createDocument } from '../documents/documents.service';
import { convertFile } from './converters';

export function importRouter({ db, env, logger }: AppContext): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  });

  /** Upload a .txt / .md / .docx file and turn it into a new editable document owned by the caller. */
  router.post('/import', upload.single('file'), async (req, res) => {
    if (!req.file) throw Errors.validation('Choose a file to import (form field "file")');
    const { title, content } = await convertFile(req.file);
    const document = await createDocument(db, currentUser(req).id, { title, content });
    logger.info({ docId: document.id, bytes: req.file.size, type: req.file.mimetype }, 'file imported');
    res.status(201).json({ document });
  });

  return router;
}
