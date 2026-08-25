import bcrypt from "bcryptjs";
import { PayType, Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../middleware/errorHandler.js";
import type { z } from "zod";
import type {
  createEmployeeSchema,
  updateEmployeeSchema,
} from "./employees.schema.js";

const BCRYPT_ROUNDS = 10;

const publicInclude = {
  user: { select: { id: true, login: true, role: true } },
} as const;

function toPublic(employee: {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  payType: PayType;
  hourlyRate: unknown;
  monthlySalary: unknown;
  hoursPerDay: unknown;
  daysPerWeek: number;
  hoursPerMonth: unknown;
  hiredAt: Date;
  isActive: boolean;
  user: { id: string; login: string; role: Role };
}) {
  return {
    id: employee.id,
    userId: employee.userId,
    login: employee.user.login,
    firstName: employee.firstName,
    lastName: employee.lastName,
    payType: employee.payType,
    hourlyRate: employee.hourlyRate,
    monthlySalary: employee.monthlySalary,
    hoursPerDay: employee.hoursPerDay,
    daysPerWeek: employee.daysPerWeek,
    hoursPerMonth: employee.hoursPerMonth,
    hiredAt: employee.hiredAt,
    isActive: employee.isActive,
  };
}

type CreateInput = z.infer<typeof createEmployeeSchema>;
type UpdateInput = z.infer<typeof updateEmployeeSchema>;

export async function listEmployees(isActive?: boolean) {
  const employees = await prisma.employee.findMany({
    where: isActive === undefined ? undefined : { isActive },
    include: publicInclude,
    orderBy: { lastName: "asc" },
  });
  return employees.map(toPublic);
}

export async function getEmployee(id: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: publicInclude,
  });
  if (!employee) {
    throw new HttpError(404, "Not found");
  }
  return toPublic(employee);
}

export async function createEmployee(input: CreateInput) {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const payType = input.payType as PayType;
  try {
    const employee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          login: input.login,
          passwordHash,
          role: Role.EMPLOYEE,
        },
      });
      return tx.employee.create({
        data: {
          userId: user.id,
          firstName: input.firstName,
          lastName: input.lastName,
          payType,
          hourlyRate: payType === PayType.HOURLY ? input.hourlyRate : null,
          monthlySalary: payType === PayType.SALARY ? input.monthlySalary : null,
          hoursPerDay: input.hoursPerDay,
          daysPerWeek: input.daysPerWeek,
          hoursPerMonth: input.hoursPerMonth,
          hiredAt: input.hiredAt,
        },
        include: publicInclude,
      });
    });
    return toPublic(employee);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "Login already taken");
    }
    throw err;
  }
}

export async function updateEmployee(id: string, input: UpdateInput) {
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, "Not found");
  }

  const data: Prisma.EmployeeUpdateInput = {};
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.hoursPerDay !== undefined) data.hoursPerDay = input.hoursPerDay;
  if (input.daysPerWeek !== undefined) data.daysPerWeek = input.daysPerWeek;
  if (input.hoursPerMonth !== undefined) data.hoursPerMonth = input.hoursPerMonth;
  if (input.hiredAt !== undefined) data.hiredAt = input.hiredAt;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  if (input.payType !== undefined) {
    const payType = input.payType as PayType;
    data.payType = payType;
    if (payType === PayType.HOURLY) {
      data.hourlyRate = input.hourlyRate;
      data.monthlySalary = null;
    } else {
      data.monthlySalary = input.monthlySalary;
      data.hourlyRate = null;
    }
  } else {
    if (input.hourlyRate !== undefined) data.hourlyRate = input.hourlyRate;
    if (input.monthlySalary !== undefined) data.monthlySalary = input.monthlySalary;
  }

  const employee = await prisma.employee.update({
    where: { id },
    data,
    include: publicInclude,
  });
  return toPublic(employee);
}

export async function deactivateEmployee(id: string) {
  const employee = await prisma.$transaction(async (tx) => {
    const current = await tx.employee.findUnique({ where: { id } });
    if (!current) {
      throw new HttpError(404, "Not found");
    }
    const updated = await tx.employee.update({
      where: { id: current.id },
      data: { isActive: false },
      include: publicInclude,
    });
    await tx.refreshToken.updateMany({
      where: { userId: current.userId },
      data: { revokedAt: new Date() },
    });
    return updated;
  });
  return toPublic(employee);
}