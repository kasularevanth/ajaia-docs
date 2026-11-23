import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocumentDetail, JSONContent } from '@ajaia/shared';
import { api, isApiError } from '../../lib/api';
import { trackSave } from '../../lib/pendingSaves';

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
 *
 * - `dirty` tracks edits not yet included in a save — independent of the UI state, so edits typed
 *   while a save is in flight are never dropped.
 * - At most one request in flight; anything typed meanwhile is saved right after it lands.
 * - 409 → 'conflict' (paused until the user picks Load theirs / Keep mine). A 409 whose content
 *   already matches the server is treated as saved.
 * - Network / 5xx → 'offline' with exponential backoff.
 * - Leaving the editor flushes unsaved edits *after* any in-flight save (so it uses the right
 *   version), and every save is registered with `trackSave` so the next read waits for it.
 */
export function useAutosave({ docId, initialVersion, getContent, onSaved }: Options) {
  const [state, setStateValue] = useState<SaveState>('saved');
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef<SaveState>('saved');
  const versionRef = useRef(initialVersion);
  const timer = useRef<number | undefined>(undefined);
  const dirty = useRef(false);
  const latestContent = useRef<JSONContent | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const disposed = useRef(false);
  const backoff = useRef(1000);
  const getContentRef = useRef(getContent);
  const onSavedRef = useRef(onSaved);
  getContentRef.current = getContent;
  onSavedRef.current = onSaved;

  const setState = (s: SaveState) => {
    stateRef.current = s;
    if (!disposed.current) setStateValue(s);
  };
  const snapshot = () => latestContent.current ?? getContentRef.current();

  const save = useCallback(async (): Promise<void> => {
    window.clearTimeout(timer.current);
    if (disposed.current || stateRef.current === 'conflict') return;
    if (inFlight.current) return; // the in-flight save re-saves on completion if needed
    const retrying = stateRef.current === 'error' || stateRef.current === 'offline';
    if (!dirty.current && !retrying) return;

    dirty.current = false;
    const content = snapshot();
    setState('saving');

    const request = api<{ document: DocumentDetail }>(`/api/documents/${docId}`, {
      method: 'PATCH',
      body: { content, baseVersion: versionRef.current },
    });
    trackSave(docId, request);

    const run = (async () => {
      try {
        const { document } = await request;
        versionRef.current = document.version;
        backoff.current = 1000;
        setError(null);
        onSavedRef.current?.(document);
        setState(dirty.current ? 'dirty' : 'saved');
      } catch (err) {
        if (isApiError(err, 'VERSION_CONFLICT')) {
          const latest = await api<{ document: DocumentDetail }>(`/api/documents/${docId}`).catch(() => null);
          if (latest && JSON.stringify(latest.document.content) === JSON.stringify(content)) {
            versionRef.current = latest.document.version;
            onSavedRef.current?.(latest.document);
            setState(dirty.current ? 'dirty' : 'saved');
          } else {
            dirty.current = true;
            setState('conflict');
          }
        } else if (isApiError(err) && (err.code === 'NETWORK' || err.status >= 500)) {
          dirty.current = true;
          setState('offline');
          timer.current = window.setTimeout(() => void save(), backoff.current);
          backoff.current = Math.min(backoff.current * 2, MAX_BACKOFF_MS);
        } else {
          dirty.current = true;
          setError(isApiError(err) ? err.message : 'Your changes could not be saved');
          setState('error');
        }
      }
    })();

    inFlight.current = run;
    await run;
    inFlight.current = null;
    if (dirty.current && stateRef.current === 'dirty' && !disposed.current) void save();
  }, [docId]);

  const markDirty = useCallback(() => {
    latestContent.current = getContentRef.current();
    dirty.current = true;
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
        latestContent.current = document.content;
        dirty.current = false;
        onSavedRef.current?.(document);
        setState('saved');
      } else {
        dirty.current = true;
        setState('dirty');
        await save();
      }
    },
    [docId, save],
  );

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current || stateRef.current === 'saving') e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Leaving the editor inside the app: flush unsaved edits after any in-flight save settles.
  useEffect(() => {
    disposed.current = false; // reset for React StrictMode's dev-only remount
    return () => {
      window.clearTimeout(timer.current);
      disposed.current = true;
      if (!dirty.current || stateRef.current === 'conflict') return;
      const content = snapshot();
      const flush = (inFlight.current ?? Promise.resolve()).then(() =>
        api(`/api/documents/${docId}`, {
          method: 'PATCH',
          body: { content, baseVersion: versionRef.current },
        }),
      );
      trackSave(docId, flush);
    };
  }, [docId]);

  return { state, error, save, markDirty, resolveConflict };
}
