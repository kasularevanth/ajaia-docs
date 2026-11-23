import { FilePlus2, Upload } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { DEFAULT_MAX_UPLOAD_MB, IMPORT_ACCEPT_ATTR, IMPORT_SUPPORTED_LABEL, type DocumentSummary } from '@ajaia/shared';
import { AccountMenu } from '../../components/AccountMenu';
import { Button, Wordmark } from '../../components/ui';
import { isApiError } from '../../lib/api';
import { cx } from '../../lib/format';
import { useCreateDocument, useDocuments } from './api';
import { DocumentRow } from './DocumentRow';
import { useFileImport } from './useFileImport';

type Tab = 'all' | 'owned' | 'shared';
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All documents' },
  { id: 'owned', label: 'Owned by me' },
  { id: 'shared', label: 'Shared with me' },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('all');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const documents = useDocuments();
  const create = useCreateDocument();
  const { importFile, isImporting } = useFileImport();

  const groups = useMemo(() => {
    const all = documents.data ?? [];
    return {
      all,
      owned: all.filter((d) => d.role === 'owner'),
      shared: all.filter((d) => d.role !== 'owner'),
    } satisfies Record<Tab, DocumentSummary[]>;
  }, [documents.data]);

  const newDocument = () =>
    create.mutate(undefined, {
      onSuccess: (doc) => navigate(`/d/${doc.id}`),
      onError: (err) => toast.error(isApiError(err) ? err.message : "Couldn't create a document"),
    });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) importFile(file);
  };

  return (
    <div
      className="min-h-screen"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={onDrop}
    >
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-6 md:px-8">
        <Wordmark className="text-2xl" />
        <AccountMenu />
      </header>

      <main className="mx-auto max-w-5xl px-5 pt-10 pb-24 md:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-4xl font-medium tracking-tight">Documents</h1>
            <p className="mt-2 text-sm text-muted">
              Import {IMPORT_SUPPORTED_LABEL} files up to {DEFAULT_MAX_UPLOAD_MB} MB, or drop one anywhere on this page.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInput}
              type="file"
              accept={IMPORT_ACCEPT_ATTR}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importFile(file);
                e.target.value = '';
              }}
            />
            <Button onClick={() => fileInput.current?.click()} loading={isImporting}>
              {!isImporting && <Upload className="size-4" />} Import file
            </Button>
            <Button variant="primary" onClick={newDocument} loading={create.isPending}>
              {!create.isPending && <FilePlus2 className="size-4" />} New document
            </Button>
          </div>
        </div>

        <div role="tablist" aria-label="Filter documents" className="mt-8 flex gap-1 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                tab === t.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {t.id === 'owned' && <span className="h-3 w-1 rounded-full bg-ink" aria-hidden="true" />}
              {t.id === 'shared' && <span className="h-3 w-1 rounded-full bg-marker" aria-hidden="true" />}
              {t.label}
              {documents.data && <span className="text-xs text-faint">{groups[t.id].length}</span>}
            </button>
          ))}
        </div>

        <section className="mt-4" role="tabpanel" aria-label={TABS.find((t) => t.id === tab)!.label}>
          {documents.isPending ? (
            <ul className="grid gap-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-[76px] animate-pulse rounded-xl bg-paper/60" />
              ))}
            </ul>
          ) : documents.isError ? (
            <div className="rounded-xl bg-paper p-8 text-center">
              <p className="font-medium">Your documents didn't load.</p>
              <p className="mt-1 text-sm text-muted">
                {isApiError(documents.error) ? documents.error.message : 'Something went wrong.'}
              </p>
              <Button className="mt-4" onClick={() => documents.refetch()}>
                Try again
              </Button>
            </div>
          ) : groups[tab].length === 0 ? (
            <EmptyState tab={tab} onCreate={newDocument} onImport={() => fileInput.current?.click()} />
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {groups[tab].map((doc) => (
                <DocumentRow key={doc.id} doc={doc} />
              ))}
            </ul>
          )}
        </section>
      </main>

      {dragging && (
        <div className="pointer-events-none fixed inset-4 z-40 flex items-center justify-center rounded-3xl border-2 border-dashed border-accent bg-accent-wash/90">
          <p className="font-serif text-2xl">Drop to import as a new document</p>
        </div>
      )}
    </div>
  );
}

function EmptyState({ tab, onCreate, onImport }: { tab: Tab; onCreate: () => void; onImport: () => void }) {
  if (tab === 'shared') {
    return (
      <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
        <p className="font-serif text-2xl">Nothing shared with you yet</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          When someone shares a document with you, it shows up here with a highlighter tab.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <p className="font-serif text-2xl">Start your first document</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        Write from a blank page, or import a {IMPORT_SUPPORTED_LABEL} file you already have.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Button onClick={onImport}>Import file</Button>
        <Button variant="primary" onClick={onCreate}>
          New document
        </Button>
      </div>
    </div>
  );
}
