import { Decimal } from "decimal.js";
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

/**
 * balance = отработано (смены + больничные) − норма.
 * Плюс = переработка, минус = недоработка, ноль = ровно норма.
 */
export function calculateMonthBalance(input: {
  shifts: { workedMinutes: number }[];
  sickDays: { creditedHours: Decimal }[];
  hoursPerMonth: Decimal;
}): { workedHours: Decimal; normHours: Decimal; balance: Decimal } {
  const fromShifts = input.shifts.reduce(
    (sum, s) => sum + s.workedMinutes,
    0,
  );
  let workedHours = new Decimal(fromShifts).div(60);
  for (const day of input.sickDays) {
    workedHours = workedHours.plus(day.creditedHours);
  }
  const normHours = new Decimal(input.hoursPerMonth);
  const balance = workedHours.minus(normHours);
  return { workedHours, normHours, balance };
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