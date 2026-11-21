import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/http";
import { queryKeys } from "@/api/queryKeys";

// Sözleşme: docs/backend/07-media.md
const keys = queryKeys.customer;
const base = (siteId) => `/customer/sites/${siteId}/assets`;

// İşlenmekte olan dosya varsa liste ve ayrıntı kısa aralıkla yenilenir (şartname §8.1: yükleme ve işleme durumu görünür).
const pollWhileProcessing = (items) => (items?.some((item) => item.status === "processing") ? 1500 : false);

export const useAssets = (siteId, params, { enabled = true } = {}) => useQuery({
  queryKey: keys.assets(siteId, params),
  queryFn: ({ signal }) => api.get(base(siteId), { query: { includeTotal: true, ...params }, signal }),
  placeholderData: keepPreviousData,
  enabled: Boolean(siteId) && enabled,
  refetchInterval: (query) => pollWhileProcessing(query.state.data?.items),
});

export const useAsset = (siteId, assetId) => useQuery({
  queryKey: keys.asset(siteId, assetId),
  queryFn: ({ signal }) => api.get(`${base(siteId)}/${assetId}`, { signal }),
  enabled: Boolean(siteId && assetId),
  refetchInterval: (query) => pollWhileProcessing(query.state.data ? [query.state.data] : []),
  retry: (count, error) => error?.status !== 404 && count < 2,
});

export const useAssetUsages = (siteId, assetId) => useQuery({
  queryKey: keys.assetUsages(siteId, assetId),
  queryFn: ({ signal }) => api.get(`${base(siteId)}/${assetId}/usages`, { signal }),
  enabled: Boolean(siteId && assetId),
});

export const useAssetFolders = (siteId) => useQuery({
  queryKey: keys.assetFolders(siteId),
  queryFn: ({ signal }) => api.get(`/customer/sites/${siteId}/asset-folders`, { signal }),
  enabled: Boolean(siteId),
});

const useInvalidateAssets = (siteId) => {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["site", siteId, "assets"] }),
    queryClient.invalidateQueries({ queryKey: keys.assetFolders(siteId) }),
  ]);
};

export const useUpdateAsset = (siteId, assetId) => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateAssets(siteId);
  return useMutation({
    mutationFn: ({ values, version }) => api.patch(`${base(siteId)}/${assetId}`, values, { ifMatch: version }),
    onSuccess: (asset) => {
      queryClient.setQueryData(keys.asset(siteId, assetId), asset);
      return invalidate();
    },
  });
};

export const useArchiveAsset = (siteId) => {
  const invalidate = useInvalidateAssets(siteId);
  return useMutation({
    mutationFn: ({ assetId, version }) => api.delete(`${base(siteId)}/${assetId}`, { ifMatch: version }),
    onSuccess: invalidate,
  });
};

export const useBulkAssets = (siteId) => {
  const invalidate = useInvalidateAssets(siteId);
  return useMutation({
    mutationFn: ({ action, ids, folderId }) => api.post(`${base(siteId)}/bulk`, { action, ids, ...(action === "move" ? { folderId } : {}) }),
    onSuccess: invalidate,
  });
};

export const useCreateFolder = (siteId) => {
  const invalidate = useInvalidateAssets(siteId);
  return useMutation({
    mutationFn: ({ name }) => api.post(`/customer/sites/${siteId}/asset-folders`, { name }),
    onSuccess: invalidate,
  });
};

export const useDeleteFolder = (siteId) => {
  const invalidate = useInvalidateAssets(siteId);
  return useMutation({
    mutationFn: ({ folderId, version }) => api.delete(`/customer/sites/${siteId}/asset-folders/${folderId}`, { ifMatch: version }),
    onSuccess: invalidate,
  });
};

export const createUpload = (siteId, values, idempotencyKey) => api.post(`${base(siteId)}/uploads`, values, { idempotencyKey });

export const finalizeUpload = (siteId, uploadId) => api.post(`${base(siteId)}/uploads/${uploadId}/finalize`, {});

export const useInvalidateAssetList = useInvalidateAssets;
