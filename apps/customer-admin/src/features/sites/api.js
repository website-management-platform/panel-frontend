import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/http";
import { queryKeys } from "@/api/queryKeys";

// Sözleşme: docs/backend/02-tenancy.md (müşteri uçları)
export const useCustomerSites = () => useQuery({
  queryKey: queryKeys.customer.sites(),
  queryFn: ({ signal }) => api.get("/customer/sites", { signal }),
});

export const useSiteBootstrap = (siteId) => useQuery({
  queryKey: queryKeys.customer.bootstrap(siteId),
  queryFn: ({ signal }) => api.get(`/customer/sites/${siteId}/bootstrap`, { signal }),
  enabled: Boolean(siteId),
});
