import JSZip from 'jszip';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { JSONContent } from '@ajaia/shared';
import { createTestApp } from './helpers';

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.handle.close());

const nodeTypes = (doc: JSONContent): string[] => (doc.content ?? []).map((n) => n.type!);
const marksIn = (doc: JSONContent): string[] =>
  JSON.stringify(doc).match(/"type":"(bold|italic|underline|strike)"/g)?.map((m) => m.split('"')[3]!) ?? [];

/** Builds a minimal but valid .docx (Office Open XML) in memory. */
async function buildDocx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
      <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Quarterly Report</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bold</w:t></w:r><w:r><w:t xml:space="preserve"> and </w:t></w:r><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>underlined</w:t></w:r></w:p>
    </w:body></w:document>`,
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('file import', () => {
  it('turns Markdown into a structured, editable document', async () => {
    const md = '# Project Plan\n\nSome **bold** and *italic* text.\n\n- first\n- second\n\n1. one\n2. two\n';
    const res = await t.as.alice.upload('/api/documents/import', 'project-plan.md', md);
    expect(res.status).toBe(201);
    expect(res.body.document).toMatchObject({ title: 'Project Plan', role: 'owner' }); // from the leading H1
    const content = res.body.document.content as JSONContent;
    expect(nodeTypes(content)).toEqual(['heading', 'paragraph', 'bulletList', 'orderedList']);
    expect(marksIn(content)).toEqual(expect.arrayContaining(['bold', 'italic']));
  });

  it('turns plain text into paragraphs and escapes HTML', async () => {
    const res = await t.as.alice.upload('/api/documents/import', 'standup_notes-monday.txt', 'First para\nline two\n\n<b>Second</b> para');
    expect(res.status).toBe(201);
    expect(res.body.document.title).toBe('standup notes monday'); // no H1 → cleaned filename
    const content = res.body.document.content as JSONContent;
    expect(nodeTypes(content)).toEqual(['paragraph', 'paragraph']);
    expect(JSON.stringify(content)).toContain('<b>Second</b> para'); // literal text, not markup
    expect(marksIn(content)).toEqual([]);
  });

  it('converts .docx headings, bold and underline', async () => {
    const res = await t.as.alice.upload('/api/documents/import', 'Quarterly Report.docx', await buildDocx());
    expect(res.status).toBe(201);
    const content = res.body.document.content as JSONContent;
    expect(content.content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 1 } });
    expect(marksIn(content)).toEqual(expect.arrayContaining(['bold', 'underline']));
    expect(res.body.document.title).toBe('Quarterly Report');
  });

  it('rejects unsupported, corrupted, empty and oversized files with clear errors', async () => {
    const { alice } = t.as;
    const pdf = await alice.upload('/api/documents/import', 'scan.pdf', '%PDF-1.7');
    expect(pdf.status).toBe(415);
    expect(pdf.body.error.message).toContain('.txt, .md, .docx');

    const fakeDocx = await alice.upload('/api/documents/import', 'fake.docx', 'not a zip');
    expect(fakeDocx.status).toBe(422);

    const empty = await alice.upload('/api/documents/import', 'empty.txt', '');
    expect(empty.status).toBe(422);

    const huge = await alice.upload('/api/documents/import', 'huge.txt', 'a'.repeat(1.2 * 1024 * 1024));
    expect(huge.status).toBe(413);
    expect(huge.body.error.code).toBe('FILE_TOO_LARGE');

    const none = await alice.post('/api/documents/import');
    expect(none.status).toBe(400);
  });
});
