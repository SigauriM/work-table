import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import {
  assertShiftOnBerlinDate,
  berlinYmd,
  isYmdInClosedMonth,
  monthDateRange,
  ymdFromDateColumn,
  ymdToDateColumn,
} from "../../core/berlin.js";
import { calculateWorkedMinutes } from "../../core/calculations.js";
import { HttpError } from "../../middleware/errorHandler.js";
import { writeAudit } from "../audit/audit.service.js";
import type { z } from "zod";
import {
  LIST_SHIFTS_DEFAULT_TAKE,
  type createShiftSchema,
  type listShiftsQuerySchema,
  type updateShiftSchema,
} from "./shifts.schema.js";

type Actor = {
  userId: string;
  role: Role;
  employeeId: string | null;
};

type CreateInput = z.infer<typeof createShiftSchema>;
type UpdateInput = z.infer<typeof updateShiftSchema>;
type ListQuery = z.infer<typeof listShiftsQuerySchema>;

function requireShiftOnBerlinDate(dateYmd: string, startTime: Date, endTime: Date) {
  try {
    assertShiftOnBerlinDate(dateYmd, startTime, endTime);
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : "Invalid date");
  }
}

/** Overnight shift is allowed; minutes belong to `date` (start day). */
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

function assertMonthWritable(actor: Actor, dateYmd: string) {
  if (isYmdInClosedMonth(dateYmd, berlinYmd(new Date())) && actor.role !== Role.ADMIN) {
    throw new HttpError(409, "Month is closed");
  }
}

function shiftAuditPayload(row: {
  id: string;
  employeeId: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  breakStart: Date | null;
  breakEnd: Date | null;
  workedMinutes: number;
  note: string | null;
}) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    date: ymdFromDateColumn(row.date),
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    breakStart: row.breakStart?.toISOString() ?? null,
    breakEnd: row.breakEnd?.toISOString() ?? null,
    workedMinutes: row.workedMinutes,
    note: row.note,
  };
}

/** Same employee, overlapping instants. Adjacent end==start is allowed. */
async function assertNoOverlappingShift(
  tx: Prisma.TransactionClient,
  employeeId: string,
  startTime: Date,
  endTime: Date,
  exceptId?: string,
) {
  const clash = await tx.shift.findFirst({
    where: {
      employeeId,
      ...(exceptId ? { id: { not: exceptId } } : {}),
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    select: { id: true },
  });
  if (clash) {
    throw new HttpError(409, "Overlapping shift");
  }
}

export async function listShifts(query: ListQuery) {
  if (query.year !== undefined && query.month !== undefined) {
    const range = monthDateRange(query.year, query.month);
    return prisma.shift.findMany({
      where: {
        employeeId: query.employeeId,
        date: { gte: range.gte, lt: range.lt },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
  }

  const take = query.take ?? LIST_SHIFTS_DEFAULT_TAKE;
  if (query.cursor) {
    const current = await prisma.shift.findFirst({
      where: { id: query.cursor, employeeId: query.employeeId },
      select: { id: true },
    });
    if (!current) {
      throw new HttpError(400, "Invalid cursor");
    }
  }

  const rows = await prisma.shift.findMany({
    where: { employeeId: query.employeeId },
    orderBy: [{ date: "desc" }, { startTime: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]!.id : null,
  };
}

export async function createShift(input: CreateInput, actorUserId: string) {
  const date = ymdToDateColumn(input.date);
  assertShiftTimes(input);
  requireShiftOnBerlinDate(input.date, input.startTime, input.endTime);
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

    await assertNoOverlappingShift(tx, input.employeeId, input.startTime, input.endTime);

    const created = await tx.shift.create({
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
    await writeAudit(tx, {
      actorUserId,
      action: "shift.create",
      entity: "Shift",
      entityId: created.id,
      before: null,
      after: shiftAuditPayload(created),
    });
    return created;
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
    assertMonthWritable(actor, ymdFromDateColumn(current.date));

    const dateYmd = input.date ?? ymdFromDateColumn(current.date);
    const next = {
      date: ymdToDateColumn(dateYmd),
      startTime: input.startTime ?? current.startTime,
      endTime: input.endTime ?? current.endTime,
      breakStart:
        input.breakStart !== undefined ? input.breakStart : current.breakStart,
      breakEnd: input.breakEnd !== undefined ? input.breakEnd : current.breakEnd,
      note: input.note !== undefined ? input.note : current.note,
    };

    assertShiftTimes(next);
    requireShiftOnBerlinDate(dateYmd, next.startTime, next.endTime);
    assertMonthWritable(actor, dateYmd);

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

    await assertNoOverlappingShift(
      tx,
      current.employeeId,
      next.startTime,
      next.endTime,
      current.id,
    );

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

    const updated = await tx.shift.update({
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
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "shift.update",
      entity: "Shift",
      entityId: updated.id,
      before: shiftAuditPayload(current),
      after: shiftAuditPayload(updated),
    });
    return updated;
  });
}

export async function deleteShift(id: string, actor: Actor) {
  await prisma.$transaction(async (tx) => {
    const current = await tx.shift.findUnique({ where: { id } });
    if (!current) {
      throw new HttpError(404, "Not found");
    }
    assertCanAccess(actor, current.employeeId);
    assertMonthWritable(actor, ymdFromDateColumn(current.date));
    await tx.shift.delete({ where: { id: current.id } });
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "shift.delete",
      entity: "Shift",
      entityId: current.id,
      before: shiftAuditPayload(current),
      after: null,
    });
  });
}