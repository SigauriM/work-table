import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { getEmployee } from "../../api/employees";
import { deleteShift, listShiftsPage } from "../../api/shifts";
import { AppShell } from "../../components/AppShell";
import { adminNav } from "../../components/nav";
import { ShiftList } from "../../components/ShiftList";
import type { Employee, Shift } from "../../types/api";
import { btnSecondary } from "../../ui";

export default function EmployeeShifts() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isCancelled?: () => boolean) => {
    if (!id) return;
    try {
      const [emp, page] = await Promise.all([
        getEmployee(id),
        listShiftsPage({ employeeId: id }),
      ]);
      if (isCancelled?.()) return;
      setEmployee(emp);
      setShifts(page.items);
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      if (isCancelled?.()) return;
      setEmployee(null);
      setShifts([]);
      setNextCursor(null);
      setError(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      if (!isCancelled?.()) setLoading(false);
    }
  }, [id]);

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

  async function onDeleteShift(shiftId: string) {
    if (!window.confirm("Delete this shift?")) return;
    try {
      await deleteShift(shiftId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  async function onLoadMore() {
    if (!id || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listShiftsPage({ employeeId: id, cursor: nextCursor });
      setShifts((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoadingMore(false);
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
        {nextCursor ? (
          <button
            type="button"
            className={btnSecondary}
            disabled={loadingMore}
            onClick={() => void onLoadMore()}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </section>
    </AppShell>
  );
}
