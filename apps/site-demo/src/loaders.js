import { data, redirect } from "react-router";
import { isWmpError } from "@wmp/sdk";
import { clientFor, hrefFor, loadSites } from "./sites";

export const siteChooserLoader = () => loadSites();

// Adresi çöz: site anahtarı → dil öneki → API yolu. Yönlendirme sonucu tarayıcıda uygulanır; 404/410 hata sayfasına gider.
export const sitePageLoader = async ({ params, request }) => {
  const sites = await loadSites();
  const site = sites.find((item) => item.key === params.siteKey);
  if (!site) throw data({ status: 404 }, { status: 404 });
  const segments = (params["*"] ?? "").split("/").filter(Boolean);
  let locale = site.defaultLocale;
  if (segments[0] && segments[0] !== site.defaultLocale && site.locales.includes(segments[0])) locale = segments.shift();
  const path = `/${segments.join("/")}`;
  try {
    const bundle = await clientFor(site, locale).getPageBundle(path, { signal: request.signal });
    const route = bundle.data.route;
    if (route.type === "redirect") throw redirect(route.location.startsWith("/") ? hrefFor(site, locale, route.location) : route.location, route.statusCode);
    return { site, locale, path, bundle: bundle.data };
  } catch (error) {
    if (error instanceof Response) throw error;
    if (isWmpError(error, "NOT_FOUND") || isWmpError(error, "GONE")) throw data({ status: error.status, site, locale }, { status: error.status });
    throw error;
  }
};

