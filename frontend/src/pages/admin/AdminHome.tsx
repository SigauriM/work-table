import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import { statsOverview } from "../../api/stats";
import { AppShell } from "../../components/AppShell";
import { adminNav } from "../../components/nav";
import { MonthPicker } from "../../components/MonthPicker";
import { useYearMonth } from "../../hooks/useYearMonth";
import type { OverviewRow } from "../../types/api";

export default function AdminHome() {
  const { year, month, setYearMonth } = useYearMonth();
  const [overview, setOverview] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isCancelled?: () => boolean) => {
    try {
      const data = await statsOverview(year, month);
      if (isCancelled?.()) return;
      setOverview(data);
      setError(null);
    } catch (err) {
      if (isCancelled?.()) return;
      setOverview([]);
      setError(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      if (!isCancelled?.()) setLoading(false);
    }
  }, [year, month]);

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

  const empty = overview.length === 0 && !loading;

  return (
    <AppShell title="Overview" nav={adminNav}>
      <MonthPicker year={year} month={month} onChange={setYearMonth} />
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-neutral-500">Loading…</p> : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">
          {year}-{month}
        </h2>
        <ul className="flex flex-col gap-2 md:hidden">
          {overview.map((row) => (
            <li
              key={row.employeeId}
              className="rounded border border-neutral-200 bg-white p-3 text-sm"
            >
              <Link
                className="font-medium underline"
                to={`/admin/employees/${row.employeeId}`}
              >
                {row.lastName} {row.firstName}
              </Link>
              <div className="text-neutral-600">
                {row.login} · worked {row.workedHours} · bal {row.balance} · pay{" "}
                {row.monthlyPay}
              </div>
            </li>
          ))}
          {empty ? <li className="text-sm text-neutral-500">No rows</li> : null}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Login</th>
                <th className="px-3 py-3 font-medium">Worked</th>
                <th className="px-3 py-3 font-medium">Balance</th>
                <th className="px-3 py-3 font-medium">Pay</th>
              </tr>
            </thead>
            <tbody>
              {overview.map((row) => (
                <tr key={row.employeeId} className="border-b border-neutral-100">
                  <td className="px-3 py-3">
                    <Link
                      className="font-medium underline"
                      to={`/admin/employees/${row.employeeId}`}
                    >
                      {row.lastName} {row.firstName}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{row.login}</td>
                  <td className="px-3 py-3">{row.workedHours}</td>
                  <td className="px-3 py-3">{row.balance}</td>
                  <td className="px-3 py-3">{row.monthlyPay}</td>
                </tr>
              ))}
              {empty ? (
                <tr>
                  <td className="px-3 py-3 text-neutral-500" colSpan={5}>
                    No rows
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
