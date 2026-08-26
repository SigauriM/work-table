import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { getEmployee } from "../../api/employees";
import { deleteShift, listShifts } from "../../api/shifts";
import { AppShell, adminNav } from "../../components/AppShell";
import { ShiftList } from "../../components/ShiftList";
import type { Employee, Shift } from "../../types/api";

export default function EmployeeShifts() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [emp, sh] = await Promise.all([
        getEmployee(id),
        listShifts({ employeeId: id }),
      ]);
      setEmployee(emp);
      setShifts(sh);
    } catch (err) {
      setEmployee(null);
      setShifts([]);
      setError(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDeleteShift(shiftId: string) {
    if (!window.confirm("Delete this shift?")) return;
    try {
      await deleteShift(shiftId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  const title = employee ? `${employee.lastName} ${employee.firstName}` : "Employee";

  return (
    <AppShell title={`${title} — Shifts`} nav={adminNav}>
      <div>
        <Link
          to={id ? `/admin/employees/${id}` : "/admin/employees"}
          className="inline-flex min-h-11 items-center text-sm underline"
        >
          ← {title}
        </Link>
        {employee ? (
          <p className="text-sm text-neutral-600">{employee.login}</p>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-neutral-500">Loading…</p> : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Shifts</h2>
        <ShiftList shifts={shifts} loading={loading} onDelete={onDeleteShift} />
      </section>
    </AppShell>
  );
}
