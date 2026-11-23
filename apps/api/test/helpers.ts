import pino from 'pino';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { parseEnv } from '../src/config/env';
import { createDb, type DbHandle } from '../src/db/client';
import { seedDemoData } from '../src/db/seed';

export const DEMO = {
  alice: 'alice@ajaia.test',
  bob: 'bob@ajaia.test',
  carol: 'carol@ajaia.test',
} as const;
type DemoUser = keyof typeof DEMO;

/** A client bound to one user's bearer token. */
export function clientFor(app: Express, token: string) {
  const auth = { Authorization: `Bearer ${token}` };
  return {
    get: (url: string) => request(app).get(url).set(auth),
    post: (url: string, body?: object) => request(app).post(url).set(auth).send(body),
    patch: (url: string, body: object) => request(app).patch(url).set(auth).send(body),
    put: (url: string, body: object) => request(app).put(url).set(auth).send(body),
    delete: (url: string) => request(app).delete(url).set(auth),
    upload: (url: string, filename: string, content: Buffer | string) =>
      request(app)
        .post(url)
        .set(auth)
        .attach('file', Buffer.isBuffer(content) ? content : Buffer.from(content), filename),
  };
}
export type Client = ReturnType<typeof clientFor>;

/**
 * Boots the real Express app against an in-memory PGlite Postgres with the real migrations
 * and seed data. No Docker, no network.
 */
export async function createTestApp(): Promise<{
  app: Express;
  handle: DbHandle;
  as: Record<DemoUser, Client>;
  ids: Record<DemoUser, string>;
}> {
  const env = parseEnv({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-test-secret-test-secret',
    MAX_UPLOAD_MB: '1',
    BCRYPT_ROUNDS: '4',
  });
  const handle = await createDb({ pgliteDataDir: 'memory://' });
  await handle.migrate();
  await seedDemoData(handle.db, { password: 'demo1234', bcryptRounds: 4 });
  const app = createApp({ db: handle.db, env, logger: pino({ level: 'silent' }), ping: handle.ping });

  const as = {} as Record<DemoUser, Client>;
  const ids = {} as Record<DemoUser, string>;
  for (const [key, email] of Object.entries(DEMO) as [DemoUser, string][]) {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'demo1234' });
    if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
    as[key] = clientFor(app, res.body.token);
    ids[key] = res.body.user.id;
  }
  return { app, handle, as, ids };
}

export const sampleDoc = (text: string) => ({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Heading' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text, marks: [{ type: 'bold' }] },
        { type: 'text', text: ' and underlined', marks: [{ type: 'underline' }] },
      ],
    },
    {
      type: 'bulletList',
      content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }] }],
    },
  ],
});
