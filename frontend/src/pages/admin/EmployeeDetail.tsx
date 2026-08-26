import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { getEmployee, updateEmployee } from "../../api/employees";
import { deleteShift, listShifts } from "../../api/shifts";
import { deleteSickDay, listSickDays } from "../../api/sickDays";
import { employeeStats } from "../../api/stats";
import {
  createOvertimePayout,
  deleteOvertimePayout,
  listOvertimePayouts,
} from "../../api/payouts";
import { AppShell, adminNav } from "../../components/AppShell";
import { MonthPicker, TabBar } from "../../components/MonthPicker";
import { ShiftList } from "../../components/ShiftList";
import { StatsBlock } from "../../components/StatsBlock";
import { useYearMonth } from "../../hooks/useYearMonth";
import { isoToUtcDateTimeParts, utcDateToIso } from "../../lib/datetime";
import type {
  Employee,
  EmployeeStats,
  OvertimePayout,
  PayType,
  Shift,
  SickDay,
} from "../../types/api";
import { btnPrimary, btnSecondary, inputClass } from "../../ui";

type Tab = "profile" | "month" | "payouts";

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const { year, month, setYearMonth } = useYearMonth();
  const [tab, setTab] = useState<Tab>("month");

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sickDays, setSickDays] = useState<SickDay[]>([]);
  const [overtimePayouts, setOvertimePayouts] = useState<OvertimePayout[]>([]);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [payType, setPayType] = useState<PayType>("HOURLY");
  const [hourlyRate, setHourlyRate] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState("5");
  const [hiredAt, setHiredAt] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [otDate, setOtDate] = useState("");
  const [otHours, setOtHours] = useState("");
  const [otAmount, setOtAmount] = useState("");
  const [otNote, setOtNote] = useState("");
  const [otPending, setOtPending] = useState(false);

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
      setLogin(emp.login);
      setPassword("");
      setFirstName(emp.firstName);
      setLastName(emp.lastName);
      setPayType(emp.payType);
      setHourlyRate(emp.hourlyRate ?? "");
      setMonthlySalary(emp.monthlySalary ?? "");
      setHoursPerDay(emp.hoursPerDay);
      setDaysPerWeek(String(emp.daysPerWeek));
      setHiredAt(isoToUtcDateTimeParts(emp.hiredAt).date);
      setIsActive(emp.isActive);

      const [st, sh, sk, ot] = await Promise.all([
        employeeStats(id, year, month),
        listShifts({ employeeId: id }),
        listSickDays({ employeeId: id, year, month }),
        listOvertimePayouts(id),
      ]);
      setStats(st);
      setShifts(sh);
      setSickDays(sk);
      setOvertimePayouts(ot);
    } catch (err) {
      setEmployee(null);
      setStats(null);
      setShifts([]);
      setSickDays([]);
      setOvertimePayouts([]);
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
      const body = {
        login: login.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        payType,
        hourlyRate: payType === "HOURLY" ? hourlyRate.trim() : null,
        monthlySalary: payType === "SALARY" ? monthlySalary.trim() : null,
        hoursPerDay: hoursPerDay.trim(),
        daysPerWeek: Number(daysPerWeek),
        hiredAt: utcDateToIso(hiredAt),
        isActive,
      };
      await updateEmployee(id, {
        ...body,
        ...(password.trim() ? { password: password.trim() } : {}),
      });
      setPassword("");
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

  async function onCreateOvertime(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setOtPending(true);
    setError(null);
    try {
      await createOvertimePayout(id, {
        date: utcDateToIso(otDate),
        hoursPaid: otHours.trim(),
        amount: otAmount.trim(),
        note: otNote.trim() || undefined,
      });
      setOtDate("");
      setOtHours("");
      setOtAmount("");
      setOtNote("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Overtime payout failed");
    } finally {
      setOtPending(false);
    }
  }

  async function onDeleteOvertime(payoutId: string) {
    if (!id || !window.confirm("Delete this overtime payout?")) return;
    try {
      await deleteOvertimePayout(id, payoutId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  const title = employee ? `${employee.lastName} ${employee.firstName}` : "Employee";

  return (
    <AppShell title={title} nav={adminNav}>
      <div>
        <Link to="/admin/employees" className="inline-flex min-h-11 items-center text-sm underline">
          ← Employees
        </Link>
        {employee ? (
          <p className="text-sm text-neutral-600">{employee.login}</p>
        ) : null}
      </div>

      <TabBar
        tabs={[
          { id: "profile", label: "Profile" },
          { id: "month", label: "Month" },
          { id: "payouts", label: "Payouts" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-neutral-500">Loading…</p> : null}

      {tab === "profile" && employee ? (
        <form
          onSubmit={onSave}
          className="flex flex-col gap-3 rounded border border-neutral-200 bg-white p-3"
        >
          <h2 className="text-lg font-medium">Edit</h2>
          <label className="flex flex-col gap-1 text-sm">
            Login
            <input
              className={inputClass}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              disabled={pending}
              autoComplete="username"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Password
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              autoComplete="new-password"
              placeholder="Leave blank to keep current"
            />
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              First name
              <input
                className={inputClass}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                disabled={pending}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Last name
              <input
                className={inputClass}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                disabled={pending}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Pay type
            <select
              className={inputClass}
              value={payType}
              onChange={(e) => setPayType(e.target.value as PayType)}
              disabled={pending}
            >
              <option value="HOURLY">HOURLY</option>
              <option value="SALARY">SALARY</option>
            </select>
          </label>
          {payType === "HOURLY" ? (
            <label className="flex flex-col gap-1 text-sm">
              Hourly rate
              <input
                className={inputClass}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                required
                disabled={pending}
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              Monthly salary
              <input
                className={inputClass}
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(e.target.value)}
                required
                disabled={pending}
              />
            </label>
          )}
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Hours/day
              <input
                className={inputClass}
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(e.target.value)}
                required
                disabled={pending}
              />
              <span className="text-xs text-neutral-500">
                Daily norm for overtime and undertime. Changing this recalculates past stats.
              </span>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Days/week
              <input
                className={inputClass}
                type="number"
                min={1}
                max={7}
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(e.target.value)}
                required
                disabled={pending}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Hired at (UTC date)
            <input
              type="date"
              className={inputClass}
              value={hiredAt}
              onChange={(e) => setHiredAt(e.target.value)}
              required
              disabled={pending}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={pending}
            />
            Active
          </label>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      ) : null}

      {tab === "month" ? (
        <>
          <MonthPicker year={year} month={month} onChange={setYearMonth} />
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Stats</h2>
            <StatsBlock stats={stats} />
          </section>
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-medium">Shifts</h2>
              {id ? (
                <Link to={`/admin/employees/${id}/shifts`} className={btnSecondary}>
                  View all
                </Link>
              ) : null}
            </div>
            <ShiftList
              shifts={shifts.slice(0, 3)}
              loading={loading}
              onDelete={onDeleteShift}
            />
          </section>
          <section className="flex flex-col gap-2">
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
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => void onDeleteSick(d.id)}
                  >
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
          </section>
        </>
      ) : null}

      {tab === "payouts" ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Overtime payouts (all)</h2>
            <div className="rounded-[18px] bg-[var(--ts-fill)] px-4 py-3">
              <div className="text-sm text-[var(--ts-mute)]">Total balance</div>
              <div className="text-lg font-bold tracking-tight">
                {stats ? `${stats.totalBalance} h` : "—"}
              </div>
            </div>
            <p className="text-xs text-neutral-500">
              Pays out overtime hours: they are subtracted from total balance. This closes a
              positive overtime bank. It does not fix undertime (a negative balance).
            </p>
            <p className="text-xs text-neutral-500">
              List is full history. Stats paid overtime is cumulative through the selected month.
            </p>
            <ul className="flex flex-col gap-2">
              {overtimePayouts.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start justify-between gap-2 rounded border border-neutral-200 bg-white p-3 text-sm"
                >
                  <div>
                    {isoToUtcDateTimeParts(p.date).date} · {p.hoursPaid} h · {p.amount}
                    {p.note ? ` — ${p.note}` : ""}
                  </div>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => void onDeleteOvertime(p.id)}
                  >
                    Del
                  </button>
                </li>
              ))}
              {overtimePayouts.length === 0 && !loading ? (
                <li className="text-sm text-neutral-500">No overtime payouts</li>
              ) : null}
            </ul>
            <form
              onSubmit={onCreateOvertime}
              className="flex flex-col gap-3 rounded border border-neutral-200 bg-white p-3"
            >
              <h3 className="text-sm font-medium">Add overtime payout</h3>
              <label className="flex flex-col gap-1 text-sm">
                Date (UTC)
                <input
                  type="date"
                  className={inputClass}
                  value={otDate}
                  onChange={(e) => setOtDate(e.target.value)}
                  required
                  disabled={otPending}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Hours paid
                <input
                  className={inputClass}
                  value={otHours}
                  onChange={(e) => setOtHours(e.target.value)}
                  required
                  disabled={otPending}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Amount
                <input
                  className={inputClass}
                  value={otAmount}
                  onChange={(e) => setOtAmount(e.target.value)}
                  required
                  disabled={otPending}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Note
                <input
                  className={inputClass}
                  value={otNote}
                  onChange={(e) => setOtNote(e.target.value)}
                  disabled={otPending}
                />
              </label>
              <button type="submit" disabled={otPending} className={btnPrimary}>
                {otPending ? "Saving…" : "Add"}
              </button>
            </form>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
