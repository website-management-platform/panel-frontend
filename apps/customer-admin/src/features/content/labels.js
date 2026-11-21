// İçerik ekranlarının ortak metinleri. Müşteri teknik terim görmez (şartname §12).
export const labelIn = (label, locale) => label?.[locale] ?? label?.tr ?? Object.values(label ?? {})[0] ?? "";

// Kayıt durumları. Yayın işaretçisi ayrıdır: isPublished + hasUnpublishedChanges. İnceleme/onay akışı yok (ADR-056).
export const STATUS_META = {
  DRAFT: { label: "Taslak", variant: "neutral" },
  PUBLISHED: { label: "Yayında", variant: "success" },
  TRASHED: { label: "Çöp kutusunda", variant: "warning" },
};

// Liste ve düzenleyicide gösterilecek rozetler: iş akışı durumu + yayın durumu birlikte okunur.
export const entryBadges = (entry) => {
  if (entry.status === "TRASHED") return [{ key: "status", ...STATUS_META.TRASHED }];
  const badges = [];
  if (entry.status !== "PUBLISHED" && entry.status !== "DRAFT") badges.push({ key: "status", ...STATUS_META[entry.status] });
  if (entry.isPublished) badges.push({ key: "live", ...STATUS_META.PUBLISHED });
  if (!entry.isPublished && entry.status === "DRAFT") badges.push({ key: "status", ...STATUS_META.DRAFT });
  if (entry.hasUnpublishedChanges) badges.push({ key: "changes", label: "Yayınlanmamış değişiklik", variant: "info", dot: false });
  if (entry.schedules?.length) badges.push({ key: "schedule", label: "Planlı", variant: "accent", dot: false });
  return badges;
};

export const TRANSLATION_META = {
  missing: { label: "çevrilmedi", variant: "warning" },
  outdated: { label: "kaynak değişti", variant: "info" },
  current: { label: "güncel", variant: "success" },
};

export const REVISION_SOURCE = {
  create: "Oluşturuldu",
  edit: "Düzenlendi",
  duplicate: "Kopyadan oluşturuldu",
  restore: "Eski revizyon geri yüklendi",
  migration: "Bölüm yapısı güncellendi",
  seed: "İlk içerik",
};

const languageNames = new Intl.DisplayNames(["tr"], { type: "language" });

export const localeName = (code) => {
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
};
