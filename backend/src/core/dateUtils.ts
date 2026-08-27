export function differenceInMinutes(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 60_000);
}

/** Half-open [start, end): touching endpoints do not overlap. Instants, not calendar dates. */
export function intervalsOverlap(
  a: { startTime: Date; endTime: Date },
  b: { startTime: Date; endTime: Date },
): boolean {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

