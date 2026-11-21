import { useState } from "react";
import { FiSearch } from "react-icons/fi";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import FileDropzone from "@/components/FileDropzone";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import QueryErrorAlert from "@/components/QueryErrorAlert";
import Select from "@/components/Select";
import Skeleton from "@/components/Skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSiteScope } from "../../../sites/siteContext";
import { useAssetFolders, useAssets } from "../../api";
import { useUploadQueue } from "../../hooks/useUploadQueue";
import { ACCEPT, KIND_META } from "../../labels";
import AssetGrid from "../AssetGrid";
import UploadQueue from "../UploadQueue";
import "./asset_picker.scss";

const PAGE_SIZE = 24;

/**
 * Alan için medya seçici: kütüphaneden seçim ve yerinde yükleme. kinds/formats alanın kabul ettikleridir;
 * uymayan dosya gerekçesiyle seçilemez. multiple ise en çok max dosya seçilir. Seçim onSelect(assets) ile döner.
 */
const AssetPicker = ({ title = "Medya seç", kinds, formats, multiple = false, max = Infinity, onClose, onSelect }) => {
  const { siteId, can } = useSiteScope();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState(kinds?.length === 1 ? kinds[0] : "");
  const [folderId, setFolderId] = useState(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const query = useDebouncedValue(search);
  const foldersQuery = useAssetFolders(siteId);
  const assetsQuery = useAssets(siteId, { q: query || undefined, kind: kind || undefined, folderId: folderId ?? undefined, page, size: PAGE_SIZE });
  const queue = useUploadQueue(siteId, {
    folderId,
    onUploaded: (asset) => setSelected((current) => (multiple ? (current.length < max ? [...current, asset] : current) : [asset])),
  });
  const kindOptions = [{ value: "", label: "Bütün türler" }, ...(kinds ?? Object.keys(KIND_META)).map((item) => ({ value: item, label: KIND_META[item]?.label ?? item }))];
  const folderOptions = [{ value: null, label: "Bütün klasörler" }, { value: "root", label: "Klasörsüz" }, ...(foldersQuery.data?.items ?? []).map((folder) => ({ value: folder.id, label: folder.name }))];

  const disabledReason = (asset) => {
    if (asset.status === "rejected") return "Reddedilmiş dosya";
    if (kinds && !kinds.includes(asset.kind)) return "Bu alana uygun tür değil";
    if (formats && !formats.includes(asset.format)) return `${asset.format?.toUpperCase()} bu alanda kabul edilmiyor`;
    return null;
  };
  const toggle = (asset) => setSelected((current) => {
    if (current.some((item) => item.id === asset.id)) return current.filter((item) => item.id !== asset.id);
    if (!multiple) return [asset];
    return current.length < max ? [...current, asset] : current;
  });

  const items = assetsQuery.data?.items ?? [];
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size="xl"
      footerStart={<span className="asset_picker_count">{selected.length > 0 ? `${selected.length} dosya seçildi` : multiple ? `En çok ${max === Infinity ? "sınırsız" : max} dosya` : "Bir dosya seçin"}</span>}
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button disabled={selected.length === 0 || queue.busy} onClick={() => onSelect(selected)}>Seç</Button>
        </>
      )}
    >
      <div className="asset_picker">
        {can("asset.upload") && (
          <>
            <FileDropzone accept={ACCEPT} multiple={multiple} size="sm" title="Yeni dosya yüklemek için sürükleyin" description="Yüklenen dosya kütüphaneye eklenir ve seçilir." onFiles={(files) => queue.add(files)} />
            <UploadQueue items={queue.items} onRetry={queue.retry} onClear={queue.clearFinished} />
          </>
        )}
        <div className="asset_picker_toolbar">
          <Input aria-label="Dosya ara" type="search" size="sm" icon={FiSearch} placeholder="Dosya adı, alternatif metin veya etiket" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="asset_picker_search" />
          {kindOptions.length > 2 && <Select aria-label="Tür" size="sm" options={kindOptions} value={kindOptions.find((option) => option.value === kind)} onChange={(option) => { setKind(option?.value ?? ""); setPage(1); }} className="asset_picker_filter" />}
          <Select aria-label="Klasör" size="sm" options={folderOptions} value={folderOptions.find((option) => option.value === folderId) ?? folderOptions[0]} onChange={(option) => { setFolderId(option?.value ?? null); setPage(1); }} className="asset_picker_filter" />
        </div>
        {assetsQuery.isPending && <Skeleton variant="rectangle" height={240} />}
        {assetsQuery.isError && <QueryErrorAlert error={assetsQuery.error} onRetry={() => assetsQuery.refetch()} />}
        {assetsQuery.data && items.length === 0 && <EmptyState variant="bordered" size="sm" title="Dosya bulunamadı" description="Arama veya süzgeçleri değiştirin ya da yeni dosya yükleyin." />}
        {items.length > 0 && <AssetGrid assets={items} selectable selectedIds={selected.map((item) => item.id)} onToggle={toggle} isDisabled={disabledReason} />}
        {assetsQuery.data && (assetsQuery.data.hasNext || page > 1) && (
          <Pagination page={page} pageCount={Math.max(1, Math.ceil((assetsQuery.data.total ?? 0) / PAGE_SIZE))} onChange={setPage} />
        )}
      </div>
    </Modal>
  );
};

export default AssetPicker;
