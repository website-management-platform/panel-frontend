import { useState } from "react";
import { FiArrowDown, FiArrowUp, FiChevronDown, FiChevronRight, FiCopy, FiPlus, FiTrash2 } from "react-icons/fi";
import { labelOf } from "@wmp/schema";
import Button from "@/components/Button";
import Dropdown, { DropdownItem } from "@/components/Dropdown";
import { readValue, writeValue } from "../../localized";
import "./rows_editor.scss";

const newRowId = () => globalThis.crypto.randomUUID();

// Satırın başlığı: ilk metin değeri, yoksa sıra numarası.
const rowTitle = (row, fields, index, blockLabel, locale) => {
  const text = (field) => readValue(field, row[field.key], locale);
  // Seçim ve teknik alanlar (ör. görünüm kodu) başlık olmaz; ilk metin alanı kullanılır.
  const candidates = fields.filter((field) => ["text", "textarea"].includes(field.type) && typeof text(field) === "string" && text(field));
  const first = ["heading", "title", "name"].map((key) => candidates.find((field) => field.key === key)).find(Boolean) ?? candidates[0];
  return [blockLabel, first ? text(first) : `${index + 1}. satır`].filter(Boolean).join(" · ");
};

/**
 * Tekrarlanan satırlar (repeater) ve esnek bloklar (unionBlocks). Satır kimliği kararlıdır: sıralama ve kopyalama
 * kimliği korur veya yeni üretir (şartname §6: stable row ID, reorder, duplicate). Sürükle bırak yerine klavyeyle
 * erişilebilir yukarı/aşağı düğmeleri vardır.
 */
const RowsEditor = ({ field, value, onChange, error, disabled, ctx, errors, FieldEditor }) => {
  const rows = Array.isArray(value) ? value : [];
  const blocks = field.type === "unionBlocks";
  const settings = field.settings ?? {};
  const max = settings.maxItems ?? 500;
  const label = labelOf(field.label, ctx.uiLocale);
  const emit = (next) => onChange(next.length ? next : null);
  // Sayfa bölümlerinde sitenin tasarımı (frontend manifest'i) yalnız desteklediği tür ve görünümleri sunar (AT-22).
  const design = blocks ? ctx.design : null;
  const supportOf = (key) => design?.sections.find((item) => item.key === key) ?? null;
  const adapt = (child, row) => {
    if (!design || child.key !== "variant" || child.type !== "select") return child;
    const variants = supportOf(row.type)?.variants ?? [];
    return { ...child, settings: { ...child.settings, options: (child.settings?.options ?? []).map((option) => (variants.includes(option.id) ? option : { ...option, archived: true })) } };
  };
  const childFields = (row) => (blocks ? field.blocks?.find((block) => block.key === row.type)?.fields ?? [] : field.fields ?? []).filter((child) => !child.archived && !child.hidden).map((child) => adapt(child, row));
  const blockCount = (key) => rows.filter((row) => row.type === key).length;
  const addable = (field.blocks ?? []).filter((block) => (!block.maxItems || blockCount(block.key) < block.maxItems) && (!design || supportOf(block.key)));
  // Yeni blok, tasarımın desteklediği ilk görünümle başlar.
  const newBlock = (block) => {
    const variant = supportOf(block.key)?.variants.find((item) => block.fields.some((child) => child.key === "variant" && child.settings?.options?.some((option) => option.id === item)));
    return { id: newRowId(), type: block.key, ...(variant ? { variant } : {}) };
  };

  // Esnek bloklar (ör. sayfa bölümleri) kapalı listelenir; düzenlenecek olan açılır. Yeni eklenen ve hatalı olan açık gelir.
  const collapsible = blocks && !ctx.nested;
  const [openIds, setOpenIds] = useState(() => new Set());
  const hasError = (row) => Object.keys(errors ?? {}).some((path) => path.startsWith(`${field.key}.${rows.indexOf(row)}`));
  const isOpen = (row) => !collapsible || openIds.has(row.id) || hasError(row);
  const toggle = (row) => setOpenIds((current) => {
    const next = new Set(current);
    if (next.has(row.id)) next.delete(row.id);
    else next.add(row.id);
    return next;
  });
  const openRow = (id) => setOpenIds((current) => new Set(current).add(id));

  const move = (index, direction) => {
    const next = [...rows];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    emit(next);
  };

  return (
    <fieldset className="rows_editor" aria-describedby={error ? `${field.id}-error` : undefined}>
      <legend className="rows_editor_legend">
        {label}{field.required && <span className="field_editor_required" aria-hidden="true">*</span>}
        <span className="rows_editor_count">{rows.length}{settings.maxItems ? ` / ${settings.maxItems}` : ""}</span>
      </legend>
      {field.help?.tr && <p className="field_editor_hint">{field.help.tr}</p>}
      {rows.length === 0 && <p className="rows_editor_empty">Henüz satır yok.</p>}
      <ol className="rows_editor_list">
        {rows.map((row, index) => {
          const fields = childFields(row);
          const block = blocks ? field.blocks?.find((item) => item.key === row.type) : null;
          const title = rowTitle(row, fields, index, block ? labelOf(block.label) : null, ctx.locale);
          return (
            <li key={row.id} className="rows_editor_row">
              <div className="rows_editor_row_head">
                {collapsible ? (
                  <button type="button" className="rows_editor_row_toggle" aria-expanded={isOpen(row)} aria-controls={`${row.id}-fields`} onClick={() => toggle(row)}>
                    {isOpen(row) ? <FiChevronDown aria-hidden="true" /> : <FiChevronRight aria-hidden="true" />}
                    <span className="rows_editor_row_title">{title}{row.hidden === true && <span className="rows_editor_row_hidden"> · sitede gizli</span>}</span>
                  </button>
                ) : <span className="rows_editor_row_title">{title}</span>}
                {!disabled && (
                  <span className="rows_editor_row_actions">
                    <Button variant="ghost" size="sm" icon={FiArrowUp} ariaLabel={`${title}: yukarı taşı`} disabled={index === 0} onClick={() => move(index, -1)} />
                    <Button variant="ghost" size="sm" icon={FiArrowDown} ariaLabel={`${title}: aşağı taşı`} disabled={index === rows.length - 1} onClick={() => move(index, 1)} />
                    <Button variant="ghost" size="sm" icon={FiCopy} ariaLabel={`${title}: çoğalt`} disabled={rows.length >= max || (block?.maxItems && blockCount(block.key) >= block.maxItems)}
                      onClick={() => emit([...rows.slice(0, index + 1), { ...structuredClone(row), id: newRowId() }, ...rows.slice(index + 1)])} />
                    <Button variant="ghost" size="sm" color="danger" icon={FiTrash2} ariaLabel={`${title}: sil`} onClick={() => emit(rows.filter((item) => item.id !== row.id))} />
                  </span>
                )}
              </div>
              {design && block && !supportOf(block.key) && <p className="rows_editor_warning" role="note">Sitenin tasarımı bu bölümü göstermiyor; yayınlamadan önce kaldırın veya gizleyin.</p>}
              <div className="rows_editor_fields" id={`${row.id}-fields`} hidden={!isOpen(row)}>
                {fields.map((child) => (
                  <FieldEditor key={child.id} field={child} value={readValue(child, row[child.key], ctx.locale)} disabled={disabled || !child.editable} ctx={{ ...ctx, nested: true }} errors={errors}
                    onChange={(next) => {
                      const updated = { ...row };
                      const written = writeValue(child, row[child.key], ctx.locale, next);
                      if (written === undefined) delete updated[child.key];
                      else updated[child.key] = written;
                      emit(rows.map((item) => (item.id === row.id ? updated : item)));
                    }} />
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      {!disabled && rows.length < max && (
        blocks ? (
          <Dropdown trigger={({ toggle, triggerProps }) => <Button variant="outline" size="sm" icon={FiPlus} disabled={addable.length === 0} {...triggerProps} onClick={toggle}>Bölüm ekle</Button>}>
            {({ close }) => addable.map((item) => (
              <DropdownItem key={item.key} onClick={() => { const created = newBlock(item); openRow(created.id); emit([...rows, created]); close(); }}>{labelOf(item.label)}</DropdownItem>
            ))}
          </Dropdown>
        ) : (
          <Button variant="outline" size="sm" icon={FiPlus} onClick={() => emit([...rows, { id: newRowId() }])}>Satır ekle</Button>
        )
      )}
      {error && <p className="field_editor_error" id={`${field.id}-error`} role="alert">{error}</p>}
    </fieldset>
  );
};

export default RowsEditor;
