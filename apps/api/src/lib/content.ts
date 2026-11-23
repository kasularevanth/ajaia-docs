import type { JSONContent } from '@ajaia/shared';
import { getEditorSchema } from '@ajaia/shared/editor';
import { Errors } from './errors';

/**
 * Validates arbitrary JSON against the shared editor schema and derives plain text.
 * Unknown node types, invalid nesting or bad marks are rejected with 400 INVALID_CONTENT.
 */
export function normalizeContent(json: unknown): { content: JSONContent; text: string } {
  try {
    const node = getEditorSchema().nodeFromJSON(json);
    node.check();
    const text = node.textBetween(0, node.content.size, '\n', ' ').trim();
    return { content: node.toJSON() as JSONContent, text };
  } catch {
    throw Errors.invalidContent();
  }
}
