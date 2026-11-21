import { Link, isRouteErrorResponse, useRouteError } from "react-router";
import "./site_error.scss";

/** 404 (adres yok) ve 410 (içerik kaldırıldı) gerçek durum olarak gösterilir; diğer hatalar genel mesaj. */
const SiteError = () => {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const site = isRouteErrorResponse(error) ? error.data?.site : null;
  const text = { 404: "Aradığınız sayfa bulunamadı.", 410: "Bu sayfa yayından kaldırıldı." }[status] ?? "Sayfa şu anda gösterilemiyor.";
  return (
    <main className="site_error" data-theme={site?.theme}>
      <title>{`${status} · ${text}`}</title>
      <p className="site_error_code">{status}</p>
      <h1>{text}</h1>
      <Link to={site ? `/${site.key}` : "/"}>Ana sayfaya dön</Link>
    </main>
  );
};

export default SiteError;
