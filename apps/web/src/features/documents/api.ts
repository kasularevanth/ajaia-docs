import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentDetail, DocumentSummary } from '@ajaia/shared';
import { api, ApiError } from '../../lib/api';

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
    queryFn: () => api<{ documents: DocumentSummary[] }>('/api/documents').then((r) => r.documents),
    refetchOnMount: 'always',
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: docKeys.detail(id),
    queryFn: () => api<{ document: DocumentDetail }>(`/api/documents/${id}`).then((r) => r.document),
    retry: noRetryOn([400, 401, 403, 404]),
    // The editor owns content while open; don't clobber it with background refetches.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    // Drop the cached copy as soon as the editor closes, so reopening always shows the latest server state.
    gcTime: 0,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ document: DocumentDetail }>('/api/documents', { method: 'POST', body: {} }).then((r) => r.document),
    onSuccess: (doc) => {
      qc.setQueryData(docKeys.detail(doc.id), doc);
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
    onSuccess: (doc) => {
      qc.setQueryData(docKeys.detail(doc.id), doc);
      void qc.invalidateQueries({ queryKey: docKeys.list });
    },
  });
}

export function useRenameDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api<{ document: DocumentDetail }>(`/api/documents/${id}`, { method: 'PATCH', body: { title } }).then(
        (r) => r.document,
      ),
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
