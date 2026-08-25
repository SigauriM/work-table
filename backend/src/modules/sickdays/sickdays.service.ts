import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../middleware/errorHandler.js";
import type { z } from "zod";
import type {
  createSickDaySchema,
  listSickDaysQuerySchema,
} from "./sickdays.schema.js";

type Actor = {
  userId: string;
  role: Role;
  employeeId: string | null;
};

type CreateInput = z.infer<typeof createSickDaySchema>;
type ListQuery = z.infer<typeof listSickDaysQuerySchema>;

function monthRangeUtc(year: number, month: number): { gte: Date; lt: Date } {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

function dateOnlyUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function assertCanAccess(actor: Actor, rowEmployeeId: string) {
  if (actor.role === Role.EMPLOYEE && actor.employeeId !== rowEmployeeId) {
    throw new HttpError(403, "Forbidden");
  }
}

export async function listSickDays(query: ListQuery) {
  const range = monthRangeUtc(query.year, query.month);
  return prisma.sickDay.findMany({
    where: {
      employeeId: query.employeeId,
      date: { gte: range.gte, lt: range.lt },
    },
    orderBy: { date: "asc" },
  });
}

export async function createSickDay(input: CreateInput) {
  const date = dateOnlyUtc(input.date);

  try {
    return await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { id: input.employeeId },
      });
      if (!employee) {
        throw new HttpError(404, "Not found");
      }
      if (!employee.isActive) {
        throw new HttpError(403, "Forbidden");
      }

      const shift = await tx.shift.findFirst({
        where: { employeeId: input.employeeId, date },
      });
      if (shift) {
        throw new HttpError(409, "Shift and sick day conflict");
      }

      return tx.sickDay.create({
        data: {
          employeeId: input.employeeId,
          date,
          creditedHours: employee.hoursPerDay,
          note: input.note ?? null,
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "Sick day already exists for this date");
    }
    throw err;
  }
}

export async function deleteSickDay(id: string, actor: Actor) {
  const current = await prisma.sickDay.findUnique({ where: { id } });
  if (!current) {
    throw new HttpError(404, "Not found");
  }
  assertCanAccess(actor, current.employeeId);
  await prisma.sickDay.delete({ where: { id: current.id } });
}