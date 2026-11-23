import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DocumentSummary } from '@ajaia/shared';
import { createTestApp, sampleDoc } from './helpers';

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.handle.close());

describe('sharing lifecycle', () => {
  it('grants, enforces, upgrades and revokes access end to end', async () => {
    const { alice, carol } = t.as;

    // Alice creates a private document.
    const created = await alice.post('/api/documents', { title: 'Launch plan' });
    expect(created.status).toBe(201);
    const id = created.body.document.id as string;
    const version = created.body.document.version as number;

    // Carol has no access — and cannot even learn the document exists.
    expect((await carol.get(`/api/documents/${id}`)).status).toBe(404);

    // Alice shares as viewer.
    const share = await alice.put(`/api/documents/${id}/shares`, { email: 'CAROL@ajaia.test', role: 'viewer' });
    expect(share.status).toBe(200);
    expect(share.body.share).toMatchObject({ role: 'viewer', user: { email: 'carol@ajaia.test' } });

    // Carol can read, sees herself as viewer, but cannot edit, rename, share or delete.
    const read = await carol.get(`/api/documents/${id}`);
    expect(read.status).toBe(200);
    expect(read.body.document).toMatchObject({ role: 'viewer', owner: { email: 'alice@ajaia.test' } });
    expect((await carol.patch(`/api/documents/${id}`, { content: sampleDoc('x'), baseVersion: version })).status).toBe(403);
    expect((await carol.patch(`/api/documents/${id}`, { title: 'Hijacked' })).status).toBe(403);
    expect((await carol.put(`/api/documents/${id}/shares`, { email: 'bob@ajaia.test', role: 'editor' })).status).toBe(403);
    expect((await carol.delete(`/api/documents/${id}`)).status).toBe(403);

    // Upgrade to editor (same endpoint is an upsert) → Carol can now save content.
    expect((await alice.put(`/api/documents/${id}/shares`, { email: 'carol@ajaia.test', role: 'editor' })).status).toBe(200);
    const saved = await carol.patch(`/api/documents/${id}`, { content: sampleDoc('Edited by Carol'), baseVersion: version });
    expect(saved.status).toBe(200);
    expect(saved.body.document.version).toBe(version + 1);

    // Alice sees Carol's edit; the share list shows exactly one collaborator.
    const aliceView = await alice.get(`/api/documents/${id}`);
    expect(JSON.stringify(aliceView.body.document.content)).toContain('Edited by Carol');
    const shares = await alice.get(`/api/documents/${id}/shares`);
    expect(shares.body.owner.email).toBe('alice@ajaia.test');
    expect(shares.body.shares).toHaveLength(1);

    // Revoke → Carol is back to 404.
    expect((await alice.delete(`/api/documents/${id}/shares/${t.ids.carol}`)).status).toBe(204);
    expect((await carol.get(`/api/documents/${id}`)).status).toBe(404);
  });

  it('separates owned and shared documents in the dashboard scopes', async () => {
    const { bob } = t.as;
    const owned = (await bob.get('/api/documents?scope=owned')).body.documents as DocumentSummary[];
    const shared = (await bob.get('/api/documents?scope=shared')).body.documents as DocumentSummary[];
    const all = (await bob.get('/api/documents')).body.documents as DocumentSummary[];

    expect(owned.every((d) => d.role === 'owner')).toBe(true);
    expect(owned.map((d) => d.title)).toContain('Team Retro Notes');
    expect(shared.every((d) => d.role !== 'owner' && d.owner.email !== 'bob@ajaia.test')).toBe(true);
    expect(shared.find((d) => d.title === 'Q4 Product Brief')?.role).toBe('editor');
    expect(all).toHaveLength(owned.length + shared.length);
  });

  it('rejects sharing with unknown users or with the owner', async () => {
    const { alice } = t.as;
    const { body } = await alice.post('/api/documents', { title: 'Solo' });
    const unknown = await alice.put(`/api/documents/${body.document.id}/shares`, { email: 'nobody@ajaia.test', role: 'viewer' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('USER_NOT_FOUND');
    const self = await alice.put(`/api/documents/${body.document.id}/shares`, { email: 'alice@ajaia.test', role: 'editor' });
    expect(self.status).toBe(400);
    expect(self.body.error.code).toBe('CANNOT_SHARE_WITH_OWNER');
    const badRole = await alice.put(`/api/documents/${body.document.id}/shares`, { email: 'bob@ajaia.test', role: 'admin' });
    expect(badRole.status).toBe(400);
  });

  it('lets a collaborator leave a shared document', async () => {
    const { alice, bob } = t.as;
    const { body } = await alice.post('/api/documents', { title: 'Temp share' });
    await alice.put(`/api/documents/${body.document.id}/shares`, { email: 'bob@ajaia.test', role: 'viewer' });
    expect((await bob.delete(`/api/documents/${body.document.id}/shares/${t.ids.bob}`)).status).toBe(204);
    expect((await bob.get(`/api/documents/${body.document.id}`)).status).toBe(404);
  });
});
