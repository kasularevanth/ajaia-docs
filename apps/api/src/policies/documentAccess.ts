import type { Role, ShareRole } from '@ajaia/shared';

/**
 * Authorization policy for documents — pure and side-effect free, so it can be table-tested.
 * Every document route goes through `resolveRole` + `can`.
 */
export type DocumentAction = 'read' | 'edit' | 'rename' | 'delete' | 'share';

const PERMISSIONS: Record<Role, ReadonlySet<DocumentAction>> = {
  owner: new Set(['read', 'edit', 'rename', 'delete', 'share']),
  editor: new Set(['read', 'edit', 'rename']),
  viewer: new Set(['read']),
};

export function resolveRole(
  doc: { ownerId: string },
  userId: string,
  share?: { role: ShareRole } | null,
): Role | null {
  if (doc.ownerId === userId) return 'owner';
  return share?.role ?? null;
}

export function can(role: Role | null, action: DocumentAction): boolean {
  return role !== null && PERMISSIONS[role].has(action);
}

export const FORBIDDEN_MESSAGES: Record<DocumentAction, string> = {
  read: "You don't have access to this document",
  edit: 'You have view-only access to this document',
  rename: 'You have view-only access to this document',
  delete: 'Only the owner can delete this document',
  share: 'Only the owner can manage sharing',
};
