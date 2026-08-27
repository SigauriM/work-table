import { Decimal } from "decimal.js";
import { PayType, Prisma, type PrismaClient } from "@prisma/client";
import { ymdFromDateColumn, ymdToDateColumn } from "../../core/berlin.js";
import {
  applyTermsSplit,
  TermsRuleError,
  type TermsSlice,
  type TermsValues,
} from "./terms.range.js";

type TermsRow = {
  id?: string;
  payType: PayType;
  hourlyRate: { toString(): string } | null;
  monthlySalary: { toString(): string } | null;
  hoursPerDay: { toString(): string };
  validFrom: Date;
  validTo: Date | null;
};

export function toSlice(row: TermsRow): TermsSlice {
  return {
    ...(row.id ? { id: row.id } : {}),
    payType: row.payType,
    hourlyRate: row.hourlyRate == null ? null : new Decimal(row.hourlyRate.toString()),
    monthlySalary:
      row.monthlySalary == null ? null : new Decimal(row.monthlySalary.toString()),
    hoursPerDay: new Decimal(row.hoursPerDay.toString()),
    validFrom: ymdFromDateColumn(row.validFrom),
    validTo: row.validTo == null ? null : ymdFromDateColumn(row.validTo),
  };
}

export function termsAuditPayload(periods: TermsSlice[]) {
  return periods.map((p) => ({
    id: p.id ?? null,
    validFrom: p.validFrom,
    validTo: p.validTo,
    payType: p.payType,
    hourlyRate: p.hourlyRate?.toString() ?? null,
    monthlySalary: p.monthlySalary?.toString() ?? null,
    hoursPerDay: p.hoursPerDay.toString(),
  }));
}

export function termsPersistOps(existingIds: Set<string>, next: TermsSlice[]) {
  const updates: TermsSlice[] = [];
  const inserts: TermsSlice[] = [];
  const seen = new Set<string>();
  for (const slice of next) {
    if (slice.id) {
      if (!existingIds.has(slice.id)) {
        throw new TermsRuleError("Employee terms are invalid");
      }
      updates.push(slice);
      seen.add(slice.id);
    } else {
      inserts.push(slice);
    }
  }
  for (const id of existingIds) {
    if (!seen.has(id)) {
      throw new TermsRuleError("Cannot drop existing terms period");
    }
  }
  return { updates, inserts };
}

export async function listTerms(
  tx: Prisma.TransactionClient | PrismaClient,
  employeeId: string,
): Promise<TermsSlice[]> {
  const rows = await tx.employeeTerms.findMany({
    where: { employeeId },
    orderBy: { validFrom: "asc" },
  });
  return rows.map(toSlice);
}

export async function createInitial(
  tx: Prisma.TransactionClient,
  employeeId: string,
  hiredYmd: string,
  values: TermsValues,
) {
  await tx.employeeTerms.create({
    data: {
      employeeId,
      payType: values.payType,
      hourlyRate: values.hourlyRate?.toString() ?? null,
      monthlySalary: values.monthlySalary?.toString() ?? null,
      hoursPerDay: values.hoursPerDay.toString(),
      validFrom: ymdToDateColumn(hiredYmd),
      validTo: null,
    },
  });
}

function termsWriteData(employeeId: string, p: TermsSlice) {
  return {
    employeeId,
    payType: p.payType,
    hourlyRate: p.hourlyRate?.toString() ?? null,
    monthlySalary: p.monthlySalary?.toString() ?? null,
    hoursPerDay: p.hoursPerDay.toString(),
    validFrom: ymdToDateColumn(p.validFrom),
    validTo: p.validTo == null ? null : ymdToDateColumn(p.validTo),
  };
}

export async function persistSlices(
  tx: Prisma.TransactionClient,
  employeeId: string,
  next: TermsSlice[],
) {
  const existing = await tx.employeeTerms.findMany({
    where: { employeeId },
    select: { id: true },
  });
  const { updates, inserts } = termsPersistOps(
    new Set(existing.map((row) => row.id)),
    next,
  );
  for (const p of updates) {
    await tx.employeeTerms.update({
      where: { id: p.id! },
      data: termsWriteData(employeeId, p),
    });
  }
  for (const p of inserts) {
    await tx.employeeTerms.create({
      data: termsWriteData(employeeId, p),
    });
  }
}

export function mergeTermsPatch(
  open: TermsSlice,
  patch: {
    payType?: "HOURLY" | "SALARY";
    hourlyRate?: string | null;
    monthlySalary?: string | null;
    hoursPerDay?: string;
  },
): TermsValues {
  const payType = patch.payType ?? open.payType;
  let hourlyRate = open.hourlyRate;
  let monthlySalary = open.monthlySalary;
  if (patch.payType !== undefined) {
    if (payType === "HOURLY") {
      hourlyRate = toDec(patch.hourlyRate);
      monthlySalary = null;
    } else {
      monthlySalary = toDec(patch.monthlySalary);
      hourlyRate = null;
    }
  } else {
    if (patch.hourlyRate !== undefined) hourlyRate = toDec(patch.hourlyRate);
    if (patch.monthlySalary !== undefined) monthlySalary = toDec(patch.monthlySalary);
  }
  const hoursPerDay =
    patch.hoursPerDay !== undefined ? new Decimal(patch.hoursPerDay) : open.hoursPerDay;
  if (payType === "HOURLY" && hourlyRate == null) {
    throw new TermsRuleError("HOURLY employee missing hourlyRate");
  }
  if (payType === "SALARY" && monthlySalary == null) {
    throw new TermsRuleError("SALARY employee missing monthlySalary");
  }
  return { payType, hourlyRate, monthlySalary, hoursPerDay };
}

export async function applySplitForEmployee(
  tx: Prisma.TransactionClient,
  employeeId: string,
  hiredYmd: string,
  effectiveFrom: string,
  next: TermsValues,
) {
  const periods = await listTerms(tx, employeeId);
  const split = applyTermsSplit(periods, hiredYmd, effectiveFrom, next);
  await persistSlices(tx, employeeId, split);
}

function toDec(value: string | null | undefined): Decimal | null {
  if (value === undefined || value === null || value === "") return null;
  return new Decimal(value);
}
