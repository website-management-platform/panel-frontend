import { useEffect, useId, useRef, useState } from "react";
import { createSubmissionNonce, isWmpError } from "@wmp/sdk";
import { clientFor } from "../../sites";
import "./form_section.scss";

const FORMAT_ACCEPT = { pdf: ".pdf,application/pdf", docx: ".docx", jpeg: ".jpg,.jpeg,image/jpeg", png: ".png,image/png" };
const INPUT_TYPE = { email: "email", phone: "tel", date: "date", text: "text" };

const Field = ({ field, value, error, uploading, onChange, onFile, formId }) => {
  const id = `${formId}-${field.key}`;
  const describedBy = [(field.help || field.type === "file") && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const common = { id, name: field.key, required: field.required, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy };
  const label = <label htmlFor={id}>{field.label}{field.required && <span aria-hidden="true"> *</span>}</label>;
  let control;
  if (field.type === "textarea") control = <textarea {...common} rows={5} maxLength={field.maxLength} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />;
  else if (field.type === "select") {
    control = (
      <select {...common} value={value ?? ""} onChange={(event) => onChange(event.target.value || undefined)}>
        <option value="">Seçin</option>
        {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  } else if (field.type === "checkbox") {
    return (
      <div className="form_section_check">
        <input type="checkbox" {...common} checked={value === true} onChange={(event) => onChange(event.target.checked)} />
        {label}
        {error && <p className="form_section_error" id={`${id}-error`}>{error}</p>}
      </div>
    );
  } else if (field.type === "file") {
    control = (
      <input type="file" {...common} accept={field.allowedFormats.map((format) => FORMAT_ACCEPT[format]).join(",")} disabled={uploading}
        onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
    );
  } else {
    control = <input type={INPUT_TYPE[field.type] ?? "text"} {...common} maxLength={field.maxLength} autoComplete={field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.key === "name" ? "name" : undefined} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />;
  }
  return (
    <div className="form_section_field">
      {label}
      {(field.help || field.type === "file") && <p className="form_section_help" id={`${id}-help`}>{field.help ?? `En çok ${Math.round(field.maxBytes / 1024 / 1024)} MB.`}</p>}
      {control}
      {uploading && <p className="form_section_help" role="status">Dosya yükleniyor…</p>}
      {error && <p className="form_section_error" id={`${id}-error`}>{error}</p>}
    </div>
  );
};

/**
 * Form bölümü (13-forms.md §4): tanımı SDK ile okur ve kendi arayüzüyle çizer. Doğrulama sunucudadır; alan hataları
 * alanın yanında ve formun başındaki özette gösterilir. Gönderim yeniden denemeye karşı aynı idempotency anahtarını kullanır.
 */
const FormSection = ({ section, site, locale }) => {
  const formId = useId().replace(/:/g, "");
  const [definition, setDefinition] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [values, setValues] = useState({});
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [nonce] = useState(createSubmissionNonce);
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID().replace(/-/g, ""));
  const summaryRef = useRef(null);
  const successRef = useRef(null);
  const client = clientFor(site, locale);

  useEffect(() => {
    if (!section.form) return undefined;
    const controller = new AbortController();
    client.getForm(section.form.key, { signal: controller.signal })
      .then((body) => setDefinition(body.data))
      .catch((error) => { if (!controller.signal.aborted) setLoadError(error); });
    return () => controller.abort();
  }, [client, section.form]);

  useEffect(() => {
    if (status === "invalid") summaryRef.current?.focus();
    if (status === "sent") successRef.current?.focus();
  }, [status]);

  if (!section.form) return null;

  const setValue = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setAttemptKey(crypto.randomUUID().replace(/-/g, ""));
  };

  const upload = async (field, file) => {
    if (!file) return setValue(field.key, undefined);
    setUploading(field.key);
    setErrors((current) => ({ ...current, [field.key]: undefined }));
    try {
      const done = await client.uploadFormFile(definition.key, { formVersion: definition.version, fieldKey: field.key, file, nonce });
      setValue(field.key, [done.uploadId]);
    } catch (error) {
      setErrors((current) => ({ ...current, [field.key]: isWmpError(error) ? error.errors?.[0]?.message ?? error.message : "Dosya yüklenemedi." }));
      setValue(field.key, undefined);
    } finally {
      setUploading(null);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setStatus("sending");
    try {
      const body = await client.submitForm(definition.key, {
        formVersion: definition.version,
        values,
        consent: { accepted: consent, version: definition.consent.version },
        ...(definition.marketingConsent ? { marketingConsent: marketing } : {}),
        honeypot,
        nonce,
      }, { idempotencyKey: attemptKey });
      setResult(body.data);
      setStatus("sent");
    } catch (error) {
      if (isWmpError(error) && error.status === 422) {
        setErrors(Object.fromEntries(error.errors.map((item) => [item.path.replace(/^values\./, "").split(".")[0], item.message])));
        setStatus("invalid");
      } else if (isWmpError(error) && error.code === "FORM_VERSION_CHANGED") {
        setStatus("changed");
      } else {
        setStatus("failed");
        setLoadError(error);
      }
    }
  };

  const errorList = Object.entries(errors).filter(([, message]) => message);
  return (
    <section className={`section form_section form_section_${section.variant}`} id={section.anchor} aria-labelledby={`${formId}-title`}>
      <div className="form_section_intro">
        {section.eyebrow && <p className="section_eyebrow">{section.eyebrow}</p>}
        <h2 id={`${formId}-title`}>{section.heading || definition?.title}</h2>
        {section.intro && <p className="section_lead">{section.intro}</p>}
      </div>
      <div className="form_section_body">
        {!definition && !loadError && <p role="status">Form yükleniyor…</p>}
        {loadError && status !== "failed" && <p role="alert">Form şu an kullanılamıyor. Lütfen daha sonra deneyin.</p>}
        {status === "sent" && (
          <div className="form_section_success" ref={successRef} tabIndex={-1} role="status">
            <p><strong>{result?.message ?? "Başvurunuz alındı."}</strong></p>
            <p>Başvuru kodunuz: <code>{result?.confirmationId}</code></p>
          </div>
        )}
        {definition && status !== "sent" && (
          <form noValidate onSubmit={submit} className="form_section_form">
            {status === "invalid" && errorList.length > 0 && (
              <div className="form_section_summary" ref={summaryRef} tabIndex={-1} role="alert">
                <p><strong>Lütfen şu alanları düzeltin:</strong></p>
                <ul>
                  {errorList.map(([key, message]) => {
                    const field = definition.fields.find((item) => item.key === key);
                    return <li key={key}><a href={`#${formId}-${key === "consent" ? "consent" : key}`}>{field?.label ?? "Onay"}: {message}</a></li>;
                  })}
                </ul>
              </div>
            )}
            {status === "changed" && <p role="alert">Form güncellendi. Sayfayı yenileyip yeniden gönderin.</p>}
            {status === "failed" && <p role="alert">Gönderilemedi. Bağlantınızı kontrol edip yeniden deneyin.</p>}
            {definition.fields.map((field) => (
              <Field key={field.key} field={field} formId={formId} value={values[field.key]} error={errors[field.key]} uploading={uploading === field.key}
                onChange={(value) => setValue(field.key, value)} onFile={(file) => upload(field, file)} />
            ))}
            {/* Bal küpü (honeypot): insanlar görmez ve doldurmaz; dolu gelen başvuru spam sayılır. */}
            <div className="form_section_trap" aria-hidden="true">
              <label htmlFor={`${formId}-${definition.honeypotField}`}>Web sitesi</label>
              <input id={`${formId}-${definition.honeypotField}`} name={definition.honeypotField} tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
            </div>
            <div className="form_section_check">
              <input type="checkbox" id={`${formId}-consent`} required checked={consent} aria-invalid={errors.consent ? true : undefined} aria-describedby={errors.consent ? `${formId}-consent-error` : undefined} onChange={(event) => setConsent(event.target.checked)} />
              <label htmlFor={`${formId}-consent`}>
                {definition.consent.text}
                {definition.consent.privacyUrl && <> <a href={definition.consent.privacyUrl} target="_blank" rel="noopener noreferrer">Aydınlatma metni<span className="form_section_sr"> (yeni sekmede açılır)</span></a></>}
                <span aria-hidden="true"> *</span>
              </label>
              {errors.consent && <p className="form_section_error" id={`${formId}-consent-error`}>{errors.consent}</p>}
            </div>
            {definition.marketingConsent && (
              <div className="form_section_check">
                <input type="checkbox" id={`${formId}-marketing`} checked={marketing} onChange={(event) => setMarketing(event.target.checked)} />
                <label htmlFor={`${formId}-marketing`}>{definition.marketingConsent.text}</label>
              </div>
            )}
            <button type="submit" className="section_button section_button_primary" disabled={status === "sending" || Boolean(uploading)}>
              {status === "sending" ? "Gönderiliyor…" : "Gönder"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
};

export default FormSection;
