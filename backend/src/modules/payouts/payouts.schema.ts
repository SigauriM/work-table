import { z } from "zod";
import { calendarYmdSchema } from "../../core/calendarYmd.js";
import { moneyStringSchema, NOTE_MAX } from "../../core/stringFields.js";

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
  date: calendarYmdSchema,
  hoursPaid: moneyStringSchema,
  amount: moneyStringSchema,
  note: z.string().max(NOTE_MAX).optional(),
});
