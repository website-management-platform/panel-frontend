import { useState } from "react";
import { FiArrowDown, FiArrowUp, FiImage, FiPlus, FiTrash2 } from "react-icons/fi";
import { labelOf } from "@wmp/schema";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { useAsset } from "../../../media/api";
import AssetPicker from "../../../media/components/AssetPicker";
import AssetThumb from "../../../media/components/AssetThumb";
import { STATUS_META } from "../../../media/labels";
import { useSiteScope } from "../../../sites/siteContext";
import "./media_field.scss";

// Alan türüne göre kabul edilen medya türleri; sunucu aynı kuralı uygular (06-content.md, 07-media.md).
const FIELD_KINDS = { image: ["image"], imageGallery: ["image"], video: ["video"], videoGallery: ["video"], audio: ["audio"], document: ["document"], file: ["document"] };

const newRowId = () => globalThis.crypto.randomUUID();

const MediaItem = ({ field, item, index, count, disabled, rtl, onChange, onMove, onRemove }) => {
  const { siteId } = useSiteScope();
  const assetQuery = useAsset(siteId, item.assetId);
  const asset = assetQuery.data;
  const missing = assetQuery.isError;
  const name = asset?.title || asset?.fileName || (missing ? "Dosya bulunamadı" : "Yükleniyor…");
  const needsAlt = asset?.kind === "image" && !asset.decorative;
  const status = asset && asset.status !== "ready" ? STATUS_META[asset.status] : null;
  return (
    <li className="media_field_item">
      <AssetThumb asset={asset} size="md" />
      <div className="media_field_body">
        <div className="media_field_head">
          <span className="media_field_name">{name}</span>
          {status && <Badge size="sm" variant={status.variant}>{status.label}</Badge>}
          {missing && <Badge size="sm" variant="danger">Kaldırılmış</Badge>}
        </div>
        {needsAlt && (
          <Input size="sm" label="Alternatif metin" dir={rtl ? "rtl" : undefined} disabled={disabled} maxLength={300}
            placeholder={asset.alt ? Object.values(asset.alt)[0] : "Görseli kısaca anlatın"}
            hint={field.settings?.altRequiredOnPublish ? "Yayın için gerekli. Boş bırakılırsa kütüphanedeki metin kullanılır." : undefined}
            value={item.alt ?? ""} onChange={(event) => onChange({ ...item, alt: event.target.value || undefined })} />
        )}
        {field.settings?.captionEnabled !== false && asset?.kind !== "document" && (
          <Input size="sm" label="Açıklama" optionalText="İsteğe bağlı" dir={rtl ? "rtl" : undefined} disabled={disabled} maxLength={500}
            value={item.caption ?? ""} onChange={(event) => onChange({ ...item, caption: event.target.value || undefined })} />
        )}
      </div>
      {!disabled && (
        <div className="media_field_actions">
          {count > 1 && <Button variant="ghost" size="sm" icon={FiArrowUp} ariaLabel={`${name}: yukarı taşı`} disabled={index === 0} onClick={() => onMove(-1)} />}
          {count > 1 && <Button variant="ghost" size="sm" icon={FiArrowDown} ariaLabel={`${name}: aşağı taşı`} disabled={index === count - 1} onClick={() => onMove(1)} />}
          <Button variant="ghost" size="sm" color="danger" icon={FiTrash2} ariaLabel={`${name}: kaldır`} onClick={onRemove} />
        </div>
      )}
    </li>
  );
};

/**
 * Medya alanı: kütüphaneden seçilen dosyalara referans. Referans; dosya kimliği, kayda özgü alternatif metin ve açıklama
 * taşır (şartname §25.6: alt/caption referans bazında). Galeride sıralama klavyeyle erişilebilir düğmelerle yapılır.
 */
const MediaField = ({ field, label, value, onChange, error, disabled, ctx }) => {
  const [picking, setPicking] = useState(false);
  const multiple = Array.isArray(value) || ["imageGallery", "videoGallery", "mediaGallery"].includes(field.type);
  const items = multiple ? value ?? [] : value ? [value] : [];
  const max = multiple ? field.settings?.maxItems ?? 50 : 1;
  const kinds = field.type === "mediaGallery" ? field.settings?.allowedKinds ?? ["image", "video"] : FIELD_KINDS[field.type];
  const formats = field.settings?.allowedFormats;
  const rtl = ["ar", "he", "fa", "ur"].includes(ctx.locale);
  const emit = (next) => onChange(multiple ? (next.length ? next : null) : next[0] ?? null);
  const update = (index, next) => emit(items.map((item, position) => (position === index ? next : item)));

  return (
    <fieldset className="media_field" aria-describedby={error ? `${field.id}-media-error` : undefined}>
      <legend className="field_editor_label">
        {label}{field.required && <span className="field_editor_required" aria-hidden="true">*</span>}
        {multiple && <span className="media_field_count">{items.length}{field.settings?.maxItems ? ` / ${field.settings.maxItems}` : ""}</span>}
      </legend>
      {field.help?.tr && <p className="field_editor_hint">{labelOf(field.help)}</p>}
      {items.length > 0 && (
        <ol className="media_field_list">
          {items.map((item, index) => (
            <MediaItem key={item.id ?? item.assetId} field={field} item={item} index={index} count={items.length} disabled={disabled} rtl={rtl}
              onChange={(next) => update(index, next)}
              onMove={(direction) => {
                const next = [...items];
                [next[index], next[index + direction]] = [next[index + direction], next[index]];
                emit(next);
              }}
              onRemove={() => emit(items.filter((_, position) => position !== index))} />
          ))}
        </ol>
      )}
      {!disabled && items.length < max && (
        <Button variant="outline" size="sm" icon={items.length ? FiPlus : FiImage} onClick={() => setPicking(true)}>
          {multiple ? "Medya ekle" : "Medya seç"}
        </Button>
      )}
      {!disabled && !multiple && items.length === 1 && <Button variant="link" size="sm" onClick={() => setPicking(true)}>Değiştir</Button>}
      {error && <p className="field_editor_error" id={`${field.id}-media-error`} role="alert">{error}</p>}
      {picking && (
        <AssetPicker
          title={`${label}: medya seç`}
          kinds={kinds}
          formats={formats}
          multiple={multiple}
          max={multiple ? max - items.length : 1}
          onClose={() => setPicking(false)}
          onSelect={(assets) => {
            const refs = assets.map((asset) => (multiple ? { id: newRowId(), assetId: asset.id } : { assetId: asset.id }));
            emit(multiple ? [...items, ...refs] : refs);
            setPicking(false);
          }}
        />
      )}
    </fieldset>
  );
};

export default MediaField;
