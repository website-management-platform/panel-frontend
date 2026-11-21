import { useEffect, useState } from "react";
import { FiDownload, FiLock, FiTrash2 } from "react-icons/fi";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import DescriptionList from "@/components/DescriptionList";
import Drawer from "@/components/Drawer";
import QueryErrorAlert from "@/components/QueryErrorAlert";
import Select from "@/components/Select";
import Skeleton from "@/components/Skeleton";
import Textarea from "@/components/Textarea";
import { toast } from "@/components/Toast/toast";
import { getErrorMessage } from "@/api/errors";
import { useConfirm } from "@/hooks/useConfirm";
import { formatBytes, formatDateTime } from "@/utils/format";
import { labelIn } from "../../../content/labels";
import { useSiteScope } from "../../../sites/siteContext";
import { attachmentUrl, useDeleteSubmission, useSubmission, useUpdateSubmission } from "../../api";
import { SUBMISSION_STATUS } from "../../status";
import "./submission_drawer.scss";

const STATUS_OPTIONS = Object.entries(SUBMISSION_STATUS).map(([value, meta]) => ({ value, label: meta.label }));

const valueText = (field, locale) => {
  if (field.value === null || field.value === undefined || field.value === "") return <span className="submission_drawer_empty">Boş</span>;
  if (field.type === "checkbox") return field.value ? "Evet" : "Hayır";
  if (field.type === "select") return labelIn(field.optionLabel, locale) || field.value;
  if (field.type === "email") return <a href={`mailto:${field.value}`}>{field.value}</a>;
  if (field.type === "phone") return <a href={`tel:${field.value.replace(/[^\d+]/g, "")}`}>{field.value}</a>;
  if (field.type === "date") return new Date(`${field.value}T00:00:00`).toLocaleDateString("tr-TR");
  return <span className="submission_drawer_text">{field.value}</span>;
};

/**
 * Başvuru ayrıntısı (şartname §17): değerler, ekler (özel indirme), onay sürümü ve zamanı, durum ve iç not.
 * Okunmamış başvuru açılınca okunmuş sayılır. Silme kalıcıdır ve ayrı izin ister.
 */
const SubmissionDrawer = ({ formKey, submissionId, onClose }) => {
  const { siteId, site, can } = useSiteScope();
  const confirm = useConfirm();
  const query = useSubmission(siteId, formKey, submissionId);
  const update = useUpdateSubmission(siteId, formKey);
  const remove = useDeleteSubmission(siteId, formKey);
  const submission = query.data;
  const [note, setNote] = useState(null);

  const markRead = update.mutate;
  useEffect(() => {
    if (submission?.status === "unread") markRead({ submissionId: submission.id, values: { status: "read" }, version: submission.version });
  }, [submission?.id, submission?.status, submission?.version, markRead]);

  const setStatus = (status) => update.mutate({ submissionId: submission.id, values: { status }, version: submission.version }, { onSuccess: () => toast.success("Durum güncellendi") });
  const saveNote = () => update.mutate({ submissionId: submission.id, values: { note: note ?? "" }, version: submission.version }, { onSuccess: () => { setNote(null); toast.success("Not kaydedildi"); } });
  const destroy = async () => {
    const ok = await confirm({
      variant: "destructive",
      title: "Başvuru kalıcı olarak silinsin mi?",
      description: "Başvuru ve ekleri geri alınamayacak şekilde silinir. Silme işlemi denetim kaydına yazılır.",
      confirmLabel: "Kalıcı olarak sil",
      onConfirm: () => remove.mutateAsync(submission.id),
    });
    if (ok) {
      toast.success("Başvuru silindi");
      onClose();
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      size="lg"
      title={submission?.title ?? "Başvuru"}
      description={submission && `${submission.confirmationId} · ${formatDateTime(submission.createdAt)}`}
      footerStart={submission && can("formSubmission.delete") && <Button variant="ghost" color="danger" icon={FiTrash2} onClick={destroy} loading={remove.isPending}>Sil</Button>}
      footer={<Button variant="outline" onClick={onClose}>Kapat</Button>}
    >
      {query.isPending && <Skeleton variant="rectangle" height={280} radius="md" />}
      {query.isError && <QueryErrorAlert error={query.error} onRetry={() => query.refetch()} />}
      {submission && (
        <div className="submission_drawer">
          {submission.status === "spam" && <Alert variant="warning" size="compact" title="Spam olarak işaretlendi">Otomatik spam denetimi bu başvuruyu ayırdı. Gerçek bir başvuruysa durumunu değiştirin.</Alert>}
          <div className="submission_drawer_status">
            <Select label="Durum" size="sm" options={STATUS_OPTIONS} isSearchable={false} value={STATUS_OPTIONS.find((option) => option.value === submission.status)} onChange={(option) => setStatus(option.value)} isDisabled={update.isPending} />
          </div>
          <DescriptionList
            layout="stacked"
            items={submission.fields.filter((field) => field.type !== "file").map((field) => ({
              id: field.key,
              label: (
                <span className="submission_drawer_label">
                  {labelIn(field.label, site.defaultLocale)}
                  {field.sensitive && <Badge size="sm" variant="warning" icon={FiLock}>Kişisel veri</Badge>}
                </span>
              ),
              value: valueText(field, site.defaultLocale),
            }))}
          />
          {submission.attachments.length > 0 && (
            <section className="submission_drawer_section" aria-labelledby="submission-attachments">
              <h3 id="submission-attachments">Ekler</h3>
              <ul className="submission_drawer_files">
                {submission.attachments.map((file) => (
                  <li key={file.id}>
                    <a className="submission_drawer_file" href={attachmentUrl(siteId, formKey, submission.id, file.id)} download>
                      <FiDownload aria-hidden="true" />
                      <span>{file.fileName}</span>
                      <span className="submission_drawer_meta">{formatBytes(file.size)}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="submission_drawer_meta">Ekler yalnız buradan indirilir; her indirme denetim kaydına yazılır.</p>
            </section>
          )}
          <section className="submission_drawer_section" aria-labelledby="submission-consent">
            <h3 id="submission-consent">Onaylar</h3>
            <p className="submission_drawer_meta">
              Aydınlatma metni sürüm {submission.consent.version} · {formatDateTime(submission.consent.acceptedAt)} tarihinde onaylandı.
              {" "}Pazarlama izni: {submission.marketingConsent ? "verildi" : "verilmedi"}.
              {" "}Bu başvuru {formatDateTime(submission.deleteAfter)} tarihinde kendiliğinden silinecek.
            </p>
          </section>
          <section className="submission_drawer_section">
            <Textarea label="Ekip notu" rows={3} maxLength={2000} placeholder="Yalnız ekibiniz görür; başvurana gönderilmez." value={note ?? submission.note} onChange={(event) => setNote(event.target.value)} />
            <div>
              <Button size="sm" variant="outline" onClick={saveNote} disabled={note === null || note === submission.note} loading={update.isPending}>Notu kaydet</Button>
            </div>
            {submission.handledBy && <p className="submission_drawer_meta">Son işlem: {submission.handledBy.displayName}</p>}
          </section>
          {update.error && <Alert variant="danger" size="compact">{getErrorMessage(update.error)}</Alert>}
        </div>
      )}
    </Drawer>
  );
};

export default SubmissionDrawer;
