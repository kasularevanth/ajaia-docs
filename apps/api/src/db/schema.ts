import type { JSONContent } from '@tiptap/core';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
};

export const shareRole = pgEnum('share_role', ['viewer', 'editor']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Always stored lower-cased by the service layer. */
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  ...timestamps,
});

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('Untitled document'),
    /** Canonical TipTap / ProseMirror JSON. */
    content: jsonb('content').$type<JSONContent>().notNull(),
    /** Derived plain text, used for dashboard previews. */
    contentText: text('content_text').notNull().default(''),
    /** Optimistic-concurrency counter; incremented on every content write. */
    version: integer('version').notNull().default(1),
    ...timestamps,
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('documents_owner_updated_idx').on(t.ownerId, t.updatedAt.desc()),
    check('documents_title_length', sql`char_length(${t.title}) between 1 and 200`),
  ],
);

export const documentShares = pgTable(
  'document_shares',
  {
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: shareRole('role').notNull().default('viewer'),
    grantedBy: uuid('granted_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.userId] }),
    index('document_shares_user_idx').on(t.userId),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type ShareRow = typeof documentShares.$inferSelect;
