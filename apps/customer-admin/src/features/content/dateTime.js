import { zonedDateTimeToIso } from "@/utils/zonedDate";

// ISO anını site saat diliminde tarih ve saate ayırır (şartname §6: UTC saklanır, site saat diliminde gösterilir).
export const isoToZoned = (iso, timeZone) => {
  if (!iso) return { date: "", time: "" };
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
};

export const zonedToIso = (date, time, timeZone) => (date && time ? new Date(zonedDateTimeToIso(date, `${time}:00`, timeZone)).toISOString() : null);
