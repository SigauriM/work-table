import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { meStats } from "../../api/stats";
import { useAuth } from "../../auth/AuthContext";
import { AppShell, employeeNav } from "../../components/AppShell";
import { MonthPicker } from "../../components/MonthPicker";
import { StatsBlock } from "../../components/StatsBlock";
import { useYearMonth } from "../../hooks/useYearMonth";
import type { EmployeeStats } from "../../types/api";

export default function EmployeeStatsPage() {
  const { user } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const { year, month, setYearMonth } = useYearMonth();
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      setStats(await meStats(year, month));
    } catch (err) {
      setStats(null);
      setError(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [employeeId, year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell title="Stats" nav={employeeNav}>
      {!employeeId ? <p>No employee profile.</p> : null}
      <MonthPicker year={year} month={month} onChange={setYearMonth} />
      {error ? (
        <p className="text-sm text-[var(--ts-under)]" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-[var(--ts-mute)]">Loading…</p> : null}
      <StatsBlock stats={stats} />
    </AppShell>
  );
}
