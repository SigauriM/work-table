import { z } from "zod";
import { calendarYmdSchema } from "../../core/calendarYmd.js";
import {
  hoursPerDaySchema,
  LOGIN_MAX,
  moneyStringSchema,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_SET_MIN,
} from "../../core/stringFields.js";

const payTypeSchema = z.enum(["HOURLY", "SALARY"]);

export const listEmployeesQuerySchema = z.object({
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export const createEmployeeSchema = z
  .object({
    login: z.string().min(1).max(LOGIN_MAX),
    password: z.string().min(PASSWORD_SET_MIN).max(PASSWORD_MAX),
    firstName: z.string().min(1).max(NAME_MAX),
    lastName: z.string().min(1).max(NAME_MAX),
    payType: payTypeSchema,
    hourlyRate: moneyStringSchema.optional(),
    monthlySalary: moneyStringSchema.optional(),
    hoursPerDay: hoursPerDaySchema,
    daysPerWeek: z.number().int().min(1).max(7),
    hiredAt: calendarYmdSchema,
  })
  .superRefine((data, ctx) => {
    if (data.payType === "HOURLY" && !data.hourlyRate) {
      ctx.addIssue({ code: "custom", path: ["hourlyRate"], message: "Required" });
    }
    if (data.payType === "SALARY" && !data.monthlySalary) {
      ctx.addIssue({ code: "custom", path: ["monthlySalary"], message: "Required" });
    }
  });

export const updateEmployeeSchema = z
  .object({
    login: z.string().min(1).max(LOGIN_MAX).optional(),
    password: z.string().min(PASSWORD_SET_MIN).max(PASSWORD_MAX).optional(),
    firstName: z.string().min(1).max(NAME_MAX).optional(),
    lastName: z.string().min(1).max(NAME_MAX).optional(),
    payType: payTypeSchema.optional(),
    hourlyRate: moneyStringSchema.nullable().optional(),
    monthlySalary: moneyStringSchema.nullable().optional(),
    hoursPerDay: hoursPerDaySchema.optional(),
    daysPerWeek: z.number().int().min(1).max(7).optional(),
    hiredAt: calendarYmdSchema.optional(),
    isActive: z.boolean().optional(),
    effectiveFrom: calendarYmdSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const termsTouched =
      data.payType !== undefined ||
      data.hourlyRate !== undefined ||
      data.monthlySalary !== undefined ||
      data.hoursPerDay !== undefined;
    if (termsTouched && !data.effectiveFrom) {
      ctx.addIssue({ code: "custom", path: ["effectiveFrom"], message: "Required" });
    }
    if (data.payType === "HOURLY") {
      if (data.hourlyRate === undefined || data.hourlyRate === null || data.hourlyRate === "") {
        ctx.addIssue({ code: "custom", path: ["hourlyRate"], message: "Required" });
      }
    }
    if (data.payType === "SALARY") {
      if (
        data.monthlySalary === undefined ||
        data.monthlySalary === null ||
        data.monthlySalary === ""
      ) {
        ctx.addIssue({ code: "custom", path: ["monthlySalary"], message: "Required" });
      }
    }
  });
