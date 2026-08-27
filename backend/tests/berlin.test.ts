import { describe, expect, it } from "vitest";
import {
  assertShiftOnBerlinDate,
  berlinPartsFromInstant,
  berlinYmd,
  berlinYearMonth,
  instantFromBerlin,
  isCalendarMonthClosed,
  isWeekendYmd,
  lastYmdOfMonth,
  monthDateRange,
  nextBerlinYmd,
  prevBerlinYmd,
  weekdayFromYmd,
  ymdFromDateColumn,
  ymdToDateColumn,
} from "../src/core/berlin.js";

describe("instantFromBerlin", () => {
  it("2026-01-15 09:00 CET → 08:00Z", () => {
    expect(instantFromBerlin("2026-01-15", "09:00").toISOString()).toBe(
      "2026-01-15T08:00:00.000Z",
    );
  });

  it("2026-07-15 09:00 CEST → 07:00Z", () => {
    expect(instantFromBerlin("2026-07-15", "09:00").toISOString()).toBe(
      "2026-07-15T07:00:00.000Z",
    );
  });

  it("spring gap 2026-03-29 02:30 throws", () => {
    expect(() => instantFromBerlin("2026-03-29", "02:30")).toThrow(
      /Invalid Berlin time/,
    );
  });

  it("fall fold 2026-10-25 02:30 uses first occurrence (CEST +02)", () => {
    expect(instantFromBerlin("2026-10-25", "02:30").toISOString()).toBe(
      "2026-10-25T00:30:00.000Z",
    );
  });
});

describe("berlinYmd / berlinYearMonth", () => {
  it("2026-03-01 00:30–01:30 Berlin is March, not February", () => {
    for (const hm of ["00:30", "01:00", "01:30"] as const) {
      const now = instantFromBerlin("2026-03-01", hm);
      expect(berlinYmd(now)).toBe("2026-03-01");
      expect(berlinYearMonth(now)).toEqual({ year: 2026, month: 3 });
    }
  });
});

describe("overnight instants", () => {
  it("22:00 → 06:00 next YMD is 8 hours in winter", () => {
    const start = instantFromBerlin("2024-01-16", "22:00");
    const end = instantFromBerlin(nextBerlinYmd("2024-01-16"), "06:00");
    expect((end.getTime() - start.getTime()) / 60_000).toBe(480);
  });

  it("overnight across spring-forward is 7 hours", () => {
    const start = instantFromBerlin("2026-03-28", "22:00");
    const end = instantFromBerlin("2026-03-29", "06:00");
    expect((end.getTime() - start.getTime()) / 60_000).toBe(420);
  });

  it("overnight across fall-back is 9 hours", () => {
    const start = instantFromBerlin("2026-10-24", "22:00");
    const end = instantFromBerlin("2026-10-25", "06:00");
    expect((end.getTime() - start.getTime()) / 60_000).toBe(540);
  });
});

describe("calendar helpers", () => {
  it("weekdayFromYmd is the civil weekday, not the UTC day of 00:30 Berlin", () => {
    expect(weekdayFromYmd("2026-03-01")).toBe(0);
    expect(isWeekendYmd("2026-03-01")).toBe(true);
    expect(isWeekendYmd("2026-08-12")).toBe(false);
    expect(isWeekendYmd("2026-08-15")).toBe(true);
  });

  it("ymdToDateColumn is UTC midnight of the YMD", () => {
    expect(ymdToDateColumn("2026-03-01").toISOString()).toBe(
      "2026-03-01T00:00:00.000Z",
    );
    expect(ymdFromDateColumn(ymdToDateColumn("2026-03-01"))).toBe("2026-03-01");
  });

  it("monthDateRange is [1st, next 1st) as date columns", () => {
    const march = monthDateRange(2026, 3);
    expect(march.gte.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(march.lt.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    const dec = monthDateRange(2026, 12);
    expect(dec.gte.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(dec.lt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("lastYmdOfMonth / closed month uses Berlin calendar YMD, not UTC today", () => {
    expect(lastYmdOfMonth(2026, 2)).toBe("2026-02-28");
    expect(lastYmdOfMonth(2026, 1)).toBe("2026-01-31");
    expect(isCalendarMonthClosed(2026, 7, "2026-08-27")).toBe(true);
    expect(isCalendarMonthClosed(2026, 8, "2026-08-27")).toBe(false);
    expect(isCalendarMonthClosed(2026, 8, "2026-08-31")).toBe(true);
  });

  it("berlinPartsFromInstant round-trips a Berlin clock time", () => {
    const instant = instantFromBerlin("2026-07-15", "09:00");
    expect(berlinPartsFromInstant(instant)).toEqual({
      ymd: "2026-07-15",
      hm: "09:00",
    });
  });
});

describe("assertShiftOnBerlinDate", () => {
  it("same-day Berlin start and end", () => {
    expect(() =>
      assertShiftOnBerlinDate(
        "2026-01-15",
        instantFromBerlin("2026-01-15", "09:00"),
        instantFromBerlin("2026-01-15", "17:00"),
      ),
    ).not.toThrow();
  });

  it("overnight end on the next Berlin day", () => {
    expect(() =>
      assertShiftOnBerlinDate(
        "2026-01-16",
        instantFromBerlin("2026-01-16", "22:00"),
        instantFromBerlin("2026-01-17", "06:00"),
      ),
    ).not.toThrow();
  });

  it("start on another Berlin day throws", () => {
    expect(() =>
      assertShiftOnBerlinDate(
        "2026-03-01",
        instantFromBerlin("2026-02-28", "23:00"),
        instantFromBerlin("2026-03-01", "01:00"),
      ),
    ).toThrow(/startTime must fall on date/);
  });

  it("end two Berlin days later throws", () => {
    expect(() =>
      assertShiftOnBerlinDate(
        "2026-01-15",
        instantFromBerlin("2026-01-15", "22:00"),
        instantFromBerlin("2026-01-17", "06:00"),
      ),
    ).toThrow(/endTime must fall on date or the next day/);
  });
});

describe("prevBerlinYmd", () => {
  it("steps back across a month boundary", () => {
    expect(prevBerlinYmd("2026-03-01")).toBe("2026-02-28");
  });
});
