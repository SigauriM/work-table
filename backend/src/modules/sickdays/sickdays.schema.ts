import { z } from "zod";

export const listSickDaysQuerySchema = z.object({
  employeeId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const createSickDaySchema = z.object({
  employeeId: z.string().uuid(),
  date: z.coerce.date(),
  note: z.string().optional(),
});