import { describe, expect, it } from "vitest";
import {
  countedShiftHours,
  hoursPerDayForYmd,
  weekdayNormHours,
} from "./timesheet";

describe("timesheet helpers", () => {
  it("counts overnight Berlin clock fields as 8 hours in winter", () => {
    expect(countedShiftHours("2026-01-16", "22:00", "06:00", "", "")).toBe(8);
  });

  it("subtracts a break that stays on the start day", () => {
    expect(countedShiftHours("2026-03-02", "09:00", "17:00", "12:00", "12:30")).toBe(7.5);
  });

  it("weekend norm is 0", () => {
    expect(weekdayNormHours("2026-03-01", 8)).toBe(0);
    expect(weekdayNormHours("2026-03-02", 8)).toBe(8);
  });

  it("hoursPerDayForYmd uses the covering terms row", () => {
    const terms = [
      { validFrom: "2026-01-15", validTo: "2026-03-31", hoursPerDay: "8" },
      { validFrom: "2026-04-01", validTo: null, hoursPerDay: "6" },
    ];
    expect(hoursPerDayForYmd("2026-03-15", terms, "8")).toBe(8);
    expect(hoursPerDayForYmd("2026-04-02", terms, "8")).toBe(6);
    expect(hoursPerDayForYmd("2026-03-15", undefined, "7")).toBe(7);
  });
});
