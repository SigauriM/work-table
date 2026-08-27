import { z } from "zod";
import { calendarYmdSchema } from "../../core/calendarYmd.js";

export const listSickDaysQuerySchema = z.object({
  employeeId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const createSickDaySchema = z.object({
  employeeId: z.string().uuid(),
  date: calendarYmdSchema,
  note: z.string().optional(),
});