import type { EmployeeStats } from "../types/api";

export function StatsBlock({ stats }: { stats: EmployeeStats | null }) {
  if (!stats) {
    return <p className="text-sm text-[var(--ts-mute)]">No stats</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-3 text-sm">
      <li>
        <div className="text-[var(--ts-mute)]">Worked</div>
        <div className="text-lg font-bold tracking-tight">{stats.workedHours} h</div>
      </li>
      <li>
        <div className="text-[var(--ts-mute)]">Norm</div>
        <div className="text-lg font-bold tracking-tight">{stats.normHours} h</div>
      </li>
      <li>
        <div className="text-[var(--ts-mute)]">Month balance</div>
        <div className="text-lg font-bold tracking-tight">{stats.balance} h</div>
        <p className="mt-1 text-xs text-[var(--ts-mute)]">
          Plus = overtime, minus = undertime.
        </p>
      </li>
      <li>
        <div className="text-[var(--ts-mute)]">Pay</div>
        <div className="text-lg font-bold tracking-tight">{stats.monthlyPay}</div>
      </li>
      <li className="col-span-2 rounded-[18px] bg-[var(--ts-fill)] px-4 py-3">
        <div className="text-[var(--ts-mute)]">Paid</div>
        <div className="text-lg font-bold tracking-tight">{stats.paidTotal}</div>
        <p className="mt-1 text-xs text-[var(--ts-mute)]">
          Base {stats.paidBase} · Overtime {stats.paidOvertimeAmount}
        </p>
        <p className="mt-1 text-xs text-[var(--ts-mute)]">
          Through the end of this month. A month is paid on its last day. Hourly
          base is hours × rate; salary is salary × closed months. Overtime is
          payout amounts.
        </p>
      </li>
      <li className="col-span-2 rounded-[18px] bg-[var(--ts-fill)] px-4 py-3">
        <div className="text-[var(--ts-mute)]">Paid overtime</div>
        <div className="text-lg font-bold tracking-tight">{stats.paidOvertimeHours} h</div>
        <p className="mt-1 text-xs text-[var(--ts-mute)]">
          Hours already paid out, counted through the end of this month.
        </p>
      </li>
      <li className="col-span-2 rounded-[18px] bg-[var(--ts-fill)] px-4 py-3">
        <div className="text-[var(--ts-mute)]">Total balance</div>
        <div className="text-lg font-bold tracking-tight">{stats.totalBalance} h</div>
        <p className="mt-1 text-xs text-[var(--ts-mute)]">
          Running bank from hire through this month, minus paid overtime. Plus =
          overtime left to pay, minus = undertime. Paying overtime subtracts
          hours; it does not fix a negative (undertime) balance.
        </p>
      </li>
    </ul>
  );
}
