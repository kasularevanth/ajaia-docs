import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { UserRef } from '@ajaia/shared';
import { Errors } from './errors';

export const hashPassword = (password: string, rounds: number) => bcrypt.hash(password, rounds);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

interface TokenClaims {
  sub: string;
  email: string;
  name: string;
}

export function signToken(user: UserRef, secret: string, expiresIn: string): string {
  const claims: TokenClaims = { sub: user.id, email: user.email, name: user.name };
  return jwt.sign(claims, secret, {
    algorithm: 'HS256',
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string, secret: string): UserRef {
  try {
    const claims = jwt.verify(token, secret, { algorithms: ['HS256'] }) as TokenClaims;
    return { id: claims.sub, email: claims.email, name: claims.name };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw Errors.unauthorized('Your session has expired — please sign in again', 'TOKEN_EXPIRED');
    }
    throw Errors.unauthorized('Invalid session — please sign in again');
  }
}
