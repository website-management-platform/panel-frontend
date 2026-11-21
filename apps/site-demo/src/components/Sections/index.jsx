import { Link } from "react-router";
import { hrefFor } from "../../sites";
import FormSection from "../FormSection";
import Icon from "../Icon";
import Media from "../Media";
import RichText from "../RichText";
import "./sections.scss";

// Bölüm başlıkları sayfa başlığının (h1) altındadır; ilk bölüm giriş alanıysa başlığı h1 olur.
const ActionLink = ({ button, site, locale, className = "section_button" }) => {
  if (!button?.label) return null;
  const href = button.kind === "external" ? button.url : button.path;
  if (!href) return null;
  const variant = `${className} ${className}_${button.variant ?? "primary"}`;
  return href.startsWith("/") ? <Link className={variant} to={hrefFor(site, locale, href)}>{button.label}</Link> : <a className={variant} href={href} rel="noopener noreferrer">{button.label}</a>;
};

// Kart alanları modülden bağımsız sezgisel okunur: ad/başlık, özet, görsel, adres.
const cardOf = (item) => ({
  title: item.title && item.fullName ? item.fullName : item.title ?? item.name ?? item.fullName ?? item.label,
  subtitle: item.fullName ? item.title : item.summary ?? item.subtitle ?? item.venue ?? null,
  image: item.cover ?? item.photo ?? item.image ?? item.images?.[0] ?? null,
  stat: item.value !== undefined && item.label ? `${item.prefix ?? ""}${item.value}${item.suffix ?? ""}` : null,
  date: item.publishDate ?? item.startsAt ?? null,
  path: item.path ?? null,
});

const Eyebrow = ({ text }) => (text ? <p className="section_eyebrow">{text}</p> : null);

const formatDate = (value, locale) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(value.length === 10 ? `${value}T00:00:00` : value));

const Hero = ({ section, site, locale, first }) => {
  const Heading = first ? "h1" : "h2";
  return (
    <section className={`section section_hero section_hero_${section.variant}`} id={section.anchor}>
      <div className="section_hero_text">
        <Eyebrow text={section.eyebrow} />
        <Heading className="section_hero_title">{section.title}</Heading>
        {section.subtitle && <p className="section_hero_subtitle">{section.subtitle}</p>}
        <ActionLink button={section.button} site={site} locale={locale} />
      </div>
      {section.image && <Media media={section.image} className="section_hero_image" sizes="(min-width: 960px) 50vw, 100vw" priority />}
    </section>
  );
};

const ContentList = ({ section, site, locale }) => {
  const items = section.source?.items ?? [];
  // Tek kayıt kaynağı (ör. Hakkımızda) kart değil metin olarak çizilir.
  if (section.source?.mode === "singleton") {
    const item = items[0];
    if (!item) return null;
    return (
      <section className="section section_prose" id={section.anchor}>
        {(section.heading || item.title) && <h2>{section.heading ?? item.title}</h2>}
        {item.summary && <p className="section_lead">{item.summary}</p>}
        {item.body && <RichText doc={item.body} site={site} locale={locale} />}
      </section>
    );
  }
  if (items.length === 0) return null;
  const headingId = `${section.id}-title`;
  const header = (
    <>
      <Eyebrow text={section.eyebrow} />
      {section.heading && <h2 id={headingId}>{section.heading}</h2>}
      {section.intro && <p className="section_lead">{section.intro}</p>}
    </>
  );
  if (section.variant === "tiles") {
    return (
      <section className="section section_list section_list_tiles" id={section.anchor} aria-labelledby={section.heading ? headingId : undefined}>
        {header}
        <ul className="section_tiles">
          {items.map((item) => (
            <li key={item.id} className="section_tile">
              <Icon name={item.icon} className="section_tile_icon" />
              <h3 className="section_tile_title">{item.path ? <Link to={hrefFor(site, locale, item.path)} className="section_card_link">{item.title ?? item.name}</Link> : item.title ?? item.name}</h3>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (section.variant === "quotes") {
    return (
      <section className="section section_list section_list_quotes" id={section.anchor} aria-labelledby={section.heading ? headingId : undefined}>
        <div className="section_quotes_text">
          {header}
          {items.map((item) => (
            <figure key={item.id} className="section_quote">
              <blockquote>“{item.quote}”</blockquote>
              <figcaption><strong>{item.name}</strong>{item.role && <span> · {item.role}</span>}</figcaption>
            </figure>
          ))}
        </div>
        {section.image && <Media media={section.image} className="section_quotes_image" sizes="(min-width: 960px) 40vw, 100vw" />}
      </section>
    );
  }
  if (section.variant === "people") {
    return (
      <section className="section section_list section_list_people" id={section.anchor} aria-labelledby={section.heading ? headingId : undefined}>
        {header}
        <ul className="section_people">
          {items.map((item) => (
            <li key={item.id} className="section_person">
              {item.photo && <Media media={item.photo} className="section_person_photo" sizes="(min-width: 960px) 25vw, 50vw" />}
              <div className="section_person_body">
                <h3 className="section_person_name">{item.fullName ?? item.name}</h3>
                {item.title && <p className="section_person_title">{item.title}</p>}
              </div>
            </li>
          ))}
        </ul>
        <ActionLink button={section.button} site={site} locale={locale} />
      </section>
    );
  }
  return (
    <section className={`section section_list section_list_${section.variant}`} id={section.anchor} aria-labelledby={section.heading ? headingId : undefined}>
      {header}
      <ul className="section_cards">
        {items.map((item) => {
          const card = cardOf(item);
          return (
            <li key={item.id} className={card.image ? "section_card section_card_has_image" : "section_card"}>
              {card.image && <Media media={card.image} className="section_card_image" sizes="(min-width: 960px) 33vw, 100vw" />}
              <div className="section_card_body">
                {card.stat && <p className="section_card_stat">{card.stat}</p>}
                <h3 className="section_card_title">{card.path ? <Link to={hrefFor(site, locale, card.path)} className="section_card_link">{card.title}</Link> : card.title}</h3>
                {card.date && <p className="section_card_date"><time dateTime={card.date}>{formatDate(card.date, locale)}</time></p>}
                {card.subtitle && !card.stat && <p className="section_card_text">{card.subtitle}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      <ActionLink button={section.button} site={site} locale={locale} />
    </section>
  );
};

const Cta = ({ section, site, locale }) => (
  <section className={`section section_cta section_cta_${section.variant}`} id={section.anchor}>
    <h2>{section.title}</h2>
    {section.text && <p>{section.text}</p>}
    <ActionLink button={section.button} site={site} locale={locale} />
  </section>
);

const Gallery = ({ section }) => (
  <section className={`section section_gallery section_gallery_${section.variant}`} id={section.anchor}>
    {section.heading && <h2>{section.heading}</h2>}
    <ul className="section_gallery_grid">
      {(section.images ?? []).map((image) => <li key={image.id}><Media media={image} sizes="(min-width: 960px) 33vw, 50vw" /></li>)}
    </ul>
  </section>
);

const RichTextSection = ({ section, site, locale }) => (
  <section className={`section section_prose section_prose_${section.variant}`} id={section.anchor}>
    {section.heading && <h2>{section.heading}</h2>}
    <RichText doc={section.body} site={site} locale={locale} />
  </section>
);

const Features = ({ section }) => (
  <section className={`section section_features section_features_${section.variant}`} id={section.anchor}>
    <div className="section_features_text">
      <Eyebrow text={section.eyebrow} />
      {section.heading && <h2>{section.heading}</h2>}
      <ol className="section_features_list">
        {(section.items ?? []).map((item) => (
          <li key={item.id} className="section_feature">
            <span className="section_feature_icon"><Icon name={item.icon} /></span>
            <div>
              <h3 className="section_feature_title">{item.title}</h3>
              {item.text && <p className="section_feature_text">{item.text}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
    {section.image && <Media media={section.image} className="section_features_image" sizes="(min-width: 960px) 40vw, 100vw" />}
  </section>
);

const MediaText = ({ section, site, locale }) => (
  <section className={`section section_media_text section_media_text_${section.variant}`} id={section.anchor}>
    <div className="section_media_text_visual">
      {section.statValue && (
        <p className="section_stat">
          <span className="section_stat_value">{section.statValue}</span>
          {section.statLabel && <span className="section_stat_label">{section.statLabel}</span>}
        </p>
      )}
      <Media media={section.image} className="section_media_text_image" sizes="(min-width: 960px) 40vw, 100vw" />
    </div>
    <div className="section_media_text_body">
      <Eyebrow text={section.eyebrow} />
      <h2>{section.heading}</h2>
      {section.body && <RichText doc={section.body} site={site} locale={locale} />}
      <ActionLink button={section.button} site={site} locale={locale} />
    </div>
  </section>
);

const Statement = ({ section }) => (
  <section className={`section section_statement section_statement_${section.variant}`} id={section.anchor}>
    {section.heading && <h2>{section.heading}</h2>}
    <p className="section_statement_text">{section.text}</p>
    {section.signature && <p className="section_statement_signature">{section.signature}</p>}
  </section>
);

const RENDERERS = { hero: Hero, contentList: ContentList, cta: Cta, gallery: Gallery, richText: RichTextSection, features: Features, mediaText: MediaText, statement: Statement, form: FormSection };

/** Sayfa bölümleri sırasıyla; tanımadığı bölümü frontend çizmez (manifest'te yoksa yayınlanamaz da). */
const Sections = ({ sections, site, locale, title }) => {
  const startsWithHero = sections[0]?.type === "hero";
  return (
    <>
      {!startsWithHero && title && <h1 className="section section_page_title">{title}</h1>}
      {sections.map((section, index) => {
        const Renderer = RENDERERS[section.type];
        return Renderer ? <Renderer key={section.id} section={section} site={site} locale={locale} first={index === 0} /> : null;
      })}
    </>
  );
};

export default Sections;
