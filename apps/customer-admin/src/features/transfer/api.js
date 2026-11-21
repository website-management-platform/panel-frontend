import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/http";
import { queryKeys } from "@/api/queryKeys";

// Sözleşme: docs/backend/14-operations.md §4 (dışa aktarma)
const keys = queryKeys.customer;
const base = (siteId) => `/customer/sites/${siteId}`;
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

const ACTIVE = ["pending"];
// Hazırlanan iş varken liste 2 sn'de bir yenilenir; iş bitince sorgu durur.
const pollWhileActive = (query) => ((query.state.data?.items ?? []).some((item) => ACTIVE.includes(item.status)) ? 2000 : false);

export const useExports = (siteId, { enabled }) => useQuery({
  queryKey: keys.exports(siteId),
  queryFn: ({ signal }) => api.get(`${base(siteId)}/exports`, { signal }),
  enabled: Boolean(siteId) && enabled,
  refetchInterval: pollWhileActive,
});

export const useCreateExport = (siteId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }) => api.post(`${base(siteId)}/exports`, body, { idempotencyKey }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.exports(siteId) }),
  });
};

export const exportDownloadUrl = (siteId, exportId) => `${API_BASE}${base(siteId)}/exports/${exportId}/download`;
