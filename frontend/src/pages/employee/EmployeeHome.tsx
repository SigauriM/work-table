import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { createShift, deleteShift, listShifts, updateShift } from "../../api/shifts";
import { createSickDay, deleteSickDay, listSickDays } from "../../api/sickDays";
import { meStats } from "../../api/stats";
import { useAuth } from "../../auth/useAuth";
import { AppShell } from "../../components/AppShell";
import { employeeNav } from "../../components/nav";
import { useYearMonth } from "../../hooks/useYearMonth";
import {
  berlinDateTimeToIso,
  berlinShiftEndIso,
  calendarYmdFromIso,
  isoToBerlinDateTimeParts,
} from "../../lib/datetime";
import {
  WEEKDAYS,
  addUtcMonth,
  countedShiftHours,
  dayDelta,
  daysInUtcMonth,
  formatDayShort,
  formatDayTitle,
  formatHours,
  formatMonthLong,
  formatMonthShort,
  isUtcWeekend,
  mondayPad,
  utcTodayYmd,
  weekdayNormHours,
  ymd,
} from "../../lib/timesheet";
import type { EmployeeStats, Shift, SickDay } from "../../types/api";
import { TimeField } from "../../components/TimeField";
import { inputClass } from "../../ui";

type EntryKind = "shift" | "sick";
type FormKind = EntryKind | "vacation" | "off";

type DayEntry =
  | { kind: "shift"; shift: Shift; hours: number }
  | { kind: "sick"; sick: SickDay; hours: number };

const emptyTimes = {
  startTime: "08:00",
  endTime: "17:00",
  breakStart: "",
  breakEnd: "",
  note: "",
};

function markColor(kinds: EntryKind[]): string | null {
  if (kinds.includes("shift")) return "var(--ts-shift)";
  if (kinds.includes("sick")) return "var(--ts-sick)";
  return null;
}

function sickHours(day: SickDay, fallback: number) {
  const n = Number(day.creditedHours);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default function EmployeeHome() {
  const { user } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const { year, month, setYearMonth } = useYearMonth();
  const today = utcTodayYmd();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sickDays, setSickDays] = useState<SickDay[]>([]);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileDayOpen, setMobileDayOpen] = useState(false);

  const firstYmd = ymd(year, month, 1);
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const [selectedYmd, setSelectedYmd] = useState(today.startsWith(firstYmd.slice(0, 7)) ? today : firstYmd);

  const [formKind, setFormKind] = useState<FormKind>("shift");
  const [form, setForm] = useState(emptyTimes);
  const [editing, setEditing] = useState<{ kind: EntryKind; id: string } | null>(null);
  const [pending, setPending] = useState(false);

  if (!selectedYmd.startsWith(monthPrefix)) {
    setSelectedYmd(today.startsWith(monthPrefix) ? today : firstYmd);
    setMobileDayOpen(false);
    setEditing(null);
    setForm(emptyTimes);
    setFormKind("shift");
  }

  const load = useCallback(async (isCancelled?: () => boolean) => {
    if (!employeeId) return;
    try {
      const [s, d, st] = await Promise.all([
        listShifts({ employeeId, year, month }),
        listSickDays({ employeeId, year, month }),
        meStats(year, month),
      ]);
      if (isCancelled?.()) return;
      setShifts(s);
      setSickDays(d);
      setStats(st);
      setError(null);
    } catch (err) {
      if (isCancelled?.()) return;
      setShifts([]);
      setSickDays([]);
      setStats(null);
      setError(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      if (!isCancelled?.()) setLoading(false);
    }
  }, [employeeId, year, month, setLoading, setError, setShifts, setSickDays, setStats]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await load(() => cancelled);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const dayNormHours = (() => {
    const n = Number(stats?.hoursPerDay);
    return Number.isFinite(n) && n > 0 ? n : 8;
  })();

  const byDate = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    const add = (key: string, entry: DayEntry) => {
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    };
    for (const s of shifts) {
      const date = calendarYmdFromIso(s.date);
      add(date, { kind: "shift", shift: s, hours: s.workedMinutes / 60 });
    }
    for (const d of sickDays) {
      const date = calendarYmdFromIso(d.date);
      add(date, { kind: "sick", sick: d, hours: sickHours(d, dayNormHours) });
    }
    return map;
  }, [shifts, sickDays, dayNormHours]);

  const selectedEntries = byDate.get(selectedYmd) ?? [];
  const selectedHours = selectedEntries.reduce((sum, e) => sum + e.hours, 0);
  const selectedNorm = weekdayNormHours(selectedYmd, dayNormHours);
  const delta = dayDelta(selectedHours, selectedNorm);
  const previewHours = countedShiftHours(
    selectedYmd,
    form.startTime,
    form.endTime,
    form.breakStart,
    form.breakEnd,
  );

  const worked = Number(stats?.workedHours ?? 0);
  const norm = Number(stats?.normHours ?? 0);
  const pct = norm > 0 ? Math.min(100, Math.max(0, (worked / norm) * 100)) : 0;

  function chooseType(kind: FormKind) {
    setFormKind(kind);
    if (editing && kind !== editing.kind) {
      setEditing(null);
      setForm(emptyTimes);
    }
  }

  function openDay(dateYmd: string) {
    setSelectedYmd(dateYmd);
    setEditing(null);
    setForm(emptyTimes);
    setFormKind("shift");
    setMobileDayOpen(true);
  }

  function closeMobileDay() {
    setMobileDayOpen(false);
    setEditing(null);
    setForm(emptyTimes);
    setFormKind("shift");
  }

  function startEdit(entry: DayEntry) {
    if (entry.kind === "shift") {
      const s = entry.shift;
      setFormKind("shift");
      setEditing({ kind: "shift", id: s.id });
      setForm({
        startTime: isoToBerlinDateTimeParts(s.startTime).time,
        endTime: isoToBerlinDateTimeParts(s.endTime).time,
        breakStart: s.breakStart ? isoToBerlinDateTimeParts(s.breakStart).time : "",
        breakEnd: s.breakEnd ? isoToBerlinDateTimeParts(s.breakEnd).time : "",
        note: s.note ?? "",
      });
      return;
    }
    setFormKind("sick");
    setEditing({ kind: "sick", id: entry.sick.id });
    setForm({ ...emptyTimes, note: entry.sick.note ?? "" });
  }

  async function onDelete(entry: DayEntry) {
    setError(null);
    try {
      if (entry.kind === "shift") await deleteShift(entry.shift.id);
      else await deleteSickDay(entry.sick.id);
      if (editing?.id === (entry.kind === "shift" ? entry.shift.id : entry.sick.id)) {
        setEditing(null);
        setForm(emptyTimes);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!employeeId || (formKind !== "shift" && formKind !== "sick")) return;
    setPending(true);
    setError(null);
    try {
      if (formKind === "shift") {
        if (!form.startTime || !form.endTime) {
          throw new ApiError(400, "Start and end are required");
        }
        const hasB0 = form.breakStart.trim() !== "";
        const hasB1 = form.breakEnd.trim() !== "";
        if (hasB0 !== hasB1) {
          throw new ApiError(400, "breakStart and breakEnd must both be set or both empty");
        }
        const body = {
          employeeId,
          date: selectedYmd,
          startTime: berlinDateTimeToIso(selectedYmd, form.startTime),
          endTime: berlinShiftEndIso(selectedYmd, form.startTime, form.endTime),
          breakStart: hasB0 ? berlinDateTimeToIso(selectedYmd, form.breakStart) : null,
          breakEnd: hasB1 ? berlinDateTimeToIso(selectedYmd, form.breakEnd) : null,
          note: form.note.trim() || undefined,
        };
        if (editing?.kind === "shift") {
          const { employeeId: _omit, ...patch } = body;
          void _omit;
          await updateShift(editing.id, patch);
        } else {
          await createShift(body);
        }
      } else if (editing?.kind === "sick") {
        await deleteSickDay(editing.id);
        await createSickDay({
          employeeId,
          date: selectedYmd,
          note: form.note.trim() || undefined,
        });
      } else {
        await createSickDay({
          employeeId,
          date: selectedYmd,
          note: form.note.trim() || undefined,
        });
      }
      setEditing(null);
      setForm(emptyTimes);
      setFormKind("shift");
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Save failed",
      );
    } finally {
      setPending(false);
    }
  }

  const pad = mondayPad(year, month);
  const dim = daysInUtcMonth(year, month);
  const cells: Array<{ dateYmd: string | null; day: number | null }> = [];
  for (let i = 0; i < pad; i++) cells.push({ dateYmd: null, day: null });
  for (let d = 1; d <= dim; d++) cells.push({ dateYmd: ymd(year, month, d), day: d });

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

  const typePills: { id: FormKind; label: string; enabled: boolean }[] = [
    { id: "shift", label: "Shift", enabled: true },
    { id: "sick", label: "Sick", enabled: true },
    { id: "vacation", label: "Vacation", enabled: false },
    { id: "off", label: "Time off", enabled: false },
  ];

  const dayPanel = (
    <DayPanel
      dateYmd={selectedYmd}
      today={today}
      entries={selectedEntries}
      hours={selectedHours}
      norm={selectedNorm}
      delta={delta}
      formKind={formKind}
      form={form}
      previewHours={previewHours}
      typePills={typePills}
      editing={editing}
      pending={pending}
      showBack
      onBack={closeMobileDay}
      onType={chooseType}
      onForm={setForm}
      onEdit={startEdit}
      onDelete={onDelete}
      onSubmit={onSubmit}
      onCancelEdit={() => {
        setEditing(null);
        setForm(emptyTimes);
        setFormKind("shift");
      }}
    />
  );

  if (!employeeId) {
    return (
      <AppShell title="Timesheet" nav={employeeNav}>
        <p>No employee profile.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Timesheet" nav={employeeNav} hideHeader flush>
      <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col xl:min-h-dvh xl:flex-row">
        <section className="flex flex-1 flex-col px-6 pb-8 pt-6 md:px-8 md:pt-7">
          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <div className="text-[19px] font-bold tracking-tight md:hidden">Timesheet</div>
              <div className="mt-0.5 text-[12.5px] text-[var(--ts-mute)] md:hidden">
                {user?.login}
              </div>
              <div className="hidden items-center gap-3.5 md:flex">
                <button
                  type="button"
                  className="min-h-11 px-1 text-lg text-[var(--ts-mute)]"
                  aria-label="Previous month"
                  onClick={() => {
                    const next = addUtcMonth(year, month, -1);
                    setYearMonth(next.year, next.month);
                  }}
                >
                  ‹
                </button>
                <h1 className="text-xl font-bold tracking-tight whitespace-nowrap">
                  {formatMonthLong(year, month)}
                </h1>
                <button
                  type="button"
                  className="min-h-11 px-1 text-lg text-[var(--ts-mute)]"
                  aria-label="Next month"
                  onClick={() => {
                    const next = addUtcMonth(year, month, 1);
                    setYearMonth(next.year, next.month);
                  }}
                >
                  ›
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3.5 md:hidden">
              <button
                type="button"
                className="min-h-11 px-1 text-[17px] text-[var(--ts-mute)]"
                aria-label="Previous month"
                onClick={() => {
                  const next = addUtcMonth(year, month, -1);
                  setYearMonth(next.year, next.month);
                }}
              >
                ‹
              </button>
              <span className="whitespace-nowrap text-[13.5px] font-semibold">
                {formatMonthShort(year, month)}
              </span>
              <button
                type="button"
                className="min-h-11 px-1 text-[17px] text-[var(--ts-mute)]"
                aria-label="Next month"
                onClick={() => {
                  const next = addUtcMonth(year, month, 1);
                  setYearMonth(next.year, next.month);
                }}
              >
                ›
              </button>
            </div>
            <div className="ml-auto hidden min-w-0 flex-1 items-center gap-4 rounded-[18px] bg-[var(--ts-fill)] px-4 py-3 md:flex md:max-w-[520px]">
              <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-xl font-bold tracking-tight">{formatHours(worked)}</span>
                <span className="text-xs text-[var(--ts-mute)]">of {formatHours(norm)} norm</span>
              </div>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--ts-line)]">
                <div
                  className="h-full rounded-full bg-[var(--ts-ink)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-xs text-[var(--ts-mute)]">Balance</span>
                <span className="text-[13.5px] font-bold">
                  {stats ? formatHours(Number(stats.totalBalance)) : "—"}
                </span>
              </div>
            </div>
          </header>

          <div className="mb-5 rounded-[20px] bg-[var(--ts-fill)] px-[18px] py-4 md:hidden">
            <div className="flex items-baseline justify-between gap-2.5">
              <div className="flex min-w-0 items-baseline gap-1.5">
                <span className="whitespace-nowrap text-2xl font-bold tracking-tight">
                  {formatHours(worked)}
                </span>
                <span className="text-xs text-[var(--ts-mute)]">
                  worked of {formatHours(norm)} norm
                </span>
              </div>
              <span className="whitespace-nowrap text-xs text-[var(--ts-mute)]">
                {Math.round(pct)}%
              </span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--ts-line)]">
              <div className="h-full rounded-full bg-[var(--ts-ink)]" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2.5 flex items-baseline gap-2 text-xs text-[var(--ts-mute)]">
              <span>Total balance</span>
              <span className="whitespace-nowrap text-[13.5px] font-bold text-[var(--ts-ink)]">
                {stats ? formatHours(Number(stats.totalBalance)) : "—"}
              </span>
            </div>
          </div>

          {error ? (
            <p className="mb-3 text-sm text-[var(--ts-under)]" role="alert">
              {error}
            </p>
          ) : null}
          {loading ? <p className="mb-3 text-sm text-[var(--ts-mute)]">Loading…</p> : null}

          <div className="mb-2 grid grid-cols-7 gap-1.5 xl:hidden">
            {WEEKDAYS.map((w, i) => (
              <div
                key={`m-${w}-${i}`}
                className="text-center text-[10px] font-semibold text-[var(--ts-faint)]"
              >
                {w}
              </div>
            ))}
            {cells.map((c, i) => {
              const kinds: EntryKind[] = [];
              if (c.dateYmd) {
                for (const e of byDate.get(c.dateYmd) ?? []) kinds.push(e.kind);
              }
              const mark = c.dateYmd ? markColor(kinds) : null;
              const style = cellStyle(c.dateYmd, false);
              return (
                <button
                  key={c.dateYmd ?? `pad-${i}`}
                  type="button"
                  disabled={!c.dateYmd}
                  onClick={() => c.dateYmd && openDay(c.dateYmd)}
                  className="relative flex h-[54px] flex-col items-center justify-center rounded-xl"
                  style={style}
                >
                  {c.day ? <span className="text-sm font-semibold">{c.day}</span> : null}
                  {mark ? (
                    <span
                      className="absolute bottom-2.5 left-1/2 size-[7px] -translate-x-1/2 rounded-full"
                      style={{ background: mark }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mb-2 hidden grid-cols-7 gap-1.5 xl:grid">
            {WEEKDAYS.map((w, i) => (
              <div
                key={`d-${w}-${i}`}
                className="px-1 text-left text-[10.5px] font-semibold text-[var(--ts-faint)]"
              >
                {w}
              </div>
            ))}
            {cells.map((c, i) => {
              const kinds: EntryKind[] = [];
              if (c.dateYmd) {
                for (const e of byDate.get(c.dateYmd) ?? []) kinds.push(e.kind);
              }
              const mark = c.dateYmd ? markColor(kinds) : null;
              const desk = cellStyle(c.dateYmd, true);
              return (
                <button
                  key={`d-${c.dateYmd ?? `pad-${i}`}`}
                  type="button"
                  disabled={!c.dateYmd}
                  onClick={() => {
                    if (!c.dateYmd) return;
                    setSelectedYmd(c.dateYmd);
                    setEditing(null);
                    setForm(emptyTimes);
                    setFormKind("shift");
                  }}
                  className="relative flex h-[78px] items-start rounded-2xl px-2.5 py-2"
                  style={desk}
                >
                  {c.day ? <span className="text-[13px] font-semibold">{c.day}</span> : null}
                  {mark ? (
                    <span
                      className="absolute bottom-[11px] left-[11px] size-2 rounded-full"
                      style={{ background: mark }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[var(--ts-mute)] md:mt-5 md:text-[11.5px]">
            <LegendDot color="var(--ts-shift)" label="Shift" />
            <LegendDot color="var(--ts-sick)" label="Sick" />
            <LegendDot color="var(--ts-vac)" label="Vacation" />
            <LegendDot color="var(--ts-off)" label="Time off" />
          </div>
        </section>

        <aside className="hidden w-[360px] shrink-0 border-l border-[var(--ts-line)] px-6 py-7 xl:flex xl:flex-col">
          <DayPanel
            dateYmd={selectedYmd}
            today={today}
            entries={selectedEntries}
            hours={selectedHours}
            norm={selectedNorm}
            delta={delta}
            formKind={formKind}
            form={form}
            previewHours={previewHours}
            typePills={typePills}
            editing={editing}
            pending={pending}
            showBack={false}
            onBack={closeMobileDay}
            onType={chooseType}
            onForm={setForm}
            onEdit={startEdit}
            onDelete={onDelete}
            onSubmit={onSubmit}
            onCancelEdit={() => {
              setEditing(null);
              setForm(emptyTimes);
              setFormKind("shift");
            }}
          />
        </aside>
      </div>

      {mobileDayOpen ? (
        <div className="fixed inset-0 z-30 flex flex-col bg-[var(--ts-bg)] xl:hidden">
          <div className="min-h-0 flex-1 overflow-auto px-6 pb-8 pt-5">{dayPanel}</div>
        </div>
      ) : null}
    </AppShell>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <i className="block size-[7px] rounded-full md:size-2" style={{ background: color }} />
      {label}
    </span>
  );
}

function DayPanel({
  dateYmd,
  today,
  entries,
  hours,
  norm,
  delta,
  formKind,
  form,
  previewHours,
  typePills,
  editing,
  pending,
  showBack,
  onBack,
  onType,
  onForm,
  onEdit,
  onDelete,
  onSubmit,
  onCancelEdit,
}: {
  dateYmd: string;
  today: string;
  entries: DayEntry[];
  hours: number;
  norm: number;
  delta: { text: string; color: string };
  formKind: FormKind;
  form: typeof emptyTimes;
  previewHours: number;
  typePills: { id: FormKind; label: string; enabled: boolean }[];
  editing: { kind: EntryKind; id: string } | null;
  pending: boolean;
  showBack: boolean;
  onBack: () => void;
  onType: (kind: FormKind) => void;
  onForm: (next: typeof emptyTimes) => void;
  onEdit: (entry: DayEntry) => void;
  onDelete: (entry: DayEntry) => void;
  onSubmit: (e: FormEvent) => void;
  onCancelEdit: () => void;
}) {
  const year = dateYmd.slice(0, 4);
  const isShift = formKind === "shift";

  return (
    <div className="flex flex-col gap-5">
      {showBack ? (
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="min-h-11 text-[13px] font-semibold text-[var(--ts-mute)]"
            onClick={onBack}
          >
            ‹ Back
          </button>
        </div>
      ) : null}

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="whitespace-nowrap text-[22px] font-bold tracking-tight md:text-[19px]">
            {formatDayTitle(dateYmd)}
          </div>
          <div className="mt-0.5 whitespace-nowrap text-xs text-[var(--ts-mute)]">
            {year} · norm {formatHours(norm)}
            {dateYmd === today ? " · today" : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[22px] font-bold tracking-tight md:text-xl">{formatHours(hours)}</div>
          <div className="text-[11.5px]" style={{ color: delta.color }}>
            {delta.text}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {entries.map((entry) => (
          <EntryRow
            key={entry.kind === "shift" ? entry.shift.id : entry.sick.id}
            entry={entry}
            onEdit={() => onEdit(entry)}
            onDelete={() => void onDelete(entry)}
          />
        ))}
        {entries.length === 0 ? (
          <div className="border-b border-[var(--ts-fill)] pb-3.5 text-[13px] text-[var(--ts-mute)]">
            Nothing logged yet
          </div>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="mt-auto flex flex-col gap-3.5">
        <div className="text-[11px] font-semibold tracking-[0.08em] text-[var(--ts-faint)] uppercase">
          {editing ? "Edit entry" : "Add entry"}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {typePills.map((t) => {
            const on = formKind === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={!t.enabled}
                onClick={() => onType(t.id)}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap disabled:opacity-40"
                style={{
                  background: on ? "var(--ts-ink)" : "transparent",
                  color: on ? "var(--ts-bg)" : "var(--ts-ink)",
                  boxShadow: on ? "none" : "inset 0 0 0 1px var(--ts-line)",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {isShift ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <TimeField
                label="Start"
                value={form.startTime}
                onChange={(startTime) => onForm({ ...form, startTime })}
                required
                disabled={pending}
              />
              <TimeField
                label="End"
                value={form.endTime}
                onChange={(endTime) => onForm({ ...form, endTime })}
                required
                disabled={pending}
              />
              <TimeField
                label="Break start"
                value={form.breakStart}
                onChange={(breakStart) => onForm({ ...form, breakStart })}
                disabled={pending}
              />
              <TimeField
                label="Break end"
                value={form.breakEnd}
                onChange={(breakEnd) => onForm({ ...form, breakEnd })}
                disabled={pending}
              />
            </div>
            <div className="flex items-baseline justify-between text-[12.5px] text-[var(--ts-mute)]">
              <span>Counted</span>
              <span className="text-[15px] font-bold text-[var(--ts-ink)]">
                {formatHours(previewHours)}
              </span>
            </div>
          </div>
        ) : null}
        <label className="flex flex-col gap-1 text-xs text-[var(--ts-mute)]">
          Note
          <input
            className={inputClass}
            placeholder="Optional"
            value={form.note}
            onChange={(e) => onForm({ ...form, note: e.target.value })}
            disabled={pending}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending || (formKind !== "shift" && formKind !== "sick")}
            className="min-h-11 flex-1 rounded-full bg-[var(--ts-ink)] px-3 py-3 text-[13.5px] font-semibold text-[var(--ts-bg)] disabled:opacity-50"
          >
            {pending
              ? "Saving…"
              : editing
                ? "Save"
                : `Add to ${formatDayShort(dateYmd)}`}
          </button>
          {editing ? (
            <button
              type="button"
              className="min-h-11 rounded-full px-3 text-sm font-semibold text-[var(--ts-mute)]"
              onClick={onCancelEdit}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function EntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: DayEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isShift = entry.kind === "shift";
  const start = isShift ? isoToBerlinDateTimeParts(entry.shift.startTime).time : null;
  const end = isShift ? isoToBerlinDateTimeParts(entry.shift.endTime).time : null;
  const b0 = isShift && entry.shift.breakStart
    ? isoToBerlinDateTimeParts(entry.shift.breakStart).time
    : null;
  const b1 = isShift && entry.shift.breakEnd
    ? isoToBerlinDateTimeParts(entry.shift.breakEnd).time
    : null;
  const note = isShift ? entry.shift.note : entry.sick.note;

  return (
    <div className="flex flex-col gap-1.5 border-b border-[var(--ts-fill)] pb-3.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-semibold tracking-[0.06em] text-[var(--ts-faint)] uppercase">
          {isShift ? "Shift" : "Sick"}
        </span>
        <span className="ml-auto text-[15px] font-bold">{formatHours(entry.hours)}</span>
      </div>
      <div className="text-[14.5px] font-semibold">
        {isShift && start && end ? `${start} – ${end}` : "Full day"}
      </div>
      {b0 && b1 ? (
        <div className="text-xs text-[var(--ts-mute)]">
          Break {b0} – {b1}
        </div>
      ) : null}
      {note ? <div className="text-[12.5px] text-[var(--ts-mute)]">{note}</div> : null}
      <div className="mt-0.5 flex gap-4">
        <button
          type="button"
          className="min-h-11 text-[12.5px] font-semibold text-[var(--ts-ink)] underline underline-offset-4"
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="min-h-11 text-[12.5px] font-semibold text-[var(--ts-under)] underline underline-offset-4"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
