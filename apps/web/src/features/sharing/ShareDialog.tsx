import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  DEMO_ACCOUNTS,
  ShareRequestSchema,
  type DocumentDetail,
  type Share,
  type ShareRequest,
  type ShareRole,
  type SharesResponse,
} from '@ajaia/shared';
import { Avatar, Button, Input, Modal, Spinner } from '../../components/ui';
import { api, isApiError } from '../../lib/api';
import { useCurrentUser } from '../auth/AuthProvider';
import { docKeys } from '../documents/api';

const ROLE_OPTIONS: { value: ShareRole; label: string }[] = [
  { value: 'editor', label: 'Can edit' },
  { value: 'viewer', label: 'Can view' },
];

export function ShareDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: DocumentDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ShareRole>('editor');
  const [error, setError] = useState<string | null>(null);

  const shares = useQuery({
    queryKey: docKeys.shares(doc.id),
    queryFn: () => api<SharesResponse>(`/api/documents/${doc.id}/shares`),
    enabled: open,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: docKeys.shares(doc.id) });
    void qc.invalidateQueries({ queryKey: docKeys.list });
    // Safe while editing: the editor is keyed by id and only reads content on mount.
    void qc.invalidateQueries({ queryKey: docKeys.detail(doc.id) });
  };

  const upsert = useMutation({
    mutationFn: (input: ShareRequest) =>
      api<{ share: Share }>(`/api/documents/${doc.id}/shares`, { method: 'PUT', body: input }).then((r) => r.share),
    onSuccess: refresh,
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => api<void>(`/api/documents/${doc.id}/shares/${userId}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = ShareRequestSchema.safeParse({ email, role });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Enter a valid email');
    upsert.mutate(parsed.data, {
      onSuccess: (share) => {
        toast.success(`${share.user.name} ${share.role === 'editor' ? 'can now edit' : 'can now view'} “${doc.title}”`);
        setEmail('');
      },
      onError: (err) => setError(isApiError(err) ? err.message : 'Sharing failed. Try again.'),
    });
  };

  const changeRole = (share: Share, next: ShareRole) =>
    upsert.mutate(
      { email: share.user.email, role: next },
      {
        onSuccess: () => toast.success(`${share.user.name} ${next === 'editor' ? 'can now edit' : 'can now only view'}`),
        onError: (err) => toast.error(isApiError(err) ? err.message : 'Update failed'),
      },
    );

  const remove = (share: Share) =>
    revoke.mutate(share.user.id, {
      onSuccess: () => toast.success(`Removed ${share.user.name}`),
      onError: (err) => toast.error(isApiError(err) ? err.message : 'Remove failed'),
    });

  const taken = new Set([me.email, ...(shares.data?.shares.map((s) => s.user.email) ?? [])]);
  const suggestions = DEMO_ACCOUNTS.filter((a) => !taken.has(a.email));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      width="max-w-lg"
      title={`Share “${doc.title}”`}
      description="People you add see it under Shared with me. Editors can change the text and title; viewers can only read."
    >
      <form onSubmit={submit} className="grid gap-2" noValidate>
        <label htmlFor="share-email" className="text-sm font-medium">
          Add people by email
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="share-email"
            type="email"
            autoFocus
            placeholder="name@ajaia.test"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={!!error}
          />
          <select
            aria-label="Permission"
            value={role}
            onChange={(e) => setRole(e.target.value as ShareRole)}
            className="h-10 rounded-lg border border-line bg-paper px-2 text-sm"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="primary" loading={upsert.isPending && !!email}>
            Share
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {suggestions.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            Demo teammates:
            {suggestions.map((s) => (
              <button
                key={s.email}
                type="button"
                onClick={() => {
                  setEmail(s.email);
                  setError(null);
                }}
                className="rounded-full border border-line px-2 py-0.5 text-ink hover:border-accent hover:bg-accent-wash"
              >
                {s.name}
              </button>
            ))}
          </p>
        )}
      </form>

      <h3 className="mt-6 text-sm font-semibold">People with access</h3>
      {shares.isPending ? (
        <div className="flex justify-center py-6 text-muted">
          <Spinner className="size-5" />
        </div>
      ) : shares.isError ? (
        <p className="py-4 text-sm text-danger">Couldn't load who has access.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          <li className="flex items-center gap-3 py-2.5">
            <Avatar name={shares.data.owner.name} size={32} />
            <PersonLabel name={shares.data.owner.name} email={shares.data.owner.email} you={shares.data.owner.id === me.id} />
            <span className="text-sm text-muted">Owner</span>
          </li>
          {shares.data.shares.map((share) => (
            <li key={share.user.id} className="flex items-center gap-3 py-2.5">
              <Avatar name={share.user.name} size={32} />
              <PersonLabel name={share.user.name} email={share.user.email} />
              <select
                aria-label={`Permission for ${share.user.name}`}
                value={share.role}
                onChange={(e) => changeRole(share, e.target.value as ShareRole)}
                className="h-8 rounded-lg border border-transparent bg-transparent px-1 text-sm hover:border-line"
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => remove(share)}
                aria-label={`Remove ${share.user.name}`}
                title="Remove access"
                className="rounded-md p-1.5 text-muted hover:bg-danger-wash hover:text-danger"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
          {shares.data.shares.length === 0 && (
            <li className="py-3 text-sm text-muted">Only you can open this document right now.</li>
          )}
        </ul>
      )}
    </Modal>
  );
}

function PersonLabel({ name, email, you }: { name: string; email: string; you?: boolean }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium">
        {name}
        {you && <span className="font-normal text-muted"> (you)</span>}
      </span>
      <span className="block truncate text-xs text-muted">{email}</span>
    </span>
  );
}
