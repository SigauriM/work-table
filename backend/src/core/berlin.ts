/** Product timezone. Calendar days and form clock times are Europe/Berlin. */
export const APP_TZ = "Europe/Berlin";

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HM_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

const berlinFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type Civil = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseYmd(ymd: string): { year: number; month: number; day: number } {
  const m = YMD_RE.exec(ymd);
  if (!m) {
    throw new Error(`Invalid date ${ymd}`);
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date ${ymd}`);
  }
  return { year, month, day };
}

function parseHm(hm: string): { hour: number; minute: number; second: number } {
  const m = HM_RE.exec(hm);
  if (!m) {
    throw new Error(`Invalid time ${hm}`);
  }
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  const second = m[3] != null ? Number(m[3]) : 0;
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error(`Invalid time ${hm}`);
  }
  return { hour, minute, second };
}

function berlinCivil(instant: Date): Civil {
  const bag: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of berlinFmt.formatToParts(instant)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

function sameCivil(a: Civil, b: Civil): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second
  );
}

/** Calendar YMD in Europe/Berlin for an instant. */
export function berlinYmd(now: Date): string {
  const c = berlinCivil(now);
  return formatYmd(c.year, c.month, c.day);
}

export function berlinYearMonth(now: Date): { year: number; month: number } {
  const c = berlinCivil(now);
  return { year: c.year, month: c.month };
}

/** Prisma `@db.Date`: UTC midnight of the civil YMD, not Berlin-midnight-as-instant. */
export function ymdToDateColumn(ymd: string): Date {
  const { year, month, day } = parseYmd(ymd);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Civil YMD stored on a `@db.Date` / hire calendar DateTime (UTC midnight of that day). */
export function ymdFromDateColumn(d: Date): string {
  return formatYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * `date` is the Berlin calendar day of the shift start.
 * Overnight: endTime may land on the next Berlin day.
 */
export function assertShiftOnBerlinDate(dateYmd: string, startTime: Date, endTime: Date): void {
  parseYmd(dateYmd);
  if (berlinYmd(startTime) !== dateYmd) {
    throw new Error("startTime must fall on date in Europe/Berlin");
  }
  const endYmd = berlinYmd(endTime);
  if (endYmd !== dateYmd && endYmd !== nextBerlinYmd(dateYmd)) {
    throw new Error("endTime must fall on date or the next day in Europe/Berlin");
  }
}

/**
 * Civil clock in Europe/Berlin → real instant.
 * Spring gap (e.g. 2026-03-29 02:30) throws.
 * Fall fold (e.g. 2026-10-25 02:30): first occurrence (still CEST, +02).
 */
export function instantFromBerlin(ymd: string, hm: string): Date {
  const { year, month, day } = parseYmd(ymd);
  const { hour, minute, second } = parseHm(hm);
  const wanted: Civil = { year, month, day, hour, minute, second };
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const seen = new Set<number>();
  const matches: Date[] = [];
  for (const offsetMin of [60, 120]) {
    const ms = asUtc - offsetMin * 60_000;
    if (seen.has(ms)) continue;
    seen.add(ms);
    const candidate = new Date(ms);
    if (sameCivil(berlinCivil(candidate), wanted)) {
      matches.push(candidate);
    }
  }
  if (matches.length === 0) {
    throw new Error(`Invalid Berlin time ${ymd} ${hm}`);
  }
  matches.sort((a, b) => a.getTime() - b.getTime());
  return matches[0]!;
}

export function berlinPartsFromInstant(d: Date): { ymd: string; hm: string } {
  const c = berlinCivil(d);
  return {
    ymd: formatYmd(c.year, c.month, c.day),
    hm: `${pad2(c.hour)}:${pad2(c.minute)}`,
  };
}

/** Next calendar day (YMD arithmetic, not +24h on an instant). */
export function nextBerlinYmd(ymd: string): string {
  const { year, month, day } = parseYmd(ymd);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return formatYmd(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

export function prevBerlinYmd(ymd: string): string {
  const { year, month, day } = parseYmd(ymd);
  const prev = new Date(Date.UTC(year, month - 1, day - 1));
  return formatYmd(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate());
}

/** JS weekday: 0 Sunday … 6 Saturday. A calendar date’s weekday does not depend on zone. */
export function weekdayFromYmd(ymd: string): number {
  return ymdToDateColumn(ymd).getUTCDay();
}

export function isWeekendYmd(ymd: string): boolean {
  const dow = weekdayFromYmd(ymd);
  return dow === 0 || dow === 6;
}

/** Inclusive start / exclusive end for Prisma `@db.Date` month filters. */
export function monthDateRange(year: number, month: number): { gte: Date; lt: Date } {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid year-month ${year}-${month}`);
  }
  const gte = ymdToDateColumn(formatYmd(year, month, 1));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const lt = ymdToDateColumn(formatYmd(nextYear, nextMonth, 1));
  return { gte, lt };
}
