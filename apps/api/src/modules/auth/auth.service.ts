import { eq } from 'drizzle-orm';
import type { AuthResponse, LoginInput, UserRef } from '@ajaia/shared';
import type { AppContext } from '../../context';
import { users } from '../../db/schema';
import { signToken, verifyPassword } from '../../lib/auth';
import { AppError, Errors } from '../../lib/errors';

const toUserRef = (u: { id: string; email: string; name: string }): UserRef => ({
  id: u.id,
  email: u.email,
  name: u.name,
});

export async function login({ db, env }: AppContext, input: LoginInput): Promise<AuthResponse> {
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;
  if (!user || !valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  }
  const ref = toUserRef(user);
  return { token: signToken(ref, env.JWT_SECRET, env.JWT_EXPIRES_IN), user: ref };
}

export async function getUser({ db }: AppContext, id: string): Promise<UserRef> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw Errors.unauthorized('Your account no longer exists');
  return toUserRef(user);
}
