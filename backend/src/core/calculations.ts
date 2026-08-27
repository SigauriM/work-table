import { Decimal } from "decimal.js";
import { isWeekendYmd, nextBerlinYmd, ymdFromDateColumn } from "./berlin.js";
import { differenceInMinutes } from "./dateUtils.js";

export type ShiftForMinutes = {
  startTime: Date;
  endTime: Date;
  breakStart?: Date | null;
  breakEnd?: Date | null;
};

export type PayEmployee = {
  payType: "HOURLY" | "SALARY";
  hourlyRate: Decimal | null;
  monthlySalary: Decimal | null;
};

export function calculateWorkedMinutes(shift: ShiftForMinutes): number {
  const total = differenceInMinutes(shift.endTime, shift.startTime);
  const breakMin =
    shift.breakStart && shift.breakEnd
      ? differenceInMinutes(shift.breakEnd, shift.breakStart)
      : 0;
  return Math.max(0, total - breakMin);
}

/** Workdays (Mon–Fri) use the day's hoursPerDay; weekends 0. */
export function hoursPerDayForYmd(
  dayYmd: string,
  hoursPerDay: (ymd: string) => Decimal,
): Decimal {
  return isWeekendYmd(dayYmd) ? new Decimal(0) : hoursPerDay(dayYmd);
}

/**
 * Per calendar day: hours that day − daily norm.
 * Workdays (Mon–Fri) use hoursPerDay for that YMD; weekends 0.
 * Sick credit is that day's norm (weekend sick = 0).
 * Days with no shift/sick still count if they fall in [from, to].
 * Plus = overtime, minus = undertime.
 * Iterate civil YMD, not +24h on instants (DST).
 */
export function calculateMonthBalance(input: {
  shifts: { date: Date; workedMinutes: number }[];
  sickDays: { date: Date }[];
  hoursPerDay: (ymd: string) => Decimal;
  from: Date;
  to: Date;
}): {
  workedHours: Decimal;
  normHours: Decimal;
  balance: Decimal;
  hoursByYmd: Map<string, Decimal>;
} {
  const hoursByDay = new Map<string, Decimal>();
  const add = (date: Date, hours: Decimal) => {
    const key = ymdFromDateColumn(date);
    hoursByDay.set(key, (hoursByDay.get(key) ?? new Decimal(0)).plus(hours));
  };
  for (const s of input.shifts) {
    add(s.date, new Decimal(s.workedMinutes).div(60));
  }
  for (const d of input.sickDays) {
    const dayYmd = ymdFromDateColumn(d.date);
    add(d.date, hoursPerDayForYmd(dayYmd, input.hoursPerDay));
  }

  let workedHours = new Decimal(0);
  let normHours = new Decimal(0);
  const fromYmd = ymdFromDateColumn(input.from);
  const toYmd = ymdFromDateColumn(input.to);
  if (fromYmd > toYmd) {
    return { workedHours, normHours, balance: new Decimal(0), hoursByYmd: hoursByDay };
  }

  for (let dayYmd = fromYmd; dayYmd <= toYmd; dayYmd = nextBerlinYmd(dayYmd)) {
    const hours = hoursByDay.get(dayYmd) ?? new Decimal(0);
    const norm = hoursPerDayForYmd(dayYmd, input.hoursPerDay);
    workedHours = workedHours.plus(hours);
    normHours = normHours.plus(norm);
  }

  return { workedHours, normHours, balance: workedHours.minus(normHours), hoursByYmd: hoursByDay };
}

/** Sum of monthly balances minus paid overtime hours. May be < 0 (overpayment). */
export function calculateTotalBalance(input: {
  monthlyBalances: Decimal[];
  paidOvertimeHours: Decimal;
}): Decimal {
  let total = new Decimal(0);
  for (const b of input.monthlyBalances) {
    total = total.plus(b);
  }
  return total.minus(input.paidOvertimeHours);
}

/**
 * HOURLY → workedHours × hourlyRate
 * SALARY → monthlySalary (workedHours ignored)
 * Missing rate → throw (corrupt data, not a silent 0).
 */
export function calculateMonthlyPay(
  employee: PayEmployee,
  workedHours: Decimal,
): Decimal {
  if (employee.payType === "HOURLY") {
    if (employee.hourlyRate == null) {
      throw new Error("HOURLY employee missing hourlyRate");
    }
    return workedHours.times(employee.hourlyRate);
  }
  if (employee.monthlySalary == null) {
    throw new Error("SALARY employee missing monthlySalary");
  }
  return new Decimal(employee.monthlySalary);
}

/**
 * HOURLY month: each day's hours × that day's rate.
 * Caller returns Decimal(0) for SALARY days in a mixed HOURLY month.
 * Null rate on a day with hours → throw.
 */
export function calculateHourlyMonthPay(
  hoursByYmd: Map<string, Decimal>,
  hourlyRate: (ymd: string) => Decimal | null,
): Decimal {
  let total = new Decimal(0);
  for (const [ymd, hours] of hoursByYmd) {
    if (hours.lte(0)) continue;
    const rate = hourlyRate(ymd);
    if (rate == null) {
      throw new Error("HOURLY employee missing hourlyRate");
    }
    total = total.plus(hours.times(rate));
  }
  return total;
}

/**
 * Money already paid through closed months + overtime payout amounts.
 * A closed month is decided by the caller (last calendar day of that month
 * ≤ today in Europe/Berlin). Each closed month's pay is already computed
 * from that month's terms (not today's rate × all months).
 */
export function calculatePaidMoney(input: {
  closedMonthPays: Decimal[];
  overtimePayoutAmount: Decimal;
}): { total: Decimal; base: Decimal; overtime: Decimal } {
  const overtime = new Decimal(input.overtimePayoutAmount);
  let base = new Decimal(0);
  for (const pay of input.closedMonthPays) {
    base = base.plus(pay);
  }
  return { total: base.plus(overtime), base, overtime };
}
