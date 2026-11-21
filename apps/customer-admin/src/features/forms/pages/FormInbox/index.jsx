import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import { FiArchive, FiCheck, FiInbox, FiPaperclip, FiSearch, FiTrash2 } from "react-icons/fi";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Checkbox from "@/components/Checkbox";
import EmptyState from "@/components/EmptyState";
import Input from "@/components/Input";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import QueryErrorAlert from "@/components/QueryErrorAlert";
import SegmentedControl from "@/components/SegmentedControl";
import Select from "@/components/Select";
import Skeleton from "@/components/Skeleton";
import Table from "@/components/Table";
import { toast } from "@/components/Toast/toast";
import { getErrorMessage } from "@/api/errors";
import { useConfirm } from "@/hooks/useConfirm";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useSearchParamsState, useUrlSyncedValue } from "@/hooks/useSearchParamsState";
import { formatDateTime } from "@/utils/format";
import { labelIn } from "../../../content/labels";
import { sitePath, useSiteScope } from "../../../sites/siteContext";
import { useBulkSubmissions, useForms, useSubmissions } from "../../api";
import SubmissionDrawer from "../../components/SubmissionDrawer";
import { INBOX_VIEWS, SUBMISSION_STATUS } from "../../status";
import "./form_inbox.scss";

const FILTER_DEFAULTS = { gorunum: "open", ara: "", sayfa: 1 };
const PAGE_SIZE = 20;

/**
 * Form başvuruları gelen kutusu (şartname §17): form seçimi, durum görünümleri, arama, toplu işlem ve ayrıntı çekmecesi.
 * Adres: /formlar/:formKey/:submissionId — bildirimden gelen bağlantı ayrıntıyı doğrudan açar.
 */
const FormInbox = () => {
  usePageTitle("Başvurular");
  const { formKey, submissionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const { siteId, site, can } = useSiteScope();
  const formsQuery = useForms(siteId);
  const forms = formsQuery.data?.items ?? [];
  const activeKey = formKey ?? forms[0]?.key;
  const [filters, setFilters] = useSearchParamsState(FILTER_DEFAULTS);
  const [search, setSearch] = useUrlSyncedValue(filters.ara);
  const [selected, setSelected] = useState([]);
  const page = Number(filters.sayfa) || 1;
  const params = { status: filters.gorunum, q: filters.ara.length >= 2 ? filters.ara : undefined, page, size: PAGE_SIZE, includeTotal: true };
  const query = useSubmissions(siteId, activeKey, params);
  const bulk = useBulkSubmissions(siteId, activeKey);
  const items = query.data?.items ?? [];
  const form = forms.find((item) => item.key === activeKey);

  if (formsQuery.isSuccess && formKey && !form) return <Navigate to={sitePath(siteId, "/formlar")} replace />;

  const formPath = (key, id) => sitePath(siteId, `/formlar/${key}${id ? `/${id}` : ""}`);
  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));
  const toggleAll = () => setSelected(allSelected ? [] : items.map((item) => item.id));
  const toggle = (id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const applyStatus = (status) => bulk.mutate({ ids: selected, action: "status", status }, {
    onSuccess: (result) => {
      toast.success(`${result.count} başvuru güncellendi`);
      setSelected([]);
    },
  });
  const removeSelected = () => confirm({
    variant: "destructive",
    title: `${selected.length} başvuru kalıcı olarak silinsin mi?`,
    description: "Başvurular ve ekleri geri alınamayacak şekilde silinir.",
    confirmLabel: "Kalıcı olarak sil",
    onConfirm: () => bulk.mutateAsync({ ids: selected, action: "delete" }).then((result) => {
      toast.success(`${result.count} başvuru silindi`);
      setSelected([]);
    }),
  });
  const changeFilters = (next) => {
    setSelected([]);
    setFilters(next);
  };

  return (
    <div className="form_inbox">
      <PageHeader title="Başvurular" description="Web sitenizdeki formlardan gelen başvurular. Başvurular yalnız bu ekranda görünür ve saklama süresi dolunca silinir." />

      {formsQuery.isPending && <Skeleton variant="rectangle" height={240} radius="lg" />}
      {formsQuery.isError && <QueryErrorAlert error={formsQuery.error} onRetry={() => formsQuery.refetch()} />}
      {formsQuery.isSuccess && forms.length === 0 && (
        <EmptyState variant="bordered" icon={FiInbox} title="Bu sitede form yok" description="Web sitenize iletişim veya başvuru formu eklenmesi için platform yöneticinizle görüşün." />
      )}

      {form && (
        <>
          {forms.length > 1 && (
            <nav className="form_inbox_forms" aria-label="Formlar">
              {forms.map((item) => (
                <Link key={item.key} to={formPath(item.key)} className={item.key === activeKey ? "form_inbox_form form_inbox_form_active" : "form_inbox_form"} aria-current={item.key === activeKey ? "page" : undefined} onClick={() => setSelected([])}>
                  {labelIn(item.title, site.defaultLocale)}
                  {item.counts.unread > 0 && <Badge size="sm" variant="info">{item.counts.unread} yeni</Badge>}
                </Link>
              ))}
            </nav>
          )}
          <div className="form_inbox_toolbar">
            <SegmentedControl size="sm" ariaLabel="Görünüm" value={filters.gorunum} options={INBOX_VIEWS} onChange={(value) => changeFilters({ gorunum: value, sayfa: 1 })} />
            <form className="form_inbox_search" role="search" onSubmit={(event) => { event.preventDefault(); changeFilters({ ara: search.trim(), sayfa: 1 }); }}>
              <Input size="sm" icon={FiSearch} type="search" aria-label="Başvurularda ara" placeholder="Ad, e-posta veya onay kodu" value={search} clearable
                onClear={() => { setSearch(""); changeFilters({ ara: "", sayfa: 1 }); }} onChange={(event) => setSearch(event.target.value)} />
            </form>
          </div>
          <p className="form_inbox_note">{form.counts.total} başvuru · {form.retentionDays} gün saklanır{form.status === "disabled" ? " · Form şu an kapalı; yeni başvuru alınmıyor." : ""}</p>

          {selected.length > 0 && (
            <div className="form_inbox_bulk" role="region" aria-label="Seçili başvurular">
              <strong>{selected.length} seçili</strong>
              <Select size="sm" aria-label="Durumu değiştir" placeholder="Durumu değiştir" isSearchable={false} className="form_inbox_bulk_status" value={null}
                options={Object.entries(SUBMISSION_STATUS).map(([value, meta]) => ({ value, label: meta.label }))} onChange={(option) => applyStatus(option.value)} />
              <Button size="sm" variant="outline" icon={FiCheck} onClick={() => applyStatus("resolved")} loading={bulk.isPending}>Çözüldü</Button>
              <Button size="sm" variant="outline" icon={FiArchive} onClick={() => applyStatus("archived")}>Arşivle</Button>
              {can("formSubmission.delete") && <Button size="sm" variant="ghost" color="danger" icon={FiTrash2} onClick={removeSelected}>Sil</Button>}
            </div>
          )}
          {bulk.error && <Alert variant="danger" size="compact">{getErrorMessage(bulk.error)}</Alert>}

          {query.isPending && <Skeleton variant="rectangle" height={240} radius="lg" />}
          {query.isError && <QueryErrorAlert error={query.error} onRetry={() => query.refetch()} />}
          {query.isSuccess && items.length === 0 && (
            <EmptyState variant="bordered" icon={FiInbox} title={filters.ara ? "Aramaya uyan başvuru yok" : "Bu görünümde başvuru yok"}
              description={filters.gorunum === "open" && !filters.ara ? "Yeni başvurular geldiğinde burada ve bildirimlerde görünür." : "Başka bir görünüm seçin veya aramayı temizleyin."} />
          )}
          {items.length > 0 && (
            <Table variant="bordered" caption={`${labelIn(form.title, site.defaultLocale)} başvuruları`} hideCaption>
              <thead>
                <tr>
                  <th scope="col" className="form_inbox_check"><Checkbox aria-label="Bu sayfadaki bütün başvuruları seç" checked={allSelected} indeterminate={selected.length > 0 && !allSelected} onChange={toggleAll} /></th>
                  <th scope="col">Başvuru</th>
                  <th scope="col">Durum</th>
                  <th scope="col">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={item.status === "unread" ? "form_inbox_unread" : undefined}>
                    <td className="form_inbox_check"><Checkbox aria-label={`${item.title} başvurusunu seç`} checked={selected.includes(item.id)} onChange={() => toggle(item.id)} /></td>
                    <td>
                      <Link to={`${formPath(activeKey, item.id)}${location.search}`} className="form_inbox_title">{item.title}</Link>
                      <span className="form_inbox_meta">
                        {item.confirmationId}
                        {item.attachmentCount > 0 && <><FiPaperclip aria-hidden="true" /> {item.attachmentCount} ek</>}
                      </span>
                    </td>
                    <td><Badge size="sm" variant={SUBMISSION_STATUS[item.status]?.variant} dot>{SUBMISSION_STATUS[item.status]?.label}</Badge></td>
                    <td>{formatDateTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {query.data && (query.data.total ?? 0) > PAGE_SIZE && (
            <Pagination page={page} pageCount={Math.ceil(query.data.total / PAGE_SIZE)} onChange={(next) => changeFilters({ sayfa: next })} />
          )}
        </>
      )}

      {form && submissionId && <SubmissionDrawer formKey={activeKey} submissionId={submissionId} onClose={() => navigate(`${formPath(activeKey)}${location.search}`)} />}
    </div>
  );
};

export default FormInbox;
