import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../middleware/errorHandler.js";
import type { z } from "zod";
import type {
  createOvertimePayoutSchema,
  listPayoutsQuerySchema,
} from "./payouts.schema.js";

type ListQuery = z.infer<typeof listPayoutsQuerySchema>;
type CreateOvertimeInput = z.infer<typeof createOvertimePayoutSchema>;

function monthRangeUtc(year: number, month: number): { gte: Date; lt: Date } {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

function dateOnlyUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

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
      ? monthRangeUtc(query.year, query.month)
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

export async function createOvertimePayout(employeeId: string, input: CreateOvertimeInput) {
  await assertEmployee(employeeId);
  const row = await prisma.overtimePayout.create({
    data: {
      employeeId,
      date: dateOnlyUtc(input.date),
      hoursPaid: input.hoursPaid,
      amount: input.amount,
      note: input.note ?? null,
    },
  });
  return toOvertimePublic(row);
}

export async function deleteOvertimePayout(employeeId: string, payoutId: string) {
  const row = await prisma.overtimePayout.findUnique({ where: { id: payoutId } });
  if (!row || row.employeeId !== employeeId) {
    throw new HttpError(404, "Not found");
  }
  await prisma.overtimePayout.delete({ where: { id: row.id } });
}
