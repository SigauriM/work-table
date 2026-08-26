import { utcDateTimeToIso, utcShiftEndIso } from "./datetime";

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function utcTodayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export function ymd(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function daysInUtcMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Empty cells before day 1 when the week starts on Monday. */
export function mondayPad(year: number, month: number) {
  const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (dow + 6) % 7;
}

export function isUtcWeekend(dateYmd: string) {
  const dow = new Date(`${dateYmd}T00:00:00.000Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

export function addUtcMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function formatHours(hours: number) {
  if (!Number.isFinite(hours)) return "0 h";
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} h` : `${rounded.toFixed(1)} h`;
}

export function formatMonthShort(year: number, month: number) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatMonthLong(year: number, month: number) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatDayTitle(dateYmd: string) {
  const d = new Date(`${dateYmd}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatDayShort(dateYmd: string) {
  const d = new Date(`${dateYmd}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function weekdayNormHours(dateYmd: string, hoursPerDay: number) {
  if (!Number.isFinite(hoursPerDay) || hoursPerDay < 0) return 0;
  return isUtcWeekend(dateYmd) ? 0 : hoursPerDay;
}

/** Live shift length in hours from UTC clock fields, including overnight. */
export function countedShiftHours(
  dateYmd: string,
  start: string,
  end: string,
  breakStart: string,
  breakEnd: string,
) {
  if (!dateYmd || !start || !end) return 0;
  const startIso = utcDateTimeToIso(dateYmd, start);
  const endIso = utcShiftEndIso(dateYmd, start, end);
  let minutes =
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000;
  const hasB0 = breakStart.trim() !== "";
  const hasB1 = breakEnd.trim() !== "";
  if (hasB0 && hasB1) {
    const b0 = utcDateTimeToIso(dateYmd, breakStart);
    let b1 = utcDateTimeToIso(dateYmd, breakEnd);
    if (new Date(b1) <= new Date(b0)) {
      b1 = utcShiftEndIso(dateYmd, breakStart, breakEnd);
    }
    minutes -= (new Date(b1).getTime() - new Date(b0).getTime()) / 60000;
  }
  return Math.max(0, minutes) / 60;
}

export function dayDelta(hours: number, norm: number) {
  const diff = Math.round((hours - norm) * 10) / 10;
  if (Math.abs(diff) < 0.05) {
    return { text: "on norm", color: "var(--ts-mute)" };
  }
  const abs = Math.abs(diff).toFixed(1);
  if (diff > 0) {
    return {
      text: `+${abs} h overtime`,
      color: "var(--ts-over)",
    };
  }
  return {
    text: `${abs} h under`,
    color: "var(--ts-under)",
  };
}

export const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
