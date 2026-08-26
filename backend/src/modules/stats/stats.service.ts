import { Decimal } from "decimal.js";
import { prisma } from "../../config/prisma.js";
import {
  calculateMonthBalance,
  calculateMonthlyPay,
  calculatePaidMoney,
  calculateTotalBalance,
} from "../../core/calculations.js";
import { utcMidnight } from "../../core/dateUtils.js";
import { HttpError } from "../../middleware/errorHandler.js";

function monthRangeUtc(year: number, month: number): { gte: Date; lt: Date } {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

function monthIndex(year: number, month: number): number {
  return year * 12 + month;
}

function utcYearMonth(d: Date): { year: number; month: number } {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function ymKey(year: number, month: number): string {
  return `${year}-${month}`;
}

function decStr(value: Decimal): string {
  return value.toString();
}

function monthCountWindow(
  year: number,
  month: number,
  hiredAt: Date,
  today: Date,
): { from: Date; to: Date } | null {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthLast = new Date(Date.UTC(year, month, 0));
  const hired = utcMidnight(hiredAt);
  const todayD = utcMidnight(today);
  const from = hired.getTime() > monthStart.getTime() ? hired : monthStart;
  const to = todayD.getTime() < monthLast.getTime() ? todayD : monthLast;
  if (from.getTime() > to.getTime()) return null;
  return { from, to };
}

function toPayEmployee(employee: {
  payType: "HOURLY" | "SALARY";
  hourlyRate: { toString(): string } | null;
  monthlySalary: { toString(): string } | null;
}) {
  return {
    payType: employee.payType,
    hourlyRate:
      employee.hourlyRate == null ? null : new Decimal(employee.hourlyRate.toString()),
    monthlySalary:
      employee.monthlySalary == null
        ? null
        : new Decimal(employee.monthlySalary.toString()),
  };
}

export async function getEmployeeStats(employeeId: string, year: number, month: number) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: { select: { login: true } } },
  });
  if (!employee) {
    throw new HttpError(404, "Not found");
  }

  const hired = utcYearMonth(employee.hiredAt);
  if (monthIndex(year, month) < monthIndex(hired.year, hired.month)) {
    throw new HttpError(404, "Not found");
  }

  const rangeStart = monthRangeUtc(hired.year, hired.month).gte;
  const rangeEnd = monthRangeUtc(year, month).lt;

  const [shifts, sickDays, overtimePayouts] = await Promise.all([
    prisma.shift.findMany({
      where: {
        employeeId,
        date: { gte: rangeStart, lt: rangeEnd },
      },
      select: { date: true, workedMinutes: true },
    }),
    prisma.sickDay.findMany({
      where: {
        employeeId,
        date: { gte: rangeStart, lt: rangeEnd },
      },
      select: { date: true, creditedHours: true },
    }),
    prisma.overtimePayout.findMany({
      where: {
        employeeId,
        date: { lt: rangeEnd },
      },
      select: { hoursPaid: true, amount: true },
    }),
  ]);

  const shiftsByMonth = new Map<string, { date: Date; workedMinutes: number }[]>();
  for (const s of shifts) {
    const { year: y, month: m } = utcYearMonth(s.date);
    const key = ymKey(y, m);
    const list = shiftsByMonth.get(key) ?? [];
    list.push({ date: s.date, workedMinutes: s.workedMinutes });
    shiftsByMonth.set(key, list);
  }

  const sickByMonth = new Map<string, { date: Date; creditedHours: Decimal }[]>();
  for (const d of sickDays) {
    const { year: y, month: m } = utcYearMonth(d.date);
    const key = ymKey(y, m);
    const list = sickByMonth.get(key) ?? [];
    list.push({ date: d.date, creditedHours: new Decimal(d.creditedHours.toString()) });
    sickByMonth.set(key, list);
  }

  const hoursPerDay = new Decimal(employee.hoursPerDay.toString());
  const today = new Date();
  const monthlyBalances: Decimal[] = [];
  const closedMonthWorkedHours: Decimal[] = [];
  let selected: {
    workedHours: Decimal;
    normHours: Decimal;
    balance: Decimal;
  } | null = null;

  const emptyMonth = {
    workedHours: new Decimal(0),
    normHours: new Decimal(0),
    balance: new Decimal(0),
  };

  for (
    let y = hired.year, m = hired.month;
    monthIndex(y, m) <= monthIndex(year, month);

  ) {
    const key = ymKey(y, m);
    const window = monthCountWindow(y, m, employee.hiredAt, today);
    const monthResult = window
      ? calculateMonthBalance({
          shifts: shiftsByMonth.get(key) ?? [],
          sickDays: sickByMonth.get(key) ?? [],
          hoursPerDay,
          from: window.from,
          to: window.to,
        })
      : emptyMonth;
    monthlyBalances.push(monthResult.balance);
    const monthLast = utcMidnight(new Date(Date.UTC(y, m, 0)));
    if (monthLast.getTime() <= utcMidnight(today).getTime()) {
      closedMonthWorkedHours.push(monthResult.workedHours);
    }
    if (y === year && m === month) {
      selected = monthResult;
    }
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  if (!selected) {
    throw new HttpError(404, "Not found");
  }

  let paidOvertimeHours = new Decimal(0);
  let overtimePayoutAmount = new Decimal(0);
  for (const p of overtimePayouts) {
    paidOvertimeHours = paidOvertimeHours.plus(p.hoursPaid.toString());
    overtimePayoutAmount = overtimePayoutAmount.plus(p.amount.toString());
  }

  const totalBalance = calculateTotalBalance({
    monthlyBalances,
    paidOvertimeHours,
  });

  const payEmployee = toPayEmployee(employee);
  let monthlyPay: Decimal;
  let paid: { total: Decimal; base: Decimal; overtime: Decimal };
  try {
    monthlyPay = calculateMonthlyPay(payEmployee, selected.workedHours);
    paid = calculatePaidMoney({
      employee: payEmployee,
      closedMonthWorkedHours,
      overtimePayoutAmount,
    });
  } catch (err) {
    console.error("pay calculation failed", { employeeId, err });
    throw new HttpError(500, "Internal server error");
  }

  return {
    employeeId: employee.id,
    year,
    month,
    workedHours: decStr(selected.workedHours),
    normHours: decStr(selected.normHours),
    balance: decStr(selected.balance),
    monthlyPay: decStr(monthlyPay),
    totalBalance: decStr(totalBalance),
    paidOvertimeHours: decStr(paidOvertimeHours),
    paidTotal: decStr(paid.total),
    paidBase: decStr(paid.base),
    paidOvertimeAmount: decStr(paid.overtime),
    hoursPerDay: decStr(hoursPerDay),
  };
}

export async function getStatsOverview(year: number, month: number) {
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    include: { user: { select: { login: true } } },
    orderBy: { lastName: "asc" },
  });

  const rows = [];
  for (const employee of employees) {
    const hired = utcYearMonth(employee.hiredAt);
    if (monthIndex(year, month) < monthIndex(hired.year, hired.month)) {
      continue;
    }
    const stats = await getEmployeeStats(employee.id, year, month);
    rows.push({
      employeeId: employee.id,
      login: employee.user.login,
      firstName: employee.firstName,
      lastName: employee.lastName,
      workedHours: stats.workedHours,
      balance: stats.balance,
      monthlyPay: stats.monthlyPay,
    });
  }
  return rows;
}