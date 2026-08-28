import { apiFetch } from "./client";
import { toQuery } from "./query";
import type { AuditEntity, AuditLogPage } from "../types/api";

export function listAudit(params?: {
  entity?: AuditEntity;
  entityId?: string;
  cursor?: string;
  take?: number;
}) {
  return apiFetch<AuditLogPage>(`/api/v1/audit${toQuery(params ?? {})}`);
}
