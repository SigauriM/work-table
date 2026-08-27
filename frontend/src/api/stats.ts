import { apiFetch } from "./client";
import { toQuery } from "./query";
import type { EmployeeStats, OverviewRow } from "../types/api";

export function meStats(year: number, month: number) {
  return apiFetch<EmployeeStats>(`/api/v1/me/stats${toQuery({ year, month })}`);
}

export function employeeStats(employeeId: string, year: number, month: number) {
  return apiFetch<EmployeeStats>(
    `/api/v1/employees/${employeeId}/stats${toQuery({ year, month })}`,
  );
}

export function statsOverview(year: number, month: number) {
  return apiFetch<OverviewRow[]>(
    `/api/v1/stats/overview${toQuery({ year, month })}`,
  );
}
