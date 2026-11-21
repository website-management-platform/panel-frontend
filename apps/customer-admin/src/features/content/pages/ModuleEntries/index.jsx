import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { FiArrowDown, FiArrowLeft, FiArrowRight, FiArrowUp, FiFileText, FiPlus, FiRotateCcw, FiSearch, FiTrash2, FiUploadCloud, FiXCircle } from "react-icons/fi";
import { getFieldType, labelOf } from "@wmp/schema";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Checkbox from "@/components/Checkbox";
import EmptyState from "@/components/EmptyState";
import Input from "@/components/Input";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import QueryErrorAlert from "@/components/QueryErrorAlert";
import Select from "@/components/Select";
import Skeleton from "@/components/Skeleton";
import Table from "@/components/Table";
import { toast } from "@/components/Toast/toast";
import { getErrorMessage, isApiError } from "@/api/errors";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useUrlListFilters } from "@/hooks/useUrlListFilters";
import NotFound from "@/pages/NotFound";
import { formatDate } from "@/utils/format";
import { sitePath, useSiteScope } from "../../../sites/siteContext";
import { useBulkEntries, useEntries, useEntryAction, useModuleSchema, useReorderEntries } from "../../api";
import { displayValue } from "../../format";
import { entryBadges, labelIn } from "../../labels";
import EntryEditor from "../EntryEditor";
import "./module_entries.scss";

const FILTER_DEFAULTS = { ara: "", durum: "", sirala: "", cop: "", sayfa: 1 };
// Durum süzgeci: yayın durumu.
const STATUS_OPTIONS = [
  { value: "PUBLISHED", label: "Yayında" },
  { value: "DRAFT", label: "Hiç yayınlanmamış" },
  { value: "UNPUBLISHED_CHANGES", label: "Yayınlanmamış değişikliği olan" },
];
const BULK_LABELS = { publish: "yayınlandı", unpublish: "yayından kaldırıldı", trash: "çöp kutusuna taşındı", restore: "geri alındı" };

const StatusBadge = ({ entry }) => (
  <span className="module_entries_status">
    {entryBadges(entry).map((badge) => <Badge key={badge.key} size="sm" variant={badge.variant} dot={badge.dot !== false}>{badge.label}</Badge>)}
  </span>
);

// Tek kayıtlı bölüm: kayıt varsa düzenleme, yoksa oluşturma formu doğrudan açılır (şartname §5.1).
const SingletonModule = ({ siteId, moduleKey }) => {
  const query = useEntries(siteId, moduleKey, { size: 1 });
  if (query.isPending) return <Skeleton variant="rectangle" height={420} radius="lg" />;
  if (query.isError) return <QueryErrorAlert error={query.error} onRetry={() => query.refetch()} />;
  return <EntryEditor key={query.data.items[0]?.id ?? "new"} singletonEntryId={query.data.items[0]?.id ?? null} />;
};

// Ağaç: kayıtlar üst kayda göre iç içe gösterilir; taşıma klavyeyle erişilebilir düğmelerle yapılır (şartname §5.1).
const TreeView = ({ items, entryPath, canMove, onMove }) => {
  const childrenOf = (parentId) => items.filter((item) => (item.parentId ?? null) === parentId).sort((a, b) => a.position - b.position);
  const render = (parentId, depth) => {
    const siblings = childrenOf(parentId);
    if (siblings.length === 0) return null;
    return (
      <ul className={depth === 0 ? "module_entries_tree" : "module_entries_tree_children"} role={depth === 0 ? "tree" : "group"} aria-label={depth === 0 ? "Kayıt ağacı" : undefined}>
        {siblings.map((item, index) => {
          const parent = items.find((candidate) => candidate.id === item.parentId);
          return (
            <li key={item.id} role="treeitem" aria-level={depth + 1} aria-expanded={childrenOf(item.id).length > 0 ? true : undefined}>
              <div className="module_entries_tree_row">
                <Link to={entryPath(item.id)} className="module_entries_title">{item.title || "Adsız kayıt"}</Link>
                <StatusBadge entry={item} />
                {canMove && (
                  <span className="module_entries_tree_actions">
                    <Button variant="ghost" size="sm" icon={FiArrowUp} ariaLabel={`${item.title}: yukarı`} disabled={index === 0} onClick={() => onMove(item, parentId, index >= 2 ? siblings[index - 2].id : null)} />
                    <Button variant="ghost" size="sm" icon={FiArrowDown} ariaLabel={`${item.title}: aşağı`} disabled={index === siblings.length - 1} onClick={() => onMove(item, parentId, siblings[index + 1].id)} />
                    <Button variant="ghost" size="sm" icon={FiArrowRight} ariaLabel={`${item.title}: bir üstteki kaydın altına al`} disabled={index === 0} onClick={() => onMove(item, siblings[index - 1].id, childrenOf(siblings[index - 1].id).at(-1)?.id ?? null)} />
                    <Button variant="ghost" size="sm" icon={FiArrowLeft} ariaLabel={`${item.title}: bir düzey yukarı çıkar`} disabled={!parent} onClick={() => onMove(item, parent?.parentId ?? null, parent?.id ?? null)} />
                  </span>
                )}
              </div>
              {render(item.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };
  return render(null, 0);
};

/**
 * Bölümün kayıt listesi (şartname §5.1, §12): görünüm (tablo, kart, kompakt, galeri, ağaç), kolonlar ve varsayılan
 * sıralama şemadan gelir. Arama, durum ve izinli alan süzgeçleri adreste saklanır.
 */
const EntryList = ({ schema, siteId, moduleKey }) => {
  const { site, can } = useSiteScope();
  // Süzgeç anahtarları şemadan gelir; adres parametresi f_<alan> biçimindedir.
  const filterDefaults = useMemo(() => ({ ...FILTER_DEFAULTS, ...Object.fromEntries(schema.fields.filter((field) => field.filterable).map((field) => [`f_${field.key}`, ""])) }), [schema]);
  const { filters, search, setSearch, setFilter, page, setPage, clear, filtered } = useUrlListFilters(filterDefaults);
  const [selected, setSelected] = useState([]);
  const pageSize = schema.ui.list.pageSize ?? 20;
  const trashView = filters.cop === "1";
  const tree = schema.kind === "tree" && !trashView;
  const filterableFields = schema.fields.filter((field) => field.filterable && ["optionId", "optionIds", "boolean"].includes(getFieldType(field.type)?.valueKind)).slice(0, 3);
  const params = {
    q: filters.ara || undefined,
    status: filters.durum || undefined,
    sort: filters.sirala || undefined,
    trashed: trashView ? "true" : undefined,
    page: tree ? undefined : page,
    size: tree ? undefined : pageSize,
    ...Object.fromEntries(filterableFields.filter((field) => filters[`f_${field.key}`]).map((field) => [`filter.${field.key}`, filters[`f_${field.key}`]])),
  };
  const query = useEntries(siteId, moduleKey, params);
  const bulk = useBulkEntries(siteId, moduleKey);
  const reorder = useReorderEntries(siteId, moduleKey);
  const move = useEntryAction(siteId, moduleKey);
  const entryPath = (id) => sitePath(siteId, `/icerik/${moduleKey}/${id}`);
  const byId = new Map(schema.fields.map((field) => [field.id, field]));
  // Alt başlık zaten başlığın altında görünür; aynı alan ayrıca kolon olarak tekrarlanmaz.
  const columns = (schema.ui.list.columns ?? []).filter((id) => id !== schema.ui.list.subtitleField).map((id) => byId.get(id)).filter((field) => field && !field.archived);
  const items = query.data?.items ?? [];
  const sortedByPosition = !filters.sirala && (schema.ui.list.sort?.[0]?.field ?? "position") === "position";
  const canReorder = schema.behavior.allowReorder && can("entry.update") && sortedByPosition && !filtered && !trashView && query.data && !query.data.hasNext && page === 1;
  const sortOptions = [
    { value: "", label: "Varsayılan sıra" },
    { value: "updatedAt:desc", label: "Son güncellenen" },
    ...schema.fields.filter((field) => field.sortable && !field.archived).flatMap((field) => [
      { value: `${field.key}:asc`, label: `${labelOf(field.label)} (artan)` },
      { value: `${field.key}:desc`, label: `${labelOf(field.label)} (azalan)` },
    ]),
  ];
  const bulkActions = trashView
    ? [can("entry.restore") && { key: "restore", label: "Geri al", icon: FiRotateCcw }]
    : [
      can("entry.publish") && { key: "publish", label: "Yayınla", icon: FiUploadCloud },
      can("entry.publish") && { key: "unpublish", label: "Yayından kaldır", icon: FiXCircle },
      can("entry.delete") && { key: "trash", label: "Çöp kutusuna taşı", icon: FiTrash2, color: "danger" },
    ];
  const availableBulk = bulkActions.filter(Boolean);
  const selectable = availableBulk.length > 0 && !tree;
  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));

  const runBulk = (actionKey) => bulk.mutate({ action: actionKey, ids: selected }, {
    onSuccess: ({ results }) => {
      const ok = results.filter((item) => item.ok).length;
      const failed = results.length - ok;
      if (ok) toast.success(`${ok} kayıt ${BULK_LABELS[actionKey]}`);
      if (failed) toast.error(`${failed} kayıtta işlem yapılamadı (ör. zorunlu alan eksik veya başka kayıt bağlı).`);
      setSelected([]);
    },
  });

  const moveRow = (index, direction) => {
    const ids = items.map((item) => item.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    reorder.mutate({ orderedIds: ids, listVersion: query.data.listVersion }, {
      onError: (error) => toast.error(isApiError(error, "LIST_VERSION_MISMATCH") ? "Liste başka bir yerde değişti; güncel sıra yüklendi." : getErrorMessage(error)),
    });
  };

  const moveTree = (item, parentId, afterId) => move.mutate({ entryId: item.id, action: "move", body: { parentId, afterId }, version: item.version }, {
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const selectBox = (item) => selectable && (
    <Checkbox label={`${item.title || "Adsız kayıt"} kaydını seç`} className="module_entries_select" checked={selected.includes(item.id)}
      onChange={(event) => setSelected((current) => (event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)))} />
  );

  const view = schema.ui.list.view;
  let content;
  if (query.isPending) content = <Skeleton variant="rectangle" height={240} radius="lg" />;
  else if (query.isError) content = <QueryErrorAlert error={query.error} onRetry={() => query.refetch()} />;
  else if (items.length === 0) {
    content = filtered || trashView
      ? <EmptyState variant="bordered" icon={FiSearch} title={trashView && !filtered ? "Çöp kutusu boş" : "Sonuç bulunamadı"} description={trashView && !filtered ? "Silinen kayıtlar burada görünür ve geri alınabilir." : "Arama veya süzgeçlerle eşleşen kayıt yok."} action={filtered && <Button variant="outline" onClick={clear}>Süzgeçleri temizle</Button>} />
      : <EmptyState variant="bordered" icon={FiFileText} title="Henüz kayıt yok" description="İlk kaydı ekleyerek başlayın." action={can("entry.create") && <Button as={Link} to={sitePath(siteId, `/icerik/${moduleKey}/yeni`)} icon={FiPlus}>Yeni kayıt</Button>} />;
  } else if (tree) {
    content = <TreeView items={items} entryPath={entryPath} canMove={schema.behavior.allowReorder && can("entry.update")} onMove={moveTree} />;
  } else if (view === "cards" || view === "gallery") {
    content = (
      <ul className={view === "gallery" ? "module_entries_cards module_entries_gallery" : "module_entries_cards"}>
        {items.map((item) => (
          <li key={item.id} className="module_entries_card">
            {selectBox(item)}
            <Link to={entryPath(item.id)} className="module_entries_card_link">{item.title || "Adsız kayıt"}</Link>
            {item.subtitle && <span className="module_entries_subtitle">{typeof item.subtitle === "string" ? item.subtitle : "—"}</span>}
            {columns.map((field) => <span key={field.id} className="module_entries_meta">{labelOf(field.label)}: {displayValue(field, item.columns?.[field.key])}</span>)}
            <StatusBadge entry={item} />
          </li>
        ))}
      </ul>
    );
  } else {
    content = (
      <Table variant="bordered" hoverable caption={`${labelIn(schema.module.label, site.defaultLocale)} kayıtları`} hideCaption className={view === "compact" ? "module_entries_compact" : undefined}>
        <thead>
          <tr>
            {selectable && (
              <th scope="col" className="module_entries_check">
                <Checkbox label="Sayfadaki bütün kayıtları seç" className="module_entries_select" checked={allSelected} indeterminate={!allSelected && selected.length > 0}
                  onChange={(event) => setSelected(event.target.checked ? items.map((item) => item.id) : [])} />
              </th>
            )}
            <th scope="col">{labelOf(byId.get(schema.ui.list.titleField)?.label) || "Başlık"}</th>
            {view !== "compact" && columns.map((field) => <th key={field.id} scope="col">{labelOf(field.label)}</th>)}
            <th scope="col">Durum</th>
            {view !== "compact" && <th scope="col">Güncelleme</th>}
            {canReorder && <th scope="col"><span className="module_entries_sr">Sıra</span></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              {selectable && <td className="module_entries_check">{selectBox(item)}</td>}
              <td>
                <Link to={entryPath(item.id)} className="module_entries_title">{item.title || "Adsız kayıt"}</Link>
                {item.subtitle && typeof item.subtitle === "string" && <span className="module_entries_subtitle">{item.subtitle}</span>}
              </td>
              {view !== "compact" && columns.map((field) => <td key={field.id}>{displayValue(field, item.columns?.[field.key])}</td>)}
              <td><StatusBadge entry={item} /></td>
              {view !== "compact" && <td>{formatDate(item.updatedAt)}</td>}
              {canReorder && (
                <td className="module_entries_order">
                  <Button variant="ghost" size="sm" icon={FiArrowUp} ariaLabel={`${item.title}: yukarı taşı`} disabled={index === 0 || reorder.isPending} onClick={() => moveRow(index, -1)} />
                  <Button variant="ghost" size="sm" icon={FiArrowDown} ariaLabel={`${item.title}: aşağı taşı`} disabled={index === items.length - 1 || reorder.isPending} onClick={() => moveRow(index, 1)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    );
  }

  return (
    <>
      <div className="module_entries_toolbar">
        <Input aria-label="Kayıtlarda ara" type="search" icon={FiSearch} placeholder="Kayıtlarda ara" value={search} onChange={(event) => setSearch(event.target.value)} className="module_entries_search" />
        {!trashView && (
          <Select aria-label="Duruma göre süz" size="sm" isClearable placeholder="Bütün durumlar" options={STATUS_OPTIONS} className="module_entries_filter"
            value={STATUS_OPTIONS.find((option) => option.value === filters.durum) ?? null} onChange={(option) => setFilter("durum", option?.value ?? "")} />
        )}
        {filterableFields.map((field) => {
          const valueKind = getFieldType(field.type).valueKind;
          const fieldOptions = valueKind === "boolean"
            ? [{ value: "true", label: field.settings?.trueLabel || "Evet" }, { value: "false", label: field.settings?.falseLabel || "Hayır" }]
            : (field.settings?.options ?? []).map((option) => ({ value: option.id, label: labelOf(option.label) }));
          return (
            <Select key={field.id} aria-label={labelOf(field.label)} size="sm" isClearable placeholder={labelOf(field.label)} options={fieldOptions} className="module_entries_filter"
              value={fieldOptions.find((option) => option.value === filters[`f_${field.key}`]) ?? null} onChange={(option) => setFilter(`f_${field.key}`, option?.value ?? "")} />
          );
        })}
        {!tree && <Select aria-label="Sıralama" size="sm" options={sortOptions} value={sortOptions.find((option) => option.value === filters.sirala) ?? sortOptions[0]} onChange={(option) => setFilter("sirala", option?.value ?? "")} className="module_entries_filter" />}
        <Button variant={trashView ? "soft" : "ghost"} size="sm" icon={FiTrash2} aria-pressed={trashView} onClick={() => { setSelected([]); setFilter("cop", trashView ? "" : "1"); }}>Çöp kutusu</Button>
      </div>
      {selected.length > 0 && (
        <div className="module_entries_bulk" role="region" aria-label="Seçili kayıtlar">
          <span>{selected.length} kayıt seçildi</span>
          {availableBulk.map((item) => <Button key={item.key} size="sm" variant="outline" color={item.color} icon={item.icon} loading={bulk.isPending && bulk.variables?.action === item.key} onClick={() => runBulk(item.key)}>{item.label}</Button>)}
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Seçimi temizle</Button>
        </div>
      )}
      {canReorder === false && sortedByPosition && !filtered && !trashView && schema.behavior.allowReorder && can("entry.update") && query.data?.hasNext && (
        <p className="module_entries_hint">Sıralamayı değiştirmek için bütün kayıtların tek sayfada görünmesi gerekir.</p>
      )}
      {content}
      {!tree && query.data && (query.data.hasNext || page > 1) && (
        <Pagination page={page} pageCount={Math.max(1, Math.ceil((query.data.total ?? 0) / pageSize))} onChange={setPage} />
      )}
    </>
  );
};

const ModuleEntries = () => {
  const { moduleKey } = useParams();
  const { siteId, site, can } = useSiteScope();
  const schemaQuery = useModuleSchema(siteId, moduleKey);
  const schema = schemaQuery.data;
  usePageTitle(schema ? labelIn(schema.module.label, site.defaultLocale) : "İçerik");

  if (schemaQuery.isPending) return <Skeleton variant="rectangle" height={320} radius="lg" />;
  if (isApiError(schemaQuery.error, "NOT_FOUND")) return <NotFound />;
  if (schemaQuery.isError) return <QueryErrorAlert error={schemaQuery.error} onRetry={() => schemaQuery.refetch()} />;
  if (schema.kind === "singleton") return <SingletonModule key={moduleKey} siteId={siteId} moduleKey={moduleKey} />;

  const title = labelIn(schema.module.label, site.defaultLocale);
  return (
    <div className="module_entries">
      <PageHeader
        title={title}
        breadcrumb={[{ label: title }]}
        actions={can("entry.create") && <Button as={Link} to={sitePath(siteId, `/icerik/${moduleKey}/yeni`)} icon={FiPlus}>Yeni kayıt</Button>}
      />
      <EntryList key={moduleKey} schema={schema} siteId={siteId} moduleKey={moduleKey} />
    </div>
  );
};

export default ModuleEntries;
