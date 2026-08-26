import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";
import {
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
  const wed = at("2026-08-12T00:00:00.000Z");
  const thu = at("2026-08-13T00:00:00.000Z");
  const sat = at("2026-08-15T00:00:00.000Z");

  it("10 h on an 8 h workday → +2", () => {
    const r = calculateMonthBalance({
      shifts: [{ date: wed, workedMinutes: 10 * 60 }],
      sickDays: [],
      hoursPerDay,
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
      hoursPerDay,
      from: wed,
      to: wed,
    });
    expect(r.balance.toString()).toBe("-2");
  });

  it("empty workday in range still takes the daily norm", () => {
    const r = calculateMonthBalance({
      shifts: [],
      sickDays: [],
      hoursPerDay,
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
      hoursPerDay,
      from: sat,
      to: sat,
    });
    expect(r.normHours.toString()).toBe("0");
    expect(r.balance.toString()).toBe("10");
  });

  it("sick day credited at hoursPerDay → on norm", () => {
    const r = calculateMonthBalance({
      shifts: [],
      sickDays: [{ date: thu, creditedHours: new Decimal("8") }],
      hoursPerDay,
      from: thu,
      to: thu,
    });
    expect(r.workedHours.toString()).toBe("8");
    expect(r.balance.toString()).toBe("0");
  });

  it("from after to → zeros", () => {
    const r = calculateMonthBalance({
      shifts: [{ date: wed, workedMinutes: 480 }],
      sickDays: [],
      hoursPerDay,
      from: thu,
      to: wed,
    });
    expect(r.workedHours.toString()).toBe("0");
    expect(r.normHours.toString()).toBe("0");
    expect(r.balance.toString()).toBe("0");
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

describe("calculatePaidMoney", () => {
  const hourly = {
    payType: "HOURLY" as const,
    hourlyRate: new Decimal("12.50"),
    monthlySalary: null,
  };
  const salary = {
    payType: "SALARY" as const,
    hourlyRate: null,
    monthlySalary: new Decimal("2000"),
  };

  it("HOURLY: hours × rate plus overtime payout amounts", () => {
    const r = calculatePaidMoney({
      employee: hourly,
      closedMonthWorkedHours: [new Decimal("160"), new Decimal("80")],
      overtimePayoutAmount: new Decimal("100"),
    });
    expect(r.base.toString()).toBe("3000");
    expect(r.overtime.toString()).toBe("100");
    expect(r.total.toString()).toBe("3100");
  });

  it("SALARY: salary × closed months plus overtime payout amounts", () => {
    const r = calculatePaidMoney({
      employee: salary,
      closedMonthWorkedHours: [new Decimal("0"), new Decimal("10"), new Decimal("200")],
      overtimePayoutAmount: new Decimal("50"),
    });
    expect(r.base.toString()).toBe("6000");
    expect(r.overtime.toString()).toBe("50");
    expect(r.total.toString()).toBe("6050");
  });

  it("no closed months → only overtime", () => {
    const r = calculatePaidMoney({
      employee: salary,
      closedMonthWorkedHours: [],
      overtimePayoutAmount: new Decimal("40"),
    });
    expect(r.base.toString()).toBe("0");
    expect(r.overtime.toString()).toBe("40");
    expect(r.total.toString()).toBe("40");
  });
});