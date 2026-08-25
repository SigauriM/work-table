import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../middleware/errorHandler.js";
import type { z } from "zod";
import type {
  createOvertimePayoutSchema,
  createSalaryPayoutSchema,
  listPayoutsQuerySchema,
} from "./payouts.schema.js";

type ListQuery = z.infer<typeof listPayoutsQuerySchema>;
type CreateOvertimeInput = z.infer<typeof createOvertimePayoutSchema>;
type CreateSalaryInput = z.infer<typeof createSalaryPayoutSchema>;

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

function toSalaryPublic(row: {
  id: string;
  employeeId: string;
  year: number;
  month: number;
  amount: { toString(): string };
  paidAt: Date;
  note: string | null;
}) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    year: row.year,
    month: row.month,
    amount: decStr(row.amount),
    paidAt: row.paidAt,
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

export async function listSalaryPayouts(employeeId: string, query: ListQuery) {
  await assertEmployee(employeeId);
  const rows = await prisma.salaryPayout.findMany({
    where: {
      employeeId,
      ...(query.year !== undefined && query.month !== undefined
        ? { year: query.year, month: query.month }
        : {}),
    },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });
  return rows.map(toSalaryPublic);
}

export async function createSalaryPayout(employeeId: string, input: CreateSalaryInput) {
  await assertEmployee(employeeId);
  try {
    const row = await prisma.salaryPayout.create({
      data: {
        employeeId,
        year: input.year,
        month: input.month,
        amount: input.amount,
        paidAt: input.paidAt,
        note: input.note ?? null,
      },
    });
    return toSalaryPublic(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "Salary payout already exists for this month");
    }
    throw err;
  }
}

export async function deleteSalaryPayout(employeeId: string, payoutId: string) {
  const row = await prisma.salaryPayout.findUnique({ where: { id: payoutId } });
  if (!row || row.employeeId !== employeeId) {
    throw new HttpError(404, "Not found");
  }
  await prisma.salaryPayout.delete({ where: { id: row.id } });
}
