import { z } from "zod";

const payTypeSchema = z.enum(["HOURLY", "SALARY"]);

export const listEmployeesQuerySchema = z.object({
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export const createEmployeeSchema = z
  .object({
    login: z.string().min(1),
    password: z.string().min(1),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    payType: payTypeSchema,
    hourlyRate: z.string().optional(),
    monthlySalary: z.string().optional(),
    hoursPerDay: z.string().min(1),
    daysPerWeek: z.number().int().min(1).max(7),
    hiredAt: z.coerce.date(),
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
    login: z.string().min(1).optional(),
    password: z.string().min(1).optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    payType: payTypeSchema.optional(),
    hourlyRate: z.string().nullable().optional(),
    monthlySalary: z.string().nullable().optional(),
    hoursPerDay: z.string().min(1).optional(),
    daysPerWeek: z.number().int().min(1).max(7).optional(),
    hiredAt: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
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