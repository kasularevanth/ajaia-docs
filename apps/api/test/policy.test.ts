import { describe, expect, it } from 'vitest';
import { can, resolveRole, type DocumentAction } from '../src/policies/documentAccess';

describe('document access policy', () => {
  const doc = { ownerId: 'alice' };

  it('resolves the owner regardless of any share row', () => {
    expect(resolveRole(doc, 'alice')).toBe('owner');
    expect(resolveRole(doc, 'alice', { role: 'viewer' })).toBe('owner');
  });

  it('resolves shared roles, and null when there is no share', () => {
    expect(resolveRole(doc, 'bob', { role: 'editor' })).toBe('editor');
    expect(resolveRole(doc, 'bob', { role: 'viewer' })).toBe('viewer');
    expect(resolveRole(doc, 'mallory')).toBeNull();
    expect(resolveRole(doc, 'mallory', null)).toBeNull();
  });

  const matrix: Record<DocumentAction, [owner: boolean, editor: boolean, viewer: boolean, none: boolean]> = {
    read: [true, true, true, false],
    edit: [true, true, false, false],
    rename: [true, true, false, false],
    share: [true, false, false, false],
    delete: [true, false, false, false],
  };

  it.each(Object.entries(matrix))('enforces the %s permission across roles', (action, expected) => {
    const a = action as DocumentAction;
    expect([can('owner', a), can('editor', a), can('viewer', a), can(null, a)]).toEqual(expected);
  });
});
