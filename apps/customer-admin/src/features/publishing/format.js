// Yayın zamanları site saat diliminde gösterilir (şartname §10: zaman dilimi site ayarından; UTC saklanır).
export const formatInZone = (iso, timeZone) => (iso
  ? new Intl.DateTimeFormat("tr-TR", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
  : "");

export const SCHEDULE_TYPE = { publish: "Yayınlama", unpublish: "Yayından kaldırma" };
