import {
  berlinPartsFromInstant,
  instantFromBerlin,
  nextBerlinYmd,
} from "./berlin";

/** Form clock in Europe/Berlin → ISO instant (not typed digits + Z). */
export function berlinDateTimeToIso(dateYmd: string, timeHm: string): string {
  return instantFromBerlin(dateYmd, timeHm).toISOString();
}

/** ISO instant → date/time fields for inputs, in Europe/Berlin. */
export function isoToBerlinDateTimeParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid ISO");
  }
  const parts = berlinPartsFromInstant(d);
  return { date: parts.ymd, time: parts.hm };
}

/** `@db.Date` / hire calendar JSON: UTC midnight of the civil YMD. */
export function calendarYmdFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid ISO");
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Overnight: if end clock is not after start on the same Berlin day,
 * end is the next calendar day at that clock time.
 */
export function berlinShiftEndIso(
  startDateYmd: string,
  startTimeHm: string,
  endTimeHm: string,
): string {
  const start = instantFromBerlin(startDateYmd, startTimeHm);
  let end = instantFromBerlin(startDateYmd, endTimeHm);
  if (end.getTime() <= start.getTime()) {
    end = instantFromBerlin(nextBerlinYmd(startDateYmd), endTimeHm);
  }
  return end.toISOString();
}
