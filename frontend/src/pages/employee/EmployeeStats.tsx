import { useCallback, useEffect, useState } from "react";
import { meStats } from "../../api/stats";
import { useAuth } from "../../auth/useAuth";
import { AppShell } from "../../components/AppShell";
import { employeeNav } from "../../components/nav";
import { MonthPicker } from "../../components/MonthPicker";
import { StatsBlock } from "../../components/StatsBlock";
import { useYearMonth } from "../../hooks/useYearMonth";
import { apiErrorText } from "../../i18n/apiErrorText";
import { useI18n } from "../../i18n/useI18n";
import type { EmployeeStats } from "../../types/api";

export default function EmployeeStatsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const { year, month, setYearMonth } = useYearMonth();
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isCancelled?: () => boolean) => {
    if (!employeeId) return;
    try {
      const data = await meStats(year, month);
      if (isCancelled?.()) return;
      setStats(data);
      setError(null);
    } catch (err) {
      if (isCancelled?.()) return;
      setStats(null);
      setError(apiErrorText(err, t, t("failedLoad")));
    } finally {
      if (!isCancelled?.()) setLoading(false);
    }
  }, [employeeId, year, month, t]);

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
