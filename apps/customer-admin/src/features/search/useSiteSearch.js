import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FiFileText, FiImage, FiLayout } from "react-icons/fi";
import { api } from "@/api/http";
import { queryKeys } from "@/api/queryKeys";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { labelIn } from "../content/labels";
import { useSiteScope } from "../sites/siteContext";

const EMPTY = { title: null, items: [], loading: false };
const PLACEHOLDER = "Sayfa, içerik veya dosya ara...";

/**
 * Komut paletinde site içi arama (şartname §18): kullanıcının okuyabildiği kayıtlar (taslak dahil) ve medya.
 * Form başvuruları aramaya girmez. En az 2 karakter; 300 ms gecikmeli istek.
 * Sözleşme: docs/backend/14-operations.md §2.
 */
export const useSiteSearch = (query) => {
  const scope = useSiteScope();
  const siteId = scope?.siteId;
  const term = useDebouncedValue(query, 300);
  const enabled = Boolean(siteId) && term.length >= 2;
  const result = useQuery({
    queryKey: queryKeys.customer.search(siteId, { q: term }),
    queryFn: ({ signal }) => api.get(`/customer/sites/${siteId}/search`, { query: { q: term, limit: 12 }, signal }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const defaultLocale = scope?.site.defaultLocale;
  if (!siteId) return EMPTY;
  if (query.length < 2) return { ...EMPTY, placeholder: PLACEHOLDER };
  const items = enabled && result.data ? result.data.items.map((item) => ({
    id: `${item.type}-${item.id}`,
    label: item.title,
    hint: item.type === "asset" ? "Medya" : `${labelIn(item.module.label, defaultLocale)}${item.isPublished ? "" : " · taslak"}`,
    path: item.link,
    icon: item.type === "asset" ? FiImage : item.module.area === "site" ? FiLayout : FiFileText,
  })) : [];
  return { title: "Bu sitede", items, loading: term !== query || (enabled && result.isFetching), placeholder: PLACEHOLDER };
};
