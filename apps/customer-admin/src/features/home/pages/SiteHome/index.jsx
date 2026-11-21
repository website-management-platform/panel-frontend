import { Link } from "react-router";
import { FiExternalLink, FiLayers } from "react-icons/fi";
import Button from "@/components/Button";
import Card from "@/components/Card";
import DescriptionList from "@/components/DescriptionList";
import EmptyState from "@/components/EmptyState";
import QueryErrorAlert from "@/components/QueryErrorAlert";
import Skeleton from "@/components/Skeleton";
import PageHeader from "@/components/PageHeader";
import VisuallyHidden from "@/components/VisuallyHidden";
import { useCurrentUser } from "@/auth/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { moduleIcon } from "../../../content/icons";
import { labelIn } from "../../../content/labels";
import { useDashboard } from "../../api";
import DashboardWidget from "../../components/DashboardWidget";
import { sitePath, useSiteScope } from "../../../sites/siteContext";
import "./site_home.scss";

const languageNames = new Intl.DisplayNames(["tr"], { type: "language" });

// Müşteri teknik terim görmez (şartname §12): içerik türleri sade adlarla anlatılır.
const KIND_TEXT = {
  singleton: () => "Tek sayfa",
  collection: (count) => (count === 0 ? "Henüz kayıt yok" : `${count} kayıt`),
  tree: (count) => (count === 0 ? "Henüz kayıt yok" : `${count} kayıt, hiyerarşik`),
};


const SiteHome = () => {
  const { site, siteId, modules } = useSiteScope();
  const user = useCurrentUser();
  const dashboard = useDashboard(siteId);
  usePageTitle(site.displayName);

  return (
    <div className="site_home">
      <PageHeader
        title={`Hoş geldiniz, ${user.displayName}`}
        description={`${site.displayName} sitesini yönetiyorsunuz.`}
        actions={site.primaryDomain && (
          <Button as="a" href={`https://${site.primaryDomain}`} target="_blank" rel="noopener noreferrer" variant="outline" icon={FiExternalLink}>
            Siteyi aç<VisuallyHidden> (yeni sekmede açılır)</VisuallyHidden>
          </Button>
        )}
      />

      {dashboard.isPending && <Skeleton variant="rectangle" height={200} radius="lg" />}
      {dashboard.isError && <QueryErrorAlert error={dashboard.error} onRetry={() => dashboard.refetch()} />}
      {dashboard.data && (
        <div className="site_home_widgets">
          {dashboard.data.widgets.map((widget) => <DashboardWidget key={widget.id} widget={widget} />)}
        </div>
      )}

      <div className="site_home_grid">
        <Card title="Site bilgileri">
          <DescriptionList
            items={[
              { label: "Site", value: site.displayName },
              { label: "Adres", value: site.primaryDomain ?? "Henüz tanımlanmadı" },
              { label: "Diller", value: site.locales.map((code) => languageNames.of(code)).join(", ") },
            ]}
          />
        </Card>

      </div>

      {modules.length === 0 ? (
        <EmptyState
          variant="bordered"
          icon={FiLayers}
          title="İçerik bölümleri henüz eklenmedi"
          description="Sitenizin içerik bölümleri (ör. haberler, ekip, galeri) tanımlandığında burada ve menüde görünür."
        />
      ) : (
        <section className="site_home_sections" aria-labelledby="site-home-sections">
          <h2 id="site-home-sections" className="site_home_sections_title">İçerik bölümleri</h2>
          <ul className="site_home_section_list">
            {modules.map((item) => {
              const Icon = moduleIcon(item.icon);
              return (
                <li key={item.key} className="site_home_section">
                  <span className="site_home_section_icon" aria-hidden="true"><Icon /></span>
                  <span className="site_home_section_text">
                    <Link to={sitePath(siteId, `/icerik/${item.key}`)} className="site_home_section_name">{labelIn(item.label, site.defaultLocale)}</Link>
                    <span className="site_home_section_meta">{(KIND_TEXT[item.kind] ?? KIND_TEXT.collection)(item.entryCount)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
};

export default SiteHome;
