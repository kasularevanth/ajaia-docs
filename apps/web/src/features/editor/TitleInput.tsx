import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DEFAULT_TITLE, MAX_TITLE_LENGTH, TitleSchema } from '@ajaia/shared';
import { isApiError } from '../../lib/api';
import { useRenameDocument } from '../documents/api';

const AUTO_COMMIT_MS = 1000;

/**
 * Inline rename. The title saves itself ~1s after typing stops (like the body), on blur / Enter,
 * and — so a rename is never lost — when the editor closes by any route (Back link, browser back,
 * keyboard). Escape reverts to the last saved title.
 */
export function TitleInput({ docId, title, canEdit }: { docId: string; title: string; canEdit: boolean }) {
  const [value, setValue] = useState(title);
  const valueRef = useRef(title);
  const committed = useRef(title);
  const rename = useRenameDocument();
  const renameRef = useRef(rename.mutate);
  renameRef.current = rename.mutate;
  valueRef.current = value;

  useEffect(() => {
    document.title = `${value.trim() || DEFAULT_TITLE} – Ajaia Docs`;
    return () => {
      document.title = 'Ajaia Docs';
    };
  }, [value]);

  /** Saves the current text if it changed. `interactive` shows validation errors and normalizes the field. */
  const commit = (interactive: boolean) => {
    const next = valueRef.current.trim() || DEFAULT_TITLE;
    if (interactive) setValue(next);
    if (next === committed.current) return;
    const parsed = TitleSchema.safeParse(next);
    if (!parsed.success) {
      if (interactive) {
        toast.error(parsed.error.issues[0]?.message ?? 'Invalid title');
        setValue(committed.current);
      }
      return;
    }
    const previous = committed.current;
    committed.current = parsed.data; // optimistic: avoids duplicate sends from blur + debounce
    renameRef.current(
      { id: docId, title: parsed.data },
      {
        onError: (err) => {
          committed.current = previous;
          setValue(previous);
          toast.error(isApiError(err) ? err.message : "Couldn't rename the document");
        },
      },
    );
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;

  // Auto-save the title shortly after typing stops.
  useEffect(() => {
    if (!canEdit || value.trim() === committed.current) return;
    const timer = window.setTimeout(() => commitRef.current(false), AUTO_COMMIT_MS);
    return () => window.clearTimeout(timer);
  }, [value, canEdit]);

  // Flush a pending rename when the editor closes, whichever way the user leaves.
  useEffect(
    () => () => {
      if (canEdit) commitRef.current(false);
    },
    [canEdit],
  );

  return (
    <input
      value={value}
      readOnly={!canEdit}
      maxLength={MAX_TITLE_LENGTH}
      aria-label="Document title"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => canEdit && commit(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          valueRef.current = committed.current;
          setValue(committed.current);
          const el = e.currentTarget;
          requestAnimationFrame(() => el.blur());
        }
      }}
      className="w-full min-w-0 truncate rounded-md border border-transparent bg-transparent px-2 py-1 font-serif text-xl font-medium transition-colors read-only:cursor-default hover:enabled:not-read-only:border-line focus:border-accent focus:bg-paper focus:outline-none"
    />
  );
}
