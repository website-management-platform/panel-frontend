import { createClient } from "@wmp/sdk";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

// Demo site listesi yalnız geliştirme yardımcısından gelir (gerçek sitede siteKey yapılandırmadadır).
let sitesPromise = null;
export const loadSites = () => {
  sitesPromise ??= fetch("/__dev/demo-sites").then((response) => (response.ok ? response.json() : { items: [] })).then((body) => body.items).catch(() => {
    sitesPromise = null;
    return [];
  });
  return sitesPromise;
};

const clients = new Map();
export const clientFor = (site, locale) => {
  const key = `${site.publicKey}:${locale}`;
  if (!clients.has(key)) clients.set(key, createClient({ baseUrl: API_BASE, siteKey: site.publicKey, locale }));
  return clients.get(key);
};

// Adres kuralı: varsayılan dil önek almaz, diğer diller /en/… biçimindedir. API yolları dil öneksizdir.
export const hrefFor = (site, locale, path) => {
  if (!path) return null;
  if (!path.startsWith("/")) return path;
  const prefix = locale === site.defaultLocale ? "" : `/${locale}`;
  const rest = path === "/" ? "" : path;
  return `/${site.key}${prefix}${rest}`;
};
