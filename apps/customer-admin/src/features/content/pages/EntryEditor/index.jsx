import { useId, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  FiClock, FiCopy, FiCornerDownLeft, FiEye, FiMoreHorizontal, FiRotateCcw, FiSave, FiTrash2, FiUploadCloud, FiX, FiXCircle,
} from "react-icons/fi";
import {
  computeValues, conditionValues, evaluateCondition, fromApiValues, labelOf, stableStringify, validateFieldValues,
} from "@wmp/schema";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import ButtonGroup from "@/components/ButtonGroup";
import Card from "@/components/Card";
import Dropdown, { DropdownItem } from "@/components/Dropdown";
import PageHeader from "@/components/PageHeader";
import QueryErrorAlert from "@/components/QueryErrorAlert";
import SegmentedControl from "@/components/SegmentedControl";
import Skeleton from "@/components/Skeleton";
import Tabs, { TabPanel } from "@/components/Tabs";
import { toast } from "@/components/Toast/toast";
import { getErrorMessage, isApiError } from "@/api/errors";
import { createIdempotencyKey } from "@/api/http";
import { useConfirm } from "@/hooks/useConfirm";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useSearchParamsState } from "@/hooks/useSearchParamsState";
import { allowNextNavigation, useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import NotFound from "@/pages/NotFound";
import { formatDateTime } from "@/utils/format";
import PreviewModal from "../../../publishing/components/PreviewModal";
import ScheduleModal from "../../../publishing/components/ScheduleModal";
import { SCHEDULE_TYPE, formatInZone } from "../../../publishing/format";
import { sitePath, useSiteScope } from "../../../sites/siteContext";
import { useCreateEntry, useEntry, useEntryAction, useModuleSchema, useUpdateEntry } from "../../api";
import EntryHistory from "../../components/EntryHistory";
import FieldEditor from "../../components/FieldEditor";
import { TRANSLATION_META, entryBadges, labelIn, localeName } from "../../labels";
import { displayValue } from "../../format";
import { isLocalized, readValue, writeValue } from "../../localized";
import "./entry_editor.scss";

// Yeni kayıtta varsayılan değerler (dile bağlı alanda varsayılan tanımlanmaz).
const initialValues = (schema) => Object.fromEntries(schema.fields
  .filter((field) => !field.archived && field.defaultValue !== undefined && field.defaultValue !== null)
  .map((field) => [field.key, structuredClone(field.defaultValue)]));

// Sunucu hata yolu → alan yolu: "values.title.tr" / "set.title" → "title.tr" / "title".
const serverErrors = (error) => Object.fromEntries((error?.fieldErrors ?? [])
  .filter((item) => /^(values|set|unset)\./.test(item.path))
  .map((item) => [item.path.replace(/^(values|set|unset)\./, ""), item.message]));

const RTL_LOCALES = new Set(["ar", "he", "fa", "ur"]);
const isRtl = (locale) => RTL_LOCALES.has(locale.split("-")[0]);
const isBlank = (value) => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

const TAB_DEFAULTS = { sekme: "icerik" };

const errorFor = (errors, field, locale) => errors[`${field.key}.${locale}`] ?? errors[field.key]
  ?? Object.entries(errors).find(([path]) => path.startsWith(`${field.key}.`) && !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(path.slice(field.key.length + 1)))?.[1];


/**
 * Kayıt formu (şartname §5.1, §12): şemadan üretilir; özel kod gerekmez. singleton modülde liste yerine doğrudan açılır.
 * Değerler API biçiminde (alan anahtarıyla) tutulur; doğrulama ortak şema paketiyle yapılır, sunucu ayrıca denetler.
 */
const EntryForm = ({ schema, entry, moduleKey, singleton, refetch }) => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { site, siteId, can } = useSiteScope();
  const [tab, setTab] = useSearchParamsState(TAB_DEFAULTS);
  const [dialog, setDialog] = useState(null);
  const creating = !entry;
  const [values, setValues] = useState(() => (entry ? structuredClone(entry.values) : initialValues(schema)));
  const [locale, setLocale] = useState(site.defaultLocale);
  const [clientErrors, setClientErrors] = useState({});
  const [idempotencyKey] = useState(createIdempotencyKey);
  const formId = useId();
  const create = useCreateEntry(siteId, moduleKey);
  const update = useUpdateEntry(siteId, moduleKey, entry?.id);
  const action = useEntryAction(siteId, moduleKey);
  const listPath = sitePath(siteId, `/icerik/${moduleKey}`);
  const trashed = entry?.status === "TRASHED";
  const canWrite = creating ? can("entry.create") : can("entry.update") && !trashed;
  const baseline = useMemo(() => stableStringify(entry ? entry.values : initialValues(schema)), [entry, schema]);
  const dirty = stableStringify(values) !== baseline;
  useUnsavedChangesGuard(dirty && !create.isSuccess);

  const stored = useMemo(() => fromApiValues(schema.fields, values, { errors: [] }), [schema, values]);
  const visibility = conditionValues(schema.fields, stored, site.defaultLocale);
  const visible = (field) => !field.archived && !field.hidden && field.type !== "secret" && evaluateCondition(field.condition, visibility);
  const computed = computeValues(schema.fields, values, locale);
  const pendingError = create.error ?? update.error ?? action.error;
  const errors = { ...serverErrors(pendingError), ...clientErrors };
  const conflict = isApiError(update.error, "PRECONDITION_FAILED") || isApiError(action.error, "PRECONDITION_FAILED");
  const ctx = { locale, uiLocale: "tr", multiLocale: site.locales.length > 1, timeZone: site.timezone, siteId, computed, design: schema.design ?? null };
  const sourceLocale = site.defaultLocale;
  // Eksik çeviri: kaynak dilde dolu, bu dilde boş olan görünür ve dile bağlı alanlar (şartname §7: eksik çeviri göstergesi).
  const missingIn = (target) => schema.fields.filter((field) => isLocalized(field) && visible(field) && !isBlank(values[field.key]?.[sourceLocale]) && isBlank(values[field.key]?.[target])).length;
  const title = labelIn(schema.module.label, site.defaultLocale);

  const setField = (field, next) => {
    setValues((current) => {
      const result = { ...current };
      const written = writeValue(field, current[field.key], locale, next);
      if (written === undefined) delete result[field.key];
      else result[field.key] = written;
      return result;
    });
    setClientErrors((current) => {
      const next = { ...current };
      Object.keys(next).filter((path) => path === field.key || path.startsWith(`${field.key}.`)).forEach((path) => delete next[path]);
      return next;
    });
  };

  // Hatalı ilk alana odak: dile bağlı alanda o dile geçilir.
  const focusFirstError = (found) => {
    const [path] = Object.keys(found);
    if (!path) return;
    const [key, maybeLocale] = path.split(".");
    if (maybeLocale && site.locales.includes(maybeLocale) && maybeLocale !== locale) setLocale(maybeLocale);
    requestAnimationFrame(() => document.getElementById(formId)?.querySelector(`[data-field-key="${key}"] :is(input, textarea, [contenteditable=true], button)`)?.focus());
  };

  const validate = (mode) => {
    const found = Object.fromEntries(validateFieldValues(schema.fields, stored, {
      locales: site.locales,
      mode,
      isVisible: (field) => evaluateCondition(field.condition, visibility),
    }).map((error) => [error.path, error.message]));
    setClientErrors(found);
    focusFirstError(found);
    return Object.keys(found).length === 0;
  };

  // Değişen alanlar set, kaldırılanlar unset olarak gönderilir; dokunulmayan alanlar ve başka dillerin değeri korunur.
  const changes = () => {
    const original = entry.values;
    const keys = new Set([...Object.keys(original), ...Object.keys(values)]);
    const set = {};
    const unset = [];
    keys.forEach((key) => {
      if (stableStringify(original[key]) === stableStringify(values[key])) return;
      if (values[key] === undefined) unset.push(key);
      else set[key] = values[key];
    });
    return { set, unset };
  };

  const save = async () => {
    if (!validate("save")) return null;
    if (creating) {
      const created = await create.mutateAsync({ values, idempotencyKey });
      allowNextNavigation();
      toast.success("Kayıt oluşturuldu");
      navigate(singleton ? listPath : sitePath(siteId, `/icerik/${moduleKey}/${created.id}`), { replace: true });
      return created;
    }
    if (!dirty) return entry;
    const saved = await update.mutateAsync({ ...changes(), version: entry.version });
    setValues(structuredClone(saved.values));
    toast.success("Değişiklikler kaydedildi");
    return saved;
  };

  // Son işlem saklanır: bağlantı veya sunucu hatasında form verisi yerinde kalır ve aynı işlem "Yeniden dene" ile tekrarlanır (AT-59).
  const [lastTask, setLastTask] = useState(null);
  const run = (task) => () => {
    create.reset();
    update.reset();
    action.reset();
    setLastTask(() => task);
    task().catch((error) => focusFirstError(serverErrors(error)));
  };

  const publish = run(async () => {
    if (!validate("publish")) return;
    const saved = dirty ? await save() : entry;
    if (!saved) return;
    await action.mutateAsync({ entryId: saved.id, action: "publish", version: saved.version });
    toast.success("Kayıt yayınlandı");
  });


  const schedule = async ({ type, at }) => {
    try {
      await action.mutateAsync({ entryId: entry.id, action: "schedule", body: { type, at }, version: entry.version });
      toast.success(type === "publish" ? "Yayın planlandı" : "Yayından kaldırma planlandı");
      setDialog(null);
    } catch {
      // Hata pencerede gösterilir.
    }
  };

  const cancelSchedule = async (job) => {
    const ok = await confirm({
      title: "Plan iptal edilsin mi?",
      description: `${SCHEDULE_TYPE[job.type]} planı (${formatInZone(job.executeAt, site.timezone)}) uygulanmayacak.`,
      confirmLabel: "Planı iptal et",
      variant: "destructive",
      onConfirm: () => action.mutateAsync({ entryId: entry.id, action: "cancel-schedule", body: { jobId: job.id }, version: entry.version }),
    });
    if (ok) toast.success("Plan iptal edildi");
  };

  const simpleAction = (name, message, after) => run(async () => {
    const result = await action.mutateAsync({ entryId: entry.id, action: name, version: entry.version, idempotencyKey: name === "duplicate" ? createIdempotencyKey() : undefined });
    toast.success(message);
    after?.(result);
  });

  const trash = async () => {
    const ok = await confirm({
      variant: "destructive",
      title: "Kayıt çöp kutusuna taşınsın mı?",
      description: "Kayıt yayından kalkar. Çöp kutusundan geri alınabilir.",
      confirmLabel: "Çöp kutusuna taşı",
      onConfirm: () => action.mutateAsync({ entryId: entry.id, action: "trash", version: entry.version }),
    });
    if (ok) {
      allowNextNavigation();
      toast.success("Kayıt çöp kutusuna taşındı");
      navigate(listPath);
    }
  };

  const groups = schema.ui.form.groups ?? [];
  const twoColumn = schema.ui.form.layout === "two-column";
  const renderFields = (fields) => (
    <div className={twoColumn ? "entry_editor_grid entry_editor_grid_two" : "entry_editor_grid"}>
      {fields.filter(visible).map((field) => (
        <div key={field.id} data-field-key={field.key} dir={isLocalized(field) && isRtl(locale) ? "rtl" : undefined} className={field.ui?.width === "half" && twoColumn ? "entry_editor_field" : "entry_editor_field entry_editor_field_full"}>
          <FieldEditor
            field={field}
            value={readValue(field, values[field.key], locale)}
            onChange={(next) => setField(field, next)}
            error={errorFor(errors, field, locale)}
            errors={errors}
            disabled={!canWrite || !field.editable}
            ctx={ctx}
          />
          {isLocalized(field) && locale !== sourceLocale && !isBlank(values[field.key]?.[sourceLocale]) && (
            <div className="entry_editor_source" dir="ltr">
              <span className="entry_editor_source_text"><strong>{localeName(sourceLocale)}:</strong> {displayValue(field, values[field.key][sourceLocale])}</span>
              {canWrite && field.editable && (
                <Button variant="link" size="sm" icon={FiCornerDownLeft} onClick={() => setField(field, structuredClone(values[field.key][sourceLocale]))}>
                  {isBlank(values[field.key]?.[locale]) ? "Kaynaktan kopyala" : "Kaynakla değiştir"}
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
  const ungrouped = schema.fields.filter((field) => !groups.some((group) => group.id === field.ui?.group));
  const badges = entry ? entryBadges(entry) : [];
  const busy = create.isPending || update.isPending || action.isPending;
  const canPublishNow = !creating && can("entry.publish");
  const nothingToPublish = entry?.isPublished && !entry.hasUnpublishedChanges && !dirty;
  const pendingSchedules = entry?.schedules ?? [];
  const tabs = creating ? [] : [
    { id: "icerik", label: "İçerik" },
    { id: "gecmis", label: "Geçmiş", badge: entry.revision },
  ];
  const activeTab = tabs.some((item) => item.id === tab.sekme) ? tab.sekme : TAB_DEFAULTS.sekme;
  const moreItems = creating || trashed ? [] : [
    { key: "preview", label: "Önizle", icon: FiEye, onClick: () => setDialog("preview"), show: true },
    { key: "schedule", label: "Yayını planla", icon: FiClock, onClick: () => setDialog("schedule"), show: can("entry.publish") && !singleton },
    { key: "duplicate", label: "Kopyala", icon: FiCopy, onClick: simpleAction("duplicate", "Kayıt kopyalandı", (copy) => navigate(sitePath(siteId, `/icerik/${moduleKey}/${copy.id}`))), show: !singleton && can("entry.create") && schema.behavior.allowDuplicate && !dirty },
    { key: "unpublish", label: "Yayından kaldır", icon: FiXCircle, onClick: simpleAction("unpublish", "Kayıt yayından kaldırıldı"), show: entry.isPublished && can("entry.publish") },
    { key: "trash", label: "Sil", icon: FiTrash2, onClick: trash, show: !singleton && can("entry.delete"), danger: true },
  ].filter((item) => item.show);
  const entryTitle = creating ? "Yeni kayıt" : entry.title || "Adsız kayıt";
  const errorCount = Object.keys(clientErrors).length;

  return (
    <div className="entry_editor">
      <PageHeader
        title={singleton ? title : entryTitle}
        description={entry ? `Son güncelleme: ${formatDateTime(entry.updatedAt)}${entry.updatedBy ? ` · ${entry.updatedBy.displayName}` : ""}` : undefined}
        badge={badges.length > 0 && (
          <span className="entry_editor_badges">
            {badges.map((badge) => <Badge key={badge.key} variant={badge.variant} dot={badge.dot !== false}>{badge.label}</Badge>)}
          </span>
        )}
        breadcrumb={singleton ? [{ label: title }] : [{ label: title, path: listPath }, { label: entryTitle }]}
        actions={!trashed && (
          <ButtonGroup attached={false} ariaLabel="Kayıt işlemleri">
            {moreItems.length > 0 && (
              <Dropdown placement="bottom_end" trigger={({ toggle, triggerProps }) => <Button variant="outline" icon={FiMoreHorizontal} disabled={busy} {...triggerProps} onClick={toggle}>Diğer</Button>}>
                {({ close }) => moreItems.map((item) => (
                  <DropdownItem key={item.key} icon={item.icon} danger={item.danger} onClick={() => { close(); item.onClick(); }}>{item.label}</DropdownItem>
                ))}
              </Dropdown>
            )}
            {canWrite && <Button variant="outline" icon={FiSave} loading={create.isPending || update.isPending} disabled={busy || !dirty} onClick={run(save)}>Kaydet</Button>}
            {canPublishNow && canWrite && (
              <Button icon={FiUploadCloud} loading={action.isPending} disabled={busy || nothingToPublish} onClick={publish}>
                Yayınla
              </Button>
            )}
          </ButtonGroup>
        )}
      />

      {entry?.routes && (
        <p className="entry_editor_route">
          <span>Adres: <strong>{entry.routes.draft?.[locale] ?? "adres parçası eksik"}</strong></span>
          {entry.routes.live?.[locale] && entry.routes.live[locale] !== entry.routes.draft?.[locale] && <span>Yayında: {entry.routes.live[locale]} (eski adres yayınlayınca yeni adrese yönlenir)</span>}
        </p>
      )}
      {trashed && (
        <Alert variant="warning" title="Bu kayıt çöp kutusunda" action={can("entry.restore") && <Button size="sm" icon={FiRotateCcw} onClick={simpleAction("restore", "Kayıt geri alındı")}>Geri al</Button>}>
          Düzenlemek için önce geri alın.
        </Alert>
      )}
      {conflict && (
        <Alert variant="warning" title="Kayıt başka bir yerde değişti" action={<Button size="sm" variant="outline" onClick={async () => { const { data } = await refetch(); if (data) { setValues(structuredClone(data.values)); update.reset(); action.reset(); } }}>Güncel hâlini yükle</Button>}>
          Siz düzenlerken kayıt başka bir kullanıcı tarafından kaydedildi. Değişiklikleriniz kaydedilmedi; güncel hâli yükleyip yeniden deneyin.
        </Alert>
      )}
      {pendingSchedules.length > 0 && (
        <Alert variant="info" title="Planlı işlem" icon={FiClock}>
          <ul className="entry_editor_schedules">
            {pendingSchedules.map((job) => (
              <li key={job.id}>
                <span>{SCHEDULE_TYPE[job.type]}: <strong>{formatInZone(job.executeAt, site.timezone)}</strong>{job.revisionNumber ? ` · ${job.revisionNumber}. revizyon` : ""} · {job.createdBy?.displayName}</span>
                {can("entry.publish") && <Button size="sm" variant="ghost" icon={FiX} onClick={() => cancelSchedule(job)}>İptal et</Button>}
              </li>
            ))}
          </ul>
          {pendingSchedules.some((job) => job.type === "publish" && job.revisionId !== entry.draftRevisionId) && <p className="entry_editor_schedule_note">Plandan sonra yapılan değişiklikler bu plana girmez.</p>}
        </Alert>
      )}
      {pendingError && !conflict && !dialog && Object.keys(serverErrors(pendingError)).length === 0 && (
        <Alert variant="danger" title={getErrorMessage(pendingError)} action={lastTask && <Button size="sm" variant="outline" onClick={run(lastTask)} loading={busy}>Yeniden dene</Button>}>
          Yazdıklarınız bu sayfada duruyor; kaybolmadı. Bağlantı düzelince yeniden deneyin.
        </Alert>
      )}
      {errorCount > 0 && <Alert variant="danger" size="compact">{errorCount} alanı düzeltin.</Alert>}
      {!canWrite && !trashed && <Alert variant="info" size="compact">Bu kaydı görüntüleyebilirsiniz; değiştirme yetkiniz yok.</Alert>}

      {site.locales.length > 1 && schema.fields.some(isLocalized) && (
        <div className="entry_editor_locale">
          <span className="entry_editor_locale_label" id="entry-locale-label">İçerik dili</span>
          <SegmentedControl
            ariaLabel="İçerik dili"
            options={site.locales.map((code) => {
              const missing = code === sourceLocale ? 0 : missingIn(code);
              const state = code === sourceLocale || dirty ? null : entry?.translation?.[code];
              const suffix = missing ? `${missing} eksik` : state === "outdated" ? TRANSLATION_META.outdated.label : null;
              return { value: code, label: suffix ? `${localeName(code)} · ${suffix}` : localeName(code) };
            })}
            value={locale}
            onChange={setLocale}
          />
          <span className="entry_editor_locale_hint">Dile göre değişen alanlar seçili dilde düzenlenir; diğer alanlar bütün dillerde ortaktır. Kaynak dil: {localeName(sourceLocale)}.</span>
        </div>
      )}

      {tabs.length > 0 && <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setTab({ sekme: id }, { replace: true })} idPrefix="entry" ariaLabel="Kayıt bölümleri" />}

      {activeTab === "gecmis" && !creating && (
        <TabPanel id="gecmis" activeTab={activeTab} idPrefix="entry">
          <Card>
            <EntryHistory siteId={siteId} moduleKey={moduleKey} entry={entry} schema={schema} canRestore={can("entry.restore") && !trashed && !dirty} onRestored={() => refetch().then(({ data }) => data && setValues(structuredClone(data.values)))} />
          </Card>
        </TabPanel>
      )}

      <form id={formId} hidden={activeTab !== "icerik"} className="entry_editor_form" noValidate onSubmit={(event) => { event.preventDefault(); run(save)(); }}>
        {ungrouped.some(visible) && <Card>{renderFields(ungrouped)}</Card>}
        {groups.map((group) => {
          const fields = schema.fields.filter((field) => field.ui?.group === group.id);
          if (!fields.some(visible)) return null;
          // Katlanmış gruplar (ör. arama motoru, çerez ayarları) yalnız istendiğinde açılır; hatalı alan varsa açık gelir.
          if (group.collapsed) {
            const hasError = fields.some((field) => errorFor(errors, field, locale));
            return (
              <details key={group.id} className="entry_editor_more" open={hasError || undefined}>
                <summary className="entry_editor_more_summary">{labelIn(group.label, "tr")}<span className="entry_editor_more_hint">İsteğe bağlı ayarlar</span></summary>
                <div className="entry_editor_more_body">{renderFields(fields)}</div>
              </details>
            );
          }
          return <Card key={group.id} title={labelIn(group.label, "tr")}>{renderFields(fields)}</Card>;
        })}
      </form>

      {dialog === "schedule" && (
        <ScheduleModal
          open
          onClose={() => { setDialog(null); action.reset(); }}
          timeZone={site.timezone}
          types={entry.isPublished ? ["publish", "unpublish"] : ["publish"]}
          onSubmit={schedule}
          pending={action.isPending}
          error={action.error}
        />
      )}
      {dialog === "preview" && <PreviewModal target={{ moduleKey, entryId: entry.id }} onClose={() => setDialog(null)} />}
    </div>
  );
};

/** Kayıt sayfası: /icerik/:moduleKey/yeni veya /icerik/:moduleKey/:entryId. Tek kayıtlı bölümde ModuleEntries içinden açılır. */
const EntryEditor = ({ singletonEntryId }) => {
  const params = useParams();
  const { siteId } = useSiteScope();
  const moduleKey = params.moduleKey;
  const entryId = singletonEntryId === undefined ? params.entryId : singletonEntryId;
  const schemaQuery = useModuleSchema(siteId, moduleKey);
  const entryQuery = useEntry(siteId, moduleKey, entryId);
  const singleton = singletonEntryId !== undefined;
  usePageTitle(entryQuery.data?.title || (schemaQuery.data ? labelOf(schemaQuery.data.module.label) : "İçerik"));

  if (schemaQuery.isPending || (entryId && entryQuery.isPending)) return <Skeleton variant="rectangle" height={420} radius="lg" />;
  if (isApiError(schemaQuery.error, "NOT_FOUND") || isApiError(entryQuery.error, "NOT_FOUND")) return <NotFound />;
  if (schemaQuery.isError) return <QueryErrorAlert error={schemaQuery.error} onRetry={() => schemaQuery.refetch()} />;
  if (entryId && entryQuery.isError) return <QueryErrorAlert error={entryQuery.error} onRetry={() => entryQuery.refetch()} />;
  return (
    <EntryForm
      key={entryId ?? "new"}
      schema={schemaQuery.data}
      entry={entryId ? entryQuery.data : null}
      moduleKey={moduleKey}
      singleton={singleton}
      refetch={entryQuery.refetch}
    />
  );
};

export default EntryEditor;
