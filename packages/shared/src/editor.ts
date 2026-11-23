import { getSchema, type Extensions } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';

/**
 * The single source of truth for the document schema.
 * The web editor renders with these extensions, and the API uses the exact same list to
 * validate saved content and to convert imported files — so client and server can never
 * disagree about what a valid document is.
 */
export function createEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
  ];
}

let cachedSchema: Schema | undefined;
export function getEditorSchema(): Schema {
  cachedSchema ??= getSchema(createEditorExtensions());
  return cachedSchema;
}
