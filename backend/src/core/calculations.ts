import { Decimal } from "decimal.js";
import { differenceInMinutes, isUtcWeekendDate, utcDateKey, utcMidnight } from "./dateUtils.js";

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

/**
 * Per calendar day: hours that day − daily norm.
 * Workdays (Mon–Fri UTC) use hoursPerDay; weekends 0.
 * Days with no shift/sick still count if they fall in [from, to].
 * Plus = overtime, minus = undertime.
 */
export function calculateMonthBalance(input: {
  shifts: { date: Date; workedMinutes: number }[];
  sickDays: { date: Date; creditedHours: Decimal }[];
  hoursPerDay: Decimal;
  from: Date;
  to: Date;
}): { workedHours: Decimal; normHours: Decimal; balance: Decimal } {
  const hoursByDay = new Map<string, Decimal>();
  const add = (date: Date, hours: Decimal) => {
    const key = utcDateKey(date);
    hoursByDay.set(key, (hoursByDay.get(key) ?? new Decimal(0)).plus(hours));
  };
  for (const s of input.shifts) {
    add(s.date, new Decimal(s.workedMinutes).div(60));
  }
  for (const d of input.sickDays) {
    add(d.date, d.creditedHours);
  }

  let workedHours = new Decimal(0);
  let normHours = new Decimal(0);
  const from = utcMidnight(input.from);
  const to = utcMidnight(input.to);
  if (from.getTime() > to.getTime()) {
    return { workedHours, normHours, balance: new Decimal(0) };
  }

  for (let t = from.getTime(); t <= to.getTime(); t += 24 * 60 * 60 * 1000) {
    const day = new Date(t);
    const hours = hoursByDay.get(utcDateKey(day)) ?? new Decimal(0);
    const norm = isUtcWeekendDate(day) ? new Decimal(0) : input.hoursPerDay;
    workedHours = workedHours.plus(hours);
    normHours = normHours.plus(norm);
  }

  return { workedHours, normHours, balance: workedHours.minus(normHours) };
}

/** Сумма месячных балансов минус выплаченные сверхурочные. Может быть < 0 (переплата). */
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
 * SALARY → monthlySalary (workedHours игнорируется)
 * Нет нужной ставки → throw (испорченные данные, не молчаливый 0).
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
 * Money already paid through closed months + overtime payout amounts.
 * A closed month is decided by the caller (last UTC day of that month has passed).
 * HOURLY base = sum(hours × rate) over closed months.
 * SALARY base = monthlySalary × number of closed months.
 * Overtime = sum of overtime payout amounts (not hours × rate).
 */
export function calculatePaidMoney(input: {
  employee: PayEmployee;
  closedMonthWorkedHours: Decimal[];
  overtimePayoutAmount: Decimal;
}): { total: Decimal; base: Decimal; overtime: Decimal } {
  const overtime = new Decimal(input.overtimePayoutAmount);
  let base = new Decimal(0);
  if (input.employee.payType === "HOURLY") {
    if (input.employee.hourlyRate == null) {
      throw new Error("HOURLY employee missing hourlyRate");
    }
    for (const hours of input.closedMonthWorkedHours) {
      base = base.plus(hours.times(input.employee.hourlyRate));
    }
  } else {
    if (input.employee.monthlySalary == null) {
      throw new Error("SALARY employee missing monthlySalary");
    }
    base = new Decimal(input.employee.monthlySalary).times(
      input.closedMonthWorkedHours.length,
    );
  }
  return { total: base.plus(overtime), base, overtime };
}