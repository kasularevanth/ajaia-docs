import type { ErrorCode } from '@ajaia/shared';
import { z, type ZodType } from 'zod';

/** An expected, client-facing error. Anything else is treated as a 500. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  validation: (message: string, details?: unknown) =>
    new AppError(400, 'VALIDATION_ERROR', message, details),
  invalidContent: (message = 'Document content is not valid for this editor') =>
    new AppError(400, 'INVALID_CONTENT', message),
  unauthorized: (message = 'Please sign in to continue', code: ErrorCode = 'UNAUTHORIZED') =>
    new AppError(401, code, message),
  forbidden: (message = "You don't have permission to do that") =>
    new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Document not found', code: ErrorCode = 'NOT_FOUND') =>
    new AppError(404, code, message),
  versionConflict: (currentVersion: number) =>
    new AppError(409, 'VERSION_CONFLICT', 'This document was changed by someone else', {
      currentVersion,
    }),
};

/** Parse untrusted input with a Zod schema, converting failures into a 400 with field errors. */
export function parse<T extends ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const flat = z.flattenError(result.error);
    const first = result.error.issues[0]?.message ?? 'Invalid request';
    throw Errors.validation(first, flat);
  }
  return result.data;
}
