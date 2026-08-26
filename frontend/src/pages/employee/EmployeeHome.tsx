import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { createShift, deleteShift, listShifts, updateShift } from "../../api/shifts";
import { createSickDay, deleteSickDay, listSickDays } from "../../api/sickDays";
import { useAuth } from "../../auth/AuthContext";
import { AppShell, employeeNav } from "../../components/AppShell";
import { MonthPicker } from "../../components/MonthPicker";
import { ShiftList } from "../../components/ShiftList";
import { useYearMonth } from "../../hooks/useYearMonth";
import {
  isoToUtcDateTimeParts,
  utcDateToIso,
  utcDateTimeToIso,
  utcShiftEndIso,
} from "../../lib/datetime";
import type { Shift, SickDay } from "../../types/api";
import { btnPrimary, btnSecondary, inputClass } from "../../ui";

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
  const { user } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const { year, month, setYearMonth } = useYearMonth();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sickDays, setSickDays] = useState<SickDay[]>([]);
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
      const [s, d] = await Promise.all([
        listShifts({ employeeId, year, month }),
        listSickDays({ employeeId, year, month }),
      ]);
      setShifts(s);
      setSickDays(d);
    } catch (err) {
      setShifts([]);
      setSickDays([]);
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
      breakStart: shift.breakStart ? isoToUtcDateTimeParts(shift.breakStart).time : "",
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
      <AppShell title="Timesheet" nav={employeeNav}>
        <p>No employee profile.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Timesheet" nav={employeeNav}>
      <MonthPicker year={year} month={month} onChange={setYearMonth} />

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-neutral-500">Loading…</p> : null}

      <section className="flex flex-col gap-3">
        <form onSubmit={onShiftSubmit} className="flex flex-col gap-3 rounded border border-neutral-200 bg-white p-3">
          <h2 className="text-lg font-medium">{editingShiftId ? "Edit shift" : "Add shift"}</h2>
          <p className="text-xs text-neutral-500">Times are UTC (see LIMITATIONS).</p>
          <label className="flex flex-col gap-1 text-sm">
            Date
            <input
              type="date"
              className={inputClass}
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
                className={inputClass}
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
                className={inputClass}
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
                className={inputClass}
                value={shiftForm.breakStart}
                onChange={(e) => setShiftForm((f) => ({ ...f, breakStart: e.target.value }))}
                disabled={shiftPending}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Break end
              <input
                type="time"
                className={inputClass}
                value={shiftForm.breakEnd}
                onChange={(e) => setShiftForm((f) => ({ ...f, breakEnd: e.target.value }))}
                disabled={shiftPending}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Note
            <input
              className={inputClass}
              value={shiftForm.note}
              onChange={(e) => setShiftForm((f) => ({ ...f, note: e.target.value }))}
              disabled={shiftPending}
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={shiftPending} className={btnPrimary}>
              {shiftPending ? "Saving…" : editingShiftId ? "Save" : "Add"}
            </button>
            {editingShiftId ? (
              <button
                type="button"
                className={btnSecondary}
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
        <h2 className="text-lg font-medium">Shifts</h2>
        <ShiftList
          shifts={shifts}
          loading={loading}
          onEdit={startEdit}
          onDelete={onDeleteShift}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Sick days</h2>
        <ul className="flex flex-col gap-2 md:hidden">
          {sickDays.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded border border-neutral-200 bg-white p-3 text-sm"
            >
              <span>
                {isoToUtcDateTimeParts(d.date).date}
                {d.note ? ` — ${d.note}` : ""}
              </span>
              <button type="button" className={btnSecondary} onClick={() => void onDeleteSick(d.id)}>
                Del
              </button>
            </li>
          ))}
          {sickDays.length === 0 && !loading ? (
            <li className="text-sm text-neutral-500">No sick days</li>
          ) : null}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Note</th>
                <th className="px-3 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sickDays.map((d) => (
                <tr key={d.id} className="border-b border-neutral-100">
                  <td className="px-3 py-3">{isoToUtcDateTimeParts(d.date).date}</td>
                  <td className="px-3 py-3">{d.note ?? ""}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => void onDeleteSick(d.id)}
                    >
                      Del
                    </button>
                  </td>
                </tr>
              ))}
              {sickDays.length === 0 && !loading ? (
                <tr>
                  <td className="px-3 py-3 text-neutral-500" colSpan={3}>
                    No sick days
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <form onSubmit={onSickSubmit} className="flex flex-col gap-3 rounded border border-neutral-200 bg-white p-3">
          <h3 className="text-sm font-medium">Add sick day</h3>
          <label className="flex flex-col gap-1 text-sm">
            Date
            <input
              type="date"
              className={inputClass}
              value={sickDate}
              onChange={(e) => setSickDate(e.target.value)}
              required
              disabled={sickPending}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Note
            <input
              className={inputClass}
              value={sickNote}
              onChange={(e) => setSickNote(e.target.value)}
              disabled={sickPending}
            />
          </label>
          <button type="submit" disabled={sickPending} className={btnPrimary}>
            {sickPending ? "Saving…" : "Add sick day"}
          </button>
        </form>
      </section>
    </AppShell>
  );
}
