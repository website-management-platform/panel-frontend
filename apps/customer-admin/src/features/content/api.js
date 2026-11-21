import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/http";
import { queryKeys } from "@/api/queryKeys";

// Sözleşme: docs/backend/06-content.md (kayıtlar), 05-schema.md §11 (etkin şema)
const keys = queryKeys.customer;
const base = (siteId, moduleKey) => `/customer/sites/${siteId}/modules/${moduleKey}`;

export const useModuleSchema = (siteId, moduleKey) => useQuery({
  queryKey: keys.moduleSchema(siteId, moduleKey),
  queryFn: ({ signal }) => api.get(`${base(siteId, moduleKey)}/schema`, { signal }),
  enabled: Boolean(siteId && moduleKey),
});

export const useEntries = (siteId, moduleKey, params, { enabled = true } = {}) => useQuery({
  queryKey: keys.entries(siteId, moduleKey, params),
  queryFn: ({ signal }) => api.get(`${base(siteId, moduleKey)}/entries`, { query: { includeTotal: true, ...params }, signal }),
  placeholderData: keepPreviousData,
  enabled: Boolean(siteId && moduleKey) && enabled,
});

export const useEntry = (siteId, moduleKey, entryId) => useQuery({
  queryKey: keys.entry(siteId, moduleKey, entryId),
  queryFn: ({ signal }) => api.get(`${base(siteId, moduleKey)}/entries/${entryId}`, { signal }),
  enabled: Boolean(siteId && moduleKey && entryId),
});

// Kayıt değişince bölümün listeleri, kaydın geçmişi ve ana ekrandaki sayılar yenilenir.
const useInvalidateModule = (siteId, moduleKey) => {
  const queryClient = useQueryClient();
  return (entryId) => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["site", siteId, "modules", moduleKey, "entries", "list"] }),
    queryClient.invalidateQueries({ queryKey: keys.bootstrap(siteId) }),
    queryClient.invalidateQueries({ queryKey: keys.dashboard(siteId) }),
    ...(entryId ? [queryClient.invalidateQueries({ queryKey: keys.entryRevisions(siteId, moduleKey, entryId) })] : []),
  ]);
};

const useEntryMutation = (siteId, moduleKey, request) => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateModule(siteId, moduleKey);
  return useMutation({
    mutationFn: request,
    onSuccess: (entry) => {
      if (entry?.id) queryClient.setQueryData(keys.entry(siteId, moduleKey, entry.id), entry);
      return invalidate(entry?.id);
    },
  });
};

export const useCreateEntry = (siteId, moduleKey) => useEntryMutation(siteId, moduleKey, ({ values, parentId, idempotencyKey }) => (
  api.post(`${base(siteId, moduleKey)}/entries`, { values, ...(parentId ? { parentId } : {}) }, { idempotencyKey })
));

export const useUpdateEntry = (siteId, moduleKey, entryId) => useEntryMutation(siteId, moduleKey, ({ set, unset, version }) => (
  api.patch(`${base(siteId, moduleKey)}/entries/${entryId}`, { set, unset }, { ifMatch: version })
));

export const useEntryAction = (siteId, moduleKey) => useEntryMutation(siteId, moduleKey, ({ entryId, action, body = {}, version, idempotencyKey }) => (
  api.post(`${base(siteId, moduleKey)}/entries/${entryId}/actions/${action}`, body, action === "duplicate" ? { idempotencyKey } : { ifMatch: version })
));

// Geçmiş (şartname §10, §15): revizyonlar yeniden eskiye; geri yükleme yeni taslak revizyon üretir, canlıya dokunmaz.
export const useEntryRevisions = (siteId, moduleKey, entryId, { enabled = true } = {}) => useQuery({
  queryKey: keys.entryRevisions(siteId, moduleKey, entryId),
  queryFn: ({ signal }) => api.get(`${base(siteId, moduleKey)}/entries/${entryId}/revisions`, { signal }),
  enabled: Boolean(entryId) && enabled,
});

export const useEntryRevision = (siteId, moduleKey, entryId, revisionId) => useQuery({
  queryKey: keys.entryRevision(siteId, moduleKey, entryId, revisionId),
  queryFn: ({ signal }) => api.get(`${base(siteId, moduleKey)}/entries/${entryId}/revisions/${revisionId}`, { signal }),
  enabled: Boolean(entryId && revisionId),
  staleTime: Infinity,
});

export const useRestoreRevision = (siteId, moduleKey, entryId) => useEntryMutation(siteId, moduleKey, ({ revisionId, version }) => (
  api.post(`${base(siteId, moduleKey)}/entries/${entryId}/revisions/${revisionId}/restore`, {}, { ifMatch: version })
));

export const useReorderEntries = (siteId, moduleKey) => {
  const invalidate = useInvalidateModule(siteId, moduleKey);
  return useMutation({
    mutationFn: ({ parentId = null, orderedIds, listVersion }) => api.post(`${base(siteId, moduleKey)}/reorder`, { parentId, orderedIds, listVersion }),
    onSettled: invalidate,
  });
};

export const useBulkEntries = (siteId, moduleKey) => {
  const invalidate = useInvalidateModule(siteId, moduleKey);
  return useMutation({
    mutationFn: ({ action, ids }) => api.post(`${base(siteId, moduleKey)}/bulk`, { action, ids }),
    onSuccess: invalidate,
  });
};
