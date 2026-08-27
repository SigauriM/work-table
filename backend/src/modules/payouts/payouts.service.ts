import { prisma } from "../../config/prisma.js";
import { monthDateRange, ymdFromDateColumn, ymdToDateColumn } from "../../core/berlin.js";
import { HttpError } from "../../middleware/errorHandler.js";
import { writeAudit } from "../audit/audit.service.js";
import type { z } from "zod";
import type {
  createOvertimePayoutSchema,
  listPayoutsQuerySchema,
} from "./payouts.schema.js";

type ListQuery = z.infer<typeof listPayoutsQuerySchema>;
type CreateOvertimeInput = z.infer<typeof createOvertimePayoutSchema>;

function decStr(value: { toString(): string }) {
  return value.toString();
}

async function assertEmployee(employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    throw new HttpError(404, "Not found");
  }
  return employee;
}

function toOvertimePublic(row: {
  id: string;
  employeeId: string;
  date: Date;
  hoursPaid: { toString(): string };
  amount: { toString(): string };
  note: string | null;
}) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    date: row.date,
    hoursPaid: decStr(row.hoursPaid),
    amount: decStr(row.amount),
    note: row.note,
  };
}

export async function listOvertimePayouts(employeeId: string, query: ListQuery) {
  await assertEmployee(employeeId);
  const range =
    query.year !== undefined && query.month !== undefined
      ? monthDateRange(query.year, query.month)
      : undefined;
  const rows = await prisma.overtimePayout.findMany({
    where: {
      employeeId,
      ...(range ? { date: { gte: range.gte, lt: range.lt } } : {}),
    },
    orderBy: { date: "asc" },
  });
  return rows.map(toOvertimePublic);
}

export async function createOvertimePayout(
  employeeId: string,
  input: CreateOvertimeInput,
  actorUserId: string,
) {
  await assertEmployee(employeeId);
  return prisma.$transaction(async (tx) => {
    const row = await tx.overtimePayout.create({
      data: {
        employeeId,
        date: ymdToDateColumn(input.date),
        hoursPaid: input.hoursPaid,
        amount: input.amount,
        note: input.note ?? null,
      },
    });
    await writeAudit(tx, {
      actorUserId,
      action: "overtimePayout.create",
      entity: "OvertimePayout",
      entityId: row.id,
      before: null,
      after: {
        id: row.id,
        employeeId: row.employeeId,
        date: ymdFromDateColumn(row.date),
        hoursPaid: decStr(row.hoursPaid),
        amount: decStr(row.amount),
        note: row.note,
      },
    });
    return toOvertimePublic(row);
  });
}

export async function deleteOvertimePayout(
  employeeId: string,
  payoutId: string,
  actorUserId: string,
) {
  await prisma.$transaction(async (tx) => {
    const row = await tx.overtimePayout.findUnique({ where: { id: payoutId } });
    if (!row || row.employeeId !== employeeId) {
      throw new HttpError(404, "Not found");
    }
    await tx.overtimePayout.delete({ where: { id: row.id } });
    await writeAudit(tx, {
      actorUserId,
      action: "overtimePayout.delete",
      entity: "OvertimePayout",
      entityId: row.id,
      before: {
        id: row.id,
        employeeId: row.employeeId,
        date: ymdFromDateColumn(row.date),
        hoursPaid: decStr(row.hoursPaid),
        amount: decStr(row.amount),
        note: row.note,
      },
      after: null,
    });
  });
}
