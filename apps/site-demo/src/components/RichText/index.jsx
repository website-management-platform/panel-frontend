import { Link } from "react-router";
import { safeHref } from "@wmp/sdk";
import { hrefFor } from "../../sites";

const MARKS = { bold: "strong", italic: "em", underline: "u", strike: "s", code: "code" };
const BLOCKS = { paragraph: "p", blockquote: "blockquote", bulletList: "ul", orderedList: "ol", listItem: "li", tableRow: "tr", tableCell: "td", tableHeader: "th", codeBlock: "pre" };

/**
 * Zengin metni HTML enjekte etmeden React öğelerine çevirir (şartname §16: kullanıcı HTML'i çalıştırılmaz).
 * Bilinmeyen düğüm yalnız içeriğiyle çizilir; bağlantılar güvenli protokolle sınırlıdır; site içi yollar dil önekini alır.
 */
const RichText = ({ doc, site, locale, headingOffset = 1 }) => {
  const renderText = (node, key) => (node.marks ?? []).reduce((child, mark) => {
    if (mark.type === "link") {
      const href = safeHref(mark.attrs?.href);
      if (!href) return child;
      if (href.startsWith("/")) return <Link key={key} to={hrefFor(site, locale, href)}>{child}</Link>;
      return <a key={key} href={href} rel="noopener noreferrer">{child}</a>;
    }
    const Tag = MARKS[mark.type];
    return Tag ? <Tag key={key}>{child}</Tag> : child;
  }, node.text);

  const render = (node, key) => {
    if (!node || typeof node !== "object") return null;
    if (node.type === "text") return <span key={key}>{renderText(node, key)}</span>;
    if (node.type === "hardBreak") return <br key={key} />;
    const children = (node.content ?? []).map((child, index) => render(child, `${key}.${index}`));
    if (node.type === "heading") {
      const Tag = `h${Math.min(6, Math.max(2, Number(node.attrs?.level ?? 2) + headingOffset))}`;
      return <Tag key={key}>{children}</Tag>;
    }
    if (node.type === "table") return <table key={key}><tbody>{children}</tbody></table>;
    if (node.type === "image") {
      const src = safeHref(node.attrs?.src);
      return src ? <img key={key} src={src} alt={node.attrs?.alt ?? ""} loading="lazy" /> : null;
    }
    const Tag = BLOCKS[node.type];
    return Tag ? <Tag key={key}>{children}</Tag> : <span key={key}>{children}</span>;
  };

  if (!doc) return null;
  return <div className="rich_text">{(doc.content ?? []).map((node, index) => render(node, String(index)))}</div>;
};

export default RichText;
