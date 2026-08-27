import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";
import {
  assertShiftOnBerlinDate,
  berlinPartsFromInstant,
  berlinYmd,
  instantFromBerlin,
  monthDateRange,
  nextBerlinYmd,
  weekdayFromYmd,
  ymdToDateColumn,
} from "../src/core/berlin.js";
import {
  calculateMonthBalance,
  calculateWorkedMinutes,
} from "../src/core/calculations.js";

describe("acceptance: Europe/Berlin calendar", () => {
  it("1 March 00:30 Berlin is a March shift, not February", () => {
    const start = instantFromBerlin("2026-03-01", "00:30");
    const end = instantFromBerlin("2026-03-01", "08:30");
    expect(start.toISOString()).toBe("2026-02-28T23:30:00.000Z");
    expect(berlinYmd(start)).toBe("2026-03-01");
    expect(() => assertShiftOnBerlinDate("2026-03-01", start, end)).not.toThrow();
    const march = monthDateRange(2026, 3);
    const date = ymdToDateColumn("2026-03-01");
    expect(date.getTime()).toBeGreaterThanOrEqual(march.gte.getTime());
    expect(date.getTime()).toBeLessThan(march.lt.getTime());
    const feb = monthDateRange(2026, 2);
    expect(date.getTime()).toBeGreaterThanOrEqual(feb.lt.getTime());
  });

  it("timesheet today at 01:00 Berlin on the 1st is the 1st, not toISOString’s previous month", () => {
    const winter = instantFromBerlin("2026-03-01", "00:30");
    expect(winter.toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(berlinYmd(winter)).toBe("2026-03-01");
    const summer = instantFromBerlin("2026-07-01", "01:00");
    expect(summer.toISOString().slice(0, 10)).toBe("2026-06-30");
    expect(berlinYmd(summer)).toBe("2026-07-01");
  });

  it("09:00 round-trips in the form in winter and summer", () => {
    expect(berlinPartsFromInstant(instantFromBerlin("2026-01-15", "09:00"))).toEqual({
      ymd: "2026-01-15",
      hm: "09:00",
    });
    expect(berlinPartsFromInstant(instantFromBerlin("2026-07-15", "09:00"))).toEqual({
      ymd: "2026-07-15",
      hm: "09:00",
    });
  });

  it("spring-forward 02:30 is an error, not silently 03:30", () => {
    expect(() => instantFromBerlin("2026-03-29", "02:30")).toThrow(
      /Invalid Berlin time/,
    );
    const threeThirty = instantFromBerlin("2026-03-29", "03:30");
    expect(berlinPartsFromInstant(threeThirty).hm).toBe("03:30");
  });

  it("Monday 00:30 Berlin is a weekday for the daily norm, not UTC Sunday", () => {
    const monday = ymdToDateColumn("2026-03-02");
    const at0030 = instantFromBerlin("2026-03-02", "00:30");
    expect(at0030.getUTCDay()).toBe(0);
    expect(weekdayFromYmd("2026-03-02")).toBe(1);
    const r = calculateMonthBalance({
      shifts: [],
      sickDays: [],
      hoursPerDay: () => new Decimal("8"),
      from: monday,
      to: monday,
    });
    expect(r.normHours.toString()).toBe("8");
  });

  it("overnight 22:00–06:00 is 8h on the start calendar day", () => {
    const start = instantFromBerlin("2026-01-16", "22:00");
    const end = instantFromBerlin(nextBerlinYmd("2026-01-16"), "06:00");
    expect(calculateWorkedMinutes({ startTime: start, endTime: end })).toBe(480);
    expect(() => assertShiftOnBerlinDate("2026-01-16", start, end)).not.toThrow();
    expect(() => assertShiftOnBerlinDate("2026-01-17", start, end)).toThrow(
      /startTime must fall on date/,
    );
  });
});
