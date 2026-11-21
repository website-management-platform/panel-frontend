import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/http";
import { queryKeys } from "@/api/queryKeys";

// Sözleşme: docs/backend/13-forms.md §3 (müşteri gelen kutusu)
const keys = queryKeys.customer;
const base = (siteId) => `/customer/sites/${siteId}/forms`;

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export const useForms = (siteId, { enabled = true } = {}) => useQuery({
  queryKey: keys.forms(siteId),
  queryFn: ({ signal }) => api.get(base(siteId), { signal }),
  enabled: Boolean(siteId) && enabled,
});

export const useSubmissions = (siteId, formKey, params) => useQuery({
  queryKey: keys.formSubmissions(siteId, formKey, params),
  queryFn: ({ signal }) => api.get(`${base(siteId)}/${formKey}/submissions`, { query: params, signal }),
  placeholderData: keepPreviousData,
  enabled: Boolean(siteId && formKey),
});

export const useSubmission = (siteId, formKey, submissionId) => useQuery({
  queryKey: keys.formSubmission(siteId, formKey, submissionId),
  queryFn: ({ signal }) => api.get(`${base(siteId)}/${formKey}/submissions/${submissionId}`, { signal }),
  enabled: Boolean(siteId && formKey && submissionId),
});

// Başvuru değişince liste, form sayaçları ve ana ekran özeti yenilenir.
const useInvalidate = (siteId, formKey) => {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["site", siteId, "forms", formKey, "submissions", "list"] }),
    queryClient.invalidateQueries({ queryKey: keys.forms(siteId), exact: true }),
    queryClient.invalidateQueries({ queryKey: keys.dashboard(siteId) }),
  ]);
};

export const useUpdateSubmission = (siteId, formKey) => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate(siteId, formKey);
  return useMutation({
    mutationFn: ({ submissionId, values, version }) => api.patch(`${base(siteId)}/${formKey}/submissions/${submissionId}`, values, { ifMatch: version }),
    onSuccess: (submission) => {
      queryClient.setQueryData(keys.formSubmission(siteId, formKey, submission.id), submission);
      return invalidate();
    },
  });
};

export const useDeleteSubmission = (siteId, formKey) => {
  const invalidate = useInvalidate(siteId, formKey);
  return useMutation({ mutationFn: (submissionId) => api.delete(`${base(siteId)}/${formKey}/submissions/${submissionId}`), onSuccess: invalidate });
};

export const useBulkSubmissions = (siteId, formKey) => {
  const invalidate = useInvalidate(siteId, formKey);
  return useMutation({ mutationFn: (body) => api.post(`${base(siteId)}/${formKey}/submissions/bulk`, body), onSuccess: invalidate });
};

export const attachmentUrl = (siteId, formKey, submissionId, attachmentId) => `${API_BASE}${base(siteId)}/${formKey}/submissions/${submissionId}/attachments/${attachmentId}`;
