import { apiFetch } from "./client";
import { toQuery } from "./query";
import type { CreateSickDayBody, SickDay } from "../types/api";

export function listSickDays(params: {
  employeeId: string;
  year: number;
  month: number;
}) {
  return apiFetch<SickDay[]>(`/api/v1/sick-days${toQuery(params)}`);
}

export function createSickDay(body: CreateSickDayBody) {
  return apiFetch<SickDay>("/api/v1/sick-days", { method: "POST", body });
}

export function deleteSickDay(id: string) {
  return apiFetch<void>(`/api/v1/sick-days/${id}`, { method: "DELETE" });
}
