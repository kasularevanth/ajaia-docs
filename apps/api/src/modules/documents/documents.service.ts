import { and, desc, eq, isNotNull, or, sql } from 'drizzle-orm';
import {
  DEFAULT_TITLE,
  EMPTY_DOC,
  type CreateDocumentInput,
  type DocumentDetail,
  type DocumentScope,
  type DocumentSummary,
  type JSONContent,
  type UpdateDocumentInput,
} from '@ajaia/shared';
import type { Database } from '../../db/client';
import { documents, documentShares, users } from '../../db/schema';
import { normalizeContent } from '../../lib/content';
import { Errors } from '../../lib/errors';
import {
  can,
  FORBIDDEN_MESSAGES,
  resolveRole,
  type DocumentAction,
} from '../../policies/documentAccess';

const iso = (d: Date | string) => new Date(d).toISOString();

/** Columns for list views — never includes the (potentially large) content JSON. */
const summaryColumns = {
  id: documents.id,
  title: documents.title,
  preview: sql<string>`left(regexp_replace(${documents.contentText}, '\\s+', ' ', 'g'), 160)`,
  ownerId: documents.ownerId,
  ownerName: users.name,
  ownerEmail: users.email,
  shareRole: documentShares.role,
  sharedWithCount: sql<number>`(select count(*)::int from document_shares ds where ds.document_id = ${documents.id})`,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
};

const detailColumns = { ...summaryColumns, content: documents.content, version: documents.version };

type SummaryRow = {
  id: string;
  title: string;
  preview: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  shareRole: 'viewer' | 'editor' | null;
  sharedWithCount: number;
  createdAt: Date;
  updatedAt: Date;
};
type DetailRow = SummaryRow & { content: JSONContent; version: number };

/** Join conditions: document + owner + the *caller's* share (if any), in one round trip. */
const ownerJoin = eq(users.id, documents.ownerId);
const callerShareJoin = (userId: string) =>
  and(eq(documentShares.documentId, documents.id), eq(documentShares.userId, userId));

const selectSummaries = (db: Database, userId: string) =>
  db
    .select(summaryColumns)
    .from(documents)
    .innerJoin(users, ownerJoin)
    .leftJoin(documentShares, callerShareJoin(userId));

const selectDetails = (db: Database, userId: string) =>
  db
    .select(detailColumns)
    .from(documents)
    .innerJoin(users, ownerJoin)
    .leftJoin(documentShares, callerShareJoin(userId));

function toSummary(row: SummaryRow, userId: string): DocumentSummary {
  const role = resolveRole(row, userId, row.shareRole ? { role: row.shareRole } : null) ?? 'viewer';
  // Many docs open with a heading equal to the title; don't repeat it in the preview.
  const preview = (row.preview ?? '').trim();
  return {
    id: row.id,
    title: row.title,
    preview: preview.toLowerCase().startsWith(row.title.toLowerCase())
      ? preview.slice(row.title.length).trim()
      : preview,
    role,
    owner: { id: row.ownerId, name: row.ownerName, email: row.ownerEmail },
    sharedWithCount: role === 'owner' ? Number(row.sharedWithCount) : 0,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function toDetail(row: DetailRow, userId: string): DocumentDetail {
  return { ...toSummary(row, userId), content: row.content, version: row.version };
}

/**
 * Loads a document and checks the caller may perform `action` on it.
 * No access at all → 404 (don't reveal existence). Insufficient role → 403.
 */
export async function loadForAction(
  db: Database,
  docId: string,
  userId: string,
  action: DocumentAction,
): Promise<DetailRow> {
  const [row] = (await selectDetails(db, userId)
    .where(eq(documents.id, docId))
    .limit(1)) as DetailRow[];
  const role = row ? resolveRole(row, userId, row.shareRole ? { role: row.shareRole } : null) : null;
  if (!row || !role) throw Errors.notFound();
  if (!can(role, action)) throw Errors.forbidden(FORBIDDEN_MESSAGES[action]);
  return row;
}

export async function listDocuments(
  db: Database,
  userId: string,
  scope: DocumentScope,
): Promise<DocumentSummary[]> {
  const owned = eq(documents.ownerId, userId);
  const shared = isNotNull(documentShares.userId);
  const where = scope === 'owned' ? owned : scope === 'shared' ? shared : or(owned, shared);
  const rows = (await selectSummaries(db, userId)
    .where(where)
    .orderBy(desc(documents.updatedAt))
    .limit(200)) as SummaryRow[];
  return rows.map((r) => toSummary(r, userId));
}

export async function getDocument(db: Database, docId: string, userId: string): Promise<DocumentDetail> {
  return toDetail(await loadForAction(db, docId, userId, 'read'), userId);
}

export async function createDocument(
  db: Database,
  userId: string,
  input: { title?: CreateDocumentInput['title']; content?: unknown },
): Promise<DocumentDetail> {
  const { content, text } = normalizeContent(input.content ?? EMPTY_DOC);
  const [created] = await db
    .insert(documents)
    .values({ ownerId: userId, title: input.title ?? DEFAULT_TITLE, content, contentText: text })
    .returning({ id: documents.id });
  return getDocument(db, created!.id, userId);
}

export async function updateDocument(
  db: Database,
  docId: string,
  userId: string,
  input: UpdateDocumentInput,
): Promise<DocumentDetail> {
  const editingContent = input.content !== undefined;
  const current = await loadForAction(db, docId, userId, editingContent ? 'edit' : 'rename');
  const now = new Date();

  if (editingContent) {
    const { content, text } = normalizeContent(input.content);
    // Optimistic concurrency: only succeeds if nobody saved since the client's baseVersion.
    const updated = await db
      .update(documents)
      .set({
        content,
        contentText: text,
        version: sql`${documents.version} + 1`,
        updatedAt: now,
        ...(input.title !== undefined ? { title: input.title } : {}),
      })
      .where(and(eq(documents.id, docId), eq(documents.version, input.baseVersion!)))
      .returning({ id: documents.id });

    if (updated.length === 0) {
      const [latest] = await db
        .select({ version: documents.version })
        .from(documents)
        .where(eq(documents.id, docId));
      throw Errors.versionConflict(latest?.version ?? current.version);
    }
  } else if (input.title !== undefined) {
    // Title is low-stakes: last write wins, no version bump (avoids rename/autosave conflicts).
    await db.update(documents).set({ title: input.title, updatedAt: now }).where(eq(documents.id, docId));
  }

  return getDocument(db, docId, userId);
}

export async function deleteDocument(db: Database, docId: string, userId: string): Promise<void> {
  await loadForAction(db, docId, userId, 'delete');
  await db.delete(documents).where(eq(documents.id, docId));
}
