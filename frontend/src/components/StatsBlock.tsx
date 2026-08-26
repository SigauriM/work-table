import type { EmployeeStats } from "../types/api";

export function StatsBlock({ stats }: { stats: EmployeeStats | null }) {
  if (!stats) {
    return <p className="text-sm text-neutral-500">No stats</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-3 text-sm">
      <li>
        <div className="text-neutral-500">Worked</div>
        <div>{stats.workedHours} h</div>
      </li>
      <li>
        <div className="text-neutral-500">Norm</div>
        <div>{stats.normHours} h</div>
      </li>
      <li>
        <div className="text-neutral-500">Month balance</div>
        <div>{stats.balance} h</div>
        <p className="mt-1 text-xs text-neutral-500">
          Plus = overtime, minus = undertime.
        </p>
      </li>
      <li>
        <div className="text-neutral-500">Pay</div>
        <div>{stats.monthlyPay}</div>
      </li>
      <li className="col-span-2">
        <div className="text-neutral-500">Paid overtime</div>
        <div>{stats.paidOvertimeHours} h</div>
        <p className="mt-1 text-xs text-neutral-500">
          Hours already paid out, counted through the end of this month.
        </p>
      </li>
      <li className="col-span-2">
        <div className="text-neutral-500">Total balance</div>
        <div>{stats.totalBalance} h</div>
        <p className="mt-1 text-xs text-neutral-500">
          Running bank from hire through this month, minus paid overtime. Plus =
          overtime left to pay, minus = undertime. Paying overtime subtracts
          hours; it does not fix a negative (undertime) balance.
        </p>
      </li>
    </ul>
  );
}
