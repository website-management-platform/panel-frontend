import { useState } from "react";
import { Link } from "react-router";
import { FiDownload, FiTrash2 } from "react-icons/fi";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import DescriptionList from "@/components/DescriptionList";
import Drawer from "@/components/Drawer";
import Input from "@/components/Input";
import QueryErrorAlert from "@/components/QueryErrorAlert";
import Select from "@/components/Select";
import Skeleton from "@/components/Skeleton";
import Switch from "@/components/Switch";
import Textarea from "@/components/Textarea";
import { toast } from "@/components/Toast/toast";
import { getErrorMessage, getFieldErrors } from "@/api/errors";
import { formatBytes, formatDateTime } from "@/utils/format";
import { localeName, labelIn } from "../../../content/labels";
import { sitePath, useSiteScope } from "../../../sites/siteContext";
import { useArchiveAsset, useAsset, useAssetFolders, useAssetUsages, useUpdateAsset } from "../../api";
import { KIND_META, STATUS_META } from "../../labels";
import AssetThumb from "../AssetThumb";
import FocalPointPicker from "../FocalPointPicker";
import "./asset_detail_drawer.scss";

const Preview = ({ asset, focalPoint, onFocalPoint, editable }) => {
  if (asset.status !== "ready") return <AssetThumb asset={asset} size="fill" />;
  if (asset.kind === "image") return <FocalPointPicker src={asset.url} value={focalPoint} onChange={onFocalPoint} disabled={!editable} />;
  // Video ve sesin kendi kontrolleri vardır; altyazı ve transkript video alanında yönetilir.
  if (asset.kind === "video") return <video className="asset_detail_media" src={asset.url} controls preload="metadata" />;
  if (asset.kind === "audio") return <audio className="asset_detail_media" src={asset.url} controls preload="metadata" />;
  return <AssetThumb asset={asset} size="fill" />;
};

const MetadataForm = ({ asset, site, editable, onSaved }) => {
  const { siteId } = useSiteScope();
  const update = useUpdateAsset(siteId, asset.id);
  const foldersQuery = useAssetFolders(siteId);
  const [values, setValues] = useState({
    title: asset.title ?? "",
    alt: asset.alt ?? {},
    caption: asset.caption ?? {},
    decorative: asset.decorative,
    focalPoint: asset.focalPoint,
    folderId: asset.folderId,
    tags: asset.tags.join(", "),
  });
  const fieldErrors = getFieldErrors(update.error);
  const folderOptions = [{ value: null, label: "Klasörsüz" }, ...(foldersQuery.data?.items ?? []).map((folder) => ({ value: folder.id, label: folder.name }))];
  const setLocalized = (key, locale, text) => setValues((current) => ({ ...current, [key]: { ...current[key], [locale]: text } }));
  const save = () => update.mutate({
    version: asset.version,
    values: {
      title: values.title,
      alt: Object.fromEntries(Object.entries(values.alt).filter(([, text]) => text?.trim())),
      caption: Object.fromEntries(Object.entries(values.caption).filter(([, text]) => text?.trim())),
      decorative: values.decorative,
      focalPoint: values.focalPoint,
      folderId: values.folderId,
      tags: values.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    },
  }, { onSuccess: () => { toast.success("Dosya bilgileri kaydedildi"); onSaved?.(); } });

  return (
    <div className="asset_detail_form">
      <Preview asset={asset} focalPoint={values.focalPoint} onFocalPoint={(focalPoint) => setValues((current) => ({ ...current, focalPoint }))} editable={editable} />
      {update.isError && Object.keys(fieldErrors).length === 0 && <Alert variant="danger" size="compact">{getErrorMessage(update.error)}</Alert>}
      <fieldset className="asset_detail_fields" disabled={!editable}>
        <Input label="Başlık" value={values.title} maxLength={200} onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))} error={fieldErrors.title} />
        {asset.kind === "image" && (
          <>
            <Switch label="Dekoratif görsel" description="Yalnız süs amaçlıysa açın; ekran okuyucular atlar ve alternatif metin gerekmez." checked={values.decorative} onChange={(event) => setValues((current) => ({ ...current, decorative: event.target.checked }))} />
            {!values.decorative && site.locales.map((locale) => (
              <Input key={locale} label={`Alternatif metin (${localeName(locale)})`} dir={["ar", "he", "fa", "ur"].includes(locale) ? "rtl" : undefined}
                hint={locale === site.defaultLocale ? "Görseli göremeyenler için kısa açıklama. Kayıtta ayrıca değiştirilebilir." : undefined}
                value={values.alt[locale] ?? ""} maxLength={300} onChange={(event) => setLocalized("alt", locale, event.target.value)} error={fieldErrors.alt} />
            ))}
          </>
        )}
        {site.locales.map((locale) => (
          <Textarea key={locale} label={`Açıklama (${localeName(locale)})`} optionalText="İsteğe bağlı" rows={2} dir={["ar", "he", "fa", "ur"].includes(locale) ? "rtl" : undefined}
            value={values.caption[locale] ?? ""} maxLength={500} onChange={(event) => setLocalized("caption", locale, event.target.value)} error={fieldErrors.caption} />
        ))}
        <Select label="Klasör" options={folderOptions} value={folderOptions.find((option) => option.value === values.folderId) ?? folderOptions[0]} onChange={(option) => setValues((current) => ({ ...current, folderId: option?.value ?? null }))} />
        <Input label="Etiketler" optionalText="Virgülle ayırın" value={values.tags} onChange={(event) => setValues((current) => ({ ...current, tags: event.target.value }))} error={fieldErrors.tags} />
      </fieldset>
      {editable && <Button onClick={save} loading={update.isPending} className="asset_detail_save">Kaydet</Button>}
      <p className="asset_detail_note">Değişiklikler yayındaki kayıtları kendiliğinden değiştirmez; kayıt yeniden yayınlanınca geçerli olur.</p>
    </div>
  );
};

/** Dosya ayrıntısı: önizleme, üst bilgi, kullanım yerleri, indirme ve silme (şartname §8). */
const AssetDetailDrawer = ({ assetId, onClose }) => {
  const { siteId, site, can } = useSiteScope();
  const assetQuery = useAsset(siteId, assetId);
  const usagesQuery = useAssetUsages(siteId, assetId);
  const archive = useArchiveAsset(siteId);
  const asset = assetQuery.data;
  const usages = usagesQuery.data?.items ?? [];
  const editable = can("asset.upload") && asset && !["rejected", "archived"].includes(asset.status);

  return (
    <Drawer
      open
      onClose={onClose}
      title={asset ? asset.title || asset.fileName : "Dosya"}
      description={asset ? asset.fileName : undefined}
      size="md"
      footer={asset && (
        <>
          {asset.status === "ready" && <Button as="a" href={`${asset.url}?download=1`} variant="outline" icon={FiDownload} download>İndir</Button>}
          {can("asset.delete") && asset.status !== "archived" && (
            <Button variant="outline" color="danger" icon={FiTrash2} loading={archive.isPending} disabled={usages.length > 0}
              onClick={() => archive.mutate({ assetId: asset.id, version: asset.version }, { onSuccess: () => { toast.success("Dosya silindi"); onClose(); } })}>
              Sil
            </Button>
          )}
        </>
      )}
    >
      {assetQuery.isPending && <Skeleton variant="rectangle" height={320} />}
      {assetQuery.isError && <QueryErrorAlert error={assetQuery.error} onRetry={() => assetQuery.refetch()} />}
      {asset && (
        <div className="asset_detail">
          {asset.status === "rejected" && <Alert variant="danger" title="Dosya reddedildi">{asset.rejectReason?.message}</Alert>}
          {asset.status === "processing" && <Alert variant="info" size="compact">Dosya işleniyor; boyutlar ve önizleme hazırlanıyor. Bu ekran kendiliğinden yenilenir.</Alert>}
          {archive.isError && <Alert variant="danger" size="compact">{getErrorMessage(archive.error)}</Alert>}
          <DescriptionList
            layout="grid"
            columns={2}
            items={[
              { label: "Durum", value: <Badge size="sm" variant={STATUS_META[asset.status].variant}>{STATUS_META[asset.status].label}</Badge> },
              { label: "Tür", value: `${KIND_META[asset.kind]?.label} · ${asset.format?.toUpperCase()}` },
              { label: "Boyut", value: formatBytes(asset.size) },
              { label: "Ölçü", value: asset.width ? `${asset.width} × ${asset.height} px` : "—" },
              { label: "Yükleme", value: formatDateTime(asset.createdAt) },
              { label: "Yükleyen", value: asset.createdBy?.displayName ?? "—" },
            ]}
          />
          {!["rejected", "archived"].includes(asset.status) && <MetadataForm key={asset.version} asset={asset} site={site} editable={editable} onSaved={() => usagesQuery.refetch()} />}
          <section aria-labelledby="asset-usages" className="asset_detail_usages">
            <h3 id="asset-usages">Kullanıldığı yerler</h3>
            {usagesQuery.isPending ? <Skeleton variant="rectangle" height={60} /> : usages.length === 0 ? (
              <p className="asset_detail_note">Hiçbir kayıtta kullanılmıyor.</p>
            ) : (
              <>
                <ul>
                  {usages.map((usage) => (
                    <li key={usage.entryId}>
                      <Link to={sitePath(siteId, `/icerik/${usage.module.key}/${usage.entryId}`)}>{labelIn(usage.module.label, site.defaultLocale)} kaydı</Link>
                      {usage.published && <Badge size="sm" variant="success">Yayında</Badge>}
                    </li>
                  ))}
                </ul>
                <p className="asset_detail_note">Kullanılan dosya silinemez; önce kayıtlardan kaldırın.</p>
              </>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
};

export default AssetDetailDrawer;
