import * as Menu from '@radix-ui/react-dropdown-menu';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { ArrowLeft, Download, Eye, MoreHorizontal, Printer, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import type { DocumentDetail } from '@ajaia/shared';
import { createEditorExtensions } from '@ajaia/shared/editor';
import { AccountMenu } from '../../components/AccountMenu';
import { Avatar, Button, FullPageSpinner } from '../../components/ui';
import { isApiError } from '../../lib/api';
import { plural, relativeTime } from '../../lib/format';
import { downloadTextFile, safeFilename, toMarkdown } from '../../lib/markdown';
import { useDocument } from '../documents/api';
import { ShareDialog } from '../sharing/ShareDialog';
import { SaveStatus } from './SaveStatus';
import { TitleInput } from './TitleInput';
import { Toolbar } from './Toolbar';
import { useAutosave } from './useAutosave';

export default function EditorPage() {
  const { id = '' } = useParams();
  const query = useDocument(id);

  if (query.isError && !query.data) {
    const missing = isApiError(query.error) && [400, 403, 404].includes(query.error.status);
    return (
      <main className="mx-auto max-w-lg px-5 py-24 text-center">
        <h1 className="font-serif text-3xl">{missing ? "This document isn't available" : "The document didn't open"}</h1>
        <p className="mt-3 text-muted">
          {missing
            ? "It may have been deleted, or the owner hasn't shared it with you."
            : isApiError(query.error)
              ? query.error.message
              : 'Something went wrong.'}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {!missing && <Button onClick={() => query.refetch()}>Try again</Button>}
          <Link to="/" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 font-medium text-white hover:bg-accent-strong">
            Back to documents
          </Link>
        </div>
      </main>
    );
  }
  // Never mount the editor from a cached copy: wait for this visit's fresh read.
  if (!query.data || !query.isFetchedAfterMount) return <FullPageSpinner label="Opening document" />;
  return <DocumentEditor key={query.data.id} doc={query.data} />;
}

type WordCountStorage = { characterCount?: { words: () => number } };

function DocumentEditor({ doc }: { doc: DocumentDetail }) {
  const canEdit = doc.role !== 'viewer';
  const isOwner = doc.role === 'owner';
  const [shareOpen, setShareOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState(doc.updatedAt);
  const editorRef = useRef<Editor | null>(null);

  const autosave = useAutosave({
    docId: doc.id,
    initialVersion: doc.version,
    getContent: () => editorRef.current!.getJSON(),
    onSaved: (saved) => setLastSaved(saved.updatedAt),
  });
  const markDirty = useRef(autosave.markDirty);
  markDirty.current = autosave.markDirty;

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      ...createEditorExtensions(),
      Placeholder.configure({ placeholder: canEdit ? 'Start writing…' : '' }),
      CharacterCount,
    ],
    content: doc.content,
    editable: canEdit,
    autofocus: canEdit ? 'end' : false,
    editorProps: { attributes: { 'aria-label': 'Document body', spellcheck: 'true' } },
    // Only user edits count: schema normalization (e.g. the trailing-paragraph plugin) arrives as an
    // appended transaction while the root transaction has no doc change — opening a doc must not save it.
    onUpdate: ({ transaction }) => {
      if (canEdit && transaction.docChanged) markDirty.current();
    },
  });
  editorRef.current = editor;

  const words = useEditorState({
    editor,
    selector: ({ editor: e }) => (e.storage as WordCountStorage).characterCount?.words() ?? 0,
  });

  // Ctrl/Cmd+S saves immediately instead of opening the browser's save dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (canEdit) void autosave.save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [autosave, canEdit]);

  const resolve = async (mode: 'reload' | 'overwrite') => {
    try {
      await autosave.resolveConflict(mode, (content) => editor.commands.setContent(content, { emitUpdate: false }));
      toast.success(mode === 'reload' ? 'Loaded the latest version' : 'Your version was saved');
    } catch (err) {
      toast.error(isApiError(err) ? err.message : 'Something went wrong');
    }
  };

  const exportMarkdown = () => {
    downloadTextFile(`${safeFilename(doc.title)}.md`, toMarkdown(editor.getJSON()));
    toast.success('Markdown file downloaded');
  };

  return (
    <div className="min-h-screen pb-24">
      <header className="no-print sticky top-0 z-20 border-b border-line/70 bg-desk/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 md:px-6">
          <Link to="/" aria-label="Back to documents" title="Back to documents" className="rounded-lg p-2 text-muted hover:bg-desk-deep hover:text-ink">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <TitleInput docId={doc.id} title={doc.title} canEdit={canEdit} />
            <p className="truncate px-2 text-xs text-muted">
              {isOwner ? (
                doc.sharedWithCount > 0 ? `You own this. Shared with ${plural(doc.sharedWithCount, 'person', 'people')}.` : 'You own this. Only you can see it.'
              ) : (
                <>
                  Shared with you by {doc.owner.name}. You can {doc.role === 'editor' ? 'edit' : 'view'}.
                </>
              )}
            </p>
          </div>
          {canEdit && <SaveStatus state={autosave.state} error={autosave.error} onRetry={() => void autosave.save()} />}
          <Menu.Root>
            <Menu.Trigger aria-label="More options" className="rounded-lg p-2 text-muted hover:bg-desk-deep hover:text-ink">
              <MoreHorizontal className="size-5" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={6} className="z-50 min-w-56 rounded-xl border border-line bg-paper p-1.5 shadow-pop">
                <Menu.Item onSelect={exportMarkdown} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-desk">
                  <Download className="size-4 text-muted" /> Download as Markdown
                </Menu.Item>
                <Menu.Item onSelect={() => window.print()} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-desk">
                  <Printer className="size-4 text-muted" /> Print or save as PDF
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
          {isOwner ? (
            <Button variant="primary" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 className="size-4" /> Share
            </Button>
          ) : (
            <span className="hidden items-center gap-2 sm:flex" title={`Owner: ${doc.owner.name}`}>
              <Avatar name={doc.owner.name} size={28} />
            </span>
          )}
          <span className="hidden md:block">
            <AccountMenu />
          </span>
        </div>
      </header>

      <div className="no-print sticky top-[69px] z-10 mx-auto mt-4 flex max-w-[816px] justify-center px-3">
        {canEdit ? (
          <Toolbar editor={editor} />
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-marker bg-marker-wash px-4 py-2 text-sm">
            <Eye className="size-4" /> View only. Ask {doc.owner.name} for edit access.
          </p>
        )}
      </div>

      {autosave.state === 'conflict' && (
        <div role="alert" className="no-print mx-auto mt-4 flex max-w-[816px] flex-col gap-3 rounded-xl border border-danger/30 bg-danger-wash px-4 py-3 text-sm sm:flex-row sm:items-center">
          <p className="flex-1">
            <strong className="font-semibold">Someone else saved a newer version.</strong> Your latest edits aren't saved yet.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void resolve('reload')}>
              Load their version
            </Button>
            <Button size="sm" variant="danger" onClick={() => void resolve('overwrite')}>
              Keep mine
            </Button>
          </div>
        </div>
      )}

      <main className="mx-auto mt-4 max-w-[816px] px-0 sm:px-3">
        <article className="doc sheet min-h-[85vh] bg-paper px-6 py-10 shadow-sheet sm:rounded-sm sm:px-[72px] sm:py-16">
          <EditorContent editor={editor} />
        </article>
        <footer className="no-print mt-3 flex justify-between px-4 text-xs text-faint sm:px-1">
          <span>{plural(words, 'word')}</span>
          <span title={new Date(lastSaved).toLocaleString()}>Last edited {relativeTime(lastSaved)}</span>
        </footer>
      </main>

      {isOwner && <ShareDialog doc={doc} open={shareOpen} onOpenChange={setShareOpen} />}
    </div>
  );
}
