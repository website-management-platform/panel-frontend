import { useState } from "react";
import { Link } from "react-router";
import { FiArrowRight } from "react-icons/fi";
import { labelOf } from "@wmp/schema";
import FieldGroup from "@/components/FieldGroup";
import Input from "@/components/Input";
import SegmentedControl from "@/components/SegmentedControl";
import Select from "@/components/Select";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { sitePath, useSiteScope } from "../../../sites/siteContext";
import { useEntries } from "../../api";
import { labelIn } from "../../labels";
import "./content_source_editor.scss";

const MODE_TEXT = { collection: "Bölümün kayıtları", singleton: "Tek sayfalık bölüm", entries: "Seçtiğim kayıtlar" };

/**
 * İçerik kaynağı (şartname §9 section source): bölüm verisini sitedeki bir modülden alır. Yayında yalnız yayındaki
 * kayıtlar görünür; elle seçilen kayıt yayında değilse sayfa yayınlanamaz (sunucu denetler).
 */
const ContentSourceEditor = ({ field, value, onChange, error, disabled, ctx }) => {
  const { modules, site, siteId } = useSiteScope();
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search);
  const allowedModes = field.settings?.modes ?? ["collection", "singleton", "entries"];
  const mode = value?.mode ?? allowedModes[0];
  const candidates = modules.filter((item) => item.area !== "site" && (mode === "singleton" ? item.kind === "singleton" : item.kind !== "singleton"));
  const moduleOptions = candidates.map((item) => ({ value: item.key, label: labelIn(item.label, site.defaultLocale) }));
  const selectedModule = value?.module ?? null;
  const listQuery = useEntries(ctx.siteId, selectedModule, { q: query || undefined, size: 50, locale: ctx.locale }, { enabled: mode === "entries" && Boolean(selectedModule) });
  const entryOptions = (listQuery.data?.items ?? []).map((entry) => ({ value: entry.id, label: entry.title || "Adsız kayıt", meta: entry.isPublished ? null : "yayında değil" }));
  const max = field.settings?.maxItems ?? 50;
  const label = labelOf(field.label, ctx.uiLocale);

  // Tür değişince yalnız o türün alanları korunur (sunucu fazladan alanı reddeder).
  const emit = (next) => {
    if (!next.module) {
      onChange(null);
      return;
    }
    const base = { mode: next.mode, module: next.module };
    if (next.mode === "collection") onChange({ ...base, ...(next.limit ? { limit: next.limit } : {}), ...(next.sort ? { sort: next.sort } : {}) });
    else if (next.mode === "entries") onChange({ ...base, entryIds: next.entryIds ?? [] });
    else onChange(base);
  };

  return (
    <FieldGroup legend={label} required={field.required} error={error} description={field.help ? labelOf(field.help) : undefined} className="content_source_editor">
      {allowedModes.length > 1 && (
        <SegmentedControl
          ariaLabel={`${label}: kaynak türü`}
          size="sm"
          value={mode}
          disabled={disabled}
          options={allowedModes.map((item) => ({ value: item, label: MODE_TEXT[item] }))}
          onChange={(next) => emit({ mode: next, module: candidates.some((item) => item.key === selectedModule) && next !== "singleton" && mode !== "singleton" ? selectedModule : null })}
        />
      )}
      <Select
        label="Bölüm"
        isDisabled={disabled}
        options={moduleOptions}
        value={moduleOptions.find((option) => option.value === selectedModule) ?? null}
        onChange={(option) => emit({ mode, module: option?.value ?? null })}
        placeholder={moduleOptions.length ? "Bölüm seçin" : "Uygun bölüm yok"}
        noOptionsMessage={() => "Uygun bölüm yok"}
      />
      {selectedModule && (
        // Sayfa yalnız "nereden" gösterileceğini tutar; kayıtların kendisi bölümünde düzenlenir.
        <p className="content_source_editor_link">
          Bu bölümdeki kayıtlar <strong>{moduleOptions.find((option) => option.value === selectedModule)?.label ?? selectedModule}</strong> bölümünden gelir.{" "}
          <Link to={sitePath(siteId, `/icerik/${selectedModule}`)}>Kayıtları düzenle<FiArrowRight aria-hidden="true" /></Link>
        </p>
      )}
      {mode === "collection" && selectedModule && (
        <div className="content_source_editor_row">
          <Input label="Gösterilecek kayıt sayısı" type="number" inputMode="numeric" min={1} max={max} disabled={disabled} value={value?.limit ?? ""}
            hint={`Boşsa 12; en çok ${max}.`}
            onChange={(event) => emit({ ...value, mode, limit: event.target.value === "" ? undefined : Number.parseInt(event.target.value, 10) })} />
          <Select label="Sıra" isDisabled={disabled}
            options={[{ value: "position", label: "Bölümdeki sıra" }, { value: "newest", label: "En son yayınlanan önce" }]}
            value={{ position: { value: "position", label: "Bölümdeki sıra" }, newest: { value: "newest", label: "En son yayınlanan önce" } }[value?.sort ?? "position"]}
            onChange={(option) => emit({ ...value, mode, sort: option?.value === "position" ? undefined : option?.value })} />
        </div>
      )}
      {mode === "entries" && selectedModule && (
        <Select
          label="Kayıtlar"
          isMulti
          isDisabled={disabled}
          isLoading={listQuery.isFetching}
          options={entryOptions}
          filterOption={null}
          onInputChange={(text, { action }) => {
            if (action === "input-change") setSearch(text);
          }}
          value={(value?.entryIds ?? []).map((id) => entryOptions.find((option) => option.value === id) ?? { value: id, label: "Seçili kayıt" })}
          isOptionDisabled={() => (value?.entryIds ?? []).length >= max}
          formatOptionLabel={(option) => (option.meta ? `${option.label} (${option.meta})` : option.label)}
          onChange={(next) => emit({ mode, module: selectedModule, entryIds: (next ?? []).map((option) => option.value) })}
          hint="Seçim sırası sitedeki sıradır."
          placeholder="Kayıt arayın"
        />
      )}
    </FieldGroup>
  );
};

export default ContentSourceEditor;
