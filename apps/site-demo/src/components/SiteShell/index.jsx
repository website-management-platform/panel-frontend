import { useState } from "react";
import { Link, NavLink } from "react-router";
import Icon from "../Icon";
import { hrefFor } from "../../sites";
import "./site_shell.scss";

const LANGUAGE_NAMES = { tr: "Türkçe", en: "English", ar: "العربية" };
const COOKIE_KEY = "site_demo_cookie_ok";

const readCookieChoice = () => {
  try {
    return window.localStorage.getItem(COOKIE_KEY) === "1";
  } catch {
    return false;
  }
};

// +902125550180 → 0212 555 01 80 (yalnız Türkiye numaraları biçimlenir).
const formatPhone = (phone) => (/^\+90\d{10}$/.test(phone) ? `0${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9, 11)} ${phone.slice(11)}` : phone);

const SOCIAL_ICONS = { linkedin: "linkedin", x: "twitter", instagram: "instagram", facebook: "facebook", youtube: "youtube" };

const MenuLink = ({ item, site, locale, className }) => {
  if (!item.href) return <span className={className}>{item.label}</span>;
  if (item.href.startsWith("/")) return <NavLink to={hrefFor(site, locale, item.href)} end={item.href === "/"} className={className}>{item.label}</NavLink>;
  return <a href={item.href} target={item.target} rel={item.rel} className={className}>{item.label}{item.target === "_blank" && <span className="visually_hidden"> (yeni sekmede açılır)</span>}</a>;
};

// Menü ağacı: alt öğeler odakla da açılır (klavye); öne çıkan öğe düğme görünümündedir.
const MenuList = ({ items, site, locale, depth = 0 }) => (
  <ul className={depth === 0 ? "site_menu" : "site_menu_sub"}>
    {items.map((item) => (
      <li key={item.id} className={item.children.length ? "site_menu_item site_menu_has_children" : "site_menu_item"}>
        <MenuLink item={item} site={site} locale={locale} className={item.cta ? "site_menu_link site_menu_cta" : "site_menu_link"} />
        {item.children.length > 0 && <MenuList items={item.children} site={site} locale={locale} depth={depth + 1} />}
      </li>
    ))}
  </ul>
);

/** Site kabuğu: atlama bağlantısı, üst menü, dil seçimi, alt menü ve çerez bildirimi. Tema manifest'in derleme kimliğinden gelir. */
const SiteShell = ({ site, locale, bundle, alternates, children }) => {
  const { settings, menus } = bundle;
  const [cookieOk, setCookieOk] = useState(readCookieChoice);
  const [menuOpen, setMenuOpen] = useState(false);
  const name = settings?.siteName ?? site.displayName;
  const acceptCookies = () => {
    try {
      window.localStorage.setItem(COOKIE_KEY, "1");
    } catch {
      // Depolama kapalıysa bildirim yalnız bu oturumda kapanır.
    }
    setCookieOk(true);
  };

  return (
    <div className="site" data-theme={site.theme} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} style={settings?.primaryColor ? { "--brand": settings.primaryColor } : undefined}>
      <a className="site_skip" href="#icerik">İçeriğe geç</a>
      <header className="site_header">
        <div className="site_header_inner">
          <Link to={hrefFor(site, locale, "/")} className="site_brand">{name}</Link>
          {menus.header && (
            <>
              <button type="button" className="site_menu_toggle" aria-expanded={menuOpen} aria-controls="site-nav" onClick={() => setMenuOpen((value) => !value)}>
                Menü
              </button>
              <nav id="site-nav" aria-label="Ana menü" className={menuOpen ? "site_nav site_nav_open" : "site_nav"}>
                <MenuList items={menus.header.items} site={site} locale={locale} />
              </nav>
            </>
          )}
          {settings?.contactPhone && (
            <a className="site_phone" href={`tel:${settings.contactPhone}`}><Icon name="phone" /> {formatPhone(settings.contactPhone)}</a>
          )}
          {site.locales.length > 1 && (
            <ul className="site_languages" aria-label="Dil seçimi">
              {site.locales.map((code) => {
                const target = alternates?.[code];
                return (
                  <li key={code}>
                    {code === locale ? <span aria-current="true" lang={code}>{code.toUpperCase()}</span>
                      : target ? <Link to={hrefFor(site, code, target)} lang={code} hrefLang={code} aria-label={LANGUAGE_NAMES[code] ?? code}>{code.toUpperCase()}</Link>
                        : <span aria-disabled="true" title="Bu sayfa bu dilde yok">{code.toUpperCase()}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </header>
      <main id="icerik" className="site_main" tabIndex={-1}>{children}</main>
      <footer className="site_footer">
        <div className="site_footer_inner">
          {(settings?.description || settings?.contactPhone || settings?.socialLinks?.length > 0) && (
            <div className="site_footer_about">
              {settings.description && (
                <div>
                  <h2 className="site_footer_title">Hakkımızda</h2>
                  <p>{settings.description}</p>
                </div>
              )}
              {(settings.contactPhone || settings.contactEmail) && (
                <div>
                  <h2 className="site_footer_title">İletişim</h2>
                  {settings.contactPhone && <p className="site_footer_phone"><a href={`tel:${settings.contactPhone}`}>{formatPhone(settings.contactPhone)}</a></p>}
                  {settings.contactEmail && <p><a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></p>}
                </div>
              )}
              {settings.socialLinks?.length > 0 && (
                <div>
                  <h2 className="site_footer_title">Bizi takip edin</h2>
                  <ul className="site_social">
                    {settings.socialLinks.map((item) => (
                      <li key={item.id}><a href={item.url} rel="noopener noreferrer" target="_blank" aria-label={`${item.platform} (yeni sekmede açılır)`}><Icon name={SOCIAL_ICONS[item.platform] ?? "link"} /></a></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {menus.footer && (
            <nav aria-label="Alt menü" className="site_footer_nav">
              {menus.footer.items.map((group) => (
                <div key={group.id} className="site_footer_group">
                  {group.kind === "group" ? <h2 className="site_footer_title">{group.label}</h2> : <MenuLink item={group} site={site} locale={locale} className="site_footer_link" />}
                  {group.children.length > 0 && (
                    <ul>{group.children.map((item) => <li key={item.id}><MenuLink item={item} site={site} locale={locale} className="site_footer_link" /></li>)}</ul>
                  )}
                </div>
              ))}
            </nav>
          )}
          <p className="site_footer_meta">© {new Date().getFullYear()} {name}{settings?.contactEmail && <> · <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></>}</p>
        </div>
      </footer>
      {settings?.cookieConsentEnabled && !cookieOk && (
        <section className="site_cookie" aria-label="Çerez bildirimi">
          <p>{settings.cookieConsentText}</p>
          <button type="button" onClick={acceptCookies}>Tamam</button>
        </section>
      )}
    </div>
  );
};

export default SiteShell;
