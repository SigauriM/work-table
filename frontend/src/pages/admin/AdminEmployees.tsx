import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import {
  createEmployee,
  deactivateEmployee,
  listEmployees,
} from "../../api/employees";
import { AppShell, adminNav } from "../../components/AppShell";
import { utcDateToIso } from "../../lib/datetime";
import type { CreateEmployeeBody, Employee, PayType } from "../../types/api";
import { btnPrimary, btnSecondary, inputClass } from "../../ui";

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
  hiredAt: "",
};

export default function AdminEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateForm>(emptyCreate);
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const createDialogRef = useRef<HTMLDialogElement>(null);

  function openCreate() {
    setForm(emptyCreate);
    setCreateError(null);
    createDialogRef.current?.showModal();
  }

  function closeCreate() {
    createDialogRef.current?.close();
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEmployees(await listEmployees());
    } catch (err) {
      setEmployees([]);
      setError(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreatePending(true);
    setCreateError(null);
    try {
      const body: CreateEmployeeBody = {
        login: form.login.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        payType: form.payType,
        hoursPerDay: form.hoursPerDay.trim(),
        daysPerWeek: Number(form.daysPerWeek),
        hiredAt: utcDateToIso(form.hiredAt),
      };
      if (form.payType === "HOURLY") {
        body.hourlyRate = form.hourlyRate.trim();
      } else {
        body.monthlySalary = form.monthlySalary.trim();
      }
      await createEmployee(body);
      setForm(emptyCreate);
      closeCreate();
      await load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Create failed");
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
    <AppShell title="Employees" nav={adminNav}>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-neutral-500">Loading…</p> : null}

      <button type="button" className={`${btnPrimary} self-start`} onClick={openCreate}>
        Create employee
      </button>

      <ul className="flex flex-col gap-2 md:hidden">
        {employees.map((emp) => (
          <li
            key={emp.id}
            className="flex items-start justify-between gap-2 rounded border border-neutral-200 bg-white p-3 text-sm"
          >
            <div>
              <Link className="font-medium underline" to={`/admin/employees/${emp.id}`}>
                {emp.lastName} {emp.firstName}
              </Link>
              <div className="text-neutral-600">
                {emp.login} · {emp.payType} · {emp.isActive ? "active" : "inactive"}
              </div>
            </div>
            {emp.isActive ? (
              <button
                type="button"
                className={btnSecondary}
                onClick={() => void onDeactivate(emp.id, emp.login)}
              >
                Deactivate
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="px-3 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Login</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-neutral-100">
                <td className="px-3 py-3">
                  <Link className="font-medium underline" to={`/admin/employees/${emp.id}`}>
                    {emp.lastName} {emp.firstName}
                  </Link>
                </td>
                <td className="px-3 py-3">{emp.login}</td>
                <td className="px-3 py-3">{emp.payType}</td>
                <td className="px-3 py-3">{emp.isActive ? "active" : "inactive"}</td>
                <td className="px-3 py-3">
                  {emp.isActive ? (
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => void onDeactivate(emp.id, emp.login)}
                    >
                      Deactivate
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dialog
        ref={createDialogRef}
        className="fixed inset-0 z-50 m-auto h-fit max-h-[min(90dvh,40rem)] w-[min(calc(100%-2rem),28rem)] flex-col overflow-hidden rounded border border-neutral-200 bg-white p-0 text-[var(--ts-ink)] shadow-lg backdrop:bg-black/40 open:flex"
        onClose={() => {
          setForm(emptyCreate);
          setCreateError(null);
        }}
        onCancel={(e) => {
          if (createPending) e.preventDefault();
        }}
      >
      <form
        onSubmit={onCreate}
        className="flex min-h-0 max-h-full flex-col"
      >
        <div className="flex flex-col gap-3 overflow-y-auto p-3">
        <h2 className="text-lg font-medium">Create employee</h2>
        {createError ? (
          <p className="text-sm text-red-700" role="alert">
            {createError}
          </p>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          Login
          <input
            className={inputClass}
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
            className={inputClass}
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
              className={inputClass}
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              required
              disabled={createPending}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Last name
            <input
              className={inputClass}
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
            className={inputClass}
            value={form.payType}
            onChange={(e) => setForm((f) => ({ ...f, payType: e.target.value as PayType }))}
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
              className={inputClass}
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
              className={inputClass}
              value={form.monthlySalary}
              onChange={(e) => setForm((f) => ({ ...f, monthlySalary: e.target.value }))}
              required
              disabled={createPending}
            />
          </label>
        )}
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Hours/day
            <input
              className={inputClass}
              value={form.hoursPerDay}
              onChange={(e) => setForm((f) => ({ ...f, hoursPerDay: e.target.value }))}
              required
              disabled={createPending}
            />
            <span className="text-xs text-[var(--ts-mute)]">
              Daily norm. 10 h on an 8 h day is +2 overtime; 6 h is −2.
            </span>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Days/week
            <input
              className={inputClass}
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
          Hired at (UTC date)
          <input
            type="date"
            className={inputClass}
            value={form.hiredAt}
            onChange={(e) => setForm((f) => ({ ...f, hiredAt: e.target.value }))}
            required
            disabled={createPending}
          />
        </label>
        </div>
        <div className="flex gap-2 border-t border-neutral-200 p-3">
          <button
            type="button"
            className={btnSecondary}
            disabled={createPending}
            onClick={closeCreate}
          >
            Cancel
          </button>
          <button type="submit" disabled={createPending} className={btnPrimary}>
            {createPending ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
      </dialog>
    </AppShell>
  );
}
