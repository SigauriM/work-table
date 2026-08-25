import { apiFetch } from "./client";
import { toQuery } from "./query";
import type {
  CreateEmployeeBody,
  Employee,
  UpdateEmployeeBody,
} from "../types/api";

export function listEmployees(isActive?: boolean) {
  return apiFetch<Employee[]>(
    `/api/employees${toQuery({
      isActive: isActive === undefined ? undefined : String(isActive),
    })}`,
  );
}

export function getEmployee(id: string) {
  return apiFetch<Employee>(`/api/employees/${id}`);
}

export function createEmployee(body: CreateEmployeeBody) {
  return apiFetch<Employee>("/api/employees", { method: "POST", body });
}

export function updateEmployee(id: string, body: UpdateEmployeeBody) {
  return apiFetch<Employee>(`/api/employees/${id}`, { method: "PATCH", body });
}

/** Мягкое удаление = isActive false + revoke refresh */
export function deactivateEmployee(id: string) {
  return apiFetch<Employee>(`/api/employees/${id}`, { method: "DELETE" });
}
