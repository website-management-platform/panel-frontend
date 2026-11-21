import { useState } from "react";
import Select from "@/components/Select";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useEntries } from "../../api";

/**
 * İlişki seçici: hedef bölümün kayıtlarından arayarak seçim. Seçili kayıtların adı da hedef listeden çözülür.
 * Hedef bölüm müşteriye kapalıysa liste boş gelir ve seçim yapılamaz.
 */
const RelationPicker = ({ field, label, value, onChange, error, disabled, ctx }) => {
  const multiple = field.type === "relationList";
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search);
  const target = field.settings?.targetModule;
  const listQuery = useEntries(ctx.siteId, target, { q: query || undefined, size: 50, locale: ctx.locale });
  const selectedIds = multiple ? value ?? [] : value ? [value] : [];
  const selectedQuery = useEntries(ctx.siteId, target, { size: 100, locale: ctx.locale }, { enabled: selectedIds.length > 0 });
  const toOption = (entry) => ({ value: entry.id, label: entry.title || "Adsız kayıt", meta: entry.status === "PUBLISHED" ? null : "Taslak" });
  const known = new Map([...(selectedQuery.data?.items ?? []), ...(listQuery.data?.items ?? [])].map((entry) => [entry.id, toOption(entry)]));
  const selectedOptions = selectedIds.map((id) => known.get(id) ?? { value: id, label: "Bulunamayan kayıt" });
  const options = (listQuery.data?.items ?? []).map(toOption);
  const max = field.settings?.maxItems;

  return (
    <Select
      label={label}
      required={field.required}
      hint={[field.help?.tr, multiple && max ? `En çok ${max} kayıt.` : null].filter(Boolean).join(" ") || undefined}
      error={error ?? (listQuery.isError ? "Bağlı bölümün kayıtları yüklenemedi." : undefined)}
      isDisabled={disabled}
      isMulti={multiple}
      isClearable
      isLoading={listQuery.isFetching}
      options={options}
      value={multiple ? selectedOptions : selectedOptions[0] ?? null}
      filterOption={null}
      onInputChange={(text, { action }) => {
        if (action === "input-change") setSearch(text);
      }}
      isOptionDisabled={() => multiple && max && selectedIds.length >= max}
      formatOptionLabel={(option) => (option.meta ? `${option.label} (${option.meta})` : option.label)}
      onChange={(next) => {
        if (multiple) onChange(next?.length ? next.map((option) => option.value) : null);
        else onChange(next?.value ?? null);
      }}
      placeholder="Kayıt arayın"
      noOptionsMessage={() => "Kayıt bulunamadı"}
    />
  );
};

export default RelationPicker;
