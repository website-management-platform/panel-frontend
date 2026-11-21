import { getFieldType, isPlainObject, labelOf } from "@wmp/schema";
import { formatDate, formatDateTime } from "@/utils/format";

const plainText = (node) => (isPlainObject(node) ? `${node.text ?? ""} ${(node.content ?? []).map(plainText).join(" ")}` : "");

/** Liste kolonundaki değerin okunur metni. */
export const displayValue = (field, value) => {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) return "—";
  const settings = field.settings ?? {};
  const option = (id) => labelOf(settings.options?.find((item) => item.id === id)?.label) || id;
  switch (getFieldType(field.type)?.valueKind) {
    case "boolean": return value ? settings.trueLabel || "Evet" : settings.falseLabel || "Hayır";
    case "optionId": return option(value);
    case "optionIds": return value.map(option).join(", ");
    case "date": return formatDate(`${value}T00:00:00`);
    case "datetime": return formatDateTime(value);
    case "dateRange": return `${formatDate(`${value.start}T00:00:00`)} – ${value.end ? formatDate(`${value.end}T00:00:00`) : "…"}`;
    case "money": return `${value.amount} ${value.currency}`;
    case "decimal": return field.type === "percentage" ? `%${value}` : value;
    case "richText": return plainText(value).trim().slice(0, 120) || "—";
    case "asset": return value.alt || "Dosya";
    case "link":
    case "button": return [value.label, value.url ?? value.path].filter(Boolean).join(" → ") || "—";
    case "entryRefList":
    case "assetList":
    case "rows":
    case "blocks": return `${value.length} öğe`;
    case "menuTree": return `${JSON.stringify(value).split("\"kind\"").length - 1} menü öğesi`;
    case "contentSource": return value.mode === "entries" ? `${value.entryIds.length} seçili kayıt` : `Kaynak: ${value.module}`;
    default: return typeof value === "object" ? "…" : String(value);
  }
};
