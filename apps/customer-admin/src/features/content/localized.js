import { getFieldType } from "@wmp/schema";

// Dile bağlı alanın değeri { dil: değer } haritasıdır; düzenleyiciler yalnız seçili dilin değerini görür ve yazar.
export const isLocalized = (field) => Boolean(field.localized && getFieldType(field.type)?.localizable);

export const readValue = (field, value, locale) => (isLocalized(field) ? value?.[locale] : value);

/** Yeni değeri yazar; boş değer alanı (dile bağlıysa yalnız o dili) kaldırır. Sonuç undefined ise alan silinmelidir. */
export const writeValue = (field, current, locale, next) => {
  const empty = next === null || next === undefined;
  if (!isLocalized(field)) return empty ? undefined : next;
  const map = { ...(current ?? {}) };
  if (empty) delete map[locale];
  else map[locale] = next;
  return Object.keys(map).length ? map : undefined;
};
