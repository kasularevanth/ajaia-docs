import type { JSONContent } from '@tiptap/core';
import type { z } from 'zod';
import type { DocumentScopeSchema, RoleSchema, ShareRoleSchema } from './schemas';

export type Role = z.infer<typeof RoleSchema>;
export type ShareRole = z.infer<typeof ShareRoleSchema>;
export type DocumentScope = z.infer<typeof DocumentScopeSchema>;

export interface UserRef {
  id: string;
  email: string;
  name: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  preview: string;
  role: Role;
  owner: UserRef;
  /** Number of people the document is shared with (excluding the owner). */
  sharedWithCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  content: JSONContent;
  version: number;
}

export interface Share {
  user: UserRef;
  role: ShareRole;
  createdAt: string;
}

export interface SharesResponse {
  owner: UserRef;
  shares: Share[];
}

export interface AuthResponse {
  token: string;
  user: UserRef;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CONTENT'
  | 'CANNOT_SHARE_WITH_OWNER'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'IMPORT_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown };
}
