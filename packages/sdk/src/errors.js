// Kararlı hata kodları (00-conventions.md). İstemci yanıt gövdesine değil koda göre davranır.
export class WmpError extends Error {
  constructor({ status = 0, code = "NETWORK_ERROR", message = "İstek tamamlanamadı.", requestId = null, retryAfter = null, errors = [], cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "WmpError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
    // Alan hataları (422): [{ path, code, message }]; form arayüzü alanın yanında gösterir.
    this.errors = errors;
  }
}

export const isWmpError = (error, code) => error instanceof WmpError && (!code || error.code === code);
