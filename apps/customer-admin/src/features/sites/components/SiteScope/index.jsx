import { useEffect, useMemo, useRef } from "react";
import { Navigate, Outlet, useMatch } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import FullPageState from "@/components/FullPageState";
import { toast } from "@/components/Toast/toast";
import { isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useCurrentUser } from "@/auth/api";
import ServerError from "@/pages/ServerError";
import { useSiteBootstrap } from "../../api";
import { SiteContext, clearLastSiteId, readLastSiteId, writeLastSiteId } from "../../siteContext";

/**
 * Müşteri panelinin site bağlamı: adres /siteler/:siteId ile başlıyorsa sitenin bootstrap'ı yüklenir ve
 * sayfalar useSiteScope ile siteye, role ve izinlere ulaşır. Site değişince önceki sitenin önbelleği silinir
 * (eski sitenin verisi yeni sitede görünmez; şartname §12, AT-08).
 */
const SiteScope = () => {
  const siteId = useMatch("/siteler/:siteId/*")?.params.siteId ?? null;
  const bootstrapQuery = useSiteBootstrap(siteId);
  const queryClient = useQueryClient();
  const userId = useCurrentUser()?.id;
  const previousSiteIdRef = useRef(siteId);

  useEffect(() => {
    const previous = previousSiteIdRef.current;
    previousSiteIdRef.current = siteId;
    if (previous && previous !== siteId) queryClient.removeQueries({ queryKey: queryKeys.customer.siteScope(previous) });
  }, [siteId, queryClient]);

  useEffect(() => {
    if (siteId && userId && bootstrapQuery.isSuccess) writeLastSiteId(userId, siteId);
  }, [siteId, userId, bootstrapQuery.isSuccess]);

  // Erişilemeyen site (kaldırılmış, askıda, başkasının ya da eski bir bağlantı): kullanıcı hata ekranında kalmaz,
  // sitelerine döner ve nedenini kısa bir uyarıda görür. Hatırlanan son site buysa unutulur.
  const unavailable = Boolean(siteId) && isApiError(bootstrapQuery.error, "NOT_FOUND");
  useEffect(() => {
    if (!unavailable) return;
    if (userId && readLastSiteId(userId) === siteId) clearLastSiteId(userId);
    toast.warning("Bu site açılamadı. Kaldırılmış, askıya alınmış ya da bağlantı eski olabilir.", { id: `site-unavailable-${siteId}` });
  }, [unavailable, siteId, userId]);

  const bootstrap = bootstrapQuery.data;
  const value = useMemo(() => (bootstrap ? {
    siteId,
    site: bootstrap.site,
    permissions: bootstrap.permissions,
    modules: bootstrap.modules,
    can: (permission) => bootstrap.permissions.includes(permission),
  } : null), [bootstrap, siteId]);

  if (!siteId) return <Outlet />;
  if (bootstrapQuery.isPending) return <FullPageState loading label="Site yükleniyor" />;
  if (unavailable) return <Navigate to="/" replace />;
  if (bootstrapQuery.isError) return <ServerError error={bootstrapQuery.error} onRetry={() => bootstrapQuery.refetch()} />;

  return (
    <SiteContext.Provider value={value}>
      <Outlet />
    </SiteContext.Provider>
  );
};

export default SiteScope;
