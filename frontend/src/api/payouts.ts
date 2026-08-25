import { apiFetch } from "./client";
import { toQuery } from "./query";
import type {
  CreateOvertimePayoutBody,
  CreateSalaryPayoutBody,
  OvertimePayout,
  SalaryPayout,
} from "../types/api";

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

export function listSalaryPayouts(
  employeeId: string,
  params?: { year: number; month: number },
) {
  return apiFetch<SalaryPayout[]>(
    `/api/employees/${employeeId}/salary-payouts${toQuery(params ?? {})}`,
  );
}

export function createSalaryPayout(employeeId: string, body: CreateSalaryPayoutBody) {
  return apiFetch<SalaryPayout>(`/api/employees/${employeeId}/salary-payouts`, {
    method: "POST",
    body,
  });
}

export function deleteSalaryPayout(employeeId: string, payoutId: string) {
  return apiFetch<void>(`/api/employees/${employeeId}/salary-payouts/${payoutId}`, {
    method: "DELETE",
  });
}
