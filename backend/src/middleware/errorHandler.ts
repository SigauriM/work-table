import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

/** Stable API error codes. English `error` text stays for curl/tests. */
export const CODE_BY_MESSAGE: Record<string, string> = {
  Unauthorized: "UNAUTHORIZED",
  "Invalid credentials": "INVALID_CREDENTIALS",
  Forbidden: "FORBIDDEN",
  "Not found": "NOT_FOUND",
  "Invalid request": "INVALID_REQUEST",
  "Invalid JSON": "INVALID_JSON",
  "Too many requests": "TOO_MANY_REQUESTS",
  "Overlapping shift": "SHIFT_OVERLAP",
  "Month is closed": "MONTH_CLOSED",
  "Shift and sick day conflict": "SHIFT_SICK_CONFLICT",
  "Sick day already exists for this date": "SICK_DAY_EXISTS",
  "Login already taken": "LOGIN_TAKEN",
  "effectiveFrom is required": "EFFECTIVE_FROM_REQUIRED",
  "Employee terms are invalid": "TERMS_INVALID",
  "Cannot change hiredAt after terms were split": "HIRED_AT_AFTER_SPLIT",
  "Cannot change terms in a closed period": "TERMS_CLOSED_PERIOD",
  "employeeId is required": "EMPLOYEE_ID_REQUIRED",
  "Invalid cursor": "INVALID_CURSOR",
  "Internal server error": "INTERNAL",
  "endTime must be after startTime": "END_TIME_AFTER_START",
  "breakStart and breakEnd must both be set or both omitted": "BREAK_BOTH_OR_NEITHER",
  "breakEnd must be after breakStart": "BREAK_END_AFTER_START",
  "break must be within shift": "BREAK_WITHIN_SHIFT",
};

export function errorPayload(error: string, code?: string) {
  return code ? { error, code } : { error };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.code = code ?? CODE_BY_MESSAGE[message];
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json(errorPayload("Invalid request", "INVALID_REQUEST"));
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json(errorPayload(err.message, err.code));
    return;
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json(errorPayload("Invalid JSON", "INVALID_JSON"));
    return;
  }
  console.error(err);
  res.status(500).json(errorPayload("Internal server error", "INTERNAL"));
};
