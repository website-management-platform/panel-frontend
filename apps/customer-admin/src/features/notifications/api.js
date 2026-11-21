import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/http";
import { queryKeys } from "@/api/queryKeys";

// Sözleşme: docs/backend/14-operations.md §3 (panel içi bildirimler)
const keys = queryKeys.customer;
const base = (siteId) => `/customer/sites/${siteId}`;
const POLL_MS = 60_000;

export const useNotificationSummary = (siteId) => useQuery({
  queryKey: keys.notificationSummary(siteId),
  queryFn: ({ signal }) => api.get(`${base(siteId)}/notifications/summary`, { signal }),
  enabled: Boolean(siteId),
  refetchInterval: POLL_MS,
  refetchIntervalInBackground: false,
});

export const useNotifications = (siteId, { enabled }) => useQuery({
  queryKey: keys.notifications(siteId, { size: 15 }),
  queryFn: ({ signal }) => api.get(`${base(siteId)}/notifications`, { query: { size: 15 }, signal }),
  enabled: Boolean(siteId) && enabled,
});

const useInvalidate = (siteId) => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["site", siteId, "notifications"] });
};

export const useMarkNotification = (siteId) => {
  const invalidate = useInvalidate(siteId);
  return useMutation({ mutationFn: ({ id, read }) => api.patch(`${base(siteId)}/notifications/${id}`, { read }), onSuccess: invalidate });
};

export const useMarkAllRead = (siteId) => {
  const invalidate = useInvalidate(siteId);
  return useMutation({ mutationFn: () => api.post(`${base(siteId)}/notifications/read-all`, {}), onSuccess: invalidate });
};
