import { apiFetch } from "./client";
import { toQuery } from "./query";
import type { CreateShiftBody, Shift, ShiftPage, UpdateShiftBody } from "../types/api";

export function listShifts(params: {
  employeeId: string;
  year: number;
  month: number;
}) {
  return apiFetch<Shift[]>(`/api/v1/shifts${toQuery(params)}`);
}

export function listShiftsPage(params: {
  employeeId: string;
  cursor?: string;
  take?: number;
}) {
  return apiFetch<ShiftPage>(`/api/v1/shifts${toQuery(params)}`);
}

export function createShift(body: CreateShiftBody) {
  return apiFetch<Shift>("/api/v1/shifts", { method: "POST", body });
}

export function updateShift(id: string, body: UpdateShiftBody) {
  return apiFetch<Shift>(`/api/v1/shifts/${id}`, { method: "PATCH", body });
}

export function deleteShift(id: string) {
  return apiFetch<void>(`/api/v1/shifts/${id}`, { method: "DELETE" });
}
