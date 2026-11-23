/**
 * Tracks save requests that are still in flight, per document.
 *
 * Leaving the editor flushes unsaved edits with a final PATCH. If the user immediately reopens the
 * document (or lands on the dashboard), the next read must not race that write — so reads await
 * any pending saves first. This is what makes "edit → back → reopen" always show the latest text.
 */
const pending = new Map<string, Set<Promise<void>>>();

export function trackSave(docId: string, request: Promise<unknown>): void {
  let set = pending.get(docId);
  if (!set) {
    set = new Set();
    pending.set(docId, set);
  }
  const bucket = set;
  const settled: Promise<void> = request.then(
    () => undefined,
    () => undefined,
  );
  bucket.add(settled);
  void settled.then(() => {
    bucket.delete(settled);
    if (bucket.size === 0 && pending.get(docId) === bucket) pending.delete(docId);
  });
}

/** Resolves once every in-flight save (for one document, or all documents) has settled. */
export async function waitForPendingSaves(docId?: string): Promise<void> {
  // Yield one macrotask first: saves fired from unmount cleanups (e.g. a mutation started as the
  // editor closes) register within microtasks, and must be visible to this read.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const promises = docId
    ? [...(pending.get(docId) ?? [])]
    : [...pending.values()].flatMap((set) => [...set]);
  await Promise.all(promises);
}
