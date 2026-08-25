import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { getEmployee, updateEmployee } from "../../api/employees";
import { deleteShift, listShifts } from "../../api/shifts";
import { deleteSickDay, listSickDays } from "../../api/sickDays";
import { employeeStats } from "../../api/stats";
import { useAuth } from "../../auth/AuthContext";
import { isoToUtcDateTimeParts } from "../../lib/datetime";
import type { Employee, EmployeeStats, Shift, SickDay } from "../../types/api";

function defaultYearMonth() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const { logout } = useAuth();
  const initial = defaultYearMonth();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sickDays, setSickDays] = useState<SickDay[]>([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [hoursPerMonth, setHoursPerMonth] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const emp = await getEmployee(id);
      setEmployee(emp);
      setFirstName(emp.firstName);
      setLastName(emp.lastName);
      setHoursPerMonth(emp.hoursPerMonth);
      setIsActive(emp.isActive);

      const [st, sh, sk] = await Promise.all([
        employeeStats(id, year, month),
        listShifts({ employeeId: id, year, month }),
        listSickDays({ employeeId: id, year, month }),
      ]);
      setStats(st);
      setShifts(sh);
      setSickDays(sk);
    } catch (err) {
      setEmployee(null);
      setStats(null);
      setShifts([]);
      setSickDays([]);
      setError(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id, year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setPending(true);
    setError(null);
    try {
      await updateEmployee(id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        hoursPerMonth: hoursPerMonth.trim(),
        isActive,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  async function onDeleteShift(shiftId: string) {
    if (!window.confirm("Delete this shift?")) return;
    try {
      await deleteShift(shiftId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  async function onDeleteSick(sickId: string) {
    if (!window.confirm("Delete this sick day?")) return;
    try {
      await deleteSickDay(sickId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-4 pb-16">
      <header className="flex items-center justify-between gap-2">
        <div>
          <Link to="/admin" className="text-sm underline">
            ← Admin
          </Link>
          <h1 className="text-xl font-semibold">
            {employee ? `${employee.lastName} ${employee.firstName}` : "Employee"}
          </h1>
          {employee ? (
            <p className="text-sm text-neutral-600">{employee.login}</p>
          ) : null}
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
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Month
          <input
            className="min-h-11 rounded border px-3 py-3 text-base"
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          />
        </label>
      </section>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-neutral-500">Loading…</p> : null}

      {employee ? (
        <form onSubmit={onSave} className="flex flex-col gap-3 rounded border p-3">
          <h2 className="text-lg font-medium">Edit</h2>
          <label className="flex flex-col gap-1 text-sm">
            First name
            <input
              className="min-h-11 rounded border px-3 py-3 text-base"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              disabled={pending}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Last name
            <input
              className="min-h-11 rounded border px-3 py-3 text-base"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              disabled={pending}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Hours/month
            <input
              className="min-h-11 rounded border px-3 py-3 text-base"
              value={hoursPerMonth}
              onChange={(e) => setHoursPerMonth(e.target.value)}
              required
              disabled={pending}
            />
            <span className="text-xs text-neutral-500">
              Changing this rewrites past stats balances.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={pending}
            />
            Active
          </label>
          <p className="text-xs text-neutral-500">
            Hired: {isoToUtcDateTimeParts(employee.hiredAt).date} (UTC) ·{" "}
            {employee.payType}
          </p>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded bg-neutral-900 px-3 py-3 text-base text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      ) : null}

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

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Shifts</h2>
        <ul className="flex flex-col gap-2">
          {shifts.map((s) => (
            <li
              key={s.id}
              className="flex items-start justify-between gap-2 rounded border p-3 text-sm"
            >
              <div>
                {isoToUtcDateTimeParts(s.date).date}{" "}
                {isoToUtcDateTimeParts(s.startTime).time}–
                {isoToUtcDateTimeParts(s.endTime).time} ·{" "}
                {(s.workedMinutes / 60).toFixed(1)} h
              </div>
              <button type="button" className="underline" onClick={() => void onDeleteShift(s.id)}>
                Del
              </button>
            </li>
          ))}
          {shifts.length === 0 && !loading ? (
            <li className="text-sm text-neutral-500">No shifts</li>
          ) : null}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
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
      </section>
    </div>
  );
}
