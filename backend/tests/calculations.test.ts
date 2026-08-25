import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";
import {
  calculateMonthBalance,
  calculateMonthlyPay,
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
});

describe("calculateMonthBalance", () => {
  it("пустой месяц → balance = −норма", () => {
    const r = calculateMonthBalance({
      shifts: [],
      sickDays: [],
      hoursPerMonth: new Decimal("160"),
    });
    expect(r.workedHours.toString()).toBe("0");
    expect(r.normHours.toString()).toBe("160");
    expect(r.balance.toString()).toBe("-160");
  });

  it("смены ровно по норме → balance 0", () => {
    const r = calculateMonthBalance({
      shifts: [{ workedMinutes: 160 * 60 }],
      sickDays: [],
      hoursPerMonth: new Decimal("160"),
    });
    expect(r.balance.toString()).toBe("0");
  });

  it("переработка → плюс", () => {
    const r = calculateMonthBalance({
      shifts: [{ workedMinutes: 180 * 60 }],
      sickDays: [],
      hoursPerMonth: new Decimal("160"),
    });
    expect(r.balance.toString()).toBe("20");
  });

  it("смены + больничный входят в отработанное", () => {
    const r = calculateMonthBalance({
      shifts: [{ workedMinutes: 152 * 60 }],
      sickDays: [{ creditedHours: new Decimal("8") }],
      hoursPerMonth: new Decimal("160"),
    });
    expect(r.workedHours.toString()).toBe("160");
    expect(r.balance.toString()).toBe("0");
  });

  /**
   * Известное ограничение v1: hoursPerMonth задаётся вручную, не из календаря.
   * Норма 160 при hoursPerDay=8 подразумевает 20 дней; если больничных «как день»
   * больше/иначе относительно нормы — баланс может быть слегка ненулевым.
   */
  it("ручная норма ≠ календарь: два больничных по 8 при норме 160 и 152 ч смен → +0", () => {
    const r = calculateMonthBalance({
      shifts: [{ workedMinutes: 152 * 60 }],
      sickDays: [
        { creditedHours: new Decimal("8") },
        { creditedHours: new Decimal("8") },
      ],
      hoursPerMonth: new Decimal("160"),
    });
    expect(r.workedHours.toString()).toBe("168");
    expect(r.balance.toString()).toBe("8");
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