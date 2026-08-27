import type { Prisma } from "@prisma/client";

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
