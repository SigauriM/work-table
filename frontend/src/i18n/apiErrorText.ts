import { ApiError } from "../api/client";
import type { MsgKey } from "./messages";

const API_ERROR_MSG: Record<string, MsgKey> = {
  UNAUTHORIZED: "errUnauthorized",
  INVALID_CREDENTIALS: "errInvalidCredentials",
  FORBIDDEN: "errForbidden",
  NOT_FOUND: "errNotFound",
  INVALID_REQUEST: "errInvalidRequest",
  INVALID_JSON: "errInvalidJson",
  TOO_MANY_REQUESTS: "errTooManyRequests",
  SHIFT_OVERLAP: "errShiftOverlap",
  MONTH_CLOSED: "errMonthClosed",
  SHIFT_SICK_CONFLICT: "errShiftSickConflict",
  SICK_DAY_EXISTS: "errSickDayExists",
  LOGIN_TAKEN: "errLoginTaken",
  EFFECTIVE_FROM_REQUIRED: "errEffectiveFromRequired",
  TERMS_INVALID: "errTermsInvalid",
  HIRED_AT_AFTER_SPLIT: "errHiredAtAfterSplit",
  TERMS_CLOSED_PERIOD: "errTermsClosedPeriod",
  EMPLOYEE_ID_REQUIRED: "errEmployeeIdRequired",
  INVALID_CURSOR: "errInvalidCursor",
  INTERNAL: "errInternal",
  END_TIME_AFTER_START: "errEndTimeAfterStart",
  BREAK_BOTH_OR_NEITHER: "errBreakBothOrNeither",
  BREAK_END_AFTER_START: "errBreakEndAfterStart",
  BREAK_WITHIN_SHIFT: "errBreakWithinShift",
};

export function apiErrorText(
  err: unknown,
  t: (key: MsgKey) => string,
  fallback?: string,
): string {
  if (err instanceof ApiError) {
    const key = err.code ? API_ERROR_MSG[err.code] : undefined;
    if (key) return t(key);
    return err.message;
  }
  return fallback ?? t("somethingWrong");
}
