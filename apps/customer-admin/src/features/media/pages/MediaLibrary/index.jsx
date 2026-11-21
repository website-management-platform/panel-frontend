import { useState } from "react";
import { useSearchParams } from "react-router";
import { FiCheckSquare, FiFolderPlus, FiImage, FiSearch, FiTrash2, FiUpload } from "react-icons/fi";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import FileDropzone from "@/components/FileDropzone";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import Progress from "@/components/Progress";
import QueryErrorAlert from "@/components/QueryErrorAlert";
import SegmentedControl from "@/components/SegmentedControl";
import Select from "@/components/Select";
import Skeleton from "@/components/Skeleton";
import { toast } from "@/components/Toast/toast";
import { getErrorMessage, getFieldErrors } from "@/api/errors";
import { useConfirm } from "@/hooks/useConfirm";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useUrlSyncedValue } from "@/hooks/useSearchParamsState";
import { useUrlListFilters } from "@/hooks/useUrlListFilters";
import { formatBytes } from "@/utils/format";
import { useSiteScope } from "../../../sites/siteContext";
import { useAssetFolders, useAssets, useBulkAssets, useCreateFolder, useDeleteFolder } from "../../api";
import AssetDetailDrawer from "../../components/AssetDetailDrawer";
import AssetGrid from "../../components/AssetGrid";
import UploadQueue from "../../components/UploadQueue";
import { useUploadQueue } from "../../hooks/useUploadQueue";
import { ACCEPT, KIND_FILTERS } from "../../labels";
import "./media_library.scss";

const PAGE_SIZE = 40;
const FILTER_DEFAULTS = { ara: "", tur: "", klasor: "", durum: "", sayfa: 1 };
const STATUS_FILTERS = [{ value: "", label: "Kullanılabilir" }, { value: "processing", label: "İşleniyor" }, { value: "rejected", label: "Reddedilen" }];

const NewFolderModal = ({ onClose }) => {
  const { siteId } = useSiteScope();
  const create = useCreateFolder(siteId);
  const [name, setName] = useState("");
  return (
    <Modal open onClose={onClose} title="Yeni klasör" size="sm" busy={create.isPending}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button type="submit" form="new-folder-form" loading={create.isPending}>Oluştur</Button></>}>
      <form id="new-folder-form" onSubmit={(event) => { event.preventDefault(); create.mutate({ name }, { onSuccess: () => { toast.success("Klasör oluşturuldu"); onClose(); } }); }}>
        <Input label="Klasör adı" required autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} error={getFieldErrors(create.error).name ?? (create.isError && !getFieldErrors(create.error).name ? getErrorMessage(create.error) : undefined)} />
      </form>
    </Modal>
  );
};

/** Medya kütüphanesi (şartname §8): klasör, arama, tür süzgeci, yükleme, toplu taşıma ve silme, ayrıntı. Site kapsamlıdır. */
const MediaLibrary = () => {
  usePageTitle("Medya");
  const confirm = useConfirm();
  const { siteId, can } = useSiteScope();
  const { filters, search, setSearch, setFilter, page, setPage, clear, filtered } = useUrlListFilters(FILTER_DEFAULTS);
  // ?dosya=<id>: aramadan gelen bağlantı dosya ayrıntısını açar.
  const [searchParams] = useSearchParams();
  const [openId, setOpenId] = useUrlSyncedValue(searchParams.get("dosya"));
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [folderModal, setFolderModal] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const foldersQuery = useAssetFolders(siteId);
  const query = useAssets(siteId, { q: filters.ara || undefined, kind: filters.tur || undefined, folderId: filters.klasor || undefined, status: filters.durum || undefined, page, size: PAGE_SIZE });
  const queue = useUploadQueue(siteId, { folderId: filters.klasor && filters.klasor !== "root" ? filters.klasor : null });
  const bulk = useBulkAssets(siteId);
  const deleteFolder = useDeleteFolder(siteId);
  const folders = foldersQuery.data?.items ?? [];
  const folderOptions = [{ value: "", label: "Bütün dosyalar" }, { value: "root", label: "Klasörsüz" }, ...folders.map((folder) => ({ value: folder.id, label: `${folder.name} (${folder.assetCount})` }))];
  const currentFolder = folders.find((folder) => folder.id === filters.klasor);
  const usage = query.data?.usage;
  const items = query.data?.items ?? [];

  const runBulk = (action, folderId) => bulk.mutate({ action, ids: selected, folderId }, {
    onSuccess: ({ results }) => {
      const ok = results.filter((item) => item.ok).length;
      const failed = results.filter((item) => !item.ok);
      if (ok) toast.success(action === "move" ? `${ok} dosya taşındı` : `${ok} dosya silindi`);
      if (failed.length) toast.error(`${failed.length} dosya işlenemedi${failed[0].code === "ASSET_IN_USE" ? " (kayıtlarda kullanılıyor)" : ""}.`);
      setSelected([]);
    },
  });

  const removeFolder = async () => {
    const ok = await confirm({ variant: "destructive", title: `${currentFolder.name} klasörü silinsin mi?`, description: "Yalnız boş klasör silinebilir. Dosyalar silinmez.", confirmLabel: "Klasörü sil", onConfirm: () => deleteFolder.mutateAsync({ folderId: currentFolder.id, version: currentFolder.version }) });
    if (ok) {
      toast.success("Klasör silindi");
      setFilter("klasor", "");
    }
  };

  return (
    <div className="media_library">
      <PageHeader
        title="Medya"
        description="Sitenizin görselleri, videoları ve belgeleri. Klasör değişikliği dosyanın kullanıldığı yerleri bozmaz."
        actions={can("asset.upload") && (
          <>
            <Button variant="outline" icon={FiFolderPlus} onClick={() => setFolderModal(true)}>Yeni klasör</Button>
            <Button icon={FiUpload} onClick={() => setShowUpload((value) => !value)} aria-expanded={showUpload}>Dosya yükle</Button>
          </>
        )}
      />
      {usage && (
        <div className="media_library_usage">
          <Progress value={Math.min(100, Math.round((usage.bytes / usage.quotaBytes) * 100))} size="sm" ariaLabel="Depolama kullanımı" />
          <span>{formatBytes(usage.bytes)} / {formatBytes(usage.quotaBytes)} kullanılıyor</span>
        </div>
      )}
      {showUpload && can("asset.upload") && (
        <FileDropzone accept={ACCEPT} multiple title="Dosyaları buraya sürükleyin" description="JPEG, PNG, WebP görsel (15 MB); MP4, MOV, WebM video; MP3, WAV, M4A ses; PDF, Word, Excel, PowerPoint belge. SVG, GIF ve ZIP kabul edilmez." onFiles={(files) => queue.add(files)} />
      )}
      <UploadQueue items={queue.items} onRetry={queue.retry} onClear={queue.clearFinished} />

      <div className="media_library_toolbar">
        <Input aria-label="Dosya ara" type="search" icon={FiSearch} placeholder="Dosya adı, alternatif metin veya etiket" value={search} onChange={(event) => setSearch(event.target.value)} className="media_library_search" />
        <Select aria-label="Klasör" options={folderOptions} value={folderOptions.find((option) => option.value === filters.klasor) ?? folderOptions[0]} onChange={(option) => setFilter("klasor", option?.value ?? "")} className="media_library_filter" />
        <SegmentedControl size="sm" ariaLabel="Türe göre süz" options={KIND_FILTERS} value={filters.tur} onChange={(value) => setFilter("tur", value)} />
        <SegmentedControl size="sm" ariaLabel="Duruma göre süz" options={STATUS_FILTERS} value={filters.durum} onChange={(value) => setFilter("durum", value)} />
        {currentFolder && can("asset.delete") && <Button variant="ghost" size="sm" color="danger" icon={FiTrash2} onClick={removeFolder}>Klasörü sil</Button>}
        {(can("asset.upload") || can("asset.delete")) && (
          <Button variant={selecting ? "soft" : "ghost"} size="sm" icon={FiCheckSquare} aria-pressed={selecting} onClick={() => { setSelecting((value) => !value); setSelected([]); }}>Seç</Button>
        )}
      </div>

      {selecting && selected.length > 0 && (
        <div className="media_library_bulk" role="region" aria-label="Seçili dosyalar">
          <span>{selected.length} dosya seçildi</span>
          {can("asset.upload") && (
            <Select aria-label="Seçilenleri taşı" size="sm" placeholder="Klasöre taşı" className="media_library_filter"
              options={[{ value: null, label: "Klasörsüz" }, ...folders.map((folder) => ({ value: folder.id, label: folder.name }))]}
              value={null} onChange={(option) => option && runBulk("move", option.value)} />
          )}
          {can("asset.delete") && <Button size="sm" variant="outline" color="danger" icon={FiTrash2} loading={bulk.isPending} onClick={() => runBulk("archive")}>Sil</Button>}
        </div>
      )}

      {query.isPending && <Skeleton variant="rectangle" height={320} radius="lg" />}
      {query.isError && <QueryErrorAlert error={query.error} onRetry={() => query.refetch()} />}
      {query.data && items.length === 0 && (filtered
        ? <EmptyState variant="bordered" icon={FiSearch} title="Sonuç bulunamadı" description="Arama veya süzgeçlerle eşleşen dosya yok." action={<Button variant="outline" onClick={clear}>Süzgeçleri temizle</Button>} />
        : <EmptyState variant="bordered" icon={FiImage} title="Henüz dosya yok" description="Görsel, video veya belge yükleyerek başlayın." action={can("asset.upload") && <Button icon={FiUpload} onClick={() => setShowUpload(true)}>Dosya yükle</Button>} />)}
      {items.length > 0 && (
        <AssetGrid assets={items} selectable={selecting} selectedIds={selected}
          onToggle={(asset) => setSelected((current) => (current.includes(asset.id) ? current.filter((id) => id !== asset.id) : [...current, asset.id]))}
          onOpen={(asset) => setOpenId(asset.id)} />
      )}
      {query.data && (query.data.hasNext || page > 1) && <Pagination page={page} pageCount={Math.max(1, Math.ceil((query.data.total ?? 0) / PAGE_SIZE))} onChange={setPage} />}

      {openId && <AssetDetailDrawer assetId={openId} onClose={() => setOpenId(null)} />}
      {folderModal && <NewFolderModal onClose={() => setFolderModal(false)} />}
    </div>
  );
};

export default MediaLibrary;
