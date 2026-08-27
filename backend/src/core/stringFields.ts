import { Decimal } from "decimal.js";
import { z } from "zod";

export const LOGIN_MAX = 64;
export const NAME_MAX = 100;
export const NOTE_MAX = 500;
export const PASSWORD_MAX = 72;
export const PASSWORD_SET_MIN = 12;

const moneyRe = /^\d{1,6}(\.\d{1,2})?$/;
const hoursPerDayRe = /^\d{1,2}(\.\d{1,2})?$/;

export const moneyStringSchema = z.string().regex(moneyRe).superRefine((val, ctx) => {
  const d = new Decimal(val);
  if (!d.isFinite() || d.lte(0)) {
    ctx.addIssue({ code: "custom", message: "Must be > 0" });
  }
});

export const hoursPerDaySchema = z.string().regex(hoursPerDayRe).superRefine((val, ctx) => {
  const d = new Decimal(val);
  if (!d.isFinite() || d.lte(0) || d.gt(24)) {
    ctx.addIssue({ code: "custom", message: "Must be > 0 and <= 24" });
  }
});
