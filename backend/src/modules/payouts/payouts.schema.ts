import { Decimal } from "decimal.js";
import { z } from "zod";

function positiveDecimalString() {
  return z.string().min(1).superRefine((val, ctx) => {
    try {
      const d = new Decimal(val);
      if (!d.isFinite() || d.lte(0)) {
        ctx.addIssue({ code: "custom", message: "Must be > 0" });
      }
    } catch {
      ctx.addIssue({ code: "custom", message: "Must be > 0" });
    }
  });
}

export const listPayoutsQuerySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
  })
  .superRefine((data, ctx) => {
    const hasYear = data.year !== undefined;
    const hasMonth = data.month !== undefined;
    if (hasYear !== hasMonth) {
      ctx.addIssue({
        code: "custom",
        path: ["year"],
        message: "year and month must both be set or both omitted",
      });
    }
  });

export const createOvertimePayoutSchema = z.object({
  date: z.coerce.date(),
  hoursPaid: positiveDecimalString(),
  amount: positiveDecimalString(),
  note: z.string().optional(),
});
