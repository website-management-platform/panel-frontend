import { Link, useLoaderData } from "react-router";
import "./site_chooser.scss";

const THEME_TEXT = { kurumsal: "Kurumsal tasarım", portfolyo: "Portföy tasarımı", dernek: "Dernek tasarımı" };

/** Demo giriş sayfası: aynı API'yi okuyan üç farklı site tasarımı. */
const SiteChooser = () => {
  const sites = useLoaderData();
  return (
    <main className="site_chooser">
      <h1>Örnek web siteleri</h1>
      <p>Her site aynı içerik API'sini okur; tasarım ve hangi bölümleri gösterebildiği sitenin kendi frontend manifest'indedir.</p>
      {sites.length === 0 ? <p role="status">Backend'e ulaşılamadı. customer-api (8782) çalışıyor mu?</p> : (
        <ul className="site_chooser_list">
          {sites.map((site) => (
            <li key={site.key} className={`site_chooser_card site_chooser_card_${site.theme}`}>
              <Link to={`/${site.key}`} className="site_chooser_link">{site.displayName}</Link>
              <span>{THEME_TEXT[site.theme] ?? site.theme} · {site.locales.join(", ").toUpperCase()}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default SiteChooser;
