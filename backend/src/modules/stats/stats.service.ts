import { Decimal } from "decimal.js";
import { prisma } from "../../config/prisma.js";
import {
  calculateHourlyMonthPay,
  calculateMonthBalance,
  calculatePaidMoney,
  calculateTotalBalance,
} from "../../core/calculations.js";
import { monthDateRange, parseYmd, berlinYmd, ymdFromDateColumn, ymdToDateColumn } from "../../core/berlin.js";
import { HttpError } from "../../middleware/errorHandler.js";
import {
  periodsOverlapMonth,
  termsOnYmd,
  type TermsSlice,
} from "../terms/terms.range.js";
import { toSlice } from "../terms/terms.service.js";

function monthIndex(year: number, month: number): number {
  return year * 12 + month;
}

function yearMonthFromDateColumn(d: Date): { year: number; month: number } {
  const { year, month } = parseYmd(ymdFromDateColumn(d));
  return { year, month };
}

function ymKey(year: number, month: number): string {
  return `${year}-${month}`;
}

function decStr(value: Decimal): string {
  return value.toString();
}

function lastYmdOfMonth(year: number, month: number): string {
  return ymdFromDateColumn(new Date(Date.UTC(year, month, 0)));
}

function monthCountWindow(
  year: number, month: number,
  hiredAt: Date,
  todayYmd: string,
): { from: Date; to: Date } | null {
  const monthStartYmd = ymdFromDateColumn(new Date(Date.UTC(year, month - 1, 1)));
  const monthLastYmd = lastYmdOfMonth(year, month);
  const hiredYmd = ymdFromDateColumn(hiredAt);
  const fromYmd = hiredYmd > monthStartYmd ? hiredYmd : monthStartYmd;
  const toYmd = todayYmd < monthLastYmd ? todayYmd : monthLastYmd;
  if (fromYmd > toYmd) return null;
  return { from: ymdToDateColumn(fromYmd), to: ymdToDateColumn(toYmd) };
}

function hoursLookup(periods: TermsSlice[]): (ymd: string) => Decimal {
  return (ymd) => {
    const t = termsOnYmd(periods, ymd);
    if (!t) {
      throw new Error("missing terms");
    }
    return t.hoursPerDay;
  };
}

function payForWindow(
  lastYmd: string,
  hoursByYmd: Map<string, Decimal>,
  periods: TermsSlice[],
): Decimal {
  const last = termsOnYmd(periods, lastYmd);
  if (!last) {
    throw new Error("missing terms");
  }
  if (last.payType === "SALARY") {
    if (last.monthlySalary == null) {
      throw new Error("SALARY employee missing monthlySalary");
    }
    return last.monthlySalary;
  }
  return calculateHourlyMonthPay(hoursByYmd, (ymd) => {
    const t = termsOnYmd(periods, ymd);
    if (!t || t.payType !== "HOURLY") return new Decimal(0);
    return t.hourlyRate;
  });
}

function serializeTerm(period: TermsSlice) {
  return {
    payType: period.payType,
    hourlyRate: period.hourlyRate?.toString() ?? null,
    monthlySalary: period.monthlySalary?.toString() ?? null,
    hoursPerDay: period.hoursPerDay.toString(),
    validFrom: period.validFrom,
    validTo: period.validTo,
  };
}

export async function getEmployeeStats(employeeId: string, year: number, month: number) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      user: { select: { login: true } },
      terms: { orderBy: { validFrom: "asc" } },
    },
  });
  if (!employee) {
    throw new HttpError(404, "Not found");
  }

  const hired = yearMonthFromDateColumn(employee.hiredAt);
  if (monthIndex(year, month) < monthIndex(hired.year, hired.month)) {
    throw new HttpError(404, "Not found");
  }

  const periods = employee.terms.map(toSlice);
  const rangeStart = monthDateRange(hired.year, hired.month).gte;
  const rangeEnd = monthDateRange(year, month).lt;

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
      select: { date: true },
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
    const { year: y, month: m } = yearMonthFromDateColumn(s.date);
    const key = ymKey(y, m);
    const list = shiftsByMonth.get(key) ?? [];
    list.push({ date: s.date, workedMinutes: s.workedMinutes });
    shiftsByMonth.set(key, list);
  }

  const sickByMonth = new Map<string, { date: Date }[]>();
  for (const d of sickDays) {
    const { year: y, month: m } = yearMonthFromDateColumn(d.date);
    const key = ymKey(y, m);
    const list = sickByMonth.get(key) ?? [];
    list.push({ date: d.date });
    sickByMonth.set(key, list);
  }

  const todayYmd = berlinYmd(new Date());
  const todayTerms = termsOnYmd(periods, todayYmd) ?? termsOnYmd(periods, ymdFromDateColumn(employee.hiredAt));
  if (!todayTerms) {
    throw new HttpError(500, "Internal server error");
  }
  const hoursPerDay = todayTerms.hoursPerDay;
  const monthlyBalances: Decimal[] = [];
  const closedMonthPays: Decimal[] = [];
  let selected: {
    workedHours: Decimal;
    normHours: Decimal;
    balance: Decimal;
    hoursByYmd: Map<string, Decimal>;
  } | null = null;
  let monthlyPay = new Decimal(0);

  const emptyMonth = {
    workedHours: new Decimal(0),
    normHours: new Decimal(0),
    balance: new Decimal(0),
    hoursByYmd: new Map<string, Decimal>(),
  };

  try {
    for (
      let y = hired.year, m = hired.month;
      monthIndex(y, m) <= monthIndex(year, month);

    ) {
      const key = ymKey(y, m);
      const window = monthCountWindow(y, m, employee.hiredAt, todayYmd);
      const monthResult = window
        ? calculateMonthBalance({
            shifts: shiftsByMonth.get(key) ?? [],
            sickDays: sickByMonth.get(key) ?? [],
            hoursPerDay: hoursLookup(periods),
            from: window.from,
            to: window.to,
          })
        : emptyMonth;
      monthlyBalances.push(monthResult.balance);
      if (window && lastYmdOfMonth(y, m) <= todayYmd) {
        closedMonthPays.push(
          payForWindow(ymdFromDateColumn(window.to), monthResult.hoursByYmd, periods),
        );
      }
      if (y === year && m === month) {
        selected = monthResult;
        if (window) {
          monthlyPay = payForWindow(
            ymdFromDateColumn(window.to),
            monthResult.hoursByYmd,
            periods,
          );
        }
      }
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  } catch (err) {
    console.error("pay calculation failed", { employeeId, err });
    throw new HttpError(500, "Internal server error");
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

  let paid: { total: Decimal; base: Decimal; overtime: Decimal };
  try {
    paid = calculatePaidMoney({
      closedMonthPays,
      overtimePayoutAmount,
    });
  } catch (err) {
    console.error("pay calculation failed", { employeeId, err });
    throw new HttpError(500, "Internal server error");
  }

  const monthStartYmd = ymdFromDateColumn(new Date(Date.UTC(year, month - 1, 1)));
  const monthEndYmd = lastYmdOfMonth(year, month);
  const monthTerms = periods
    .filter((p) => periodsOverlapMonth(p, monthStartYmd, monthEndYmd))
    .map(serializeTerm);

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
    terms: monthTerms,
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
    const hired = yearMonthFromDateColumn(employee.hiredAt);
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
