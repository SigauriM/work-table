import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../middleware/errorHandler.js";
import {
  AUDIT_DEFAULT_TAKE,
  type listAuditQuerySchema,
} from "./audit.schema.js";

type ListQuery = z.infer<typeof listAuditQuerySchema>;

export async function listAudit(query: ListQuery) {
  const where = {
    ...(query.entity ? { entity: query.entity } : {}),
    ...(query.entityId ? { entityId: query.entityId } : {}),
  };

  if (query.cursor) {
    const current = await prisma.auditLog.findFirst({
      where: { id: query.cursor, ...where },
      select: { id: true },
    });
    if (!current) {
      throw new HttpError(400, "Invalid cursor");
    }
  }

  const take = query.take ?? AUDIT_DEFAULT_TAKE;
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;

  const actorIds = [...new Set(items.map((row) => row.actorUserId))];
  const actors =
    actorIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, login: true },
        });
  const loginById = new Map(actors.map((user) => [user.id, user.login]));

  return {
    items: items.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      actorUserId: row.actorUserId,
      actorLogin: loginById.get(row.actorUserId) ?? null,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      before: row.before,
      after: row.after,
    })),
    nextCursor: hasMore ? items[items.length - 1]!.id : null,
  };
}

export async function writeAudit(
  tx: Prisma.TransactionClient,
  entry: {
    actorUserId: string;
    action: string;
    entity: string;
    entityId: string;
    before?: Prisma.InputJsonValue | null;
    after?: Prisma.InputJsonValue | null;
  },
) {
  await tx.auditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: entry.before ?? undefined,
      after: entry.after ?? undefined,
    },
  });
}
