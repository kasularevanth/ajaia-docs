import type { JSONContent } from '@tiptap/core';

export const MAX_TITLE_LENGTH = 200;
export const DEFAULT_TITLE = 'Untitled document';

/** File types the import pipeline understands. Keep UI copy, README and server in sync via this list. */
export const IMPORT_EXTENSIONS = ['.txt', '.md', '.markdown', '.docx'] as const;
export type ImportExtension = (typeof IMPORT_EXTENSIONS)[number];
export const IMPORT_ACCEPT_ATTR = IMPORT_EXTENSIONS.join(',');
export const IMPORT_SUPPORTED_LABEL = '.txt, .md, .docx';
export const DEFAULT_MAX_UPLOAD_MB = 5;

/** Seeded demo accounts — published intentionally so reviewers can test sharing. */
export const DEMO_PASSWORD = 'demo1234';
export const DEMO_ACCOUNTS = [
  { name: 'Alice Chen', email: 'alice@ajaia.test', hint: 'Owns “Q4 Product Brief”' },
  { name: 'Bob Rivera', email: 'bob@ajaia.test', hint: 'Owns “Team Retro Notes”' },
  { name: 'Carol Singh', email: 'carol@ajaia.test', hint: 'Starts with an empty workspace' },
] as const;

export const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
