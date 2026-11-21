import Media from "../Media";
import RichText from "../RichText";

/** Manifest adres kalıbıyla açılan kayıt (ör. /haberler/:slug): başlık, tarih, kapak, özet ve metin. */
const EntryView = ({ entry, site, locale }) => {
  const title = entry.title ?? entry.name ?? entry.fullName;
  const date = entry.publishDate ?? entry.startsAt;
  return (
    <article className="section section_article">
      <h1>{title}</h1>
      {date && <p className="section_card_date"><time dateTime={date}>{new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(date.length === 10 ? `${date}T00:00:00` : date))}</time></p>}
      {entry.cover && <Media media={entry.cover} className="section_article_cover" />}
      {entry.summary && <p className="section_lead">{entry.summary}</p>}
      {(entry.body ?? entry.description) && <RichText doc={entry.body ?? entry.description} site={site} locale={locale} />}
    </article>
  );
};

export default EntryView;
