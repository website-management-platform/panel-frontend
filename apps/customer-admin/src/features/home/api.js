import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/http";
import { queryKeys } from "@/api/queryKeys";

// Sözleşme: docs/backend/14-operations.md §1 (ana ekran kartları). Site değişince anahtar değiştiği için yeniden yüklenir.
export const useDashboard = (siteId) => useQuery({
  queryKey: queryKeys.customer.dashboard(siteId),
  queryFn: ({ signal }) => api.get(`/customer/sites/${siteId}/dashboard`, { signal }),
  enabled: Boolean(siteId),
  refetchOnWindowFocus: true,
});
