import { useState } from "react";
import { FiEye, FiRotateCcw } from "react-icons/fi";
import { labelOf } from "@wmp/schema";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import DescriptionList from "@/components/DescriptionList";
import Drawer from "@/components/Drawer";
import EmptyState from "@/components/EmptyState";
import QueryErrorAlert from "@/components/QueryErrorAlert";
import Skeleton from "@/components/Skeleton";
import { toast } from "@/components/Toast/toast";
import VisuallyHidden from "@/components/VisuallyHidden";
import { getErrorMessage } from "@/api/errors";
import { useConfirm } from "@/hooks/useConfirm";
import { formatDateTime } from "@/utils/format";
import { useSiteScope } from "../../../sites/siteContext";
import { useEntryRevision, useEntryRevisions, useRestoreRevision } from "../../api";
import { displayValue } from "../../format";
import { REVISION_SOURCE, localeName } from "../../labels";
import { isLocalized } from "../../localized";
import "./entry_history.scss";

const changedText = (changed) => {
  if (!changed?.length) return "Değer değişmedi";
  return changed.map((scope) => (scope === "shared" ? "ortak alanlar" : localeName(scope))).join(", ");
};

const RevisionValues = ({ schema, values, locales }) => (
  <DescriptionList
    layout="vertical"
    items={schema.fields.filter((field) => !field.archived && field.type !== "secret" && field.key in values).map((field) => ({
      id: field.id,
      label: labelOf(field.label),
      value: isLocalized(field)
        ? <span className="entry_history_locales">{locales.filter((code) => values[field.key]?.[code] !== undefined).map((code) => <span key={code}><strong>{localeName(code)}:</strong> {displayValue(field, values[field.key][code])}</span>)}</span>
        : displayValue(field, values[field.key]),
    }))}
  />
);

const RevisionDrawer = ({ siteId, moduleKey, entry, schema, revisionId, onClose, onRestore, canRestore }) => {
  const { site } = useSiteScope();
  const query = useEntryRevision(siteId, moduleKey, entry.id, revisionId);
  const revision = query.data;
  return (
    <Drawer
      open
      onClose={onClose}
      size="lg"
      title={revision ? `${revision.number}. revizyon` : "Revizyon"}
      description={revision ? `${formatDateTime(revision.createdAt)} · ${revision.author?.displayName ?? "Sistem"}` : undefined}
      footer={canRestore && revision && !revision.isDraft && (
        <Button icon={FiRotateCcw} onClick={() => onRestore(revision)}>Bu hâli geri yükle</Button>
      )}
    >
      {query.isPending && <Skeleton variant="rectangle" height={240} radius="md" />}
      {query.isError && <QueryErrorAlert error={query.error} onRetry={() => query.refetch()} />}
      {revision && (
        <div className="entry_history_drawer">
          {revision.outdatedSchema && <Alert variant="info" size="compact">Bu revizyon bölümün eski yapısına göre kaydedildi; bazı alanlar artık olmayabilir.</Alert>}
          <RevisionValues schema={schema} values={revision.values} locales={site.locales} />
        </div>
      )}
    </Drawer>
  );
};

/**
 * Kaydın geçmişi (şartname §10, §25.5): her kayıt, düzenleme, geri yükleme ve yapı değişikliği bir revizyondur.
 * Geri yükleme canlıya dokunmaz; eski hâlden yeni bir taslak revizyon oluşturur.
 */
const EntryHistory = ({ siteId, moduleKey, entry, schema, canRestore, onRestored }) => {
  const confirm = useConfirm();
  const query = useEntryRevisions(siteId, moduleKey, entry.id);
  const restore = useRestoreRevision(siteId, moduleKey, entry.id);
  const [open, setOpen] = useState(null);

  const restoreRevision = async (revision) => {
    const ok = await confirm({
      title: `${revision.number}. revizyon geri yüklensin mi?`,
      description: "Bu hâl yeni bir taslak olarak kaydedilir. Yayındaki içerik siz yayınlayana kadar değişmez.",
      confirmLabel: "Geri yükle",
      onConfirm: () => restore.mutateAsync({ revisionId: revision.id, version: entry.version }),
    });
    if (ok) {
      setOpen(null);
      toast.success(`${revision.number}. revizyon geri yüklendi`);
      onRestored?.();
    }
  };

  if (query.isPending) return <Skeleton variant="rectangle" height={200} radius="md" />;
  if (query.isError) return <QueryErrorAlert error={query.error} onRetry={() => query.refetch()} />;
  const items = query.data.items;
  if (items.length === 0) return <EmptyState title="Henüz geçmiş yok" />;

  return (
    <>
      {restore.error && <Alert variant="danger" size="compact">{getErrorMessage(restore.error)}</Alert>}
      <ol className="entry_history">
        {items.map((revision) => (
          <li key={revision.id} className="entry_history_item">
            <span className="entry_history_number" aria-hidden="true">{revision.number}</span>
            <div className="entry_history_body">
              <div className="entry_history_title">
                <span>{REVISION_SOURCE[revision.source?.type] ?? "Düzenlendi"}</span>
                {revision.isDraft && <Badge size="sm" variant="neutral">Güncel taslak</Badge>}
                {revision.isPublished && <Badge size="sm" variant="success">Yayındaki hâl</Badge>}
              </div>
              <p className="entry_history_meta">
                <VisuallyHidden>{revision.number}. revizyon · </VisuallyHidden>
                {formatDateTime(revision.createdAt)} · {revision.author?.displayName ?? "Sistem"} · Değişen: {changedText(revision.changed)}
              </p>
            </div>
            <Button variant="ghost" size="sm" icon={FiEye} onClick={() => setOpen(revision.id)}>Görüntüle<VisuallyHidden>: {revision.number}. revizyon</VisuallyHidden></Button>
          </li>
        ))}
      </ol>
      {open && (
        <RevisionDrawer siteId={siteId} moduleKey={moduleKey} entry={entry} schema={schema} revisionId={open} onClose={() => setOpen(null)} onRestore={restoreRevision} canRestore={canRestore} />
      )}
    </>
  );
};

export default EntryHistory;
