import bcrypt from "bcryptjs";
import { Decimal } from "decimal.js";
import { PayType, Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { berlinYmd, ymdFromDateColumn, ymdToDateColumn } from "../../core/berlin.js";
import { HttpError } from "../../middleware/errorHandler.js";
import { writeAudit } from "../audit/audit.service.js";
import { openPeriod, TermsRuleError, termsOnYmd, type TermsSlice } from "../terms/terms.range.js";
import {
  applySplitForEmployee,
  createInitial,
  listTerms,
  mergeTermsPatch,
  termsAuditPayload,
  toSlice,
} from "../terms/terms.service.js";
import type { z } from "zod";
import type {
  createEmployeeSchema,
  updateEmployeeSchema,
} from "./employees.schema.js";

const BCRYPT_ROUNDS = 10;

const publicInclude = {
  user: { select: { id: true, login: true, role: true } },
  terms: { orderBy: { validFrom: "asc" as const } },
} as const;

function currentTerms(periods: TermsSlice[], hiredAt: Date): TermsSlice {
  const today = berlinYmd(new Date());
  const hired = ymdFromDateColumn(hiredAt);
  const ymd = today < hired ? hired : today;
  const hit = termsOnYmd(periods, ymd);
  if (!hit) {
    throw new HttpError(500, "Internal server error");
  }
  return hit;
}

function serializeTerm(period: TermsSlice) {
  return {
    payType: period.payType,
    hourlyRate: period.hourlyRate?.toString() ?? null,
    monthlySalary: period.monthlySalary?.toString() ?? null,
    hoursPerDay: period.hoursPerDay.toString(),
    validFrom: period.validFrom,
    validTo: period.validTo,
  };
}

function toPublic(
  employee: {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    daysPerWeek: number;
    hiredAt: Date;
    isActive: boolean;
    user: { id: string; login: string; role: Role };
    terms: {
      id: string;
      payType: PayType;
      hourlyRate: unknown;
      monthlySalary: unknown;
      hoursPerDay: unknown;
      validFrom: Date;
      validTo: Date | null;
    }[];
  },
  options?: { history?: boolean },
) {
  const periods = employee.terms.map((row) =>
    toSlice({
      id: row.id,
      payType: row.payType,
      hourlyRate: row.hourlyRate as { toString(): string } | null,
      monthlySalary: row.monthlySalary as { toString(): string } | null,
      hoursPerDay: row.hoursPerDay as { toString(): string },
      validFrom: row.validFrom,
      validTo: row.validTo,
    }),
  );
  const current = currentTerms(periods, employee.hiredAt);
  return {
    id: employee.id,
    userId: employee.userId,
    login: employee.user.login,
    firstName: employee.firstName,
    lastName: employee.lastName,
    payType: current.payType,
    hourlyRate: current.hourlyRate?.toString() ?? null,
    monthlySalary: current.monthlySalary?.toString() ?? null,
    hoursPerDay: current.hoursPerDay.toString(),
    daysPerWeek: employee.daysPerWeek,
    hiredAt: employee.hiredAt,
    isActive: employee.isActive,
    ...(options?.history ? { terms: periods.map(serializeTerm) } : {}),
  };
}

function initialValues(input: CreateInput): {
  payType: "HOURLY" | "SALARY";
  hourlyRate: Decimal | null;
  monthlySalary: Decimal | null;
  hoursPerDay: Decimal;
} {
  const payType = input.payType as PayType;
  return {
    payType,
    hourlyRate: payType === PayType.HOURLY ? new Decimal(input.hourlyRate!) : null,
    monthlySalary: payType === PayType.SALARY ? new Decimal(input.monthlySalary!) : null,
    hoursPerDay: new Decimal(input.hoursPerDay),
  };
}

function hasTermsPatch(input: UpdateInput): boolean {
  return (
    input.payType !== undefined ||
    input.hourlyRate !== undefined ||
    input.monthlySalary !== undefined ||
    input.hoursPerDay !== undefined
  );
}

type CreateInput = z.infer<typeof createEmployeeSchema>;
type UpdateInput = z.infer<typeof updateEmployeeSchema>;

export async function listEmployees(isActive?: boolean) {
  const employees = await prisma.employee.findMany({
    where: isActive === undefined ? undefined : { isActive },
    include: publicInclude,
    orderBy: { lastName: "asc" },
  });
  return employees.map((e) => toPublic(e));
}

export async function getEmployee(id: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: publicInclude,
  });
  if (!employee) {
    throw new HttpError(404, "Not found");
  }
  return toPublic(employee, { history: true });
}

export async function createEmployee(input: CreateInput) {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  try {
    const employee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          login: input.login,
          passwordHash,
          role: Role.EMPLOYEE,
          mustChangePassword: true,
        },
      });
      const created = await tx.employee.create({
        data: {
          userId: user.id,
          firstName: input.firstName,
          lastName: input.lastName,
          daysPerWeek: input.daysPerWeek,
          hiredAt: ymdToDateColumn(input.hiredAt),
        },
      });
      await createInitial(tx, created.id, input.hiredAt, initialValues(input));
      return tx.employee.findUniqueOrThrow({
        where: { id: created.id },
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

export async function updateEmployee(id: string, input: UpdateInput, actorUserId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.employee.findUnique({
        where: { id },
        include: publicInclude,
      });
      if (!existing) {
        throw new HttpError(404, "Not found");
      }

      if (input.login !== undefined || input.password !== undefined) {
        const userData: Prisma.UserUpdateInput = {};
        if (input.login !== undefined) userData.login = input.login;
        if (input.password !== undefined) {
          userData.passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
          userData.mustChangePassword = true;
        }
        await tx.user.update({
          where: { id: existing.userId },
          data: userData,
        });
        if (input.password !== undefined) {
          await tx.refreshToken.updateMany({
            where: { userId: existing.userId },
            data: { revokedAt: new Date() },
          });
          await writeAudit(tx, {
            actorUserId,
            action: "user.password.change",
            entity: "User",
            entityId: existing.userId,
            before: null,
            after: { refreshRevoked: true },
          });
        }
      }

      const data: Prisma.EmployeeUpdateInput = {};
      if (input.firstName !== undefined) data.firstName = input.firstName;
      if (input.lastName !== undefined) data.lastName = input.lastName;
      if (input.daysPerWeek !== undefined) data.daysPerWeek = input.daysPerWeek;
      if (input.isActive !== undefined) data.isActive = input.isActive;

      let hiredYmd = ymdFromDateColumn(existing.hiredAt);
      if (input.hiredAt !== undefined && input.hiredAt !== hiredYmd) {
        const periods = existing.terms.map(toSlice);
        if (periods.length !== 1) {
          throw new HttpError(400, "Cannot change hiredAt after terms were split");
        }
        data.hiredAt = ymdToDateColumn(input.hiredAt);
        hiredYmd = input.hiredAt;
        await tx.employeeTerms.update({
          where: { id: existing.terms[0]!.id },
          data: { validFrom: ymdToDateColumn(input.hiredAt) },
        });
      }

      if (Object.keys(data).length > 0) {
        await tx.employee.update({
          where: { id: existing.id },
          data,
        });
      }

      if (hasTermsPatch(input)) {
        if (!input.effectiveFrom) {
          throw new HttpError(400, "effectiveFrom is required");
        }
        const periods = await listTerms(tx, existing.id);
        const open = openPeriod(periods);
        if (!open) {
          throw new HttpError(400, "Employee terms are invalid");
        }
        const next = mergeTermsPatch(open, input);
        await applySplitForEmployee(tx, existing.id, hiredYmd, input.effectiveFrom, next);
        await writeAudit(tx, {
          actorUserId,
          action: "employee.terms",
          entity: "Employee",
          entityId: existing.id,
          before: { terms: termsAuditPayload(periods) },
          after: { terms: termsAuditPayload(await listTerms(tx, existing.id)) },
        });
      }

      if (input.isActive === false) {
        await tx.refreshToken.updateMany({
          where: { userId: existing.userId },
          data: { revokedAt: new Date() },
        });
        await writeAudit(tx, {
          actorUserId,
          action: "employee.deactivate",
          entity: "Employee",
          entityId: existing.id,
          before: { isActive: existing.isActive },
          after: { isActive: false },
        });
      }

      const employee = await tx.employee.findUniqueOrThrow({
        where: { id: existing.id },
        include: publicInclude,
      });
      return toPublic(employee);
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof TermsRuleError) {
      throw new HttpError(400, err.message);
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "Login already taken");
    }
    throw err;
  }
}

export async function deactivateEmployee(id: string, actorUserId: string) {
  const employee = await prisma.$transaction(async (tx) => {
    const current = await tx.employee.findUnique({
      where: { id },
      include: publicInclude,
    });
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
    await writeAudit(tx, {
      actorUserId,
      action: "employee.deactivate",
      entity: "Employee",
      entityId: current.id,
      before: { isActive: current.isActive },
      after: { isActive: false },
    });
    return updated;
  });
  return toPublic(employee);
}
