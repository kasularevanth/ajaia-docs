import { AlertCircle, Check, CloudOff } from 'lucide-react';
import { Spinner } from '../../components/ui';
import type { SaveState } from './useAutosave';

export function SaveStatus({ state, error, onRetry }: { state: SaveState; error: string | null; onRetry: () => void }) {
  const content = (() => {
    switch (state) {
      case 'saved':
        return (
          <>
            <Check className="size-4 text-success" /> Saved
          </>
        );
      case 'dirty':
        return <span className="text-muted">Unsaved changes</span>;
      case 'saving':
        return (
          <>
            <Spinner className="size-3.5 text-muted" /> Saving…
          </>
        );
      case 'offline':
        return (
          <>
            <CloudOff className="size-4 text-danger" /> Offline, retrying
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle className="size-4 text-danger" />
            <span title={error ?? undefined}>Not saved</span>
            <button type="button" onClick={onRetry} className="font-semibold text-accent underline underline-offset-2">
              Retry
            </button>
          </>
        );
      case 'conflict':
        return (
          <>
            <AlertCircle className="size-4 text-danger" /> Needs your attention
          </>
        );
    }
  })();

  return (
    <span role="status" aria-live="polite" className="flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap">
      {content}
    </span>
  );
}
