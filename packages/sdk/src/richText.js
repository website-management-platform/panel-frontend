// Zengin metin (ProseMirror/TipTap JSON) için güvenli HTML üretimi: yalnız bilinen düğümler, bütün metin kaçışlı,
// bağlantılar yalnız https/http/mailto/tel ve site içi yollar; script, style, olay özniteliği hiçbir koşulda üretilmez.
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
export const escapeHtml = (text) => String(text ?? "").replace(/[&<>"']/g, (char) => ESCAPES[char]);

export const safeHref = (href) => {
  if (typeof href !== "string") return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (href.startsWith("#")) return href;
  try {
    const url = new URL(href);
    return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};

const MARKS = { bold: "strong", italic: "em", underline: "u", strike: "s", code: "code" };
const BLOCKS = { paragraph: "p", blockquote: "blockquote", bulletList: "ul", orderedList: "ol", listItem: "li", table: "table", tableRow: "tr", tableCell: "td", tableHeader: "th", codeBlock: "pre" };

const renderText = (node) => (node.marks ?? []).reduce((html, mark) => {
  if (mark.type === "link") {
    const href = safeHref(mark.attrs?.href);
    if (!href) return html;
    const external = /^https?:/.test(href);
    return `<a href="${escapeHtml(href)}"${external ? " rel=\"noopener noreferrer\"" : ""}>${html}</a>`;
  }
  const tag = MARKS[mark.type];
  return tag ? `<${tag}>${html}</${tag}>` : html;
}, escapeHtml(node.text));

/** headingOffset: sayfa yapısına göre başlık düzeyi kaydırma (ör. bölüm içinde h2 → h3). */
export const richTextToHtml = (doc, { headingOffset = 0 } = {}) => {
  const render = (node) => {
    if (!node || typeof node !== "object") return "";
    if (node.type === "text") return renderText(node);
    if (node.type === "hardBreak") return "<br>";
    const inner = (node.content ?? []).map(render).join("");
    if (node.type === "doc") return inner;
    if (node.type === "heading") {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 2) + headingOffset));
      return `<h${level}>${inner}</h${level}>`;
    }
    if (node.type === "image") {
      const src = safeHref(node.attrs?.src);
      return src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(node.attrs?.alt ?? "")}" loading="lazy">` : "";
    }
    const tag = BLOCKS[node.type];
    if (node.type === "table") return `<table><tbody>${inner}</tbody></table>`;
    return tag ? `<${tag}>${inner}</${tag}>` : inner;
  };
  return render(doc);
};
