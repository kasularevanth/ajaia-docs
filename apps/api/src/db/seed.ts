import { inArray } from 'drizzle-orm';
import { DEMO_ACCOUNTS, type JSONContent } from '@ajaia/shared';
import { hashPassword } from '../lib/auth';
import { normalizeContent } from '../lib/content';
import type { Logger } from '../lib/logger';
import type { Database } from './client';
import { documents, documentShares, users } from './schema';

/** Fixed ids make seeding idempotent: a redeploy never duplicates or overwrites reviewer edits. */
export const SEED_DOC_IDS = {
  aliceBrief: 'a1b2c3d4-0000-4000-8000-000000000001',
  bobRetro: 'b1b2c3d4-0000-4000-8000-000000000002',
} as const;

type Mark = 'bold' | 'italic' | 'underline' | 'strike';
const t = (text: string, ...marks: Mark[]): JSONContent => ({
  type: 'text',
  text,
  ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
});
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
const h = (level: 1 | 2 | 3, text: string): JSONContent => ({
  type: 'heading',
  attrs: { level },
  content: [t(text)],
});
const list = (type: 'bulletList' | 'orderedList', items: (string | JSONContent[])[]): JSONContent => ({
  type,
  content: items.map((item) => ({
    type: 'listItem',
    content: [p(...(typeof item === 'string' ? [t(item)] : item))],
  })),
});
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });

const briefContent = doc(
  h(1, 'Q4 Product Brief'),
  p(
    t('This brief outlines what the Docs team is shipping this quarter and '),
    t('why it matters', 'bold'),
    t(' for teams that move fast on shared work.'),
  ),
  h(2, 'Goals'),
  list('orderedList', [
    'Cut the time to start a new shared document in half',
    [t('Make sharing a '), t('two-click', 'bold'), t(' action with clear permissions')],
    'Ship a reliable import path for existing .txt, .md and .docx files',
  ]),
  h(2, 'Non-goals this quarter'),
  list('bulletList', [
    'Real-time co-editing with live cursors',
    'Comments and suggestion mode',
    [t('Offline editing', 'strike'), t(' — moved to Q1')],
  ]),
  h(3, 'Open questions'),
  p(t('Do we need folder-level permissions, or is per-document sharing enough?', 'underline')),
  {
    type: 'blockquote',
    content: [
      p(
        t('Try it: ', 'bold'),
        t('Bob has editor access to this brief — sign in as Bob and make an edit.', 'italic'),
      ),
    ],
  },
);

const retroContent = doc(
  h(1, 'Team Retro Notes'),
  p(t('Sprint 42 · facilitated by Bob', 'italic')),
  h(2, 'What went well'),
  list('bulletList', [
    'Import pipeline landed ahead of schedule',
    [t('Zero', 'bold'), t(' production incidents')],
  ]),
  h(2, 'What to improve'),
  list('bulletList', ['Write the test plan before the code', 'Smaller pull requests']),
  p(t('Alice has '), t('view-only', 'underline'), t(' access to these notes.')),
);

export async function seedDemoData(
  db: Database,
  opts: { password: string; bcryptRounds: number; logger?: Logger },
): Promise<void> {
  const emails = DEMO_ACCOUNTS.map((a) => a.email);
  const existing = await db.select({ email: users.email }).from(users).where(inArray(users.email, emails));
  const missing = DEMO_ACCOUNTS.filter((a) => !existing.some((e) => e.email === a.email));

  if (missing.length > 0) {
    const passwordHash = await hashPassword(opts.password, opts.bcryptRounds);
    await db
      .insert(users)
      .values(missing.map((a) => ({ email: a.email, name: a.name, passwordHash })))
      .onConflictDoNothing();
  }

  const rows = await db.select().from(users).where(inArray(users.email, emails));
  const id = (email: string) => rows.find((r) => r.email === email)!.id;
  const alice = id('alice@ajaia.test');
  const bob = id('bob@ajaia.test');

  const brief = normalizeContent(briefContent);
  const retro = normalizeContent(retroContent);
  const inserted = await db
    .insert(documents)
    .values([
      { id: SEED_DOC_IDS.aliceBrief, ownerId: alice, title: 'Q4 Product Brief', content: brief.content, contentText: brief.text },
      { id: SEED_DOC_IDS.bobRetro, ownerId: bob, title: 'Team Retro Notes', content: retro.content, contentText: retro.text },
    ])
    .onConflictDoNothing()
    .returning({ id: documents.id });

  // Only seed shares alongside freshly-created sample docs, so a reviewer's revoke isn't undone on redeploy.
  const shares = [
    { documentId: SEED_DOC_IDS.aliceBrief, userId: bob, role: 'editor' as const, grantedBy: alice },
    { documentId: SEED_DOC_IDS.bobRetro, userId: alice, role: 'viewer' as const, grantedBy: bob },
  ].filter((s) => inserted.some((d) => d.id === s.documentId));
  if (shares.length > 0) await db.insert(documentShares).values(shares).onConflictDoNothing();

  opts.logger?.info({ newUsers: missing.length, newDocs: inserted.length }, 'demo data seeded');
}
