import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FiEye } from "react-icons/fi";
import { labelOf } from "@wmp/schema";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import DescriptionList from "@/components/DescriptionList";
import Modal from "@/components/Modal";
import SegmentedControl from "@/components/SegmentedControl";
import Skeleton from "@/components/Skeleton";
import { api, createIdempotencyKey } from "@/api/http";
import { getErrorMessage } from "@/api/errors";
import { useModuleSchema } from "../../../content/api";
import { displayValue } from "../../../content/format";
import { localeName } from "../../../content/labels";
import { useSiteScope } from "../../../sites/siteContext";
import { fetchPreview } from "../../api";
import { formatInZone } from "../../format";
import "./preview_modal.scss";

const SOURCE_TEXT = { revision: "Kaydın taslağı" };

/**
 * Önizleme (şartname §10): kısa ömürlü, tek kayıt ve tek dil kapsamlı belirteçle sitenin okuyacağı yayın görünümü.
 * Pencere kapanınca oluşturulan belirteçler iptal edilir. Gizli ve yayına kapalı alanlar görünmez.
 * target: { moduleKey, entryId, revisionId? }.
 */
const PreviewModal = ({ target, onClose }) => {
  const { site, siteId } = useSiteScope();
  const [locale, setLocale] = useState(site.defaultLocale);
  const schemaQuery = useModuleSchema(siteId, target.moduleKey);
  const created = useRef([]);

  const preview = useQuery({
    queryKey: ["site", siteId, "preview", target, locale],
    queryFn: async () => {
      const token = await api.post(`/customer/sites/${siteId}/preview-tokens`, {
        locale,
        entryId: target.entryId,
        revisionId: target.revisionId,
      }, { idempotencyKey: createIdempotencyKey() });
      created.current.push(token.id);
      const result = await fetchPreview({ publicKey: token.publicKey, moduleKey: target.moduleKey, entryId: target.entryId, locale, token: token.token });
      return { ...result, expiresAt: token.expiresAt };
    },
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
  });

  // Pencere kapanınca bu pencerede açılan belirteçler iptal edilir (hata sessizce yok sayılır; süre zaten 15 dakika).
  useEffect(() => {
    const tokens = created.current;
    return () => tokens.forEach((id) => api.delete(`/customer/sites/${siteId}/preview-tokens/${id}`).catch(() => {}));
  }, [siteId]);

  const fields = (schemaQuery.data?.fields ?? []).filter((field) => !field.archived && field.public !== false && field.type !== "secret");
  const data = preview.data?.data ?? {};

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={FiEye}
      title="Önizleme"
      description="Sitenizin bu içeriği yayınlandığında nasıl okuyacağını gösterir. Ziyaretçiler bu hâli görmez."
      footer={<Button variant="outline" onClick={onClose}>Kapat</Button>}
    >
      <div className="preview_modal">
        {site.locales.length > 1 && (
          <SegmentedControl ariaLabel="Önizleme dili" size="sm" value={locale} onChange={setLocale} options={site.locales.map((code) => ({ value: code, label: localeName(code) }))} />
        )}
        {(preview.isPending || schemaQuery.isPending) && <Skeleton variant="rectangle" height={220} radius="md" />}
        {preview.isError && <Alert variant="danger">{getErrorMessage(preview.error)}</Alert>}
        {preview.data && schemaQuery.data && (
          <>
            <p className="preview_modal_meta">
              <Badge size="sm" variant="info">{SOURCE_TEXT[preview.data.meta.source] ?? "Önizleme"}</Badge>
              <span>Önizleme bağlantısı {formatInZone(preview.data.expiresAt, site.timezone)} saatine kadar geçerli; pencereyi kapatınca iptal edilir.</span>
            </p>
            <div className="preview_modal_surface" lang={locale} dir={["ar", "he", "fa", "ur"].includes(locale) ? "rtl" : undefined}>
              <DescriptionList
                layout="vertical"
                items={fields.filter((field) => field.key in data).map((field) => ({ id: field.id, label: labelOf(field.label), value: displayValue(field, data[field.key]) }))}
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default PreviewModal;
