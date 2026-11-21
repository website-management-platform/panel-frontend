import { useState } from "react";
import { FiDownload } from "react-icons/fi";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Checkbox from "@/components/Checkbox";
import PageHeader from "@/components/PageHeader";
import RadioGroup from "@/components/RadioGroup";
import Select from "@/components/Select";
import Skeleton from "@/components/Skeleton";
import { toast } from "@/components/Toast/toast";
import { getErrorMessage } from "@/api/errors";
import { createIdempotencyKey } from "@/api/http";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatBytes, formatDateTime } from "@/utils/format";
import { labelIn } from "../../../content/labels";
import { useForms } from "../../../forms/api";
import { useSiteScope } from "../../../sites/siteContext";
import { exportDownloadUrl, useCreateExport, useExports } from "../../api";
import "./transfer.scss";

const EXPORT_STATUS = {
  pending: { label: "Hazırlanıyor", variant: "info" },
  ready: { label: "Hazır", variant: "success" },
  failed: { label: "Başarısız", variant: "danger" },
  expired: { label: "Süresi doldu", variant: "neutral" },
};

const KIND_TEXT = { site: "Bütün site (JSON)", module: "Bölüm (CSV)", formSubmissions: "Form başvuruları (CSV)" };

const ExportCard = () => {
  const { siteId, site, can, modules } = useSiteScope();
  const canContent = can("entry.export");
  const canForms = can("formSubmission.export");
  const forms = useForms(siteId, { enabled: canForms });
  const list = useExports(siteId, { enabled: true });
  const create = useCreateExport(siteId);
  const kinds = [canContent && "site", canContent && "module", canForms && "formSubmissions"].filter(Boolean);
  const [kind, setKind] = useState(kinds[0]);
  const [moduleKey, setModuleKey] = useState("");
  const [formKey, setFormKey] = useState("");
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const contentModules = modules.filter((item) => item.area !== "site");
  const moduleOptions = contentModules.map((item) => ({ value: item.key, label: labelIn(item.label, site.defaultLocale) }));
  const formOptions = (forms.data?.items ?? []).map((item) => ({ value: item.key, label: labelIn(item.title, site.defaultLocale) }));
  const ready = kind === "site" || (kind === "module" && moduleKey) || (kind === "formSubmissions" && formKey);
  const submit = () => create.mutate({
    body: { kind, ...(kind === "module" ? { moduleKey } : {}), ...(kind === "formSubmissions" ? { formKey } : {}), options: kind !== "formSubmissions" && includeSensitive ? { includeSensitive: true } : {} },
    idempotencyKey: createIdempotencyKey(),
  }, { onSuccess: () => toast.success("Dışa aktarma hazırlanıyor; hazır olunca bildirim gelecek") });
  const items = list.data?.items ?? [];

  return (
    <Card title="Dışa aktar" icon={FiDownload} description="Dosya arka planda hazırlanır ve 24 saat indirilebilir. Kullanıcılar, şifreler ve bağlantı anahtarları hiçbir dosyaya girmez.">
      <div className="transfer_form">
        <RadioGroup label="Ne aktarılsın?" value={kind} onChange={setKind}
          options={kinds.map((value) => ({ value, label: KIND_TEXT[value], description: value === "site" ? "Bütün içerik bölümleri, taslaklar dahil; sitenin yedeği olarak saklayın." : value === "module" ? "Excel'de açılabilir; her dil ayrı sütun." : "Başvurular kişisel veri içerir; dosyayı güvenli saklayın." }))} />
        {kind === "module" && <Select label="Bölüm" options={moduleOptions} value={moduleOptions.find((item) => item.value === moduleKey) ?? null} onChange={(option) => setModuleKey(option?.value ?? "")} placeholder="Bölüm seçin" />}
        {kind === "formSubmissions" && <Select label="Form" options={formOptions} value={formOptions.find((item) => item.value === formKey) ?? null} onChange={(option) => setFormKey(option?.value ?? "")} placeholder="Form seçin" />}
        {kind !== "formSubmissions" && can("site.settings.update") && (
          <Checkbox label="Kişisel veri olarak işaretli alanları da ekle" description="Varsayılan olarak bu alanlar dosyaya girmez." checked={includeSensitive} onChange={(event) => setIncludeSensitive(event.target.checked)} />
        )}
        <div>
          <Button icon={FiDownload} onClick={submit} loading={create.isPending} disabled={!ready}>Dışa aktar</Button>
        </div>
        {create.error && <Alert variant="danger" size="compact">{getErrorMessage(create.error)}</Alert>}
      </div>
      <h3 className="transfer_subtitle">Son dosyalar</h3>
      {list.isPending && <Skeleton variant="rectangle" height={80} radius="md" />}
      {list.data && items.length === 0 && <p className="transfer_muted">Henüz dışa aktarma yok.</p>}
      {items.length > 0 && (
        <ul className="transfer_rows">
          {items.map((item) => (
            <li key={item.id} className="transfer_row">
              <span className="transfer_row_main">
                <strong className="transfer_row_title">{item.fileName}</strong>
                <span className="transfer_muted">
                  {KIND_TEXT[item.kind]} · {item.createdBy?.displayName} · {formatDateTime(item.createdAt)}
                  {item.size ? ` · ${formatBytes(item.size)}` : ""}
                  {item.status === "ready" && item.expiresAt ? ` · ${formatDateTime(item.expiresAt)} tarihine kadar` : ""}
                  {item.options?.includeSensitive && " · kişisel veri içerir"}
                </span>
              </span>
              <Badge size="sm" variant={EXPORT_STATUS[item.status]?.variant} dot>{EXPORT_STATUS[item.status]?.label}</Badge>
              {item.status === "ready" && <Button as="a" size="sm" variant="outline" icon={FiDownload} href={exportDownloadUrl(siteId, item.id)} download>İndir</Button>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

/** Dışa aktarma (şartname §18): site yedeği, bölüm ve başvuru CSV'si. İçe aktarma yoktur (ADR-057). */
const Transfer = () => {
  usePageTitle("Dışa aktarma");
  return (
    <div className="transfer">
      <PageHeader title="Dışa aktarma" description="Site içeriğini ve form başvurularını dosya olarak indirin." />
      <ExportCard />
    </div>
  );
};

export default Transfer;
