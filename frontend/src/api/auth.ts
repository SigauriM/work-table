import { apiFetch } from "./client";
import type { AuthResponse, PublicUser } from "../types/api";

export function loginRequest(login: string, password: string) {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { login, password },
    skipAuth: true,
  });
}

export function refreshRequest(refreshToken: string) {
  return apiFetch<AuthResponse>("/api/auth/refresh", {
    method: "POST",
    body: { refreshToken },
    skipAuth: true,
  });
}

export function logoutRequest(refreshToken: string) {
  return apiFetch<void>("/api/auth/logout", {
    method: "POST",
    body: { refreshToken },
    skipAuth: true,
  });
}

export function meRequest() {
  return apiFetch<PublicUser>("/api/auth/me");
}
