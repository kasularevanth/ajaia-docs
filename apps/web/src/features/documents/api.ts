import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentDetail, DocumentSummary } from '@ajaia/shared';
import { api, ApiError } from '../../lib/api';
import { trackSave, waitForPendingSaves } from '../../lib/pendingSaves';

export const docKeys = {
  list: ['documents'] as const,
  detail: (id: string) => ['document', id] as const,
  shares: (id: string) => ['shares', id] as const,
};

const noRetryOn = (codes: number[]) => (count: number, err: unknown) =>
  !(err instanceof ApiError && codes.includes(err.status)) && count < 2;

export function useDocuments() {
  return useQuery({
    queryKey: docKeys.list,
    queryFn: async () => {
      await waitForPendingSaves(); // previews/titles must reflect edits flushed on the way out
      return api<{ documents: DocumentSummary[] }>('/api/documents').then((r) => r.documents);
    },
    refetchOnMount: 'always',
  });
}

/**
 * Opening a document always reads the latest server copy (after any in-flight save of it):
 * staleTime 0 + refetchOnMount 'always', and EditorPage only mounts the editor once this
 * mount's fetch has completed. Nothing is pre-seeded into this cache on create/import.
 */
export function useDocument(id: string) {
  return useQuery({
    queryKey: docKeys.detail(id),
    queryFn: async () => {
      await waitForPendingSaves(id);
      return api<{ document: DocumentDetail }>(`/api/documents/${id}`).then((r) => r.document);
    },
    retry: noRetryOn([400, 401, 403, 404]),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    // While the editor is open it owns the content; background refetches would be ignored anyway.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ document: DocumentDetail }>('/api/documents', { method: 'POST', body: {} }).then((r) => r.document),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: docKeys.list });
    },
  });
}

export function useImportDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api<{ document: DocumentDetail }>('/api/documents/import', { method: 'POST', formData }).then(
        (r) => r.document,
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: docKeys.list });
    },
  });
}

export function useRenameDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => {
      const request = api<{ document: DocumentDetail }>(`/api/documents/${id}`, {
        method: 'PATCH',
        body: { title },
      }).then((r) => r.document);
      trackSave(id, request); // a rename committed on blur (e.g. clicking Back) must land before the next read
      return request;
    },
    onSuccess: (doc) => {
      qc.setQueryData<DocumentDetail>(docKeys.detail(doc.id), (old) => (old ? { ...old, title: doc.title } : old));
      qc.setQueryData<DocumentSummary[]>(docKeys.list, (old) =>
        old?.map((d) => (d.id === doc.id ? { ...d, title: doc.title, updatedAt: doc.updatedAt } : d)),
      );
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/documents/${id}`, { method: 'DELETE' }),
    onSuccess: (_void, id) => {
      qc.setQueryData<DocumentSummary[]>(docKeys.list, (old) => old?.filter((d) => d.id !== id));
      qc.removeQueries({ queryKey: docKeys.detail(id) });
    },
  });
}

/** A collaborator removes a shared document from their own list. */
export function useLeaveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      api<void>(`/api/documents/${id}/shares/${userId}`, { method: 'DELETE' }),
    onSuccess: (_void, { id }) => {
      qc.setQueryData<DocumentSummary[]>(docKeys.list, (old) => old?.filter((d) => d.id !== id));
      qc.removeQueries({ queryKey: docKeys.detail(id) });
    },
  });
}
