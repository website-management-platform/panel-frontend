import { useNavigate } from "react-router";
import { FiCheck, FiChevronDown, FiGlobe, FiGrid } from "react-icons/fi";
import Dropdown, { DropdownDivider, DropdownItem, DropdownLabel } from "@/components/Dropdown";
import { useCustomerSites } from "../../api";
import { sitePath, useSiteScope } from "../../siteContext";
import "./site_switcher.scss";

// Başlıktaki site seçici. Tek siteye erişen kullanıcıda yalnız site adı görünür (şartname §12: tek sitede seçici gizlenebilir).
const SiteSwitcher = () => {
  const scope = useSiteScope();
  const sitesQuery = useCustomerSites();
  const navigate = useNavigate();
  const sites = sitesQuery.data?.items ?? [];
  if (!scope) return null;

  const label = (
    <>
      <FiGlobe className="site_switcher_icon" aria-hidden="true" />
      <span className="site_switcher_text">
        <span className="site_switcher_name">{scope.site.displayName}</span>
        <span className="site_switcher_tenant">{scope.site.tenant.displayName}</span>
      </span>
    </>
  );

  if (sites.length <= 1) return <div className="site_switcher site_switcher_static">{label}</div>;

  return (
    <Dropdown
      className="site_switcher_dropdown"
      trigger={({ toggle, triggerProps }) => (
        <button type="button" className="site_switcher" onClick={toggle} aria-label={`Site değiştir, şu an ${scope.site.displayName}`} {...triggerProps}>
          {label}
          <FiChevronDown className="site_switcher_chevron" aria-hidden="true" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <DropdownLabel>Siteler</DropdownLabel>
          {sites.map((site) => (
            <DropdownItem
              key={site.id}
              icon={site.id === scope.siteId ? FiCheck : FiGlobe}
              onClick={() => {
                close();
                if (site.id !== scope.siteId) navigate(sitePath(site.id));
              }}
            >
              {site.displayName}
            </DropdownItem>
          ))}
          <DropdownDivider />
          <DropdownItem icon={FiGrid} onClick={() => { close(); navigate("/"); }}>Bütün siteler</DropdownItem>
        </>
      )}
    </Dropdown>
  );
};

export default SiteSwitcher;
