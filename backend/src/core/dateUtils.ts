export function differenceInMinutes(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 60_000);
}

export function utcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isUtcWeekendDate(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}