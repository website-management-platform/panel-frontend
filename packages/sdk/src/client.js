import { WmpError } from "./errors.js";

// Delivery istemcisi (şartname §16): yalnız GET; zaman aşımı, AbortSignal, sınırlı yeniden deneme (429/502/503/504 ve ağ hatası),
// ETag ile koşullu istek (304'te önbellekteki gövde), yanıt zarfı denetimi. Gizli anahtar yalnız sunucu ortamında verilir.
const RETRYABLE = new Set([429, 502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 8000;

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => {
    clearTimeout(timer);
    reject(signal.reason);
  }, { once: true });
});

const appendFilter = (params, filter) => Object.entries(filter ?? {}).forEach(([key, condition]) => {
  if (condition !== null && typeof condition === "object" && !Array.isArray(condition)) {
    Object.entries(condition).forEach(([op, value]) => params.append(`filter.${key}[${op}]`, Array.isArray(value) ? value.join(",") : String(value)));
  } else params.append(`filter.${key}`, Array.isArray(condition) ? condition.join(",") : String(condition));
});

const newKey = () => globalThis.crypto.randomUUID().replace(/-/g, "");

/** Bir başvurunun ekleri ve gönderimi için tek kullanımlık anahtar (en az 16 karakter). */
export const createSubmissionNonce = () => `${newKey()}${newKey()}`;

const assertEnvelope = (body) => {
  if (!body || typeof body !== "object" || !("data" in body) || typeof body.meta !== "object") {
    throw new WmpError({ status: 0, code: "INVALID_RESPONSE", message: "Sunucu beklenmeyen biçimde yanıt verdi." });
  }
  return body;
};

/**
 * createClient({ baseUrl, siteKey, locale, fetch, timeoutMs, retries, credential, previewToken, cache })
 * - baseUrl: API kökü (ör. https://api.ornek.com/api/v1)
 * - siteKey: sitenin public anahtarı (gizli değildir)
 * - credential: yalnız "özel" sitelerde, yalnız sunucuda (wmp_sk_…)
 * - previewToken: önizleme belirteci (pv_…); verilirse istekler /preview yoluna gider ve önbelleğe alınmaz
 * - cache: false ile ETag önbelleği kapatılır
 */
export const createClient = ({ baseUrl, siteKey, locale, fetch: fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, retries = 2, credential = null, previewToken = null, cache = true } = {}) => {
  if (!baseUrl || !siteKey) throw new TypeError("baseUrl ve siteKey zorunlu.");
  if (credential && typeof window !== "undefined") throw new TypeError("Gizli anahtar tarayıcıda kullanılamaz; sunucu tarafında verin.");
  const root = `${baseUrl.replace(/\/$/, "")}/${previewToken ? "preview" : "delivery"}/sites/${encodeURIComponent(siteKey)}`;
  const etags = new Map();
  let lastReleaseVersion = null;

  const request = async (path, params = new URLSearchParams(), { signal } = {}) => {
    const url = `${root}${path}${params.toString() ? `?${params}` : ""}`;
    const headers = { Accept: "application/json" };
    if (previewToken) headers.Authorization = `Bearer ${previewToken}`;
    else if (credential) headers.Authorization = `Bearer ${credential}`;
    const cached = cache && !previewToken ? etags.get(url) : null;
    if (cached) headers["If-None-Match"] = cached.etag;

    for (let attempt = 0; ; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new WmpError({ code: "TIMEOUT", message: "İstek zaman aşımına uğradı." })), timeoutMs);
      const onAbort = () => controller.abort(signal.reason);
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const response = await fetchImpl(url, { headers, signal: controller.signal });
        if (response.status === 304 && cached) return cached.body;
        const text = await response.text();
        const body = text ? JSON.parse(text) : null;
        if (!response.ok) {
          const retryAfter = Number(response.headers.get("Retry-After")) || null;
          if (RETRYABLE.has(response.status) && attempt < retries) {
            await sleep(retryAfter ? retryAfter * 1000 : 300 * 2 ** attempt, signal);
            continue;
          }
          throw new WmpError({ status: response.status, code: body?.code ?? "HTTP_ERROR", message: body?.detail ?? body?.title ?? `HTTP ${response.status}`, requestId: body?.requestId ?? response.headers.get("X-Request-Id"), retryAfter });
        }
        const envelope = assertEnvelope(body);
        lastReleaseVersion = envelope.meta.releaseVersion ?? lastReleaseVersion;
        const etag = response.headers.get("ETag");
        if (cache && !previewToken && etag) etags.set(url, { etag, body: envelope });
        return envelope;
      } catch (error) {
        if (error instanceof WmpError && error.code !== "TIMEOUT") throw error;
        if (signal?.aborted) throw signal.reason ?? error;
        if (attempt < retries) {
          await sleep(300 * 2 ** attempt, signal);
          continue;
        }
        throw error instanceof WmpError ? error : new WmpError({ code: "NETWORK_ERROR", message: "Sunucuya ulaşılamadı.", cause: error });
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    }
  };

  // Form uçları her zaman delivery yolundadır (önizleme belirteci form göndermez). Yazma isteği Idempotency-Key taşır;
  // bu yüzden ağ hatası ve 429/502/503/504 sonrası yeniden deneme çift başvuru üretmez.
  const formRoot = `${baseUrl.replace(/\/$/, "")}/delivery/sites/${encodeURIComponent(siteKey)}/forms`;
  const send = async (method, path, { body, headers: extra = {}, signal } = {}) => {
    const headers = { Accept: "application/json", ...extra };
    if (credential) headers.Authorization = `Bearer ${credential}`;
    const isBinary = body instanceof Uint8Array || (typeof Blob !== "undefined" && body instanceof Blob) || (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer);
    if (body !== undefined && !isBinary) headers["Content-Type"] = "application/json";
    for (let attempt = 0; ; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new WmpError({ code: "TIMEOUT", message: "İstek zaman aşımına uğradı." })), timeoutMs);
      const onAbort = () => controller.abort(signal.reason);
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const response = await fetchImpl(`${formRoot}${path}`, { method, headers, body: body === undefined ? undefined : isBinary ? body : JSON.stringify(body), signal: controller.signal });
        const text = await response.text();
        const payload = text ? JSON.parse(text) : null;
        if (!response.ok) {
          const retryAfter = Number(response.headers.get("Retry-After")) || null;
          if (RETRYABLE.has(response.status) && attempt < retries && (method === "GET" || headers["Idempotency-Key"])) {
            await sleep(retryAfter ? retryAfter * 1000 : 300 * 2 ** attempt, signal);
            continue;
          }
          throw new WmpError({ status: response.status, code: payload?.code ?? "HTTP_ERROR", message: payload?.detail ?? payload?.title ?? `HTTP ${response.status}`, requestId: payload?.requestId ?? response.headers.get("X-Request-Id"), retryAfter, errors: payload?.errors ?? [] });
        }
        return payload;
      } catch (error) {
        if (error instanceof WmpError && error.code !== "TIMEOUT") throw error;
        if (signal?.aborted) throw signal.reason ?? error;
        if (attempt < retries && (method === "GET" || headers["Idempotency-Key"])) {
          await sleep(300 * 2 ** attempt, signal);
          continue;
        }
        throw error instanceof WmpError ? error : new WmpError({ code: "NETWORK_ERROR", message: "Sunucuya ulaşılamadı.", cause: error });
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    }
  };

  const withLocale = (options = {}) => {
    const params = new URLSearchParams();
    const value = options.locale ?? locale;
    if (value) params.set("locale", value);
    return params;
  };

  return {
    /** Site adı, diller, ayarlar, etkin manifest sürümü. */
    getSiteInfo: (options = {}) => request("/info", withLocale(options), options),
    /** Modülün yayındaki kayıtları: { data, meta: { nextCursor } }. filter: { alan: değer } veya { alan: { gte: 3 } }. */
    getCollection: (moduleKey, options = {}) => {
      const params = withLocale(options);
      if (options.limit) params.set("limit", String(options.limit));
      if (options.cursor) params.set("cursor", options.cursor);
      if (options.sort) params.set("sort", options.sort);
      if (options.fields) params.set("fields", options.fields.join(","));
      if (options.include) params.set("include", options.include.join(","));
      appendFilter(params, options.filter);
      return request(`/content/${encodeURIComponent(moduleKey)}`, params, options);
    },
    getSingleton: (moduleKey, options = {}) => request(`/content/${encodeURIComponent(moduleKey)}/singleton`, withLocale(options), options),
    getEntry: (moduleKey, entryId, options = {}) => {
      const params = withLocale(options);
      if (options.include) params.set("include", options.include.join(","));
      return request(`/content/${encodeURIComponent(moduleKey)}/${encodeURIComponent(entryId)}`, params, options);
    },
    /** Yol çözme: { type: page | entry | redirect }. Bulunamazsa NOT_FOUND, kaldırılmışsa GONE hatası. */
    resolvePage: (path, options = {}) => {
      const params = withLocale(options);
      params.set("path", path);
      return request("/pages/resolve", params, options);
    },
    /** Sayfa + ayarlar + menüler tek tutarlı okumada (şartname §25.4). */
    getPageBundle: (path, options = {}) => {
      const params = withLocale(options);
      params.set("path", path);
      return request("/pages/bundle", params, options);
    },
    getMenu: (location, options = {}) => request(`/menus/${encodeURIComponent(location)}`, withLocale(options), options),
    getSitemap: (options = {}) => request("/sitemap", new URLSearchParams(), options),
    getRedirects: (options = {}) => request("/redirects", new URLSearchParams(), options),
    getRobots: (options = {}) => request("/robots", new URLSearchParams(), options),
    /**
     * Farklı isteklerin aynı yayın sürümünü görmesi garanti değildir (şartname §25.4). task birden çok isteği çalıştırır;
     * yanıtların releaseVersion değeri farklıysa en çok attempts kez yeniden denenir.
     */
    consistent: async (task, { attempts = 2 } = {}) => {
      for (let attempt = 0; ; attempt += 1) {
        const results = await task();
        const versions = new Set(results.map((item) => item?.meta?.releaseVersion).filter((value) => value !== undefined));
        if (versions.size <= 1 || attempt >= attempts) return results;
      }
    },
    /** Yayındaki form tanımı: alanlar, onay metni ve sürümü, honeypot alan adı. */
    getForm: (formKey, options = {}) => send("GET", `/${encodeURIComponent(formKey)}?${withLocale(options)}`, options),
    /**
     * Başvuru gönderir. input: { formVersion, values, consent: { accepted, version }, marketingConsent?, honeypot?, nonce?, locale? }.
     * Yanıt yalnız onay kodu ve mesajdır. Aynı gönderim yeniden denenirse aynı idempotencyKey verilmelidir.
     */
    submitForm: (formKey, input, { idempotencyKey = newKey(), signal } = {}) => send("POST", `/${encodeURIComponent(formKey)}/submissions`, {
      body: {
        formVersion: input.formVersion,
        locale: input.locale ?? locale,
        values: input.values,
        consent: input.consent,
        ...(input.marketingConsent !== undefined ? { marketingConsent: input.marketingConsent } : {}),
        ...(input.honeypot ? { website: input.honeypot } : {}),
        ...(input.nonce ? { nonce: input.nonce } : {}),
      },
      headers: { "Idempotency-Key": idempotencyKey },
      signal,
    }),
    /**
     * Form eki: niyet → bayt → tamamla. nonce aynı başvurunun bütün eklerinde ve gönderimde aynı olmalıdır (createSubmissionNonce).
     * Döner: { uploadId, status, fileName, size }; başvuruda values[fieldKey] = [uploadId].
     */
    uploadFormFile: async (formKey, { formVersion, fieldKey, file, fileName = file?.name, nonce }, { signal } = {}) => {
      const bytes = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());
      const key = encodeURIComponent(formKey);
      const intent = await send("POST", `/${key}/uploads`, { body: { formVersion, fieldKey, fileName, size: bytes.length, nonce }, headers: { "Idempotency-Key": newKey() }, signal });
      await send("PUT", `/${key}/uploads/${intent.data.uploadId}/content`, { body: bytes, headers: { "Content-Type": "application/octet-stream", "X-Upload-Nonce": nonce }, signal });
      const done = await send("POST", `/${key}/uploads/${intent.data.uploadId}/finalize`, { body: { nonce }, signal });
      return done.data;
    },
    get releaseVersion() {
      return lastReleaseVersion;
    },
  };
};
