import type { JSONContent } from '@ajaia/shared';

/** Serializes the editor's JSON to Markdown (underline has no Markdown syntax, so it uses <u>). */
export function toMarkdown(doc: JSONContent): string {
  const inline = (nodes: JSONContent[] = []): string =>
    nodes
      .map((n) => {
        if (n.type === 'hardBreak') return '  \n';
        if (n.type !== 'text') return inline(n.content);
        let text = n.text ?? '';
        const marks = new Set(n.marks?.map((m) => m.type));
        if (marks.has('code')) text = `\`${text}\``;
        if (marks.has('bold')) text = `**${text}**`;
        if (marks.has('italic')) text = `*${text}*`;
        if (marks.has('strike')) text = `~~${text}~~`;
        if (marks.has('underline')) text = `<u>${text}</u>`;
        const link = n.marks?.find((m) => m.type === 'link');
        if (link?.attrs?.href) text = `[${text}](${link.attrs.href})`;
        return text;
      })
      .join('');

  const block = (n: JSONContent, indent = ''): string => {
    switch (n.type) {
      case 'heading':
        return `${'#'.repeat(Number(n.attrs?.level ?? 1))} ${inline(n.content)}`;
      case 'paragraph':
        return indent + inline(n.content);
      case 'blockquote':
        return (n.content ?? [])
          .map((c) => block(c))
          .join('\n\n')
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n');
      case 'bulletList':
      case 'orderedList':
        return (n.content ?? [])
          .map((item, i) => {
            const marker = n.type === 'bulletList' ? '-' : `${Number(n.attrs?.start ?? 1) + i}.`;
            const [first, ...rest] = item.content ?? [];
            const head = `${indent}${marker} ${first ? inline(first.content) : ''}`;
            const tail = rest.map((c) => block(c, `${indent}   `)).join('\n');
            return tail ? `${head}\n${tail}` : head;
          })
          .join('\n');
      case 'codeBlock':
        return `\`\`\`\n${inline(n.content)}\n\`\`\``;
      case 'horizontalRule':
        return '---';
      default:
        return inline(n.content);
    }
  };

  return `${(doc.content ?? []).map((n) => block(n)).join('\n\n')}\n`;
}

export function downloadTextFile(filename: string, text: string, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeFilename = (title: string) => title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'document';
