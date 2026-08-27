import { describe, expect, it } from "vitest";
import { intervalsOverlap } from "../src/core/dateUtils.js";

function at(iso: string): Date {
  return new Date(iso);
}

describe("intervalsOverlap", () => {
  it("same interval overlaps", () => {
    expect(
      intervalsOverlap(
        { startTime: at("2026-01-15T08:00:00.000Z"), endTime: at("2026-01-15T16:00:00.000Z") },
        { startTime: at("2026-01-15T08:00:00.000Z"), endTime: at("2026-01-15T16:00:00.000Z") },
      ),
    ).toBe(true);
  });

  it("partial overlap", () => {
    expect(
      intervalsOverlap(
        { startTime: at("2026-01-15T08:00:00.000Z"), endTime: at("2026-01-15T12:00:00.000Z") },
        { startTime: at("2026-01-15T11:00:00.000Z"), endTime: at("2026-01-15T17:00:00.000Z") },
      ),
    ).toBe(true);
  });

  it("one interval inside the other", () => {
    expect(
      intervalsOverlap(
        { startTime: at("2026-01-15T08:00:00.000Z"), endTime: at("2026-01-15T17:00:00.000Z") },
        { startTime: at("2026-01-15T10:00:00.000Z"), endTime: at("2026-01-15T11:00:00.000Z") },
      ),
    ).toBe(true);
  });

  it("touching at the endpoint does not overlap", () => {
    expect(
      intervalsOverlap(
        { startTime: at("2026-01-15T08:00:00.000Z"), endTime: at("2026-01-15T12:00:00.000Z") },
        { startTime: at("2026-01-15T12:00:00.000Z"), endTime: at("2026-01-15T16:00:00.000Z") },
      ),
    ).toBe(false);
  });

  it("gap does not overlap", () => {
    expect(
      intervalsOverlap(
        { startTime: at("2026-01-15T08:00:00.000Z"), endTime: at("2026-01-15T12:00:00.000Z") },
        { startTime: at("2026-01-15T13:00:00.000Z"), endTime: at("2026-01-15T17:00:00.000Z") },
      ),
    ).toBe(false);
  });

  it("overnight overlaps morning shift on the next calendar day", () => {
    expect(
      intervalsOverlap(
        { startTime: at("2026-01-16T21:00:00.000Z"), endTime: at("2026-01-17T05:00:00.000Z") },
        { startTime: at("2026-01-17T04:00:00.000Z"), endTime: at("2026-01-17T08:00:00.000Z") },
      ),
    ).toBe(true);
  });
});
