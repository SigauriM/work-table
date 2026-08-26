import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { calculateWorkedMinutes } from "../../core/calculations.js";
import { HttpError } from "../../middleware/errorHandler.js";
import type { z } from "zod";
import type {
  createShiftSchema,
  listShiftsQuerySchema,
  updateShiftSchema,
} from "./shifts.schema.js";

type Actor = {
  userId: string;
  role: Role;
  employeeId: string | null;
};

type CreateInput = z.infer<typeof createShiftSchema>;
type UpdateInput = z.infer<typeof updateShiftSchema>;
type ListQuery = z.infer<typeof listShiftsQuerySchema>;

function monthRangeUtc(year: number, month: number): { gte: Date; lt: Date } {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

function dateOnlyUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Смена через полночь ок; минуты относятся к date (день начала). */
function assertShiftTimes(input: {
  startTime: Date;
  endTime: Date;
  breakStart?: Date | null;
  breakEnd?: Date | null;
}) {
  if (!(input.endTime > input.startTime)) {
    throw new HttpError(400, "endTime must be after startTime");
  }
  const hasStart = input.breakStart != null;
  const hasEnd = input.breakEnd != null;
  if (hasStart !== hasEnd) {
    throw new HttpError(400, "breakStart and breakEnd must both be set or both omitted");
  }
  if (hasStart && hasEnd) {
    if (!(input.breakStart! < input.breakEnd!)) {
      throw new HttpError(400, "breakEnd must be after breakStart");
    }
    if (input.breakStart! < input.startTime || input.breakEnd! > input.endTime) {
      throw new HttpError(400, "break must be within shift");
    }
  }
}

async function assertEmployeeWritable(tx: Prisma.TransactionClient, employeeId: string) {
  const employee = await tx.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    throw new HttpError(404, "Not found");
  }
  if (!employee.isActive) {
    throw new HttpError(403, "Forbidden");
  }
  return employee;
}

function assertCanAccess(actor: Actor, rowEmployeeId: string) {
  if (actor.role === Role.EMPLOYEE && actor.employeeId !== rowEmployeeId) {
    throw new HttpError(403, "Forbidden");
  }
}

export async function listShifts(query: ListQuery) {
  if (query.year !== undefined && query.month !== undefined) {
    const range = monthRangeUtc(query.year, query.month);
    return prisma.shift.findMany({
      where: {
        employeeId: query.employeeId,
        date: { gte: range.gte, lt: range.lt },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
  }
  return prisma.shift.findMany({
    where: { employeeId: query.employeeId },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
  });
}

export async function createShift(input: CreateInput) {
  const date = dateOnlyUtc(input.date);
  assertShiftTimes(input);
  const workedMinutes = calculateWorkedMinutes({
    startTime: input.startTime,
    endTime: input.endTime,
    breakStart: input.breakStart ?? null,
    breakEnd: input.breakEnd ?? null,
  });

  return prisma.$transaction(async (tx) => {
    await assertEmployeeWritable(tx, input.employeeId);

    const sick = await tx.sickDay.findUnique({
      where: {
        employeeId_date: { employeeId: input.employeeId, date },
      },
    });
    if (sick) {
      throw new HttpError(409, "Shift and sick day conflict");
    }

    return tx.shift.create({
      data: {
        employeeId: input.employeeId,
        date,
        startTime: input.startTime,
        endTime: input.endTime,
        breakStart: input.breakStart ?? null,
        breakEnd: input.breakEnd ?? null,
        workedMinutes,
        note: input.note ?? null,
      },
    });
  });
}

export async function updateShift(id: string, input: UpdateInput, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.shift.findUnique({ where: { id } });
    if (!current) {
      throw new HttpError(404, "Not found");
    }
    assertCanAccess(actor, current.employeeId);
    await assertEmployeeWritable(tx, current.employeeId);

    const next = {
      date: input.date !== undefined ? dateOnlyUtc(input.date) : current.date,
      startTime: input.startTime ?? current.startTime,
      endTime: input.endTime ?? current.endTime,
      breakStart:
        input.breakStart !== undefined ? input.breakStart : current.breakStart,
      breakEnd: input.breakEnd !== undefined ? input.breakEnd : current.breakEnd,
      note: input.note !== undefined ? input.note : current.note,
    };

    assertShiftTimes(next);

    const dateChanged = next.date.getTime() !== current.date.getTime();
    if (dateChanged) {
      const sick = await tx.sickDay.findUnique({
        where: {
          employeeId_date: {
            employeeId: current.employeeId,
            date: next.date,
          },
        },
      });
      if (sick) {
        throw new HttpError(409, "Shift and sick day conflict");
      }
    }

    const timesChanged =
      next.startTime.getTime() !== current.startTime.getTime() ||
      next.endTime.getTime() !== current.endTime.getTime() ||
      (next.breakStart?.getTime() ?? null) !== (current.breakStart?.getTime() ?? null) ||
      (next.breakEnd?.getTime() ?? null) !== (current.breakEnd?.getTime() ?? null);

    const workedMinutes = timesChanged
      ? calculateWorkedMinutes({
          startTime: next.startTime,
          endTime: next.endTime,
          breakStart: next.breakStart,
          breakEnd: next.breakEnd,
        })
      : current.workedMinutes;

    return tx.shift.update({
      where: { id: current.id },
      data: {
        date: next.date,
        startTime: next.startTime,
        endTime: next.endTime,
        breakStart: next.breakStart,
        breakEnd: next.breakEnd,
        note: next.note,
        workedMinutes,
      },
    });
  });
}

export async function deleteShift(id: string, actor: Actor) {
  const current = await prisma.shift.findUnique({ where: { id } });
  if (!current) {
    throw new HttpError(404, "Not found");
  }
  assertCanAccess(actor, current.employeeId);
  await prisma.shift.delete({ where: { id: current.id } });
}