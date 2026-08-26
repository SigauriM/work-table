import { apiFetch } from "./client";
import { toQuery } from "./query";
import type { CreateShiftBody, Shift, UpdateShiftBody } from "../types/api";

export function listShifts(params: {
  employeeId: string;
  year?: number;
  month?: number;
}) {
  return apiFetch<Shift[]>(`/api/shifts${toQuery(params)}`);
}

export function createShift(body: CreateShiftBody) {
  return apiFetch<Shift>("/api/shifts", { method: "POST", body });
}

export function updateShift(id: string, body: UpdateShiftBody) {
  return apiFetch<Shift>(`/api/shifts/${id}`, { method: "PATCH", body });
}

export function deleteShift(id: string) {
  return apiFetch<void>(`/api/shifts/${id}`, { method: "DELETE" });
}
