import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router";
import { FiArrowRight, FiGlobe, FiSearch } from "react-icons/fi";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import FullPageState from "@/components/FullPageState";
import Input from "@/components/Input";
import { APP_NAME, APP_SHORT_NAME } from "@/config/app.config";
import { useCurrentUser } from "@/auth/api";
import UserMenu from "@/layouts/MainLayout/components/UserMenu";
import { usePageTitle } from "@/hooks/usePageTitle";
import ServerError from "@/pages/ServerError";
import { formatRelativeTime } from "@/utils/format";
import { useCustomerSites } from "../../api";
import { readLastSiteId, sitePath } from "../../siteContext";
import "./site_select.scss";

const SEARCH_THRESHOLD = 6;

/**
 * Giriş sonrası ilk ekran: erişilebilen siteler kart olarak. Tek site varsa doğrudan o siteye geçilir.
 * Son kullanılan site, erişim sürüyorsa en başta ve işaretli gösterilir (şartname §12).
 */
const SiteSelect = () => {
  usePageTitle("Sitelerim");
  const user = useCurrentUser();
  const sitesQuery = useCustomerSites();
  const [search, setSearch] = useState("");
  const lastSiteId = readLastSiteId(user.id);

  const sites = useMemo(() => {
    const items = [...(sitesQuery.data?.items ?? [])];
    items.sort((a, b) => (a.id === lastSiteId ? -1 : b.id === lastSiteId ? 1 : 0));
    const query = search.trim().toLocaleLowerCase("tr-TR");
    return query
      ? items.filter((site) => [site.displayName, site.primaryDomain ?? "", site.tenant.displayName].some((text) => text.toLocaleLowerCase("tr-TR").includes(query)))
      : items;
  }, [sitesQuery.data, lastSiteId, search]);

  if (sitesQuery.isPending) return <FullPageState loading label="Siteler yükleniyor" />;
  if (sitesQuery.isError) return <ServerError error={sitesQuery.error} onRetry={() => sitesQuery.refetch()} />;

  const total = sitesQuery.data.items.length;
  if (total === 1) return <Navigate to={sitePath(sitesQuery.data.items[0].id)} replace />;

  return (
    <div className="site_select">
      <header className="site_select_header">
        <span className="site_select_brand">
          <span className="site_select_mark" aria-hidden="true">{APP_SHORT_NAME}</span>
          {APP_NAME}
        </span>
        <UserMenu />
      </header>
      <main id="main-content" className="site_select_main" tabIndex={-1}>
        <div className="site_select_intro">
          <h1 className="site_select_title">Merhaba {user.displayName}</h1>
          <p className="site_select_description">{total > 0 ? "Yönetmek istediğiniz siteyi seçin." : "Henüz yönetebileceğiniz bir site yok."}</p>
        </div>

        {total === 0 && (
          <EmptyState
            variant="bordered"
            icon={FiGlobe}
            title="Erişebildiğiniz site yok"
            description="Size bir sitede yetki verildiğinde burada görünür. Bekliyorsanız sitenizi yöneten kişiyle iletişime geçin."
          />
        )}

        {total >= SEARCH_THRESHOLD && (
          <Input aria-label="Site ara" placeholder="Site adı veya alan adıyla ara" type="search" icon={FiSearch} value={search} onChange={(event) => setSearch(event.target.value)} className="site_select_search" />
        )}

        {total > 0 && sites.length === 0 && <p className="site_select_description">Aramayla eşleşen site yok.</p>}

        <ul className="site_select_grid">
          {sites.map((site) => (
            <li key={site.id}>
              <Link to={sitePath(site.id)} className="site_select_card">
                <span className="site_select_card_icon" aria-hidden="true"><FiGlobe /></span>
                <span className="site_select_card_body">
                  <span className="site_select_card_name">
                    {site.displayName}
                    {site.id === lastSiteId && <Badge size="sm" variant="info">Son kullanılan</Badge>}
                  </span>
                  <span className="site_select_card_meta">{site.primaryDomain ?? site.tenant.displayName}</span>
                  <span className="site_select_card_meta">Güncellendi {formatRelativeTime(site.updatedAt)}</span>
                </span>
                <FiArrowRight className="site_select_card_arrow" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
};

export default SiteSelect;
