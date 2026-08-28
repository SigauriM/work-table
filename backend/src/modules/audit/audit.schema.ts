import { z } from "zod";

export const AUDIT_DEFAULT_TAKE = 50;
export const AUDIT_MAX_TAKE = 100;

export const listAuditQuerySchema = z.object({
  entity: z.enum(["Shift", "Employee", "User", "OvertimePayout"]).optional(),
  entityId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(AUDIT_MAX_TAKE).optional(),
});
