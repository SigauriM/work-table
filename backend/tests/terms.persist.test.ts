import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";
import { applyTermsSplit, TermsRuleError, type TermsSlice, type TermsValues } from "../src/modules/terms/terms.range.js";
import { termsPersistOps } from "../src/modules/terms/terms.service.js";

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

describe("termsPersistOps", () => {
  it("updates closed and open ids and inserts the new tail", () => {
    const split = applyTermsSplit(
      [period("2026-01-15", "2026-02-28", { id: "closed-1" }), period("2026-03-01", null, { id: "open-1" })],
      "2026-01-15",
      "2026-04-01",
      { ...eightHourly, hoursPerDay: new Decimal("7") },
    );
    const ops = termsPersistOps(new Set(["closed-1", "open-1"]), split);
    expect(ops.updates.map((p) => p.id)).toEqual(["closed-1", "open-1"]);
    expect(ops.inserts).toHaveLength(1);
    expect(ops.inserts[0]!.id).toBeUndefined();
    expect(ops.inserts[0]!.validFrom).toBe("2026-04-01");
  });

  it("refuses to drop an existing period id", () => {
    expect(() =>
      termsPersistOps(new Set(["keep-me"]), [period("2026-03-01", null)]),
    ).toThrow(TermsRuleError);
  });
});
