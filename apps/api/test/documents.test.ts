import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, sampleDoc } from './helpers';

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.handle.close());

describe('auth', () => {
  it('rejects bad credentials and unauthenticated requests', async () => {
    const bad = await request(t.app).post('/api/auth/login').send({ email: 'alice@ajaia.test', password: 'nope' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');

    const invalid = await request(t.app).post('/api/auth/login').send({ email: 'not-an-email', password: 'x' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    expect((await request(t.app).get('/api/documents')).status).toBe(401);
    expect((await request(t.app).get('/api/documents').set('Authorization', 'Bearer garbage')).status).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    const me = await t.as.alice.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: 'alice@ajaia.test', name: 'Alice Chen' });
  });
});

describe('documents', () => {
  it('creates, renames, saves and reopens a document with formatting preserved', async () => {
    const { alice } = t.as;
    const created = await alice.post('/api/documents', {});
    expect(created.status).toBe(201);
    expect(created.body.document).toMatchObject({ title: 'Untitled document', role: 'owner', version: 1 });
    const id = created.body.document.id;

    const renamed = await alice.patch(`/api/documents/${id}`, { title: '  Roadmap  ' });
    expect(renamed.body.document.title).toBe('Roadmap');
    expect(renamed.body.document.version).toBe(1); // title-only edits don't bump the content version

    const content = sampleDoc('Bold text');
    const saved = await alice.patch(`/api/documents/${id}`, { content, baseVersion: 1 });
    expect(saved.status).toBe(200);
    expect(saved.body.document.version).toBe(2);

    const reopened = await alice.get(`/api/documents/${id}`);
    expect(reopened.body.document.content).toEqual(content);
    expect(reopened.body.document.preview).toContain('Bold text');

    const list = await alice.get('/api/documents?scope=owned');
    const summary = list.body.documents.find((d: { id: string }) => d.id === id);
    expect(summary).toMatchObject({ title: 'Roadmap', role: 'owner' });
    expect(summary).not.toHaveProperty('content');
  });

  it('detects concurrent edits with a 409 instead of silently overwriting', async () => {
    const { alice, bob } = t.as;
    const { body } = await alice.post('/api/documents', { title: 'Shared draft' });
    const id = body.document.id;
    await alice.put(`/api/documents/${id}/shares`, { email: 'bob@ajaia.test', role: 'editor' });

    // Both start from version 1; Bob saves first.
    expect((await bob.patch(`/api/documents/${id}`, { content: sampleDoc('Bob'), baseVersion: 1 })).status).toBe(200);
    const stale = await alice.patch(`/api/documents/${id}`, { content: sampleDoc('Alice'), baseVersion: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toMatchObject({ code: 'VERSION_CONFLICT', details: { currentVersion: 2 } });

    // Retrying on the fresh version succeeds.
    expect((await alice.patch(`/api/documents/${id}`, { content: sampleDoc('Alice'), baseVersion: 2 })).status).toBe(200);
  });

  it('validates titles, content shape and the editor schema', async () => {
    const { alice } = t.as;
    const { body } = await alice.post('/api/documents', {});
    const id = body.document.id;

    expect((await alice.patch(`/api/documents/${id}`, { title: '   ' })).body.error.code).toBe('VALIDATION_ERROR');
    expect((await alice.patch(`/api/documents/${id}`, { title: 'x'.repeat(201) })).status).toBe(400);
    expect((await alice.patch(`/api/documents/${id}`, {})).status).toBe(400);
    expect((await alice.patch(`/api/documents/${id}`, { content: sampleDoc('x') })).status).toBe(400); // missing baseVersion

    const script = { type: 'doc', content: [{ type: 'script', content: [{ type: 'text', text: 'alert(1)' }] }] };
    const rejected = await alice.patch(`/api/documents/${id}`, { content: script, baseVersion: 1 });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe('INVALID_CONTENT');
  });

  it('rejects malformed ids, 404s unknown ids and only lets the owner delete', async () => {
    const { alice, bob } = t.as;
    expect((await alice.get('/api/documents/not-a-uuid')).status).toBe(400);
    expect((await alice.get('/api/documents/00000000-0000-4000-8000-000000000000')).status).toBe(404);

    const { body } = await alice.post('/api/documents', { title: 'To delete' });
    await alice.put(`/api/documents/${body.document.id}/shares`, { email: 'bob@ajaia.test', role: 'editor' });
    expect((await bob.delete(`/api/documents/${body.document.id}`)).status).toBe(403);
    expect((await alice.delete(`/api/documents/${body.document.id}`)).status).toBe(204);
    expect((await alice.get(`/api/documents/${body.document.id}`)).status).toBe(404);
  });
});
