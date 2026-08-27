import { apiFetch } from "./client";
import type { AuthResponse, PublicUser } from "../types/api";

export function loginRequest(login: string, password: string) {
  return apiFetch<AuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { login, password },
    skipAuth: true,
    credentials: "include",
  });
}

export function refreshRequest() {
  return apiFetch<AuthResponse>("/api/v1/auth/refresh", {
    method: "POST",
    skipAuth: true,
    credentials: "include",
    csrf: true,
  });
}

export function logoutRequest() {
  return apiFetch<void>("/api/v1/auth/logout", {
    method: "POST",
    skipAuth: true,
    credentials: "include",
    csrf: true,
  });
}

export function meRequest() {
  return apiFetch<PublicUser>("/api/v1/auth/me");
}

export function changePasswordRequest(currentPassword: string, newPassword: string) {
  return apiFetch<{ user: PublicUser }>("/api/v1/auth/password", {
    method: "PATCH",
    body: { currentPassword, newPassword },
    credentials: "include",
  });
}
