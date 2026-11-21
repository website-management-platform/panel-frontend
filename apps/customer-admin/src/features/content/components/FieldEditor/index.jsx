import { Suspense, lazy, useId, useState } from "react";
import { getFieldType, labelOf } from "@wmp/schema";
import Alert from "@/components/Alert";
import Checkbox from "@/components/Checkbox";
import CheckboxGroup from "@/components/CheckboxGroup";
import FieldGroup from "@/components/FieldGroup";
import Input from "@/components/Input";
import RadioGroup from "@/components/RadioGroup";
import SegmentedControl from "@/components/SegmentedControl";
import Skeleton from "@/components/Skeleton";
import Select from "@/components/Select";
import Switch from "@/components/Switch";
import Textarea from "@/components/Textarea";
import { cx } from "@/utils/cx";
import { isoToZoned, zonedToIso } from "../../dateTime";
import { localeName } from "../../labels";
import { readValue, writeValue } from "../../localized";
import ContentSourceEditor from "../ContentSourceEditor";
import KeyValueEditor from "../KeyValueEditor";
import MediaField from "../MediaField";
import MenuTreeEditor from "../MenuTreeEditor";
import OpeningHoursEditor from "../OpeningHoursEditor";
import RelationPicker from "../RelationPicker";
import RowsEditor from "../RowsEditor";
import "./field_editor.scss";

// Zengin metin düzenleyici (TipTap) yalnız böyle bir alan olan formda yüklenir.
const RichTextEditor = lazy(() => import("../RichTextEditor"));

const blankToNull = (text) => (text === "" ? null : text);
const DECIMAL_INPUT = /^-?\d*(?:[.,]\d*)?$/;

const options = (field, value) => (field.settings?.options ?? [])
  .filter((option) => !option.archived || (Array.isArray(value) ? value.includes(option.id) : value === option.id))
  .map((option) => ({ value: option.id, label: labelOf(option.label) + (option.archived ? " (kullanımdan kalktı)" : "") }));

// Ortak etiket bilgileri: zorunluluk, dil, yardım metni.
const useFieldMeta = (field, ctx) => {
  const label = labelOf(field.label, ctx.uiLocale);
  const help = field.help ? labelOf(field.help, ctx.uiLocale) : undefined;
  // Dil ipucu yalnız çok dilli sitede anlamlıdır.
  const localeHint = !ctx.multiLocale ? undefined : field.localized ? `${localeName(ctx.locale)} içerik` : "Bütün dillerde ortak";
  return { label, help: [help, localeHint].filter(Boolean).join(" · ") || undefined, required: Boolean(field.required) };
};

// Bileşik değerlerin (adres, bağlantı, tutar…) ortak çerçevesi.
const Composite = ({ field, ctx, error, children, columns = 2 }) => {
  const meta = useFieldMeta(field, ctx);
  return (
    <FieldGroup legend={meta.label} description={meta.help} required={meta.required} error={error} layout="grid" columns={columns} className="field_editor_group">
      {children}
    </FieldGroup>
  );
};

const TextLike = ({ field, value, onChange, error, disabled, ctx }) => {
  const meta = useFieldMeta(field, ctx);
  const settings = field.settings ?? {};
  const type = { email: "email", url: "url", phone: "tel" }[field.type] ?? "text";
  const normalize = (text) => {
    if (field.type === "email") return text.trim().toLowerCase();
    if (field.type === "slug") return text.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9-]+/g, "-");
    return text;
  };
  if (field.type === "textarea") {
    return (
      <Textarea label={meta.label} hint={meta.help} required={meta.required} error={error} disabled={disabled} readOnly={disabled}
        rows={settings.rows ?? 4} maxLength={settings.maxLength} autoResize value={value ?? ""} placeholder={labelOf(field.placeholder)}
        onChange={(event) => onChange(blankToNull(event.target.value))} />
    );
  }
  return (
    <Input label={meta.label} hint={meta.help ?? (field.type === "phone" ? "Ülke koduyla yazın (ör. +905321234567)." : field.type === "slug" ? "Adreste görünür; küçük harf, rakam ve tire." : undefined)}
      required={meta.required} error={error} disabled={disabled} readOnly={disabled} type={type} inputMode={field.type === "phone" ? "tel" : undefined}
      maxLength={settings.maxLength} showCount={Boolean(settings.counter)} value={value ?? ""} placeholder={labelOf(field.placeholder)}
      autoComplete="off" onChange={(event) => onChange(blankToNull(normalize(event.target.value)))} />
  );
};

const NumberLike = ({ field, value, onChange, error, disabled, ctx }) => {
  const meta = useFieldMeta(field, ctx);
  const settings = field.settings ?? {};
  if (field.type === "integer") {
    return (
      <Input label={meta.label} hint={meta.help} required={meta.required} error={error} disabled={disabled} readOnly={disabled} type="number" inputMode="numeric"
        min={settings.min} max={settings.max} step={settings.step ?? 1} value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : Number.parseInt(event.target.value, 10))} />
    );
  }
  // Ondalık değer metin olarak saklanır; virgül noktaya çevrilir (şartname §6: money/decimal float değil).
  return (
    <Input label={meta.label} hint={meta.help} required={meta.required} error={error} disabled={disabled} readOnly={disabled} inputMode="decimal"
      addonAfter={field.type === "percentage" ? "%" : undefined} value={value ?? ""}
      onChange={(event) => DECIMAL_INPUT.test(event.target.value) && onChange(blankToNull(event.target.value.replace(",", ".")))} />
  );
};

const MoneyEditor = ({ field, value, onChange, error, disabled, ctx }) => {
  const currencies = field.settings?.currencies ?? ["TRY"];
  const currencyOptions = currencies.map((code) => ({ value: code, label: code }));
  const current = value ?? { amount: "", currency: currencies[0] };
  const update = (patch) => {
    const next = { ...current, ...patch };
    onChange(next.amount === "" ? null : next);
  };
  return (
    <Composite field={field} ctx={ctx} error={error}>
      <Input label="Tutar" inputMode="decimal" disabled={disabled} value={current.amount} onChange={(event) => DECIMAL_INPUT.test(event.target.value) && update({ amount: event.target.value.replace(",", ".") })} />
      <Select label="Para birimi" isDisabled={disabled} options={currencyOptions} value={currencyOptions.find((option) => option.value === current.currency)} onChange={(option) => update({ currency: option?.value ?? currencies[0] })} />
    </Composite>
  );
};

const BooleanEditor = ({ field, value, onChange, error, disabled, ctx }) => {
  const meta = useFieldMeta(field, ctx);
  const props = { label: meta.label, description: meta.help, checked: value === true, disabled, onChange: (event) => onChange(event.target.checked) };
  return (
    <div className="field_editor_boolean">
      {field.ui?.widget === "checkbox" ? <Checkbox {...props} error={error} /> : <Switch {...props} />}
      {error && field.ui?.widget !== "checkbox" && <p className="field_editor_error" role="alert">{error}</p>}
    </div>
  );
};

const SelectEditor = ({ field, value, onChange, error, disabled, ctx }) => {
  const meta = useFieldMeta(field, ctx);
  // Aynı alan tekrar eden satır ve bloklarda birden çok kez çizilir; ad ve kimlik örneğe özgü olmalı.
  const uid = useId();
  const list = options(field, value);
  const widget = field.ui?.widget ?? "dropdown";
  if (widget === "radio" || (widget === "chips" && list.length > 6)) {
    return <RadioGroup label={meta.label} description={meta.help} required={meta.required} error={error} disabled={disabled} name={uid} options={list} value={value ?? ""} onChange={onChange} orientation={list.length > 4 ? "vertical" : "horizontal"} />;
  }
  // Tek seçenek varsa seçilecek bir şey yoktur; alan gösterilmez (ör. tasarımın tek görünümü).
  if (widget === "chips" && list.length === 1 && value === list[0].value) return null;
  if (widget === "chips") {
    return (
      <div className="field_editor_chips">
        <span className="field_editor_label" id={`${uid}-label`}>{meta.label}{meta.required && <span className="field_editor_required" aria-hidden="true">*</span>}</span>
        <SegmentedControl ariaLabel={meta.label} options={list} value={value ?? ""} onChange={(next) => !disabled && onChange(next)} />
        {meta.help && <span className="field_editor_hint">{meta.help}</span>}
        {error && <p className="field_editor_error" role="alert">{error}</p>}
      </div>
    );
  }
  return (
    <Select label={meta.label} hint={meta.help} required={meta.required} error={error} isDisabled={disabled} isClearable={!meta.required} options={list}
      value={list.find((option) => option.value === value) ?? null} onChange={(option) => onChange(option?.value ?? null)} placeholder="Seçin" />
  );
};

const MultiSelectEditor = ({ field, value, onChange, error, disabled, ctx }) => {
  const meta = useFieldMeta(field, ctx);
  const uid = useId();
  const list = options(field, value);
  const selected = value ?? [];
  if (field.ui?.widget === "checkboxes" || field.ui?.widget === "chips") {
    return <CheckboxGroup label={meta.label} description={meta.help} required={meta.required} error={error} disabled={disabled} name={uid} options={list} value={selected} onChange={(next) => onChange(next.length ? next : null)} columns={list.length > 4 ? 2 : undefined} variant={field.ui?.widget === "chips" ? "card" : "default"} />;
  }
  return (
    <Select label={meta.label} hint={meta.help} required={meta.required} error={error} isDisabled={disabled} isMulti options={list}
      value={list.filter((option) => selected.includes(option.value))} onChange={(next) => onChange(next.length ? next.map((option) => option.value) : null)} placeholder="Seçin" />
  );
};

const DateEditor = ({ field, value, onChange, error, disabled, ctx }) => {
  const meta = useFieldMeta(field, ctx);
  if (field.type === "datetime") {
    const { date, time } = isoToZoned(value, ctx.timeZone);
    const update = (nextDate, nextTime) => onChange(nextDate ? zonedToIso(nextDate, nextTime || "00:00", ctx.timeZone) : null);
    return (
      <Composite field={field} ctx={{ ...ctx }} error={error}>
        <Input label="Tarih" type="date" disabled={disabled} value={date} onChange={(event) => update(event.target.value, time)} />
        <Input label="Saat" type="time" disabled={disabled} value={time} onChange={(event) => update(date, event.target.value)} hint={`Saat dilimi: ${ctx.timeZone}`} />
      </Composite>
    );
  }
  if (field.type === "dateRange") {
    const current = value ?? { start: "", end: null };
    const update = (patch) => {
      const next = { ...current, ...patch };
      onChange(next.start ? { start: next.start, end: next.end || null } : null);
    };
    return (
      <Composite field={field} ctx={ctx} error={error}>
        <Input label="Başlangıç" type="date" disabled={disabled} value={current.start ?? ""} onChange={(event) => update({ start: event.target.value })} />
        <Input label="Bitiş" type="date" disabled={disabled} optionalText={field.settings?.allowOpenEnd ? "Boş bırakılabilir" : undefined} min={current.start || undefined} value={current.end ?? ""} onChange={(event) => update({ end: event.target.value })} />
      </Composite>
    );
  }
  return (
    <Input label={meta.label} hint={meta.help} required={meta.required} error={error} disabled={disabled} readOnly={disabled} type={field.type === "time" ? "time" : "date"}
      min={field.settings?.minDate} max={field.settings?.maxDate} value={value ?? ""} onChange={(event) => onChange(blankToNull(event.target.value))} />
  );
};

const EMBED_PATTERNS = [
  { provider: "youtube", pattern: /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/ },
  { provider: "vimeo", pattern: /vimeo\.com\/(?:video\/)?(\d{4,})/ },
];

const EmbedEditor = ({ field, value, onChange, error, disabled, ctx }) => {
  const meta = useFieldMeta(field, ctx);
  const [text, setText] = useState(value ? (value.provider === "youtube" ? `https://www.youtube.com/watch?v=${value.externalId}` : `https://vimeo.com/${value.externalId}`) : "");
  const allowed = field.settings?.providers ?? ["youtube", "vimeo"];
  const parse = (input) => {
    setText(input);
    if (!input.trim()) {
      onChange(null);
      return;
    }
    const match = EMBED_PATTERNS.filter((item) => allowed.includes(item.provider)).map((item) => ({ provider: item.provider, id: item.pattern.exec(input)?.[1] })).find((item) => item.id);
    onChange(match ? { provider: match.provider, externalId: match.id } : { provider: "", externalId: input });
  };
  return (
    <Input label={meta.label} hint={meta.help ?? `${allowed.join(" veya ")} video bağlantısını yapıştırın.`} required={meta.required} error={error} disabled={disabled} type="url" value={text} placeholder="https://www.youtube.com/watch?v=…" onChange={(event) => parse(event.target.value)} />
  );
};

const LinkEditor = ({ field, value, onChange, error, disabled, ctx }) => {
  const settings = field.settings ?? {};
  const kinds = [settings.allowInternal !== false && { value: "internal", label: "Site içi sayfa" }, settings.allowExternal !== false && { value: "external", label: "Dış adres" }].filter(Boolean);
  const current = value ?? { kind: kinds[0]?.value, label: "", target: "_self" };
  const update = (patch) => {
    const next = { ...current, ...patch };
    const empty = !next.label && !next.url && !next.path;
    if (empty) {
      onChange(null);
      return;
    }
    const clean = { kind: next.kind, target: next.target ?? "_self" };
    if (next.label) clean.label = next.label;
    if (next.kind === "internal" && next.path) clean.path = next.path;
    if (next.kind === "external" && next.url) clean.url = next.url;
    if (field.type === "button") clean.variant = next.variant ?? settings.variants?.[0];
    onChange(clean);
  };
  const variantLabels = { primary: "Birincil", secondary: "İkincil", link: "Bağlantı görünümü" };
  const variantOptions = (settings.variants ?? []).map((item) => ({ value: item, label: variantLabels[item] ?? item }));
  return (
    <Composite field={field} ctx={ctx} error={error}>
      <Input label={field.type === "button" ? "Düğme yazısı" : "Bağlantı yazısı"} required={field.type === "button"} disabled={disabled} value={current.label ?? ""} maxLength={120} onChange={(event) => update({ label: event.target.value })} />
      {kinds.length > 1 && <SegmentedControl ariaLabel="Bağlantı türü" options={kinds} value={current.kind} onChange={(kind) => !disabled && update({ kind })} />}
      {current.kind === "internal"
        ? <Input label="Sayfa yolu" disabled={disabled} value={current.path ?? ""} placeholder="/iletisim" onChange={(event) => update({ path: event.target.value })} hint="Sitenizdeki sayfanın adresi; / ile başlar." />
        : <Input label="Adres" type="url" disabled={disabled} value={current.url ?? ""} placeholder="https://" onChange={(event) => update({ url: event.target.value.trim() })} />}
      {field.type === "button" && variantOptions.length > 1 && (
        <Select label="Görünüm" isDisabled={disabled} options={variantOptions} value={variantOptions.find((option) => option.value === (current.variant ?? settings.variants?.[0])) ?? null} onChange={(option) => update({ variant: option?.value })} />
      )}
      <Checkbox label="Yeni sekmede aç" disabled={disabled} checked={current.target === "_blank"} onChange={(event) => update({ target: event.target.checked ? "_blank" : "_self" })} />
    </Composite>
  );
};

const AddressEditor = ({ field, value, onChange, error, disabled, ctx }) => {
  const current = value ?? {};
  const update = (key, text) => {
    const next = { ...current, [key]: text || undefined };
    Object.keys(next).forEach((item) => next[item] === undefined && delete next[item]);
    onChange(Object.keys(next).length ? next : null);
  };
  return (
    <Composite field={field} ctx={ctx} error={error}>
      <Input label="Adres" disabled={disabled} value={current.line1 ?? ""} maxLength={200} onChange={(event) => update("line1", event.target.value)} className="field_editor_span" />
      <Input label="Adres (devam)" optionalText="İsteğe bağlı" disabled={disabled} value={current.line2 ?? ""} maxLength={200} onChange={(event) => update("line2", event.target.value)} className="field_editor_span" />
      <Input label="İlçe" optionalText="İsteğe bağlı" disabled={disabled} value={current.district ?? ""} onChange={(event) => update("district", event.target.value)} />
      <Input label="Şehir" disabled={disabled} value={current.city ?? ""} onChange={(event) => update("city", event.target.value)} />
      <Input label="Posta kodu" optionalText="İsteğe bağlı" disabled={disabled} value={current.postalCode ?? ""} onChange={(event) => update("postalCode", event.target.value)} />
      <Input label="Ülke kodu" disabled={disabled} value={current.country ?? ""} maxLength={2} placeholder="TR" onChange={(event) => update("country", event.target.value.toUpperCase())} hint="İki harf (ör. TR)." />
    </Composite>
  );
};

const GeoEditor = ({ field, value, onChange, error, disabled, ctx }) => {
  const current = value ?? {};
  const update = (key, text) => {
    const next = { ...current, [key]: text === "" ? undefined : Number(text) };
    onChange(next.lat === undefined && next.lng === undefined ? null : next);
  };
  return (
    <Composite field={field} ctx={ctx} error={error}>
      <Input label="Enlem" type="number" step="any" min={-90} max={90} disabled={disabled} value={current.lat ?? ""} onChange={(event) => update("lat", event.target.value)} />
      <Input label="Boylam" type="number" step="any" min={-180} max={180} disabled={disabled} value={current.lng ?? ""} onChange={(event) => update("lng", event.target.value)} />
    </Composite>
  );
};

const ColorEditor = ({ field, value, onChange, error, disabled, ctx }) => {
  const meta = useFieldMeta(field, ctx);
  const uid = useId();
  const palette = field.settings?.palette ?? [];
  if (palette.length > 0) {
    return <RadioGroup label={meta.label} description={meta.help} required={meta.required} error={error} disabled={disabled} name={uid} orientation="horizontal" options={palette.map((color) => ({ value: color, label: color }))} value={value ?? ""} onChange={onChange} />;
  }
  return (
    <div className="field_editor_color">
      <Input label={meta.label} hint={meta.help ?? "#RRGGBB biçiminde."} required={meta.required} error={error} disabled={disabled} value={value ?? ""} maxLength={7} placeholder="#0E3B83" onChange={(event) => onChange(blankToNull(event.target.value))}
        addonBefore={<input type="color" className="field_editor_swatch" aria-label={`${meta.label} renk seçici`} disabled={disabled} value={/^#[0-9a-fA-F]{6}$/.test(value ?? "") ? value : "#000000"} onChange={(event) => onChange(event.target.value)} />} />
    </div>
  );
};

const JsonEditor = ({ field, value, onChange, error, disabled, ctx }) => {
  const meta = useFieldMeta(field, ctx);
  const [text, setText] = useState(value === undefined || value === null ? "" : JSON.stringify(value, null, 2));
  const [parseError, setParseError] = useState(null);
  return (
    <Textarea label={meta.label} hint={meta.help} required={meta.required} error={parseError ?? error} disabled={disabled} rows={6} value={text} className="field_editor_mono" spellCheck={false}
      onChange={(event) => {
        setText(event.target.value);
        if (!event.target.value.trim()) {
          setParseError(null);
          onChange(null);
          return;
        }
        try {
          onChange(JSON.parse(event.target.value));
          setParseError(null);
        } catch {
          setParseError("Geçerli JSON değil.");
        }
      }} />
  );
};

const ComputedValue = ({ field, ctx }) => {
  const meta = useFieldMeta(field, ctx);
  const value = ctx.computed?.[field.key];
  return (
    <div className="field_editor_computed">
      <span className="field_editor_label">{meta.label}</span>
      <output className="field_editor_computed_value">{value === null || value === undefined || value === "" ? "—" : String(value)}</output>
      <span className="field_editor_hint">Diğer alanlardan otomatik hesaplanır; kaydedince güncellenir.</span>
    </div>
  );
};

const ObjectEditor = ({ field, value, onChange, error, disabled, ctx, errors }) => {
  const current = value ?? {};
  return (
    <Composite field={field} ctx={ctx} error={error} columns={1}>
      <div className="field_editor_nested">
        {(field.fields ?? []).filter((child) => !child.archived && !child.hidden).map((child) => (
          <FieldEditor key={child.id} field={child} value={readValue(child, current[child.key], ctx.locale)} disabled={disabled || !child.editable} ctx={{ ...ctx, nested: true }}
            error={errors?.[`${field.key}.${child.key}`]}
            onChange={(next) => {
              const result = { ...current };
              const written = writeValue(child, current[child.key], ctx.locale, next);
              if (written === undefined) delete result[child.key];
              else result[child.key] = written;
              onChange(Object.keys(result).length ? result : null);
            }} />
        ))}
      </div>
    </Composite>
  );
};

/**
 * Şemadaki bir alanın düzenleyicisi (şartname §5.1, §25.2). Değer alanın API biçimindedir; dile bağlı alanda
 * yalnız seçili dilin değeri gelir. Her düzenleyici boş, hatalı, salt okunur ve klavye durumlarını kapsar.
 */
const FieldEditor = (props) => {
  const { field } = props;
  const fieldType = getFieldType(field.type);
  if (!fieldType) return <Alert variant="warning" size="compact">{labelOf(field.label)}: bu alan bu ekranda düzenlenemiyor.</Alert>;
  switch (fieldType.valueKind) {
    case "string": return <TextLike {...props} />;
    case "richText": return <RichTextField {...props} />;
    case "integer":
    case "decimal": return <NumberLike {...props} />;
    case "money": return <MoneyEditor {...props} />;
    case "boolean": return <BooleanEditor {...props} />;
    case "optionId": return <SelectEditor {...props} />;
    case "optionIds": return <MultiSelectEditor {...props} />;
    case "date":
    case "time":
    case "datetime":
    case "dateRange": return <DateEditor {...props} />;
    case "asset":
    case "assetList": return <MediaField {...props} label={labelOf(field.label, props.ctx.uiLocale)} />;
    case "embed": return <EmbedEditor {...props} />;
    case "link":
    case "button": return <LinkEditor {...props} />;
    case "entryRef":
    case "entryRefList": return <RelationPicker {...props} label={labelOf(field.label, props.ctx.uiLocale)} />;
    case "object": return <ObjectEditor {...props} />;
    case "rows":
    case "blocks": return <RowsEditor {...props} FieldEditor={FieldEditor} />;
    case "keyValueRows":
    case "specRows": return <KeyValueEditor {...props} label={labelOf(field.label, props.ctx.uiLocale)} />;
    case "address": return <AddressEditor {...props} />;
    case "geo": return <GeoEditor {...props} />;
    case "openingHours": return <OpeningHoursEditor {...props} label={labelOf(field.label, props.ctx.uiLocale)} />;
    case "color": return <ColorEditor {...props} />;
    case "icon": return <TextLike {...props} field={{ ...field, type: "text" }} />;
    case "token": {
      const list = (field.settings?.tokens ?? []).map((token) => ({ id: token, label: { tr: token } }));
      return <SelectEditor {...props} field={{ ...field, settings: { options: list } }} />;
    }
    case "json": return <JsonEditor {...props} />;
    case "contentSource": return <ContentSourceEditor {...props} />;
    case "menuTree": return <MenuTreeEditor {...props} />;
    case "computed": return <ComputedValue {...props} />;
    default: return <Alert variant="warning" size="compact">{labelOf(field.label)}: bu alan bu ekranda düzenlenemiyor.</Alert>;
  }
};

function RichTextField({ field, value, onChange, error, disabled, ctx }) {
  const meta = useFieldMeta(field, ctx);
  const id = useId();
  return (
    <div className={cx("field_editor_rich", error && "field_editor_rich_invalid")}>
      <span className="field_editor_label" id={`${id}-label`}>{meta.label}{meta.required && <span className="field_editor_required" aria-hidden="true">*</span>}</span>
      <Suspense fallback={<Skeleton variant="rectangle" height={200} radius="md" />}>
        <RichTextEditor value={value} onChange={onChange} allowedNodes={field.settings?.allowedNodes ?? []} disabled={disabled} labelledBy={`${id}-label`} describedBy={meta.help || error ? `${id}-desc` : undefined} invalid={Boolean(error)} />
      </Suspense>
      {(meta.help || error) && <span id={`${id}-desc`} className={error ? "field_editor_error" : "field_editor_hint"} role={error ? "alert" : undefined}>{error ?? meta.help}</span>}
    </div>
  );
}

export default FieldEditor;
