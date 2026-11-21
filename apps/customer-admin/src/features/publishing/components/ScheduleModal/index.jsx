import { useState } from "react";
import { FiClock } from "react-icons/fi";
import Alert from "@/components/Alert";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import RadioGroup from "@/components/RadioGroup";
import { getErrorMessage } from "@/api/errors";
import { isoToZoned, zonedToIso } from "../../../content/dateTime";
import { SCHEDULE_TYPE, formatInZone } from "../../format";
import "./schedule_modal.scss";

// Varsayılan: bir sonraki tam saat (site saat diliminde).
const nextHour = (timeZone) => isoToZoned(new Date(Math.ceil((Date.now() + 5 * 60 * 1000) / 3600000) * 3600000).toISOString(), timeZone);

/**
 * Yayın planı (şartname §10): tarih ve saat site saat diliminde girilir, sunucuya UTC anı gider.
 * types: izin verilen plan türleri (publish/unpublish). Plan, o anki revizyonu sabitler.
 */
const ScheduleModal = ({ open, onClose, timeZone, types = ["publish"], onSubmit, pending, error, title = "Yayını planla", description }) => {
  const [type, setType] = useState(types[0]);
  const [{ date, time }, setWhen] = useState(() => nextHour(timeZone));
  // Arayüz denetimi pencerenin açıldığı ana göredir; kesin denetim sunucudadır.
  const [openedAt] = useState(() => Date.now());
  const iso = zonedToIso(date, time, timeZone);
  const tooSoon = iso && Date.parse(iso) < openedAt + 60 * 1000;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description ?? "Seçtiğiniz anda, şu an kayıtlı olan içerik yayınlanır. Sonradan yaptığınız değişiklikler plana girmez."}
      icon={FiClock}
      busy={pending}
      footer={(
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>Vazgeç</Button>
          <Button loading={pending} disabled={!iso || tooSoon} onClick={() => onSubmit({ type, at: iso })}>Planla</Button>
        </>
      )}
    >
      <div className="schedule_modal">
        {types.length > 1 && (
          <RadioGroup
            label="İşlem"
            value={type}
            onChange={setType}
            options={types.map((value) => ({ value, label: SCHEDULE_TYPE[value] }))}
          />
        )}
        <div className="schedule_modal_when">
          <Input label="Tarih" type="date" required value={date} onChange={(event) => setWhen({ date: event.target.value, time })} />
          <Input label="Saat" type="time" required value={time} onChange={(event) => setWhen({ date, time: event.target.value })} />
        </div>
        <p className="schedule_modal_hint">
          Saat dilimi: {timeZone}.{iso && !tooSoon && <> Uygulanacağı an: <strong>{formatInZone(iso, timeZone)}</strong>.</>}
        </p>
        {tooSoon && <Alert variant="warning" size="compact">Plan en az bir dakika sonrası için yapılabilir.</Alert>}
        {error && <Alert variant="danger" size="compact">{getErrorMessage(error)}</Alert>}
      </div>
    </Modal>
  );
};

export default ScheduleModal;
