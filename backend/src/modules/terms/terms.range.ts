import { Decimal } from "decimal.js";
import { prevBerlinYmd } from "../../core/berlin.js";

export class TermsRuleError extends Error {}

export type TermsValues = {
  hoursPerDay: Decimal;
  payType: "HOURLY" | "SALARY";
  hourlyRate: Decimal | null;
  monthlySalary: Decimal | null;
};

export type TermsSlice = TermsValues & {
  validFrom: string;
  validTo: string | null;
};

export function coversYmd(period: TermsSlice, ymd: string): boolean {
  return period.validFrom <= ymd && (period.validTo === null || ymd <= period.validTo);
}

export function termsOnYmd(periods: TermsSlice[], ymd: string): TermsSlice | null {
  return periods.find((p) => coversYmd(p, ymd)) ?? null;
}

export function openPeriod(periods: TermsSlice[]): TermsSlice | null {
  const open = periods.filter((p) => p.validTo === null);
  return open.length === 1 ? open[0]! : null;
}

export function periodsOverlapMonth(
  period: TermsSlice,
  monthStartYmd: string,
  monthEndYmd: string,
): boolean {
  const end = period.validTo ?? "9999-12-31";
  return period.validFrom <= monthEndYmd && end >= monthStartYmd;
}

export function applyTermsSplit(
  periods: TermsSlice[],
  hiredYmd: string,
  effectiveFrom: string,
  next: TermsValues,
): TermsSlice[] {
  if (effectiveFrom < hiredYmd) {
    throw new TermsRuleError("effectiveFrom is before hiredAt");
  }
  const open = openPeriod(periods);
  if (!open) {
    throw new TermsRuleError("Employee terms are invalid");
  }
  if (effectiveFrom < open.validFrom) {
    throw new TermsRuleError("Cannot change terms in a closed period");
  }
  const closed = periods.filter((p) => p.validTo !== null);
  if (effectiveFrom === open.validFrom) {
    return [...closed, { ...open, ...next }];
  }
  const closedTo = prevBerlinYmd(effectiveFrom);
  if (closedTo < open.validFrom) {
    throw new TermsRuleError("effectiveFrom is before hiredAt");
  }
  return [
    ...closed,
    { ...open, validTo: closedTo },
    { ...next, validFrom: effectiveFrom, validTo: null },
  ];
}
