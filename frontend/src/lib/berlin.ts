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

function parseYmd(ymd: string): { year: number; month: number; day: number } {
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

export function berlinYmd(now: Date = new Date()): string {
  const c = berlinCivil(now);
  return formatYmd(c.year, c.month, c.day);
}

export function berlinYearMonth(now: Date = new Date()): { year: number; month: number } {
  const c = berlinCivil(now);
  return { year: c.year, month: c.month };
}

/**
 * Civil clock in Europe/Berlin → real instant.
 * Spring gap throws. Fall fold: first occurrence (CEST, +02).
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

export function nextBerlinYmd(ymd: string): string {
  const { year, month, day } = parseYmd(ymd);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return formatYmd(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}
