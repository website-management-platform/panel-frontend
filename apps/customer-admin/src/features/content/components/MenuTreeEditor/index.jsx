import { FiArrowDown, FiArrowLeft, FiArrowRight, FiArrowUp, FiPlus, FiTrash2 } from "react-icons/fi";
import { labelOf } from "@wmp/schema";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Select from "@/components/Select";
import Switch from "@/components/Switch";
import { useSiteScope } from "../../../sites/siteContext";
import { useEntries } from "../../api";
import { labelIn, localeName } from "../../labels";
import "./menu_tree_editor.scss";

const KIND_OPTIONS = [
  { value: "page", label: "Sayfa" },
  { value: "entry", label: "İçerik kaydı" },
  { value: "external", label: "Dış adres" },
  { value: "anchor", label: "Sayfa içi bağlantı" },
  { value: "group", label: "Başlık (bağlantısız grup)" },
];
const KIND_TEXT = Object.fromEntries(KIND_OPTIONS.map((option) => [option.value, option.label]));

const newId = () => globalThis.crypto.randomUUID();

// Ağaçta yol: [0, 2] = ilk öğenin üçüncü alt öğesi. Bütün işlemler yeni dizi üretir (değişmez güncelleme).
const updateAt = (items, path, update) => items.map((item, index) => {
  if (index !== path[0]) return item;
  if (path.length === 1) return update(item);
  return { ...item, children: updateAt(item.children ?? [], path.slice(1), update) };
});

const listAt = (items, path) => path.reduce((list, index) => list[index].children ?? [], items);

const replaceList = (items, parentPath, nextList) => (parentPath.length === 0 ? nextList : updateAt(items, parentPath, (item) => ({ ...item, children: nextList })));

const depthOf = (item) => 1 + Math.max(0, ...(item.children ?? []).map(depthOf));

const PageTarget = ({ value, onChange, disabled, pagesKey, siteId, locale }) => {
  const query = useEntries(siteId, pagesKey, { size: 100, locale }, { enabled: Boolean(pagesKey) });
  const options = (query.data?.items ?? []).map((page) => ({ value: page.id, label: `${page.title || "Adsız sayfa"} — ${page.routes?.draft?.[locale] ?? "adres yok"}`, meta: page.isPublished ? null : "yayında değil" }));
  return (
    <Select label="Sayfa" isDisabled={disabled || !pagesKey} isLoading={query.isFetching} options={options}
      value={options.find((option) => option.value === value) ?? (value ? { value, label: "Seçili sayfa" } : null)}
      formatOptionLabel={(option) => (option.meta ? `${option.label} (${option.meta})` : option.label)}
      onChange={(option) => onChange(option?.value)} placeholder="Sayfa seçin" />
  );
};

const EntryTarget = ({ value, onChange, disabled, siteId, locale, modules, defaultLocale }) => {
  const moduleOptions = modules.filter((item) => item.area !== "site" && item.kind !== "singleton").map((item) => ({ value: item.key, label: labelIn(item.label, defaultLocale) }));
  const query = useEntries(siteId, value?.module, { size: 50, locale }, { enabled: Boolean(value?.module) });
  const entryOptions = (query.data?.items ?? []).map((entry) => ({ value: entry.id, label: entry.title || "Adsız kayıt" }));
  return (
    <>
      <Select label="Bölüm" isDisabled={disabled} options={moduleOptions} value={moduleOptions.find((option) => option.value === value?.module) ?? null}
        onChange={(option) => onChange(option ? { module: option.value, id: null } : null)} placeholder="Bölüm seçin" />
      <Select label="Kayıt" isDisabled={disabled || !value?.module} isLoading={query.isFetching} options={entryOptions}
        value={entryOptions.find((option) => option.value === value?.id) ?? null}
        onChange={(option) => onChange({ module: value.module, id: option?.value ?? null })} placeholder="Kayıt seçin" />
    </>
  );
};

/**
 * Menü ağacı (şartname §9 navigation): sayfa, kayıt, dış adres, sayfa içi bağlantı ve grup öğeleri; etiket dile göre.
 * Sürükle bırak yerine klavyeyle erişilebilir yukarı/aşağı/içeri/dışarı düğmeleri. Derinlik sınırı alan ayarındadır.
 */
const MenuTreeEditor = ({ field, value, onChange, error, disabled, ctx }) => {
  const { modules, site } = useSiteScope();
  const items = Array.isArray(value) ? value : [];
  const maxDepth = field.settings?.maxDepth ?? 3;
  const maxItems = field.settings?.maxItems ?? 60;
  const total = JSON.stringify(items).split("\"kind\"").length - 1;
  const pagesKey = modules.find((item) => item.role === "pages")?.key;
  const label = labelOf(field.label, ctx.uiLocale);
  const emit = (next) => onChange(next.length ? next : null);

  const patch = (path, changes) => emit(updateAt(items, path, (item) => ({ ...item, ...changes })));
  const setKind = (path, kind) => emit(updateAt(items, path, (item) => {
    const next = { id: item.id, kind, label: item.label };
    ["hidden", "cta", "children"].forEach((key) => {
      if (item[key] !== undefined && (key !== "children" || kind === "group" || kind === "page")) next[key] = item[key];
    });
    return next;
  }));
  const setLabel = (path, item, text) => {
    const nextLabel = { ...item.label };
    if (text) nextLabel[ctx.locale] = text;
    else delete nextLabel[ctx.locale];
    patch(path, { label: nextLabel });
  };
  const move = (path, direction) => {
    const parent = path.slice(0, -1);
    const index = path.at(-1);
    const list = [...listAt(items, parent)];
    [list[index], list[index + direction]] = [list[index + direction], list[index]];
    emit(replaceList(items, parent, list));
  };
  const remove = (path) => {
    const parent = path.slice(0, -1);
    emit(replaceList(items, parent, listAt(items, parent).filter((_, index) => index !== path.at(-1))));
  };
  // İçeri: önceki kardeşin son alt öğesi olur. Dışarı: üst öğenin hemen arkasına geçer.
  const indent = (path) => {
    const parent = path.slice(0, -1);
    const index = path.at(-1);
    const list = listAt(items, parent);
    const moving = list[index];
    const target = list[index - 1];
    const withoutMoving = replaceList(items, parent, list.filter((_, position) => position !== index));
    emit(updateAt(withoutMoving, [...parent, index - 1], () => ({ ...target, children: [...(target.children ?? []), moving] })));
  };
  const outdent = (path) => {
    const parent = path.slice(0, -1);
    const grand = parent.slice(0, -1);
    const moving = listAt(items, parent)[path.at(-1)];
    const withoutMoving = replaceList(items, parent, listAt(items, parent).filter((_, position) => position !== path.at(-1)));
    const grandList = [...listAt(withoutMoving, grand)];
    grandList.splice(parent.at(-1) + 1, 0, moving);
    emit(replaceList(withoutMoving, grand, grandList));
  };
  const addItem = (parentPath) => {
    const item = { id: newId(), kind: "page", label: {} };
    emit(parentPath ? updateAt(items, parentPath, (target) => ({ ...target, children: [...(target.children ?? []), item] })) : [...items, item]);
  };

  const renderList = (list, parentPath, depth) => (
    <ol className={depth === 1 ? "menu_tree_list" : "menu_tree_list menu_tree_list_nested"}>
      {list.map((item, index) => {
        const path = [...parentPath, index];
        const title = item.label?.[ctx.locale] || item.label?.[site.defaultLocale] || "Etiketsiz öğe";
        const previous = list[index - 1];
        const canIndent = index > 0 && ["group", "page"].includes(previous?.kind) && depth + depthOf(item) - 1 < maxDepth;
        return (
          <li key={item.id} className="menu_tree_item">
            <div className="menu_tree_head">
              <span className="menu_tree_title">{title}</span>
              <Badge size="sm" variant="neutral">{KIND_TEXT[item.kind]}</Badge>
              {item.cta && <Badge size="sm" variant="accent">Öne çıkan</Badge>}
              {item.hidden && <Badge size="sm" variant="warning">Gizli</Badge>}
              {!disabled && (
                <span className="menu_tree_actions">
                  <Button variant="ghost" size="sm" icon={FiArrowUp} ariaLabel={`${title}: yukarı taşı`} disabled={index === 0} onClick={() => move(path, -1)} />
                  <Button variant="ghost" size="sm" icon={FiArrowDown} ariaLabel={`${title}: aşağı taşı`} disabled={index === list.length - 1} onClick={() => move(path, 1)} />
                  <Button variant="ghost" size="sm" icon={FiArrowRight} ariaLabel={`${title}: bir üstteki öğenin altına al`} disabled={!canIndent} onClick={() => indent(path)} />
                  <Button variant="ghost" size="sm" icon={FiArrowLeft} ariaLabel={`${title}: bir düzey dışarı al`} disabled={depth === 1} onClick={() => outdent(path)} />
                  <Button variant="ghost" size="sm" color="danger" icon={FiTrash2} ariaLabel={`${title}: sil`} onClick={() => remove(path)} />
                </span>
              )}
            </div>
            <div className="menu_tree_fields">
              <Select label="Tür" isDisabled={disabled} options={KIND_OPTIONS} value={KIND_OPTIONS.find((option) => option.value === item.kind)} onChange={(option) => option && setKind(path, option.value)} />
              <Input label={`Etiket (${localeName(ctx.locale)})`} required={ctx.locale === site.defaultLocale} maxLength={80} disabled={disabled} value={item.label?.[ctx.locale] ?? ""}
                hint={ctx.locale !== site.defaultLocale && item.label?.[site.defaultLocale] ? `${localeName(site.defaultLocale)}: ${item.label[site.defaultLocale]}` : undefined}
                onChange={(event) => setLabel(path, item, event.target.value)} />
              {item.kind === "page" && <PageTarget value={item.pageId} disabled={disabled} pagesKey={pagesKey} siteId={ctx.siteId} locale={ctx.locale} onChange={(pageId) => patch(path, { pageId })} />}
              {item.kind === "entry" && <EntryTarget value={item.entry} disabled={disabled} siteId={ctx.siteId} locale={ctx.locale} modules={modules} defaultLocale={site.defaultLocale} onChange={(entry) => patch(path, { entry })} />}
              {item.kind === "external" && <Input label="Adres" type="url" required disabled={disabled} value={item.url ?? ""} placeholder="https://" onChange={(event) => patch(path, { url: event.target.value || undefined })} />}
              {item.kind === "anchor" && <Input label="Bölüm bağlantı adı" required disabled={disabled} value={item.anchor ?? ""} hint="Sayfa bölümündeki bağlantı adı (ör. iletisim)." onChange={(event) => patch(path, { anchor: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") || undefined })} />}
              <div className="menu_tree_switches">
                {item.kind === "external" && <Switch label="Yeni sekmede aç" checked={Boolean(item.newTab)} disabled={disabled} onChange={(event) => patch(path, { newTab: event.target.checked || undefined })} />}
                <Switch label="Öne çıkar (düğme görünümü)" checked={Boolean(item.cta)} disabled={disabled} onChange={(event) => patch(path, { cta: event.target.checked || undefined })} />
                <Switch label="Menüde gösterme" checked={Boolean(item.hidden)} disabled={disabled} onChange={(event) => patch(path, { hidden: event.target.checked || undefined })} />
              </div>
            </div>
            {(item.children?.length ?? 0) > 0 && renderList(item.children, path, depth + 1)}
            {!disabled && ["group", "page"].includes(item.kind) && depth < maxDepth && total < maxItems && (
              <Button variant="link" size="sm" icon={FiPlus} onClick={() => addItem(path)}>Alt öğe ekle<span className="visually_hidden">: {title}</span></Button>
            )}
          </li>
        );
      })}
    </ol>
  );

  return (
    <fieldset className="menu_tree" aria-describedby={error ? `${field.id}-error` : undefined}>
      <legend className="menu_tree_legend">{label} <span className="menu_tree_count">{total} / {maxItems}</span></legend>
      {items.length === 0 ? <p className="menu_tree_empty">Menüde öğe yok.</p> : renderList(items, [], 1)}
      {!disabled && <Button variant="outline" size="sm" icon={FiPlus} disabled={total >= maxItems} onClick={() => addItem(null)}>Öğe ekle</Button>}
      {error && <p className="field_editor_error" id={`${field.id}-error`} role="alert">{error}</p>}
    </fieldset>
  );
};

export default MenuTreeEditor;
