import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  berlinPartsFromInstant,
  instantFromBerlin,
  lastYmdOfMonth,
  nextBerlinYmd,
} from "../src/core/berlin.js";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymdOf(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function hmOf(hour: number, minute: number) {
  return `${pad2(hour)}:${pad2(minute)}`;
}

const ymdArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 31 }),
  )
  .map(([year, month, day]) => {
    const last = Number(lastYmdOfMonth(year, month).slice(8, 10));
    return ymdOf(year, month, Math.min(day, last));
  });

const hmArb = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => hmOf(h, m));

describe("berlin DST properties", () => {
  it("round-trips every civil clock that exists in Europe/Berlin", () => {
    fc.assert(
      fc.property(ymdArb, hmArb, (ymd, hm) => {
        let instant: Date;
        try {
          instant = instantFromBerlin(ymd, hm);
        } catch (err) {
          expect((err as Error).message).toMatch(/Invalid Berlin time/);
          return;
        }
        expect(berlinPartsFromInstant(instant)).toEqual({ ymd, hm });
      }),
      { numRuns: 200 },
    );
  });

  it("spring-forward gap 2026-03-29 02:xx throws; 01:59 and 03:00 exist", () => {
    for (const minute of [0, 15, 30, 59]) {
      expect(() => instantFromBerlin("2026-03-29", hmOf(2, minute))).toThrow(
        /Invalid Berlin time/,
      );
    }
    expect(instantFromBerlin("2026-03-29", "01:59").toISOString()).toBe(
      "2026-03-29T00:59:00.000Z",
    );
    expect(instantFromBerlin("2026-03-29", "03:00").toISOString()).toBe(
      "2026-03-29T01:00:00.000Z",
    );
  });

  it("fall-back 2026-10-25 02:xx uses the first (CEST) occurrence", () => {
    expect(instantFromBerlin("2026-10-25", "02:00").toISOString()).toBe(
      "2026-10-25T00:00:00.000Z",
    );
    expect(instantFromBerlin("2026-10-25", "02:30").toISOString()).toBe(
      "2026-10-25T00:30:00.000Z",
    );
    const parts = berlinPartsFromInstant(instantFromBerlin("2026-10-25", "02:30"));
    expect(parts).toEqual({ ymd: "2026-10-25", hm: "02:30" });
  });

  it("nextBerlinYmd is civil +1 day even across DST", () => {
    expect(nextBerlinYmd("2026-03-28")).toBe("2026-03-29");
    expect(nextBerlinYmd("2026-10-24")).toBe("2026-10-25");
  });
});
