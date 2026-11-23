import { z } from 'zod';
import { MAX_TITLE_LENGTH } from './constants';

export const RoleSchema = z.enum(['owner', 'editor', 'viewer']);
export const ShareRoleSchema = z.enum(['viewer', 'editor']);
export const DocumentScopeSchema = z.enum(['all', 'owned', 'shared']);

export const EmailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address' }));

export const TitleSchema = z
  .string()
  .trim()
  .min(1, 'Title cannot be empty')
  .max(MAX_TITLE_LENGTH, `Title must be at most ${MAX_TITLE_LENGTH} characters`);

/** Shape check only — the API additionally validates against the ProseMirror schema. */
export const DocContentSchema = z.looseObject({
  type: z.literal('doc'),
  content: z.array(z.unknown()).optional(),
});

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required').max(200),
});

export const CreateDocumentSchema = z.object({
  title: TitleSchema.optional(),
  content: DocContentSchema.optional(),
});

export const UpdateDocumentSchema = z
  .object({
    title: TitleSchema.optional(),
    content: DocContentSchema.optional(),
    baseVersion: z.number().int().positive().optional(),
  })
  .refine((v) => v.title !== undefined || v.content !== undefined, {
    message: 'Provide a title or content to update',
  })
  .refine((v) => v.content === undefined || v.baseVersion !== undefined, {
    message: 'baseVersion is required when updating content',
    path: ['baseVersion'],
  });

export const ListDocumentsQuerySchema = z.object({
  scope: DocumentScopeSchema.default('all'),
});

export const ShareRequestSchema = z.object({
  email: EmailSchema,
  role: ShareRoleSchema,
});

export const IdParamSchema = z.object({ id: z.guid('Invalid document id') });
export const ShareParamSchema = z.object({
  id: z.guid('Invalid document id'),
  userId: z.guid('Invalid user id'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;
export type ShareRequest = z.infer<typeof ShareRequestSchema>;
