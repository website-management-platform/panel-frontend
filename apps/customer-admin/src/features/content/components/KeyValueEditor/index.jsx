import { FiArrowDown, FiArrowUp, FiPlus, FiTrash2 } from "react-icons/fi";
import Button from "@/components/Button";
import Input from "@/components/Input";
import "./key_value_editor.scss";

/** Ad–değer satırları (künye, teknik özellik). Özellik tablosunda satırlar gruplanabilir. */
const KeyValueEditor = ({ field, label, value, onChange, error, disabled }) => {
  const rows = Array.isArray(value) ? value : [];
  const grouped = field.type === "specificationTable" && field.settings?.grouped !== false;
  const max = field.settings?.maxItems ?? 500;
  const emit = (next) => onChange(next.length ? next : null);
  const update = (index, patch) => emit(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  const move = (index, direction) => {
    const next = [...rows];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    emit(next);
  };
  return (
    <fieldset className="key_value_editor" disabled={disabled}>
      <legend className="field_editor_label">{label}{field.required && <span className="field_editor_required" aria-hidden="true">*</span>}</legend>
      {rows.length === 0 && <p className="field_editor_hint">Henüz satır yok.</p>}
      <ol className="key_value_editor_list">
        {rows.map((row, index) => (
          <li key={row.id} className={grouped ? "key_value_editor_row key_value_editor_row_grouped" : "key_value_editor_row"}>
            {grouped && <Input aria-label={`${index + 1}. satır grubu`} size="sm" placeholder="Grup" value={row.group ?? ""} maxLength={120} onChange={(event) => update(index, { group: event.target.value || undefined })} />}
            <Input aria-label={`${index + 1}. satır adı`} size="sm" placeholder="Ad" value={row.key ?? ""} maxLength={120} onChange={(event) => update(index, { key: event.target.value })} />
            <Input aria-label={`${index + 1}. satır değeri`} size="sm" placeholder="Değer" value={row.value ?? ""} maxLength={2000} onChange={(event) => update(index, { value: event.target.value })} />
            <span className="key_value_editor_actions">
              <Button variant="ghost" size="sm" icon={FiArrowUp} ariaLabel={`${index + 1}. satırı yukarı taşı`} disabled={index === 0} onClick={() => move(index, -1)} />
              <Button variant="ghost" size="sm" icon={FiArrowDown} ariaLabel={`${index + 1}. satırı aşağı taşı`} disabled={index === rows.length - 1} onClick={() => move(index, 1)} />
              <Button variant="ghost" size="sm" color="danger" icon={FiTrash2} ariaLabel={`${index + 1}. satırı sil`} onClick={() => emit(rows.filter((_, position) => position !== index))} />
            </span>
          </li>
        ))}
      </ol>
      {rows.length < max && <Button variant="outline" size="sm" icon={FiPlus} onClick={() => emit([...rows, { id: globalThis.crypto.randomUUID(), key: "", value: "" }])}>Satır ekle</Button>}
      {error && <p className="field_editor_error" role="alert">{error}</p>}
    </fieldset>
  );
};

export default KeyValueEditor;
