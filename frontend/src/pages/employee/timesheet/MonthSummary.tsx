import { useI18n } from "../../../i18n/useI18n";
import { formatHours } from "../../../lib/timesheet";
import type { EmployeeStats } from "../../../types/api";

export function MonthSummary({
  compact,
  worked,
  norm,
  pct,
  stats,
}: {
  compact: boolean;
  worked: number;
  norm: number;
  pct: number;
  stats: EmployeeStats | null;
}) {
  const { t } = useI18n();
  if (compact) {
    return (
      <div className="mb-5 rounded-[20px] bg-[var(--ts-fill)] px-[18px] py-4 md:hidden">
        <div className="flex items-baseline justify-between gap-2.5">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="whitespace-nowrap text-2xl font-bold tracking-tight">
              {formatHours(worked)}
            </span>
            <span className="text-xs text-[var(--ts-mute)]">
              {t("workedOf")} {formatHours(norm)} {t("norm")}
            </span>
          </div>
          <span className="whitespace-nowrap text-xs text-[var(--ts-mute)]">{Math.round(pct)}%</span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--ts-line)]">
          <div className="h-full rounded-full bg-[var(--ts-ink)]" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2.5 flex items-baseline gap-2 text-xs text-[var(--ts-mute)]">
          <span>{t("totalBalance")}</span>
          <span className="whitespace-nowrap text-[13.5px] font-bold text-[var(--ts-ink)]">
            {stats ? formatHours(Number(stats.totalBalance)) : "—"}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="ml-auto hidden min-w-0 flex-1 items-center gap-4 rounded-[18px] bg-[var(--ts-fill)] px-4 py-3 md:flex md:max-w-[520px]">
      <div className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-xl font-bold tracking-tight">{formatHours(worked)}</span>
        <span className="text-xs text-[var(--ts-mute)]">
          {t("ofNorm")} {formatHours(norm)} {t("norm")}
        </span>
      </div>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--ts-line)]">
        <div className="h-full rounded-full bg-[var(--ts-ink)]" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-xs text-[var(--ts-mute)]">{t("balance")}</span>
        <span className="text-[13.5px] font-bold">
          {stats ? formatHours(Number(stats.totalBalance)) : "—"}
        </span>
      </div>
    </div>
  );
}
