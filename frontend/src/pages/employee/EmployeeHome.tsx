import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { createShift, deleteShift, listShifts, updateShift } from "../../api/shifts";
import { createSickDay, deleteSickDay, listSickDays } from "../../api/sickDays";
import { meStats } from "../../api/stats";
import { useAuth } from "../../auth/AuthContext";
import {
  isoToUtcDateTimeParts,
  utcDateToIso,
  utcDateTimeToIso,
  utcShiftEndIso,
} from "../../lib/datetime";
import type { EmployeeStats, Shift, SickDay } from "../../types/api";

function defaultYearMonth() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

type ShiftFormState = {
  date: string;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  note: string;
};

const emptyShiftForm: ShiftFormState = {
  date: "",
  startTime: "",
  endTime: "",
  breakStart: "",
  breakEnd: "",
  note: "",
};

export default function EmployeeHome() {
  const { user, logout } = useAuth();
  const employeeId = user?.employeeId ?? null;

  const initial = defaultYearMonth();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sickDays, setSickDays] = useState<SickDay[]>([]);
  const [stats, setStats] = useState<EmployeeStats | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shiftForm, setShiftForm] = useState<ShiftFormState>(emptyShiftForm);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftPending, setShiftPending] = useState(false);

  const [sickDate, setSickDate] = useState("");
  const [sickNote, setSickNote] = useState("");
  const [sickPending, setSickPending] = useState(false);

  const load = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const [s, d, st] = await Promise.all([
        listShifts({ employeeId, year, month }),
        listSickDays({ employeeId, year, month }),
        meStats(year, month),
      ]);
      setShifts(s);
      setSickDays(d);
      setStats(st);
    } catch (err) {
      setShifts([]);
      setSickDays([]);
      setStats(null);
      setError(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [employeeId, year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  function buildShiftBody() {
    if (!employeeId) throw new Error("No employeeId");
    const { date, startTime, endTime, breakStart, breakEnd, note } = shiftForm;
    if (!date || !startTime || !endTime) {
      throw new ApiError(400, "date, start and end are required");
    }
    const hasB0 = breakStart.trim() !== "";
    const hasB1 = breakEnd.trim() !== "";
    if (hasB0 !== hasB1) {
      throw new ApiError(400, "breakStart and breakEnd must both be set or both empty");
    }
    return {
      employeeId,
      date: utcDateToIso(date),
      startTime: utcDateTimeToIso(date, startTime),
      endTime: utcShiftEndIso(date, startTime, endTime),
      breakStart: hasB0 ? utcDateTimeToIso(date, breakStart) : null,
      breakEnd: hasB1 ? utcDateTimeToIso(date, breakEnd) : null,
      note: note.trim() ? note.trim() : undefined,
    };
  }

  async function onShiftSubmit(e: FormEvent) {
    e.preventDefault();
    setShiftPending(true);
    setError(null);
    try {
      const body = buildShiftBody();
      if (editingShiftId) {
        const { employeeId: _omit, ...patch } = body;
        void _omit;
        await updateShift(editingShiftId, patch);
      } else {
        await createShift(body);
      }
      setShiftForm(emptyShiftForm);
      setEditingShiftId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Shift save failed");
    } finally {
      setShiftPending(false);
    }
  }

  function startEdit(shift: Shift) {
    const start = isoToUtcDateTimeParts(shift.startTime);
    const end = isoToUtcDateTimeParts(shift.endTime);
    const date = isoToUtcDateTimeParts(shift.date).date;
    setEditingShiftId(shift.id);
    setShiftForm({
      date,
      startTime: start.time,
      endTime: end.time,
      breakStart: shift.breakStart
        ? isoToUtcDateTimeParts(shift.breakStart).time
        : "",
      breakEnd: shift.breakEnd ? isoToUtcDateTimeParts(shift.breakEnd).time : "",
      note: shift.note ?? "",
    });
  }

  async function onDeleteShift(id: string) {
    if (!window.confirm("Delete this shift?")) return;
    setError(null);
    try {
      await deleteShift(id);
      if (editingShiftId === id) {
        setEditingShiftId(null);
        setShiftForm(emptyShiftForm);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  async function onSickSubmit(e: FormEvent) {
    e.preventDefault();
    if (!employeeId || !sickDate) return;
    setSickPending(true);
    setError(null);
    try {
      await createSickDay({
        employeeId,
        date: utcDateToIso(sickDate),
        note: sickNote.trim() || undefined,
      });
      setSickDate("");
      setSickNote("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sick day failed");
    } finally {
      setSickPending(false);
    }
  }

  async function onDeleteSick(id: string) {
    if (!window.confirm("Delete this sick day?")) return;
    setError(null);
    try {
      await deleteSickDay(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  if (!employeeId) {
    return (
      <div className="p-4">
        <p>No employee profile.</p>
        <button type="button" className="mt-4 underline" onClick={() => void logout()}>
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8 p-4 pb-16">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">My timesheet</h1>
          <p className="text-sm text-neutral-600">{user?.login}</p>
        </div>
        <button
          type="button"
          className="min-h-11 rounded border px-3 py-3 text-sm"
          onClick={() => void logout()}
        >
          Log out
        </button>
      </header>

      <section className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Year
          <input
            className="min-h-11 rounded border px-3 py-3 text-base"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min={2000}
            max={2100}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Month
          <input
            className="min-h-11 rounded border px-3 py-3 text-base"
            type="number"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            min={1}
            max={12}
          />
        </label>
      </section>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-neutral-500">Loading…</p> : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Stats</h2>
        {stats ? (
          <ul className="grid grid-cols-2 gap-2 text-sm">
            <li>Worked: {stats.workedHours} h</li>
            <li>Norm: {stats.normHours} h</li>
            <li>Balance: {stats.balance} h</li>
            <li>Pay: {stats.monthlyPay}</li>
            <li className="col-span-2">Total balance: {stats.totalBalance} h</li>
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">No stats</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Shifts</h2>
        <ul className="flex flex-col gap-2">
          {shifts.map((s) => {
            const d = isoToUtcDateTimeParts(s.date).date;
            const a = isoToUtcDateTimeParts(s.startTime).time;
            const b = isoToUtcDateTimeParts(s.endTime).time;
            return (
              <li
                key={s.id}
                className="flex items-start justify-between gap-2 rounded border p-3 text-sm"
              >
                <div>
                  <div>
                    {d} {a}–{b}
                  </div>
                  <div className="text-neutral-600">{s.workedMinutes} min</div>
                  {s.note ? <div className="text-neutral-600">{s.note}</div> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="underline" onClick={() => startEdit(s)}>
                    Edit
                  </button>
                  <button type="button" className="underline" onClick={() => void onDeleteShift(s.id)}>
                    Del
                  </button>
                </div>
              </li>
            );
          })}
          {shifts.length === 0 && !loading ? (
            <li className="text-sm text-neutral-500">No shifts</li>
          ) : null}
        </ul>

        <form onSubmit={onShiftSubmit} className="flex flex-col gap-3 rounded border p-3">
          <h3 className="text-sm font-medium">
            {editingShiftId ? "Edit shift" : "Add shift"}
          </h3>
          <p className="text-xs text-neutral-500">Times are UTC (see LIMITATIONS).</p>
          <label className="flex flex-col gap-1 text-sm">
            Date
            <input
              type="date"
              className="min-h-11 rounded border px-3 py-3 text-base"
              value={shiftForm.date}
              onChange={(e) => setShiftForm((f) => ({ ...f, date: e.target.value }))}
              required
              disabled={shiftPending}
            />
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Start
              <input
                type="time"
                className="min-h-11 rounded border px-3 py-3 text-base"
                value={shiftForm.startTime}
                onChange={(e) => setShiftForm((f) => ({ ...f, startTime: e.target.value }))}
                required
                disabled={shiftPending}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              End
              <input
                type="time"
                className="min-h-11 rounded border px-3 py-3 text-base"
                value={shiftForm.endTime}
                onChange={(e) => setShiftForm((f) => ({ ...f, endTime: e.target.value }))}
                required
                disabled={shiftPending}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Break start
              <input
                type="time"
                className="min-h-11 rounded border px-3 py-3 text-base"
                value={shiftForm.breakStart}
                onChange={(e) => setShiftForm((f) => ({ ...f, breakStart: e.target.value }))}
                disabled={shiftPending}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Break end
              <input
                type="time"
                className="min-h-11 rounded border px-3 py-3 text-base"
                value={shiftForm.breakEnd}
                onChange={(e) => setShiftForm((f) => ({ ...f, breakEnd: e.target.value }))}
                disabled={shiftPending}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Note
            <input
              className="min-h-11 rounded border px-3 py-3 text-base"
              value={shiftForm.note}
              onChange={(e) => setShiftForm((f) => ({ ...f, note: e.target.value }))}
              disabled={shiftPending}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={shiftPending}
              className="min-h-11 rounded bg-neutral-900 px-3 py-3 text-base text-white disabled:opacity-50"
            >
              {shiftPending ? "Saving…" : editingShiftId ? "Save" : "Add"}
            </button>
            {editingShiftId ? (
              <button
                type="button"
                className="min-h-11 rounded border px-3 py-3 text-sm"
                onClick={() => {
                  setEditingShiftId(null);
                  setShiftForm(emptyShiftForm);
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Sick days</h2>
        <ul className="flex flex-col gap-2">
          {sickDays.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded border p-3 text-sm"
            >
              <span>
                {isoToUtcDateTimeParts(d.date).date}
                {d.note ? ` — ${d.note}` : ""}
              </span>
              <button type="button" className="underline" onClick={() => void onDeleteSick(d.id)}>
                Del
              </button>
            </li>
          ))}
          {sickDays.length === 0 && !loading ? (
            <li className="text-sm text-neutral-500">No sick days</li>
          ) : null}
        </ul>
        <form onSubmit={onSickSubmit} className="flex flex-col gap-3 rounded border p-3">
          <label className="flex flex-col gap-1 text-sm">
            Date
            <input
              type="date"
              className="min-h-11 rounded border px-3 py-3 text-base"
              value={sickDate}
              onChange={(e) => setSickDate(e.target.value)}
              required
              disabled={sickPending}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Note
            <input
              className="min-h-11 rounded border px-3 py-3 text-base"
              value={sickNote}
              onChange={(e) => setSickNote(e.target.value)}
              disabled={sickPending}
            />
          </label>
          <button
            type="submit"
            disabled={sickPending}
            className="min-h-11 rounded bg-neutral-900 px-3 py-3 text-base text-white disabled:opacity-50"
          >
            {sickPending ? "Saving…" : "Add sick day"}
          </button>
        </form>
      </section>
    </div>
  );
}
