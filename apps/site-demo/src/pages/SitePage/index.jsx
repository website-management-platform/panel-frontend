import { useLoaderData } from "react-router";
import EntryView from "../../components/Sections/EntryView";
import Sections from "../../components/Sections";
import SiteShell from "../../components/SiteShell";
import { hrefFor } from "../../sites";

const SitePage = () => {
  const { site, locale, bundle } = useLoaderData();
  const { route, settings } = bundle;
  const page = route.type === "page" ? route.page : null;
  const alternates = page ? page.alternates : { [locale]: route.entry?.path };
  const description = page?.seo.description ?? route.entry?.summary ?? settings?.description ?? "";
  // Başlık her sayfada siteyi de adlandırır (WCAG 2.4.2); ana sayfada yalnız özel arama başlığı varsa o kullanılır.
  const siteName = settings?.siteName ?? site.displayName;
  const withSite = (text) => (text && text.includes(siteName) ? text : [text, siteName].filter(Boolean).join(" · "));
  const title = page ? (page.isHome && page.seoTitle ? page.seo.title : withSite(page.seo.title)) : withSite(route.entry?.title ?? route.entry?.name);
  return (
    <SiteShell site={site} locale={locale} bundle={bundle} alternates={alternates}>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {(page?.seo.noindex) && <meta name="robots" content="noindex" />}
      {Object.entries(alternates ?? {}).filter(([, path]) => path).map(([code, path]) => <link key={code} rel="alternate" hrefLang={code} href={hrefFor(site, code, path)} />)}
      {page ? <Sections sections={page.sections} site={site} locale={locale} title={page.title} /> : <EntryView entry={route.entry} site={site} locale={locale} />}
    </SiteShell>
  );
};

export default SitePage;
