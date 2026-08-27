import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";
import {
  calculateHourlyMonthPay,
  calculateMonthBalance,
  calculateMonthlyPay,
  calculatePaidMoney,
  calculateTotalBalance,
  calculateWorkedMinutes,
} from "../src/core/calculations.js";

function at(iso: string): Date {
  return new Date(iso);
}

describe("calculateWorkedMinutes", () => {
  it("смена без перерыва", () => {
    expect(
      calculateWorkedMinutes({
        startTime: at("2024-01-15T09:00:00.000Z"),
        endTime: at("2024-01-15T17:00:00.000Z"),
      }),
    ).toBe(480);
  });

  it("смена с перерывом 30 минут", () => {
    expect(
      calculateWorkedMinutes({
        startTime: at("2024-01-15T09:00:00.000Z"),
        endTime: at("2024-01-15T17:00:00.000Z"),
        breakStart: at("2024-01-15T12:00:00.000Z"),
        breakEnd: at("2024-01-15T12:30:00.000Z"),
      }),
    ).toBe(450);
  });

  it("перерыв длиннее смены → 0", () => {
    expect(
      calculateWorkedMinutes({
        startTime: at("2024-01-15T09:00:00.000Z"),
        endTime: at("2024-01-15T10:00:00.000Z"),
        breakStart: at("2024-01-15T08:00:00.000Z"),
        breakEnd: at("2024-01-15T12:00:00.000Z"),
      }),
    ).toBe(0);
  });

  it("смена через полночь: 22:00 → 06:00 следующего дня = 480 минут", () => {
    expect(
      calculateWorkedMinutes({
        startTime: at("2024-01-16T22:00:00.000Z"),
        endTime: at("2024-01-17T06:00:00.000Z"),
      }),
    ).toBe(480);
  });
});

describe("calculateMonthBalance", () => {
  const hoursPerDay = new Decimal("8");
  const hours = () => hoursPerDay;
  const wed = at("2026-08-12T00:00:00.000Z");
  const thu = at("2026-08-13T00:00:00.000Z");
  const sat = at("2026-08-15T00:00:00.000Z");

  it("10 h on an 8 h workday → +2", () => {
    const r = calculateMonthBalance({
      shifts: [{ date: wed, workedMinutes: 10 * 60 }],
      sickDays: [],
      hoursPerDay: hours,
      from: wed,
      to: wed,
    });
    expect(r.workedHours.toString()).toBe("10");
    expect(r.normHours.toString()).toBe("8");
    expect(r.balance.toString()).toBe("2");
  });

  it("6 h on an 8 h workday → −2", () => {
    const r = calculateMonthBalance({
      shifts: [{ date: wed, workedMinutes: 6 * 60 }],
      sickDays: [],
      hoursPerDay: hours,
      from: wed,
      to: wed,
    });
    expect(r.balance.toString()).toBe("-2");
  });

  it("empty workday in range still takes the daily norm", () => {
    const r = calculateMonthBalance({
      shifts: [],
      sickDays: [],
      hoursPerDay: hours,
      from: wed,
      to: wed,
    });
    expect(r.workedHours.toString()).toBe("0");
    expect(r.normHours.toString()).toBe("8");
    expect(r.balance.toString()).toBe("-8");
  });

  it("weekend has 0 norm; a shift is all overtime", () => {
    const r = calculateMonthBalance({
      shifts: [{ date: sat, workedMinutes: 10 * 60 }],
      sickDays: [],
      hoursPerDay: hours,
      from: sat,
      to: sat,
    });
    expect(r.normHours.toString()).toBe("0");
    expect(r.balance.toString()).toBe("10");
  });

  it("sick day credited at that day's norm → on norm", () => {
    const r = calculateMonthBalance({
      shifts: [],
      sickDays: [{ date: thu }],
      hoursPerDay: hours,
      from: thu,
      to: thu,
    });
    expect(r.workedHours.toString()).toBe("8");
    expect(r.balance.toString()).toBe("0");
  });

  it("weekend sick day is 0 hours and 0 norm", () => {
    const r = calculateMonthBalance({
      shifts: [],
      sickDays: [{ date: sat }],
      hoursPerDay: hours,
      from: sat,
      to: sat,
    });
    expect(r.workedHours.toString()).toBe("0");
    expect(r.normHours.toString()).toBe("0");
    expect(r.balance.toString()).toBe("0");
  });

  it("uses each day's hoursPerDay, not a single current value", () => {
    const r = calculateMonthBalance({
      shifts: [],
      sickDays: [],
      hoursPerDay: (ymd) => (ymd < "2026-08-13" ? new Decimal("8") : new Decimal("6")),
      from: wed,
      to: thu,
    });
    expect(r.normHours.toString()).toBe("14");
    expect(r.balance.toString()).toBe("-14");
  });

  it("from after to → zeros", () => {
    const r = calculateMonthBalance({
      shifts: [{ date: wed, workedMinutes: 480 }],
      sickDays: [],
      hoursPerDay: hours,
      from: thu,
      to: wed,
    });
    expect(r.workedHours.toString()).toBe("0");
    expect(r.normHours.toString()).toBe("0");
    expect(r.balance.toString()).toBe("0");
  });

  it("YMD loop keeps all days across the 2026 spring DST change", () => {
    const r = calculateMonthBalance({
      shifts: [],
      sickDays: [],
      hoursPerDay: hours,
      from: at("2026-03-28T00:00:00.000Z"),
      to: at("2026-03-30T00:00:00.000Z"),
    });
    expect(r.workedHours.toString()).toBe("0");
    expect(r.normHours.toString()).toBe("8");
    expect(r.balance.toString()).toBe("-8");
  });
});

describe("calculateTotalBalance", () => {
  it("сумма месяцев минус выплаченные сверхурочные", () => {
    const total = calculateTotalBalance({
      monthlyBalances: [new Decimal("20"), new Decimal("-10")],
      paidOvertimeHours: new Decimal("5"),
    });
    expect(total.toString()).toBe("5");
  });

  it("выплачено больше накопленного → отрицательный итог (переплата)", () => {
    const total = calculateTotalBalance({
      monthlyBalances: [new Decimal("10")],
      paidOvertimeHours: new Decimal("30"),
    });
    expect(total.toString()).toBe("-20");
  });
});

describe("calculateMonthlyPay", () => {
  it("HOURLY: часы × ставка", () => {
    const pay = calculateMonthlyPay(
      {
        payType: "HOURLY",
        hourlyRate: new Decimal("12.50"),
        monthlySalary: null,
      },
      new Decimal("160"),
    );
    expect(pay.toString()).toBe("2000");
  });

  it("HOURLY: ноль часов → 0", () => {
    const pay = calculateMonthlyPay(
      {
        payType: "HOURLY",
        hourlyRate: new Decimal("12.50"),
        monthlySalary: null,
      },
      new Decimal("0"),
    );
    expect(pay.toString()).toBe("0");
  });

  it("SALARY: фиксированный оклад, часы игнорируются", () => {
    const emp = {
      payType: "SALARY" as const,
      hourlyRate: null,
      monthlySalary: new Decimal("2000"),
    };
    expect(calculateMonthlyPay(emp, new Decimal("0")).toString()).toBe("2000");
    expect(calculateMonthlyPay(emp, new Decimal("200")).toString()).toBe("2000");
  });

  it("HOURLY без ставки → throw", () => {
    expect(() =>
      calculateMonthlyPay(
        { payType: "HOURLY", hourlyRate: null, monthlySalary: null },
        new Decimal("10"),
      ),
    ).toThrow(/hourlyRate/);
  });

  it("SALARY без оклада → throw", () => {
    expect(() =>
      calculateMonthlyPay(
        { payType: "SALARY", hourlyRate: null, monthlySalary: null },
        new Decimal("10"),
      ),
    ).toThrow(/monthlySalary/);
  });
});

describe("calculateHourlyMonthPay", () => {
  it("sums each day's hours × that day's rate", () => {
    const hours = new Map<string, Decimal>([
      ["2026-08-12", new Decimal("8")],
      ["2026-08-13", new Decimal("10")],
    ]);
    const pay = calculateHourlyMonthPay(hours, (ymd) =>
      ymd < "2026-08-13" ? new Decimal("10") : new Decimal("12"),
    );
    expect(pay.toString()).toBe("200");
  });

  it("SALARY days contribute 0 in an HOURLY month", () => {
    const hours = new Map<string, Decimal>([
      ["2026-08-12", new Decimal("8")],
      ["2026-08-13", new Decimal("8")],
    ]);
    const pay = calculateHourlyMonthPay(hours, (ymd) =>
      ymd < "2026-08-13" ? new Decimal("10") : new Decimal(0),
    );
    expect(pay.toString()).toBe("80");
  });
});

describe("calculatePaidMoney", () => {
  it("sums already computed closed-month pays plus overtime payout amounts", () => {
    const r = calculatePaidMoney({
      closedMonthPays: [new Decimal("2000"), new Decimal("1000")],
      overtimePayoutAmount: new Decimal("100"),
    });
    expect(r.base.toString()).toBe("3000");
    expect(r.overtime.toString()).toBe("100");
    expect(r.total.toString()).toBe("3100");
  });

  it("SALARY months use that month's salary, not today's rate × all months", () => {
    const r = calculatePaidMoney({
      closedMonthPays: [new Decimal("2000"), new Decimal("2500")],
      overtimePayoutAmount: new Decimal("50"),
    });
    expect(r.base.toString()).toBe("4500");
    expect(r.total.toString()).toBe("4550");
  });

  it("no closed months → only overtime", () => {
    const r = calculatePaidMoney({
      closedMonthPays: [],
      overtimePayoutAmount: new Decimal("40"),
    });
    expect(r.base.toString()).toBe("0");
    expect(r.overtime.toString()).toBe("40");
    expect(r.total.toString()).toBe("40");
  });
});