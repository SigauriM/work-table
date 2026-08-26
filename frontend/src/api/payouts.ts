import { apiFetch } from "./client";
import { toQuery } from "./query";
import type { CreateOvertimePayoutBody, OvertimePayout } from "../types/api";

export function listOvertimePayouts(
  employeeId: string,
  params?: { year: number; month: number },
) {
  return apiFetch<OvertimePayout[]>(
    `/api/employees/${employeeId}/overtime-payouts${toQuery(params ?? {})}`,
  );
}

export function createOvertimePayout(employeeId: string, body: CreateOvertimePayoutBody) {
  return apiFetch<OvertimePayout>(`/api/employees/${employeeId}/overtime-payouts`, {
    method: "POST",
    body,
  });
}

export function deleteOvertimePayout(employeeId: string, payoutId: string) {
  return apiFetch<void>(`/api/employees/${employeeId}/overtime-payouts/${payoutId}`, {
    method: "DELETE",
  });
}
