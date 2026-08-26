import { z } from "zod";

/**
 * endTime должен быть строго после startTime.
 * Смена может пересекать полночь: все workedMinutes относятся к полю date
 * (= календарный день начала смены), не к дню конца.
 */
function refineShiftTimes(
  data: {
    startTime: Date;
    endTime: Date;
    breakStart?: Date | null;
    breakEnd?: Date | null;
  },
  ctx: z.RefinementCtx,
) {
  if (!(data.endTime > data.startTime)) {
    ctx.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "endTime must be after startTime",
    });
  }

  const hasBreakStart = data.breakStart != null;
  const hasBreakEnd = data.breakEnd != null;
  if (hasBreakStart !== hasBreakEnd) {
    ctx.addIssue({
      code: "custom",
      path: ["breakStart"],
      message: "breakStart and breakEnd must both be set or both omitted",
    });
    return;
  }
  if (hasBreakStart && hasBreakEnd) {
    const b0 = data.breakStart!;
    const b1 = data.breakEnd!;
    if (!(b0 < b1)) {
      ctx.addIssue({
        code: "custom",
        path: ["breakEnd"],
        message: "breakEnd must be after breakStart",
      });
    }
    if (b0 < data.startTime || b1 > data.endTime) {
      ctx.addIssue({
        code: "custom",
        path: ["breakStart"],
        message: "break must be within shift",
      });
    }
  }
}

export const listShiftsQuerySchema = z
  .object({
    employeeId: z.string().uuid(),
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

export const createShiftSchema = z
  .object({
    employeeId: z.string().uuid(),
    date: z.coerce.date(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    breakStart: z.coerce.date().nullish(),
    breakEnd: z.coerce.date().nullish(),
    note: z.string().optional(),
  })
  .superRefine(refineShiftTimes);

export const updateShiftSchema = z
  .object({
    date: z.coerce.date().optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    breakStart: z.coerce.date().nullish(),
    breakEnd: z.coerce.date().nullish(),
    note: z.string().nullish(),
  })
  .superRefine((data, ctx) => {
    // Полную проверку времён делаем в сервисе после merge со строкой в БД.
    const hasBreakStart = data.breakStart !== undefined && data.breakStart != null;
    const hasBreakEnd = data.breakEnd !== undefined && data.breakEnd != null;
    if (
      data.breakStart !== undefined &&
      data.breakEnd !== undefined &&
      (data.breakStart == null) !== (data.breakEnd == null)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["breakStart"],
        message: "breakStart and breakEnd must both be set or both null",
      });
    }
    void hasBreakStart;
    void hasBreakEnd;
  });