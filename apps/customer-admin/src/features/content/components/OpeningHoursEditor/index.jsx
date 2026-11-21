import { FiPlus, FiTrash2 } from "react-icons/fi";
import Button from "@/components/Button";
import Checkbox from "@/components/Checkbox";
import Input from "@/components/Input";
import "./opening_hours_editor.scss";

const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

const emptyWeek = () => DAYS.map((_, index) => ({ day: index + 1, closed: index >= 5, ...(index >= 5 ? {} : { open: "09:00", close: "18:00" }) }));

/** Haftalık çalışma saatleri ve tarih istisnaları (resmi tatil, özel gün). */
const OpeningHoursEditor = ({ field, label, value, onChange, error, disabled }) => {
  const current = value ?? null;
  const allowExceptions = field.settings?.allowExceptions !== false;
  if (!current) {
    return (
      <div className="opening_hours_editor">
        <span className="field_editor_label">{label}</span>
        {!disabled && <Button variant="outline" size="sm" icon={FiPlus} onClick={() => onChange({ weekly: emptyWeek(), exceptions: [] })}>Çalışma saatlerini gir</Button>}
        {error && <p className="field_editor_error" role="alert">{error}</p>}
      </div>
    );
  }
  const setDay = (day, patch) => onChange({ ...current, weekly: current.weekly.map((item) => {
    if (item.day !== day) return item;
    const next = { ...item, ...patch };
    if (next.closed) {
      delete next.open;
      delete next.close;
    } else {
      next.open = next.open ?? "09:00";
      next.close = next.close ?? "18:00";
    }
    return next;
  }) });
  const exceptions = current.exceptions ?? [];
  const setException = (index, patch) => onChange({ ...current, exceptions: exceptions.map((item, position) => (position === index ? { ...item, ...patch } : item)) });

  return (
    <fieldset className="opening_hours_editor" disabled={disabled}>
      <legend className="field_editor_label">{label}</legend>
      <table className="opening_hours_editor_table">
        <caption className="opening_hours_editor_sr">Haftalık saatler</caption>
        <thead><tr><th scope="col">Gün</th><th scope="col">Kapalı</th><th scope="col">Açılış</th><th scope="col">Kapanış</th></tr></thead>
        <tbody>
          {current.weekly.map((item) => (
            <tr key={item.day}>
              <th scope="row">{DAYS[item.day - 1]}</th>
              <td><Checkbox label={`${DAYS[item.day - 1]} kapalı`} className="opening_hours_editor_hidden_label" checked={Boolean(item.closed)} onChange={(event) => setDay(item.day, { closed: event.target.checked })} /></td>
              <td><Input aria-label={`${DAYS[item.day - 1]} açılış`} type="time" size="sm" disabled={item.closed || disabled} value={item.open ?? ""} onChange={(event) => setDay(item.day, { open: event.target.value })} /></td>
              <td><Input aria-label={`${DAYS[item.day - 1]} kapanış`} type="time" size="sm" disabled={item.closed || disabled} value={item.close ?? ""} onChange={(event) => setDay(item.day, { close: event.target.value })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {allowExceptions && (
        <div className="opening_hours_editor_exceptions">
          <span className="field_editor_label">Özel günler</span>
          {exceptions.map((item, index) => (
            <div key={index} className="opening_hours_editor_exception">
              <Input aria-label={`${index + 1}. özel gün tarihi`} type="date" size="sm" value={item.date ?? ""} onChange={(event) => setException(index, { date: event.target.value })} />
              <Checkbox label="Kapalı" checked={Boolean(item.closed)} onChange={(event) => setException(index, event.target.checked ? { closed: true, open: undefined, close: undefined } : { closed: false, open: "10:00", close: "16:00" })} />
              {!item.closed && (
                <>
                  <Input aria-label={`${index + 1}. özel gün açılış`} type="time" size="sm" value={item.open ?? ""} onChange={(event) => setException(index, { open: event.target.value })} />
                  <Input aria-label={`${index + 1}. özel gün kapanış`} type="time" size="sm" value={item.close ?? ""} onChange={(event) => setException(index, { close: event.target.value })} />
                </>
              )}
              <Input aria-label={`${index + 1}. özel gün notu`} size="sm" placeholder="Not (ör. Resmî tatil)" value={item.note ?? ""} onChange={(event) => setException(index, { note: event.target.value || undefined })} />
              <Button variant="ghost" size="sm" color="danger" icon={FiTrash2} ariaLabel={`${index + 1}. özel günü sil`} onClick={() => onChange({ ...current, exceptions: exceptions.filter((_, position) => position !== index) })} />
            </div>
          ))}
          <Button variant="outline" size="sm" icon={FiPlus} onClick={() => onChange({ ...current, exceptions: [...exceptions, { date: "", closed: true }] })}>Özel gün ekle</Button>
        </div>
      )}
      {!disabled && <Button variant="link" size="sm" onClick={() => onChange(null)}>Çalışma saatlerini kaldır</Button>}
      {error && <p className="field_editor_error" role="alert">{error}</p>}
    </fieldset>
  );
};

export default OpeningHoursEditor;
