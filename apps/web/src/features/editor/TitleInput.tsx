import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DEFAULT_TITLE, MAX_TITLE_LENGTH, TitleSchema } from '@ajaia/shared';
import { isApiError } from '../../lib/api';
import { useRenameDocument } from '../documents/api';

/** Inline rename: commits on blur or Enter, reverts on Escape. */
export function TitleInput({ docId, title, canEdit }: { docId: string; title: string; canEdit: boolean }) {
  const [value, setValue] = useState(title);
  const committed = useRef(title);
  const rename = useRenameDocument();

  useEffect(() => {
    document.title = `${value.trim() || DEFAULT_TITLE} – Ajaia Docs`;
    return () => {
      document.title = 'Ajaia Docs';
    };
  }, [value]);

  const commit = () => {
    const next = value.trim() || DEFAULT_TITLE;
    if (next === committed.current) return setValue(next);
    const parsed = TitleSchema.safeParse(next);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid title');
      return setValue(committed.current);
    }
    setValue(parsed.data);
    rename.mutate(
      { id: docId, title: parsed.data },
      {
        onSuccess: (doc) => {
          committed.current = doc.title;
        },
        onError: (err) => {
          toast.error(isApiError(err) ? err.message : "Couldn't rename the document");
          setValue(committed.current);
        },
      },
    );
  };

  return (
    <input
      value={value}
      readOnly={!canEdit}
      maxLength={MAX_TITLE_LENGTH}
      aria-label="Document title"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => canEdit && commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          setValue(committed.current);
          const el = e.currentTarget;
          requestAnimationFrame(() => el.blur());
        }
      }}
      className="w-full min-w-0 truncate rounded-md border border-transparent bg-transparent px-2 py-1 font-serif text-xl font-medium transition-colors read-only:cursor-default hover:enabled:not-read-only:border-line focus:border-accent focus:bg-paper focus:outline-none"
    />
  );
}
