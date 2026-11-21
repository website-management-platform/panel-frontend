import { FiAlertTriangle, FiCheck, FiRotateCcw } from "react-icons/fi";
import Button from "@/components/Button";
import Progress from "@/components/Progress";
import { formatBytes } from "@/utils/format";
import "./upload_queue.scss";

const STEP_TEXT = {
  queued: "Sırada",
  starting: "Başlıyor",
  uploading: "Yükleniyor",
  finalizing: "Denetleniyor",
  done: "Yüklendi; işleniyor",
  rejected: "Reddedildi",
  error: "Yüklenemedi",
};

/** Yükleme listesi: ilerleme, denetim adımı, ret gerekçesi ve tekrar deneme. Durum değişimleri ekran okuyucuya bildirilir. */
const UploadQueue = ({ items, onRetry, onClear }) => {
  if (items.length === 0) return null;
  const finished = items.some((item) => ["done", "rejected"].includes(item.status));
  return (
    <section className="upload_queue" aria-label="Yüklemeler">
      <ul className="upload_queue_list" aria-live="polite">
        {items.map((item) => (
          <li key={item.id} className="upload_queue_item">
            <div className="upload_queue_head">
              <span className="upload_queue_name">{item.file.name}</span>
              <span className="upload_queue_size">{formatBytes(item.file.size)}</span>
            </div>
            {["uploading", "starting", "queued"].includes(item.status) && <Progress value={Math.round(item.progress * 100)} size="sm" ariaLabel={`${item.file.name} yükleniyor`} />}
            <p className={`upload_queue_status upload_queue_status_${item.status}`}>
              {item.status === "done" && <FiCheck aria-hidden="true" />}
              {["rejected", "error"].includes(item.status) && <FiAlertTriangle aria-hidden="true" />}
              {STEP_TEXT[item.status]}{item.error ? `: ${item.error}` : ""}
              {item.status === "error" && <Button variant="link" size="sm" icon={FiRotateCcw} onClick={() => onRetry(item.id)}>Tekrar dene</Button>}
            </p>
          </li>
        ))}
      </ul>
      {finished && <Button variant="ghost" size="sm" onClick={onClear}>Bitenleri listeden kaldır</Button>}
    </section>
  );
};

export default UploadQueue;
