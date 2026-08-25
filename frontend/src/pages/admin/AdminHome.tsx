import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import {
  createEmployee,
  deactivateEmployee,
  listEmployees,
} from "../../api/employees";
import { statsOverview } from "../../api/stats";
import { useAuth } from "../../auth/AuthContext";
import { utcDateToIso } from "../../lib/datetime";
import type { CreateEmployeeBody, Employee, OverviewRow, PayType } from "../../types/api";

function defaultYearMonth() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

type CreateForm = {
  login: string;
  password: string;
  firstName: string;
  lastName: string;
  payType: PayType;
  hourlyRate: string;
  monthlySalary: string;
  hoursPerDay: string;
  daysPerWeek: string;
  hoursPerMonth: string;
  hiredAt: string;
};

const emptyCreate: CreateForm = {
  login: "",
  password: "",
  firstName: "",
  lastName: "",
  payType: "HOURLY",
  hourlyRate: "",
  monthlySalary: "",
  hoursPerDay: "8",
  daysPerWeek: "5",
  hoursPerMonth: "173.33",
  hiredAt: "",
};

export default function AdminHome() {
  const { user, logout } = useAuth();
  const initial = defaultYearMonth();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [overview, setOverview] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateForm>(emptyCreate);
  const [createPending, setCreatePending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, ov] = await Promise.all([
        listEmployees(),
        statsOverview(year, month),
      ]);
      setEmployees(emps);
      setOverview(ov);
    } catch (err) {
      setEmployees([]);
      setOverview([]);
      setError(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreatePending(true);
    setError(null);
    try {
      const body: CreateEmployeeBody = {
        login: form.login.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        payType: form.payType,
        hoursPerDay: form.hoursPerDay.trim(),
        daysPerWeek: Number(form.daysPerWeek),
        hoursPerMonth: form.hoursPerMonth.trim(),
        hiredAt: utcDateToIso(form.hiredAt),
      };
      if (form.payType === "HOURLY") {
        body.hourlyRate = form.hourlyRate.trim();
      } else {
        body.monthlySalary = form.monthlySalary.trim();
      }
      await createEmployee(body);
      setForm(emptyCreate);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setCreatePending(false);
    }
  }

  async function onDeactivate(id: string, login: string) {
    if (!window.confirm(`Deactivate ${login}?`)) return;
    setError(null);
    try {
      await deactivateEmployee(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Deactivate failed");
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-4 pb-16">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Admin</h1>
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

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">
          Overview {year}-{month}
        </h2>
        <ul className="flex flex-col gap-2">
          {overview.map((row) => (
            <li key={row.employeeId} className="rounded border p-3 text-sm">
              <Link className="font-medium underline" to={`/admin/employees/${row.employeeId}`}>
                {row.lastName} {row.firstName}
              </Link>
              <div className="text-neutral-600">
                {row.login} · worked {row.workedHours} · bal {row.balance} · pay{" "}
                {row.monthlyPay}
              </div>
            </li>
          ))}
          {overview.length === 0 && !loading ? (
            <li className="text-sm text-neutral-500">No rows</li>
          ) : null}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Employees</h2>
        <ul className="flex flex-col gap-2">
          {employees.map((emp) => (
            <li
              key={emp.id}
              className="flex items-start justify-between gap-2 rounded border p-3 text-sm"
            >
              <div>
                <Link className="font-medium underline" to={`/admin/employees/${emp.id}`}>
                  {emp.lastName} {emp.firstName}
                </Link>
                <div className="text-neutral-600">
                  {emp.login} · {emp.payType} ·{" "}
                  {emp.isActive ? "active" : "inactive"}
                </div>
              </div>
              {emp.isActive ? (
                <button
                  type="button"
                  className="shrink-0 underline"
                  onClick={() => void onDeactivate(emp.id, emp.login)}
                >
                  Deactivate
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <form onSubmit={onCreate} className="flex flex-col gap-3 rounded border p-3">
          <h2 className="text-lg font-medium">Create employee</h2>
          <label className="flex flex-col gap-1 text-sm">
            Login
            <input
              className="min-h-11 rounded border px-3 py-3 text-base"
              value={form.login}
              onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
              required
              disabled={createPending}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Password
            <input
              type="password"
              className="min-h-11 rounded border px-3 py-3 text-base"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              disabled={createPending}
            />
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              First name
              <input
                className="min-h-11 rounded border px-3 py-3 text-base"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                required
                disabled={createPending}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Last name
              <input
                className="min-h-11 rounded border px-3 py-3 text-base"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                required
                disabled={createPending}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Pay type
            <select
              className="min-h-11 rounded border px-3 py-3 text-base"
              value={form.payType}
              onChange={(e) =>
                setForm((f) => ({ ...f, payType: e.target.value as PayType }))
              }
              disabled={createPending}
            >
              <option value="HOURLY">HOURLY</option>
              <option value="SALARY">SALARY</option>
            </select>
          </label>
          {form.payType === "HOURLY" ? (
            <label className="flex flex-col gap-1 text-sm">
              Hourly rate
              <input
                className="min-h-11 rounded border px-3 py-3 text-base"
                value={form.hourlyRate}
                onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                required
                disabled={createPending}
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              Monthly salary
              <input
                className="min-h-11 rounded border px-3 py-3 text-base"
                value={form.monthlySalary}
                onChange={(e) =>
                  setForm((f) => ({ ...f, monthlySalary: e.target.value }))
                }
                required
                disabled={createPending}
              />
            </label>
          )}
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Hours/day
              <input
                className="min-h-11 rounded border px-3 py-3 text-base"
                value={form.hoursPerDay}
                onChange={(e) => setForm((f) => ({ ...f, hoursPerDay: e.target.value }))}
                required
                disabled={createPending}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Days/week
              <input
                className="min-h-11 rounded border px-3 py-3 text-base"
                type="number"
                min={1}
                max={7}
                value={form.daysPerWeek}
                onChange={(e) => setForm((f) => ({ ...f, daysPerWeek: e.target.value }))}
                required
                disabled={createPending}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Hours/month
            <input
              className="min-h-11 rounded border px-3 py-3 text-base"
              value={form.hoursPerMonth}
              onChange={(e) => setForm((f) => ({ ...f, hoursPerMonth: e.target.value }))}
              required
              disabled={createPending}
            />
            <span className="text-xs text-neutral-500">
              Changing this later rewrites past stats balances.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Hired at (UTC date)
            <input
              type="date"
              className="min-h-11 rounded border px-3 py-3 text-base"
              value={form.hiredAt}
              onChange={(e) => setForm((f) => ({ ...f, hiredAt: e.target.value }))}
              required
              disabled={createPending}
            />
          </label>
          <button
            type="submit"
            disabled={createPending}
            className="min-h-11 rounded bg-neutral-900 px-3 py-3 text-base text-white disabled:opacity-50"
          >
            {createPending ? "Creating…" : "Create"}
          </button>
        </form>
      </section>
    </div>
  );
}
