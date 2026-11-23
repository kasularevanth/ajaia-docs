import path from 'node:path';
import { generateJSON } from '@tiptap/html/server';
import mammoth from 'mammoth';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import {
  DEFAULT_TITLE,
  IMPORT_SUPPORTED_LABEL,
  MAX_TITLE_LENGTH,
  type JSONContent,
} from '@ajaia/shared';
import { createEditorExtensions } from '@ajaia/shared/editor';
import { AppError } from '../../lib/errors';

export type ImportKind = 'txt' | 'md' | 'docx';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

const EXTENSION_KINDS: Record<string, ImportKind> = {
  '.txt': 'txt',
  '.md': 'md',
  '.markdown': 'md',
  '.docx': 'docx',
};

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04" — .docx is a zip container

/** Only tags the editor schema can represent survive; everything else is unwrapped to text. */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr', 'a',
  ],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: { h4: 'h3', h5: 'h3', h6: 'h3' },
};

const unsupported = () =>
  new AppError(415, 'UNSUPPORTED_FILE_TYPE', `Unsupported file type. Supported: ${IMPORT_SUPPORTED_LABEL}`);

/** Multer decodes multipart filenames as latin1; restore UTF-8 (e.g. "Café notes.md"). */
export function decodeFilename(name: string): string {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}

export function detectKind(file: UploadedFile): ImportKind {
  const kind = EXTENSION_KINDS[path.extname(file.originalname).toLowerCase()];
  if (!kind) throw unsupported();
  if (kind === 'docx' && !file.buffer.subarray(0, 4).equals(ZIP_MAGIC)) {
    throw new AppError(422, 'IMPORT_FAILED', 'This .docx file appears to be corrupted or is not a Word document');
  }
  if (kind !== 'docx' && file.buffer.includes(0)) {
    // NUL bytes mean binary content wearing a text extension.
    throw new AppError(422, 'IMPORT_FAILED', 'This file does not look like a text file');
  }
  return kind;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function decodeText(buffer: Buffer): string {
  return buffer.toString('utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

/** Plain text: blank lines separate paragraphs, single newlines become line breaks. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${para.split('\n').map(escapeHtml).join('<br>')}</p>`)
    .join('');
}

async function toHtml(kind: ImportKind, buffer: Buffer): Promise<string> {
  switch (kind) {
    case 'txt':
      return textToHtml(decodeText(buffer));
    case 'md':
      return marked.parse(decodeText(buffer), { async: false, gfm: true, breaks: false }) as string;
    case 'docx': {
      try {
        // mammoth ignores underline by default — map it explicitly so formatting survives.
        const result = await mammoth.convertToHtml({ buffer }, { styleMap: ['u => u'] });
        return result.value;
      } catch {
        throw new AppError(422, 'IMPORT_FAILED', 'We could not read this .docx file');
      }
    }
  }
}

export function htmlToDoc(html: string): JSONContent {
  const clean = sanitizeHtml(html, SANITIZE_OPTIONS);
  return generateJSON(clean, createEditorExtensions()) as JSONContent;
}

export function titleFromFilename(filename: string): string {
  const base = path.basename(filename, path.extname(filename)).replace(/[_-]+/g, ' ').trim();
  return (base || DEFAULT_TITLE).slice(0, MAX_TITLE_LENGTH);
}

/** File → { title, content } ready for createDocument. */
export async function convertFile(file: UploadedFile): Promise<{ title: string; content: JSONContent }> {
  const originalname = decodeFilename(file.originalname);
  const kind = detectKind({ ...file, originalname });
  if (file.buffer.length === 0) throw new AppError(422, 'IMPORT_FAILED', 'The file is empty');

  const html = await toHtml(kind, file.buffer);
  const content = htmlToDoc(html);
  const hasText = JSON.stringify(content).includes('"text"');
  if (!hasText) throw new AppError(422, 'IMPORT_FAILED', 'No readable text was found in this file');

  return { title: titleFromContent(content) ?? titleFromFilename(originalname), content };
}

/** A leading H1 is the author's own title — prefer it over the filename. */
function titleFromContent(content: JSONContent): string | undefined {
  const first = content.content?.[0];
  if (first?.type !== 'heading' || first.attrs?.level !== 1) return undefined;
  const text = (first.content ?? []).map((n) => n.text ?? '').join('').trim();
  return text ? text.slice(0, MAX_TITLE_LENGTH) : undefined;
}
