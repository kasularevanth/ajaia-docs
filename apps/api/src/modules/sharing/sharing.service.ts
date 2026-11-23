import { and, asc, eq } from 'drizzle-orm';
import type { Share, ShareRequest, SharesResponse } from '@ajaia/shared';
import type { Database } from '../../db/client';
import { documentShares, users } from '../../db/schema';
import { AppError, Errors } from '../../lib/errors';
import { loadForAction } from '../documents/documents.service';

export async function listShares(db: Database, docId: string, userId: string): Promise<SharesResponse> {
  const doc = await loadForAction(db, docId, userId, 'read');
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: documentShares.role,
      createdAt: documentShares.createdAt,
    })
    .from(documentShares)
    .innerJoin(users, eq(users.id, documentShares.userId))
    .where(eq(documentShares.documentId, docId))
    .orderBy(asc(documentShares.createdAt));

  return {
    owner: { id: doc.ownerId, email: doc.ownerEmail, name: doc.ownerName },
    shares: rows.map((r) => ({
      user: { id: r.id, email: r.email, name: r.name },
      role: r.role,
      createdAt: new Date(r.createdAt).toISOString(),
    })),
  };
}

/** Grant access, or change the role of an existing grant (idempotent upsert). Owner only. */
export async function upsertShare(
  db: Database,
  docId: string,
  userId: string,
  input: ShareRequest,
): Promise<Share> {
  const doc = await loadForAction(db, docId, userId, 'share');
  const [target] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (!target) {
    throw Errors.notFound(`No user found with the email ${input.email}`, 'USER_NOT_FOUND');
  }
  if (target.id === doc.ownerId) {
    throw new AppError(400, 'CANNOT_SHARE_WITH_OWNER', 'You already own this document');
  }

  const [share] = await db
    .insert(documentShares)
    .values({ documentId: docId, userId: target.id, role: input.role, grantedBy: userId })
    .onConflictDoUpdate({
      target: [documentShares.documentId, documentShares.userId],
      set: { role: input.role },
    })
    .returning();

  return {
    user: { id: target.id, email: target.email, name: target.name },
    role: share!.role,
    createdAt: new Date(share!.createdAt).toISOString(),
  };
}

/** Owner revokes someone's access — or a collaborator removes themselves ("leave"). */
export async function removeShare(
  db: Database,
  docId: string,
  userId: string,
  targetUserId: string,
): Promise<void> {
  await loadForAction(db, docId, userId, targetUserId === userId ? 'read' : 'share');
  await db
    .delete(documentShares)
    .where(and(eq(documentShares.documentId, docId), eq(documentShares.userId, targetUserId)));
}
