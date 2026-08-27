import type { KeyboardEvent } from "react";
import { useI18n } from "../../../i18n/useI18n";
import {
  daysInUtcMonth,
  isUtcWeekend,
  mondayPad,
  weekdayLabels,
  ymd,
} from "../../../lib/timesheet";
import type { DayEntry, EntryKind } from "./types";

function markColor(kinds: EntryKind[]): string | null {
  if (kinds.includes("shift")) return "var(--ts-shift)";
  if (kinds.includes("sick")) return "var(--ts-sick)";
  return null;
}

function addDays(dateYmd: string, delta: number): string {
  const d = new Date(`${dateYmd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function TimesheetCalendar({
  year,
  month,
  today,
  selectedYmd,
  byDate,
  compact,
  onSelect,
}: {
  year: number;
  month: number;
  today: string;
  selectedYmd: string;
  byDate: Map<string, DayEntry[]>;
  compact: boolean;
  onSelect: (dateYmd: string) => void;
}) {
  const { t, localeTag } = useI18n();
  const labels = weekdayLabels(localeTag);
  const pad = mondayPad(year, month);
  const dim = daysInUtcMonth(year, month);
  const cells: Array<{ dateYmd: string | null; day: number | null }> = [];
  for (let i = 0; i < pad; i++) cells.push({ dateYmd: null, day: null });
  for (let d = 1; d <= dim; d++) cells.push({ dateYmd: ymd(year, month, d), day: d });
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

  function cellStyle(dateYmd: string | null, desktop: boolean) {
    if (!dateYmd) {
      return { background: "transparent", boxShadow: "none", opacity: 1, cursor: "default" as const };
    }
    const weekend = isUtcWeekend(dateYmd);
    const isToday = dateYmd === today;
    const selected = dateYmd === selectedYmd;
    const futureEmpty = dateYmd > today && !byDate.has(dateYmd);
    let boxShadow = "none";
    if (desktop) {
      if (selected) boxShadow = "inset 0 0 0 1.5px var(--ts-ink)";
      else if (isToday) boxShadow = "inset 0 0 0 1px var(--ts-faint)";
    } else if (isToday) {
      boxShadow = "inset 0 0 0 1.5px var(--ts-ink)";
    }
    return {
      background: weekend ? "transparent" : "var(--ts-fill)",
      boxShadow: weekend && !selected && !isToday ? "inset 0 0 0 1px var(--ts-line)" : boxShadow,
      opacity: futureEmpty ? 0.5 : 1,
      cursor: "pointer" as const,
    };
  }

  function onKey(e: KeyboardEvent, dateYmd: string) {
    let next: string | null = null;
    if (e.key === "ArrowLeft") next = addDays(dateYmd, -1);
    if (e.key === "ArrowRight") next = addDays(dateYmd, 1);
    if (e.key === "ArrowUp") next = addDays(dateYmd, -7);
    if (e.key === "ArrowDown") next = addDays(dateYmd, 7);
    if (!next || !next.startsWith(monthPrefix)) return;
    e.preventDefault();
    onSelect(next);
    const el = document.getElementById(`cal-${next}`);
    el?.focus();
  }

  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  function renderCell(c: (typeof cells)[number], i: number) {
    const kinds: EntryKind[] = [];
    if (c.dateYmd) {
      for (const e of byDate.get(c.dateYmd) ?? []) kinds.push(e.kind);
    }
    const mark = c.dateYmd ? markColor(kinds) : null;
    const style = cellStyle(c.dateYmd, !compact);
    const label = c.dateYmd
      ? `${c.dateYmd}${kinds.length ? ` ${kinds.join(" ")}` : ""}`
      : undefined;
    return (
      <button
        key={`${compact ? "m" : "d"}-${c.dateYmd ?? `pad-${i}`}`}
        id={c.dateYmd ? `cal-${c.dateYmd}` : undefined}
        type="button"
        role="gridcell"
        aria-label={label}
        aria-selected={c.dateYmd === selectedYmd}
        aria-current={c.dateYmd === today ? "date" : undefined}
        disabled={!c.dateYmd}
        tabIndex={c.dateYmd === selectedYmd ? 0 : -1}
        onClick={() => c.dateYmd && onSelect(c.dateYmd)}
        onKeyDown={(e) => c.dateYmd && onKey(e, c.dateYmd)}
        className={
          compact
            ? "relative flex h-[54px] flex-col items-center justify-center rounded-xl"
            : "relative flex h-[78px] items-start rounded-2xl px-2.5 py-2"
        }
        style={style}
      >
        {c.day ? (
          <span className={compact ? "text-sm font-semibold" : "text-[13px] font-semibold"}>
            {c.day}
          </span>
        ) : null}
        {mark ? (
          <span
            className={
              compact
                ? "absolute bottom-2.5 left-1/2 size-[7px] -translate-x-1/2 rounded-full"
                : "absolute bottom-[11px] left-[11px] size-2 rounded-full"
            }
            style={{ background: mark }}
          />
        ) : null}
      </button>
    );
  }

  return (
    <div
      role="grid"
      aria-label={t("timesheet")}
      className={compact ? "mb-2 flex flex-col gap-1.5 xl:hidden" : "mb-2 hidden flex-col gap-1.5 xl:flex"}
    >
      <div role="row" className="grid grid-cols-7 gap-1.5">
        {labels.map((w, i) => (
          <div
            key={`${compact ? "m" : "d"}-${w}-${i}`}
            role="columnheader"
            className={
              compact
                ? "text-center text-[10px] font-semibold text-[var(--ts-faint)]"
                : "px-1 text-left text-[10.5px] font-semibold text-[var(--ts-faint)]"
            }
          >
            {w}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={`week-${wi}`} role="row" className="grid grid-cols-7 gap-1.5">
          {week.map((c, i) => renderCell(c, wi * 7 + i))}
        </div>
      ))}
    </div>
  );
}
