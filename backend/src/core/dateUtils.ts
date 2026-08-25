export function differenceInMinutes(later: Date, earlier: Date): number {
    return Math.floor((later.getTime() - earlier.getTime()) / 60_000);
  }