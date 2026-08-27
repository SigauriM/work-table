import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";
import { applyTermsSplit, coversYmd, openPeriod, TermsRuleError } from "../src/modules/terms/terms.range.js";
import type { TermsSlice, TermsValues } from "../src/modules/terms/terms.range.js";

const eightHourly: TermsValues = {
  hoursPerDay: new Decimal("8"),
  payType: "HOURLY",
  hourlyRate: new Decimal("10"),
  monthlySalary: null,
};

function period(from: string, to: string | null, extra?: Partial<TermsSlice>): TermsSlice {
  return {
    ...eightHourly,
    validFrom: from,
    validTo: to,
    ...extra,
  };
}

describe("applyTermsSplit", () => {
  it("updates in place when effectiveFrom equals the open validFrom", () => {
    const next = applyTermsSplit(
      [period("2026-01-15", null)],
      "2026-01-15",
      "2026-01-15",
      { ...eightHourly, hoursPerDay: new Decimal("6") },
    );
    expect(next).toHaveLength(1);
    expect(next[0]!.validFrom).toBe("2026-01-15");
    expect(next[0]!.validTo).toBeNull();
    expect(next[0]!.hoursPerDay.toString()).toBe("6");
  });

  it("closes the open period the day before effectiveFrom and opens a new tail", () => {
    const next = applyTermsSplit(
      [period("2026-01-15", null)],
      "2026-01-15",
      "2026-03-01",
      { ...eightHourly, hourlyRate: new Decimal("12") },
    );
    expect(next).toHaveLength(2);
    expect(next[0]).toMatchObject({ validFrom: "2026-01-15", validTo: "2026-02-28" });
    expect(next[0]!.hourlyRate?.toString()).toBe("10");
    expect(next[1]).toMatchObject({ validFrom: "2026-03-01", validTo: null });
    expect(next[1]!.hourlyRate?.toString()).toBe("12");
  });

  it("keeps already closed periods and only splits the open tail", () => {
    const next = applyTermsSplit(
      [period("2026-01-15", "2026-02-28"), period("2026-03-01", null)],
      "2026-01-15",
      "2026-04-01",
      { ...eightHourly, hoursPerDay: new Decimal("7") },
    );
    expect(next[0]).toMatchObject({ validFrom: "2026-01-15", validTo: "2026-02-28" });
    expect(next[1]).toMatchObject({ validFrom: "2026-03-01", validTo: "2026-03-31" });
    expect(next[2]!.validFrom).toBe("2026-04-01");
    expect(next[2]!.validTo).toBeNull();
    expect(next[2]!.hoursPerDay.toString()).toBe("7");
  });

  it("rejects effectiveFrom before hiredAt", () => {
    expect(() =>
      applyTermsSplit([period("2026-01-15", null)], "2026-01-15", "2026-01-14", eightHourly),
    ).toThrow(TermsRuleError);
  });

  it("rejects effectiveFrom that falls in a closed period", () => {
    expect(() =>
      applyTermsSplit(
        [period("2026-01-15", "2026-02-28"), period("2026-03-01", null)],
        "2026-01-15",
        "2026-02-01",
        eightHourly,
      ),
    ).toThrow(/closed period/);
  });

  it("allows a future effectiveFrom", () => {
    const next = applyTermsSplit(
      [period("2026-01-15", null)],
      "2026-01-15",
      "2027-01-01",
      { ...eightHourly, payType: "SALARY", hourlyRate: null, monthlySalary: new Decimal("2000") },
    );
    expect(next[1]!.validFrom).toBe("2027-01-01");
    expect(next[1]!.payType).toBe("SALARY");
  });
});

describe("coversYmd / openPeriod", () => {
  it("a future open tail does not cover today; the closed period does", () => {
    const periods = [period("2026-01-15", "2026-12-31"), period("2027-01-01", null)];
    expect(coversYmd(periods[0]!, "2026-08-27")).toBe(true);
    expect(coversYmd(periods[1]!, "2026-08-27")).toBe(false);
    expect(openPeriod(periods)?.validFrom).toBe("2027-01-01");
  });
});
