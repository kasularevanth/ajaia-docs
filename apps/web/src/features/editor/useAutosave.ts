import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocumentDetail, JSONContent } from '@ajaia/shared';
import { api, isApiError } from '../../lib/api';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'offline' | 'error' | 'conflict';

const DEBOUNCE_MS = 800;
const MAX_BACKOFF_MS = 15_000;

interface Options {
  docId: string;
  initialVersion: number;
  getContent: () => JSONContent;
  onSaved?: (doc: DocumentDetail) => void;
}

/**
 * Debounced autosave with optimistic concurrency.
 * - At most one request in flight; edits made meanwhile are saved right after it lands.
 * - 409 → 'conflict' (stops saving until the user chooses Reload or Overwrite).
 * - Network/5xx → 'offline' with exponential backoff.
 * - Unsaved changes are flushed with `keepalive` when the editor unmounts, and guarded on tab close.
 */
export function useAutosave({ docId, initialVersion, getContent, onSaved }: Options) {
  const [state, setStateValue] = useState<SaveState>('saved');
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef<SaveState>('saved');
  const versionRef = useRef(initialVersion);
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef(false);
  const queued = useRef(false);
  const backoff = useRef(1000);
  const getContentRef = useRef(getContent);
  const onSavedRef = useRef(onSaved);
  getContentRef.current = getContent;
  onSavedRef.current = onSaved;

  const setState = (s: SaveState) => {
    stateRef.current = s;
    setStateValue(s);
  };

  const save = useCallback(async (): Promise<void> => {
    window.clearTimeout(timer.current);
    if (stateRef.current === 'conflict') return;
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    queued.current = false;
    setState('saving');
    try {
      const { document } = await api<{ document: DocumentDetail }>(`/api/documents/${docId}`, {
        method: 'PATCH',
        body: { content: getContentRef.current(), baseVersion: versionRef.current },
      });
      versionRef.current = document.version;
      backoff.current = 1000;
      setError(null);
      onSavedRef.current?.(document);
      setState(queued.current ? 'dirty' : 'saved');
    } catch (err) {
      queued.current = false;
      if (isApiError(err, 'VERSION_CONFLICT')) {
        // A "conflict" whose content already matches the server (e.g. a duplicate save) isn't a real one.
        const latest = await api<{ document: DocumentDetail }>(`/api/documents/${docId}`).catch(() => null);
        if (latest && JSON.stringify(latest.document.content) === JSON.stringify(getContentRef.current())) {
          versionRef.current = latest.document.version;
          onSavedRef.current?.(latest.document);
          setState('saved');
        } else {
          setState('conflict');
        }
      } else if (isApiError(err) && (err.code === 'NETWORK' || err.status >= 500)) {
        setState('offline');
        timer.current = window.setTimeout(() => void save(), backoff.current);
        backoff.current = Math.min(backoff.current * 2, MAX_BACKOFF_MS);
      } else {
        setError(isApiError(err) ? err.message : 'Your changes could not be saved');
        setState('error');
      }
    } finally {
      inFlight.current = false;
    }
    if (queued.current) void save();
  }, [docId]);

  const markDirty = useCallback(() => {
    if (stateRef.current === 'conflict') return;
    if (stateRef.current !== 'saving') setState('dirty');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), DEBOUNCE_MS);
  }, [save]);

  /** Resolve a 409: take the server copy, or re-save local content on top of the latest version. */
  const resolveConflict = useCallback(
    async (mode: 'reload' | 'overwrite', applyServerContent: (content: JSONContent) => void) => {
      const { document } = await api<{ document: DocumentDetail }>(`/api/documents/${docId}`);
      versionRef.current = document.version;
      if (mode === 'reload') {
        applyServerContent(document.content);
        onSavedRef.current?.(document);
        setState('saved');
      } else {
        setState('dirty');
        await save();
      }
    },
    [docId, save],
  );

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (['dirty', 'saving', 'offline', 'error'].includes(stateRef.current)) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Flush pending edits when navigating away inside the app.
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (stateRef.current === 'dirty' || stateRef.current === 'offline') {
        void api(`/api/documents/${docId}`, {
          method: 'PATCH',
          body: { content: getContentRef.current(), baseVersion: versionRef.current },
          keepalive: true,
        }).catch(() => undefined);
      }
    },
    [docId],
  );

  return { state, error, save, markDirty, resolveConflict };
}
