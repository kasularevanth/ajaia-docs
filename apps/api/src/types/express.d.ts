import type { UserRef } from '@ajaia/shared';

declare global {
  namespace Express {
    interface Request {
      user?: UserRef;
    }
  }
}

export {};
