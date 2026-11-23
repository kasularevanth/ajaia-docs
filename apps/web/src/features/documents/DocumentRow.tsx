import * as Menu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, UserMinus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { MAX_TITLE_LENGTH, TitleSchema, type DocumentSummary } from '@ajaia/shared';
import { Avatar, Button, Input, Modal } from '../../components/ui';
import { isApiError } from '../../lib/api';
import { cx, plural, relativeTime } from '../../lib/format';
import { useCurrentUser } from '../auth/AuthProvider';
import { useDeleteDocument, useLeaveDocument, useRenameDocument } from './api';

const roleLabel = { owner: 'Owner', editor: 'Can edit', viewer: 'Can view' } as const;

export function DocumentRow({ doc }: { doc: DocumentSummary }) {
  const me = useCurrentUser();
  const owned = doc.role === 'owner';
  const [dialog, setDialog] = useState<'rename' | 'delete' | 'leave' | null>(null);

  return (
    <li className="group relative min-w-0">
      <Link
        to={`/d/${doc.id}`}
        className="relative flex flex-col gap-3 overflow-hidden rounded-xl bg-paper/70 py-4 pr-14 pl-6 transition-colors hover:bg-paper focus-visible:bg-paper sm:flex-row sm:items-center sm:gap-6"
      >
        {/* The edge tab: ink = you own it, highlighter = shared with you. */}
        <span
          aria-hidden="true"
          className={cx('absolute inset-y-3 left-0 w-1.5 rounded-r-full', owned ? 'bg-ink' : 'bg-marker')}
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif text-xl font-medium">{doc.title}</h3>
          <p className="mt-0.5 truncate text-sm text-muted">{doc.preview || 'Empty document'}</p>
        </div>

        <div className="flex shrink-0 items-center gap-4 text-sm sm:w-72 sm:justify-end md:w-80">
          {owned ? (
            <span className="text-muted">
              {doc.sharedWithCount > 0 ? `Shared with ${plural(doc.sharedWithCount, 'person', 'people')}` : 'Only you'}
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={doc.owner.name} size={22} />
              <span className="truncate text-muted">{doc.owner.name}</span>
              <span
                className={cx(
                  'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                  doc.role === 'editor' ? 'bg-marker text-ink' : 'bg-marker-wash text-ink',
                )}
              >
                {roleLabel[doc.role]}
              </span>
            </span>
          )}
          <time className="w-24 shrink-0 text-right text-faint" dateTime={doc.updatedAt} title={new Date(doc.updatedAt).toLocaleString()}>
            {relativeTime(doc.updatedAt)}
          </time>
        </div>
      </Link>

      <Menu.Root>
        <Menu.Trigger
          aria-label={`More actions for ${doc.title}`}
          className="absolute top-4 right-3 rounded-lg p-1.5 text-muted opacity-100 hover:bg-desk hover:text-ink sm:top-1/2 sm:-translate-y-1/2 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-5" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content align="end" sideOffset={4} className="z-50 min-w-48 rounded-xl border border-line bg-paper p-1.5 shadow-pop">
            {doc.role !== 'viewer' && (
              <MenuItem onSelect={() => setDialog('rename')} icon={<Pencil className="size-4" />}>
                Rename
              </MenuItem>
            )}
            {owned ? (
              <MenuItem onSelect={() => setDialog('delete')} icon={<Trash2 className="size-4" />} danger>
                Delete
              </MenuItem>
            ) : (
              <MenuItem onSelect={() => setDialog('leave')} icon={<UserMinus className="size-4" />}>
                Remove from my documents
              </MenuItem>
            )}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>

      {dialog === 'rename' && <RenameDialog doc={doc} onClose={() => setDialog(null)} />}
      {dialog === 'delete' && <DeleteDialog doc={doc} onClose={() => setDialog(null)} />}
      {dialog === 'leave' && <LeaveDialog doc={doc} userId={me.id} onClose={() => setDialog(null)} />}
    </li>
  );
}

function MenuItem({
  children,
  icon,
  onSelect,
  danger,
}: {
  children: string;
  icon: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
}) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cx(
        'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-desk',
        danger && 'text-danger',
      )}
    >
      {icon}
      {children}
    </Menu.Item>
  );
}

function RenameDialog({ doc, onClose }: { doc: DocumentSummary; onClose: () => void }) {
  const [title, setTitle] = useState(doc.title);
  const [error, setError] = useState<string | null>(null);
  const rename = useRenameDocument();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = TitleSchema.safeParse(title);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Invalid title');
    rename.mutate(
      { id: doc.id, title: parsed.data },
      {
        onSuccess: () => {
          toast.success('Document renamed');
          onClose();
        },
        onError: (err) => setError(isApiError(err) ? err.message : 'Rename failed'),
      },
    );
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Rename document">
      <form onSubmit={submit} className="grid gap-4">
        <Input autoFocus value={title} maxLength={MAX_TITLE_LENGTH} onChange={(e) => setTitle(e.target.value)} invalid={!!error} aria-label="Title" />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={rename.isPending}>
            Rename
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({ doc, onClose }: { doc: DocumentSummary; onClose: () => void }) {
  const del = useDeleteDocument();
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Delete this document?"
      description={
        <>
          “{doc.title}” will be permanently deleted
          {doc.sharedWithCount > 0 ? ` and removed for ${plural(doc.sharedWithCount, 'person', 'people')} it's shared with` : ''}. This
          can't be undone.
        </>
      }
    >
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          loading={del.isPending}
          onClick={() =>
            del.mutate(doc.id, {
              onSuccess: () => {
                toast.success('Document deleted');
                onClose();
              },
              onError: (err) => toast.error(isApiError(err) ? err.message : 'Delete failed'),
            })
          }
        >
          Delete document
        </Button>
      </div>
    </Modal>
  );
}

function LeaveDialog({ doc, userId, onClose }: { doc: DocumentSummary; userId: string; onClose: () => void }) {
  const leave = useLeaveDocument();
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Remove from your documents?"
      description={`You'll lose access to “${doc.title}”. ${doc.owner.name} can share it with you again.`}
    >
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          loading={leave.isPending}
          onClick={() =>
            leave.mutate(
              { id: doc.id, userId },
              {
                onSuccess: () => {
                  toast.success('Removed from your documents');
                  onClose();
                },
                onError: (err) => toast.error(isApiError(err) ? err.message : 'Something went wrong'),
              },
            )
          }
        >
          Remove
        </Button>
      </div>
    </Modal>
  );
}
