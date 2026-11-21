// Sözleşme: docs/backend/08-publishing.md §6 (önizleme)
// Önizleme yanıtı oturumla değil belirteçle okunur (sitenin ön yüzü de böyle okur).
export const fetchPreview = async ({ publicKey, moduleKey, entryId, locale, token }) => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "/api/v1"}/preview/sites/${publicKey}/content/${moduleKey}/${entryId}?locale=${encodeURIComponent(locale)}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "omit",
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(body?.detail ?? "Önizleme açılamadı."), { status: response.status, code: body?.code });
  return body;
};
